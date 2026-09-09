import type { AdminPlayer } from '@/lib/admin';
import { formatAgo, formatStamp } from '@/lib/datetime';

export const AdminPlayers = ({ players }: { players: AdminPlayer[] }) => (
    <section>
        <h2>Players</h2>

        {players.length === 0 ? (
            <p className="text-(--color-fg-muted)">No players known — the roster is empty or unreadable.</p>
        ) : (
            <div className="overflow-x-auto">
                <table className="text-sm">
                    <thead>
                        <tr>
                            <th align="left">Player</th>
                            <th align="left">Last login</th>
                        </tr>
                    </thead>
                    <tbody>
                        {players.map((player) => (
                            <tr key={player.uuid}>
                                <td>
                                    <span className="font-semibold">{player.name}</span>
                                    <code className="block text-[11px] text-(--color-fg-muted)">{player.uuid}</code>
                                </td>
                                <td>
                                    {player.lastLogin === null ? (
                                        <span className="text-(--color-fg-muted)">—</span>
                                    ) : (
                                        <>
                                            <time dateTime={new Date(player.lastLogin).toISOString()} className="tabular-nums">
                                                {formatStamp(player.lastLogin)}
                                            </time>
                                            <span className="block text-xs text-(--color-fg-muted)">{formatAgo(player.lastLogin)}</span>
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
    </section>
);
