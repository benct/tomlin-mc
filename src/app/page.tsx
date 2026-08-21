import ServerStatusView from '@/components/ServerStatus';

const WEB_SERVER_URL = process.env.WEB_SERVER_URL ?? '';
const RESOURCE_PACK_URL = process.env.RESOURCE_PACK_URL;

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

        <h2>Live Map</h2>
        <a
            href={`${WEB_SERVER_URL}/map`}
            target="_blank"
            rel="noopener noreferrer"
            className="my-4 flex items-center gap-4 rounded-lg border border-(--color-border) p-5 no-underline transition-colors hover:bg-(--color-neutral-muted)">
            <svg
                width={48}
                height={48}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="shrink-0">
                <title>Map</title>
                <path d="M9 3 3 5.5v15L9 18l6 3 6-2.5v-15L15 6 9 3Z" />
                <path d="M9 3v15" />
                <path d="M15 6v15" />
            </svg>
            <span className="flex flex-col">
                <span className="text-lg font-semibold">Explore the live map</span>
                <span className="text-sm text-(--color-fg-muted)">See the world in real time, updated as players build.</span>
            </span>
        </a>

        <h2>Rules</h2>
        <ul>
            <li>Be respectful — NO griefing or stealing.</li>
            <li>Don't build your base right next to spawn.</li>
            <li>Keep chat friendly and family-safe.</li>
            <li>No cheating, hacked clients, or exploits.</li>
            <li>Have fun and build something cool!</li>
        </ul>

        <p className="text-sm text-(--color-fg-muted)">Questions? Ask an admin in-game or on discord.</p>

        <h2>Recommended Mods</h2>
        <p>
            The server is vanilla-compatible, so none of these are required — but they make the game run and look far better on the client
            side. Everything below is optional and client-only.
        </p>

        <h3>Launcher</h3>
        <ul>
            <li>
                <a href="https://prismlauncher.org/">Prism Launcher</a> — an open-source launcher that makes managing separate, modded
                instances simple and keeps your vanilla install untouched.
            </li>
        </ul>

        <h3>Mods</h3>
        <ul>
            <li>
                <a href="https://fabricmc.net/">Fabric</a> — the mod loader everything else runs on. Install this first.
            </li>
            <li>
                <a href="https://modrinth.com/mod/sodium">Sodium</a> — a modern rendering engine that dramatically boosts frame rates.
            </li>
            <li>
                <a href="https://modrinth.com/mod/lithium">Lithium</a> — general game-logic optimizations for smoother performance.
            </li>
            <li>
                <a href="https://modrinth.com/mod/iris">Iris</a> — adds shader support and works hand-in-hand with Sodium.
            </li>
            <li>
                <a href="https://modrinth.com/mod/appleskin">AppleSkin</a> — shows hunger and saturation details so you know exactly when to
                eat.
            </li>
        </ul>

        <h3>Shaders</h3>
        <p>Load these through Iris. Pick whichever look you prefer:</p>
        <ul>
            <li>
                <a href="https://modrinth.com/shader/complementary-reimagined">Complementary</a> — a well-balanced, widely-loved shader that
                stays close to the vanilla feel.
            </li>
            <li>
                <a href="https://modrinth.com/shader/photon-shader">Photon</a> — a more cinematic option with striking lighting and skies.
            </li>
        </ul>

        <h3>Resource pack</h3>
        <ul>
            <li>
                <a href="https://vanillatweaks.net/">VanillaTweaks</a> — small quality-of-life tweaks that keep the vanilla art style.
                {RESOURCE_PACK_URL && (
                    <>
                        {' '}
                        Grab our curated selection here:{' '}
                        <a href={RESOURCE_PACK_URL} download>
                            vanillatweaks.zip
                        </a>
                        .
                    </>
                )}
            </li>
        </ul>
    </div>
);

export default Home;
