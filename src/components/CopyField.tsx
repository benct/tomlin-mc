'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const CopyIcon = () => (
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
        <title>Copy</title>
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
);

const CheckIcon = () => (
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
        <title>Copied</title>
        <path d="m20 6-11 11-5-5" />
    </svg>
);

export const CopyField = ({ content }: { content: string }) => {
    const [copied, setCopied] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => () => clearTimeout(timer.current), []);

    const copy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(content);
        } catch {
            return; // Clipboard unavailable (e.g. insecure context) — leave state unchanged.
        }
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 2000);
    }, [content]);

    return (
        <div className="flex items-stretch overflow-hidden rounded-md border border-(--color-border) bg-(--color-canvas)">
            <input
                type="text"
                readOnly
                value={content}
                aria-label="Server address"
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 bg-transparent px-2.5 py-1.5 font-mono text-sm text-(--color-fg) outline-none"
            />
            <button
                type="button"
                onClick={copy}
                aria-label={copied ? 'Address copied' : 'Copy server address'}
                title={copied ? 'Copied!' : 'Copy to clipboard'}
                className="flex shrink-0 cursor-pointer items-center justify-center border-l border-(--color-border) px-2.5 text-(--color-fg-muted) transition-colors hover:bg-(--color-neutral-muted) hover:text-(--color-fg)">
                {copied ? <CheckIcon /> : <CopyIcon />}
            </button>
        </div>
    );
};
