import type { Metadata } from 'next';
import { RecipeBrowser } from '@/components/RecipeBrowser';
import { mcVersion } from '@/lib/env';

export const metadata: Metadata = {
    title: '[KOK] Minecraft Server — Wiki',
    description: 'Searchable vanilla Minecraft recipes, plus guides for enchanting, trading, brewing, redstone and more.',
};

const Wiki = () => (
    <div className="markdown-body">
        <h1>Wiki</h1>

        <h2>Recipe Book</h2>
        <p>
            A recipe book for vanilla Minecraft — search for any item to see how it's crafted, smelted, cut or smithed. Slots that accept a
            whole group of items (any plank, any log) cycle through the options.
        </p>
        <RecipeBrowser />

        <h2>Guides</h2>

        <h3>Advancements</h3>
        <ul>
            <li>
                <a href="https://minecraft.wiki/w/Advancement" target="_blank" rel="noopener noreferrer">
                    Advancement reference
                </a>{' '}
                — every advancement and exactly what triggers it.
            </li>
        </ul>

        <h3>Enchanting</h3>
        <ul>
            <li>
                <a href="https://minecraft.wiki/w/Enchantment" target="_blank" rel="noopener noreferrer">
                    Enchantment reference
                </a>{' '}
                — every enchantment, which items it applies to and conflicts with.
            </li>
            <li>
                <a href="https://iamcal.github.io/enchant-order/" target="_blank" rel="noopener noreferrer">
                    Enchantment order calculator
                </a>{' '}
                — works out the cheapest anvil order for a set of enchantments.
            </li>
            <li>
                <a href="/guides/anvil-order.webp" target="_blank" rel="noopener noreferrer">
                    Enchantment order chart
                </a>{' '}
                — worked-out orders for the common tool and armour sets.
            </li>
        </ul>

        <h3>Trading</h3>
        <ul>
            <li>
                <a href="https://minecraft.wiki/w/Trading" target="_blank" rel="noopener noreferrer">
                    Trading reference
                </a>{' '}
                — how villager professions, levels, prices and restocking work.
            </li>
            <li>
                <a href="/guides/trading.webp" target="_blank" rel="noopener noreferrer">
                    Trading &amp; bartering chart
                </a>{' '}
                — one big infographic of every villager and piglin trade.
            </li>
        </ul>

        <h3>Brewing</h3>
        <ul>
            <li>
                <a href="https://minecraft.wiki/w/Brewing" target="_blank" rel="noopener noreferrer">
                    Brewing reference
                </a>{' '}
                — ingredients, brewing times and every potion effect.
            </li>
            <li>
                <a href="/guides/brewing.webp" target="_blank" rel="noopener noreferrer">
                    Potion brewing chart
                </a>{' '}
                — the full brewing tree from water bottle to splash and lingering potions.
            </li>
        </ul>

        <h3>Redstone</h3>
        <ul>
            <li>
                <a href="https://minecraft.wiki/w/Redstone_circuits" target="_blank" rel="noopener noreferrer">
                    Redstone reference
                </a>{' '}
                — components, signal strength, timing and the standard circuit types.
            </li>
            <li>
                <a href="/guides/logic-gates.webp" target="_blank" rel="noopener noreferrer">
                    Compact logic gates chart
                </a>{' '}
                — flat, compact designs for AND, OR, XOR, NOT and the rest.
            </li>
        </ul>

        <h3>Mining</h3>
        <ul>
            <li>
                <a href="https://minecraft.wiki/w/Ore#Distribution" target="_blank" rel="noopener noreferrer">
                    Ore distribution
                </a>{' '}
                — the Y level each ore peaks at, and the biomes that change the odds.
            </li>
        </ul>

        <div className="mt-8 text-sm text-(--color-fg-muted)">
            Recipe data extracted from Minecraft {mcVersion} by{' '}
            <a href="https://github.com/misode/mcmeta" target="_blank" rel="noopener noreferrer">
                mcmeta
            </a>
            . Item sprites, charts and reference pages from{' '}
            <a href="https://minecraft.wiki/" target="_blank" rel="noopener noreferrer">
                minecraft.wiki
            </a>
            , used under{' '}
            <a href="https://creativecommons.org/licenses/by-nc-sa/3.0/" target="_blank" rel="noopener noreferrer">
                CC BY-NC-SA 3.0
            </a>
            . The logic gates chart made by the{' '}
            <a href="https://www.reddit.com/r/redstone/" target="_blank" rel="noopener noreferrer">
                r/redstone
            </a>{' '}
            community, and the anvil order cheat sheet compiled by Deego.
        </div>
    </div>
);

export default Wiki;
