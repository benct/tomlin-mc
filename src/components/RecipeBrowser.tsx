'use client';

import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import useSWR from 'swr';
import { RecipeCard, SelectItemContext } from '@/components/RecipeCard';
import { groupRecipes, PAGE_SIZE, type RecipeData, searchGroups } from '@/lib/recipes';

const fetcher = (url: string) =>
    fetch(url).then((r) => {
        if (!r.ok) throw new Error(`Request failed: ${r.status}`);
        return r.json() as Promise<RecipeData>;
    });

const SearchIcon = () => (
    <svg
        width={16}
        height={16}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true">
        <title>Search</title>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
    </svg>
);

export const RecipeBrowser = () => {
    // The dataset is a static, immutable build artefact — fetch it once and keep it.
    const { data, error, isLoading } = useSWR<RecipeData>('/recipes.json', fetcher, {
        revalidateOnFocus: false,
        revalidateIfStale: false,
        revalidateOnReconnect: false,
    });

    const [query, setQuery] = useState('');
    const [page, setPage] = useState(1);

    // Searching 1500 recipes on every keystroke is cheap, but deferring keeps the
    // input responsive while the (much slower) result list re-renders.
    const deferredQuery = useDeferredValue(query).trim();
    const groups = useMemo(() => (data ? groupRecipes(data) : []), [data]);
    const results = useMemo(() => (deferredQuery ? searchGroups(groups, deferredQuery) : []), [groups, deferredQuery]);

    const onSearch = useCallback((value: string) => {
        setQuery(value);
        setPage(1);
    }, []);

    // Clicking an ingredient searches for it. The results below the fold change
    // completely, so return to the top rather than leaving the reader mid-list.
    const selectItem = useCallback(
        (name: string) => {
            onSearch(name);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        [onSearch],
    );

    const visible = results.slice(0, page * PAGE_SIZE);

    return (
        <div className="space-y-4">
            <div className="flex items-stretch overflow-hidden rounded-md border border-(--color-border) bg-(--color-canvas)">
                <span className="flex shrink-0 items-center pl-2.5 text-(--color-fg-muted)">
                    <SearchIcon />
                </span>
                <input
                    type="search"
                    value={query}
                    onChange={(e) => onSearch(e.target.value)}
                    placeholder="Search for an item or ingredient…"
                    aria-label="Search recipes"
                    autoComplete="off"
                    className="min-w-0 flex-1 bg-transparent px-2.5 py-2 text-sm text-(--color-fg) outline-none"
                />
            </div>

            {isLoading && <p className="text-(--color-fg-muted)">Loading recipes…</p>}
            {error && !data && <p className="text-(--color-danger-fg)">Failed to load recipes. Please try again later.</p>}

            {data && (
                <>
                    <p className="text-sm text-(--color-fg-muted) tabular-nums">
                        {!deferredQuery && `Search ${groups.length} items and ${data.recipes.length} recipes.`}
                        {deferredQuery && results.length === 0 && `No items match “${deferredQuery}”.`}
                        {deferredQuery && results.length > 0 && `Showing ${visible.length} of ${results.length} matching items.`}
                    </p>

                    <SelectItemContext value={selectItem}>
                        <div className="space-y-4">
                            {visible.map((group) => (
                                <RecipeCard key={group.itemId} data={data} group={group} />
                            ))}
                        </div>
                    </SelectItemContext>

                    {visible.length < results.length && (
                        <button
                            type="button"
                            onClick={() => setPage((current) => current + 1)}
                            className="w-full cursor-pointer rounded-md border border-(--color-border) bg-(--color-canvas-subtle) px-5 py-2 text-sm font-medium text-(--color-fg) transition-colors hover:bg-(--color-neutral-muted)">
                            Show more
                        </button>
                    )}
                    <p className="my-6 text-sm text-(--color-fg-muted)">
                        Recipe data extracted from Minecraft {data.version} by{' '}
                        <a href="https://github.com/misode/mcmeta" target="_blank" rel="noopener noreferrer">
                            mcmeta
                        </a>
                        . Item sprites from{' '}
                        <a href="https://minecraft.wiki/" target="_blank" rel="noopener noreferrer">
                            minecraft.wiki
                        </a>
                        , used under{' '}
                        <a href="https://creativecommons.org/licenses/by-nc-sa/3.0/" target="_blank" rel="noopener noreferrer">
                            CC BY-NC-SA 3.0
                        </a>
                        .
                    </p>
                </>
            )}
        </div>
    );
};
