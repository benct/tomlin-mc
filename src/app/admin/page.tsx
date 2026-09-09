import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AdminConfig } from '@/components/AdminConfig';
import { AdminLogView } from '@/components/AdminLog';
import { AdminPlayers } from '@/components/AdminPlayers';
import { AdminStatus } from '@/components/AdminStatus';
import { loadAdminSnapshot } from '@/lib/admin';
import { DISPLAY_TIMEZONE } from '@/lib/datetime';
import { adminPassword } from '@/lib/env';

export const metadata: Metadata = {
    title: 'Admin',
    robots: { index: false, follow: false, nocache: true, noarchive: true, nosnippet: true, noimageindex: true },
};

// Every number on this page is a live reading; none of it should be cached.
export const dynamic = 'force-dynamic';

const filtersFrom = (value: string | string[] | undefined): string[] => {
    const parts = (Array.isArray(value) ? value : [value ?? '']).flatMap((each) => each.split(','));
    return [...new Set(parts.map((part) => part.trim().toLowerCase()).filter(Boolean))];
};

const Admin = async ({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) => {
    // The proxy has already refused this request without a password, but a page
    // this sensitive shouldn't depend on a matcher pattern staying correct.
    if (!adminPassword) notFound();

    const { log, players } = await loadAdminSnapshot(filtersFrom((await searchParams).type));

    return (
        <div className="markdown-body">
            <h1>Admin</h1>
            <p className="text-(--color-fg-muted)">Server info and administration. Times are shown in server time ({DISPLAY_TIMEZONE}).</p>

            <AdminStatus />

            <AdminPlayers players={players} />

            {log ? (
                <AdminLogView log={log} />
            ) : (
                <section>
                    <h2>Server log</h2>
                    <p className="text-(--color-fg-muted)">
                        No log directory — set <code>MC_LOGS_DIR</code> to the server's <code>logs</code> directory.
                    </p>
                </section>
            )}

            <AdminConfig />
        </div>
    );
};

export default Admin;
