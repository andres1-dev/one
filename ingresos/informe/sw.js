// sw.js
const CACHE_NAME = 'ingresos-marca-propia-v2';
const ASSETS_TO_CACHE = [
  '/one/ingresos/informe/icons/icon-192.png',
  '/one/ingresos/informe/icons/icon-512.png',
  '/one/ingresos/informe/icons/icon-512-maskable.png'
];

// Instalación y cacheo inicial
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// Activación y limpieza de versiones antiguas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// Estrategia de cache: Cache First con fallback a red
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
      .catch(() => caches.match('/one/ingresos/informe/generar.html'))
  );
});
