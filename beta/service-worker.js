const CACHE_NAME = 'pandadash-v4.0.0-one';
const urlsToCache = [
  '/one/beta/',
  '/one/beta/index.html',
  '/one/beta/manifest.json',
  '/one/beta/css/styles.css',
  '/one/beta/js/config.js',
  '/one/beta/js/keyboard-blocker.js',
  '/one/beta/js/upload-queue.js',
  '/one/beta/js/camera.js',
  '/one/beta/js/asentar-factura.js',
  '/one/beta/js/main.js',
  '/one/beta/icons/icon-192x192.png',
  '/one/beta/icons/icon-512x512.png'
];

// Instalación
self.addEventListener('install', event => {
  console.log('🔄 Service Worker instalando para /one/beta/...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('✅ Cache abierto para /one/beta/');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('✅ Todos los recursos cacheados para /one/beta/');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('❌ Error durante la instalación:', error);
      })
  );
});

// Activación
self.addEventListener('activate', event => {
  console.log('🔄 Service Worker activando para /one/beta/...');
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
      console.log('✅ Service Worker activado para /one/beta/');
      return self.clients.claim();
    })
  );
});

// Fetch
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  
  // Solo manejar requests dentro del scope /one/beta/
  if (!requestUrl.pathname.startsWith('/one/beta/')) {
    return;
  }

  // Para las APIs, siempre ir a red primero
  if (event.request.url.includes('/macros/s/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            return response;
          }
          throw new Error('Network response was not ok');
        })
        .catch(error => {
          console.log('🌐 Fetch failed for API:', error);
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
            // Si es una página, devolvemos el index.html
            if (event.request.destination === 'document') {
              return caches.match('/one/beta/index.html');
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
