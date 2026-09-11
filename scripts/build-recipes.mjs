/**
 * Generates `public/recipes.json` — the dataset behind the recipe book on /wiki.
 *
 * The upstream sources and the wiki sprite lookup are shared with the other
 * generators; see `scripts/mcmeta.mjs`.
 *
 * Run with `npm run build:data`, which loads `.env.local` for MC_VERSION. The
 * generated JSON is committed so that `next build` never needs network access.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CDN, defaultSprite, fetchJson, fetchLang, itemName, MC_VERSION, resolveIcons, run, strip, titleCase } from './mcmeta.mjs';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/recipes.json');

/** Recipe types we can render. Everything else (`crafting_special_*`, brewing, smithing_trim, …) is dropped. */
const CRAFTING = ['crafting_shaped', 'crafting_shapeless', 'crafting_transmute'];
const COOKING = {
    smelting: ['furnace', 200],
    blasting: ['blast_furnace', 100],
    smoking: ['smoker', 100],
    campfire_cooking: ['campfire', 600],
};

/**
 * Items whose language-file name is shared by many ids ("Music Disc" covers 20
 * discs), leaving no unique wiki page or sprite. Ids not listed here fall back
 * to a title-cased id, which is what the wiki uses for the other collisions
 * (armor trim templates, banner patterns).
 */
const NAME_OVERRIDES = { music_disc_5: 'Music Disc 5', disc_fragment_5: 'Disc Fragment 5' };

/** Sprites the filename cascade below can't guess — the wiki files use the older "charge" naming. */
const ICON_OVERRIDES = {
    creeper_banner_pattern: 'ItemSprite_creeper-charge-banner-pattern.png',
    flower_banner_pattern: 'ItemSprite_flower-charge-banner-pattern.png',
    skull_banner_pattern: 'ItemSprite_skull-charge-banner-pattern.png',
    mojang_banner_pattern: 'ItemSprite_thing-banner-pattern.png',
};

/**
 * Normalises one ingredient slot into the compact wire format used by the app:
 * `#tag` references the `tags` map, `a|b` means "any of", '' means empty.
 */
const slot = (value) => {
    if (value == null) return '';
    return [value]
        .flat()
        .map((entry) => strip(entry))
        .join('|');
};

/** Expands an item tag to concrete ids, following nested `#tag` references. */
const expandTag = (tags, name, seen = new Set()) => {
    if (seen.has(name)) return [];
    seen.add(name);
    return (tags[name]?.values ?? []).flatMap((value) => {
        const id = strip(typeof value === 'string' ? value : value.id);
        return id.startsWith('#') ? expandTag(tags, strip(id.slice(1)), seen) : [id];
    });
};

/**
 * Trailing empty slots carry no information — the app pads every grid back out
 * to nine. Dropping them here costs nothing and keeps ~4100 `""` entries out of
 * the file. Interior gaps still matter for shaped recipes and are kept.
 */
const trimGrid = (grid) => {
    let length = grid.length;
    while (length > 0 && grid[length - 1] === '') length -= 1;
    return grid.slice(0, length);
};

/** Lays a shaped recipe's pattern out over a 3x3 grid so the UI can render it directly. */
const shapedGrid = (recipe) => {
    const grid = Array(9).fill('');
    recipe.pattern.forEach((row, y) => {
        [...row].forEach((symbol, x) => {
            if (symbol !== ' ') grid[y * 3 + x] = slot(recipe.key[symbol]);
        });
    });
    return trimGrid(grid);
};

/** Shapeless recipes have no layout — list them in order and let the app lay them out left to right. */
const shapelessGrid = (ingredients) => trimGrid(ingredients.slice(0, 9).map(slot));

/** Flattens a vanilla recipe into the shape the app renders, tagged with the layout that draws it. */
const normalise = (id, recipe) => {
    const type = strip(recipe.type);
    const result = { id: strip(recipe.result.id), count: recipe.result.count ?? 1 };
    const base = { id, type, result };

    if (type === 'crafting_shaped') return { ...base, kind: 'crafting', shapeless: false, grid: shapedGrid(recipe) };
    if (type === 'crafting_shapeless') return { ...base, kind: 'crafting', shapeless: true, grid: shapelessGrid(recipe.ingredients) };
    if (type === 'crafting_transmute')
        return { ...base, kind: 'crafting', shapeless: true, grid: shapelessGrid([recipe.input, recipe.material]) };
    if (type === 'stonecutting') return { ...base, kind: 'stonecutting', input: slot(recipe.ingredient), station: 'stonecutter' };
    if (type === 'smithing_transform') {
        return { ...base, kind: 'smithing', template: slot(recipe.template), base: slot(recipe.base), addition: slot(recipe.addition) };
    }

    const [station, defaultTime] = COOKING[type];
    return {
        ...base,
        kind: 'cooking',
        input: slot(recipe.ingredient),
        station,
        experience: recipe.experience ?? 0,
        cookingTime: recipe.cookingtime ?? defaultTime,
    };
};

/** Every item id a recipe references, including the station block and every member of every tag it uses. */
const collectIds = (recipes, tags) => {
    const ids = new Set();
    const tagNames = new Set();
    const add = (ref) => {
        for (const entry of ref.split('|').filter(Boolean)) {
            if (entry.startsWith('#')) tagNames.add(strip(entry.slice(1)));
            else ids.add(entry);
        }
    };

    for (const recipe of recipes) {
        ids.add(recipe.result.id);
        if (recipe.station) ids.add(recipe.station);
        if (recipe.grid) recipe.grid.forEach(add);
        if (recipe.input) add(recipe.input);
        if (recipe.kind === 'smithing') [recipe.template, recipe.base, recipe.addition].forEach(add);
    }

    const expanded = {};
    for (const name of [...tagNames].sort()) {
        expanded[name] = expandTag(tags, name);
        for (const id of expanded[name]) ids.add(id);
    }
    return { ids, tags: expanded };
};

const main = async () => {
    console.log(`Building recipe data for Minecraft ${MC_VERSION}…`);
    const [rawRecipes, rawTags, lang] = await Promise.all([
        fetchJson(`${CDN}-summary/data/recipe/data.min.json`),
        fetchJson(`${CDN}-summary/data/tag/item/data.min.json`),
        fetchLang(),
    ]);

    const renderable = [...CRAFTING, 'stonecutting', 'smithing_transform', ...Object.keys(COOKING)];
    const recipes = Object.entries(rawRecipes)
        .filter(([, recipe]) => renderable.includes(strip(recipe.type)) && recipe.result?.id)
        .map(([id, recipe]) => normalise(id, recipe))
        .sort((a, b) => a.id.localeCompare(b.id));

    const { ids, tags } = collectIds(recipes, rawTags);

    // `item.*` wins over `block.*`: minecraft:wheat is "Wheat" as an item but
    // "Wheat Crops" as a block, and only the former has a sprite.
    const items = {};
    for (const id of [...ids].sort()) {
        const name = NAME_OVERRIDES[id] ?? itemName(lang, id);
        if (!name) throw new Error(`No display name for "${id}"`);
        items[id] = name;
    }

    // A handful of ids share one language string ("Smithing Template" covers all
    // 19 trim templates), which would collapse them onto one wiki page and one
    // sprite. The wiki titles those pages after the id, so use that instead.
    const idsByName = {};
    for (const [id, name] of Object.entries(items)) {
        idsByName[name] ??= [];
        idsByName[name].push(id);
    }
    for (const shared of Object.values(idsByName).filter((group) => group.length > 1)) {
        for (const id of shared) items[id] = titleCase(id);
    }

    const iconsByName = await resolveIcons([...new Set(Object.values(items))].sort());
    const icons = {};
    const missing = [];
    for (const [id, name] of Object.entries(items)) {
        const file = ICON_OVERRIDES[id] ?? iconsByName[name];
        if (!file) missing.push(`${id} ("${name}")`);
        // Only carry the exceptions; the app derives the rest from the display name.
        else if (file !== defaultSprite(name)) icons[id] = file;
    }
    if (missing.length) console.log(`  [Warning] no sprite found for ${missing.length} item(s): ${missing.join(', ')}`);

    const data = { version: MC_VERSION, generatedAt: new Date().toISOString(), items, icons, tags, recipes };
    await mkdir(dirname(OUT), { recursive: true });
    await writeFile(OUT, `${JSON.stringify(data)}\n`);

    const kb = (await import('node:fs')).statSync(OUT).size / 1024;
    console.log(`Wrote ${OUT}`);
    console.log(
        `  ${recipes.length} recipes · ${Object.keys(items).length} items · ${Object.keys(tags).length} tags · ${Object.keys(icons).length} icon overrides · ${kb.toFixed(0)} KB`,
    );
};

await run(main);
