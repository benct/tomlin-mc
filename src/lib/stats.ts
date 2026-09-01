import { join } from 'node:path';
import { statsDir } from '@/lib/env';
import { readJson, readRoster } from '@/lib/serverData';
import type { Leaderboard, LeaderboardGroup, PlayerStats, ServerStats, StatUnit } from '@/lib/types';

/**
 * Reads the Minecraft server's on-disk player data and turns it into the
 * leaderboards the stats page renders.
 *
 * The server writes one JSON file per player per data type, named by UUID. The
 * roster from `@/lib/serverData` drives which files we read.
 *
 * Server-only: this module touches the filesystem, so it must only be imported
 * from server components or route handlers.
 */

/** How many players each leaderboard lists. */
const TOP_N = 5;

/** Advancements under this prefix are recipe unlocks, granted automatically rather than earned. */
const RECIPE_PREFIX = 'minecraft:recipes/';

const NAMESPACE = /^minecraft:/;

/** A `stats/<uuid>.json` file: category -> stat key -> count. */
interface RawStatsFile {
    stats?: Record<string, Record<string, number>>;
}

/** A `advancements/<uuid>.json` file: advancement id -> progress, plus a stray `DataVersion` number. */
type RawAdvancementsFile = Record<string, { done?: boolean } | number>;

const sum = (values: Record<string, number>): number => Object.values(values).reduce((total, value) => total + value, 0);

/** Strips the `minecraft:` namespace so lookups read as `custom.jump` rather than `custom['minecraft:jump']`. */
const unprefix = (key: string): string => key.replace(NAMESPACE, '');

/** Flattens one player's two files into the numbers the leaderboards rank. */
const buildPlayer = (uuid: string, name: string, stats: RawStatsFile, advancements: RawAdvancementsFile | null): PlayerStats => {
    const categories = stats.stats ?? {};

    const custom: Record<string, number> = {};
    for (const [key, value] of Object.entries(categories['minecraft:custom'] ?? {})) {
        custom[unprefix(key)] = value;
    }

    const totals: Record<string, number> = {};
    for (const [category, entries] of Object.entries(categories)) {
        if (category !== 'minecraft:custom') totals[unprefix(category)] = sum(entries);
    }

    let earned = 0;
    let recipes = 0;
    for (const [id, progress] of Object.entries(advancements ?? {})) {
        // `DataVersion` sits alongside the advancements as a bare number.
        if (typeof progress !== 'object' || !progress?.done) continue;
        if (id.startsWith(RECIPE_PREFIX)) recipes += 1;
        else earned += 1;
    }

    return { uuid, name, custom, totals, advancements: earned, recipes };
};

/** A rankable stat: where to find it on a player, and how to render it. */
interface Metric {
    id: string;
    label: string;
    unit: StatUnit;
    of: (player: PlayerStats) => number;
}

const customMetric = (id: string, label: string, key: string, unit: StatUnit = 'count'): Metric => ({
    id,
    label,
    unit,
    of: (player) => player.custom[key] ?? 0,
});

const totalMetric = (id: string, label: string, category: string): Metric => ({
    id,
    label,
    unit: 'count',
    of: (player) => player.totals[category] ?? 0,
});

/** Adds several `minecraft:custom` counters together into one rankable number. */
const combinedMetric = (id: string, label: string, keys: string[], unit: StatUnit = 'count'): Metric => ({
    id,
    label,
    unit,
    of: (player) => keys.reduce((total, key) => total + (player.custom[key] ?? 0), 0),
});

/** The stats worth a top list, grouped the way the page lays them out. */
const leaderboards: { title: string; metrics: Metric[] }[] = [
    {
        title: 'General',
        metrics: [
            customMetric('played', 'Time played', 'play_time', 'duration'),
            customMetric('jumps', 'Jumps', 'jump'),
            { id: 'advancements', label: 'Advancements earned', unit: 'count', of: (player) => player.advancements },
            { id: 'recipes', label: 'Recipes unlocked', unit: 'count', of: (player) => player.recipes },
        ],
    },
    {
        title: 'Combat',
        metrics: [
            customMetric('mob-kills', 'Mobs killed', 'mob_kills'),
            customMetric('player-kills', 'Players killed', 'player_kills'),
            customMetric('damage-dealt', 'Damage dealt', 'damage_dealt', 'health'),
            customMetric('damage-taken', 'Damage taken', 'damage_taken', 'health'),
            customMetric('damage-blocked', 'Damage blocked by shield', 'damage_blocked_by_shield', 'health'),
            customMetric('deaths', 'Deaths', 'deaths'),
            customMetric('survival-streak', 'Time since last death', 'time_since_death', 'duration'),
        ],
    },
    {
        title: 'Blocks/Items',
        metrics: [
            totalMetric('mined', 'Blocks mined', 'mined'),
            totalMetric('crafted', 'Items crafted', 'crafted'),
            totalMetric('picked-up', 'Items picked up', 'picked_up'),
            totalMetric('broken', 'Tools broken', 'broken'),
        ],
    },
    {
        title: 'Travel',
        metrics: [
            customMetric('walked', 'Distance walked', 'walk_one_cm', 'distance'),
            customMetric('sprinted', 'Distance sprinted', 'sprint_one_cm', 'distance'),
            customMetric('crouched', 'Distance crouched', 'crouch_one_cm', 'distance'),
            combinedMetric('in-water', 'Distance in water', ['swim_one_cm', 'walk_on_water_one_cm', 'walk_under_water_one_cm'], 'distance'),
            customMetric('climbed', 'Distance climbed', 'climb_one_cm', 'distance'),
            customMetric('fallen', 'Distance fallen', 'fall_one_cm', 'distance'),
            customMetric('flown', 'Distance flown', 'fly_one_cm', 'distance'),
            customMetric('boated', 'Distance by boat', 'boat_one_cm', 'distance'),
        ],
    },
];

/**
 * Ranks players by one metric. Returns `null` when nobody has scored — an
 * all-zero board (a peaceful server's `player_kills`) is noise, not a ranking.
 */
const buildBoard = (metric: Metric, players: PlayerStats[]): Leaderboard | null => {
    const scored = players
        .map((player) => ({ uuid: player.uuid, name: player.name, value: metric.of(player) }))
        .filter((entry) => entry.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, TOP_N);

    if (scored.length === 0) return null;

    const leader = scored[0].value;
    return {
        id: metric.id,
        label: metric.label,
        unit: metric.unit,
        entries: scored.map((entry) => ({ ...entry, share: entry.value / leader })),
    };
};

/**
 * Reads every tracked player's stats and advancements and assembles the page's
 * snapshot. Returns `null` when `MC_STATS_DIR` is unset, so the page can explain
 * itself rather than render an empty shell.
 */
export const loadStats = async (): Promise<ServerStats | null> => {
    const dir = statsDir;
    if (!dir) return null;

    const roster = await readRoster(dir);

    const loaded = await Promise.all(
        roster.map(async ({ uuid, name }) => {
            const [stats, advancements] = await Promise.all([
                readJson<RawStatsFile>(join(dir, 'stats', `${uuid}.json`)),
                readJson<RawAdvancementsFile>(join(dir, 'advancements', `${uuid}.json`)),
            ]);

            // No stats file means the player is on the roster but has never played.
            return stats ? buildPlayer(uuid, name, stats, advancements) : { name };
        }),
    );

    const players = loaded.filter((entry): entry is PlayerStats => 'uuid' in entry);
    const untracked = loaded.filter((entry) => !('uuid' in entry)).map((entry) => entry.name);

    const groups: LeaderboardGroup[] = leaderboards
        .map(({ title, metrics }) => ({
            title,
            boards: metrics.map((metric) => buildBoard(metric, players)).filter((board): board is Leaderboard => board !== null),
        }))
        .filter((group) => group.boards.length > 0);

    const total = (pick: (player: PlayerStats) => number): number => players.reduce((running, player) => running + pick(player), 0);

    return {
        players: [...players].sort((a, b) => (b.custom.play_time ?? 0) - (a.custom.play_time ?? 0)),
        groups,
        totals: {
            playTime: total((player) => player.custom.play_time ?? 0),
            advancements: total((player) => player.advancements),
            mined: total((player) => player.totals.mined ?? 0),
            mobKills: total((player) => player.custom.mob_kills ?? 0),
            deaths: total((player) => player.custom.deaths ?? 0),
        },
        untracked,
    };
};
