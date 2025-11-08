const CACHE_NAME = 'pandadash-v4.0.0';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/config.js',
  './js/keyboard-blocker.js',
  './js/upload-queue.js',
  './js/camera.js',
  './js/asentar-factura.js',
  './js/main.js',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];

// Instalación
self.addEventListener('install', event => {
  console.log('🔄 Service Worker instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('✅ Cache abierto');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('✅ Todos los recursos cacheados');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('❌ Error durante la instalación:', error);
      })
  );
});

// Activación
self.addEventListener('activate', event => {
  console.log('🔄 Service Worker activando...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Eliminando cache viejo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker activado');
      return self.clients.claim();
    })
  );
});

// Fetch
self.addEventListener('fetch', event => {
  // Para las APIs, siempre ir a red primero
  if (event.request.url.includes('/macros/s/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Si la respuesta es válida, la devolvemos
          if (response && response.status === 200) {
            return response;
          }
          throw new Error('Network response was not ok');
        })
        .catch(error => {
          console.log('🌐 Fetch failed, returning offline page:', error);
          // En caso de error, podrías devolver una respuesta de caché si tienes una
          return caches.match(event.request);
        })
    );
    return;
  }

  // Para recursos estáticos, usar cache primero
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Devuelve la respuesta en caché o busca en la red
        return response || fetch(event.request)
          .then(fetchResponse => {
            // Si es una respuesta válida, la guardamos en caché
            if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
              return fetchResponse;
            }

            const responseToCache = fetchResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return fetchResponse;
          })
          .catch(error => {
            console.log('🌐 Fetch failed:', error);
            // Si es una página, podrías devolver una página offline
            if (event.request.destination === 'document') {
              return caches.match('./index.html');
            }
          });
      })
  );
});

// Manejar mensajes desde la app
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
