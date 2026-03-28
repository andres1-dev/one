// Sistema de caché con Firebase para evitar error 429 de Google Sheets
// Solo UNA pestaña recarga desde Sheets, las demás leen desde Firebase

class FirebaseCache {
  constructor() {
    this.isLeader = false;
    this.leaderCheckInterval = null;
    this.cacheRef = null;
    this.lastUpdate = 0;
    this.CACHE_DURATION = 10000; // 10 segundos
    this.LEADER_TIMEOUT = 15000; // 15 segundos
  }

  async init() {
    if (!window.isFirebaseInitialized) {
      console.warn('[Cache] Firebase no inicializado, usando modo directo');
      return;
    }

    this.cacheRef = window.firebaseDatabase.ref('sistema-documentos/cache');
    
    // Intentar ser líder
    await this.tryBecomeLeader();
    
    // Verificar liderazgo cada 5 segundos
    this.leaderCheckInterval = setInterval(() => {
      this.tryBecomeLeader();
    }, 5000);

    console.log('[Cache] Sistema de caché inicializado');
  }

  async tryBecomeLeader() {
    if (!this.cacheRef) return;

    try {
      const leaderRef = this.cacheRef.child('leader');
      const snapshot = await leaderRef.once('value');
      const leaderData = snapshot.val();
      const now = Date.now();

      // Si no hay líder o el líder expiró
      if (!leaderData || (now - leaderData.timestamp) > this.LEADER_TIMEOUT) {
        await leaderRef.set({
          timestamp: now,
          sessionId: this.getSessionId()
        });

        // Verificar que realmente somos el líder
        const verifySnapshot = await leaderRef.once('value');
        const verifyData = verifySnapshot.val();
        
        if (verifyData && verifyData.sessionId === this.getSessionId()) {
          if (!this.isLeader) {
            this.isLeader = true;
            console.log('[Cache] 👑 Soy el líder - Cargaré datos desde Sheets');
          }
          
          // Renovar liderazgo
          this.renewLeadership();
        }
      } else if (leaderData.sessionId === this.getSessionId()) {
        // Ya somos el líder, renovar
        this.isLeader = true;
        this.renewLeadership();
      } else {
        // Otro es el líder
        if (this.isLeader) {
          this.isLeader = false;
          console.log('[Cache] 📖 Ya no soy líder - Leeré desde Firebase');
        }
      }
    } catch (error) {
      console.error('[Cache] Error al verificar liderazgo:', error);
    }
  }

  async renewLeadership() {
    if (!this.cacheRef || !this.isLeader) return;

    try {
      await this.cacheRef.child('leader').update({
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('[Cache] Error al renovar liderazgo:', error);
    }
  }

  getSessionId() {
    if (!window.sessionId) {
      window.sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    return window.sessionId;
  }

  async shouldLoadFromSheets() {
    // Si Firebase no está disponible, siempre cargar desde Sheets
    if (!window.isFirebaseInitialized || !this.cacheRef) {
      return true;
    }

    // Si somos el líder, cargar desde Sheets
    if (this.isLeader) {
      return true;
    }

    // Si no somos líder, verificar si hay caché válido
    try {
      const dataSnapshot = await this.cacheRef.child('data').once('value');
      const cacheData = dataSnapshot.val();

      if (!cacheData || !cacheData.timestamp) {
        console.log('[Cache] No hay caché, esperando al líder...');
        return false;
      }

      const age = Date.now() - cacheData.timestamp;
      
      if (age > this.CACHE_DURATION) {
        console.log('[Cache] Caché expirado, esperando actualización del líder...');
        return false;
      }

      console.log('[Cache] Usando caché de Firebase (edad: ' + Math.round(age/1000) + 's)');
      return false;

    } catch (error) {
      console.error('[Cache] Error al verificar caché:', error);
      return false;
    }
  }

  async saveToCache(data) {
    if (!window.isFirebaseInitialized || !this.cacheRef || !this.isLeader) {
      return;
    }

    try {
      await this.cacheRef.child('data').set({
        timestamp: Date.now(),
        datosGlobales: data.datosGlobales || [],
        datosTablaDocumentos: data.datosTablaDocumentos || [],
        responsables: data.responsables || []
      });

      this.lastUpdate = Date.now();
      console.log('[Cache] ✅ Datos guardados en Firebase');
    } catch (error) {
      console.error('[Cache] Error al guardar en caché:', error);
    }
  }

  async loadFromCache() {
    if (!window.isFirebaseInitialized || !this.cacheRef) {
      return null;
    }

    try {
      const snapshot = await this.cacheRef.child('data').once('value');
      const cacheData = snapshot.val();

      if (!cacheData) {
        return null;
      }

      console.log('[Cache] 📦 Datos cargados desde Firebase');
      return {
        datosGlobales: cacheData.datosGlobales || [],
        datosTablaDocumentos: cacheData.datosTablaDocumentos || [],
        responsables: cacheData.responsables || [],
        timestamp: cacheData.timestamp
      };
    } catch (error) {
      console.error('[Cache] Error al cargar desde caché:', error);
      return null;
    }
  }

  async waitForCache(maxWaitTime = 5000) {
    if (!window.isFirebaseInitialized || !this.cacheRef) {
      return null;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log('[Cache] Timeout esperando caché');
        resolve(null);
      }, maxWaitTime);

      // Escuchar cambios en el caché
      const listener = this.cacheRef.child('data').on('value', (snapshot) => {
        const cacheData = snapshot.val();
        
        if (cacheData && cacheData.timestamp) {
          clearTimeout(timeout);
          this.cacheRef.child('data').off('value', listener);
          console.log('[Cache] ✅ Caché recibido del líder');
          resolve({
            datosGlobales: cacheData.datosGlobales || [],
            datosTablaDocumentos: cacheData.datosTablaDocumentos || [],
            responsables: cacheData.responsables || [],
            timestamp: cacheData.timestamp
          });
        }
      });
    });
  }

  destroy() {
    if (this.leaderCheckInterval) {
      clearInterval(this.leaderCheckInterval);
    }
    
    if (this.cacheRef && this.isLeader) {
      // Liberar liderazgo
      this.cacheRef.child('leader').remove();
    }
  }
}

// Instancia global
window.firebaseCache = new FirebaseCache();
