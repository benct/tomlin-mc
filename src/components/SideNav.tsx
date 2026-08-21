import Link from 'next/link';
import { CopyField } from '@/components/CopyField';

const RESOURCE_PACK_URL = process.env.RESOURCE_PACK_URL;

const DEFAULT_PORT = '25565';
const SERVER_ADDRESS = process.env.MC_SERVER_ADDRESS;
const SERVER_PORT = process.env.MC_SERVER_PORT ?? DEFAULT_PORT;
const CONNECT_ADDRESS = SERVER_ADDRESS ? (SERVER_PORT === DEFAULT_PORT ? SERVER_ADDRESS : `${SERVER_ADDRESS}:${SERVER_PORT}`) : null;

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
    className: 'shrink-0',
};

const ModsIcon = () => (
    <svg {...iconProps}>
        <title>Mods</title>
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
    </svg>
);

const DownloadIcon = () => (
    <svg {...iconProps}>
        <title>Download</title>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
);

const MapIcon = () => (
    <svg {...iconProps}>
        <title>Map</title>
        <path d="M9 3 3 5.5v15L9 18l6 3 6-2.5v-15L15 6 9 3Z" />
        <path d="M9 3v15M15 6v15" />
    </svg>
);

const StatsIcon = () => (
    <svg {...iconProps}>
        <title>Stats</title>
        <path d="M3 3v18h18M7 16v-5M12 16V8M17 16v-9" />
    </svg>
);

const linkClass =
    'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-(--color-fg) no-underline transition-colors hover:bg-(--color-neutral-muted)';

export const SideNav = () => (
    <aside className="shrink-0 lg:w-60 space-y-6">
        <nav
            aria-label="Site navigation"
            className="flex flex-col gap-0.5 p-3 rounded-lg border border-(--color-border) bg-(--color-canvas-subtle)">
            <h2 className="px-2 pb-1 text-xs font-semibold tracking-wide text-(--color-fg-muted) uppercase">Navigation</h2>
            <a href="/map" className={linkClass}>
                <MapIcon />
                Live Map
            </a>
            <Link href="/stats" className={linkClass}>
                <StatsIcon />
                Player Stats
            </Link>
            <Link href="/mods" className={linkClass}>
                <ModsIcon />
                Recommended Mods
            </Link>
        </nav>

        {CONNECT_ADDRESS && <CopyField content={CONNECT_ADDRESS} />}

        {RESOURCE_PACK_URL && (
            <div className="space-y-2">
                <a
                    href={RESOURCE_PACK_URL}
                    download
                    className="flex items-center gap-2 rounded-md border border-(--color-border) bg-(--color-canvas-subtle) px-5 py-2 text-sm font-medium text-(--color-fg) no-underline transition-colors hover:bg-(--color-neutral-muted)">
                    <DownloadIcon />
                    Download Resource Pack
                </a>
                <p className="text-xs text-(--color-fg-muted)">
                    Recommended resource pack that includes minor tweaks and improvements to some blocks, utilities and textures.
                </p>
            </div>
        )}
    </aside>
);
