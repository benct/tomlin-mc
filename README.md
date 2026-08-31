# Minecraft Server Info

A single-page site showing live status and player info for a Minecraft server,
styled like a GitHub-rendered Markdown file with light/dark/system theming.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS** (v4)
- **SWR** for client-side polling of live status
- **Biome** for linting and formatting
- Zero third-party status services — the server is queried directly over its
  native protocols (see [How it works](#how-it-works)).

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Configuration

Configure the target server via environment variables in `.env.local`:

```bash
# .env.local
MC_SERVER_ADDRESS=play.yourserver.net    # required — server hostname or IP
MC_SERVER_PORT=25565                     # optional — Server List Ping (TCP) port, default 25565
MC_QUERY_PORT=25565                      # optional — Query (UDP) port, default 25565
MC_VERSION=26.2                          # optional — `npm run build:recipes` only — see below
MC_STATS_DIR=/server/stats               # optional — player data directory for the stats page
RESOURCE_PACK_URL=https://.../pack.zip   # optional — direct URL to the client resource pack download
```

`MC_SERVER_ADDRESS` is required; if it is unset the status API responds with a
`500` and a configuration error. The two port variables default to `25565`.

`MC_STATS_DIR` points at the server's player data. Without it the stats page just
says so. It expects the following layout:

```
<MC_STATS_DIR>/usercache.json           # the roster: [{ "uuid": ..., "name": ... }]
<MC_STATS_DIR>/stats/<uuid>.json        # one stats file per player
<MC_STATS_DIR>/advancements/<uuid>.json # one advancements file per player
```

To get the full online player list, enable the Query protocol on the server by
setting the following in `server.properties`:

```properties
enable-query=true
query.port=25565
```

Without Query, the site still works but falls back to the Server List Ping
sample, which most servers truncate to a partial player list.

`MC_VERSION` is used only by `npm run build:recipes`; the site itself doesn't
read it. If not added to `.env.local`, include it when running the script:

```bash
MC_VERSION=26.3 npm run build:recipes
```

## How it works

The Minecraft server is queried directly using two native Minecraft protocols, 
hand-implemented with no runtime dependencies:

- `src/lib/mcping.ts` — the modern (1.7+) **Server List Ping** protocol over TCP.
  Provides version, MOTD, player counts, a player sample, and the server icon.
- `src/lib/mcquery.ts` — the UDP **Query** protocol. Provides the complete online 
  player list plus gametype, map, and other server metadata.
  Requires `enable-query=true` server-side.
- `src/app/api/status/route.ts` — queries both protocols in parallel with
  `Promise.allSettled` and merges the results into a single `ServerStatus`
  (`src/lib/types.ts`), preferring Query data where both are present (the player
  list) and filling in the server icon from SLP (which Query lacks). If both
  fail, it returns an `online: false` payload so the UI degrades gracefully.
  The route is marked `dynamic = 'force-dynamic'`; refresh cadence is handled
  client-side by SWR.
- `src/app/page.tsx` — the static page content.

The player stats page is read from disk rather than over the network:

- `src/lib/stats.ts` — reads the roster, then each listed player's stats and
  advancements files, and flattens them into ranked top lists. Playtime is in
  ticks, travel in centimetres, and damage in tenths of a health point, so
  `src/lib/formatStats.ts` converts each to something readable. Advancement
  counts exclude `minecraft:recipes/*`, which the server grants automatically.
  Stats with no scores on the server (e.g. `player_kills` where nobody has
  PvP'd) are dropped rather than shown as an all-zero board.
- `src/app/stats/page.tsx` — a server component rendering the server-wide
  totals, the leaderboards, and a per-player table. It sets `revalidate = 300`,
  so the files are re-read at most once every 5 minutes instead of being baked
  in at build time.

The recipe book at `/recipes` is built from a generated, committed dataset:

- `scripts/build-recipes.mjs` — run manually with `npm run build:recipes`. Pulls
  the vanilla recipe, item-tag and `en_us` language files from
  [misode/mcmeta](https://github.com/misode/mcmeta) via jsDelivr (pinned to a
  release tag), keeps the recipe types that can actually be drawn
  (crafting, the furnace family, stonecutting, smithing transforms), resolves
  item tags to concrete items, and writes `public/recipes.json`. It also asks
  minecraft.wiki's API for the real filename of every item sprite, because
  around a hundred of them redirect to a differently-named file (animated
  `.gif`s, one shared sprite for all the waxed copper variants) that would 404
  if the URL were derived from the item name alone. Set `MC_VERSION` when the
  server updates.
  Crafting grids are stored with their trailing empty slots dropped and padded
  back out by `craftingGrid`, which keeps ~4100 `""` entries out of the file.
- `src/lib/recipes.ts` — types and pure helpers: expanding a tag reference like
  `#planks` to its items, padding a stored grid back to 3x3, deriving sprite and
  minecraft.wiki URLs, collapsing the flat recipe list into one entry per
  resulting item, and ranked search
  (exact name beats prefix beats substring, with ingredient matches last so
  "redstone" lists redstone items before everything built from it).
- `src/app/recipes/page.tsx` — the page shell and source attribution. Note that
  the page lives at `/recipes` while its dataset is served from
  `/recipes.json`; the two paths don't collide because the static file keeps
  its extension.

## Theming

- `src/components/ThemeToggle.tsx` — a floating button that cycles
  **system → light → dark**, persists the choice to `localStorage`, and reflects
  it via `data-theme` on `<html>`.
- `src/app/layout.tsx` — inlines a small pre-paint script that applies the saved
  theme before first render to avoid a light/dark flash.
- `src/app/globals.css` — GitHub Primer color tokens and Markdown typography.
  `system` follows `prefers-color-scheme`; explicit `light`/`dark` are driven by
  the `data-theme` attribute.

## Scripts

| Command                 | Description                                                     |
| ----------------------- | --------------------------------------------------------------- |
| `npm run dev`           | Start the dev server                                            |
| `npm run build`         | Production build                                                 |
| `npm run start`         | Serve the production build                                       |
| `npm run lint`          | Lint and format with Biome (`biome check --write`)              |
| `npm run build:recipes` | Regenerate `public/recipes.json` for the recipe book (needs network) |
