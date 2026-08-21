import { NextResponse } from 'next/server';
import { flattenMotd } from '@/lib/flattenMotd';
import { pingServer } from '@/lib/mcping';
import { queryServer } from '@/lib/mcquery';
import type { ServerStatus } from '@/lib/types';

/**
 * Base status route. Queries the live server via BOTH the SLP (TCP) and Query
 * (UDP) protocols in parallel and merges the results into a single object,
 * prioritizing Query data where both are present. Query provides the complete
 * player list; SLP provides the server icon, which Query lacks.
 */

const SERVER_ADDRESS = process.env.MC_SERVER_ADDRESS;
const DEFAULT_PORT = 25565;
const SERVER_PORT = Number(process.env.MC_SERVER_PORT ?? DEFAULT_PORT);
const QUERY_PORT = Number(process.env.MC_QUERY_PORT ?? DEFAULT_PORT);

// Don't cache at the framework level; SWR handles client-side refresh cadence.
export const dynamic = 'force-dynamic';

const settled = <T>(result: PromiseSettledResult<T>): T | null => (result.status === 'fulfilled' ? result.value : null);

export async function GET() {
    const fetchedAt = Date.now();

    if (!SERVER_ADDRESS) {
        console.log('[Error] MC_SERVER_ADDRESS is not set');
        return NextResponse.json({ error: 'Server address is not configured.' }, { status: 500 });
    }

    const [pingResult, queryResult] = await Promise.allSettled([
        pingServer(SERVER_ADDRESS, SERVER_PORT),
        queryServer(SERVER_ADDRESS, QUERY_PORT),
    ]);

    const ping = settled(pingResult);
    const query = settled(queryResult);

    if (pingResult.status === 'rejected') {
        console.log(`[Error] SLP ${SERVER_ADDRESS}:${SERVER_PORT}: ${String(pingResult.reason)}`);
    }
    if (queryResult.status === 'rejected') {
        console.log(`[Error] Query ${SERVER_ADDRESS}:${QUERY_PORT}: ${String(queryResult.reason)}`);
    }

    if (!ping && !query) {
        const offline: ServerStatus = {
            hostname: SERVER_ADDRESS,
            port: SERVER_PORT,
            online: false,
            version: null,
            gametype: null,
            motd: [],
            icon: null,
            players: { online: 0, max: 0, list: [] },
            timestamp: fetchedAt,
        };
        return NextResponse.json(offline);
    }

    const status: ServerStatus = {
        hostname: SERVER_ADDRESS,
        port: query?.hostport ?? SERVER_PORT,
        online: true,
        version: query?.version ?? ping?.version?.name ?? null,
        gametype: query?.gametype ?? null,
        motd: flattenMotd(query?.motd ?? ping?.description) ?? [],
        icon: ping?.favicon ?? null,
        players: {
            online: query?.numplayers ?? ping?.players?.online ?? 0,
            max: query?.maxplayers ?? ping?.players?.max ?? 0,
            list: query?.players.length ? query.players : (ping?.players?.sample?.map((p) => p.name) ?? []),
        },
        timestamp: fetchedAt,
    };

    return NextResponse.json(status);
}
