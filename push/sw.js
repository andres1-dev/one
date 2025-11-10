const CACHE_NAME = 'notifications-pwa-v4';
const SCHEDULED_NOTIFICATIONS_KEY = 'scheduledNotifications';

// Instalación
self.addEventListener('install', function(event) {
  console.log('Service Worker instalando...');
  self.skipWaiting();
});

// Activación
self.addEventListener('activate', function(event) {
  console.log('Service Worker activado');
  event.waitUntil(self.clients.claim());
  
  // Verificar notificaciones pendientes inmediatamente
  checkScheduledNotifications();
});

// Almacenamiento mejorado
async function getScheduledNotifications() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(SCHEDULED_NOTIFICATIONS_KEY);
    return response ? await response.json() : [];
  } catch (error) {
    console.error('Error obteniendo notificaciones:', error);
    return [];
  }
}

async function saveScheduledNotifications(notifications) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = new Response(JSON.stringify(notifications));
    await cache.put(SCHEDULED_NOTIFICATIONS_KEY, response);
  } catch (error) {
    console.error('Error guardando notificaciones:', error);
  }
}

// Verificar notificaciones programadas
async function checkScheduledNotifications() {
  try {
    const notifications = await getScheduledNotifications();
    const now = Date.now();
    const pending = [];
    const toSend = [];

    for (const notification of notifications) {
      if (notification.scheduledTime <= now) {
        toSend.push(notification);
      } else {
        pending.push(notification);
      }
    }

    // Enviar notificaciones pendientes
    for (const notification of toSend) {
      await sendNotification(notification);
    }

    // Guardar las que quedan pendientes
    if (toSend.length > 0) {
      await saveScheduledNotifications(pending);
    }

    console.log(`Enviadas ${toSend.length} notificaciones programadas`);
    
    // Programar siguiente verificación si hay notificaciones pendientes
    if (pending.length > 0) {
      const nextCheck = Math.min(...pending.map(n => n.scheduledTime)) - Date.now();
      setTimeout(checkScheduledNotifications, Math.max(nextCheck, 1000));
    }
  } catch (error) {
    console.error('Error en checkScheduledNotifications:', error);
  }
}

// Enviar notificación
async function sendNotification(notification) {
  const options = {
    body: notification.body,
    icon: './icon-192.png',
    badge: './icon-192.png',
    vibrate: [200, 100, 200],
    tag: `scheduled-${notification.id}`,
    requireInteraction: false,
    data: {
      url: './',
      scheduled: true,
      id: notification.id
    }
  };

  await self.registration.showNotification(notification.title, options);
  console.log('Notificación enviada:', notification.title);
}

// Background Sync para notificaciones
self.addEventListener('sync', function(event) {
  if (event.tag === 'check-notifications') {
    console.log('Background Sync ejecutado');
    event.waitUntil(checkScheduledNotifications());
  }
});

// Periodic Sync (cada 30 segundos como fallback)
self.addEventListener('periodicsync', function(event) {
  if (event.tag === 'periodic-notification-check') {
    console.log('Periodic Sync ejecutado');
    event.waitUntil(checkScheduledNotifications());
  }
});

// Mensajes desde el cliente
self.addEventListener('message', function(event) {
  console.log('Mensaje del cliente:', event.data);
  
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
      
    case 'CHECK_NOW':
      checkScheduledNotifications();
      break;
  }
});

// Agregar notificación programada
async function addScheduledNotification(notification) {
  const notifications = await getScheduledNotifications();
  notifications.push(notification);
  await saveScheduledNotifications(notifications);
  
  // Programar verificación para el momento exacto
  const delay = notification.scheduledTime - Date.now();
  if (delay > 0) {
    setTimeout(() => {
      checkScheduledNotifications();
    }, delay);
  }
  
  // Registrar sync para background
  if ('sync' in self.registration) {
    self.registration.sync.register('check-notifications');
  }
}

// Eliminar notificación programada
async function removeScheduledNotification(id) {
  const notifications = await getScheduledNotifications();
  const filtered = notifications.filter(n => n.id !== id);
  await saveScheduledNotifications(filtered);
}

// Push notifications
self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {
    title: 'Notificación Push',
    body: '¡Tienes una nueva notificación!'
  };

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icon-192.png',
      badge: './icon-192.png'
    })
  );
});

// Notification click
self.addEventListener('notificationclick', function(event) {
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

// Verificación cada 10 segundos (fallback robusto)
setInterval(() => {
  checkScheduledNotifications();
}, 10000);