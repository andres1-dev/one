// sw.js
const CACHE_NAME = 'pandadash-v4';

// Base URL relativa al lugar donde está este archivo sw.js
const BASE = (new URL('.', self.location)).href;

// Lista de assets relativa a la carpeta del SW (sin slash inicial)
const RELATIVE_ASSETS = [
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-512-maskable.png'
];

// Convierte a URLs absolutas usando la ubicación del sw.js
const ASSETS_TO_CACHE = RELATIVE_ASSETS.map(p => new URL(p, BASE).href);

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
    }).then(() => self.clients.claim())
  );
});

// Estrategia de cache: network-first para document y cache-first para otros
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Si la petición es para documentos HTML (navegación)
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then(response => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, responseClone));
          return response;
        })
        .catch(() => caches.match(req).then(cached => cached || caches.match(new URL('./', BASE).href)))
    );
    return;
  }

  // Para otros recursos: cache-first (sirve offline rápidamente)
  event.respondWith(
    caches.match(req)
      .then(cachedResponse => {
        if (cachedResponse) return cachedResponse;
        return fetch(req)
          .then(response => {
            // sólo cachear respuestas válidas
            if (!response || response.status !== 200 || response.type === 'opaque') return response;
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, responseToCache));
            return response;
          })
          .catch(() => {
            // fallback si no hay red ni cache; opcional: devolver icono placeholder o  fallback
            return caches.match(new URL('icons/icon-192.png', BASE).href);
          });
      })
  );
});
