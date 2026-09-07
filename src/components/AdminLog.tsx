import { LOG_STYLES, ServerLog } from '@/components/ServerLog';
import type { AdminLog } from '@/lib/admin';
import { LOG_FILTERS } from '@/lib/types';

const count = (value: number): string => value.toLocaleString('en-GB');

const hrefFor = (keys: string[]): string => (keys.length === 0 ? '/admin' : `/admin?type=${keys.join(',')}`);

const toggle = (key: string, selected: string[]): string =>
    hrefFor(selected.includes(key) ? selected.filter((each) => each !== key) : [...selected, key]);

const CHIP = 'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs no-underline! transition-colors';
const ON = `${CHIP} border-(--color-accent) bg-(--color-neutral-muted) font-semibold text-(--color-fg)!`;
const OFF = `${CHIP} border-(--color-border) text-(--color-fg-muted)! hover:bg-(--color-neutral-muted)`;

const Filters = ({ log }: { log: AdminLog }) => {
    const present = LOG_FILTERS.filter((filter) => log.counts[filter.key]);
    const all = present.every((filter) => log.filters.includes(filter.key));

    return (
        // Plain anchors, not <Link>: a full load is guaranteed to carry the Basic auth header.
        <nav aria-label="Filter the log by type" className="mb-3 flex flex-wrap items-center gap-1.5">
            <a href={hrefFor(present.map((filter) => filter.key))} aria-current={all ? 'true' : undefined} className={all ? ON : OFF}>
                All <span className="tabular-nums">{count(log.total)}</span>
            </a>
            {present.map((filter) => {
                const active = log.filters.includes(filter.key);
                return (
                    <a
                        key={filter.key}
                        href={toggle(filter.key, log.filters)}
                        aria-current={active ? 'true' : undefined}
                        className={active ? ON : OFF}>
                        {/* A group covering more than one type shows a dot for each, so the chip says which. */}
                        {filter.types.map((type) => (
                            <span key={type} aria-hidden="true" className={`size-2 shrink-0 rounded-full ${LOG_STYLES[type].dot}`} />
                        ))}
                        {filter.label} <span className="tabular-nums">{count(log.counts[filter.key] ?? 0)}</span>
                    </a>
                );
            })}
        </nav>
    );
};

export const AdminLogView = ({ log }: { log: AdminLog }) => (
    <section>
        <h2>Server log</h2>

        <Filters log={log} />

        <p className="text-sm text-(--color-fg-muted)">
            Newest first. Showing {count(log.entries.length)} of {count(log.matched)} entries across {log.files.length}{' '}
            {log.files.length === 1 ? 'file' : 'files'} ({log.files.at(0)} … {log.files.at(-1)}).
        </p>

        {log.entries.length === 0 ? (
            <p className="text-(--color-fg-muted)">
                {log.total === 0 ? 'The logs hold nothing recognisable.' : 'Nothing of that type in the logs.'}
            </p>
        ) : (
            <ServerLog entries={log.entries} />
        )}
    </section>
);
