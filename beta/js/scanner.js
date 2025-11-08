// Gestor de escáner QR/Barcode con Quagga
class ScannerManager {
  constructor() {
    this.isScanning = false;
    this.currentCamera = 'environment';
    this.init();
  }
  
  init() {
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // Botón flotante de escáner
    document.getElementById('scannerToggleBtn').addEventListener('click', () => {
      this.toggleScanner();
    });
    
    // Botones del modal de escáner
    document.getElementById('toggleScannerCameraBtn').addEventListener('click', () => {
      this.switchCamera();
    });
    
    document.getElementById('closeScannerBtn').addEventListener('click', () => {
      this.stopScanner();
    });
    
    // Cerrar modal al hacer clic fuera
    document.getElementById('scannerModal').addEventListener('click', (e) => {
      if (e.target.id === 'scannerModal') {
        this.stopScanner();
      }
    });
  }
  
  async toggleScanner() {
    if (this.isScanning) {
      this.stopScanner();
    } else {
      await this.startScanner();
    }
  }
  
  async startScanner() {
    const modal = document.getElementById('scannerModal');
    
    try {
      modal.style.display = 'flex';
      
      await Quagga.init({
        inputStream: {
          name: "Live",
          type: "LiveStream",
          target: document.getElementById('interactive'),
          constraints: {
            width: 640,
            height: 480,
            facingMode: this.currentCamera
          }
        },
        decoder: {
          readers: [
            "code_128_reader",
            "ean_reader", 
            "ean_8_reader",
            "code_39_reader",
            "code_39_vin_reader",
            "codabar_reader",
            "upc_reader",
            "upc_e_reader",
            "i2of5_reader",
            "2of5_reader",
            "code_93_reader"
          ]
        },
        locate: true,
        numOfWorkers: 2
      }, (err) => {
        if (err) {
          console.error("Error al inicializar Quagga:", err);
          this.stopScanner();
          return;
        }
        
        console.log("Quagga inicializado correctamente");
        Quagga.start();
        this.isScanning = true;
        
        // Detectar códigos
        Quagga.onDetected(this.onBarcodeDetected.bind(this));
      });
      
    } catch (error) {
      console.error("Error en el escáner:", error);
      this.stopScanner();
    }
  }
  
  stopScanner() {
    if (this.isScanning) {
      Quagga.stop();
      this.isScanning = false;
    }
    
    const modal = document.getElementById('scannerModal');
    modal.style.display = 'none';
    
    // Limpiar el contenedor
    const interactive = document.getElementById('interactive');
    interactive.innerHTML = '';
  }
  
  async switchCamera() {
    this.currentCamera = this.currentCamera === 'environment' ? 'user' : 'environment';
    
    // Reiniciar el escáner con la nueva cámara
    this.stopScanner();
    await new Promise(resolve => setTimeout(resolve, 500));
    await this.startScanner();
  }
  
  onBarcodeDetected(result) {
    if (result && result.codeResult && result.codeResult.code) {
      const code = result.codeResult.code;
      console.log("Código detectado:", code);
      
      // Vibrar si es posible
      if (navigator.vibrate) {
        navigator.vibrate(100);
      }
      
      // Reproducir sonido de éxito
      if (typeof playSuccessSound === 'function') {
        playSuccessSound();
      }
      
      // Procesar el código
      this.processScannedCode(code);
      
      // Detener el escáner después de lectura exitosa
      setTimeout(() => {
        this.stopScanner();
      }, 1000);
    }
  }
  
  processScannedCode(code) {
    // Normalizar el código
    const normalizedCode = code.trim().toUpperCase();
    
    // Poner el código en el input
    const barcodeInput = document.getElementById('barcode');
    barcodeInput.value = normalizedCode;
    
    // Procesar automáticamente
    if (typeof processBarcodeInput === 'function') {
      processBarcodeInput(normalizedCode);
    }
  }
}

// Inicializar escáner
let scannerManager;

function initializeScanner() {
  scannerManager = new ScannerManager();
  return scannerManager;
}
