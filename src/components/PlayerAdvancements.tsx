'use client';

import { useState } from 'react';
import { formatStamp } from '@/lib/datetime';
import { formatCount } from '@/lib/formatting';
import type { AdvancementFrame, AdvancementProgress, AdvancementStep, PlayerAdvancement } from '@/lib/types';

/**
 * Every advancement in the game, marked off against what one player has earned.
 *
 * The list is long by nature — 126 of them — so it reads as one row each, the
 * filter above cuts it to the half you came for, and a category can be folded
 * away. Earned rows keep their colour and their date; the rest are greyed out,
 * with a fraction on the ones that are part-finished.
 *
 * Ten of them are checklists rather than one-off feats — 55 biomes, 40 foods —
 * and those fractions open into the steps themselves, so "19 / 55" can answer
 * which 36 are missing.
 */

/** Sprites live on minecraft.wiki; the generator recorded each icon's real filename. */
const iconUrl = (file: string): string => `https://minecraft.wiki/images/${encodeURI(file)}`;

const ICON_SIZE = 24;

const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'done', label: 'Earned' },
    { key: 'todo', label: 'Remaining' },
] as const;

type Filter = (typeof FILTERS)[number]['key'];

/** Goals and challenges are worth more than a plain task, so they get to say so. */
const FRAMES: Partial<Record<AdvancementFrame, { label: string; className: string }>> = {
    goal: { label: 'Goal', className: 'text-(--color-attention-fg)' },
    challenge: { label: 'Challenge', className: 'text-(--color-done-fg)' },
};

const BUTTON_CLASS =
    'cursor-pointer rounded-md border border-(--color-border) px-2.5 py-1 text-xs font-medium transition-colors hover:bg-(--color-neutral-muted)';

const Meter = ({ share, muted }: { share: number; muted?: boolean }) => (
    <div aria-hidden="true" className="h-1.5 rounded-r-sm bg-(--color-neutral-muted)">
        <div
            className={`h-full rounded-r-sm ${muted ? 'bg-(--color-fg-muted)' : 'bg-(--color-success-fg)'}`}
            style={{ width: `${Math.min(share * 100, 100)}%` }}
        />
    </div>
);

/** The steps of a checklist, ticked ones last: what's left is what you came to find out. */
const Checklist = ({ steps }: { steps: AdvancementStep[] }) => {
    const missing = steps.filter((step) => !step.done);
    const ticked = steps.filter((step) => step.done);

    return (
        <div className="mt-2 space-y-2">
            {[
                { label: 'Still to do', steps: missing, className: 'border-(--color-border) text-(--color-fg)' },
                { label: 'Done', steps: ticked, className: 'border-transparent bg-(--color-success-bg) text-(--color-success-fg)' },
            ]
                .filter((group) => group.steps.length > 0)
                .map((group) => (
                    <div key={group.label}>
                        <h4 className="mb-1! mt-0! text-[11px]! font-semibold uppercase tracking-wide text-(--color-fg-muted)">
                            {group.label} — {group.steps.length}
                        </h4>
                        <ul className="flex list-none! flex-wrap gap-1 pl-0! mb-0!">
                            {group.steps.map((step) => (
                                <li key={step.name} className={`rounded border px-1.5 py-0.5 text-[11px] ${group.className}`}>
                                    {step.name}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
        </div>
    );
};

const Row = ({ advancement }: { advancement: PlayerAdvancement }) => {
    const { done, have, need, completedAt, icon, title, description, frame, hidden, checklist } = advancement;
    const [open, setOpen] = useState(false);

    const frameStyle = FRAMES[frame];
    // A fraction only means something when there is more than one thing to do,
    // and only the unfinished ones have anything left to list.
    const partial = !done && need > 1;

    return (
        <li className={`flex items-start gap-3 py-2 ${done ? '' : 'opacity-60'}`}>
            {icon ? (
                // biome-ignore lint/performance/noImgElement: tiny pixel-art sprites served by minecraft.wiki; next/image would resample and blur them
                <img
                    src={iconUrl(icon)}
                    alt=""
                    width={ICON_SIZE}
                    height={ICON_SIZE}
                    loading="lazy"
                    className={done ? '' : 'grayscale'}
                    style={{ width: ICON_SIZE, height: ICON_SIZE, imageRendering: 'pixelated' }}
                />
            ) : (
                <span aria-hidden="true" className="size-6 rounded bg-(--color-neutral-muted)" />
            )}

            <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold text-(--color-fg)">
                        {title}
                        {frameStyle && <span className={`ml-2 text-[11px] font-medium ${frameStyle.className}`}>{frameStyle.label}</span>}
                        {hidden && <span className="ml-2 text-[11px] text-(--color-fg-muted)">Hidden</span>}
                    </span>
                    {partial && checklist.length > 0 ? (
                        <button
                            type="button"
                            onClick={() => setOpen(!open)}
                            aria-expanded={open}
                            className="shrink-0 cursor-pointer text-xs tabular-nums text-(--color-accent) hover:underline">
                            {have} / {need}
                        </button>
                    ) : (
                        <span className="shrink-0 text-xs tabular-nums text-(--color-fg-muted)">
                            {done && (completedAt === null ? 'Earned' : formatStamp(completedAt))}
                            {partial && `${have} / ${need}`}
                        </span>
                    )}
                </div>
                <p className="mb-0! text-xs text-(--color-fg-muted)">{description}</p>
                {partial && (
                    <div className="mt-1.5">
                        <Meter share={have / need} muted />
                    </div>
                )}
                {open && <Checklist steps={checklist} />}
            </div>
        </li>
    );
};

export const PlayerAdvancements = ({ progress }: { progress: AdvancementProgress }) => {
    const [filter, setFilter] = useState<Filter>('all');

    const matches = (advancement: PlayerAdvancement): boolean => filter === 'all' || (filter === 'done') === advancement.done;

    const share = progress.total > 0 ? progress.done / progress.total : 0;

    return (
        <section>
            <h2>Advancements</h2>

            <div className="mb-4 rounded-lg border border-(--color-border) bg-(--color-canvas-subtle) p-4">
                <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-semibold text-(--color-fg)">
                        {formatCount(progress.done)} of {formatCount(progress.total)} earned
                    </span>
                    <span className="tabular-nums text-(--color-fg-muted)">{Math.round(share * 100)}%</span>
                </div>
                <Meter share={share} />
                <p className="mb-0! mt-2! text-xs text-(--color-fg-muted)">
                    Plus {formatCount(progress.recipes)} recipe unlocks, which the server grants automatically.
                </p>
            </div>

            <div className="mb-4 flex flex-wrap gap-1.5">
                {FILTERS.map(({ key, label }) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => setFilter(key)}
                        aria-pressed={filter === key}
                        className={`${BUTTON_CLASS} ${filter === key ? 'bg-(--color-neutral-muted) text-(--color-fg)' : 'text-(--color-fg-muted)'}`}>
                        {label}
                    </button>
                ))}
            </div>

            {progress.categories.map((category) => {
                const entries = category.entries.filter(matches);

                return (
                    <details key={category.key} open className="mb-3 rounded-lg border border-(--color-border) px-4 py-3">
                        <summary className="cursor-pointer text-sm font-semibold text-(--color-fg)">
                            {category.title}
                            <span className="ml-2 font-normal tabular-nums text-(--color-fg-muted)">
                                {category.done} / {category.total}
                            </span>
                        </summary>

                        {entries.length === 0 ? (
                            <p className="mb-0! mt-2! text-sm text-(--color-fg-muted)">
                                {filter === 'done' ? 'Nothing earned here yet.' : 'All done — nothing left in this one.'}
                            </p>
                        ) : (
                            <ul className="list-none! divide-y divide-(--color-border-muted) pl-0! mb-0! mt-1">
                                {entries.map((advancement) => (
                                    <Row key={advancement.id} advancement={advancement} />
                                ))}
                            </ul>
                        )}
                    </details>
                );
            })}
        </section>
    );
};
