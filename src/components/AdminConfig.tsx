import { configuration } from '@/lib/env';

export const AdminConfig = () => (
    <section>
        <h2>Configuration</h2>

        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm">
            {configuration.map(({ name, value, defaulted }) => (
                <div key={name} className="col-span-2 grid grid-cols-subgrid">
                    <dt className="text-(--color-fg-muted)">
                        <code className="text-xs">{name}</code>
                    </dt>
                    <dd className="min-w-0 self-center break-all">
                        {value === null ? (
                            <span className="text-(--color-fg-muted)">not set</span>
                        ) : (
                            <>
                                <code className="text-xs">{value}</code>
                                {defaulted && <span className="ml-1.5 text-xs text-(--color-fg-muted)">default</span>}
                            </>
                        )}
                    </dd>
                </div>
            ))}
        </dl>
    </section>
);
