import type { MetadataRoute } from 'next';

const robots = (): MetadataRoute.Robots => ({
    rules: {
        userAgent: '*',
        allow: '/',
        disallow: ['/stats', '/map'],
    },
});

export default robots;
