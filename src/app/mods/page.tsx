import type { Metadata } from 'next';
import Link from 'next/link';
import { resourcePackUrl } from '@/lib/env';

const RESOURCE_PACK_CONTENTS =
    'GUI:\n- Dark UI\n- Numbered Hotbar\n\n' +
    'Utility:\n- Directional Observers\n- Directional Dispensers & Droppers\n- Directional Hoppers\n' +
    '- Sticky Piston Sides\n- Visual Note Block Pitch\n- Ore Borders\n- Suspicious Sand & Gravel Borders\n\n' +
    'Terrain:\n- Bushy Leaves\n- Smoother Stone\n- Clearer Water\n- Uniform Ores\n\n' +
    'Aesthetic:\n- Softer Wool\n\n' +
    'Unobtrusive:\n- Lower Fire\n- Lower Shield\n- Translucent Pumpkin Overlay\n- Smaller Utilities\n' +
    '- Unobtrusive Scaffolding\n- Clean Glass\n- Clean Stained Glass\n- Clean Tinted Glass\n\n' +
    '3D:\n- 3D Doors & Trapdoors\n- 3D Rails\n- 3D Ladders\n- 3D Bookshelves\n- 3D Chiseled Bookshelves\n\n' +
    'Peace & Quiet:\n- Quieter Minecarts';

export const metadata: Metadata = {
    title: '[KOK] Minecraft Server — Mods',
    description: 'Optional, client-only mods, shaders, and resource packs that make Minecraft run and look better.',
};

const Mods = () => (
    <div className="markdown-body">
        <p>
            <Link href="/">← Back to home</Link>
        </p>

        <h1>Recommended Mods</h1>
        <p>
            The server is vanilla-compatible, so none of these are required — but they make the game run and look far better on the client
            side. Everything below is optional and client-only.
        </p>

        <h2>Launcher</h2>
        <ul>
            <li>
                <a href="https://prismlauncher.org/" target="_blank" rel="noopener noreferrer">
                    Prism Launcher
                </a>{' '}
                — an open-source launcher that makes managing separate, modded instances simple and keeps your vanilla install untouched.
            </li>
        </ul>

        <h2>Mods</h2>
        <ul>
            <li>
                <a href="https://fabricmc.net/" target="_blank" rel="noopener noreferrer">
                    Fabric
                </a>{' '}
                — the mod loader everything else runs on. Install this first.
            </li>
            <li>
                <a href="https://modrinth.com/mod/sodium" target="_blank" rel="noopener noreferrer">
                    Sodium
                </a>{' '}
                — a modern rendering engine that dramatically boosts frame rates.
            </li>
            <li>
                <a href="https://modrinth.com/mod/lithium" target="_blank" rel="noopener noreferrer">
                    Lithium
                </a>{' '}
                — general game-logic optimizations for smoother performance.
            </li>
            <li>
                <a href="https://modrinth.com/mod/iris" target="_blank" rel="noopener noreferrer">
                    Iris
                </a>{' '}
                — adds shader support and works hand-in-hand with Sodium.
            </li>
            <li>
                <a href="https://modrinth.com/mod/appleskin" target="_blank" rel="noopener noreferrer">
                    AppleSkin
                </a>{' '}
                — shows hunger and saturation details so you know exactly when to eat.
            </li>
        </ul>

        <h2>Shaders</h2>
        <p>Load these through Iris. Pick whichever look you prefer:</p>
        <ul>
            <li>
                <a href="https://modrinth.com/shader/complementary-reimagined" target="_blank" rel="noopener noreferrer">
                    Complementary
                </a>{' '}
                — a well-balanced, widely-loved shader that stays close to the vanilla feel.
            </li>
            <li>
                <a href="https://modrinth.com/shader/photon-shader" target="_blank" rel="noopener noreferrer">
                    Photon
                </a>{' '}
                — a more cinematic option with striking lighting and skies.
            </li>
        </ul>

        <h2>Resource pack</h2>
        <ul>
            <li>
                <a href="https://vanillatweaks.net/" target="_blank" rel="noopener noreferrer">
                    VanillaTweaks
                </a>{' '}
                — small quality-of-life tweaks that keep the vanilla art style.
            </li>
            <li>
                <a href="https://modrinth.com/resourcepack/faithful-32x" target="_blank" rel="noopener noreferrer">
                    Faithful 32x
                </a>{' '}
                — a higher-resolution pack that doubles the vanilla textures while staying true to the original look.
            </li>
        </ul>
        {resourcePackUrl && (
            <>
                <p>
                    <a href={resourcePackUrl} download>
                        Click here to download
                    </a>{' '}
                    our curated selection from VanillaTweaks. Includes the following packs:
                </p>
                <pre>
                    <code>{RESOURCE_PACK_CONTENTS}</code>
                </pre>
            </>
        )}
    </div>
);

export default Mods;
