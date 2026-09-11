/**
 * Generates `src/data/advancements.json` — the vanilla advancement catalogue
 * behind the per-player pages at /stats/<player>.
 *
 * A player's `advancements/<uuid>.json` only lists what they have made progress
 * on, so it can say what has been earned but not what is left. This dataset is
 * the other half: every advancement in the game, with the title, description and
 * icon Minecraft itself shows, plus the criteria each one needs so a partly
 * finished advancement can be rendered as a fraction.
 *
 * Recipe unlocks are dropped — there are ~1550 of them, the server grants them
 * automatically, and no player thinks of them as advancements.
 *
 * Unlike the recipe dataset this one is imported by the app rather than fetched
 * by the browser, so it lives in `src/data` instead of `public`.
 *
 * Run with `npm run build:data`, which loads `.env.local` for MC_VERSION. The
 * generated JSON is committed so that `next build` never needs network access.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CDN, fetchJson, fetchLang, itemName, MC_VERSION, resolveIcons, run, strip, titleCase } from './mcmeta.mjs';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/advancements.json');

/** Advancements under this prefix are recipe unlocks, granted automatically rather than earned. */
const RECIPE_PREFIX = 'recipes/';

/** The tabs, in the order Minecraft shows them. Each takes its name from its own root advancement. */
const CATEGORIES = ['story', 'nether', 'end', 'adventure', 'husbandry'];

/** Advancement titles and descriptions are translatable text components — always a plain key in vanilla. */
const translate = (lang, text, id) => {
    const value = lang[text?.translate];
    if (!value) throw new Error(`No translation for "${text?.translate}" (${id})`);
    return value;
};

/**
 * Where a criterion's own name lives in the language file. A criterion is named
 * after whatever it asks for — a biome, a mob, a food — and nothing says which,
 * so try each family in turn.
 */
const CRITERION_KEYS = ['biome', 'entity', 'item', 'block', 'effect'];

/** The armour trim criteria spell themselves out: `armor_trimmed_minecraft:rib_armor_trim_smithing_template_smithing_trim`. */
const TRIM_CRITERION = /^armor_trimmed_minecraft:(.+)_armor_trim_smithing_template_smithing_trim$/;

/**
 * What one criterion asks for, in English. Falls back to the criterion's own
 * name, which is the best there is for the ones Minecraft never shows as text:
 * cat, wolf and frog variants, and the structures a sherd can come from.
 */
const criterionName = (lang, criterion) => {
    const trim = TRIM_CRITERION.exec(criterion);
    if (trim) return lang[`trim_pattern.minecraft.${trim[1]}`] ?? titleCase(trim[1]);

    const key = strip(criterion);
    for (const family of CRITERION_KEYS) {
        const name = lang[`${family}.minecraft.${key}`];
        if (name) return name;
    }
    return titleCase(key);
};

/**
 * Names one requirement group — one tick on the checklist. Nearly every group
 * asks for a single thing; the one that doesn't ("brush a suspicious block in
 * any of six structures") would run off the line if spelled out in full.
 */
const stepName = (lang, group) => {
    const names = group.map((criterion) => criterionName(lang, criterion));
    return names.length <= 2 ? names.join(' / ') : `${names[0]} +${names.length - 1} more`;
};

/** How far an advancement sits from its category root, so children can be listed under their parent. */
const depthOf = (id, raw, seen = new Set()) => {
    const parent = raw[id]?.parent;
    if (!parent || seen.has(id)) return 0;
    seen.add(id);
    return 1 + depthOf(strip(parent), raw, seen);
};

const main = async () => {
    console.log(`Building advancement data for Minecraft ${MC_VERSION}…`);
    const [raw, lang] = await Promise.all([fetchJson(`${CDN}-summary/data/advancement/data.min.json`), fetchLang()]);

    const earnable = Object.entries(raw).filter(([id, advancement]) => !id.startsWith(RECIPE_PREFIX) && advancement.display);

    // Every icon is an item; a few carry components (a decorated pot, the
    // ominous banner) which only change how the item looks, not what it is.
    const iconNames = {};
    for (const [id, advancement] of earnable) {
        const icon = strip(advancement.display.icon.id);
        const name = itemName(lang, icon);
        if (!name) throw new Error(`No display name for icon "${icon}" (${id})`);
        iconNames[icon] = name;
    }

    const iconsByName = await resolveIcons([...new Set(Object.values(iconNames))].sort());
    const missing = new Set();

    const advancements = earnable
        .map(([id, advancement]) => {
            const { display, criteria, requirements } = advancement;
            const icon = strip(display.icon.id);
            const file = iconsByName[iconNames[icon]];
            if (!file) missing.add(`${icon} ("${iconNames[icon]}")`);

            const groups = requirements ?? [Object.keys(criteria)];

            return {
                id,
                category: id.split('/')[0],
                title: translate(lang, display.title, id),
                description: translate(lang, display.description, id),
                // Goals and challenges are rarer and harder than plain tasks, and
                // the game frames them differently; the page colours them to match.
                frame: display.frame ?? 'task',
                // Hidden ones aren't shown in game until earned, so nor are they here.
                ...(display.hidden ? { hidden: true } : {}),
                ...(file ? { icon: file } : {}),
                // Groups of alternatives: one criterion from each group completes it.
                // Nearly always one criterion per group, but "kill any hostile mob"
                // is a single group of 41, which is the difference between 1/1 and 1/41.
                requirements: groups,
                // Anything asking for more than one thing is a checklist — all 55
                // biomes, all 40 foods — so name each tick on it. The rest are a
                // single step, which the title already describes.
                ...(groups.length > 1 ? { steps: groups.map((group) => stepName(lang, group)) } : {}),
                depth: depthOf(id, raw),
            };
        })
        .sort(
            (a, b) =>
                CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || a.depth - b.depth || a.title.localeCompare(b.title),
        )
        // `depth` only ordered the list; the app has no use for it.
        .map(({ depth, ...advancement }) => advancement);

    if (missing.size) console.log(`  [Warning] no sprite found for ${missing.size} icon(s): ${[...missing].join(', ')}`);

    const categories = CATEGORIES.map((key) => {
        const root = advancements.find((advancement) => advancement.id === `${key}/root`);
        if (!root) throw new Error(`No root advancement for category "${key}"`);
        return { key, title: root.title };
    });

    const data = { version: MC_VERSION, generatedAt: new Date().toISOString(), categories, advancements };
    await mkdir(dirname(OUT), { recursive: true });
    await writeFile(OUT, `${JSON.stringify(data)}\n`);

    const kb = (await import('node:fs')).statSync(OUT).size / 1024;
    console.log(`Wrote ${OUT}`);
    console.log(`  ${advancements.length} advancements · ${categories.length} categories · ${kb.toFixed(0)} KB`);
};

await run(main);
