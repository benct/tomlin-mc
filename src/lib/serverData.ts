import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Shared readers for the Minecraft server's on-disk data files.
 *
 * Both the stats leaderboards and the log start from the same place: the roster
 * in `usercache.json`, which is the only file mapping UUIDs back to usernames.
 *
 * Server-only: this module touches the filesystem, so it must only be imported
 * from server components or route handlers.
 */

/** UUIDs come from a local file, but they become path segments — only accept the canonical form. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A raw entry in the server's user cache — everything is untrusted until validated. */
interface RawRosterEntry {
    uuid?: string;
    name?: string;
}

/** A roster entry that passed validation: a canonical lowercase UUID and a name. */
export interface RosterPlayer {
    uuid: string;
    name: string;
}

/** A `stats/<uuid>.json` file: category -> stat key -> count. */
export interface RawStatsFile {
    stats?: Record<string, Record<string, number>>;
}

/** One advancement's progress: when each criterion was met, and whether that finished it. */
export interface RawAdvancement {
    criteria?: Record<string, string>;
    done?: boolean;
}

/** An `advancements/<uuid>.json` file: advancement id -> progress, plus a stray `DataVersion` number. */
export type RawAdvancementsFile = Record<string, RawAdvancement | number>;

const isMissing = (error: unknown): boolean => (error as NodeJS.ErrnoException)?.code === 'ENOENT';

/**
 * Reads and parses a JSON file, returning `null` when it isn't there. A player
 * who has never joined has no stats file, which is expected rather than an error.
 */
export const readJson = async <T>(file: string): Promise<T | null> => {
    try {
        return JSON.parse(await readFile(file, 'utf8')) as T;
    } catch (error) {
        if (!isMissing(error)) console.log(`[Error] Reading ${file}: ${String(error)}`);
        return null;
    }
};

/** Reads one player's `stats/<uuid>.json`. Absent until the player has actually played. */
export const readPlayerStats = (dir: string, uuid: string): Promise<RawStatsFile | null> =>
    readJson<RawStatsFile>(join(dir, 'stats', `${uuid}.json`));

/** Reads one player's `advancements/<uuid>.json`. Only holds what they have made progress on. */
export const readPlayerAdvancements = (dir: string, uuid: string): Promise<RawAdvancementsFile | null> =>
    readJson<RawAdvancementsFile>(join(dir, 'advancements', `${uuid}.json`));

/** Reads the roster from the server's stock `usercache.json`. */
export const readRoster = async (dir: string): Promise<RosterPlayer[]> => {
    const roster = await readJson<RawRosterEntry[]>(join(dir, 'usercache.json'));

    if (!Array.isArray(roster)) {
        if (roster !== null) console.log(`[Error] Roster in ${dir} is not an array`);
        return [];
    }

    // The cache is written most-recently-seen first and can hold stale duplicates
    // after a name change, so the first entry for a UUID is the current one.
    const seen = new Set<string>();
    return roster.flatMap((entry) => {
        const uuid = entry?.uuid?.toLowerCase();
        if (!uuid || !entry.name || !UUID_PATTERN.test(uuid) || seen.has(uuid)) return [];
        seen.add(uuid);
        return [{ uuid, name: entry.name }];
    });
};
