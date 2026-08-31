/**
 * Generates `public/recipes.json` — the dataset behind the /recipes page.
 *
 * Two upstream sources, both free and keyless:
 *
 *  - misode/mcmeta (via the jsDelivr CDN) for the vanilla recipe, item-tag and
 *    en_us language files. Pinned to a release tag so the output is
 *    reproducible; bump MC_VERSION when the server updates.
 *  - minecraft.wiki's MediaWiki API to resolve the real filename of each item's
 *    "Invicon" inventory sprite. Most are simply `Invicon_<Display_Name>.png`,
 *    but ~100 are redirects to a differently-named file (animated .gif, a
 *    shared sprite for waxed copper variants, …) which would 404 if we
 *    constructed the URL naively. Resolving here keeps runtime dependency-free.
 *
 * Run with `npm run build:recipes`, which loads `.env.local` for MC_VERSION.
 * The generated JSON is committed so that `next build` never needs network
 * access.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Minecraft version to extract, given as an mcmeta release tag. Required — a
 * stale default would silently regenerate the dataset against the wrong version.
 * `https://cdn.jsdelivr.net/gh/misode/mcmeta@summary/version.json` reports the
 * newest build, and only stable releases get a plain tag like `26.2`.
 */
const MC_VERSION = process.env.MC_VERSION;

if (!MC_VERSION) {
    console.log('[Error] MC_VERSION is not set — add it to .env.local, or run `MC_VERSION=26.2 npm run build:recipes`.');
    console.log('[Error] It takes an mcmeta release tag: https://github.com/misode/mcmeta/tags');
    process.exit(1);
}

const CDN = `https://cdn.jsdelivr.net/gh/misode/mcmeta@${MC_VERSION}`;
const WIKI_API = 'https://minecraft.wiki/api.php';
const USER_AGENT = 'tomlin-mc-recipe-book/1.0 (https://github.com/benct/tomlin-mc; build script)';
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

const strip = (value) => value.replace(/^(#?)minecraft:/, '$1');

const titleCase = (id) =>
    id
        .split('_')
        .map((word) => word[0].toUpperCase() + word.slice(1))
        .join(' ');

const fetchJson = async (url) => {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
    return res.json();
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

/** Looks up file titles 50 at a time, following redirects, and reports which ones actually hold an image. */
const queryFiles = async (titles) => {
    const resolved = {};
    for (let index = 0; index < titles.length; index += 50) {
        const batch = titles.slice(index, index + 50);
        const params = new URLSearchParams({
            action: 'query',
            format: 'json',
            redirects: '1',
            prop: 'imageinfo',
            iiprop: 'url',
            titles: batch.join('|'),
        });
        const { query } = await fetchJson(`${WIKI_API}?${params}`);

        // `redirects` maps the title we asked for to the one that actually holds the file.
        const target = Object.fromEntries((query.redirects ?? []).map(({ from, to }) => [from, to]));
        const hasFile = Object.fromEntries(Object.values(query.pages).map((page) => [page.title, Boolean(page.imageinfo?.length)]));
        for (const title of batch) {
            const final = target[title] ?? title;
            resolved[title] = hasFile[final] ? final.replace(/^File:/, '').replaceAll(' ', '_') : null;
        }
        process.stdout.write(`\r  icons ${Math.min(index + 50, titles.length)}/${titles.length}`);
    }
    process.stdout.write('\n');
    return resolved;
};

/**
 * Finds the real sprite filename for each display name. Most are simply
 * `Invicon_<Display_Name>.png`, but some redirect elsewhere and a few only
 * exist under the wiki's older `ItemSprite`/`BlockSprite` naming, so fall back
 * through those before giving up.
 */
const resolveIcons = async (names) => {
    const kebab = (name) => name.toLowerCase().replaceAll(' ', '-');
    const resolved = await queryFiles(names.map((name) => `File:Invicon ${name}.png`));

    const icons = {};
    const unresolved = [];
    for (const name of names) {
        const file = resolved[`File:Invicon ${name}.png`];
        if (file) icons[name] = file;
        else unresolved.push(name);
    }

    if (unresolved.length) {
        const fallbacks = await queryFiles(
            unresolved.flatMap((name) => [`File:ItemSprite ${kebab(name)}.png`, `File:BlockSprite ${kebab(name)}.png`]),
        );
        for (const name of unresolved) {
            const file = fallbacks[`File:ItemSprite ${kebab(name)}.png`] ?? fallbacks[`File:BlockSprite ${kebab(name)}.png`];
            if (file) icons[name] = file;
        }
    }
    return icons;
};

const main = async () => {
    console.log(`Building recipe data for Minecraft ${MC_VERSION}…`);
    const [rawRecipes, rawTags, lang] = await Promise.all([
        fetchJson(`${CDN}-summary/data/recipe/data.min.json`),
        fetchJson(`${CDN}-summary/data/tag/item/data.min.json`),
        fetchJson(`${CDN}-assets/assets/minecraft/lang/en_us.json`),
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
        const name = NAME_OVERRIDES[id] ?? lang[`item.minecraft.${id}`] ?? lang[`block.minecraft.${id}`];
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
    const defaultFile = (name) => `Invicon_${name.replaceAll(' ', '_')}.png`;
    const icons = {};
    const missing = [];
    for (const [id, name] of Object.entries(items)) {
        const file = ICON_OVERRIDES[id] ?? iconsByName[name];
        if (!file) missing.push(`${id} ("${name}")`);
        // Only carry the exceptions; the app derives the rest from the display name.
        else if (file !== defaultFile(name)) icons[id] = file;
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

await main().catch((error) => {
    console.log(`[Error] ${error.message}`);
    if (error.message.includes('cdn.jsdelivr.net')) {
        console.log(`[Error] Is MC_VERSION="${MC_VERSION}" a real tag? See https://github.com/misode/mcmeta/tags`);
    }
    process.exitCode = 1;
});
