// ═══════════════════════════════════════════════════════
// NEON SURGE — Service Worker
// Caches all game assets for full offline play
// ═══════════════════════════════════════════════════════

const CACHE_NAME = 'neon-surge-v1';
const CACHE_URLS = [
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // Google Fonts — cached on first load for offline use
  'https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700;900&family=Raleway:wght@300;400;600;700&display=swap',
];

// ── INSTALL: pre-cache core assets ─────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache what we can; fonts may fail on first install (offline), that's fine
      return Promise.allSettled(
        CACHE_URLS.map(url =>
          cache.add(url).catch(() => console.warn('[SW] Could not cache:', url))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: clean old caches ──────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: network-first for fonts, cache-first for game ─
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // For Google Fonts: network first, fall back to cache
  if (url.hostname.includes('fonts.g')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // For everything else: cache first, then network, update cache in background
  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request).then(response => {
        if (response && response.status === 200 && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => null);

      return cached || networkFetch;
    })
  );
});

// ── MESSAGE: force update ───────────────────────────────
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
