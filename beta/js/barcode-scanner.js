// Escáner de código de barras simple usando la cámara
class BarcodeScanner {
  constructor() {
    this.isScanning = false;
    this.stream = null;
    this.videoElement = null;
    this.canvasElement = null;
    this.context = null;
    this.scanInterval = null;
    this.init();
  }
  
  init() {
    this.setupEventListeners();
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
  
  captureAndDetect() {
    if (!this.videoElement || this.videoElement.readyState !== this.videoElement.HAVE_ENOUGH_DATA) {
      return;
    }
    
    // Configurar canvas con las dimensiones del video
    this.canvasElement.width = this.videoElement.videoWidth;
    this.canvasElement.height = this.videoElement.videoHeight;
    
    // Dibujar frame actual en el canvas
    this.context.drawImage(this.videoElement, 0, 0, this.canvasElement.width, this.canvasElement.height);
    
    // Obtener datos de la imagen para procesamiento
    this.processFrame();
  }
  
  processFrame() {
    // Esta función intenta detectar códigos de barras simples
    // En una implementación real, aquí integrarías una librería como JsBarcode o Quagga
    
    try {
      // Simulación de detección - En producción usar una librería real
      const imageData = this.context.getImageData(0, 0, this.canvasElement.width, this.canvasElement.height);
      
      // Aquí iría el código real de detección usando una librería
      // Por ahora, solo simulamos que no detectamos nada
      // En producción, reemplazar con:
      // const detectedCode = barcodeLibrary.detect(imageData);
      
    } catch (error) {
      console.error('Error en procesamiento de frame:', error);
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

// Función simple de detección para códigos de barras lineales básicos
function simulateBarcodeDetection(imageData) {
  // Esta es una simulación muy básica
  // En producción, usar una librería como:
  // - JsBarcode: https://github.com/lindell/JsBarcode
  // - QuaggaJS: https://github.com/serratus/quaggaJS
  // - ZXing: https://github.com/zxing-js/library
  
  return null; // Simular que no se detectó nada
}
