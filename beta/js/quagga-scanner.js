// Escáner QR/Barcode con Quagga2
class QRScanner {
  constructor() {
    this.isScanning = false;
    this.currentCamera = 'environment'; // 'environment' o 'user'
    this.init();
  }
  
  init() {
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // Botón flotante de escáner
    document.getElementById('qrScannerBtn').addEventListener('click', () => {
      this.toggleScanner();
    });
    
    // Botones del modal de escáner
    document.getElementById('toggleCameraBtn').addEventListener('click', () => {
      this.switchCamera();
    });
    
    document.getElementById('closeScannerBtn').addEventListener('click', () => {
      this.stopScanner();
    });
    
    // Cerrar modal al hacer clic fuera
    document.getElementById('qrScannerModal').addEventListener('click', (e) => {
      if (e.target.id === 'qrScannerModal') {
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
    const modal = document.getElementById('qrScannerModal');
    const scannerStatus = document.getElementById('scannerStatus');
    
    try {
      modal.style.display = 'flex';
      scannerStatus.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Iniciando cámara...';
      
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
        locate: true
      }, (err) => {
        if (err) {
          console.error("Error al inicializar Quagga:", err);
          scannerStatus.innerHTML = '<i class="fas fa-exclamation-circle"></i> Error al acceder a la cámara';
          return;
        }
        
        console.log("Quagga inicializado correctamente");
        Quagga.start();
        this.isScanning = true;
        scannerStatus.innerHTML = '<i class="fas fa-qrcode"></i> Acerca el código a la cámara';
        
        // Detectar códigos
        Quagga.onDetected(this.onBarcodeDetected.bind(this));
      });
      
    } catch (error) {
      console.error("Error en el escáner:", error);
      scannerStatus.innerHTML = '<i class="fas fa-exclamation-circle"></i> Error: ' + error.message;
    }
  }
  
  stopScanner() {
    if (this.isScanning) {
      Quagga.stop();
      this.isScanning = false;
    }
    
    const modal = document.getElementById('qrScannerModal');
    modal.style.display = 'none';
    
    // Limpiar el contenedor
    const interactive = document.getElementById('interactive');
    interactive.innerHTML = '';
  }
  
  async switchCamera() {
    this.currentCamera = this.currentCamera === 'environment' ? 'user' : 'environment';
    
    // Reiniciar el escáner con la nueva cámara
    this.stopScanner();
    await new Promise(resolve => setTimeout(resolve, 500)); // Pequeña pausa
    await this.startScanner();
    
    // Actualizar estado
    const scannerStatus = document.getElementById('scannerStatus');
    scannerStatus.innerHTML = `<i class="fas fa-sync-alt"></i> Cámara ${this.currentCamera === 'environment' ? 'trasera' : 'frontal'} activada`;
  }
  
  onBarcodeDetected(result) {
    if (result && result.codeResult && result.codeResult.code) {
      const code = result.codeResult.code;
      console.log("Código detectado:", code);
      
      // Vibrar si está habilitado
      if (keyboardManager && keyboardManager.vibrationEnabled && navigator.vibrate) {
        navigator.vibrate(200);
      }
      
      // Reproducir sonido de éxito
      if (keyboardManager && keyboardManager.soundsEnabled && typeof playSuccessSound === 'function') {
        playSuccessSound();
      }
      
      // Procesar el código
      this.processScannedCode(code);
      
      // Detener el escáner momentáneamente para evitar múltiples lecturas
      Quagga.stop();
      
      // Mostrar mensaje de éxito
      const scannerStatus = document.getElementById('scannerStatus');
      scannerStatus.innerHTML = `<i class="fas fa-check-circle"></i> Código detectado: ${code}`;
      
      // Reiniciar el escáner después de un breve periodo
      setTimeout(() => {
        if (this.isScanning) {
          Quagga.start();
          scannerStatus.innerHTML = '<i class="fas fa-qrcode"></i> Escaneando...';
        }
      }, 2000);
    }
  }
  
  processScannedCode(code) {
    // Normalizar el código
    const normalizedCode = code.trim().toUpperCase();
    
    // Intentar procesar como QR
    const parts = parseQRCode(normalizedCode);
    
    if (parts) {
      // Código QR válido
      currentQRParts = parts;
      processQRCodeParts(parts);
      
      // Cerrar el escáner después del procesamiento exitoso
      setTimeout(() => {
        this.stopScanner();
      }, 1000);
    } else {
      // Mostrar código en el input para edición manual
      const barcodeInput = document.getElementById('barcode');
      barcodeInput.value = normalizedCode;
      
      // Habilitar temporalmente el teclado para permitir edición
      if (keyboardManager) {
        keyboardManager.enableTemporaryKeyboard();
        
        // Mostrar mensaje para edición manual
        keyboardManager.showTemporaryMessage(
          'Código detectado. Puedes editarlo manualmente si es necesario.',
          'info',
          3000
        );
      }
    }
  }
}

// Inicializar escáner
let qrScanner;

function initializeQRScanner() {
  qrScanner = new QRScanner();
  return qrScanner;
}
