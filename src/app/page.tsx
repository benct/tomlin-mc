import ServerStatusView from '@/components/ServerStatus';

const Home = () => (
    <div className="markdown-body">
        <h1>[KOK] Minecraft Server</h1>
        <p>
            This is a <strong>pure vanilla</strong> server (Java) — no gameplay changes, no custom items, no modified recipes. Everything
            plays exactly like unmodified Minecraft.
        </p>
        <p>
            The only additions are <strong>server-side performance mods</strong>, loaded with <a href="https://fabricmc.net/">Fabric</a>.
            They make the world run faster and lighter without touching how the game plays, so you can join with a completely unmodified
            client:
        </p>
        <ul>
            <li>
                <a href="https://modrinth.com/mod/lithium">Lithium</a> — optimizes game physics, mob AI, and block ticking for higher, more
                stable tick rates.
            </li>
            <li>
                <a href="https://modrinth.com/mod/ferrite-core">FerriteCore</a> — cuts the server's memory usage so it stays responsive
                under load.
            </li>
            <li>
                <a href="https://modrinth.com/mod/krypton">Krypton</a> — streamlines the networking stack for lower latency and smoother
                connections.
            </li>
        </ul>

        <ServerStatusView />

        <h2>Rules</h2>
        <ul>
            <li>Be respectful — NO griefing or stealing.</li>
            <li>Keep chat friendly and family-safe.</li>
            <li>No cheating, hacked clients, or exploits.</li>
            <li>Don't build your base right next to spawn.</li>
            <li>Have fun and build something cool!</li>
        </ul>

        <p className="text-sm text-(--color-fg-muted)">Questions? Ask an admin in-game or on discord.</p>
    </div>
);

export default Home;
