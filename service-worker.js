const BUILD = '__APP_BUILD__';
const CACHE_NAME = `valores-app-${BUILD}`;
const SHELL = ['/', '/index.html', '/app.js', '/catalogo.css', '/updates.js', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png', '/simulation.css', '/simulation-engine.mjs', '/simulator.mjs', '/simulation-lessons.mjs'];
self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(SHELL.map(path => new Request(path, {cache: 'reload'})));
        await self.skipWaiting();
    })());
});
self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => key !== CACHE_NAME && (key.startsWith('valores-app-') || key.startsWith('valores-pwa-'))).map(key => caches.delete(key)));
        await self.clients.claim();
    })());
});
self.addEventListener('message', event => {
    if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.origin !== self.location.origin) return;
    const isApi = url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/functions/');
    const isVersion = url.pathname === '/version.json' || url.pathname === '/service-worker.js';
    if (isApi || isVersion) {
        event.respondWith(fetch(request, {cache: 'no-store'}).catch(() => new Response(JSON.stringify({error: 'Sin conexión. Se conservan los últimos datos disponibles.'}), {status: 503, headers: {'Content-Type': 'application/json'}})));
        return;
    }
    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
            const response = await fetch(request, {cache: 'no-store'});
            if (response.ok && response.type === 'basic') await cache.put(request.mode === 'navigate' ? '/index.html' : request, response.clone());
            return response;
        } catch (_) {
            return await cache.match(request.mode === 'navigate' ? '/index.html' : request)
                || new Response('No hay una copia disponible sin conexión.', {status: 503});
        }
    })());
});
