import { open, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { gunzip } from 'node:zlib';
import { logsDir, statsDir } from '@/lib/env';
import { readRoster } from '@/lib/serverData';
import { LOG_TYPES, type LogEntry, type LogType } from '@/lib/types';

/**
 * Reads the Minecraft server's own log files and turns them into the entries
 * both log views render.
 *
 * Nothing extra runs server-side: vanilla already writes everything either view
 * shows, so this reads the stock files rather than depending on a mod or a
 * scheduled exporter. The work is one pipeline — find the files, parse each line,
 * date it, work out what it means — and it lives in one place because every step
 * depends on the one before it.
 *
 * Classification is an allowlist of line shapes, which is what keeps startup
 * chatter and mod noise out for free: an unrecognised `INFO` line is dropped.
 * Warnings and errors are the exception and are taken whole, since the point of
 * showing them is that we don't know in advance what they'll say.
 *
 * **Two views, one allowlist.** `PUBLIC` below is the only set a public page is
 * ever handed: deaths and advancements. Who is logged in, what they said, and how
 * the server is behaving are all either private or nobody's business, so the rest
 * exists for `/admin`, which is password-gated. A type outside `PUBLIC` cannot
 * reach a public page. IP addresses reach neither — they are masked as each line
 * is parsed, so nothing downstream can leak one by accident.
 *
 * Server-only: this module touches the filesystem, so it must only be imported
 * from server components or route handlers.
 */

/* --- Finding and reading the files -------------------------------------- */

/**
 * How much of `latest.log` to read. The log is append-only and we only ever
 * want its tail, so reading the last chunk beats parsing a file that grows
 * unbounded between restarts. 256 KB is a few thousand lines.
 */
const TAIL_BYTES = 256 * 1024;

/**
 * How many rotated logs are worth listing. Reading stops as soon as a caller has
 * enough, so this is only the ceiling on how far back the deepest read can go.
 * Reading them all is still cheap: a few KB gzipped each.
 */
const MAX_ROTATED = 40;

const LATEST = 'latest.log';

/** Rotated logs are named for the day they cover, plus a counter for restarts within it. */
const ROTATED = /^(\d{4})-(\d{2})-(\d{2})-(\d+)\.log\.gz$/;

/* --- Parsing a line ------------------------------------------------------ */

/**
 * A log line: `[22:14:03] [Server thread/INFO]: Ben joined the game`. Fabric
 * mods add a ` (ModName)` source before the colon, which is captured loosely
 * and folded into the thread.
 */
const LINE = /^\[(\d{2}):(\d{2}):(\d{2})\] \[([^\]]+)\](?: \(([^)]*)\))?: (.*)$/;

/**
 * Addresses as Java writes them — `/1.2.3.4:56078`, `/[::1]:56078` — plus a bare
 * `host:port`. Anchoring on the leading slash or the port is what keeps mod
 * version strings (`1.21.4.2`) out of it; a four-part number on its own is left
 * alone. The surrounding punctuation is kept so a masked line still reads like
 * the line it replaced, and still parses like one.
 */
const ADDRESSES: [RegExp, string][] = [
    [/(\/)\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?/g, '$1x.x.x.x'],
    [/(\/)\[[0-9a-fA-F:]+\](?::\d+)?/g, '$1[x:x:x]'],
    [/\b\d{1,3}(?:\.\d{1,3}){3}:\d+\b/g, 'x.x.x.x'],
];

/** Minecraft's legacy colour and style codes, which are noise in a log listing. */
const FORMATTING = /§[0-9a-fk-or]/gi;

/** A stack frame: `\tat net.minecraft…`, or the `... 24 more` that ends a nested trace. */
const FRAME = /^\s+(?:at\s|\.{3}\s\d+\smore)/;

/** What a line's level is called when the log didn't say. */
const UNKNOWN_LEVEL = 'UNKNOWN';

/* --- Working out what a line means --------------------------------------- */

/** How many entries the public view shows. */
const PUBLIC_LIMIT = 50;

/** The only types a public page may show. */
const PUBLIC: ReadonlySet<LogType> = new Set<LogType>(['death', 'advancement']);

/** Everything, for the admin view. */
const ALL: ReadonlySet<LogType> = new Set(LOG_TYPES);

/** How much of a warning or error to keep. They can run long; the gist is on the front. */
const MAX_TEXT = 240;

/** Minecraft usernames — the character class the server itself enforces. */
const NAME = '[A-Za-z0-9_]{3,16}';

/**
 * The marker the server puts in front of a message it couldn't verify the
 * signature of. Both chat and `/say` carry it, and a server running with chat
 * signing off carries it on everything, so it is always optional.
 */
const UNSIGNED = '(?:\\[Not Secure\\] )?';

/**
 * The lines we can identify outright, by exact shape. Order matters only for
 * chat and `/say`: `[Not Secure] <Ben> hi` would satisfy both, and it's chat.
 */
const MATCHERS: { pattern: RegExp; type: LogType }[] = [
    { pattern: new RegExp(`^(${NAME}) (joined the game)$`), type: 'join' },
    { pattern: new RegExp(`^(${NAME}) (left the game)$`), type: 'leave' },
    { pattern: new RegExp(`^(${NAME}) (has made the advancement \\[.+\\])$`), type: 'advancement' },
    { pattern: new RegExp(`^(${NAME}) (has completed the challenge \\[.+\\])$`), type: 'advancement' },
    { pattern: new RegExp(`^(${NAME}) (has reached the goal \\[.+\\])$`), type: 'advancement' },
    // Chat, behind the unsigned marker or not.
    { pattern: new RegExp(`^${UNSIGNED}<(${NAME})> (.+)$`), type: 'chat' },
    // `/me waves`, which the server renders as a bare `* Ben waves`.
    { pattern: new RegExp(`^\\* (${NAME}) (.+)$`), type: 'chat' },
    // `/say`, from the console (`[Server]`) or from a player, and unsigned like
    // chat. Checked against the known names below, because a mod logging
    // `[Pl3xMap] …` has the same shape.
    { pattern: new RegExp(`^${UNSIGNED}\\[(${NAME})\\] (.+)$`), type: 'server' },
];

/** The name the server broadcasts under when the command came from the console. */
const CONSOLE_NAME = 'Server';

/**
 * The types whose player named themselves. A `/say` doesn't qualify — the
 * bracketed name is exactly what's in doubt — and nor does a death, which is
 * only recognised once the name is already known.
 */
const NAMED: ReadonlySet<LogType> = new Set<LogType>(['join', 'leave', 'advancement', 'chat']);

/**
 * Any line beginning with a player's name, which is all a death message has in
 * common. Connection lines optionally carry the player's address between the
 * name and the message (`Steve (/x.x.x.x) lost connection: …`, masked while
 * parsing); it is discarded here so the exclusions below see a uniform message
 * either way.
 */
const PREFIXED = new RegExp(`^(${NAME})(?: \\(/[^)]*\\))? (.+)$`);

/**
 * Death messages have no marker of their own and there are ~150 of them, so
 * rather than enumerate a list that rots on every Minecraft update we treat any
 * leftover line starting with a known player's name as a death — and rule out
 * the handful of lines that also start that way but aren't.
 */
const NOT_DEATHS = [
    /^lost connection:/,
    /^issued server command:/,
    /^moved too quickly!/,
    /^moved wrongly!/,
    /^was kicked/,
    /^\(vehicle of /,
    // A mob dying near a player: `Villager Villager['Cleric'/2513, l='…', x=…] died, message: '…'`.
    // The name gate already drops these, but they carry exact coordinates, so
    // they get an explicit exclusion rather than an incidental one.
    /died, message:/,
];

/** What a log level means to a reader. Anything else is not an entry in its own right. */
const LEVELS: Record<string, LogType> = { WARN: 'warn', ERROR: 'error', FATAL: 'error' };

const gunzipAsync = promisify(gunzip);

/* --- Internal shapes ----------------------------------------------------- */

/** A calendar date, as the log filenames and `mtime` give it to us. */
interface DateParts {
    year: number;
    month: number;
    day: number;
}

/** A log file to read: rotated files know their date up front, `latest.log` doesn't. */
interface LogFile {
    name: string;
    date: DateParts | null;
}

/** One parsed line, before it has a real date attached. */
interface Line {
    /** Seconds since midnight — log lines carry a clock but no date. */
    clock: number;
    level: string;
    thread: string;
    message: string;
}

/** One parsed line with its instant worked out. */
interface DatedLine extends Omit<Line, 'clock'> {
    timestamp: number;
}

/** A classified line, before it has been given an id. */
type Classified = Omit<LogEntry, 'id'>;

/* --- Reading -------------------------------------------------------------- */

const isMissing = (error: unknown): boolean => (error as NodeJS.ErrnoException)?.code === 'ENOENT';

/** The date an instant falls on in UTC, which is what names a log's day. */
const partsOf = (date: Date): DateParts => ({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
});

/**
 * Builds a timestamp from a date, a whole-day offset and a clock reading.
 *
 * The clock is read as UTC because that is what the server writes. Reading
 * it in the process's zone instead would only be right on a host that also runs
 * UTC, and would put every entry hours out anywhere else.
 */
const at = ({ year, month, day }: DateParts, offsetDays: number, clock: number): number =>
    Date.UTC(year, month - 1, day + offsetDays, 0, 0, clock);

/**
 * Everything done to a raw message before anything else sees it: addresses
 * masked, colour codes dropped. Applied to every line parsed, so no reader has
 * to remember to do either.
 */
const clean = (text: string): string =>
    ADDRESSES.reduce((masked, [pattern, replacement]) => masked.replace(pattern, replacement), text).replace(FORMATTING, '');

/** Reads the last `TAIL_BYTES` of a file, along with its mtime. */
const readTail = async (path: string): Promise<{ text: string; modified: Date } | null> => {
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
        handle = await open(path, 'r');
        const { size, mtime } = await handle.stat();
        const start = Math.max(0, size - TAIL_BYTES);
        const buffer = Buffer.alloc(size - start);
        await handle.read(buffer, 0, buffer.length, start);

        const text = buffer.toString('utf8');
        // Starting mid-file almost certainly lands inside a line; drop the partial one.
        return { text: start > 0 ? text.slice(text.indexOf('\n') + 1) : text, modified: mtime };
    } catch (error) {
        if (!isMissing(error)) console.log(`[Error] Reading ${path}: ${String(error)}`);
        return null;
    } finally {
        await handle?.close();
    }
};

/** Reads a rotated log. These are gzipped, so unlike `latest.log` they can't be tailed. */
const readRotated = async (path: string): Promise<string | null> => {
    try {
        return (await gunzipAsync(await readFile(path))).toString('utf8');
    } catch (error) {
        if (!isMissing(error)) console.log(`[Error] Reading ${path}: ${String(error)}`);
        return null;
    }
};

/** Lists the logs worth reading, newest first: `latest.log`, then rotated files by date and restart counter. */
const listLogs = async (dir: string): Promise<LogFile[]> => {
    let names: string[];
    try {
        names = await readdir(dir);
    } catch (error) {
        console.log(`[Error] Reading log directory ${dir}: ${String(error)}`);
        return [];
    }

    const rotated = names
        .flatMap((name) => {
            const match = ROTATED.exec(name);
            if (!match) return [];
            const [, year, month, day, index] = match;
            return [
                {
                    name,
                    date: { year: Number(year), month: Number(month), day: Number(day) },
                    key: `${year}-${month}-${day}`,
                    index: Number(index),
                },
            ];
        })
        // Newest first. The counter needs a numeric compare — `-10` sorts before `-2` as text.
        .sort((a, b) => b.key.localeCompare(a.key) || b.index - a.index)
        .slice(0, MAX_ROTATED);

    return [...(names.includes(LATEST) ? [{ name: LATEST, date: null }] : []), ...rotated];
};

/* --- Parsing -------------------------------------------------------------- */

/**
 * Splits a log into one entry per line.
 *
 * What doesn't parse belongs to the line above it, and is nearly always a stack
 * trace. Only its first line is kept — `java.lang.NullPointerException: …`, the
 * bit that says what went wrong — because the frames below it are pages long and
 * say where, which is not what either view reading this is for.
 */
const parseLines = (text: string): Line[] => {
    const lines: Line[] = [];
    /** Whether the line being built has already taken its one extra line. */
    let folded = false;

    for (const raw of text.split('\n')) {
        const match = LINE.exec(raw);

        if (!match) {
            const previous = lines.at(-1);
            if (!previous || raw.trim() === '') continue;

            if (!folded && !FRAME.test(raw)) previous.message += `\n${clean(raw)}`;

            folded = true;
            continue;
        }

        const [, hours, minutes, seconds, source, mod, message] = match;
        // `Server thread/INFO` — the level is the last segment, the rest names the writer.
        const split = source.lastIndexOf('/');

        lines.push({
            clock: Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds),
            level: split === -1 ? UNKNOWN_LEVEL : source.slice(split + 1),
            thread: [split === -1 ? source : source.slice(0, split), mod].filter(Boolean).join(' '),
            message: clean(message),
        });
        folded = false;
    }

    return lines;
};

/**
 * Dates every line in a file. Logs record a clock but no date, so we count
 * midnight rollovers — the clock jumping backwards — to get each line's day
 * offset from the first, then anchor that range to a date we do know: the
 * filename for a rotated log, or the mtime (which is when the *last* line was
 * written) for `latest.log`.
 */
const dateLines = (lines: Line[], anchor: DateParts, anchoredTo: 'first' | 'last'): DatedLine[] => {
    let day = 0;
    const offsets = lines.map((line, index) => {
        if (index > 0 && line.clock < lines[index - 1].clock) day += 1;
        return day;
    });

    const build = (shift: number): DatedLine[] =>
        lines.map(({ clock, ...line }, index) => ({ ...line, timestamp: at(anchor, offsets[index] + shift, clock) }));

    if (anchoredTo === 'first') return build(0);

    // The mtime anchor assumes it marks the last line's write. That holds for a
    // live log, but a copied one carries the copy's mtime, which can land on the
    // following day. Timestamps in the future give it away, and mean a day out.
    const dated = build(-day);
    const last = dated.at(-1);
    return last && last.timestamp > Date.now() ? build(-day - 1) : dated;
};

/** Reads, parses and dates one log file. */
const readLogFile = async (dir: string, file: LogFile): Promise<DatedLine[]> => {
    const path = join(dir, file.name);

    if (file.date) {
        const text = await readRotated(path);
        return text ? dateLines(parseLines(text), file.date, 'first') : [];
    }

    const tail = await readTail(path);
    return tail ? dateLines(parseLines(tail.text), partsOf(tail.modified), 'last') : [];
};

/* --- Classifying ---------------------------------------------------------- */

/**
 * Flattens a warning or error into one line and trims it. Parsing has already
 * dropped the stack frames, leaving at most the line naming the exception, which
 * is worth keeping alongside the message that preceded it.
 */
const simplify = (message: string): string => {
    const flat = message
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .join(' — ');

    return flat.length > MAX_TEXT ? `${flat.slice(0, MAX_TEXT - 1)}…` : flat;
};

/** Matches the lines we can identify by shape alone, before the roster is known. */
const matchKnown = (message: string): Pick<LogEntry, 'type' | 'player' | 'text'> | null => {
    for (const { pattern, type } of MATCHERS) {
        const match = pattern.exec(message);
        if (match) return { type, player: match[1], text: match[2] };
    }

    return null;
};

/** Classifies one file's lines, dropping everything unrecognised or unwanted. */
const classify = (lines: DatedLine[], roster: readonly string[], wanted: ReadonlySet<LogType>): Classified[] => {
    const matched = lines.map((line) => ({
        timestamp: line.timestamp,
        message: line.message,
        known: line.level === 'INFO' ? matchKnown(line.message) : null,
        // A level we can't read is not evidence of anything; only say so when we know.
        raised: LEVELS[line.level],
    }));

    // Anyone who joined, left, spoke or earned something announced their own
    // name, so the log identifies its own players even with no roster file.
    const names = new Set(roster);
    for (const { known } of matched) if (known?.player && NAMED.has(known.type)) names.add(known.player);

    /** Whether a `[Name] message` line is really a broadcast and not a mod's log prefix. */
    const broadcast = (player = ''): boolean => player === CONSOLE_NAME || names.has(player);

    return matched.flatMap(({ timestamp, message, known, raised }) => {
        if (raised) return wanted.has(raised) ? [{ timestamp, type: raised, text: simplify(message) }] : [];

        if (known) {
            if (known.type === 'server' && !broadcast(known.player)) return [];
            return wanted.has(known.type) ? [{ timestamp, ...known }] : [];
        }

        if (!wanted.has('death')) return [];

        const prefixed = PREFIXED.exec(message);
        if (!prefixed || !names.has(prefixed[1]) || NOT_DEATHS.some((pattern) => pattern.test(prefixed[2]))) return [];

        return [{ timestamp, type: 'death' as const, player: prefixed[1], text: prefixed[2] }];
    });
};

/* --- Reading the whole thing ---------------------------------------------- */

/**
 * Reads entries of the wanted types, most recent first. With no `limit` every log
 * file on disk is read; with one, files are opened only until it is met.
 *
 * Timestamps are absolute instants, read from the log's UTC clock. Which zone to
 * *display* them in is the caller's business.
 */
const read = async (wanted: ReadonlySet<LogType>, limit?: number): Promise<{ entries: LogEntry[]; files: string[] } | null> => {
    const dir = logsDir;
    if (!dir) return null;

    const roster = statsDir ? (await readRoster(statsDir)).map((player) => player.name) : [];

    // Oldest-first while collecting: each file we open is older than the last.
    // Rebuilt rather than `unshift`-spread, which would blow the argument limit
    // on a log that happens to yield a very large number of entries.
    let entries: Classified[] = [];
    const files: string[] = [];

    for (const file of await listLogs(dir)) {
        files.push(file.name);
        entries = [...classify(await readLogFile(dir, file), roster, wanted), ...entries];
        if (limit !== undefined && entries.length >= limit) break;
    }

    const newest = limit === undefined ? entries : entries.slice(-limit);

    return { entries: newest.reverse().map((entry, index) => ({ ...entry, id: `${entry.timestamp}-${index}` })), files };
};

/**
 * The public view: the newest deaths and advancements. Returns `null` when
 * `MC_LOGS_DIR` is unset, so the page can explain itself rather than render an
 * empty shell.
 */
export const readPublicLog = async (limit = PUBLIC_LIMIT): Promise<LogEntry[] | null> => (await read(PUBLIC, limit))?.entries ?? null;

/**
 * The admin view: every type, back through every log file kept on disk. Reading
 * the lot is what lets the page count each type and date each player's last
 * login; there are only a few hundred entries behind a few thousand lines.
 */
export const readFullLog = async () => read(ALL);
