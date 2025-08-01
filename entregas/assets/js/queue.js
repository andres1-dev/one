// Clase para gestionar la cola de carga
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
      const saved = localStorage.getItem('pdaUploadQueue');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Error al cargar la cola:", e);
      return [];
    }
  }
  
  saveQueue() {
    localStorage.setItem('pdaUploadQueue', JSON.stringify(this.queue));
  }
  
  // Resto de métodos de la clase...
}

// Inicializar la cola de carga
const uploadQueue = new UploadQueue();
