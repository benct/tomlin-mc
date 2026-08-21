'use client';

import { useEffect, useState } from 'react';

type Theme = 'system' | 'light' | 'dark';

const ORDER: Theme[] = ['system', 'light', 'dark'];

const LABELS: Record<Theme, string> = {
    system: 'System theme',
    light: 'Light theme',
    dark: 'Dark theme',
};

/** Reflect the chosen theme onto <html data-theme> and persist it. */
const applyTheme = (theme: Theme) => {
    if (theme === 'system') {
        delete document.documentElement.dataset.theme;
        localStorage.removeItem('theme');
    } else {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem('theme', theme);
    }
};

const Icon = ({ theme }: { theme: Theme }) => {
    const common = {
        width: 20,
        height: 20,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.75,
        strokeLinecap: 'round' as const,
        strokeLinejoin: 'round' as const,
        'aria-hidden': true,
    };
    if (theme === 'light') {
        return (
            <svg {...common} aria-label="Sun">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41" />
            </svg>
        );
    }
    if (theme === 'dark') {
        return (
            <svg {...common} aria-label="Moon">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
            </svg>
        );
    }
    return (
        <svg {...common} aria-label="System">
            <rect x="2" y="4" width="20" height="13" rx="2" />
            <path d="M8 21h8m-4-4v4" />
        </svg>
    );
};

export const ThemeToggle = () => {
    const [theme, setTheme] = useState<Theme>('system');
    const [mounted, setMounted] = useState(false);

    // Sync initial state from whatever the pre-paint script already applied.
    useEffect(() => {
        const stored = localStorage.getItem('theme');
        setTheme(stored === 'light' || stored === 'dark' ? stored : 'system');
        setMounted(true);
    }, []);

    const cycle = () => {
        const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
        setTheme(next);
        applyTheme(next);
    };

    return (
        <button
            type="button"
            onClick={cycle}
            aria-label={`Switch theme (current: ${LABELS[theme]})`}
            title={LABELS[theme]}
            className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-(--color-border) bg-(--color-canvas-subtle) text-(--color-fg) transition-colors hover:bg-(--color-neutral-muted)">
            {/* Render a stable placeholder until mounted to avoid a hydration mismatch. */}
            {mounted ? <Icon theme={theme} /> : <span className="h-5 w-5" />}
        </button>
    );
};
