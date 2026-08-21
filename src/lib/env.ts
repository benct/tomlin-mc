/**
 * Centralized access to environment variables.
 *
 * All of these are server-only (no `NEXT_PUBLIC_` prefix), so this module must
 * only be imported from server components, route handlers, or other server code.
 */

const DEFAULT_PORT = 25565;

const toPort = (value: string | undefined): number => Number(value ?? DEFAULT_PORT);

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

/** Direct URL to the downloadable client resource pack. */
export const resourcePackUrl = process.env.RESOURCE_PACK_URL;
