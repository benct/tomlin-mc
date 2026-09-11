/**
 * Shared plumbing for the dataset generators in this directory.
 *
 * Both generators pull from the same two keyless upstreams:
 *
 *  - misode/mcmeta (via the jsDelivr CDN) for the vanilla data and en_us
 *    language files. Pinned to a release tag so the output is reproducible;
 *    bump MC_VERSION when the server updates.
 *  - minecraft.wiki's MediaWiki API to resolve the real filename of each item's
 *    "Invicon" inventory sprite. Most are simply `Invicon_<Display_Name>.png`,
 *    but ~100 are redirects to a differently-named file (animated .gif, a
 *    shared sprite for waxed copper variants, …) which would 404 if we
 *    constructed the URL naively. Resolving here keeps runtime dependency-free.
 */

/**
 * Minecraft version to extract, given as an mcmeta release tag. Required — a
 * stale default would silently regenerate a dataset against the wrong version.
 * `https://cdn.jsdelivr.net/gh/misode/mcmeta@summary/version.json` reports the
 * newest build, and only stable releases get a plain tag like `26.2`.
 */
export const MC_VERSION = process.env.MC_VERSION;

if (!MC_VERSION) {
    console.log('[Error] MC_VERSION is not set — add it to .env.local, or run `MC_VERSION=26.2 npm run build:data`.');
    console.log('[Error] It takes an mcmeta release tag: https://github.com/misode/mcmeta/tags');
    process.exit(1);
}

export const CDN = `https://cdn.jsdelivr.net/gh/misode/mcmeta@${MC_VERSION}`;

const WIKI_API = 'https://minecraft.wiki/api.php';
const USER_AGENT = 'tomlin-mc-data/1.0 (https://github.com/benct/tomlin-mc; build script)';

/** Drops the `minecraft:` namespace, keeping a leading `#` where a tag reference has one. */
export const strip = (value) => value.replace(/^(#?)minecraft:/, '$1');

export const titleCase = (id) =>
    id
        .split('_')
        .map((word) => word[0].toUpperCase() + word.slice(1))
        .join(' ');

export const fetchJson = async (url) => {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
    return res.json();
};

/** The en_us language file, which is where every item and advancement gets its English name. */
export const fetchLang = () => fetchJson(`${CDN}-assets/assets/minecraft/lang/en_us.json`);

/** The display name of an item id. `item.*` wins over `block.*` — see the note in `build-recipes.mjs`. */
export const itemName = (lang, id) => lang[`item.minecraft.${id}`] ?? lang[`block.minecraft.${id}`];

/** The sprite filename a display name implies, before the wiki has been asked about it. */
export const defaultSprite = (name) => `Invicon_${name.replaceAll(' ', '_')}.png`;

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
 * through those before giving up. Names with no sprite at all are left out.
 */
export const resolveIcons = async (names) => {
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

/** Runs a generator's `main`, reporting failures as a message rather than a stack trace. */
export const run = async (main) => {
    await main().catch((error) => {
        console.log(`[Error] ${error.message}`);
        if (error.message.includes('cdn.jsdelivr.net')) {
            console.log(`[Error] Is MC_VERSION="${MC_VERSION}" a real tag? See https://github.com/misode/mcmeta/tags`);
        }
        process.exitCode = 1;
    });
};
