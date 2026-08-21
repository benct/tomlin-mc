import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: '[KOK] Minecraft Server — Stats',
    description: 'Player statistics and advancements for the Minecraft server.',
};

const Stats = () => (
    <div className="markdown-body">
        <p>
            <Link href="/">← Back to home</Link>
        </p>

        <h1>Player Stats</h1>
        <p className="text-(--color-fg-muted)">Coming soon.</p>
    </div>
);

export default Stats;
