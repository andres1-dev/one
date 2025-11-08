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
      
      // Iniciar detección de QR
      this.startQRDetection(video);
      
    } catch (error) {
      console.error("Error al acceder a la cámara QR:", error);
      alert("No se pudo acceder a la cámara para escanear QR. Por favor permite el acceso.");
      this.closeQRScanner();
    }
  }

  startQRDetection(video) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    const checkQR = () => {
      if (!this.isScanning) return;
      
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        this.detectQRCode(imageData);
      }
      
      if (this.isScanning) {
        requestAnimationFrame(checkQR);
      }
    };
    
    checkQR();
  }

  detectQRCode(imageData) {
    // Implementación simple de detección de QR
    // En una implementación real, usarías una librería como jsQR
    try {
      // Simulación de detección - en producción usar jsQR
      const qrData = this.simulateQRDetection(imageData);
      
      if (qrData) {
        this.handleQRDetected(qrData);
      }
    } catch (error) {
      console.error("Error en detección QR:", error);
    }
  }

  simulateQRDetection(imageData) {
    // Esta es una simulación - en producción implementar con jsQR
    // Por ahora solo simula la detección después de 3 segundos
    if (this.isScanning && !this.detectionStarted) {
      this.detectionStarted = true;
      setTimeout(() => {
        if (this.isScanning) {
          // Simular que se detectó un QR (en producción esto vendría del análisis real)
          const simulatedData = "REC58101-805027653"; // Ejemplo
          this.handleQRDetected(simulatedData);
        }
      }, 3000);
    }
    return null;
  }

  handleQRDetected(qrData) {
    console.log("QR detectado:", qrData);
    
    // Cerrar escáner
    this.closeQRScanner();
    
    // Procesar el código QR
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
    const originalColor = statusDiv.style.backgroundColor;
    statusDiv.style.backgroundColor = '#28a745';
    statusDiv.innerHTML = '<i class="fas fa-check-circle"></i> QR DETECTADO';
    
    setTimeout(() => {
      if (statusDiv) {
        statusDiv.style.backgroundColor = originalColor;
      }
    }, 1000);
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
      console.error("Error al controlar la linterna:", error);
    }
  }

  closeQRScanner() {
    this.isScanning = false;
    this.detectionStarted = false;
    
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
    
    // Re-enfocar el input si está habilitado
    setTimeout(() => {
      if (barcodeInput && !barcodeInput.readOnly) {
        barcodeInput.focus();
      }
    }, 300);
  }
}

// Inicializar escáner QR
let qrScanner;

function initializeQRScanner() {
  qrScanner = new QRScanner();
  return qrScanner;
}
