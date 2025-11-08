// Lector de código de barras simplificado
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
    // Botón de cámara en el input manual
    document.getElementById('cameraBtn').addEventListener('click', () => {
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
      
      // Crear modal de escáner
      this.createScannerModal();
      
      // Configurar video
      this.videoElement.srcObject = this.stream;
      await this.videoElement.play();
      
      // Iniciar detección
      this.isScanning = true;
      this.startDetection();
      
    } catch (error) {
      console.error('Error al acceder a la cámara:', error);
      alert('No se pudo acceder a la cámara. Asegúrate de permitir el acceso.');
    }
  }
  
  createScannerModal() {
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
            <i class="fas fa-qrcode"></i> Enfoca el código QR en el marco
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
    }, 1000);
  }
  
  async captureAndDetect() {
    if (!this.videoElement || this.videoElement.readyState !== this.videoElement.HAVE_ENOUGH_DATA) {
      return;
    }
    
    try {
      // Configurar canvas
      this.canvasElement.width = this.videoElement.videoWidth;
      this.canvasElement.height = this.videoElement.videoHeight;
      
      // Dibujar frame en canvas
      this.context.drawImage(this.videoElement, 0, 0, this.canvasElement.width, this.canvasElement.height);
      
      // Intentar detectar con BarcodeDetector si está disponible
      if ('BarcodeDetector' in window) {
        await this.detectWithBarcodeDetector();
      }
      
    } catch (error) {
      console.error('Error en detección:', error);
    }
  }
  
  async detectWithBarcodeDetector() {
    try {
      // Crear detector si no existe
      if (!this.barcodeDetector) {
        this.barcodeDetector = new BarcodeDetector({
          formats: ['qr_code', 'code_128', 'code_39', 'ean_13']
        });
      }
      
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
    // Poner el código en el input PDA (que siempre está activo)
    const pdaInput = document.getElementById('pdaInput');
    pdaInput.value = code;
    
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
