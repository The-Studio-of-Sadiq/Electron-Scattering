const CACHE_NAME = 'elsepa-pwa-v5';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  // Official ELSEPA Fortran compiled to WebAssembly + atomic data tables (offline simulations)
  '/elsepa/elsepa.js',
  '/elsepa/elsepa.wasm',
  '/elsepa/elsepa.data'
];

// Install event - Cache core static assets and discover Vite-built bundles
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(ASSETS_TO_CACHE);
      try {
        const htmlRes = await fetch('/index.html');
        if (htmlRes && htmlRes.ok) {
          const htmlText = await htmlRes.text();
          const matches = htmlText.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g);
          const assets = Array.from(matches, (m) => m[1]);
          if (assets.length > 0) {
            await cache.addAll(assets);
          }
          // Also pre-cache the WebAssembly worker script referenced in the bundle
          const mainJs = assets.find((a) => a.endsWith('.js'));
          if (mainJs) {
            const jsRes = await fetch(mainJs);
            if (jsRes && jsRes.ok) {
              const jsText = await jsRes.text();
              const workerMatch = jsText.match(/["'](\/assets\/[^"']*worker[^"']*\.js)["']/);
              if (workerMatch && workerMatch[1]) {
                await cache.add(workerMatch[1]);
              }
            }
          }
        }
      } catch (err) {
        // Continue even if dynamic asset discovery fails
      }
    }).then(() => self.skipWaiting())
  );
});

// Activate event - Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - Cache-first strategy for static assets, network-first with fallback for navigation
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip handling API requests (e.g. /api/simulate-fortran) so live backend calls hit the express server
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached response and fetch updated version in background
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse);
            });
          }
        }).catch(() => {/* Ignore network errors offline */});

        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // Fallback for document navigation when offline
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html').then((r) => r || caches.match('/'));
        }
      });
    })
  );
});
