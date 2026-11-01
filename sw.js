/**
 * HAPP Service Worker — Offline-First PWA Caching
 * Uses Network-First with Cache Fallback for app shell files so GitHub Pages updates
 * appear immediately when online, while working 100% offline without internet.
 */

const CACHE_NAME = 'happ-pwa-v3';

const APP_SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/db.js',
  './js/staples.js',
  './js/engines/biometrics.js',
  './js/engines/ai-parser.js',
  './js/engines/charts.js',
  './assets/favicon.svg',
  './assets/favicon.png',
  './assets/apple-touch-icon.png',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Bypass external API requests (Gemini, USDA) so they always hit the network
  if (url.hostname.includes('googleapis.com') && !url.hostname.includes('fonts.googleapis.com')) {
    return;
  }
  if (url.hostname.includes('usda.gov')) {
    return;
  }

  event.respondWith(
    fetch(req)
      .then((networkRes) => {
        if (networkRes && networkRes.status === 200 && (url.origin === self.location.origin || url.hostname.includes('fonts.g'))) {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return networkRes;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
  );
});
