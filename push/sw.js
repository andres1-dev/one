const CACHE_NAME = 'notifications-realtime-v1';
const SCHEDULED_NOTIFICATIONS_KEY = 'scheduledNotifications';
const HEARTBEAT_INTERVAL = 5000; // 5 segundos

// Instalación - Más agresiva
self.addEventListener('install', (event) => {
  console.log('🔄 Service Worker instalando...');
  self.skipWaiting(); // Activar inmediatamente
  event.waitUntil(self.skipWaiting());
});

// Activación - Tomar control inmediato
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker activado - Tomando control');
  event.waitUntil(
    Promise.all([
      self.clients.claim(), // Controlar clientes inmediatamente
      clearOldCaches(),
      initializeBackgroundSync()
    ])
  );
  
  // Iniciar procesos en background
  startBackgroundProcesses();
});

// Limpiar caches viejos
async function clearOldCaches() {
  const keys = await caches.keys();
  return Promise.all(
    keys.map(key => {
      if (key !== CACHE_NAME) {
        console.log('🗑️ Eliminando cache viejo:', key);
        return caches.delete(key);
      }
    })
  );
}

// Inicializar Background Sync
async function initializeBackgroundSync() {
  if ('periodicSync' in self.registration) {
    try {
      await self.registration.periodicSync.register('heartbeat', {
        minInterval: HEARTBEAT_INTERVAL
      });
      console.log('🫀 Periodic Sync registrado');
    } catch (error) {
      console.log('⚠️ Periodic Sync no disponible:', error);
    }
  }
}

// Procesos en background
function startBackgroundProcesses() {
  // Verificar notificaciones inmediatamente
  checkScheduledNotifications();
  
  // Heartbeat cada 5 segundos
  setInterval(() => {
    checkScheduledNotifications();
    cleanupExpiredNotifications();
  }, HEARTBEAT_INTERVAL);
  
  // Verificación agresiva cada 1 segundo por 30 segundos después de activar
  let aggressiveChecks = 0;
  const aggressiveInterval = setInterval(() => {
    checkScheduledNotifications();
    aggressiveChecks++;
    if (aggressiveChecks >= 30) {
      clearInterval(aggressiveInterval);
      console.log('🔚 Verificación agresiva completada');
    }
  }, 1000);
}

// Almacenamiento robusto
async function getScheduledNotifications() {
  try {
    // Primero intentar con IndexedDB para mejor performance
    const dbResult = await getFromIndexedDB();
    if (dbResult.length > 0) return dbResult;
    
    // Fallback a Cache API
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(SCHEDULED_NOTIFICATIONS_KEY);
    if (response) {
      const data = await response.json();
      await saveToIndexedDB(data); // Migrar a IndexedDB
      return data;
    }
    return [];
  } catch (error) {
    console.error('❌ Error obteniendo notificaciones:', error);
    return [];
  }
}

async function saveScheduledNotifications(notifications) {
  try {
    // Guardar en ambos almacenamientos
    await saveToIndexedDB(notifications);
    
    const cache = await caches.open(CACHE_NAME);
    const response = new Response(JSON.stringify(notifications));
    await cache.put(SCHEDULED_NOTIFICATIONS_KEY, response);
    
    console.log('💾 Notificaciones guardadas:', notifications.length);
  } catch (error) {
    console.error('❌ Error guardando notificaciones:', error);
  }
}

// IndexedDB para mejor performance
function getFromIndexedDB() {
  return new Promise((resolve) => {
    const request = indexedDB.open('NotificationsDB', 1);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('notifications')) {
        db.createObjectStore('notifications', { keyPath: 'id' });
      }
    };
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['notifications'], 'readonly');
      const store = transaction.objectStore('notifications');
      const getAll = store.getAll();
      
      getAll.onsuccess = () => resolve(getAll.result || []);
      getAll.onerror = () => resolve([]);
    };
    
    request.onerror = () => resolve([]);
  });
}

function saveToIndexedDB(notifications) {
  return new Promise((resolve) => {
    const request = indexedDB.open('NotificationsDB', 1);
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['notifications'], 'readwrite');
      const store = transaction.objectStore('notifications');
      
      // Limpiar y volver a agregar
      store.clear();
      notifications.forEach(notification => {
        store.add(notification);
      });
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    };
    
    request.onerror = () => resolve();
  });
}

// Verificación principal de notificaciones
async function checkScheduledNotifications() {
  try {
    const now = Date.now();
    const notifications = await getScheduledNotifications();
    const pending = [];
    const toSend = [];

    // Separar notificaciones pendientes y listas para enviar
    notifications.forEach(notification => {
      if (notification.scheduledTime <= now) {
        toSend.push(notification);
      } else {
        pending.push(notification);
      }
    });

    // Enviar notificaciones listas
    if (toSend.length > 0) {
      console.log(`🚀 Enviando ${toSend.length} notificaciones`);
      
      for (const notification of toSend) {
        await sendNotificationImmediately(notification);
      }
      
      // Actualizar almacenamiento
      await saveScheduledNotifications(pending);
      
      // Notificar a todos los clientes
      notifyClients('NOTIFICATIONS_SENT', { count: toSend.length });
    }

    // Programar siguiente verificación si hay pendientes
    if (pending.length > 0) {
      const nextCheck = Math.min(...pending.map(n => n.scheduledTime)) - now;
      if (nextCheck > 0 && nextCheck < HEARTBEAT_INTERVAL) {
        setTimeout(checkScheduledNotifications, nextCheck);
      }
    }
    
    return toSend.length;
  } catch (error) {
    console.error('❌ Error en checkScheduledNotifications:', error);
    return 0;
  }
}

// Envío inmediato de notificación
async function sendNotificationImmediately(notification) {
  const options = {
    body: notification.body,
    icon: './icon-192.png',
    badge: './icon-192.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: `ntf-${notification.id}`,
    requireInteraction: true,
    actions: [
      {
        action: 'open',
        title: '📱 Abrir App'
      },
      {
        action: 'close',
        title: '❌ Cerrar'
      }
    ],
    data: {
      id: notification.id,
      type: 'scheduled',
      timestamp: Date.now(),
      originalTime: notification.scheduledTime
    }
  };

  await self.registration.showNotification(notification.title, options);
  console.log('📨 Notificación enviada:', notification.title);
}

// Limpiar notificaciones expiradas
async function cleanupExpiredNotifications() {
  const now = Date.now();
  const hourAgo = now - (60 * 60 * 1000);
  const notifications = await getScheduledNotifications();
  const validNotifications = notifications.filter(n => n.scheduledTime > hourAgo);
  
  if (validNotifications.length !== notifications.length) {
    await saveScheduledNotifications(validNotifications);
    console.log('🧹 Notificaciones expiradas limpiadas');
  }
}

// Notificar a todos los clientes conectados
async function notifyClients(type, data) {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: type,
      data: data,
      timestamp: Date.now()
    });
  });
}

// Background Sync
self.addEventListener('sync', (event) => {
  console.log('🔄 Background Sync:', event.tag);
  
  if (event.tag.startsWith('notification-')) {
    event.waitUntil(checkScheduledNotifications());
  }
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'heartbeat') {
    event.waitUntil(checkScheduledNotifications());
  }
});

// Mensajes desde el cliente
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  console.log('📨 Mensaje del cliente:', type);
  
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
      
    case 'PING':
      event.ports[0]?.postMessage({
        type: 'PONG',
        timestamp: Date.now(),
        swVersion: 'realtime-v1'
      });
      break;
      
    case 'FORCE_CHECK':
      checkScheduledNotifications().then(count => {
        event.ports[0]?.postMessage({
          type: 'CHECK_COMPLETED',
          notificationsSent: count
        });
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
    
    // Programar verificación exacta
    const delay = notification.scheduledTime - Date.now();
    if (delay > 0 && delay <= 60000) { // Máximo 1 minuto para setTimeout
      setTimeout(() => {
        checkScheduledNotifications();
      }, delay);
    }
    
    // Registrar sync
    if ('sync' in self.registration) {
      self.registration.sync.register(`notification-${notification.id}`);
    }
    
    console.log('✅ Notificación programada:', notification.title);
  }
}

// Eliminar notificación
async function removeScheduledNotification(id) {
  const notifications = await getScheduledNotifications();
  const filtered = notifications.filter(n => n.id !== id);
  await saveScheduledNotifications(filtered);
  console.log('🗑️ Notificación eliminada:', id);
}

// Push notifications (para notificaciones entre usuarios)
self.addEventListener('push', (event) => {
  console.log('📲 Push recibido:', event);
  
  let data;
  try {
    data = event.data?.json() || {
      title: 'Notificación del Sistema',
      body: 'Nueva actualización disponible',
      timestamp: Date.now()
    };
  } catch (e) {
    data = {
      title: 'Notificación',
      body: event.data?.text() || 'Mensaje importante',
      timestamp: Date.now()
    };
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: `push-${Date.now()}`,
      data: data
    })
  );
});

// Clic en notificación
self.addEventListener('notificationclick', (event) => {
  console.log('👆 Notification click:', event.notification.tag);
  event.notification.close();

  const action = event.action;
  const notificationData = event.notification.data;

  if (action === 'open' || action === '') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        // Buscar cliente existente
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // Abrir nueva ventana
        if (self.clients.openWindow) {
          return self.clients.openWindow('./');
        }
      })
    );
  }
});

// Heartbeat para mantener activo el Service Worker
setInterval(() => {
  // Actividad mínima para mantener vivo el SW
  console.log('🫀 Service Worker activo');
}, 30000);