import net from 'node:net';

/**
 * Minimal implementation of the Minecraft "Server List Ping" protocol (modern,
 * 1.7+) so we can query a live server over TCP without a third-party service.
 *
 * Protocol reference: https://minecraft.wiki/w/Java_Edition_protocol/Server_List_Ping
 */

/**
 * The full JSON status response, as documented by the protocol. Well-known
 * fields are typed; the index signature preserves any additional/modded fields
 * (e.g. Forge's `forgeData`) so the entire object is available to callers.
 */
export interface PingStatus {
    version?: { name?: string; protocol?: number };
    players?: {
        max?: number;
        online?: number;
        sample?: { name: string; id: string }[];
    };
    description?: unknown;
    favicon?: string;
    enforcesSecureChat?: boolean;
    [key: string]: unknown;
}

/** ---- VarInt helpers ---- */

/** Encode a non-negative integer as a Minecraft VarInt. */
const encodeVarInt = (value: number): Buffer => {
    const bytes: number[] = [];
    let v = value >>> 0;
    do {
        let byte = v & 0x7f;
        v >>>= 7;
        if (v !== 0) byte |= 0x80;
        bytes.push(byte);
    } while (v !== 0);
    return Buffer.from(bytes);
};

/** Decode a VarInt from `buf` at `offset`. Returns null if more bytes are needed. */
const readVarInt = (buf: Buffer, offset: number): { value: number; size: number } | null => {
    let value = 0;
    let size = 0;
    let byte: number;
    do {
        if (offset + size >= buf.length) return null;
        byte = buf[offset + size];
        value |= (byte & 0x7f) << (7 * size);
        size += 1;
        if (size > 5) throw new Error('VarInt is too big');
    } while ((byte & 0x80) !== 0);
    return { value, size };
};

/** Prefix a packet body with its VarInt length. */
const framePacket = (body: Buffer): Buffer => Buffer.concat([encodeVarInt(body.length), body]);

/** Encode a length-prefixed UTF-8 string. */
const encodeString = (str: string): Buffer => {
    const data = Buffer.from(str, 'utf8');
    return Buffer.concat([encodeVarInt(data.length), data]);
};

/**
 * Query a Minecraft server via Server List Ping.
 *
 * @param host      Server hostname or IP.
 * @param port      Server port (default 25565).
 * @param timeoutMs Connection/response timeout (default 5000).
 */
export const pingServer = (host: string, port = 25565, timeoutMs = 5000): Promise<PingStatus> =>
    new Promise((resolve, reject) => {
        const socket = net.createConnection({ host, port });
        socket.setTimeout(timeoutMs);

        let chunks = Buffer.alloc(0);
        let expectedLen: number | null = null;
        let headerSize = 0;

        const fail = (err: Error) => {
            socket.destroy();
            reject(err);
        };

        socket.on('connect', () => {
            // Handshake: protocol version -1 (unknown), then address/port, next state 1 (status).
            const handshake = framePacket(
                Buffer.concat([
                    encodeVarInt(0x00), // packet id
                    encodeVarInt(0xffffffff), // protocol version (-1 as VarInt)
                    encodeString(host),
                    (() => {
                        const b = Buffer.alloc(2);
                        b.writeUInt16BE(port);
                        return b;
                    })(),
                    encodeVarInt(0x01), // next state: status
                ]),
            );
            // Status request: empty packet with id 0x00.
            const request = framePacket(encodeVarInt(0x00));
            socket.write(Buffer.concat([handshake, request]));
        });

        socket.on('data', (data) => {
            chunks = Buffer.concat([chunks, data]);

            // First, read the overall packet length prefix.
            if (expectedLen === null) {
                const header = readVarInt(chunks, 0);
                if (!header) return; // need more bytes
                expectedLen = header.value;
                headerSize = header.size;
            }

            // Wait until the full packet body has arrived.
            if (chunks.length < headerSize + expectedLen) return;

            try {
                let offset = headerSize;
                const packetId = readVarInt(chunks, offset);
                if (!packetId) throw new Error('Malformed response: missing packet id');
                offset += packetId.size;
                if (packetId.value !== 0x00) throw new Error(`Unexpected packet id: ${packetId.value}`);

                const strLen = readVarInt(chunks, offset);
                if (!strLen) throw new Error('Malformed response: missing string length');
                offset += strLen.size;

                const json = chunks.subarray(offset, offset + strLen.value).toString('utf8');
                socket.destroy();
                resolve(JSON.parse(json) as PingStatus);
            } catch (err) {
                fail(err instanceof Error ? err : new Error(String(err)));
            }
        });

        socket.on('timeout', () => fail(new Error(`Timed out after ${timeoutMs}ms`)));
        socket.on('error', fail);
    });
