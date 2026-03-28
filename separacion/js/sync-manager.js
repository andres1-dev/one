// Gestor de sincronización en tiempo real entre pestañas/dispositivos

class SyncManager {
  constructor() {
    this.channel = null;
    this.swRegistration = null;
    this.isInitialized = false;
    this.onSyncCallback = null;
    this.firebaseRef = null;
    this.lastEventId = null;
  }

  async init(onSyncCallback) {
    this.onSyncCallback = onSyncCallback;

    // Registrar Service Worker
    if ('serviceWorker' in navigator) {
      try {
        // Detectar la ruta base del proyecto (funciona en subdirectorios de GitHub Pages)
        const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
        const swPath = basePath + 'sw.js';
        
        this.swRegistration = await navigator.serviceWorker.register(swPath, {
          scope: basePath
        });
        console.log('[Sync] Service Worker registrado en:', swPath);

        // Escuchar mensajes del Service Worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'FORCE_REFRESH') {
            console.log('[Sync] Actualización recibida desde otra pestaña:', event.data);
            if (this.onSyncCallback) {
              this.onSyncCallback(event.data);
            }
          }
        });
      } catch (error) {
        console.error('[Sync] Error al registrar Service Worker:', error);
      }
    }

    // Broadcast Channel API para sincronización entre pestañas del mismo navegador
    if ('BroadcastChannel' in window) {
      this.channel = new BroadcastChannel('documentos-sync');
      
      this.channel.onmessage = (event) => {
        console.log('[Sync] Mensaje recibido por Broadcast Channel:', event.data);
        if (this.onSyncCallback) {
          this.onSyncCallback(event.data);
        }
      };
    }

    // Firebase Realtime Database para sincronización entre dispositivos
    if (window.isFirebaseInitialized && window.firebaseDatabase) {
      try {
        this.firebaseRef = window.firebaseDatabase.ref('sistema-documentos/sync-events');
        
        // Escuchar nuevos eventos
        this.firebaseRef.on('child_added', (snapshot) => {
          const event = snapshot.val();
          
          // Ignorar eventos propios y eventos antiguos
          if (event && event.id !== this.lastEventId) {
            console.log('[Firebase] Evento recibido:', event);
            
            if (this.onSyncCallback) {
              this.onSyncCallback({
                type: 'FORCE_REFRESH',
                action: event.action,
                rec: event.rec,
                timestamp: event.timestamp,
                source: 'firebase'
              });
            }
          }
        });

        console.log('[Firebase] ✅ Escuchando cambios en tiempo real');
        
        // Limpiar eventos antiguos (más de 1 hora)
        this.cleanOldEvents();
        
      } catch (error) {
        console.error('[Firebase] Error al configurar listeners:', error);
      }
    } else {
      console.warn('[Firebase] ⚠️ No inicializado. Solo sincronización local.');
    }

    this.isInitialized = true;
    console.log('[Sync] Sistema de sincronización inicializado');
  }

  // Notificar cambios a otras pestañas/dispositivos
  notifyChange(action, rec = null, additionalData = {}) {
    if (!this.isInitialized) {
      console.warn('[Sync] Sistema no inicializado');
      return;
    }

    const eventId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.lastEventId = eventId;

    const message = {
      type: 'FORCE_REFRESH',
      action: action,
      rec: rec,
      timestamp: Date.now(),
      id: eventId,
      updateType: 'partial', // Indicar que es actualización parcial
      ...additionalData
    };

    // 1. Enviar por Broadcast Channel (pestañas del mismo navegador)
    if (this.channel) {
      this.channel.postMessage(message);
      console.log('[Sync] Mensaje enviado por Broadcast Channel');
    }

    // 2. Enviar por Service Worker
    if (this.swRegistration && this.swRegistration.active) {
      this.swRegistration.active.postMessage({
        type: 'SYNC_UPDATE',
        action: action,
        rec: rec,
        updateType: 'partial',
        ...additionalData
      });
      console.log('[Sync] Mensaje enviado al Service Worker');
    }

    // 3. Enviar por Firebase (sincronización entre dispositivos)
    if (window.isFirebaseInitialized && this.firebaseRef) {
      try {
        this.firebaseRef.push({
          action: action,
          rec: rec,
          timestamp: Date.now(),
          id: eventId,
          updateType: 'partial',
          ...additionalData
        });
        console.log('[Firebase] ✅ Evento enviado a Firebase');
      } catch (error) {
        console.error('[Firebase] Error al enviar evento:', error);
      }
    }
  }

  // Limpiar eventos antiguos de Firebase (más de 1 hora)
  cleanOldEvents() {
    if (!window.isFirebaseInitialized || !this.firebaseRef) return;

    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    this.firebaseRef.orderByChild('timestamp').endAt(oneHourAgo).once('value', (snapshot) => {
      const updates = {};
      snapshot.forEach((child) => {
        updates[child.key] = null;
      });
      
      if (Object.keys(updates).length > 0) {
        this.firebaseRef.update(updates);
        console.log('[Firebase] Limpiados', Object.keys(updates).length, 'eventos antiguos');
      }
    });
  }

  // Destruir conexiones
  destroy() {
    if (this.channel) {
      this.channel.close();
    }
    
    if (this.firebaseRef) {
      this.firebaseRef.off();
    }
    
    this.isInitialized = false;
  }
}

// Instancia global
window.syncManager = new SyncManager();
