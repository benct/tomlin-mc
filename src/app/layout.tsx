import type { Metadata } from 'next';
import './globals.css';
import type { PropsWithChildren } from 'react';
import { GitHubLink } from '@/components/GitHubLink';
import { ThemeToggle } from '@/components/ThemeToggle';

export const metadata: Metadata = {
    title: '[KOK] Minecraft Server',
    description: 'Live status and information for the [KOK] Minecraft server.',
};

// Evaluated at build time (this is a static server component).
const CURRENT_YEAR = new Date().getFullYear();

// Applies the saved theme before first paint so there's no light/dark flash.
// A stored 'light'/'dark' sets data-theme; 'system' (or nothing) leaves it unset
// so the prefers-color-scheme media query takes over.
const themeInitScript = `(() => {
    try {
        const t = localStorage.getItem('theme');
        if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
    } catch {}
})();`;

const RootLayout = ({ children }: Readonly<PropsWithChildren>) => (
    <html lang="en" suppressHydrationWarning>
        <head>
            {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static, first-party inline script to prevent theme flash */}
            <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        </head>
        <body>
            <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
                <GitHubLink />
                <ThemeToggle />
            </div>
            <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-16">{children}</main>
            <footer className="markdown-body mx-auto max-w-3xl px-4 pb-10 text-center text-sm text-(--color-fg-muted) sm:px-6">
                <hr />
                <p className="mb-2">Not affiliated with Mojang or Microsoft. Minecraft is a trademark of Mojang Synergies AB.</p>
                <p>Ben Tomlin © {CURRENT_YEAR}</p>
            </footer>
        </body>
    </html>
);

export default RootLayout;
