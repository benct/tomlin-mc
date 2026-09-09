'use client';

import type { ReactNode } from 'react';
import { StatusBadge } from '@/components/ServerStatus';
import { useServerStatus } from '@/lib/serverStatus';

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
    <div className="col-span-2 grid grid-cols-subgrid">
        <dt className="text-(--color-fg-muted)">{label}</dt>
        <dd className="min-w-0 wrap-break-word">{children}</dd>
    </div>
);

const Empty = () => <span className="text-(--color-fg-muted)">—</span>;

export const AdminStatus = () => {
    const { data, error, isLoading } = useServerStatus();

    return (
        <section>
            <h2 className="flex flex-wrap items-center gap-3">
                Status
                {data && <StatusBadge online={data?.online} />}
            </h2>

            {isLoading && !data && <p className="text-(--color-fg-muted)">Loading server status…</p>}
            {error && !data && <p className="text-(--color-danger-fg)">Failed to load server status.</p>}

            {data && (
                <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[max-content_1fr_max-content_1fr] sm:gap-x-8">
                    <Field label="Host">
                        <code className="text-xs">
                            {data.hostname}:{data.port}
                        </code>
                    </Field>
                    <Field label="Players">
                        <span className="tabular-nums">
                            {data.players.online} / {data.players.max}
                        </span>
                    </Field>
                    <Field label="Version">{data.version ?? <Empty />}</Field>
                    <Field label="Online now">
                        {data.players.list.length === 0 ? (
                            <span className="text-(--color-fg-muted)">nobody</span>
                        ) : (
                            <span className="flex flex-wrap gap-1.5">
                                {data.players.list.map((name) => (
                                    <code key={name} className="text-xs">
                                        {name}
                                    </code>
                                ))}
                            </span>
                        )}
                    </Field>
                    <Field label="Gametype">{data.gametype ?? <Empty />}</Field>
                    <Field label="MOTD">
                        {data.motd.length === 0 ? (
                            <Empty />
                        ) : (
                            data.motd.map((line) => (
                                <span key={line} className="block">
                                    {line}
                                </span>
                            ))
                        )}
                    </Field>
                </dl>
            )}
        </section>
    );
};
