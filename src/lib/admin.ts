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
 * Server-only: everything here reads from disk, so it must only be imported from
 * server components or route handlers.
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

/** One rostered player, and when the logs last saw them arrive. */
export interface AdminPlayer {
    name: string;
    uuid: string;
    /** The most recent join in the logs, or `null` if they last played before the oldest one. */
    lastLogin: number | null;
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
    /** Everyone in the roster, most recently seen first. */
    players: AdminPlayer[];
}

/**
 * When each player last arrived. Entries come newest first, so the first join
 * seen for a name is their latest and the rest can be skipped.
 */
const lastLogins = (entries: readonly LogEntry[]): Map<string, number> => {
    const logins = new Map<string, number>();

    for (const entry of entries) {
        if (entry.type === 'join' && entry.player && !logins.has(entry.player)) {
            logins.set(entry.player, entry.timestamp);
        }
    }

    return logins;
};

/**
 * The roster decides who is listed; the logs only date them. A name the logs saw
 * but `usercache.json` no longer holds is left out — it has expired from the
 * cache or been renamed, and there is nothing to show about it beyond the name.
 *
 * The cache can't supply the date itself: its `expiresOn` is stamped when a
 * profile is first cached and isn't refreshed on later logins, so it dates a
 * player's first visit rather than their most recent.
 */
const buildPlayers = async (logins: Map<string, number>): Promise<AdminPlayer[]> => {
    const roster = statsDir ? await readRoster(statsDir) : [];

    return roster
        .map(({ uuid, name }) => ({ name, uuid, lastLogin: logins.get(name) ?? null }))
        .sort((a, b) => (b.lastLogin ?? 0) - (a.lastLogin ?? 0));
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
    const players = await buildPlayers(lastLogins(read?.entries ?? []));

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
