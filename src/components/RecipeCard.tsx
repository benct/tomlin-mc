'use client';

import { createContext, use, useSyncExternalStore } from 'react';
import {
    craftingGrid,
    formatTicks,
    type Ingredient,
    iconUrl,
    itemName,
    RECIPE_LABELS,
    type Recipe,
    type RecipeData,
    type RecipeGroup,
    resolveIngredient,
    wikiUrl,
} from '@/lib/recipes';

/*
 * Slots that accept a whole item tag (any plank, any coal) cycle through their
 * options the way minecraft.wiki does. One shared interval drives every slot on
 * the page so the count of visible recipes doesn't multiply timers.
 */
let tick = 0;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

const subscribe = (onChange: () => void) => {
    listeners.add(onChange);
    timer ??= setInterval(() => {
        tick += 1;
        for (const listener of listeners) listener();
    }, 1500);

    return () => {
        listeners.delete(onChange);
        if (listeners.size === 0) {
            clearInterval(timer);
            timer = undefined;
        }
    };
};

// The server snapshot stays at 0 so the first paint matches the markup React hydrates.
const useTick = () =>
    useSyncExternalStore(
        subscribe,
        () => tick,
        () => 0,
    );

/**
 * Lets an ingredient slot hand its item name back to the search box. Passed by
 * context rather than as a prop because a slot sits five components deep and
 * nothing in between has any use for it.
 */
export const SelectItemContext = createContext<((name: string) => void) | null>(null);

const SLOT_CLASS =
    'group relative flex items-center justify-center rounded border border-(--color-border) bg-(--color-neutral-muted) transition-colors hover:border-(--color-accent)';

const ItemIcon = ({ data, id, size }: { data: RecipeData; id: string; size: number }) => (
    // biome-ignore lint/performance/noImgElement: tiny pixel-art sprites served by minecraft.wiki; next/image would resample and blur them
    <img
        src={iconUrl(data, id)}
        alt={itemName(data, id)}
        width={size}
        height={size}
        loading="lazy"
        style={{ width: size, height: size, imageRendering: 'pixelated' }}
    />
);

const boxSize = (size: number) => size + 12;

interface SlotProps {
    data: RecipeData;
    options: string[];
    index: number;
    size: number;
    isResult?: boolean;
}

const FilledSlot = ({ data, options, index, size, isResult }: SlotProps) => {
    const selectItem = use(SelectItemContext);
    const id = options[index];
    const name = itemName(data, id);
    // Tag slots cycle, so say what else would satisfy the slot rather than listing all of it.
    const alternatives = options.length > 1 ? `1 of ${options.length} options` : null;
    const searchable = !isResult && selectItem;

    const hint = searchable ? [alternatives, 'click to search'].filter(Boolean).join(' · ') : (alternatives ?? 'Open on minecraft.wiki');

    const box = { width: boxSize(size), height: boxSize(size) };
    const tooltip = (
        <>
            <ItemIcon data={data} id={id} size={size} />
            <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-full left-0 z-20 mb-1.5 hidden w-max max-w-56 rounded-md border border-(--color-border) bg-(--color-canvas) px-2 py-1 text-left shadow-lg group-hover:block group-focus-visible:block">
                <span className="block text-xs font-medium text-(--color-fg)">{name}</span>
                <span className="block text-[11px] text-(--color-fg-muted) first-letter:uppercase">{hint}</span>
            </span>
        </>
    );

    if (searchable) {
        return (
            <button
                type="button"
                onClick={() => selectItem(name)}
                aria-label={`Search for ${name}`}
                className={`${SLOT_CLASS} cursor-pointer`}
                style={box}>
                {tooltip}
            </button>
        );
    }

    return (
        <a
            href={wikiUrl(data, id)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${name} on minecraft.wiki`}
            className={SLOT_CLASS}
            style={box}>
            {tooltip}
        </a>
    );
};

const CyclingSlot = (props: Omit<SlotProps, 'index'>) => <FilledSlot {...props} index={useTick() % props.options.length} />;

const Slot = ({
    data,
    ingredient,
    size = 32,
    isResult,
}: {
    data: RecipeData;
    ingredient: Ingredient;
    size?: number;
    isResult?: boolean;
}) => {
    const options = resolveIngredient(data, ingredient);

    // Empty slots aren't interactive, so drop the hover affordance from SLOT_CLASS.
    if (options.length === 0) {
        return (
            <div
                className="rounded border border-(--color-border) bg-(--color-neutral-muted)"
                style={{ width: boxSize(size), height: boxSize(size) }}
            />
        );
    }
    if (options.length === 1) return <FilledSlot data={data} options={options} index={0} size={size} isResult={isResult} />;
    return <CyclingSlot data={data} options={options} size={size} isResult={isResult} />;
};

const Arrow = () => (
    <svg
        width={24}
        height={24}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="shrink-0 text-(--color-fg-muted)">
        <title>produces</title>
        <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
);

const ResultSlot = ({ data, recipe }: { data: RecipeData; recipe: Recipe }) => (
    <div className="relative shrink-0">
        <Slot data={data} ingredient={recipe.result.id} size={40} isResult />
        {recipe.result.count > 1 && (
            <span className="pointer-events-none absolute right-0.5 bottom-0 text-sm font-semibold text-(--color-fg) tabular-nums [text-shadow:0_1px_2px_var(--color-canvas)]">
                {recipe.result.count}
            </span>
        )}
    </div>
);

const CraftingGrid = ({ data, recipe }: { data: RecipeData; recipe: Recipe & { kind: 'crafting' } }) => (
    <div className="grid grid-cols-3 gap-1">
        {craftingGrid(recipe).map((ingredient, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: grid slots are positional and the array is fixed at 9
            <Slot key={index} data={data} ingredient={ingredient} />
        ))}
    </div>
);

const LabelledSlots = ({ data, slots }: { data: RecipeData; slots: { label: string; ingredient: Ingredient }[] }) => (
    <div className="flex items-center gap-3">
        {slots.map(({ label, ingredient }) => (
            <div key={label} className="relative">
                <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 text-[11px] whitespace-nowrap text-(--color-fg-muted)">
                    {label}
                </span>
                <Slot data={data} ingredient={ingredient} />
            </div>
        ))}
    </div>
);

const RecipeInputs = ({ data, recipe }: { data: RecipeData; recipe: Recipe }) => {
    if (recipe.kind === 'crafting') return <CraftingGrid data={data} recipe={recipe} />;
    if (recipe.kind === 'smithing') {
        return (
            <LabelledSlots
                data={data}
                slots={[
                    { label: 'Template', ingredient: recipe.template },
                    { label: 'Base', ingredient: recipe.base },
                    { label: 'Addition', ingredient: recipe.addition },
                ]}
            />
        );
    }
    return (
        <LabelledSlots
            data={data}
            slots={[
                { label: 'Input', ingredient: recipe.input },
                { label: itemName(data, recipe.station), ingredient: recipe.station },
            ]}
        />
    );
};

const recipeNote = (recipe: Recipe): string | null => {
    if (recipe.kind !== 'cooking') return null;
    return `${formatTicks(recipe.cookingTime)} · ${recipe.experience} XP`;
};

const RecipeRow = ({ data, recipe }: { data: RecipeData; recipe: Recipe }) => {
    const note = recipeNote(recipe);
    const padding = recipe.kind === 'crafting' ? 'py-3' : 'pt-7 pb-3';

    return (
        <li className={`flex flex-wrap items-center gap-4 border-t border-(--color-border-muted) px-4 first:border-t-0 ${padding}`}>
            <RecipeInputs data={data} recipe={recipe} />
            <Arrow />
            <ResultSlot data={data} recipe={recipe} />
            <div className="min-w-0 flex-1 text-right text-xs text-(--color-fg-muted)">
                <div>{RECIPE_LABELS[recipe.type] ?? recipe.type}</div>
                {note && <div className="tabular-nums">{note}</div>}
            </div>
        </li>
    );
};

export const RecipeCard = ({ data, group }: { data: RecipeData; group: RecipeGroup }) => (
    <section className="rounded-lg border border-(--color-border) bg-(--color-canvas-subtle)">
        <header className="flex items-center gap-2.5 border-b border-(--color-border) px-4 py-2.5">
            <ItemIcon data={data} id={group.itemId} size={24} />
            <h3 className="mt-0! mb-0! min-w-0 flex-1 truncate text-base!">
                <a href={wikiUrl(data, group.itemId)} target="_blank" rel="noopener noreferrer" title={`${group.name} on minecraft.wiki`}>
                    {group.name}
                </a>
            </h3>
            <span className="shrink-0 text-xs text-(--color-fg-muted) tabular-nums">
                {group.recipes.length} {group.recipes.length === 1 ? 'recipe' : 'recipes'}
            </span>
        </header>
        <ul className="list-none! pl-0! mb-0!">
            {group.recipes.map((recipe) => (
                <RecipeRow key={recipe.id} data={data} recipe={recipe} />
            ))}
        </ul>
    </section>
);
