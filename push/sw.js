const CACHE_NAME = 'notifications-pwa-v3';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Almacén para notificaciones programadas
const SCHEDULED_NOTIFICATIONS_KEY = 'scheduledNotifications';

// Instalación
self.addEventListener('install', function(event) {
  console.log('Service Worker instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Cache abierto');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Activación
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
    }).then(() => {
      // Verificar notificaciones programadas al activar
      checkScheduledNotifications();
    })
  );
  self.clients.claim();
});

// Fetch
self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

// Background Sync para notificaciones programadas
self.addEventListener('sync', function(event) {
  console.log('Background sync:', event.tag);
  if (event.tag === 'scheduled-notifications') {
    event.waitUntil(checkScheduledNotifications());
  }
});

// Periodic Sync (para verificar cada cierto tiempo)
self.addEventListener('periodicsync', function(event) {
  if (event.tag === 'check-notifications') {
    console.log('Periodic sync para notificaciones');
    event.waitUntil(checkScheduledNotifications());
  }
});

// Función para verificar notificaciones programadas
async function checkScheduledNotifications() {
  try {
    const result = await getScheduledNotifications();
    const now = Date.now();
    const notificationsToSend = [];
    const notificationsToKeep = [];

    // Verificar cada notificación programada
    for (const notification of result) {
      if (notification.scheduledTime <= now) {
        // Es hora de enviar la notificación
        notificationsToSend.push(notification);
      } else {
        // Mantener la notificación para el futuro
        notificationsToKeep.push(notification);
      }
    }

    // Enviar notificaciones pendientes
    for (const notification of notificationsToSend) {
      await sendScheduledNotification(notification);
    }

    // Actualizar el almacenamiento
    if (notificationsToSend.length > 0) {
      await saveScheduledNotifications(notificationsToKeep);
    }

    console.log(`Enviadas ${notificationsToSend.length} notificaciones programadas`);

  } catch (error) {
    console.error('Error verificando notificaciones programadas:', error);
  }
}

// Función para enviar notificación programada
async function sendScheduledNotification(notification) {
  const options = {
    body: notification.body + ' (Programada)',
    icon: './icon-192.png',
    badge: './icon-192.png',
    vibrate: [200, 100, 200],
    tag: `scheduled-${notification.id}`,
    requireInteraction: true,
    data: {
      url: './',
      scheduled: true,
      id: notification.id
    }
  };

  await self.registration.showNotification(notification.title, options);
  console.log('Notificación programada enviada:', notification.title);
}

// Almacenar notificaciones programadas
async function saveScheduledNotifications(notifications) {
  const data = {
    notifications: notifications,
    lastUpdated: Date.now()
  };
  
  const cache = await caches.open(CACHE_NAME);
  const response = new Response(JSON.stringify(data));
  await cache.put(SCHEDULED_NOTIFICATIONS_KEY, response);
}

// Obtener notificaciones programadas
async function getScheduledNotifications() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(SCHEDULED_NOTIFICATIONS_KEY);
    
    if (!response) {
      return [];
    }
    
    const data = await response.json();
    return data.notifications || [];
  } catch (error) {
    console.error('Error obteniendo notificaciones programadas:', error);
    return [];
  }
}

// Agregar notificación programada (llamado desde el cliente)
async function addScheduledNotification(notification) {
  const existing = await getScheduledNotifications();
  existing.push(notification);
  await saveScheduledNotifications(existing);
  
  // Programar sync para el momento de la notificación
  const delay = notification.scheduledTime - Date.now();
  if (delay > 0) {
    setTimeout(() => {
      self.registration.sync.register('scheduled-notifications');
    }, Math.min(delay, 24 * 60 * 60 * 1000)); // Máximo 24 horas
  }
}

// Eliminar notificación programada
async function removeScheduledNotification(id) {
  const existing = await getScheduledNotifications();
  const filtered = existing.filter(n => n.id !== id);
  await saveScheduledNotifications(filtered);
}

// Push notifications
self.addEventListener('push', function(event) {
  console.log('Push event recibido');
  
  let data = {
    title: 'Notificación Push',
    body: '¡Tienes una nueva notificación!',
    icon: './icon-192.png'
  };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || './icon-192.png',
    badge: './icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || './'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click
self.addEventListener('notificationclick', function(event) {
  console.log('Notification click recibido');
  event.notification.close();

  event.waitUntil(
    clients.matchAll({type: 'window'}).then(function(clientList) {
      for (const client of clientList) {
        if (client.url.includes('./') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('./');
      }
    })
  );
});

// Mensajes desde el cliente
self.addEventListener('message', function(event) {
  console.log('Mensaje recibido en SW:', event.data);
  
  switch (event.data.type) {
    case 'ADD_SCHEDULED_NOTIFICATION':
      addScheduledNotification(event.data.notification);
      break;
      
    case 'REMOVE_SCHEDULED_NOTIFICATION':
      removeScheduledNotification(event.data.id);
      break;
      
    case 'GET_SCHEDULED_NOTIFICATIONS':
      event.ports[0].postMessage({
        type: 'SCHEDULED_NOTIFICATIONS',
        notifications: getScheduledNotifications()
      });
      break;
  }
});

// Verificar notificaciones cada minuto (fallback)
setInterval(() => {
  checkScheduledNotifications();
}, 60000);