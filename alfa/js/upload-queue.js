// Configuración y constantes - REINTENTOS MEJORADOS
const CONFIG = {
  VERSION: "4.0.0",
  CACHE_TTL: 24 * 60 * 60 * 1000, // 24 horas en milisegundos
  MAX_IMAGE_SIZE: 800,
  MAX_CHUNK_SIZE: 50000,
  MAX_RETRIES: -1, // ✅ Reintentos ILIMITADOS
  RETRY_DELAY: 5000, // ✅ 5 segundos entre reintentos
  MAX_RETRY_DELAY: 60000 // ✅ Máximo 1 minuto entre reintentos
};

class UploadQueue {
  constructor() {
    console.log('🔄 Inicializando UploadQueue CON REINTENTOS ILIMITADOS...');
    this.queue = this.loadQueue();
    this.isProcessing = false;
    this.currentRetryCount = 0;
    this.initEventListeners();
    this.updateQueueCounter();
    this.processQueue();
    
    // Inicializar eventos
    this.initUIEvents();
    
    console.log('✅ UploadQueue inicializado con', this.queue.length, 'elementos en cola');
  }

  // ✅ NUEVO: Inicializar eventos de UI
  initUIEvents() {
    const queueCounter = document.getElementById('queueCounter');
    const closeQueueDetails = document.getElementById('closeQueueDetails');
    
    if (queueCounter) {
      queueCounter.addEventListener('click', this.toggleQueueDetails.bind(this));
    }
    
    if (closeQueueDetails) {
      closeQueueDetails.addEventListener('click', this.hideQueueDetails.bind(this));
    }
    
    document.addEventListener('click', (e) => {
      const queueDetails = document.getElementById('queueDetails');
      const queueCounter = document.getElementById('queueCounter');
      
      if (queueDetails && queueDetails.style.display === 'block' && 
          e.target !== queueDetails && 
          !queueDetails.contains(e.target) &&
          e.target !== queueCounter) {
        this.hideQueueDetails();
      }
    });
  }

  // ✅ MEJORADO: Agregar trabajo con verificación de datos
  addJob(job) {
    console.log('📦 Agregando trabajo a la cola:', job.type, job.factura);
    
    // Verificar que los datos esenciales estén presentes
    if (job.type === 'photo') {
      if (!job.data.fotoBase64) {
        console.error('❌ ERROR: Trabajo de foto sin datos base64');
        // Pero lo agregamos igual para que se reintente
      }
      
      if (!job.data.documento || !job.data.factura) {
        console.error('❌ ERROR: Trabajo de foto sin documento o factura');
        // Pero lo agregamos igual
      }
    }
    
    const newJob = {
      ...job,
      retries: 0,
      timestamp: new Date().toISOString(),
      status: 'pending',
      lastAttempt: null,
      lastError: null,
      id: this.generateJobId() // ✅ ID único para tracking
    };
    
    this.queue.push(newJob);
    this.saveQueue();
    this.updateQueueCounter();
    
    // Procesar inmediatamente si está online
    if (navigator.onLine) {
      this.processQueue();
    }
    
    return newJob.id;
  }

  // ✅ NUEVO: Generar ID único para trabajos
  generateJobId() {
    return 'job_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // ✅ MEJORADO: Procesar cola con manejo robusto de errores
  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }
    
    // Solo procesar si hay conexión
    if (!navigator.onLine) {
      console.log('🌐 Sin conexión - Esperando para procesar cola...');
      this.updateQueueCounter();
      return;
    }
    
    this.isProcessing = true;
    this.updateQueueCounter();
    
    console.log('🔄 PROCESANDO COLA con', this.queue.length, 'elementos...');
    
    try {
      while (this.queue.length > 0 && navigator.onLine) {
        const job = this.queue[0];
        
        try {
          console.log(`🎯 Procesando trabajo ${job.id} (reintento ${job.retries})...`);
          
          // Verificar si ya está confirmado
          const estaConfirmado = await this.verificarYDetenerSiConfirmado(job);
          if (estaConfirmado) {
            console.log(`✅ Trabajo ${job.id} ya confirmado - Eliminando`);
            this.queue.shift();
            this.saveQueue();
            this.updateQueueCounter();
            continue;
          }
          
          // Procesar según el tipo
          if (job.type === 'photo') {
            await this.processPhotoJob(job);
          } else if (job.type === 'data') {
            await this.processDataJob(job);
          }
          
          // ✅ ÉXITO: Eliminar trabajo completado
          console.log(`✅ Trabajo ${job.id} COMPLETADO exitosamente`);
          this.queue.shift();
          this.saveQueue();
          this.updateQueueCounter();
          
          // Resetear contador de reintentos
          this.currentRetryCount = 0;
          
        } catch (error) {
          await this.handleJobError(job, error);
          break; // Salir del bucle para reintentar después
        }
      }
    } catch (error) {
      console.error('❌ Error crítico en processQueue:', error);
    } finally {
      this.isProcessing = false;
      this.updateQueueCounter();
      console.log('⏹️ Procesamiento de cola finalizado');
    }
  }

  // ✅ NUEVO: Manejo robusto de errores por trabajo
  async handleJobError(job, error) {
    console.error(`❌ Error en trabajo ${job.id}:`, error);
    
    job.retries++;
    job.lastError = this.sanitizeErrorMessage(error);
    job.lastAttempt = new Date().toISOString();
    job.status = 'retrying';
    
    // Calcular delay exponencial para reintentos
    const delay = this.calculateRetryDelay(job.retries);
    
    console.log(`🔄 Reintentando trabajo ${job.id} en ${delay}ms (reintento ${job.retries})`);
    
    // Mover al final de la cola
    this.queue.push(this.queue.shift());
    this.saveQueue();
    this.updateQueueCounter();
    
    // Esperar antes del próximo intento
    await this.delay(delay);
  }

  // ✅ NUEVO: Calcular delay exponencial con backoff
  calculateRetryDelay(retryCount) {
    const baseDelay = CONFIG.RETRY_DELAY;
    const maxDelay = CONFIG.MAX_RETRY_DELAY;
    const delay = Math.min(baseDelay * Math.pow(2, retryCount - 1), maxDelay);
    
    // Agregar aleatoriedad para evitar sincronización
    const jitter = delay * 0.1 * Math.random();
    
    return delay + jitter;
  }

  // ✅ NUEVO: Delay helper
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ✅ NUEVO: Sanitizar mensajes de error
  sanitizeErrorMessage(error) {
    if (typeof error === 'string') return error;
    if (error.message) return error.message;
    if (error.toString) return error.toString();
    return 'Error desconocido';
  }

  // ✅ MEJORADO: Procesar trabajo de foto con múltiples intentos
  async processPhotoJob(job) {
    console.log(`📤 Subiendo foto para trabajo ${job.id}:`, job.factura);
    
    // Verificar datos mínimos requeridos
    if (!job.data.fotoBase64) {
      throw new Error('Datos de imagen faltantes');
    }
    
    if (!job.data.documento || !job.data.factura) {
      throw new Error('Datos de documento/factura faltantes');
    }
    
    const formData = new FormData();
    
    // ✅ AGREGAR TODOS los campos posibles
    const fields = [
      'documento', 'lote', 'referencia', 'cantidad', 'factura', 'nit',
      'fotoBase64', 'fotoNombre', 'fotoTipo', 'timestamp'
    ];
    
    fields.forEach(field => {
      if (job.data[field]) {
        formData.append(field, job.data[field]);
      }
    });
    
    // ✅ AGREGAR campos adicionales para debugging
    formData.append('uploadAttempt', job.retries + 1);
    formData.append('jobId', job.id);
    formData.append('appVersion', CONFIG.VERSION);
    
    console.log(`📊 Enviando ${formData.get('fotoBase64')?.length || 0} bytes de imagen`);
    
    // ✅ CONFIGURACIÓN ROBUSTA de fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos timeout
    
    try {
      const response = await fetch(API_URL_POST, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
        // No usar 'Content-Type' para FormData, el navegador lo establece automáticamente
      });
      
      clearTimeout(timeoutId);
      
      // ✅ VERIFICAR respuesta HTTP
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
      }
      
      // ✅ VERIFICAR respuesta JSON
      let result;
      try {
        result = await response.json();
      } catch (jsonError) {
        throw new Error(`Respuesta JSON inválida: ${jsonError.message}`);
      }
      
      // ✅ VERIFICAR éxito del servidor
      if (!result.success) {
        throw new Error(result.message || `Error del servidor: ${JSON.stringify(result)}`);
      }
      
      console.log(`✅ Foto subida exitosamente:`, result);
      
      // ✅ ACTUALIZAR UI si es necesario
      this.updateUIAfterSuccess(job);
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      // ✅ MANEJO ESPECÍFICO de errores comunes
      if (error.name === 'AbortError') {
        throw new Error('Timeout: La solicitud tardó demasiado');
      } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Error de red: No se pudo conectar al servidor');
      } else {
        throw error; // Re-lanzar otros errores
      }
    }
  }

  // ✅ NUEVO: Actualizar UI después de éxito
  updateUIAfterSuccess(job) {
    if (job.btnElementId) {
      const btnElement = document.querySelector(`[data-factura="${job.btnElementId}"]`);
      
      if (btnElement && !job.esSinFactura) {
        // Actualizar solo si el botón todavía existe y no es entrega sin factura
        setTimeout(() => {
          if (btnElement.parentNode) { // Verificar que todavía existe en el DOM
            btnElement.innerHTML = '<i class="fas fa-check-circle"></i> ENTREGA CONFIRMADA';
            btnElement.style.backgroundColor = '#28a745';
            btnElement.disabled = true;
          }
        }, 100);
      }
    }
  }

  // ✅ MEJORADO: Verificar confirmación con manejo de errores
  async verificarYDetenerSiConfirmado(job) {
    if (job.type !== 'photo') return false;
    
    const { documento, lote, referencia, cantidad, nit } = job.data;
    
    try {
      if (typeof window.verificarConfirmacionEnTiempoReal === 'function') {
        const confirmado = await window.verificarConfirmacionEnTiempoReal(
          documento, lote, referencia, cantidad, nit
        );
        
        if (confirmado) {
          console.log(`✅ Trabajo ${job.id} YA CONFIRMADO - Eliminando de cola`);
          return true;
        }
      }
    } catch (error) {
      console.warn(`⚠️ Error verificando confirmación para ${job.id}:`, error);
      // No lanzar error, continuar con el proceso normal
    }
    
    return false;
  }

  // ✅ MEJORADO: Guardar cola con verificación
  saveQueue() {
    try {
      // Limitar el tamaño de la cola para evitar problemas de almacenamiento
      if (this.queue.length > 100) {
        console.warn('⚠️ Cola muy grande, considerando limpieza:', this.queue.length);
        // Podrías implementar lógica para limpiar trabajos muy antiguos aquí
      }
      
      localStorage.setItem(UPLOAD_QUEUE_KEY, JSON.stringify(this.queue));
    } catch (e) {
      console.error('❌ Error CRÍTICO al guardar cola:', e);
      // Intentar limpiar cache si hay error de quota
      if (e.name === 'QuotaExceededError') {
        this.handleStorageQuotaExceeded();
      }
    }
  }

  // ✅ NUEVO: Manejar exceso de almacenamiento
  handleStorageQuotaExceeded() {
    console.warn('⚠️ Almacenamiento lleno - Limpiando trabajos antiguos...');
    
    // Mantener solo los últimos 50 trabajos
    if (this.queue.length > 50) {
      this.queue = this.queue.slice(-50);
      this.saveQueue();
      console.log('✅ Cola limpiada a 50 trabajos');
    }
  }

  // ✅ NUEVO: Forzar reintento de todos los trabajos fallidos
  forceRetryAll() {
    console.log('🔄 Forzando reintento de todos los trabajos...');
    
    this.queue.forEach(job => {
      if (job.status === 'retrying') {
        job.status = 'pending';
        job.lastError = null;
      }
    });
    
    this.saveQueue();
    this.updateQueueCounter();
    this.processQueue();
  }

  // ✅ NUEVO: Obtener estadísticas de la cola
  getQueueStats() {
    const stats = {
      total: this.queue.length,
      pending: this.queue.filter(j => j.status === 'pending').length,
      retrying: this.queue.filter(j => j.status === 'retrying').length,
      totalRetries: this.queue.reduce((sum, j) => sum + j.retries, 0),
      oldestJob: this.queue.length > 0 ? new Date(this.queue[0].timestamp) : null
    };
    
    return stats;
  }
}

// ✅ Hacer funciones disponibles globalmente para debugging
window.uploadQueue = new UploadQueue();

// ✅ Funciones de utilidad globales
window.forceQueueRetry = function() {
  if (window.uploadQueue) {
    window.uploadQueue.forceRetryAll();
  }
};

window.getQueueStats = function() {
  if (window.uploadQueue) {
    return window.uploadQueue.getQueueStats();
  }
  return null;
};

window.debugQueue = function() {
  if (window.uploadQueue) {
    console.log('=== DEBUG COLA ===');
    console.log('Estadísticas:', window.uploadQueue.getQueueStats());
    console.log('Trabajos:', window.uploadQueue.queue);
    console.log('=== FIN DEBUG ===');
  }
};
