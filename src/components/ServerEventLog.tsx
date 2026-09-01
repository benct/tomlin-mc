import type { ServerEvent, ServerEventType } from '@/lib/types';

/** Dot colour and screen-reader label per event type. */
const STYLES: Record<ServerEventType, { dot: string; label: string }> = {
    join: { dot: 'bg-(--color-success-fg)', label: 'Joined' },
    leave: { dot: 'bg-(--color-fg-muted)', label: 'Left' },
    death: { dot: 'bg-(--color-danger-fg)', label: 'Death' },
    advancement: { dot: 'bg-(--color-accent)', label: 'Advancement' },
};

const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
const day = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

/** Groups events into consecutive runs sharing a calendar day, preserving order. */
const byDay = (events: ServerEvent[]): { label: string; events: ServerEvent[] }[] => {
    const days: { label: string; events: ServerEvent[] }[] = [];

    for (const event of events) {
        const label = day.format(event.timestamp);
        const current = days.at(-1);
        if (current?.label === label) current.events.push(event);
        else days.push({ label, events: [event] });
    }

    return days;
};

export const ServerEventLog = ({ events }: { events: ServerEvent[] }) => (
    <div className="rounded-lg border border-(--color-border) bg-(--color-canvas-subtle) p-4">
        {byDay(events).map((group) => (
            <section key={group.label} className="mt-4 first:mt-0">
                <h3 className="mt-0! text-xs! font-semibold uppercase tracking-wide text-(--color-fg-muted)">{group.label}</h3>
                <ul className="list-none! space-y-1 pl-0! mb-0!">
                    {group.events.map((event) => {
                        const style = STYLES[event.type];
                        return (
                            <li key={event.id} className="flex items-baseline gap-2.5 text-sm">
                                <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${style.dot}`} />
                                <span className="sr-only">{style.label}:</span>
                                <time
                                    dateTime={new Date(event.timestamp).toISOString()}
                                    className="shrink-0 tabular-nums text-xs text-(--color-fg-muted)">
                                    {time.format(event.timestamp)}
                                </time>
                                <span className="min-w-0 text-(--color-fg)">
                                    <span className="font-semibold">{event.player} </span>
                                    <span className="text-(--color-fg-muted)">{event.text}</span>
                                </span>
                            </li>
                        );
                    })}
                </ul>
            </section>
        ))}
    </div>
);
