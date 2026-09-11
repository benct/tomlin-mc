import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PlayerAdvancements } from '@/components/PlayerAdvancements';
import { StatBreakdown } from '@/components/StatBreakdown';
import { StatTile } from '@/components/StatTile';
import { mcVersion } from '@/lib/env';
import { formatCount, formatDistance, formatDuration, formatStat } from '@/lib/formatting';
import { findPlayer, listPlayers, loadPlayer } from '@/lib/player';
import type { StatSection } from '@/lib/types';

// The server rewrites these files as players play, so re-read them at most once
// every 5 minutes rather than baking them in at build time.
export const revalidate = 300;

export const generateStaticParams = async () => (await listPlayers()).map(({ name }) => ({ player: name }));

export const generateMetadata = async ({ params }: PageProps<'/stats/[player]'>): Promise<Metadata> => {
    const player = await findPlayer((await params).player);

    return {
        title: player ? `[KOK] Minecraft Server — ${player.name}` : '[KOK] Minecraft Server — Player Not Found',
        description: player ? `Statistics and advancements for ${player.name}.` : undefined,
        robots: { index: false, follow: false },
    };
};

const Section = ({ section }: { section: StatSection }) => (
    <section className="rounded-lg border border-(--color-border) bg-(--color-canvas-subtle) p-4">
        <h3 className="mb-2 mt-0! text-sm! font-semibold text-(--color-fg)">{section.title}</h3>
        <dl className="grid gap-x-6 sm:grid-cols-2">
            {section.rows.map((row) => (
                <div
                    key={row.key}
                    className="flex items-baseline justify-between gap-3 border-b border-(--color-border-muted) py-1.5 text-sm last:border-0">
                    <dt className="truncate text-(--color-fg-muted)">{row.label}</dt>
                    <dd className="shrink-0 tabular-nums text-(--color-fg)">{formatStat(row.value, row.unit)}</dd>
                </div>
            ))}
        </dl>
    </section>
);

const Player = async ({ params }: PageProps<'/stats/[player]'>) => {
    const player = await loadPlayer((await params).player);

    if (!player) notFound();

    const { totals, advancements } = player;

    return (
        <div className="markdown-body">
            <h1>{player.name}</h1>

            <p className="text-(--color-fg-muted)">
                <Link href="/stats">← All players and leaderboards</Link>
            </p>

            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatTile label="Advancements" value={`${formatCount(advancements.done)} / ${formatCount(advancements.total)}`} />
                <StatTile label="Blocks mined" value={formatCount(totals.mined)} />
                <StatTile label="Diamond ore mined" value={formatCount(totals.diamonds)} />
                <StatTile label="Mobs killed" value={formatCount(totals.mobKills)} />
                <StatTile label="Deaths" value={formatCount(totals.deaths)} />
                <StatTile
                    label="Survival streak"
                    value={totals.survivalStreak === null ? 'Never died' : formatDuration(totals.survivalStreak)}
                />
                <StatTile label="Distance travelled" value={formatDistance(totals.distance)} />
                <StatTile label="Most-used item" value={player.favourite?.name ?? 'Nothing yet'} />
                <StatTile label="Nemesis" value={player.nemesis?.name ?? 'Nobody yet'} />
            </dl>

            <PlayerAdvancements progress={advancements} />

            <section>
                <h2>Statistics</h2>
                <div className="grid gap-4">
                    {player.sections.map((section) => (
                        <Section key={section.title} section={section} />
                    ))}
                </div>
            </section>

            <section className="mb-4">
                <h2>Blocks, Items and Mobs</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                    {player.breakdowns.map((breakdown) => (
                        <StatBreakdown key={breakdown.key} breakdown={breakdown} />
                    ))}
                </div>
            </section>

            <p className="text-sm text-(--color-fg-muted)">
                Advancement counts exclude recipe unlocks, which the server grants automatically. Damage is shown in health points — two per
                heart. Dates are shown in server time (Europe/Oslo). Updates at most once every 5 minutes.
            </p>

            <p className="text-sm text-(--color-fg-muted)">
                Advancement list extracted from Minecraft {mcVersion} by{' '}
                <a href="https://github.com/misode/mcmeta" target="_blank" rel="noopener noreferrer">
                    mcmeta
                </a>
                . Item sprites from{' '}
                <a href="https://minecraft.wiki/" target="_blank" rel="noopener noreferrer">
                    minecraft.wiki
                </a>
                , used under{' '}
                <a href="https://creativecommons.org/licenses/by-nc-sa/3.0/" target="_blank" rel="noopener noreferrer">
                    CC BY-NC-SA 3.0
                </a>
                .
            </p>
        </div>
    );
};

export default Player;
