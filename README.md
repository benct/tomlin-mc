# Minecraft Server Info

A single-page site showing live status and player info for a Minecraft server,
styled like a GitHub-rendered Markdown file with light/dark/system theming.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS** (v4)
- **SWR** for client-side polling of live status
- **Biome** for linting and formatting
- Zero third-party status services — the server is queried directly over its
  native protocols.

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
MC_VERSION=26.2                          # optional — `npm run build:data` — see below
MC_STATS_DIR=/server/stats               # optional — player data directory for the stats page
MC_LOGS_DIR=/server/logs                 # optional — server log directory, for the log on /stats and /admin
RESOURCE_PACK_URL=https://.../pack.zip   # optional — direct URL to the client resource pack download
ADMIN_PASSWORD=some-password             # optional — password for /admin; unset means the page doesn't exist
```

`MC_SERVER_ADDRESS` is required; if it is unset the status API responds with a
`500` and a configuration error. The two port variables default to `25565`.

`MC_STATS_DIR` points at the server's player data. Without it the stats page just
says so, and the per-player pages under it 404. It expects the following layout:

```
<MC_STATS_DIR>/usercache.json           # the roster: [{ "uuid": ..., "name": ... }]
<MC_STATS_DIR>/stats/<uuid>.json        # one stats file per player
<MC_STATS_DIR>/advancements/<uuid>.json # one advancements file per player
```

`MC_LOGS_DIR` points at the server's stock `logs` directory and drives the log
on both the stats page and `/admin`. Without it, each just says so. Nothing
server-side needs to change — the files are the ones Minecraft already writes:

```
<MC_LOGS_DIR>/latest.log              # the current run, plain text
<MC_LOGS_DIR>/<yyyy-mm-dd>-<n>.log.gz # one gzipped file per previous run/day
```

`ADMIN_PASSWORD` guards `/admin` (see [Admin page](#admin-page)).
Leave it unset and the page returns a `404` — there is no way to reach it
without a password.

To get the full online player list, enable the Query protocol on the server by
setting the following in `server.properties`:

```properties
enable-query=true
query.port=25565
```

Without Query, the site still works but falls back to the Server List Ping
sample, which most servers truncate to a partial player list.

`MC_VERSION` is used only by `npm run build:data`; the site itself doesn't
read it. If not added to `.env.local`, include it when running the script:

```bash
MC_VERSION=26.3 npm run build:data
```

## How it works

The `src/lib` modules, and what each is for:

- `src/lib/env.ts` — the only place `process.env` is read; resolves ports, directories and the admin password.
- `src/lib/logs.ts` — finds, reads, dates and classifies the server's own log files into typed entries. Masks IP
  addresses and `§` codes on the way through, and decides which types a public page may see: deaths and advancements only.
- `src/lib/admin.ts` — assembles what `/admin` shows: the filtered log, per-type counts, and each player's login history.
- `src/lib/mcping.ts` — Server List Ping over TCP: version, MOTD, player counts, server icon.
- `src/lib/mcquery.ts` — the UDP Query protocol: the full online player list, gametype and map.
- `src/lib/serverData.ts` — the on-disk readers stats, players and logs share: tolerant JSON, the `usercache.json`
  roster, and one player's stats and advancements files.
- `src/lib/stats.ts` — turns each player's stats and advancements files into the ranked leaderboards.
- `src/lib/player.ts` — assembles what one player's page shows: their counters labelled and grouped, and every block,
  item and mob they have touched, ranked.
- `src/lib/advancements.ts` — measures a player's advancement file against the generated catalogue of every
  advancement in the game, so the page can show what is left as well as what is earned.
- `src/lib/recipes.ts` — pure helpers over the generated recipe dataset: tag expansion, grid padding, sprite URLs,
  ranked search.
- `src/lib/formatting.ts` — renders Minecraft's raw counters (ticks, centimetres, tenths of a heart) as something readable.
- `src/lib/datetime.ts` — formats instants in the server's timezone, with the locale pinned.

### Admin page

`/admin` shows the whole log — every type, not just the two the stats page
publishes — alongside the player list and the resolved configuration. It is
unlisted and unindexed, and `src/proxy.ts` gates it with HTTP Basic auth against
`ADMIN_PASSWORD`; leave that unset and the page 404s instead.

### Generated game data

`npm run build:data` regenerates both datasets from vanilla game data. Each
pulls from [mcmeta](https://github.com/misode/mcmeta) at the `MC_VERSION` tag
and resolves item sprite filenames against minecraft.wiki; `scripts/mcmeta.mjs`
holds the parts they share. Both outputs are committed and nothing regenerates
them — re-run the script when the server updates.

- `public/recipes.json` — every renderable recipe, with tags expanded to
  concrete items. Fetched by the browser, since only the recipe book needs it.
- `src/data/advancements.json` — every advancement in the game with its title,
  description, icon and criteria. Imported by the app, since the player pages
  render it server-side.

## Scripts

| Command                      | Description                                                          |
| ---------------------------- | -------------------------------------------------------------------- |
| `npm run dev`                | Start the dev server                                                 |
| `npm run build`              | Production build                                                     |
| `npm run start`              | Serve the production build                                           |
| `npm run lint`               | Lint and format with Biome (`biome check --write`)                   |
| `npm run build:data`         | Regenerate both game datasets (needs network)                        |
| `npm run build:recipes`      | Regenerate `public/recipes.json` for the recipe book                 |
| `npm run build:advancements` | Regenerate `src/data/advancements.json` for the player pages         |
