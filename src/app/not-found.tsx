import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: '[KOK] Minecraft Server — Page Not Found',
    description: 'The page you are looking for does not exist.',
};

const NotFound = () => (
    <div className="markdown-body">
        <h1>404 — Page Not Found</h1>
        <p>
            The page you are looking for doesn&apos;t exist or may have moved. Use the navigation to find your way, or head back to the
            start.
        </p>
        <p>
            <Link href="/">← Back to home</Link>
        </p>
    </div>
);

export default NotFound;
