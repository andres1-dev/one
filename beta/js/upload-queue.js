// Configuración y constantes
const CONFIG = {
    VERSION: "4.1.0",
    MAX_IMAGE_SIZE: 800,
    MAX_CHUNK_SIZE: 50000,
    MAX_RETRIES: -1 // Reintentos ilimitados
};

// API URLs
const API_URL_POST = "https://script.google.com/macros/s/AKfycbwgnkjVCMWlWuXnVaxSBD18CGN3rXGZtQZIvX9QlBXSgbQndWC4uqQ2sc00DuNH6yrb/exec";
const API_URL_ASENTAR_FACTURA = "https://script.google.com/macros/s/AKfycbz0cNRHuZYIeouAOZKsVZZSavN325HCr-6BN_7-bfFCQg5PoCybMYvQmLRRjcSSsXQR/exec";

// Constantes para la cola de carga
const UPLOAD_QUEUE_KEY = 'pdaUploadQueue';

// Clase para gestionar la cola de carga con verificación de confirmación
class UploadQueue {
    constructor() {
        this.queue = this.loadQueue();
        this.isProcessing = false;
        this.initEventListeners();
        this.updateQueueCounter();
        this.processQueue();
        
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
                // VERIFICAR SI LA FACTURA YA ESTÁ CONFIRMADA ANTES DE PROCESAR
                if (job.type === 'photo') {
                    const isConfirmed = await this.verifyFacturaConfirmed(job.factura);
                    if (isConfirmed) {
                        console.log(`✅ Factura ${job.factura} ya está confirmada, eliminando de cola`);
                        this.queue.shift();
                        this.saveQueue();
                        this.updateQueueCounter();
                        continue;
                    }
                    
                    await this.processPhotoJob(job);
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
                
                if (CONFIG.MAX_RETRIES > 0 && job.retries >= CONFIG.MAX_RETRIES) {
                    this.queue.shift();
                } else {
                    job.status = 'retrying';
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
    
    // NUEVO MÉTODO: Verificar si la factura ya está confirmada
    async verifyFacturaConfirmed(factura) {
        try {
            // Actualizar datos en tiempo real antes de verificar
            await dataService.getRealTimeData();
            return dataService.isFacturaConfirmed(factura);
        } catch (error) {
            console.error("Error verificando confirmación:", error);
            return false;
        }
    }
    
    async processPhotoJob(job) {
        const formData = new FormData();
        Object.keys(job.data).forEach(key => {
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
            
            if (btnElement && !job.esSinFactura) {
                btnElement.innerHTML = '<i class="fas fa-check-circle"></i> ENTREGA CONFIRMADA';
                btnElement.style.backgroundColor = '#28a745';
                btnElement.disabled = true;
                
                // FORZAR ACTUALIZACIÓN INMEDIATA DE DATOS
                setTimeout(() => {
                    loadDataFromServer(true); // Recargar datos para reflejar confirmación
                }, 1000);
            }
        }
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
