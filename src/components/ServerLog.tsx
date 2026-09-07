import { formatClock, formatDay } from '@/lib/datetime';
import type { LogEntry, LogType } from '@/lib/types';

export const LOG_STYLES: Record<LogType, { dot: string; label: string }> = {
    join: { dot: 'bg-(--color-fg)', label: 'Joined' },
    leave: { dot: 'bg-(--color-fg-muted)', label: 'Left' },
    death: { dot: 'bg-(--color-danger-fg)', label: 'Death' },
    advancement: { dot: 'bg-(--color-success-fg)', label: 'Advancement' },
    chat: { dot: 'bg-(--color-accent)', label: 'Chat' },
    server: { dot: 'bg-(--color-done-fg)', label: 'Server' },
    warn: { dot: 'bg-(--color-attention-fg)', label: 'Warning' },
    error: { dot: 'bg-(--color-danger-fg)', label: 'Error' },
};

// Groups entries into consecutive runs sharing a calendar day, preserving order.
const byDay = (entries: LogEntry[]): { label: string; entries: LogEntry[] }[] => {
    const days: { label: string; entries: LogEntry[] }[] = [];

    for (const entry of entries) {
        const label = formatDay(entry.timestamp);
        const current = days.at(-1);
        if (current?.label === label) current.entries.push(entry);
        else days.push({ label, entries: [entry] });
    }

    return days;
};

export const ServerLog = ({ entries }: { entries: LogEntry[] }) => (
    <div className="rounded-lg border border-(--color-border) bg-(--color-canvas-subtle) p-4">
        {byDay(entries).map((group) => (
            <section key={group.label} className="mt-4 first:mt-0">
                <h3 className="mt-0! text-xs! font-semibold uppercase tracking-wide text-(--color-fg-muted)">{group.label}</h3>
                <ul className="list-none! space-y-1 pl-0! mb-0!">
                    {group.entries.map((entry) => {
                        const style = LOG_STYLES[entry.type];
                        return (
                            <li key={entry.id} className="flex items-baseline gap-2.5 text-sm">
                                <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${style.dot}`} />
                                {/* Player lines say who; the server's own say what kind, in the same slot. */}
                                {entry.player ? <span className="sr-only">{style.label}:</span> : null}
                                <time
                                    dateTime={new Date(entry.timestamp).toISOString()}
                                    className="shrink-0 tabular-nums text-xs text-(--color-fg-muted)">
                                    {formatClock(entry.timestamp)}
                                </time>
                                <span className="min-w-0 text-(--color-fg)">
                                    <span className="font-semibold">{entry.player ?? style.label} </span>
                                    <span className="break-words text-(--color-fg-muted)">{entry.text}</span>
                                </span>
                            </li>
                        );
                    })}
                </ul>
            </section>
        ))}
    </div>
);
