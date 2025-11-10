// Service Worker para notificaciones push
const CACHE_NAME = 'notifications-app-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Instalación del Service Worker
self.addEventListener('install', function(event) {
  console.log('Service Worker instalado');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Cache abierto');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activación del Service Worker
self.addEventListener('activate', function(event) {
  console.log('Service Worker activado');
  
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('Eliminando cache viejo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Interceptar fetch requests
self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Devuelve la respuesta del cache o fetch de la red
        return response || fetch(event.request);
      }
    )
  );
});

// Manejar notificaciones push
self.addEventListener('push', function(event) {
  console.log('Evento push recibido:', event);
  
  let options = {
    body: event.data ? event.data.text() : '¡Tienes una nueva notificación!',
    icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMzIiIGN5PSIzMiIgcj0iMzIiIGZpbGw9IiM2YTExY2IiLz4KPHBhdGggZD0iTTM0LjUgMjZIMzJWMzZIMzRINTBWMzRIMzQuNVYyNloiIGZpbGw9IndoaXRlIi8+CjxjaXJjbGUgY3g9IjQwIiBjeT0iMjIiIHI9IjQiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo=',
    badge: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMzIiIGN5PSIzMiIgcj0iMzIiIGZpbGw9IiNGRjQwODEiLz4KPC9zdmc+Cg==',
    vibrate: [200, 100, 200],
    data: {
      url: 'https://tu-dominio.com'
    }
  };

  event.waitUntil(
    self.registration.showNotification('Notificación Push', options)
  );
});

// Manejar clics en notificaciones
self.addEventListener('notificationclick', function(event) {
  console.log('Notificación clickeada:', event);
  
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({type: 'window'})
      .then(function(clientList) {
        // Si ya hay una ventana abierta, enfócala
        for (let client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Si no hay ventanas abiertas, abre una nueva
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});