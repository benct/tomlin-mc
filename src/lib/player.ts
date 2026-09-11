import { measureAdvancements } from '@/lib/advancements';
import { statsDir } from '@/lib/env';
import { type RosterPlayer, readPlayerAdvancements, readPlayerStats, readRoster } from '@/lib/serverData';
import type { AdvancementProgress, Breakdown, BreakdownEntry, StatSection, StatUnit } from '@/lib/types';

/**
 * Assembles what one player's page at /stats/<name> shows.
 *
 * Minecraft writes two files per player and both are flat maps of counters:
 * `minecraft:custom` holds the one-off tallies (jumps, deaths, centimetres
 * walked), and every other category counts one thing per block, item or mob.
 * This module gives the first group labels and units, turns the rest into
 * ranked breakdowns, and hands the advancements to `@/lib/advancements`.
 *
 * Server-only: this module reads the filesystem, so it must only be imported
 * from server components or route handlers.
 */

export interface PlayerPage {
    uuid: string;
    name: string;
    totals: {
        advancements: number;
        mined: number;
        diamonds: number;
        mobKills: number;
        deaths: number;
        distance: number;
        survivalStreak: number | null;
    };
    favourite: BreakdownEntry | null;
    nemesis: BreakdownEntry | null;
    sections: StatSection[];
    breakdowns: Breakdown[];
    advancements: AdvancementProgress;
}

const NAMESPACE = /^minecraft:/;

/** Every travel counter is stored in centimetres and named for it. */
const DISTANCE_SUFFIX = '_one_cm';

/**
 * Counters this page never shows. Play time is the leaderboards' business, and
 * they only ever call it a verdict; `total_world_time` is the same number in
 * different clothes, since the server ticks the two together.
 */
const WITHHELD = new Set(['play_time', 'total_world_time']);

/** Both diamond ores count: the deepslate one is the same find, one layer down. */
const DIAMOND_ORE = 'diamond_ore';

/**
 * The `minecraft:custom` counters worth naming, grouped the way the page lays
 * them out. Units default to a plain count. Anything Mojang adds later that
 * isn't listed here still shows up, under "Other" with a name made from its key.
 */
const SECTIONS: { title: string; stats: [key: string, label: string, unit?: StatUnit][] }[] = [
    {
        title: 'General',
        stats: [
            ['jump', 'Jumps'],
            ['sneak_time', 'Time sneaking', 'duration'],
            ['sleep_in_bed', 'Nights slept'],
            ['time_since_rest', 'Since last sleep', 'duration'],
            ['leave_game', 'Sessions ended'],
            ['animals_bred', 'Animals bred'],
            ['fish_caught', 'Fish caught'],
            ['talked_to_villager', 'Villagers talked to'],
            ['traded_with_villager', 'Villager trades'],
            ['enchant_item', 'Items enchanted'],
            ['drop', 'Items thrown'],
            ['eat_cake_slice', 'Cake slices eaten'],
            ['pot_flower', 'Flowers potted'],
            ['bell_ring', 'Bells rung'],
            ['play_record', 'Records played'],
            ['play_noteblock', 'Note blocks played'],
            ['tune_noteblock', 'Note blocks tuned'],
            ['raid_trigger', 'Raids triggered'],
            ['raid_win', 'Raids won'],
        ],
    },
    {
        title: 'Combat',
        stats: [
            ['mob_kills', 'Mobs killed'],
            ['player_kills', 'Players killed'],
            ['deaths', 'Deaths'],
            ['time_since_death', 'Since last death', 'duration'],
            ['damage_dealt', 'Damage dealt', 'health'],
            ['damage_taken', 'Damage taken', 'health'],
            ['damage_blocked_by_shield', 'Damage blocked by shield', 'health'],
            ['damage_absorbed', 'Damage absorbed', 'health'],
            ['damage_resisted', 'Damage resisted', 'health'],
            ['damage_dealt_absorbed', 'Damage dealt, absorbed', 'health'],
            ['damage_dealt_resisted', 'Damage dealt, resisted', 'health'],
            ['target_hit', 'Targets hit'],
        ],
    },
    {
        title: 'Travel',
        stats: [
            ['walk_one_cm', 'Walked', 'distance'],
            ['sprint_one_cm', 'Sprinted', 'distance'],
            ['crouch_one_cm', 'Crouched', 'distance'],
            ['swim_one_cm', 'Swum', 'distance'],
            ['walk_on_water_one_cm', 'On the surface', 'distance'],
            ['walk_under_water_one_cm', 'Walked underwater', 'distance'],
            ['climb_one_cm', 'Climbed', 'distance'],
            ['fall_one_cm', 'Fallen', 'distance'],
            ['fly_one_cm', 'Flown', 'distance'],
            ['aviate_one_cm', 'By elytra', 'distance'],
            ['boat_one_cm', 'By boat', 'distance'],
            ['minecart_one_cm', 'By minecart', 'distance'],
            ['horse_one_cm', 'By horse', 'distance'],
            ['pig_one_cm', 'By pig', 'distance'],
            ['strider_one_cm', 'By strider', 'distance'],
            ['happy_ghast_one_cm', 'By happy ghast', 'distance'],
        ],
    },
    {
        title: 'Interactions',
        stats: [
            ['open_chest', 'Chests opened'],
            ['open_barrel', 'Barrels opened'],
            ['open_shulker_box', 'Shulker boxes opened'],
            ['open_enderchest', 'Ender chests opened'],
            ['trigger_trapped_chest', 'Trapped chests sprung'],
            ['interact_with_crafting_table', 'Crafting tables used'],
            ['interact_with_furnace', 'Furnaces used'],
            ['interact_with_blast_furnace', 'Blast furnaces used'],
            ['interact_with_smoker', 'Smokers used'],
            ['interact_with_campfire', 'Campfires used'],
            ['interact_with_brewingstand', 'Brewing stands used'],
            ['interact_with_anvil', 'Anvils used'],
            ['interact_with_grindstone', 'Grindstones used'],
            ['interact_with_smithing_table', 'Smithing tables used'],
            ['interact_with_stonecutter', 'Stonecutters used'],
            ['interact_with_loom', 'Looms used'],
            ['interact_with_cartography_table', 'Cartography tables used'],
            ['interact_with_lectern', 'Lecterns used'],
            ['interact_with_beacon', 'Beacons used'],
            ['fill_cauldron', 'Cauldrons filled'],
            ['use_cauldron', 'Cauldrons drawn from'],
            ['clean_armor', 'Armour washed'],
            ['clean_banner', 'Banners washed'],
            ['clean_shulker_box', 'Shulker boxes washed'],
            ['inspect_dispenser', 'Dispensers inspected'],
            ['inspect_dropper', 'Droppers inspected'],
            ['inspect_hopper', 'Hoppers inspected'],
        ],
    },
];

const NAMED: ReadonlySet<string> = new Set(SECTIONS.flatMap(({ stats }) => stats.map(([key]) => key)));

/** The stats categories, in the order the page lists them. Each counts one thing per block, item or mob. */
const BREAKDOWNS: { key: string; title: string; note: string }[] = [
    { key: 'mined', title: 'Blocks mined', note: 'Blocks broken, by type' },
    { key: 'crafted', title: 'Items crafted', note: 'Everything made at a crafting table, furnace or anvil' },
    { key: 'used', title: 'Items used', note: 'Blocks placed, tools swung, food eaten' },
    { key: 'picked_up', title: 'Items picked up', note: 'Straight off the ground, however it got there' },
    { key: 'dropped', title: 'Items dropped', note: 'Thrown away or lost on death' },
    { key: 'broken', title: 'Tools worn out', note: 'Items used until their durability ran out' },
    { key: 'killed', title: 'Mobs killed', note: 'By this player, by mob type' },
    { key: 'killed_by', title: 'Killed by', note: 'What has managed to kill this player' },
];

/** Strips the `minecraft:` namespace so keys read as `custom.jump` rather than `custom['minecraft:jump']`. */
const unprefix = (key: string): string => key.replace(NAMESPACE, '');

/** A key with no entry in the table above, rendered as best we can: `sneak_time` → "Sneak time". */
const nameFor = (key: string): string => {
    const words = key.replaceAll('_', ' ');
    return words.charAt(0).toUpperCase() + words.slice(1);
};

/**
 * The unit an unlisted counter is most likely in. Minecraft names them
 * consistently: centimetres end in `_one_cm` and ticks are called time.
 */
const unitFor = (key: string): StatUnit => {
    if (key.endsWith(DISTANCE_SUFFIX)) return 'distance';
    if (key.endsWith('_time') || key.startsWith('time_')) return 'duration';
    return 'count';
};

/** Names a block, item or mob from its id: `minecraft:oak_log` → "Oak Log". */
const entityName = (id: string): string =>
    unprefix(id)
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

const sum = (values: Record<string, number>): number => Object.values(values).reduce((total, value) => total + value, 0);

/** Labels and groups the `minecraft:custom` counters, dropping everything the player has never done. */
const buildSections = (custom: Record<string, number>): StatSection[] => {
    const sections = SECTIONS.map(({ title, stats }) => ({
        title,
        rows: stats.flatMap(([key, label, unit]) => {
            const value = custom[key] ?? 0;
            return value > 0 ? [{ key, label, unit: unit ?? ('count' as StatUnit), value }] : [];
        }),
    }));

    // Whatever the table above doesn't know about — a newer Minecraft's counters,
    // or a mod's. Ranked by size, since we have nothing better to sort them by.
    const other = Object.entries(custom)
        .filter(([key, value]) => value > 0 && !NAMED.has(key) && !WITHHELD.has(key))
        .sort(([, a], [, b]) => b - a)
        .map(([key, value]) => ({
            key,
            label: nameFor(key),
            unit: unitFor(key),
            value,
        }));

    return [...sections, { title: 'Other', rows: other }].filter((section) => section.rows.length > 0);
};

/** Ranks one stats category's counters, biggest first. */
const buildBreakdown = (category: Record<string, number> | undefined, { key, title, note }: (typeof BREAKDOWNS)[number]): Breakdown => {
    const ranked = Object.entries(category ?? {})
        .filter(([, value]) => value > 0)
        .sort(([, a], [, b]) => b - a);

    const leader = ranked[0]?.[1] ?? 0;

    return {
        key,
        title,
        note,
        total: ranked.reduce((running, [, value]) => running + value, 0),
        entries: ranked.map(([id, value]) => ({ id, name: entityName(id), value, share: value / leader })),
    };
};

/** Everyone the server has ever seen, or nobody when `MC_STATS_DIR` is unset. */
export const listPlayers = async (): Promise<RosterPlayer[]> => (statsDir ? readRoster(statsDir) : []);

/**
 * Looks a player up by name, case-insensitively: Minecraft treats names that
 * way, and a URL typed by hand won't have the capitalisation right. Returns the
 * roster entry, which is where the canonical spelling of the name comes from.
 */
export const findPlayer = async (name: string): Promise<RosterPlayer | null> => {
    const wanted = name.toLowerCase();
    return (await listPlayers()).find((entry) => entry.name.toLowerCase() === wanted) ?? null;
};

/**
 * Everything one player's page needs, or `null` when there is no such player —
 * an unknown name, a roster the server can't read, or someone who has joined
 * but never played long enough for the server to write their stats file.
 */
export const loadPlayer = async (name: string): Promise<PlayerPage | null> => {
    const dir = statsDir;
    if (!dir) return null;

    const player = await findPlayer(name);
    if (!player) return null;

    // Two files, and only this player's: nothing here is a comparison, so no
    // other player's data needs reading.
    const [stats, advancements] = await Promise.all([readPlayerStats(dir, player.uuid), readPlayerAdvancements(dir, player.uuid)]);

    if (!stats) return null;

    const categories = stats.stats ?? {};

    const custom: Record<string, number> = {};
    for (const [key, value] of Object.entries(categories['minecraft:custom'] ?? {})) {
        custom[unprefix(key)] = value;
    }

    const measured = measureAdvancements(advancements);

    // Falling isn't travelling, whatever the counter says.
    const distance = Object.entries(custom)
        .filter(([key]) => key.endsWith(DISTANCE_SUFFIX) && key !== `fall${DISTANCE_SUFFIX}`)
        .reduce((total, [, value]) => total + value, 0);

    const mined = categories['minecraft:mined'] ?? {};
    const diamonds = Object.entries(mined)
        .filter(([id]) => id.endsWith(DIAMOND_ORE))
        .reduce((total, [, value]) => total + value, 0);

    const breakdowns = BREAKDOWNS.map((breakdown) => buildBreakdown(categories[`minecraft:${breakdown.key}`], breakdown)).filter(
        (breakdown) => breakdown.entries.length > 0,
    );

    /** The biggest entry in one category — the breakdowns are already ranked. */
    const leader = (key: string): BreakdownEntry | null => breakdowns.find((breakdown) => breakdown.key === key)?.entries[0] ?? null;

    const deaths = custom.deaths ?? 0;

    return {
        uuid: player.uuid,
        name: player.name,
        totals: {
            advancements: measured.done,
            mined: sum(mined),
            diamonds,
            mobKills: custom.mob_kills ?? 0,
            deaths,
            distance,
            // Someone who has never died has been surviving since they joined,
            // which is their play time under another name — and that is the one
            // number this page won't print. They get told they've never died.
            survivalStreak: deaths > 0 ? (custom.time_since_death ?? 0) : null,
        },
        favourite: leader('used'),
        nemesis: leader('killed_by'),
        sections: buildSections(custom),
        breakdowns,
        advancements: measured,
    };
};
