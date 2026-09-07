import { timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { adminPassword } from '@/lib/env';

/**
 * Guards `/admin`, the one page on this site that isn't meant for the public.
 *
 * HTTP Basic auth, because the thing being protected is a read-only page for one
 * person: there is no account to manage, no session to expire, and it works from
 * a browser and `curl` alike. Any username is accepted — only the password is
 * checked, against `ADMIN_PASSWORD`.
 *
 * With that variable unset the page is simply unreachable: this refuses the
 * request and the page returns a 404 of its own, so a deployment that forgot to
 * set a password never serves the contents.
 *
 * Proxy runs before the route does, but it is not the only line of defence — see
 * `src/app/admin/page.tsx`, which re-checks rather than trusting that a request
 * reaching it must have come through here.
 */

const REALM = 'Minecraft server admin';

const CHALLENGE = { status: 401, headers: { 'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"` } };

/** Compares in constant time, so a wrong password can't be narrowed down by how long the refusal took. */
const matches = (candidate: string, expected: string): boolean => {
    const a = Buffer.from(candidate);
    const b = Buffer.from(expected);
    // timingSafeEqual throws on a length mismatch, which would leak the length by itself.
    return a.length === b.length && timingSafeEqual(a, b);
};

/** Pulls the password out of an `Authorization: Basic base64(user:pass)` header. */
const passwordFrom = (header: string | null): string | null => {
    const [scheme, encoded] = header?.split(' ') ?? [];
    if (scheme?.toLowerCase() !== 'basic' || !encoded) return null;

    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    return separator === -1 ? null : decoded.slice(separator + 1);
};

export function proxy(request: NextRequest) {
    if (!adminPassword) return new NextResponse('Not found', { status: 404 });

    const password = passwordFrom(request.headers.get('authorization'));
    if (!password || !matches(password, adminPassword)) {
        return new NextResponse('Authentication required', CHALLENGE);
    }

    // Nothing about this page should be held anywhere: not the browser cache, not
    // a proxy in between, and certainly not a search index.
    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet, noimageindex');
    response.headers.set('Referrer-Policy', 'no-referrer');
    return response;
}

export const config = {
    matcher: ['/admin', '/admin/:path*'],
};
