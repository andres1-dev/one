// Lector de código de barras real con biblioteca BarcodeDetector
class BarcodeScanner {
  constructor() {
    this.isScanning = false;
    this.stream = null;
    this.videoElement = null;
    this.canvasElement = null;
    this.context = null;
    this.scanInterval = null;
    this.barcodeDetector = null;
    this.init();
  }
  
  async init() {
    await this.setupBarcodeDetector();
    this.setupEventListeners();
  }
  
  async setupBarcodeDetector() {
    // Verificar si el navegador soporta BarcodeDetector
    if ('BarcodeDetector' in window) {
      try {
        // Obtener los formatos soportados
        const formats = await BarcodeDetector.getSupportedFormats();
        console.log('Formatos soportados:', formats);
        
        this.barcodeDetector = new BarcodeDetector({
          formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e']
        });
        
        console.log('BarcodeDetector inicializado correctamente');
      } catch (error) {
        console.error('Error al inicializar BarcodeDetector:', error);
        this.fallbackToCanvasDetection();
      }
    } else {
      console.warn('BarcodeDetector no está soportado en este navegador');
      this.fallbackToCanvasDetection();
    }
  }
  
  fallbackToCanvasDetection() {
    console.log('Usando detección por canvas (modo fallback)');
    // En modo fallback, usaremos detección básica por canvas
  }
  
  setupEventListeners() {
    // Botón de iniciar escáner desde configuración
    document.getElementById('startScannerBtn').addEventListener('click', () => {
      this.startScanner();
    });
  }
  
  async startScanner() {
    if (this.isScanning) {
      this.stopScanner();
      return;
    }
    
    try {
      // Obtener acceso a la cámara
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      
      // Crear elementos dinámicamente
      this.createScannerElements();
      
      // Configurar video
      this.videoElement.srcObject = this.stream;
      await this.videoElement.play();
      
      // Iniciar detección
      this.isScanning = true;
      this.startDetection();
      
      // Cerrar panel de configuración
      document.getElementById('configPanel').style.display = 'none';
      
    } catch (error) {
      console.error('Error al acceder a la cámara:', error);
      alert('No se pudo acceder a la cámara. Asegúrate de permitir el acceso.');
    }
  }
  
  createScannerElements() {
    // Crear modal de escáner
    let scannerModal = document.getElementById('scannerModal');
    if (!scannerModal) {
      scannerModal = document.createElement('div');
      scannerModal.id = 'scannerModal';
      scannerModal.className = 'camera-modal';
      scannerModal.innerHTML = `
        <div class="scanner-container">
          <video id="scannerVideo" class="camera-view" autoplay playsinline></video>
          <div class="scanner-overlay">
            <div class="scanner-frame"></div>
            <div class="scanner-line"></div>
          </div>
          <div class="camera-actions">
            <button id="stopScannerBtn" class="btn btn-danger">
              <i class="fas fa-times"></i> Cerrar Escáner
            </button>
          </div>
          <div id="scannerStatus" class="uploading-status">
            <i class="fas fa-qrcode"></i> Escaneando...
          </div>
        </div>
      `;
      document.body.appendChild(scannerModal);
      
      // Evento para cerrar escáner
      document.getElementById('stopScannerBtn').addEventListener('click', () => {
        this.stopScanner();
      });
      
      // Cerrar al hacer clic fuera
      scannerModal.addEventListener('click', (e) => {
        if (e.target === scannerModal) {
          this.stopScanner();
        }
      });
    }
    
    scannerModal.style.display = 'flex';
    this.videoElement = document.getElementById('scannerVideo');
    this.canvasElement = document.createElement('canvas');
    this.context = this.canvasElement.getContext('2d');
  }
  
  startDetection() {
    this.scanInterval = setInterval(() => {
      this.captureAndDetect();
    }, 500); // Revisar cada 500ms
  }
  
  async captureAndDetect() {
    if (!this.videoElement || this.videoElement.readyState !== this.videoElement.HAVE_ENOUGH_DATA) {
      return;
    }
    
    try {
      // Configurar canvas con las dimensiones del video
      this.canvasElement.width = this.videoElement.videoWidth;
      this.canvasElement.height = this.videoElement.videoHeight;
      
      // Dibujar frame actual en el canvas
      this.context.drawImage(this.videoElement, 0, 0, this.canvasElement.width, this.canvasElement.height);
      
      // Intentar detección con BarcodeDetector si está disponible
      if (this.barcodeDetector) {
        await this.detectWithBarcodeDetector();
      } else {
        // Fallback a detección básica por canvas
        this.detectWithCanvas();
      }
    } catch (error) {
      console.error('Error en detección:', error);
    }
  }
  
  async detectWithBarcodeDetector() {
    try {
      const barcodes = await this.barcodeDetector.detect(this.canvasElement);
      
      if (barcodes.length > 0) {
        const barcode = barcodes[0];
        console.log('Código detectado:', barcode.rawValue);
        this.onBarcodeDetected(barcode.rawValue);
      }
    } catch (error) {
      console.error('Error en BarcodeDetector:', error);
    }
  }
  
  detectWithCanvas() {
    // Detección básica por análisis de imagen (para códigos QR simples)
    // Esta es una implementación básica - en producción usar una librería dedicada
    try {
      const imageData = this.context.getImageData(0, 0, this.canvasElement.width, this.canvasElement.height);
      
      // Aquí iría el código de detección más avanzado
      // Por simplicidad, simulamos que no detectamos nada
      // En producción, integrar con una librería como jsQR o similar
      
    } catch (error) {
      console.error('Error en detección por canvas:', error);
    }
  }
  
  onBarcodeDetected(code) {
    console.log('Código detectado:', code);
    
    // Vibrar si está habilitado
    if (this.shouldVibrate() && navigator.vibrate) {
      navigator.vibrate(100);
    }
    
    // Reproducir sonido si está habilitado
    if (this.shouldPlaySound() && typeof playSuccessSound === 'function') {
      playSuccessSound();
    }
    
    // Procesar el código detectado
    this.processDetectedCode(code);
    
    // Cerrar escáner después de detectar
    this.stopScanner();
  }
  
  processDetectedCode(code) {
    // Normalizar código
    const normalizedCode = code.trim().toUpperCase();
    
    // Poner el código en el input
    const barcodeInput = document.getElementById('barcode');
    barcodeInput.value = normalizedCode;
    
    // Procesar automáticamente
    setTimeout(() => {
      if (typeof processBarcodeInput === 'function') {
        processBarcodeInput();
      }
    }, 100);
  }
  
  shouldVibrate() {
    const vibrationToggle = document.getElementById('vibrationToggle');
    return vibrationToggle && vibrationToggle.checked;
  }
  
  shouldPlaySound() {
    const soundToggle = document.getElementById('soundToggle');
    return soundToggle && soundToggle.checked;
  }
  
  stopScanner() {
    this.isScanning = false;
    
    // Limpiar intervalo
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    
    // Detener stream de cámara
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    // Ocultar modal
    const scannerModal = document.getElementById('scannerModal');
    if (scannerModal) {
      scannerModal.style.display = 'none';
    }
    
    // Limpiar elementos
    this.videoElement = null;
    this.canvasElement = null;
    this.context = null;
  }
}

// Inicializar escáner
let barcodeScanner;

function initializeBarcodeScanner() {
  barcodeScanner = new BarcodeScanner();
  return barcodeScanner;
}
