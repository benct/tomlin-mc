import type { StatUnit } from '@/lib/types';

/**
 * Renders raw Minecraft stat counters as human-readable strings.
 *
 * The server stores most stats in awkward base units — playtime in ticks,
 * travel in centimetres, damage in tenths of a health point — so each unit gets
 * its own formatter. The locale is pinned so server and client agree.
 */

const TICKS_PER_SECOND = 20;
const MINUTES_PER_DAY = 1440;
const CM_PER_METRE = 100;
const METRES_PER_KM = 1000;
/** Damage stats are stored multiplied by ten. */
const HEALTH_SCALE = 10;

const decimal = new Intl.NumberFormat('en-GB');
const oneDecimal = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** A plain tally, thousands-separated. */
export const formatCount = (value: number): string => decimal.format(Math.round(value));

/** Ticks as a coarse duration — the largest two units only (`3d 2h`, `14h 55m`, `7m`). */
export const formatDuration = (ticks: number): string => {
    const totalMinutes = Math.floor(ticks / TICKS_PER_SECOND / 60);
    const days = Math.floor(totalMinutes / MINUTES_PER_DAY);
    const hours = Math.floor((totalMinutes % MINUTES_PER_DAY) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) return `${decimal.format(days)}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
};

/** Centimetres as metres below a kilometre, kilometres above it. */
export const formatDistance = (cm: number): string => {
    const metres = cm / CM_PER_METRE;
    return metres >= METRES_PER_KM ? `${oneDecimal.format(metres / METRES_PER_KM)} km` : `${decimal.format(Math.round(metres))} m`;
};

/** Tenths of a health point as whole health points (two per heart). */
export const formatHealth = (tenths: number): string => `${decimal.format(Math.round(tenths / HEALTH_SCALE))} HP`;

/** Formats a value according to its stat's unit. */
export const formatStat = (value: number, unit: StatUnit): string => {
    switch (unit) {
        case 'duration':
            return formatDuration(value);
        case 'distance':
            return formatDistance(value);
        case 'health':
            return formatHealth(value);
        default:
            return formatCount(value);
    }
};
