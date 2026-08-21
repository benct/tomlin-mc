import dgram from 'node:dgram';

/**
 * Minimal implementation of the Minecraft "Query" protocol (GameSpy4-based),
 * which runs over UDP and must be enabled server-side with `enable-query=true`
 * in `server.properties`. Unlike Server List Ping, the "full stat" response
 * includes the complete online player list (not just a truncated sample).
 *
 * Protocol reference: https://minecraft.wiki/w/Java_Edition_protocol/Query
 */

const MAGIC = Buffer.from([0xfe, 0xfd]);
const TYPE_HANDSHAKE = 0x09;
const TYPE_STAT = 0x00;
/** Arbitrary session id; only the low nibble of each byte is significant. */
const SESSION_ID = 0x01;

/** Parsed subset of a full-stat Query response. */
/**
 * A full-stat Query response. Every key/value pair the server sends is preserved
 * verbatim in {@link QueryStatus.kv}; the well-known fields below are typed
 * conveniences derived from it. Vanilla servers send: `hostname` (the MOTD),
 * `gametype`, `game_id`, `version`, `plugins`, `map`, `numplayers`, `maxplayers`,
 * `hostport`, and `hostip`.
 */
export interface QueryStatus {
    motd: string | null;
    version: string | null;
    gametype: string | null;
    gameId: string | null;
    plugins: string | null;
    map: string | null;
    numplayers: number;
    maxplayers: number;
    hostport: number | null;
    hostip: string | null;
    players: string[];
}

/** Read a NUL-terminated ASCII/UTF-8 string starting at `offset`. */
const readNullString = (buf: Buffer, offset: number): { value: string; next: number } => {
    const end = buf.indexOf(0x00, offset);
    if (end === -1) throw new Error('Malformed response: unterminated string');
    return { value: buf.toString('utf8', offset, end), next: end + 1 };
};

/** Build the handshake request packet. */
const handshakePacket = (): Buffer => {
    const sid = Buffer.alloc(4);
    sid.writeInt32BE(SESSION_ID);
    return Buffer.concat([MAGIC, Buffer.from([TYPE_HANDSHAKE]), sid]);
};

/** Build the full-stat request packet from a challenge token. */
const fullStatPacket = (challenge: number): Buffer => {
    const sid = Buffer.alloc(4);
    sid.writeInt32BE(SESSION_ID);
    const token = Buffer.alloc(4);
    token.writeInt32BE(challenge);
    // Trailing 4 bytes of padding request the "full" stat instead of "basic".
    return Buffer.concat([MAGIC, Buffer.from([TYPE_STAT]), sid, token, Buffer.alloc(4)]);
};

/** Parse the challenge token (a NUL-terminated decimal string) from a handshake response. */
const parseChallenge = (msg: Buffer): number => {
    if (msg[0] !== TYPE_HANDSHAKE) throw new Error(`Unexpected handshake type: ${msg[0]}`);
    const { value } = readNullString(msg, 5); // skip type (1) + session id (4)
    const challenge = Number.parseInt(value, 10);
    if (Number.isNaN(challenge)) throw new Error('Malformed handshake: invalid challenge token');
    return challenge;
};

/** Parse a full-stat response into a {@link QueryStatus}. */
const parseFullStat = (msg: Buffer): QueryStatus => {
    if (msg[0] !== TYPE_STAT) throw new Error(`Unexpected stat type: ${msg[0]}`);

    // type (1) + session id (4) + 11-byte constant padding ("splitnum\x00\x80\x00")
    let offset = 5 + 11;

    // Key/value section, terminated by an empty key.
    const kv: Record<string, string> = {};
    for (;;) {
        const key = readNullString(msg, offset);
        offset = key.next;
        if (key.value === '') break;
        const val = readNullString(msg, offset);
        offset = val.next;
        kv[key.value] = val.value;
    }

    // 10-byte constant padding ("\x01player_\x00\x00") precedes the player section.
    offset += 10;

    // Player section, terminated by an empty name.
    const players: string[] = [];
    for (;;) {
        const player = readNullString(msg, offset);
        offset = player.next;
        if (player.value === '') break;
        players.push(player.value);
    }

    const toInt = (value: string | undefined): number | null => {
        if (value === undefined) return null;
        const n = Number.parseInt(value, 10);
        return Number.isNaN(n) ? null : n;
    };

    return {
        motd: kv.hostname || null,
        version: kv.version || null,
        gametype: kv.gametype || null,
        gameId: kv.game_id || null,
        plugins: kv.plugins || null,
        map: kv.map || null,
        numplayers: toInt(kv.numplayers) ?? 0,
        maxplayers: toInt(kv.maxplayers) ?? 0,
        hostport: toInt(kv.hostport),
        hostip: kv.hostip || null,
        players,
    };
};

/**
 * Query a Minecraft server via the UDP Query protocol (full stat).
 *
 * @param host      Server hostname or IP.
 * @param port      Query port (default 25565; configurable via `query.port`).
 * @param timeoutMs Overall timeout for the handshake + stat exchange (default 5000).
 */
export const queryServer = (host: string, port = 25565, timeoutMs = 5000): Promise<QueryStatus> =>
    new Promise((resolve, reject) => {
        const socket = dgram.createSocket('udp4');
        let settled = false;

        const finish = (err: Error | null, result?: QueryStatus) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            socket.close();
            if (err) reject(err);
            else resolve(result as QueryStatus);
        };

        const timer = setTimeout(() => finish(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);

        socket.on('error', (err) => finish(err));

        let gotChallenge = false;
        socket.on('message', (msg) => {
            try {
                if (gotChallenge) {
                    finish(null, parseFullStat(msg));
                } else {
                    gotChallenge = true;
                    const challenge = parseChallenge(msg);
                    socket.send(fullStatPacket(challenge), port, host, (err) => {
                        if (err) finish(err);
                    });
                }
            } catch (err) {
                finish(err instanceof Error ? err : new Error(String(err)));
            }
        });

        socket.send(handshakePacket(), port, host, (err) => {
            if (err) finish(err);
        });
    });
