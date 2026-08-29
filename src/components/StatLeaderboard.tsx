import { formatStat } from '@/lib/formatStats';
import type { Leaderboard } from '@/lib/types';

/**
 * A top list for one stat: players ranked high-to-low, each with a bar showing
 * their share of the leader's score.
 *
 * One measure per card, so every bar wears the same accent hue and no legend is
 * needed — rank, name, and value are all text, and the bars only add a sense of
 * the gaps between players.
 */

/** Keeps a nonzero-but-tiny score visible as a sliver rather than nothing at all. */
const MIN_BAR_PERCENT = 2;

export const StatLeaderboard = ({ board }: { board: Leaderboard }) => {
    // With a single scorer there is nothing to compare against, and a lone
    // full-width bar would just be a one-bar chart. The number says it all.
    const showBars = board.entries.length > 1;

    return (
        <section className="rounded-lg border border-(--color-border) bg-(--color-canvas-subtle) p-4">
            <h3 className="mb-3 mt-0! text-sm! font-semibold text-(--color-fg)">{board.label}</h3>
            <ol className="space-y-2.5 mb-0!">
                {board.entries.map((entry, index) => (
                    <li key={entry.uuid}>
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="flex min-w-0 items-baseline gap-2">
                                <span className="text-xs tabular-nums text-(--color-fg-muted)">{index + 1}</span>
                                <span className="truncate text-(--color-fg)">{entry.name}</span>
                            </span>
                            <span className="shrink-0 tabular-nums text-(--color-fg-muted)">{formatStat(entry.value, board.unit)}</span>
                        </div>
                        {showBars && (
                            <div aria-hidden="true" className="mt-1.5 h-1.5 rounded-r-[4px] bg-(--color-neutral-muted)">
                                <div
                                    className="h-full rounded-r-[4px] bg-(--color-accent)"
                                    style={{ width: `${Math.max(entry.share * 100, MIN_BAR_PERCENT)}%` }}
                                />
                            </div>
                        )}
                    </li>
                ))}
            </ol>
        </section>
    );
};
