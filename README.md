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
RESOURCE_PACK_URL=https://.../pack.zip   # optional — direct URL to the client resource pack download
```

`MC_SERVER_ADDRESS` is required; if it is unset the status API responds with a
`500` and a configuration error. The two port variables default to `25565`.

To get the full online player list, enable the Query protocol on the server by
setting the following in `server.properties`:

```properties
enable-query=true
query.port=25565
```

Without Query, the site still works but falls back to the Server List Ping
sample, which most servers truncate to a partial player list.

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
- `src/components/ServerStatus.tsx` — client component using SWR to poll
  `/api/status` every 30 seconds. Renders an online/offline badge, players,
  version, gametype, MOTD, server icon, and the live player list.
- `src/app/page.tsx` — the static page content: server info, performance mods,
  a live-map link, rules, and recommended client-side mods, shaders, and
  resource packs.

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

| Command         | Description                                        |
| --------------- | -------------------------------------------------- |
| `npm run dev`   | Start the dev server                               |
| `npm run build` | Production build                                    |
| `npm run start` | Serve the production build                          |
| `npm run lint`  | Lint and format with Biome (`biome check --write`) |
