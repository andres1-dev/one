// Service Worker simplificado para notificaciones
self.addEventListener('install', function(event) {
  console.log('Service Worker instalado');
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('Service Worker activado');
  return self.clients.claim();
});

// Manejar notificaciones push
self.addEventListener('push', function(event) {
  console.log('Push event recibido');
  
  const options = {
    body: event.data ? event.data.text() : '¡Nueva notificación!',
    icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMzIiIGN5PSIzMiIgcj0iMzIiIGZpbGw9IiM2YTExY2IiLz4KPHBhdGggZD0iTTM0LjUgMjZIMzJWMzZIMzRINTBWMzRIMzQuNVYyNloiIGZpbGw9IndoaXRlIi8+CjxjaXJjbGUgY3g9IjQwIiBjeT0iMjIiIHI9IjQiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo=',
    badge: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMzIiIGN5PSIzMiIgcj0iMzIiIGZpbGw9IiNGRjQwODEiLz4KPC9zdmc+Cg==',
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification('Notificación Push', options)
  );
});

// Manejar clics en notificaciones
self.addEventListener('notificationclick', function(event) {
  console.log('Notificación clickeada');
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({type: 'window'}).then(function(clientList) {
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});