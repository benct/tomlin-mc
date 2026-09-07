/**
 * Date and time formatting shared by the pages that show server activity.
 *
 * Everything the server writes is an absolute instant; these render it in the
 * server's own timezone, which is the one an admin reading a log or a player
 * reading the stats page is thinking in. The locale is pinned too, so what you see
 * doesn't depend on the locale of whatever host is rendering.
 */

export const DISPLAY_TIMEZONE = 'Europe/Oslo';

const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: DISPLAY_TIMEZONE });

const day = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: DISPLAY_TIMEZONE });

const stamp = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: DISPLAY_TIMEZONE,
});

const relative = new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' });

/** `14:32` */
export const formatClock = (timestamp: number): string => clock.format(timestamp);

/** `Sunday 6 September` */
export const formatDay = (timestamp: number): string => day.format(timestamp);

/** `06 Sep 2026, 14:32` */
export const formatStamp = (timestamp: number): string => stamp.format(timestamp);

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 365 * 24 * 60 * 60_000],
    ['month', 30 * 24 * 60 * 60_000],
    ['day', 24 * 60 * 60_000],
    ['hour', 60 * 60_000],
    ['minute', 60_000],
];

/** `3 days ago`, `yesterday`, `now` — coarse by design; the exact stamp sits next to it. */
export const formatAgo = (timestamp: number, now: number = Date.now()): string => {
    const elapsed = timestamp - now;

    for (const [unit, ms] of UNITS) {
        const count = Math.round(elapsed / ms);
        if (count !== 0) return relative.format(count, unit);
    }

    return 'just now';
};
