// sw.js
const CACHE_NAME = 'pandadash-v4';
const ASSETS_TO_CACHE = [
  '/one/beta/icons/icon-192.png',
  '/one/beta/icons/icon-512.png',
  '/one/beta/icons/icon-512-maskable.png'
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
    }).then(() => self.clients.claim())
  );
});

// Estrategia de cache: Network First con fallback a cache
self.addEventListener('fetch', (event) => {
  // Para archivos HTML, usar Network First
  if (event.request.url.includes('/one/beta/') && 
      event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Clonar la respuesta para guardarla en cache
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => {
          return caches.match(event.request)
            .then(cachedResponse => cachedResponse || caches.match('/one/beta/'));
        })
    );
    return;
  }
  
  // Para otros recursos (CSS, JS, etc.), usar Cache First
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request)
          .then(response => {
            // No cachear respuestas que no son exitosas
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            // Clonar la respuesta para guardarla en cache
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            return response;
          });
      })
      .catch(() => {
        // Fallback para cuando no hay conexión y no está en cache
        if (event.request.destination === 'document') {
          return caches.match('/one/beta/');
        }
      })
  );
});
