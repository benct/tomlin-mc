/**
 * Centralized access to environment variables.
 *
 * All of these are server-only (no `NEXT_PUBLIC_` prefix), so this module must
 * only be imported from server components, route handlers, or other server code.
 */

const DEFAULT_PORT = 25565;

const toPort = (value: string | undefined): number => Number(value) || DEFAULT_PORT;

/** Hostname/IP of the Minecraft server the status routes query. */
export const serverAddress = process.env.MC_SERVER_ADDRESS;

/** SLP (TCP) port — the port players connect on. */
export const serverPort = toPort(process.env.MC_SERVER_PORT);

/** Query (UDP) port — set by `query.port` in server.properties. */
export const queryPort = toPort(process.env.MC_QUERY_PORT);

/**
 * The address players type into Minecraft, or `null` when unconfigured. The
 * port is omitted when it's the default 25565, since the client assumes it.
 */
export const connectAddress: string | null = serverAddress
    ? serverPort === DEFAULT_PORT
        ? serverAddress
        : `${serverAddress}:${serverPort}`
    : null;

/**
 * Directory holding the server's player data, or `undefined` when unconfigured. Expected layout:
 *     <dir>/usercache.json           — the player roster
 *     <dir>/stats/<uuid>.json        — one stats file per player
 *     <dir>/advancements/<uuid>.json — one advancements file per player
 */
export const statsDir = process.env.MC_STATS_DIR;

/**
 * Directory holding the server's log files, or `undefined` when unconfigured.
 * This is the server's stock `logs/` directory — no extra tooling writes to it:
 *     <dir>/latest.log              — the current run, plain text
 *     <dir>/<yyyy-mm-dd>-<n>.log.gz — one gzipped file per previous run/day
 */
export const logsDir = process.env.MC_LOGS_DIR;

/**
 * The Minecraft version `npm run build:recipes` pulls its data for — a
 * [mcmeta](https://github.com/misode/mcmeta) release tag, pinned so the build is reproducible.
 */
export const mcVersion = process.env.MC_VERSION;

/** Direct URL to the downloadable client resource pack. */
export const resourcePackUrl = process.env.RESOURCE_PACK_URL;

/**
 * Password for `/admin`, which shows the unfiltered server data. Unset means the
 * page doesn't exist: `src/proxy.ts` refuses the request and the page itself
 * returns a 404, so there is no way to reach it without one.
 */
export const adminPassword = process.env.ADMIN_PASSWORD;

/**
 * The configuration as this module resolved it, for `/admin` to show — the
 * effective value rather than the raw string, since a port that fell back to the
 * default is the question an admin is usually trying to answer.
 */
export const configuration: { name: string; value: string | null; defaulted?: boolean }[] = [
    { name: 'MC_SERVER_ADDRESS', value: serverAddress ?? null },
    { name: 'MC_SERVER_PORT', value: String(serverPort), defaulted: !process.env.MC_SERVER_PORT },
    { name: 'MC_QUERY_PORT', value: String(queryPort), defaulted: !process.env.MC_QUERY_PORT },
    { name: 'MC_STATS_DIR', value: statsDir ?? null },
    { name: 'MC_LOGS_DIR', value: logsDir ?? null },
    { name: 'MC_VERSION', value: mcVersion ?? null },
    { name: 'RESOURCE_PACK_URL', value: resourcePackUrl ?? null },
];
