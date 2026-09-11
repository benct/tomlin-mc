'use client';

import { useState } from 'react';
import { formatCount } from '@/lib/formatting';
import type { Breakdown } from '@/lib/types';

/**
 * One whole stats category for a player — every block they've mined, every mob
 * that's killed them — ranked biggest first.
 *
 * A category can run to a couple of hundred entries, and the long tail is all
 * ones and twos, so only the head is shown until asked. Bars are relative to the
 * category's own leader, which is what makes "mostly stone, then dirt" readable
 * at a glance.
 */

/** How many rows to show before the reader has to ask for the rest. */
const PREVIEW = 8;

/** Keeps a nonzero-but-tiny count visible as a sliver rather than nothing at all. */
const MIN_BAR_PERCENT = 2;

export const StatBreakdown = ({ breakdown }: { breakdown: Breakdown }) => {
    const [expanded, setExpanded] = useState(false);

    const entries = expanded ? breakdown.entries : breakdown.entries.slice(0, PREVIEW);
    const hidden = breakdown.entries.length - entries.length;

    return (
        <section className="rounded-lg border border-(--color-border) bg-(--color-canvas-subtle) p-4">
            <h3 className="mb-1! mt-0! text-sm! font-semibold text-(--color-fg)">
                {breakdown.title}
                <span className="ml-2 font-normal tabular-nums text-(--color-fg-muted)">{formatCount(breakdown.total)}</span>
            </h3>
            <p className="mb-3! text-xs text-(--color-fg-muted)">{breakdown.note}</p>

            <ol className="space-y-2.5 mb-0!">
                {entries.map((entry) => (
                    <li key={entry.id}>
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="truncate text-(--color-fg)">{entry.name}</span>
                            <span className="shrink-0 tabular-nums text-(--color-fg-muted)">{formatCount(entry.value)}</span>
                        </div>
                        <div aria-hidden="true" className="mt-1.5 h-1.5 rounded-r-sm bg-(--color-neutral-muted)">
                            <div
                                className="h-full rounded-r-sm bg-(--color-accent)"
                                style={{ width: `${Math.max(entry.share * 100, MIN_BAR_PERCENT)}%` }}
                            />
                        </div>
                    </li>
                ))}
            </ol>

            {(hidden > 0 || expanded) && (
                <button
                    type="button"
                    onClick={() => setExpanded(!expanded)}
                    className="mt-3 cursor-pointer text-xs font-medium text-(--color-accent) hover:underline">
                    {expanded ? 'Show less' : `Show all ${formatCount(breakdown.entries.length)}`}
                </button>
            )}
        </section>
    );
};
