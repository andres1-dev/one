// Configuración y constantes
const CONFIG = {
  VERSION: "4.0.0",
  CACHE_TTL: 24 * 60 * 60 * 1000, // 24 horas en milisegundos
  MAX_IMAGE_SIZE: 800, // Tamaño máximo para redimensionar imágenes
  MAX_CHUNK_SIZE: 50000, // ~50KB por solicitud
  MAX_RETRIES: -1, // -1 para reintentos ilimitados
  RETRY_DELAY: 3000 // 3 segundos entre reintentos
};

// API URLs
const API_URL_POST = "https://script.google.com/macros/s/AKfycbwgnkjVCMWlWuXnVaxSBD18CGN3rXGZtQZIvX9QlBXSgbQndWC4uqQ2sc00DuNH6yrb/exec";

// Constantes para la cola de carga
const UPLOAD_QUEUE_KEY = 'pdaUploadQueue';

// Clase para gestionar la cola de carga con reintentos ilimitados
class UploadQueue {
  constructor() {
    this.queue = this.loadQueue();
    this.isProcessing = false;
    this.initEventListeners();
    this.updateQueueCounter();
    this.processQueue(); // Intentar procesar cola al iniciar
    
    // Inicializar eventos para el contador de cola
    const queueCounter = document.getElementById('queueCounter');
    const closeQueueDetails = document.getElementById('closeQueueDetails');
    
    if (queueCounter) {
      queueCounter.addEventListener('click', this.toggleQueueDetails.bind(this));
    }
    
    if (closeQueueDetails) {
      closeQueueDetails.addEventListener('click', this.hideQueueDetails.bind(this));
    }
    
    // Cerrar detalles al hacer clic fuera
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
  
  loadQueue() {
    try {
      const saved = localStorage.getItem(UPLOAD_QUEUE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Error al cargar la cola:", e);
      return [];
    }
  }

  saveQueue() {
    try {
      localStorage.setItem(UPLOAD_QUEUE_KEY, JSON.stringify(this.queue));
    } catch (e) {
      console.error("Error al guardar la cola:", e);
    }
  }
  
  addJob(job) {
    // ✅ CORRECCIÓN: Agregar ID único y más propiedades
    const newJob = {
      ...job,
      id: 'job_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      retries: 0,
      timestamp: new Date().toISOString(),
      status: 'pending',
      lastError: null,
      lastAttempt: null
    };
    
    this.queue.push(newJob);
    this.saveQueue();
    this.updateQueueCounter();
    this.processQueue();
    
    return newJob.id;
  }
  
  initEventListeners() {
    window.addEventListener('online', () => {
      console.log('🌐 Conexión restablecida - Procesando cola...');
      if (this.queue.length > 0) {
        this.processQueue();
      }
    });
  }
  
  updateQueueCounter() {
    const counter = document.getElementById('queueCounter');
    const queueItemsList = document.getElementById('queueItemsList');
    
    if (!counter) return;
    
    if (this.queue.length === 0) {
      counter.textContent = '0';
      counter.className = 'empty';
      counter.title = 'No hay elementos en cola';
      if (queueItemsList) {
        queueItemsList.innerHTML = '<div class="queue-no-items">No hay elementos pendientes</div>';
      }
    } else {
      counter.textContent = this.queue.length;
      counter.className = this.isProcessing ? 'processing' : '';
      counter.title = `${this.queue.length} elementos pendientes`;
      
      // Actualizar la lista de elementos
      this.updateQueueItemsList();
    }
  }
  
  updateQueueItemsList() {
    const queueItemsList = document.getElementById('queueItemsList');
    
    if (!queueItemsList) return;
    
    if (this.queue.length === 0) {
      queueItemsList.innerHTML = '<div class="queue-no-items">No hay elementos pendientes</div>';
      return;
    }
    
    queueItemsList.innerHTML = '';
    
    this.queue.forEach((item, index) => {
      const itemElement = document.createElement('div');
      itemElement.className = `queue-item-card ${item.status === 'retrying' ? 'retrying' : ''}`;
      
      let previewContent = '';
      let thumbnail = '';
      
      if (item.type === 'photo') {
        previewContent = `Factura: ${item.factura || 'N/A'}`;
        if (item.data.fotoBase64) {
          // ✅ CORRECCIÓN: Mostrar miniatura siempre visible
          thumbnail = `<img src="data:image/jpeg;base64,${item.data.fotoBase64}" class="queue-thumbnail" style="display: block;">`;
        }
      } else if (item.type === 'data') {
        previewContent = `Datos: ${JSON.stringify(item.data).substring(0, 50)}...`;
      }
      
      let statusInfo = '';
      if (item.status === 'retrying') {
        statusInfo = `<div class="queue-item-status retrying">Reintentando (${item.retries})</div>`;
      } else if (item.lastError) {
        statusInfo = `<div class="queue-item-status error">Error: ${item.lastError}</div>`;
      } else {
        statusInfo = `<div class="queue-item-status">En espera</div>`;
      }
      
      itemElement.innerHTML = `
        <div class="queue-item-header">
          <span>${item.type === 'photo' ? '📷 Foto' : '📊 Datos'}</span>
          <span class="queue-item-type">${new Date(item.timestamp).toLocaleTimeString()}</span>
        </div>
        <div class="queue-item-preview">${previewContent}</div>
        ${thumbnail}
        ${statusInfo}
        <div class="queue-item-id" style="font-size: 10px; color: #666; margin-top: 5px;">ID: ${item.id}</div>
      `;
      
      queueItemsList.appendChild(itemElement);
    });
  }
  
  toggleQueueDetails() {
    const details = document.getElementById('queueDetails');
    if (details && details.style.display === 'block') {
      this.hideQueueDetails();
    } else {
      this.showQueueDetails();
    }
  }
  
  showQueueDetails() {
    const details = document.getElementById('queueDetails');
    if (details) {
      details.style.display = 'block';
      this.updateQueueItemsList();
    }
  }
  
  hideQueueDetails() {
    const details = document.getElementById('queueDetails');
    if (details) {
      details.style.display = 'none';
    }
  }

  // ✅ CORRECCIÓN: Función única sin duplicados
  async verificarYDetenerSiConfirmado(job) {
    if (job.type === 'photo') {
      const { documento, lote, referencia, cantidad, nit } = job.data;
      
      try {
        // ✅ CORRECCIÓN: Usar window para función global
        if (typeof window.verificarConfirmacionEnTiempoReal === 'function') {
          const confirmado = await window.verificarConfirmacionEnTiempoReal(
            documento, lote, referencia, cantidad, nit
          );
          
          if (confirmado) {
            console.log(`✅ Trabajo confirmado, eliminando de cola: ${documento}-${lote}`);
            return true;
          }
        }
      } catch (error) {
        console.error('Error verificando confirmación:', error);
      }
    }
    return false;
  }

  // ✅ CORRECCIÓN: ProcessQueue mejorado
  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      this.updateQueueCounter();
      return;
    }
    
    // ✅ CORRECCIÓN: Verificar conexión
    if (!navigator.onLine) {
      console.log('🌐 Sin conexión - Esperando...');
      this.updateQueueCounter();
      return;
    }
    
    this.isProcessing = true;
    this.updateQueueCounter();
    
    console.log(`🔄 Procesando cola con ${this.queue.length} elementos...`);
    
    try {
      while (this.queue.length > 0 && navigator.onLine) {
        const job = this.queue[0];
        
        try {
          console.log(`🎯 Procesando trabajo ${job.id} (reintento ${job.retries})...`);
          
          // Verificar si ya está confirmado antes de procesar
          const estaConfirmado = await this.verificarYDetenerSiConfirmado(job);
          if (estaConfirmado) {
            this.queue.shift();
            this.saveQueue();
            this.updateQueueCounter();
            continue;
          }
          
          if (job.type === 'photo') {
            await this.processPhotoJob(job);
          } else if (job.type === 'data') {
            await this.processDataJob(job);
          }
          
          // ✅ ÉXITO: Eliminar trabajo completado
          console.log(`✅ Trabajo ${job.id} completado exitosamente`);
          this.queue.shift();
          this.saveQueue();
          this.updateQueueCounter();
          
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
    }
  }

  // ✅ NUEVO: Manejo de errores por trabajo
  async handleJobError(job, error) {
    console.error(`❌ Error en trabajo ${job.id}:`, error);
    
    job.retries++;
    job.lastError = error.message || 'Error desconocido';
    job.lastAttempt = new Date().toISOString();
    job.status = 'retrying';
    
    console.log(`🔄 Reintentando trabajo ${job.id} en ${CONFIG.RETRY_DELAY}ms (reintento ${job.retries})`);
    
    // Mover al final de la cola
    this.queue.push(this.queue.shift());
    this.saveQueue();
    this.updateQueueCounter();
    
    // Esperar antes del próximo intento
    await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
  }
  
  // ✅ CORRECCIÓN: ProcessPhotoJob mejorado
  async processPhotoJob(job) {
    console.log(`📤 Subiendo foto para ${job.factura}...`);
    
    // ✅ VERIFICAR datos esenciales
    if (!job.data.fotoBase64) {
      throw new Error('No hay datos de imagen');
    }
    
    if (!job.data.documento || !job.data.factura) {
      throw new Error('Datos incompletos');
    }
    
    const formData = new FormData();
    
    // ✅ AGREGAR todos los campos necesarios
    const fields = [
      'documento', 'lote', 'referencia', 'cantidad', 'factura', 'nit',
      'fotoBase64', 'fotoNombre', 'fotoTipo', 'timestamp'
    ];
    
    fields.forEach(field => {
      if (job.data[field] !== undefined && job.data[field] !== null) {
        formData.append(field, job.data[field]);
      }
    });
    
    // ✅ CONFIGURACIÓN robusta de fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seg timeout
    
    try {
      const response = await fetch(API_URL_POST, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Error en la respuesta del servidor');
      }
      
      console.log(`✅ Foto subida exitosamente:`, result);
      
      // ✅ ACTUALIZAR UI si es necesario
      this.updateUIAfterSuccess(job);
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('Timeout: La solicitud tardó demasiado');
      }
      throw error;
    }
  }

  // ✅ NUEVO: Actualizar UI después de éxito
  updateUIAfterSuccess(job) {
    if (job.btnElementId) {
      const btnElement = document.querySelector(`[data-factura="${job.btnElementId}"]`);
      
      if (btnElement && !job.esSinFactura) {
        setTimeout(() => {
          if (btnElement.parentNode) {
            btnElement.innerHTML = '<i class="fas fa-check-circle"></i> ENTREGA CONFIRMADA';
            btnElement.style.backgroundColor = '#28a745';
            btnElement.disabled = true;
          }
        }, 100);
      }
    }
  }
  
  async processDataJob(job) {
    console.log("Procesando trabajo de datos:", job);
  }

  // ✅ NUEVO: Métodos de utilidad
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

  getStats() {
    return {
      total: this.queue.length,
      pending: this.queue.filter(j => j.status === 'pending').length,
      retrying: this.queue.filter(j => j.status === 'retrying').length,
      totalRetries: this.queue.reduce((sum, j) => sum + j.retries, 0)
    };
  }
}

// ✅ CORRECCIÓN: Hacer global y agregar funciones de utilidad
window.uploadQueue = new UploadQueue();

// Función para convertir Blob a Base64
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result.split(',')[1]);
      } else {
        reject(new Error('No se pudo convertir el blob a base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ✅ Hacer disponible globalmente
window.blobToBase64 = blobToBase64;

// ✅ Funciones de debug para la consola
window.debugQueue = function() {
  if (window.uploadQueue) {
    console.log('=== DEBUG COLA ===');
    console.log('Estadísticas:', window.uploadQueue.getStats());
    console.log('Trabajos:', window.uploadQueue.queue);
    console.log('=== FIN DEBUG ===');
  }
};

window.forceQueueRetry = function() {
  if (window.uploadQueue) {
    window.uploadQueue.forceRetryAll();
  }
};
