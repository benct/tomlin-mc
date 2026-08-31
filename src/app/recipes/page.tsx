import type { Metadata } from 'next';
import Link from 'next/link';
import { RecipeBrowser } from '@/components/RecipeBrowser';

export const metadata: Metadata = {
    title: '[KOK] Minecraft Server — Recipe Book',
    description: 'Searchable crafting, smelting, stonecutting and smithing recipes for vanilla Minecraft.',
};

const RecipeBook = () => (
    <div className="markdown-body">
        <p>
            <Link href="/">← Back to home</Link>
        </p>

        <h1>Recipe Book</h1>
        <p>
            A recipe book for vanilla Minecraft — search for any item to see how it's crafted, smelted, cut or smithed. Slots that accept a
            whole group of items (any plank, any log) cycle through the options.
        </p>

        <RecipeBrowser />
    </div>
);

export default RecipeBook;
