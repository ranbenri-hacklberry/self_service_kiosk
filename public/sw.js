// Basic Service Worker to satisfy PWA requirements
const CACHE_NAME = 'icaffeos-v1';

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll([
                '/',
                '/index.html',
                '/manifest.json'
            ]);
        })
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Bypass service worker for Supabase/PostgREST API requests
    // These should always go directly to the network and never be cached
    if (url.hostname.includes('supabase.co')) {
        return; // Let the browser handle it normally
    }

    event.respondWith(
        fetch(event.request).catch(async () => {
            const cachedResponse = await caches.match(event.request);
            if (cachedResponse) return cachedResponse;

            // If both fail, return a basic error response instead of undefined
            return new Response('Offline', {
                status: 503,
                statusText: 'Service Unavailable',
                headers: new Headers({ 'Content-Type': 'text/plain' })
            });
        })
    );
});
