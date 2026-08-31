'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';

const REPO_URL = 'https://github.com/benct/tomlin-mc';

const iconProps = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    className: 'size-5 shrink-0 sm:size-4',
};

const HomeIcon = () => (
    <svg {...iconProps}>
        <title>Home</title>
        <path d="M3 10.5 12 3l9 7.5M5.5 9.5V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5" />
    </svg>
);

const MapIcon = () => (
    <svg {...iconProps}>
        <title>Live Map</title>
        <path d="M9 3 3 5.5v15L9 18l6 3 6-2.5v-15L15 6 9 3Z" />
        <path d="M9 3v15M15 6v15" />
    </svg>
);

const StatsIcon = () => (
    <svg {...iconProps}>
        <title>Player Stats</title>
        <path d="M3 3v18h18M7 16v-5M12 16V8M17 16v-9" />
    </svg>
);

const RecipeBookIcon = () => (
    <svg {...iconProps}>
        <title>Recipe Book</title>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
        <path d="M9 6h7M9 10h5" />
    </svg>
);

const ModsIcon = () => (
    <svg {...iconProps}>
        <title>Recommended Mods</title>
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
    </svg>
);

const GitHubIcon = () => (
    <svg {...iconProps} viewBox="0 0 16 16" fill="currentColor" stroke="none">
        <title>GitHub</title>
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
);

const NAV_ITEMS = [
    { href: '/', label: 'Home', Icon: HomeIcon },
    { href: '/map', label: 'Live Map', Icon: MapIcon, external: true },
    { href: '/stats', label: 'Stats', Icon: StatsIcon },
    { href: '/recipes', label: 'Recipe Book', Icon: RecipeBookIcon },
    { href: '/mods', label: 'Mods', Icon: ModsIcon },
];

const ITEM_CLASS =
    'flex items-center justify-center gap-2 rounded-md p-3 text-sm text-(--color-fg-muted) no-underline transition-colors hover:bg-(--color-neutral-muted) hover:text-(--color-fg) sm:p-2';

const LINK_CLASS = `${ITEM_CLASS} sm:px-2.5 sm:py-1.5`;

export const SiteHeader = () => {
    const pathname = usePathname();

    return (
        <header className="border-b border-(--color-border) bg-(--color-canvas-subtle)">
            <div className="mx-auto flex max-w-3xl items-center gap-1 px-4 py-2.5 sm:gap-4 sm:px-6">
                <nav aria-label="Site navigation" className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5">
                    {NAV_ITEMS.map(({ href, label, Icon, external }) => {
                        const active = !external && pathname === href;
                        const className = `${LINK_CLASS} ${active ? 'bg-(--color-neutral-muted) font-medium text-(--color-fg)!' : ''}`;

                        return external ? (
                            <a key={href} href={href} title={label} className={className}>
                                <Icon />
                                <span className="sr-only sm:not-sr-only">{label}</span>
                            </a>
                        ) : (
                            <Link key={href} href={href} title={label} aria-current={active ? 'page' : undefined} className={className}>
                                <Icon />
                                <span className="sr-only sm:not-sr-only">{label}</span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="flex shrink-0 items-center gap-0.5">
                    <a href={REPO_URL} target="_blank" rel="noopener noreferrer" title="View source on GitHub" className={ITEM_CLASS}>
                        <GitHubIcon />
                        <span className="sr-only">View source on GitHub</span>
                    </a>
                    <ThemeToggle className={ITEM_CLASS} />
                </div>
            </div>
        </header>
    );
};
