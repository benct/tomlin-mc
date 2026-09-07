import { statsDir } from '@/lib/env';
import { readFullLog } from '@/lib/logs';
import { readRoster } from '@/lib/serverData';
import { LOG_FILTERS, type LogEntry, type LogType } from '@/lib/types';

/**
 * The on-disk half of the admin page: the full log, and who has logged in when.
 *
 * The public page is handed two log types; this one takes every one, which is
 * why it is only ever rendered behind the password gate in `src/proxy.ts`. Live
 * status isn't here — the page reuses `/api/status` like every other page.
 *
 * Sensitive by construction, with one exception it doesn't get to make: IP
 * addresses are masked in `@/lib/logs`, before this module ever sees a line.
 *
 * Server-only: this module touches the filesystem, so it must only be imported
 * from server components or route handlers.
 */

/** How many entries the page renders. The rest are still read — counted, not shown. */
const SHOWN = 200;

/**
 * The filters applied when the page is opened without any. Warnings and errors
 * are left out: on a healthy server they outnumber everything a person did by an
 * order of magnitude, and drown the rest. One click brings them back.
 */
const QUIET: ReadonlySet<string> = new Set(['warn', 'error']);

const DEFAULT_FILTERS = LOG_FILTERS.filter((filter) => !QUIET.has(filter.key)).map((filter) => filter.key);

/** The types each filter key covers. An unknown key covers none, so it matches nothing. */
const TYPES_BY_KEY = new Map(LOG_FILTERS.map((filter) => [filter.key, filter.types]));

/** What the logs say about one player, whether or not they're on the roster. */
export interface AdminPlayer {
    name: string;
    /** From the roster; `null` for a player seen in the logs but no longer cached. */
    uuid: string | null;
    /** The most recent join in the logs, or `null` if they last played before the oldest one. */
    lastLogin: number | null;
    /** Joins counted across those same logs. */
    logins: number;
}

export interface AdminLog {
    /** The newest entries matching the filter, most recent first. */
    entries: LogEntry[];
    /** How many entries match the filter, across every file. */
    matched: number;
    /** How many entries were found in total, filter or no filter. */
    total: number;
    /** How many entries each filter accounts for, counted before filtering. Keyed by filter key. */
    counts: Record<string, number>;
    /** The filter keys being shown, resolved — never empty unless the request asked for nonsense. */
    filters: string[];
    /** The log files read, newest first. */
    files: string[];
}

export interface AdminSnapshot {
    /** `null` when `MC_LOGS_DIR` is unset. */
    log: AdminLog | null;
    /** Everyone the roster or the logs know about, most recently active first. */
    players: AdminPlayer[];
}

/** A player's login history, as far back as the logs go. */
interface Logins {
    last: number;
    count: number;
}

/**
 * Counts logins per player. Entries arrive newest first, so the first login seen
 * for a name is the latest.
 */
const tallyLogins = (entries: readonly LogEntry[]): Map<string, Logins> => {
    const logins = new Map<string, Logins>();

    for (const entry of entries) {
        if (entry.type !== 'join' || !entry.player) continue;

        const seen = logins.get(entry.player);
        if (seen) seen.count += 1;
        else logins.set(entry.player, { last: entry.timestamp, count: 1 });
    }

    return logins;
};

/**
 * Merges the roster with what the logs saw, so a player missing from either
 * still appears. `usercache.json` says who exists; only the logs say when they
 * were last here — its `expiresOn` is stamped when a profile is first cached and
 * isn't refreshed on later logins, so it dates a player's first visit, not their
 * most recent one.
 */
const buildPlayers = async (logins: Map<string, Logins>): Promise<AdminPlayer[]> => {
    const roster = statsDir ? await readRoster(statsDir) : [];

    const known = roster.map(({ uuid, name }) => ({
        name,
        uuid,
        lastLogin: logins.get(name)?.last ?? null,
        logins: logins.get(name)?.count ?? 0,
    }));

    // A name the logs saw but the roster no longer caches: renamed, or expired out.
    const rostered = new Set(roster.map((player) => player.name));
    const extra = [...logins]
        .filter(([name]) => !rostered.has(name))
        .map(([name, seen]) => ({ name, uuid: null, lastLogin: seen.last, logins: seen.count }));

    return [...known, ...extra].sort((a, b) => (b.lastLogin ?? 0) - (a.lastLogin ?? 0));
};

/**
 * Reads the admin picture: the log, and who has been playing.
 *
 * Every entry is read whatever the filter says, which is the point of filtering
 * here rather than in the browser: asking for `error` gets the newest errors in
 * the whole history, not however few sit among the last couple of hundred
 * entries. `keys` narrows what is rendered; empty falls back to
 * `DEFAULT_FILTERS`.
 */
export const loadAdminSnapshot = async (keys: string[] = []): Promise<AdminSnapshot> => {
    const read = await readFullLog();
    const players = await buildPlayers(tallyLogins(read?.entries ?? []));

    if (!read) return { log: null, players };

    // Counted per filter rather than per type, since that's what the chips show:
    // a connection chip covers both halves of one.
    const perType: Partial<Record<LogType, number>> = {};
    for (const entry of read.entries) perType[entry.type] = (perType[entry.type] ?? 0) + 1;

    const counts = Object.fromEntries(
        LOG_FILTERS.map((filter) => [filter.key, filter.types.reduce((total, type) => total + (perType[type] ?? 0), 0)]),
    );

    const shown = keys.length === 0 ? DEFAULT_FILTERS : keys;
    const wanted = new Set(shown.flatMap((key) => TYPES_BY_KEY.get(key) ?? []));
    const matching = read.entries.filter((entry) => wanted.has(entry.type));

    return {
        log: {
            entries: matching.slice(0, SHOWN),
            matched: matching.length,
            total: read.entries.length,
            counts,
            filters: shown,
            files: read.files,
        },
        players,
    };
};
