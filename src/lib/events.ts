import { open, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { gunzip } from 'node:zlib';
import { logsDir, statsDir } from '@/lib/env';
import { readRoster } from '@/lib/serverData';
import type { ServerEvent, ServerEventType } from '@/lib/types';

/**
 * Turns the Minecraft server's own log files into the event feed on the stats page.
 *
 * Nothing extra runs server-side: vanilla already writes every event we show —
 * joins, leaves, deaths and advancements — to `logs/latest.log`, so this reads
 * the stock files rather than depending on a mod or a scheduled exporter.
 *
 * Matching is an allowlist, which is what keeps errors, mod chatter and startup
 * noise out for free: an unrecognised line is simply dropped. Player chat and
 * `issued server command` lines are deliberately never matched — this feed is
 * public, and those leak conversations and coordinates. Neither are server
 * broadcasts, bans, kicks, or start/stop: this is a record of what players did.
 *
 * Server-only: this module touches the filesystem, so it must only be imported
 * from server components or route handlers.
 */

/** How many events the feed shows by default. */
const DEFAULT_LIMIT = 30;

/**
 * How much of `latest.log` to read. The log is append-only and we only ever
 * want its tail, so reading the last chunk beats parsing a file that grows
 * unbounded between restarts. 256 KB is a few thousand lines — far more than
 * `DEFAULT_LIMIT` events on any normal day.
 */
const TAIL_BYTES = 256 * 1024;

/**
 * Rotated logs are only opened while the feed is still short of `limit`, and
 * never more than this many. The ceiling is generous because most rotated files
 * hold no player events at all — the server restarts and idles far more often
 * than people play, so a handful of files rarely fills the feed. Reading this
 * many is still cheap: they are a few KB gzipped each.
 */
const MAX_ROTATED = 16;

const LATEST = 'latest.log';

/** Rotated logs are named for the day they cover, plus a counter for restarts within it. */
const ROTATED = /^(\d{4})-(\d{2})-(\d{2})-(\d+)\.log\.gz$/;

/**
 * A log line: `[22:14:03] [Server thread/INFO]: Ben joined the game`. Fabric
 * mods add a ` (ModName)` source before the colon, which the allowlist below
 * filters out anyway, so it is captured loosely and ignored.
 */
const LINE = /^\[(\d{2}):(\d{2}):(\d{2})\] \[([^\]]+)\](?: \([^)]*\))?: (.*)$/;

/** Minecraft usernames — the character class the server itself enforces. */
const NAME = '[A-Za-z0-9_]{3,16}';

/** The lines we can identify outright, by exact shape. Order doesn't matter; they're mutually exclusive. */
const MATCHERS: { pattern: RegExp; type: ServerEventType }[] = [
    { pattern: new RegExp(`^(${NAME}) (joined the game)$`), type: 'join' },
    { pattern: new RegExp(`^(${NAME}) (left the game)$`), type: 'leave' },
    { pattern: new RegExp(`^(${NAME}) (has made the advancement \\[.+\\])$`), type: 'advancement' },
    { pattern: new RegExp(`^(${NAME}) (has completed the challenge \\[.+\\])$`), type: 'advancement' },
    { pattern: new RegExp(`^(${NAME}) (has reached the goal \\[.+\\])$`), type: 'advancement' },
];

/**
 * Any line beginning with a player's name, which is all a death message has in
 * common. Connection lines optionally carry the player's address between the
 * name and the message (`Steve (/1.2.3.4:5555) lost connection: …`); it is
 * discarded here so the exclusions below see a uniform message either way.
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

const gunzipAsync = promisify(gunzip);

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

/** One parsed log line, before it has a real date attached. */
interface Line {
    /** Seconds since midnight — log lines carry a clock but no date. */
    clock: number;
    message: string;
}

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
 * UTC, and would put every event hours out anywhere else.
 */
const at = ({ year, month, day }: DateParts, offsetDays: number, clock: number): number =>
    Date.UTC(year, month - 1, day + offsetDays, 0, 0, clock);

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

/** Keeps the INFO lines and splits each into a clock reading and its message. */
const parseLines = (text: string): Line[] =>
    text.split('\n').flatMap((raw) => {
        const match = LINE.exec(raw);
        if (!match) return [];

        const [, hours, minutes, seconds, thread, message] = match;
        // WARN and ERROR lines are the noise this feed exists to avoid.
        if (!thread.endsWith('/INFO')) return [];

        return [{ clock: Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds), message }];
    });

/**
 * Dates every line in a file. Logs record a clock but no date, so we count
 * midnight rollovers — the clock jumping backwards — to get each line's day
 * offset from the first, then anchor that range to a date we do know: the
 * filename for a rotated log, or the mtime (which is when the *last* line was
 * written) for `latest.log`.
 */
const dateLines = (lines: Line[], anchor: DateParts, anchoredTo: 'first' | 'last'): { timestamp: number; message: string }[] => {
    let day = 0;
    const offsets = lines.map((line, index) => {
        if (index > 0 && line.clock < lines[index - 1].clock) day += 1;
        return day;
    });

    const build = (shift: number) =>
        lines.map((line, index) => ({ timestamp: at(anchor, offsets[index] + shift, line.clock), message: line.message }));

    if (anchoredTo === 'first') return build(0);

    // The mtime anchor assumes it marks the last line's write. That holds for a
    // live log, but a copied one carries the copy's mtime, which can land on the
    // following day. Timestamps in the future give it away, and mean a day out.
    const dated = build(-day);
    const last = dated.at(-1);
    return last && last.timestamp > Date.now() ? build(-day - 1) : dated;
};

/** Matches the lines we can identify by shape alone, before the roster is known. */
const matchKnown = (message: string): { type: ServerEventType; player: string; text: string } | null => {
    for (const { pattern, type } of MATCHERS) {
        const match = pattern.exec(message);
        if (match) return { type, player: match[1], text: match[2] };
    }

    return null;
};

/** Turns one file's dated lines into events, dropping everything unrecognised. */
const toEvents = (lines: { timestamp: number; message: string }[], roster: readonly string[]): Omit<ServerEvent, 'id'>[] => {
    const matched = lines.map((line) => ({ ...line, event: matchKnown(line.message) }));

    // Anyone who joined, left or earned something announced their own name, so
    // the log identifies its own players even when the roster file is missing.
    const names = new Set(roster);
    for (const { event } of matched) if (event) names.add(event.player);

    return matched.flatMap(({ timestamp, message, event }) => {
        if (event) return [{ timestamp, ...event }];

        const prefixed = PREFIXED.exec(message);
        if (!prefixed || !names.has(prefixed[1]) || NOT_DEATHS.some((pattern) => pattern.test(prefixed[2]))) return [];

        return [{ timestamp, type: 'death' as const, player: prefixed[1], text: prefixed[2] }];
    });
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

/** Reads and dates one log file. */
const readLog = async (dir: string, file: LogFile): Promise<{ timestamp: number; message: string }[]> => {
    const path = join(dir, file.name);

    if (file.date) {
        const text = await readRotated(path);
        return text ? dateLines(parseLines(text), file.date, 'first') : [];
    }

    const tail = await readTail(path);
    return tail ? dateLines(parseLines(tail.text), partsOf(tail.modified), 'last') : [];
};

/**
 * Reads the newest server events, most recent first. Returns `null` when
 * `MC_LOGS_DIR` is unset, so the page can explain itself rather than render an
 * empty shell.
 *
 * Timestamps are absolute instants, read from the log's UTC clock. Which zone to
 * *display* them in is the caller's business.
 */
export const loadEvents = async (limit = DEFAULT_LIMIT): Promise<ServerEvent[] | null> => {
    const dir = logsDir;
    if (!dir) return null;

    const roster = statsDir ? (await readRoster(statsDir)).map((player) => player.name) : [];

    // Oldest-first while collecting: each file we open is older than the last.
    // Rebuilt rather than `unshift`-spread, which would blow the argument limit
    // on a log that happens to yield a very large number of events.
    let events: Omit<ServerEvent, 'id'>[] = [];
    for (const file of await listLogs(dir)) {
        events = [...toEvents(await readLog(dir, file), roster), ...events];
        if (events.length >= limit) break;
    }

    return events
        .slice(-limit)
        .reverse()
        .map((event, index) => ({ ...event, id: `${event.timestamp}-${index}` }));
};
