// upload-queue.js - Sistema de cola mejorado con verificación de estado
class UploadQueue {
    constructor() {
        this.config = {
            MAX_RETRIES: -1, // Reintentos ilimitados
            RETRY_DELAY: 2000, // 2 segundos entre reintentos
            MAX_RETRY_DELAY: 30000, // 30 segundos máximo
            UPLOAD_QUEUE_KEY: 'pdaUploadQueue_v2'
        };

        this.queue = this.loadQueue();
        this.isProcessing = false;
        this.processingPaused = false;
        this.facturasEnProceso = new Set();

        this.initEventListeners();
        this.updateQueueCounter();
        this.processQueue();

        this.setupUIEvents();
        this.startQueueMonitor();
    }

    // ========== GESTIÓN DE LA COLA ==========

    loadQueue() {
        try {
            const saved = localStorage.getItem(this.config.UPLOAD_QUEUE_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error("❌ Error al cargar la cola:", e);
            return [];
        }
    }

    saveQueue() {
        try {
            localStorage.setItem(this.config.UPLOAD_QUEUE_KEY, JSON.stringify(this.queue));
        } catch (e) {
            console.error("❌ Error al guardar la cola:", e);
        }
    }

    async addJob(job) {
        // Verificar si la factura ya fue entregada
        if (await this.isFacturaEntregada(job.factura)) {
            this.mostrarNotificacion('warning', `La factura ${job.factura} ya fue entregada`);
            return false;
        }

        // Verificar si ya está en proceso
        if (this.isFacturaInQueue(job.factura)) {
            this.mostrarNotificacion('warning', `La factura ${job.factura} ya está en proceso`);
            return false;
        }

        const nuevoJob = {
            ...job,
            id: this.generateJobId(),
            retries: 0,
            timestamp: new Date().toISOString(),
            status: 'pending',
            lastAttempt: null,
            lastError: null,
            nextRetry: null
        };

        this.queue.push(nuevoJob);
        this.facturasEnProceso.add(job.factura);
        this.saveQueue();
        this.updateQueueCounter();
        
        // Iniciar procesamiento si no está en curso
        if (!this.isProcessing && !this.processingPaused) {
            this.processQueue();
        }

        this.mostrarNotificacion('success', `📸 Foto en cola para ${job.factura}`);
        return true;
    }

    async processQueue() {
        if (this.isProcessing || this.processingPaused || this.queue.length === 0 || !navigator.onLine) {
            this.updateQueueCounter();
            return;
        }

        this.isProcessing = true;
        this.updateQueueCounter();

        while (this.queue.length > 0 && navigator.onLine && !this.processingPaused) {
            const job = this.queue[0];
            
            try {
                // Verificar estado actual antes de procesar
                if (await this.isFacturaEntregada(job.factura)) {
                    console.log(`📭 Factura ${job.factura} ya entregada, eliminando de cola`);
                    this.completeJob(job, true);
                    continue;
                }

                console.log(`🔄 Procesando job ${job.id} para factura: ${job.factura}`);

                if (job.type === 'photo') {
                    await this.processPhotoJob(job);
                }

                // Marcar como completado exitosamente
                this.completeJob(job, true);
                this.mostrarNotificacion('success', `✅ Entrega ${job.factura} confirmada`);

            } catch (error) {
                console.error("❌ Error al procesar trabajo:", error);
                await this.handleJobError(job, error);
                break;
            }
        }

        this.isProcessing = false;
        this.updateQueueCounter();
    }

    async processPhotoJob(job) {
        const formData = new FormData();
        Object.keys(job.data).forEach(key => {
            if (key !== 'esSinFactura') {
                formData.append(key, job.data[key]);
            }
        });

        const response = await fetch(job.apiUrl || 'https://script.google.com/macros/s/AKfycbwgnkjVCMWlWuXnVaxSBD18CGN3rXGZtQZIvX9QlBXSgbQndWC4uqQ2sc00DuNH6yrb/exec', {
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

        // Actualizar UI
        this.actualizarUIEntrega(job);
    }

    async handleJobError(job, error) {
        job.retries++;
        job.lastError = error.message;
        job.lastAttempt = new Date().toISOString();
        job.status = 'retrying';

        // Calcular próximo reintento con backoff exponencial
        const delay = Math.min(
            this.config.RETRY_DELAY * Math.pow(2, job.retries - 1),
            this.config.MAX_RETRY_DELAY
        );
        job.nextRetry = new Date(Date.now() + delay);

        console.log(`🔄 Reintentando job ${job.id} (intento ${job.retries}) en ${delay}ms`);

        // Mover al final de la cola para reintentar más tarde
        this.queue.push(this.queue.shift());
        this.saveQueue();
        this.updateQueueCounter();

        // Esperar antes del próximo intento
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    completeJob(job, success = true) {
        // Eliminar de la cola
        this.queue.shift();
        this.facturasEnProceso.delete(job.factura);
        this.saveQueue();
        this.updateQueueCounter();

        if (success) {
            this.actualizarUIEntrega(job);
        }
    }

    // ========== VERIFICACIÓN DE ESTADO ==========

    async isFacturaEntregada(factura) {
        // Verificar en la base de datos local primero
        if (window.app && window.app.database) {
            const facturaData = window.app.database.find(item => item.factura === factura);
            if (facturaData && facturaData.entregado) {
                return true;
            }
        }

        // Si no hay datos locales, asumir que no está entregado
        return false;
    }

    isFacturaInQueue(factura) {
        return this.facturasEnProceso.has(factura) || 
               this.queue.some(job => job.factura === factura);
    }

    // ========== GESTIÓN DE LA COLA ==========

    pauseProcessing() {
        this.processingPaused = true;
        console.log('⏸️ Procesamiento de cola pausado');
    }

    resumeProcessing() {
        this.processingPaused = false;
        console.log('▶️ Procesamiento de cola reanudado');
        this.processQueue();
    }

    clearQueue() {
        const facturas = this.queue.map(job => job.factura);
        facturas.forEach(factura => this.facturasEnProceso.delete(factura));
        
        this.queue = [];
        this.saveQueue();
        this.updateQueueCounter();
        
        this.mostrarNotificacion('info', '🧹 Cola limpiada');
    }

    removeJob(jobId) {
        const jobIndex = this.queue.findIndex(job => job.id === jobId);
        if (jobIndex !== -1) {
            const job = this.queue[jobIndex];
            this.facturasEnProceso.delete(job.factura);
            this.queue.splice(jobIndex, 1);
            this.saveQueue();
            this.updateQueueCounter();
            
            this.mostrarNotificacion('info', `🗑️ Trabajo ${jobId} eliminado`);
            return true;
        }
        return false;
    }

    // ========== MONITOREO Y ESTADÍSTICAS ==========

    startQueueMonitor() {
        setInterval(() => {
            this.cleanStalledJobs();
            this.retryPendingJobs();
        }, 30000); // Revisar cada 30 segundos
    }

    cleanStalledJobs() {
        const now = Date.now();
        const stalledJobs = this.queue.filter(job => {
            // Considerar trabajos estancados si no han tenido actividad en 10 minutos
            return job.lastAttempt && (now - new Date(job.lastAttempt).getTime() > 10 * 60 * 1000);
        });

        stalledJobs.forEach(job => {
            console.log(`🧹 Eliminando trabajo estancado: ${job.id}`);
            this.removeJob(job.id);
        });
    }

    retryPendingJobs() {
        const now = Date.now();
        const pendingRetries = this.queue.filter(job => 
            job.nextRetry && new Date(job.nextRetry).getTime() <= now
        );

        if (pendingRetries.length > 0 && !this.isProcessing) {
            this.processQueue();
        }
    }

    getQueueStats() {
        const stats = {
            total: this.queue.length,
            pending: this.queue.filter(job => job.status === 'pending').length,
            retrying: this.queue.filter(job => job.status === 'retrying').length,
            processing: this.isProcessing ? 1 : 0
        };

        return stats;
    }

    // ========== ACTUALIZACIÓN DE UI ==========

    actualizarUIEntrega(job) {
        // Actualizar botón si existe
        if (job.btnElementId) {
            const btnElement = document.querySelector(`[data-factura="${job.btnElementId}"]`);
            if (btnElement) {
                btnElement.innerHTML = '<i class="fas fa-check-circle"></i> ENTREGA CONFIRMADA';
                btnElement.style.backgroundColor = '#28a745';
                btnElement.disabled = true;
                
                // Agregar clase de animación
                btnElement.classList.add('entregado-confirmado');
            }
        }

        // Actualizar estado en la UI principal
        if (window.app && window.app.actualizarEstadoFactura) {
            window.app.actualizarEstadoFactura(job.factura, 'ENTREGADO');
        }

        // Forzar actualización de datos
        if (window.app && window.app.refreshData) {
            setTimeout(() => {
                window.app.refreshData();
            }, 2000);
        }
    }

    updateQueueCounter() {
        const counter = document.getElementById('queueCounter');
        const queueItemsList = document.getElementById('queueItemsList');
        
        if (!counter) return;

        const stats = this.getQueueStats();
        
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
            counter.title = `${this.queue.length} elementos pendientes (${stats.pending} pendientes, ${stats.retrying} reintentos)`;
            
            if (queueItemsList) {
                this.updateQueueItemsList();
            }
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
                    thumbnail = `<img src="data:image/jpeg;base64,${item.data.fotoBase64}" class="queue-thumbnail">`;
                }
            }
            
            let statusInfo = '';
            if (item.status === 'retrying') {
                statusInfo = `<div class="queue-item-status retrying">Reintentando (${item.retries})</div>`;
            } else {
                statusInfo = `<div class="queue-item-status">En espera</div>`;
            }

            const tiempoTranscurrido = this.formatElapsedTime(item.timestamp);
            
            itemElement.innerHTML = `
                <div class="queue-item-header">
                    <span>${item.type === 'photo' ? '📸 Foto' : '📊 Datos'}</span>
                    <span class="queue-item-type">${tiempoTranscurrido}</span>
                </div>
                <div class="queue-item-preview">${previewContent}</div>
                ${thumbnail}
                ${statusInfo}
                <div class="queue-item-actions">
                    <button class="btn-remove-job" data-job-id="${item.id}" title="Eliminar de la cola">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
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

            // Agregar evento para eliminar trabajo
            const removeBtn = itemElement.querySelector('.btn-remove-job');
            if (removeBtn) {
                removeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.removeJob(item.id);
                });
            }
            
            queueItemsList.appendChild(itemElement);
        });
    }

    // ========== EVENTOS DE UI ==========

    setupUIEvents() {
        // Contador de cola
        const queueCounter = document.getElementById('queueCounter');
        if (queueCounter) {
            queueCounter.addEventListener('click', () => this.toggleQueueDetails());
        }

        // Cerrar detalles de cola
        const closeQueueDetails = document.getElementById('closeQueueDetails');
        if (closeQueueDetails) {
            closeQueueDetails.addEventListener('click', () => this.hideQueueDetails());
        }

        // Cerrar al hacer clic fuera
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

        // Eventos de conexión
        window.addEventListener('online', () => {
            this.mostrarNotificacion('success', '🌐 Conexión restablecida - Reanudando cola...');
            this.resumeProcessing();
        });

        window.addEventListener('offline', () => {
            this.mostrarNotificacion('warning', '📴 Sin conexión - Cola en pausa');
            this.pauseProcessing();
        });
    }

    toggleQueueDetails() {
        const details = document.getElementById('queueDetails');
        if (!details) return;

        if (details.style.display === 'block') {
            this.hideQueueDetails();
        } else {
            this.showQueueDetails();
        }
    }

    showQueueDetails() {
        const details = document.getElementById('queueDetails');
        if (!details) return;

        details.style.display = 'block';
        this.updateQueueItemsList();
    }

    hideQueueDetails() {
        const details = document.getElementById('queueDetails');
        if (details) {
            details.style.display = 'none';
        }
    }

    // ========== UTILIDADES ==========

    generateJobId() {
        return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    formatElapsedTime(timestamp) {
        const now = new Date();
        const jobTime = new Date(timestamp);
        const diffMs = now - jobTime;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);

        if (diffHours > 0) {
            return `Hace ${diffHours}h`;
        } else if (diffMins > 0) {
            return `Hace ${diffMins}min`;
        } else {
            return 'Ahora mismo';
        }
    }

    mostrarNotificacion(tipo, mensaje) {
        const notificacion = document.createElement('div');
        notificacion.className = `notificacion-${tipo}`;
        notificacion.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            ${tipo === 'success' ? 'background: #28a745;' : ''}
            ${tipo === 'warning' ? 'background: #ffc107; color: #000;' : ''}
            ${tipo === 'error' ? 'background: #dc3545;' : ''}
            ${tipo === 'info' ? 'background: #17a2b8;' : ''}
        `;
        notificacion.textContent = mensaje;

        document.body.appendChild(notificacion);

        setTimeout(() => {
            if (notificacion.parentNode) {
                notificacion.parentNode.removeChild(notificacion);
            }
        }, 5000);
    }

    // ========== MÉTODOS PÚBLICOS ==========

    getQueueLength() {
        return this.queue.length;
    }

    isProcessingQueue() {
        return this.isProcessing;
    }

    getPendingJobs() {
        return this.queue.filter(job => job.status === 'pending');
    }

    getRetryingJobs() {
        return this.queue.filter(job => job.status === 'retrying');
    }
}

// ========== INICIALIZACIÓN ==========

// Crear instancia global
const uploadQueue = new UploadQueue();

// Hacer disponible globalmente
window.uploadQueue = uploadQueue;

// Exportar para módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UploadQueue;
}
