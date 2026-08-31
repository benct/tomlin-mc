import type { Metadata } from 'next';
import { StatLeaderboard } from '@/components/StatLeaderboard';
import { StatTile } from '@/components/StatTile';
import { formatCount, formatDuration } from '@/lib/formatStats';
import { loadStats } from '@/lib/stats';

export const metadata: Metadata = {
    title: '[KOK] Minecraft Server — Stats',
    description: 'Player statistics and advancements for the Minecraft server.',
};

// The server rewrites the stats files as players play, so re-read them at most
// once every 5 minutes rather than baking the numbers in at build time.
export const revalidate = 300;

const Stats = async () => {
    const statistics = await loadStats();

    if (!statistics) {
        return (
            <div className="markdown-body">
                <h1>Player Stats</h1>
                <p className="text-(--color-fg-muted)">
                    Player stats aren't configured — set <code>MC_STATS_DIR</code> to the server's player data directory.
                </p>
            </div>
        );
    }

    const { players, groups, totals } = statistics;

    if (players.length === 0) {
        return (
            <div className="markdown-body">
                <h1>Player Stats</h1>
                <p className="text-(--color-fg-muted)">No player stats yet — they'll appear here once someone has played.</p>
            </div>
        );
    }

    return (
        <div className="markdown-body">
            <h1>Player Stats</h1>

            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatTile label="Time played" value={formatDuration(totals.playTime)} />
                <StatTile label="Advancements earned" value={formatCount(totals.advancements)} />
                <StatTile label="Blocks mined" value={formatCount(totals.mined)} />
                <StatTile label="Mobs killed" value={formatCount(totals.mobKills)} />
                <StatTile label="Deaths" value={formatCount(totals.deaths)} />
                <StatTile label="Players" value={formatCount(players.length)} />
            </dl>

            {groups.map((group) => (
                <section key={group.title} className="space-y-4 mb-8">
                    <h2 className="border-b border-(--color-border-muted) pb-[0.3em] text-2xl font-semibold text-(--color-fg)">
                        {group.title}
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                        {group.boards.map((board) => (
                            <StatLeaderboard key={board.id} board={board} />
                        ))}
                    </div>
                </section>
            ))}

            <p className="text-sm text-(--color-fg-muted)">
                Advancement counts exclude recipe unlocks, which the server grants automatically. Damage is shown in health points — two per
                heart. Updates at most once every 5 minutes.
            </p>
        </div>
    );
};

export default Stats;
