const CACHE_NAME = 'ricebox-pos-v24';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './config.js',
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-512.png',
  './assets/channel-lineman.svg',
  './assets/channel-grabfood.svg',
  './assets/channel-shopeefood.svg',
  './assets/channel-foodpanda.svg',
  './assets/channel-robinhood.svg',
  './assets/menu-kaprao.jpg',
  './assets/menu-oyster-pork.jpg',
  './assets/menu-fried-rice-pork.jpg',
  './assets/menu-garlic-pork.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((key) => (key === CACHE_NAME ? null : caches.delete(key)))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    event.respondWith(fetch(event.request));
    return;
  }

  const shouldRefresh =
    event.request.mode === 'navigate' ||
    ['script', 'style'].includes(event.request.destination) ||
    requestUrl.pathname.endsWith('/index.html') ||
    requestUrl.pathname.endsWith('/config.js') ||
    requestUrl.pathname.endsWith('/manifest.json');

  if (shouldRefresh) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    })
  );
});
