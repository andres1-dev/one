// sw.js
const CACHE_NAME = 'ingresos-marca-propia-v1';
const ASSETS_TO_CACHE = [
  '/one/ingresos/informe/generar.html',
  //'/one/ingresos/informe/styles.css',
  //'/one/ingresos/informe/script.js',
  //'/one/ingresos/informe/icon-192.png',
  //'/one/ingresos/informe/icon-512.png'
  // Agrega aquí otros recursos que quieras cachear
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        return response || fetch(event.request);
      })
  );
});
