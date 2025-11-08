// Configuración y constantes
const CONFIG = {
  VERSION: "4.0.0",
  CACHE_TTL: 24 * 60 * 60 * 1000, // 24 horas en milisegundos
  MAX_IMAGE_SIZE: 800, // Tamaño máximo para redimensionar imágenes
  MAX_CHUNK_SIZE: 50000, // ~50KB por solicitud
  MAX_RETRIES: -1 // -1 para reintentos ilimitados
};

// API URLs
const API_URL_GET = "https://script.google.com/macros/s/AKfycbzja5L4QU5qLBO0vSG2cGga18h_Mea3aJEHKyYrWx5_YssSKVLW4Q_Q6egqhel9M0dlKg/exec";
const API_URL_POST = "https://script.google.com/macros/s/AKfycbwgnkjVCMWlWuXnVaxSBD18CGN3rXGZtQZIvX9QlBXSgbQndWC4uqQ2sc00DuNH6yrb/exec";
const API_URL_ASENTAR_FACTURA = "https://script.google.com/macros/s/AKfycbz0cNRHuZYIeouAOZKsVZZSavN325HCr-6BN_7-bfFCQg5PoCybMYvQmLRRjcSSsXQR/exec";

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
    document.getElementById('queueCounter').addEventListener('click', this.toggleQueueDetails.bind(this));
    document.getElementById('closeQueueDetails').addEventListener('click', this.hideQueueDetails.bind(this));
    
    // Cerrar detalles al hacer clic fuera
    document.addEventListener('click', (e) => {
      const queueDetails = document.getElementById('queueDetails');
      const queueCounter = document.getElementById('queueCounter');
      
      if (queueDetails.style.display === 'block' && 
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
    localStorage.setItem(UPLOAD_QUEUE_KEY, JSON.stringify(this.queue));
  }
  
  addJob(job) {
    this.queue.push({
      ...job,
      retries: 0,
      timestamp: new Date().toISOString(),
      status: 'pending'
    });
    this.saveQueue();
    this.updateQueueCounter();
    this.processQueue();
  }
  
  initEventListeners() {
    window.addEventListener('online', () => {
      if (this.queue.length > 0) {
        this.processQueue();
      }
    });
  }
  
  updateQueueCounter() {
    const counter = document.getElementById('queueCounter');
    const queueItemsList = document.getElementById('queueItemsList');
    
    if (this.queue.length === 0) {
      counter.textContent = '0';
      counter.className = 'empty';
      counter.title = 'No hay elementos en cola';
      queueItemsList.innerHTML = '<div class="queue-no-items">No hay elementos pendientes</div>';
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
    
    if (this.queue.length === 0) {
      queueItemsList.innerHTML = '<div class="queue-no-items">No hay elementos pendientes</div>';
      return;
    }
    
    queueItemsList.innerHTML = '';
    
    this.queue.forEach((item, index) => {
      const itemElement = document.createElement('div');
      itemElement.className = `queue-item-card ${item.status === 'retrying' ? 'retrying' : ''} ${CONFIG.MAX_RETRIES > 0 && item.retries >= CONFIG.MAX_RETRIES ? 'error' : ''}`;
      
      let previewContent = '';
      let thumbnail = '';
      
      if (item.type === 'photo') {
        previewContent = `Factura: ${item.factura || 'N/A'}`;
        if (item.data.fotoBase64) {
          thumbnail = `<img src="data:image/jpeg;base64,${item.data.fotoBase64}" class="queue-thumbnail">`;
        }
      } else if (item.type === 'data') {
        previewContent = `Datos: ${JSON.stringify(item.data).substring(0, 50)}...`;
      }
      
      let statusInfo = '';
      if (item.status === 'retrying') {
        statusInfo = `<div class="queue-item-status retrying">Reintentando (${item.retries}${CONFIG.MAX_RETRIES > 0 ? `/${CONFIG.MAX_RETRIES}` : ''})</div>`;
      } else if (CONFIG.MAX_RETRIES > 0 && item.retries >= CONFIG.MAX_RETRIES) {
        statusInfo = `<div class="queue-item-status error">Error: ${item.lastError || 'Error desconocido'}</div>`;
      } else {
        statusInfo = `<div class="queue-item-status">En espera</div>`;
      }
      
      itemElement.innerHTML = `
        <div class="queue-item-header">
          <span>${item.type === 'photo' ? 'Foto' : 'Datos'}</span>
          <span class="queue-item-type">${new Date(item.timestamp).toLocaleTimeString()}</span>
        </div>
        <div class="queue-item-preview">${previewContent}</div>
        ${thumbnail}
        ${statusInfo}
      `;
      
      // Mostrar miniaturas al pasar el ratón
      itemElement.addEventListener('mouseenter', () => {
        const thumbnail = itemElement.querySelector('.queue-thumbnail');
        if (thumbnail) thumbnail.style.display = 'block';
      });
      
      itemElement.addEventListener('mouseleave', () => {
        const thumbnail = itemElement.querySelector('.queue-thumbnail');
        if (thumbnail) thumbnail.style.display = 'none';
      });
      
      queueItemsList.appendChild(itemElement);
    });
  }
  
  toggleQueueDetails() {
    const details = document.getElementById('queueDetails');
    if (details.style.display === 'block') {
      this.hideQueueDetails();
    } else {
      this.showQueueDetails();
    }
  }
  
  showQueueDetails() {
    const details = document.getElementById('queueDetails');
    details.style.display = 'block';
    this.updateQueueItemsList();
  }
  
  hideQueueDetails() {
    const details = document.getElementById('queueDetails');
    details.style.display = 'none';
  }
  
  async processQueue() {
    if (this.isProcessing || this.queue.length === 0 || !navigator.onLine) {
      this.updateQueueCounter();
      return;
    }
    
    this.isProcessing = true;
    this.updateQueueCounter();
    
    while (this.queue.length > 0 && navigator.onLine) {
      const job = this.queue[0];
      
      try {
        if (job.type === 'photo') {
          await this.processPhotoJob(job);
        } else if (job.type === 'data') {
          await this.processDataJob(job);
        }
        
        // Eliminar trabajo completado
        this.queue.shift();
        this.saveQueue();
        this.updateQueueCounter();
      } catch (error) {
        console.error("Error al procesar trabajo:", error);
        job.retries++;
        job.lastError = error.message;
        job.lastAttempt = new Date().toISOString();
        
        // MODIFICACIÓN PARA REINTENTOS ILIMITADOS
        if (CONFIG.MAX_RETRIES > 0 && job.retries >= CONFIG.MAX_RETRIES) {
          // Eliminar solo si MAX_RETRIES es positivo y se alcanzó el límite
          this.queue.shift();
        } else {
          job.status = 'retrying';
          // Mover al final de la cola para reintentar más tarde (reintentos ilimitados)
          this.queue.push(this.queue.shift());
        }
        
        this.saveQueue();
        this.updateQueueCounter();
        break;
      }
    }
    
    this.isProcessing = false;
    this.updateQueueCounter();
  }
  
  async processPhotoJob(job) {
    const formData = new FormData();
    Object.keys(job.data).forEach(key => {
      // No enviar la propiedad esSinFactura al servidor
      if (key !== 'esSinFactura') {
        formData.append(key, job.data[key]);
      }
    });
    
    const response = await fetch(API_URL_POST, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || "Error en la respuesta del servidor");
    }
    
    // Actualizar UI si el elemento todavía está visible
    if (job.btnElementId) {
      const btnElement = document.querySelector(`[data-factura="${job.btnElementId}"]`);
      
      // Solo actualizar si el botón existe y no es una entrega sin factura
      // (Las entregas sin factura ya se actualizaron en subirFotoCapturada)
      if (btnElement && !job.esSinFactura) {
        btnElement.innerHTML = '<i class="fas fa-check-circle"></i> ENTREGA CONFIRMADA';
        btnElement.style.backgroundColor = '#28a745';
        btnElement.disabled = true;
      }
    }
  }
  
  async processDataJob(job) {
    // Implementación para trabajos de datos si es necesario
    console.log("Procesando trabajo de datos:", job);
  }
}

// Inicializar la cola de carga
const uploadQueue = new UploadQueue();

// Función para convertir Blob a Base64
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
