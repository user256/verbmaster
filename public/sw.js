const CACHE_VERSION = 'verbmaster-v4';
const APP_SHELL = [
  '/',
  '/index.html',
  '/flashcards.html',
  '/verb.html',
  '/practicar.html',
  '/phrasemaster.html',
  '/style.css',
  '/nav.js',
  '/flashcard.js',
  '/audio-deck.js',
  '/conjugation-game.js',
  '/offline-data.js',
  '/offline-data.json',
  '/sets.js',
  '/verbmaster.svg',
  '/verbmaster.png',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/manifest.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_VERSION).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/mp3s/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then(cached =>
          cached || caches.match(url.pathname).then(shell => shell || caches.match('/index.html'))
        ))
    );
    return;
  }

  event.respondWith(cacheFirst(request));
});

function cacheFirst(request) {
  return caches.match(request).then(cached => {
    if (cached) return cached;
    return fetch(request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_VERSION).then(cache => cache.put(request, copy));
      return response;
    });
  });
}

function networkFirst(request) {
  return fetch(request).then(response => {
    const copy = response.clone();
    caches.open(CACHE_VERSION).then(cache => cache.put(request, copy));
    return response;
  }).catch(() => caches.match(request));
}
