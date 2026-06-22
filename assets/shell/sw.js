// LAN Arcade Service Worker — Network-First Strategy
// Bump this version whenever you want to force a cache clear.
const CACHE_VERSION = 'arcade-v3';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;

// Asset types that benefit from caching (images, fonts, etc.)
const CACHEABLE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.woff', '.woff2'];

// On install: activate immediately — don't wait for old SW to die.
self.addEventListener('install', () => {
  self.skipWaiting();
});

// On activate: delete ALL old caches from previous versions, then claim clients.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE)
          .map((key) => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch handler: network-first for everything except static assets.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip non-same-origin and WebSocket requests entirely.
  if (url.origin !== self.location.origin) return;
  if (url.protocol === 'ws:' || url.protocol === 'wss:') return;

  // For images/fonts: cache-first (they don't change often).
  const ext = url.pathname.toLowerCase();
  const isStaticAsset = CACHEABLE_EXTENSIONS.some((e) => ext.endsWith(e));

  if (isStaticAsset) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((response) => {
            if (response && response.status === 200) {
              cache.put(event.request, response.clone());
            }
            return response;
          });
        })
      )
    );
    return;
  }

  // For HTML / JS / CSS / API: NETWORK FIRST — always try server first.
  // Falls back to cache only if the network is unavailable.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Don't cache error responses or opaque responses.
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Network failed — serve from cache as a fallback.
        return caches.match(event.request);
      })
  );
});
