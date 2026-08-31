const DownloadIcon = () => (
    <svg
        width={16}
        height={16}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="shrink-0">
        <title>Download</title>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
);

export const ResourcePack = ({ url }: { url: string }) => (
    <>
        <h2>Resource Pack</h2>
        <p>
            Optional, but recommended — it includes minor tweaks and improvements to some blocks, utilities and textures. Drop it into your{' '}
            <code>resourcepacks</code> folder and enable it in the in-game settings.
        </p>
        <p>
            <a
                href={url}
                download
                className="inline-flex items-center gap-2 rounded-md border border-(--color-border) bg-(--color-canvas-subtle) px-5 py-2 text-sm font-medium text-(--color-fg)! no-underline! transition-colors hover:bg-(--color-neutral-muted)">
                <DownloadIcon />
                Download Resource Pack
            </a>
        </p>
    </>
);
