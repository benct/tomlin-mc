import { NextResponse } from 'next/server';
import { queryPort, serverAddress, serverPort } from '@/lib/env';
import { pingServer } from '@/lib/mcping';
import { queryServer } from '@/lib/mcquery';
import type { ServerStatus } from '@/lib/serverStatus';

/**
 * Base status route. Queries the live server via BOTH the SLP (TCP) and Query
 * (UDP) protocols in parallel and merges the results into a single object,
 * prioritizing Query data where both are present. Query provides the complete
 * player list; SLP provides the server icon, which Query lacks.
 */

// Don't cache at the framework level; SWR handles client-side refresh cadence.
export const dynamic = 'force-dynamic';

// Flatten a chat-component MOTD (or legacy string) into plain text lines.
export const flattenMotd = (description: unknown): string[] => {
    const collect = (node: unknown): string => {
        if (node == null) return '';
        if (typeof node === 'string') return node;
        if (Array.isArray(node)) return node.map(collect).join('');
        if (typeof node === 'object') {
            const obj = node as { text?: string; extra?: unknown };
            return (obj.text ?? '') + (obj.extra ? collect(obj.extra) : '');
        }
        return '';
    };
    // Strip Minecraft "§x" color/format codes, then split into lines.
    return collect(description)
        .replace(/§[0-9a-fk-or]/gi, '')
        .split('\n')
        .map((line) => line.trimEnd())
        .filter((line) => line.length > 0);
};

const settled = <T>(result: PromiseSettledResult<T>): T | null => (result.status === 'fulfilled' ? result.value : null);

export async function GET() {
    const fetchedAt = Date.now();

    if (!serverAddress) {
        console.log('[Error] MC_SERVER_ADDRESS is not set');
        return NextResponse.json({ error: 'Server address is not configured.' }, { status: 500 });
    }

    const [pingResult, queryResult] = await Promise.allSettled([
        pingServer(serverAddress, serverPort),
        queryServer(serverAddress, queryPort),
    ]);

    const ping = settled(pingResult);
    const query = settled(queryResult);

    if (pingResult.status === 'rejected') {
        console.log(`[Error] SLP ${serverAddress}:${serverPort}: ${String(pingResult.reason)}`);
    }
    if (queryResult.status === 'rejected') {
        console.log(`[Error] Query ${serverAddress}:${queryPort}: ${String(queryResult.reason)}`);
    }

    if (!ping && !query) {
        const offline: ServerStatus = {
            hostname: serverAddress,
            port: serverPort,
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
        hostname: serverAddress,
        port: query?.hostport ?? serverPort,
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
