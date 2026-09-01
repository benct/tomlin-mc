import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Shared readers for the Minecraft server's on-disk data files.
 *
 * Both the stats page and the event log start from the same place: the roster
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
