/*
 * AniShelf service worker
 * Cache-first for the app shell; runtime cache for posters.
 * Bump CACHE_NAME whenever structural assets change significantly.
 */
const CACHE_NAME = 'anishelf-v4';
const SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './data/catalog.js',
  './js/app.js',
  './js/pwa.js',
  './assets/icons/icon.svg',
  './manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Posters are cached lazily: no 168-image download on first visit.
  if (url.pathname.includes('/assets/posters/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }))
    );
    return;
  }

  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
