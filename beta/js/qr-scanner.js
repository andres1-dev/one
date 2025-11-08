// QR Scanner functionality
class QRScanner {
  constructor() {
    this.qrStream = null;
    this.isScanning = false;
    this.torchEnabled = false;
    this.initEventListeners();
  }

  initEventListeners() {
    // Botón para abrir escáner QR
    document.getElementById('qrScannerBtn').addEventListener('click', () => {
      this.openQRScanner();
    });

    // Botón para cerrar escáner QR
    document.getElementById('closeQrScanner').addEventListener('click', () => {
      this.closeQRScanner();
    });

    // Botón de linterna
    document.getElementById('toggleTorchBtn').addEventListener('click', () => {
      this.toggleTorch();
    });

    // Cerrar al hacer clic fuera
    document.getElementById('qrScannerModal').addEventListener('click', (e) => {
      if (e.target.id === 'qrScannerModal') {
        this.closeQRScanner();
      }
    });
  }

  async openQRScanner() {
    console.log('📷 Abriendo escáner QR...');
    const modal = document.getElementById('qrScannerModal');
    const video = document.getElementById('qrVideo');
    
    modal.style.display = 'flex';
    
    try {
      // Configurar cámara trasera
      this.qrStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      video.srcObject = this.qrStream;
      this.isScanning = true;
      
      // Simular detección de QR después de 3 segundos
      this.simulateQRDetection();
      
    } catch (error) {
      console.error("❌ Error al acceder a la cámara QR:", error);
      alert("No se pudo acceder a la cámara para escanear QR. Por favor permite el acceso.");
      this.closeQRScanner();
    }
  }

  simulateQRDetection() {
    console.log('🔍 Simulando detección QR...');
    
    // Simular que se detecta un QR después de 3 segundos
    setTimeout(() => {
      if (this.isScanning) {
        // Código QR de ejemplo - en producción esto vendría de una librería real
        const simulatedQRData = "REC58101-805027653";
        console.log('✅ QR detectado:', simulatedQRData);
        this.handleQRDetected(simulatedQRData);
      }
    }, 3000);
  }

  handleQRDetected(qrData) {
    console.log('🎯 Procesando QR detectado:', qrData);
    
    // Cerrar escáner
    this.closeQRScanner();
    
    // Procesar el código QR en el input
    if (barcodeInput) {
      barcodeInput.value = qrData;
      
      // Disparar evento de input para procesar automáticamente
      const inputEvent = new Event('input', { bubbles: true });
      barcodeInput.dispatchEvent(inputEvent);
    }
    
    // Feedback visual y sonoro
    playSuccessSound();
    this.showDetectionFeedback();
  }

  showDetectionFeedback() {
    // Feedback visual breve
    const originalBackground = statusDiv.style.backgroundColor;
    const originalHTML = statusDiv.innerHTML;
    
    statusDiv.style.backgroundColor = '#28a745';
    statusDiv.innerHTML = '<i class="fas fa-check-circle"></i> QR DETECTADO';
    
    setTimeout(() => {
      if (statusDiv) {
        statusDiv.style.backgroundColor = originalBackground;
        statusDiv.innerHTML = originalHTML;
      }
    }, 2000);
  }

  async toggleTorch() {
    if (!this.qrStream) return;
    
    try {
      const track = this.qrStream.getVideoTracks()[0];
      const capabilities = track.getCapabilities();
      
      if (capabilities.torch) {
        await track.applyConstraints({
          advanced: [{ torch: !this.torchEnabled }]
        });
        this.torchEnabled = !this.torchEnabled;
        
        const torchBtn = document.getElementById('toggleTorchBtn');
        if (this.torchEnabled) {
          torchBtn.innerHTML = '<i class="fas fa-lightbulb"></i> Apagar Linterna';
          torchBtn.style.backgroundColor = '#f8961e';
        } else {
          torchBtn.innerHTML = '<i class="fas fa-lightbulb"></i> Linterna';
          torchBtn.style.backgroundColor = '';
        }
      }
    } catch (error) {
      console.error("❌ Error al controlar la linterna:", error);
    }
  }

  closeQRScanner() {
    console.log('📷 Cerrando escáner QR...');
    this.isScanning = false;
    
    if (this.qrStream) {
      this.qrStream.getTracks().forEach(track => track.stop());
      this.qrStream = null;
    }
    
    const modal = document.getElementById('qrScannerModal');
    modal.style.display = 'none';
    
    // Restaurar estado de linterna
    this.torchEnabled = false;
    const torchBtn = document.getElementById('toggleTorchBtn');
    torchBtn.innerHTML = '<i class="fas fa-lightbulb"></i> Linterna';
    torchBtn.style.backgroundColor = '';
  }
}

// Inicializar escáner QR
let qrScanner;

function initializeQRScanner() {
  console.log('🎯 Inicializando escáner QR...');
  qrScanner = new QRScanner();
  return qrScanner;
}
