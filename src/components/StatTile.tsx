export const StatTile = ({ label, value }: { label: string; value: string }) => (
    <div className="rounded-lg border border-(--color-border) bg-(--color-canvas-subtle) px-4 py-3">
        <dt className="text-xs text-(--color-fg-muted)">{label}</dt>
        <dd className="mt-0.5 text-2xl font-semibold text-(--color-fg)">{value}</dd>
    </div>
);
