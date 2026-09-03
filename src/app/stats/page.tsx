import type { Metadata } from 'next';
import { ServerEventLog } from '@/components/ServerEventLog';
import { StatLeaderboard } from '@/components/StatLeaderboard';
import { StatTile } from '@/components/StatTile';
import { loadEvents } from '@/lib/events';
import { formatCount, formatDuration } from '@/lib/formatStats';
import { loadStats } from '@/lib/stats';
import type { ServerEvent } from '@/lib/types';

export const metadata: Metadata = {
    title: '[KOK] Minecraft Server — Stats',
    description: 'Player statistics, advancements and activity for the Minecraft server.',
    robots: { index: false, follow: false },
};

// The server rewrites the stats files and appends to its logs as players play, so re-read both at most
// once every 5 minutes rather than baking them in at build time.
export const revalidate = 300;

const Activity = ({ events }: { events: ServerEvent[] | null }) => (
    <section className="mb-4">
        <h2>Recent Activity</h2>
        {events === null ? (
            <p className="text-(--color-fg-muted)">
                The event log isn't configured — set <code>MC_LOGS_DIR</code> to the server's <code>logs</code> directory.
            </p>
        ) : events.length === 0 ? (
            <p className="text-(--color-fg-muted)">Nothing has happened on the server recently.</p>
        ) : (
            <ServerEventLog events={events} />
        )}
    </section>
);

const Stats = async () => {
    const [statistics, events] = await Promise.all([loadStats(), loadEvents()]);

    if (!statistics) {
        return (
            <div className="markdown-body">
                <h1>Player Stats</h1>
                <p className="text-(--color-fg-muted)">
                    Player stats aren't configured — set <code>MC_STATS_DIR</code> to the server's player data directory.
                </p>
                <Activity events={events} />
            </div>
        );
    }

    const { players, groups, totals } = statistics;

    if (players.length === 0) {
        return (
            <div className="markdown-body">
                <h1>Player Stats</h1>
                <p className="text-(--color-fg-muted)">No player stats yet — they'll appear here once someone has played.</p>
                <Activity events={events} />
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
                <section key={group.title}>
                    <h2>{group.title}</h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                        {group.boards.map((board) => (
                            <StatLeaderboard key={board.id} board={board} />
                        ))}
                    </div>
                </section>
            ))}

            <Activity events={events} />

            <p className="text-sm text-(--color-fg-muted)">
                Advancement counts exclude recipe unlocks, which the server grants automatically. Damage is shown in health points — two per
                heart. Recent activity is read from the server's own logs and covers player activity only; times are displayed in server
                time (Europe/Oslo). Updates at most once every 5 minutes.
            </p>
        </div>
    );
};

export default Stats;
