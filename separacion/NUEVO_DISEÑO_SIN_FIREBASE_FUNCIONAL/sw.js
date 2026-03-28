// Service Worker para sincronización en tiempo real
// NO CACHEA NADA - Solo maneja sincronización entre pestañas

const SW_VERSION = 'v1.0.0';

// Instalación - sin caché
self.addEventListener('install', (event) => {
  console.log('[SW] Instalado:', SW_VERSION);
  self.skipWaiting();
});

// Activación - limpiar versiones antiguas
self.addEventListener('activate', (event) => {
  console.log('[SW] Activado:', SW_VERSION);
  event.waitUntil(clients.claim());
});

// NO interceptamos fetch - dejamos que todo vaya directo a la red
self.addEventListener('fetch', (event) => {
  // Pasamos todas las peticiones directamente a la red
  return;
});

// Escuchar mensajes de los clientes para sincronización
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SYNC_UPDATE') {
    // Notificar a todos los clientes excepto el que envió el mensaje
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        clientList.forEach((client) => {
          if (client.id !== event.source.id) {
            client.postMessage({
              type: 'FORCE_REFRESH',
              action: event.data.action,
              rec: event.data.rec,
              timestamp: Date.now()
            });
          }
        });
      })
    );
  }
});
