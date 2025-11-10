const CACHE_NAME = 'notifications-realtime-v2';
const SCHEDULED_NOTIFICATIONS_KEY = 'scheduledNotifications';

// Instalación
self.addEventListener('install', (event) => {
  console.log('🔄 Service Worker instalando...');
  self.skipWaiting();
});

// Activación
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker activado');
  event.waitUntil(self.clients.claim());
  startBackgroundProcesses();
});

// Procesos en background
function startBackgroundProcesses() {
  // Verificar notificaciones inmediatamente
  checkScheduledNotifications();
  
  // Verificación cada 5 segundos
  setInterval(() => {
    checkScheduledNotifications();
  }, 5000);
}

// Almacenamiento simple y efectivo
async function getScheduledNotifications() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(SCHEDULED_NOTIFICATIONS_KEY);
    if (response) {
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    }
    return [];
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

// Verificación principal
async function checkScheduledNotifications() {
  try {
    const now = Date.now();
    const notifications = await getScheduledNotifications();
    const pending = [];
    const toSend = [];

    notifications.forEach(notification => {
      if (notification.scheduledTime <= now) {
        toSend.push(notification);
      } else {
        pending.push(notification);
      }
    });

    // Enviar notificaciones listas
    if (toSend.length > 0) {
      console.log(`Enviando ${toSend.length} notificaciones`);
      
      for (const notification of toSend) {
        await sendNotificationImmediately(notification);
      }
      
      // Actualizar almacenamiento
      await saveScheduledNotifications(pending);
    }

  } catch (error) {
    console.error('Error en checkScheduledNotifications:', error);
  }
}

// Envío de notificación
async function sendNotificationImmediately(notification) {
  const options = {
    body: notification.body,
    icon: './icon-192.png',
    badge: './icon-192.png',
    vibrate: [200, 100, 200],
    tag: `ntf-${notification.id}`,
    requireInteraction: true,
    data: {
      id: notification.id,
      type: 'scheduled'
    }
  };

  await self.registration.showNotification(notification.title, options);
  console.log('Notificación enviada:', notification.title);
}

// Mensajes desde el cliente
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'ADD_SCHEDULED_NOTIFICATION':
      addScheduledNotification(data);
      break;
      
    case 'REMOVE_SCHEDULED_NOTIFICATION':
      removeScheduledNotification(data.id);
      break;
      
    case 'GET_SCHEDULED_NOTIFICATIONS':
      event.ports[0]?.postMessage({
        type: 'SCHEDULED_NOTIFICATIONS',
        notifications: getScheduledNotifications()
      });
      break;
  }
});

// Agregar notificación
async function addScheduledNotification(notification) {
  const notifications = await getScheduledNotifications();
  
  // Evitar duplicados
  if (!notifications.find(n => n.id === notification.id)) {
    notifications.push(notification);
    await saveScheduledNotifications(notifications);
    
    console.log('Notificación programada:', notification.title);
  }
}

// Eliminar notificación
async function removeScheduledNotification(id) {
  const notifications = await getScheduledNotifications();
  const filtered = notifications.filter(n => n.id !== id);
  await saveScheduledNotifications(filtered);
}

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {
    title: 'Notificación',
    body: 'Nueva notificación'
  };

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icon-192.png',
      badge: './icon-192.png'
    })
  );
});

// Clic en notificación
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('./');
      }
    })
  );
});