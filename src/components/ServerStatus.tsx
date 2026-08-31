'use client';

import useSWR from 'swr';
import { CopyField } from '@/components/CopyField';
import type { ServerStatus } from '@/lib/types';

const fetcher = (url: string) =>
    fetch(url).then((r) => {
        if (!r.ok) throw new Error(`Request failed: ${r.status}`);
        return r.json() as Promise<ServerStatus>;
    });

const Badge = ({ online }: { online: boolean }) => {
    const color = online
        ? 'text-[var(--color-success-fg)] bg-[var(--color-success-bg)]'
        : 'text-[var(--color-danger-fg)] bg-[var(--color-danger-bg)]';

    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-medium ${color}`}>
            <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
            {online ? 'Online' : 'Offline'}
        </span>
    );
};

const ServerStatusView = ({ connectAddress }: { connectAddress?: string | null }) => {
    const { data, error, isLoading } = useSWR<ServerStatus>('/api/status', fetcher, {
        refreshInterval: 30_000, // poll every 30s
        revalidateOnFocus: true,
    });

    if (isLoading && !data) {
        return <p className="text-(--color-fg-muted)">Loading server status…</p>;
    }

    if (error && !data) {
        return <p className="text-(--color-danger-fg)">Failed to load server status. Please try again later.</p>;
    }

    if (!data) return null;

    const updated = new Date(data.timestamp).toLocaleTimeString();

    return (
        <div className="markdown-body">
            <h2>Status</h2>

            <div className="mb-4 flex flex-wrap items-center gap-3">
                <Badge online={data.online} />
                {connectAddress ? (
                    <div className="min-w-0 max-w-64 flex-1">
                        <CopyField content={connectAddress} />
                    </div>
                ) : (
                    <code>{data.hostname}</code>
                )}
            </div>

            <table>
                <tbody>
                    <tr>
                        {data.icon && (
                            <td rowSpan={4} className="align-middle">
                                {/* biome-ignore lint/performance/noImgElement: icon is a base64 data URI, not suited to next/image */}
                                <img src={data.icon} alt={`${data.hostname} server icon`} width={64} height={64} className="rounded" />
                            </td>
                        )}
                        <th>Players</th>
                        <td>{data.online ? `${data.players.online} / ${data.players.max}` : '—'}</td>
                    </tr>
                    <tr>
                        <th>Version</th>
                        <td>{data.version ?? '—'}</td>
                    </tr>
                    <tr>
                        <th>Gametype</th>
                        <td>{data.gametype ?? '—'}</td>
                    </tr>
                    <tr>
                        <th>MOTD</th>
                        <td>
                            {data.motd.length > 0
                                ? data.motd.map((line, i) => (
                                      // biome-ignore lint/suspicious/noArrayIndexKey: MOTD is a fixed, display-only list with no stable id
                                      <span key={`motd${i}`} className="block">
                                          {line}
                                      </span>
                                  ))
                                : '—'}
                        </td>
                    </tr>
                </tbody>
            </table>

            {data.online && data.players.list.length > 0 && (
                <>
                    <h3>Online now</h3>
                    <ul>
                        {data.players.list.map((name) => (
                            <li key={name}>
                                <code>{name}</code>
                            </li>
                        ))}
                    </ul>
                </>
            )}

            <p className="text-sm text-(--color-fg-muted)">Last updated at {updated}. Refreshes automatically every 30 seconds.</p>
        </div>
    );
};

export default ServerStatusView;
