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
        width: 16,
        height: 16,
        viewBox: '0 0 24 24',
        className: 'size-5 shrink-0 sm:size-4',
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
            <circle cx="12" cy="12" r="5" />
            <path d="M12 7a5 5 0 0 1 0 10Z" fill="currentColor" stroke="none" />
            <path d="M12 1.5v2m0 17v2M2.5 12h2M5.3 5.3l1.4 1.4m-1.4 12l1.4-1.4" />
        </svg>
    );
};

export const ThemeToggle = ({ className }: { className: string }) => {
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
            className={`${className} cursor-pointer`}>
            {/* Render a stable placeholder until mounted to avoid a hydration mismatch. */}
            {mounted ? <Icon theme={theme} /> : <span className="size-5 sm:size-4" />}
        </button>
    );
};
