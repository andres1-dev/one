// QR Scanner functionality with QuaggaJS
class QRScanner {
  constructor() {
    this.isScanning = false;
    this.torchEnabled = false;
    this.currentCamera = 'environment';
    this.cameras = [];
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

    // Botón de cambiar cámara
    document.getElementById('switchCameraBtn').addEventListener('click', () => {
      this.switchCamera();
    });

    // Cerrar al hacer clic fuera
    document.getElementById('qrScannerModal').addEventListener('click', (e) => {
      if (e.target.id === 'qrScannerModal') {
        this.closeQRScanner();
      }
    });
  }

  async openQRScanner() {
    console.log('📷 Abriendo escáner QR/Barcode...');
    const modal = document.getElementById('qrScannerModal');
    const scannerStatus = document.getElementById('scannerStatus');
    
    modal.style.display = 'flex';
    scannerStatus.textContent = 'Preparando cámara...';
    
    try {
      // Detectar cámaras disponibles
      await this.detectCameras();
      
      // Inicializar Quagga
      await this.initializeQuagga();
      
      this.isScanning = true;
      scannerStatus.textContent = 'Escaneando... Enfoca un código';
      
    } catch (error) {
      console.error('❌ Error al inicializar escáner:', error);
      scannerStatus.textContent = 'Error: ' + error.message;
      this.showScannerError('No se pudo acceder a la cámara. Verifica los permisos.');
    }
  }

  async detectCameras() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.cameras = devices.filter(device => device.kind === 'videoinput');
      
      console.log(`📹 Cámaras detectadas: ${this.cameras.length}`);
      
      // Mostrar botón de cambiar cámara solo si hay más de una
      const switchBtn = document.getElementById('switchCameraBtn');
      if (this.cameras.length > 1) {
        switchBtn.classList.add('available');
      } else {
        switchBtn.classList.remove('available');
      }
      
    } catch (error) {
      console.error('❌ Error detectando cámaras:', error);
    }
  }

  initializeQuagga() {
    return new Promise((resolve, reject) => {
      Quagga.init({
        inputStream: {
          name: "Live",
          type: "LiveStream",
          target: document.querySelector('#interactive'),
          constraints: {
            facingMode: this.currentCamera,
            width: { min: 640 },
            height: { min: 480 }
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
            "qrcode_reader"  // QR code support
          ]
        },
        locate: true,
        numOfWorkers: 2
      }, (err) => {
        if (err) {
          console.error('❌ Error inicializando Quagga:', err);
          reject(err);
          return;
        }
        
        console.log('✅ Quagga inicializado correctamente');
        Quagga.start();
        
        // Configurar el detector de códigos
        Quagga.onDetected(this.handleCodeDetected.bind(this));
        
        // Configurar el proceso para mostrar feedback
        Quagga.onProcessed(this.onProcessed.bind(this));
        
        resolve();
      });
    });
  }

  onProcessed(result) {
    const drawingCtx = Quagga.canvas.ctx.overlay;
    const drawingCanvas = Quagga.canvas.dom.overlay;

    if (result) {
      if (result.boxes) {
        drawingCtx.clearRect(0, 0, parseInt(drawingCanvas.getAttribute("width")), parseInt(drawingCanvas.getAttribute("height")));
        result.boxes.filter(box => box !== result.box).forEach(box => {
          Quagga.ImageDebug.drawPath(box, { x: 0, y: 1 }, drawingCtx, { color: "green", lineWidth: 2 });
        });
      }

      if (result.box) {
        Quagga.ImageDebug.drawPath(result.box, { x: 0, y: 1 }, drawingCtx, { color: "#00F", lineWidth: 2 });
      }

      if (result.codeResult && result.codeResult.code) {
        Quagga.ImageDebug.drawPath(result.line, { x: 'x', y: 'y' }, drawingCtx, { color: 'red', lineWidth: 3 });
      }
    }
  }

  handleCodeDetected(result) {
    if (!this.isScanning) return;
    
    const code = result.codeResult.code;
    console.log('✅ Código detectado:', code);
    
    // Detener el escáner temporalmente para evitar múltiples detecciones
    this.isScanning = false;
    Quagga.stop();
    
    // Procesar el código detectado
    this.processDetectedCode(code);
  }

  processDetectedCode(code) {
    const scannerStatus = document.getElementById('scannerStatus');
    scannerStatus.textContent = 'Código detectado!';
    scannerStatus.style.color = '#28a745';
    
    // Feedback visual
    const modal = document.getElementById('qrScannerModal');
    modal.classList.add('scanning-active');
    
    // Sonido de éxito
    playSuccessSound();
    
    // Mostrar el código detectado brevemente antes de cerrar
    setTimeout(() => {
      this.closeQRScanner();
      
      // Insertar el código en el input y procesarlo
      if (barcodeInput) {
        barcodeInput.value = code;
        
        // Disparar evento de input para procesar automáticamente
        const inputEvent = new Event('input', { bubbles: true });
        barcodeInput.dispatchEvent(inputEvent);
      }
      
      // Feedback en el estado principal
      this.showDetectionFeedback(code);
      
    }, 1000);
  }

  showDetectionFeedback(code) {
    const originalBackground = statusDiv.style.backgroundColor;
    const originalHTML = statusDiv.innerHTML;
    
    statusDiv.style.backgroundColor = '#28a745';
    statusDiv.innerHTML = `<i class="fas fa-check-circle"></i> CÓDIGO DETECTADO: ${code.substring(0, 15)}...`;
    
    setTimeout(() => {
      if (statusDiv) {
        statusDiv.style.backgroundColor = originalBackground;
        statusDiv.innerHTML = originalHTML;
      }
    }, 3000);
  }

  showScannerError(message) {
    const scannerStatus = document.getElementById('scannerStatus');
    scannerStatus.innerHTML = `<span style="color: #dc3545;">❌ ${message}</span>`;
    
    // Agregar botón de reintento
    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn btn-primary btn-sm';
    retryBtn.innerHTML = '<i class="fas fa-redo"></i> Reintentar';
    retryBtn.onclick = () => this.openQRScanner();
    
    scannerStatus.appendChild(document.createElement('br'));
    scannerStatus.appendChild(retryBtn);
  }

  async toggleTorch() {
    try {
      const track = Quagga.CameraAccess.getActiveTrack();
      if (track && typeof track.applyConstraints === 'function') {
        const capabilities = track.getCapabilities ? track.getCapabilities() : {};
        
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
        } else {
          this.showScannerError('Linterna no disponible en este dispositivo');
        }
      }
    } catch (error) {
      console.error('❌ Error al controlar la linterna:', error);
      this.showScannerError('Error al controlar linterna');
    }
  }

  async switchCamera() {
    if (this.cameras.length <= 1) return;
    
    try {
      // Detener Quagga actual
      Quagga.stop();
      
      // Cambiar entre cámara trasera y frontal
      this.currentCamera = this.currentCamera === 'environment' ? 'user' : 'environment';
      
      console.log(`🔄 Cambiando a cámara: ${this.currentCamera}`);
      
      // Reinicializar Quagga con la nueva cámara
      await this.initializeQuagga();
      
      this.isScanning = true;
      
      const scannerStatus = document.getElementById('scannerStatus');
      scannerStatus.textContent = `Cámara ${this.currentCamera === 'environment' ? 'trasera' : 'frontal'} activada`;
      
    } catch (error) {
      console.error('❌ Error cambiando cámara:', error);
      this.showScannerError('Error al cambiar cámara');
    }
  }

  closeQRScanner() {
    console.log('📷 Cerrando escáner...');
    this.isScanning = false;
    
    // Detener Quagga
    if (Quagga) {
      Quagga.stop();
    }
    
    const modal = document.getElementById('qrScannerModal');
    modal.style.display = 'none';
    modal.classList.remove('scanning-active');
    
    // Restaurar estado
    const scannerStatus = document.getElementById('scannerStatus');
    scannerStatus.textContent = 'Preparando cámara...';
    scannerStatus.style.color = '';
    
    const torchBtn = document.getElementById('toggleTorchBtn');
    torchBtn.innerHTML = '<i class="fas fa-lightbulb"></i> Linterna';
    torchBtn.style.backgroundColor = '';
    this.torchEnabled = false;
    
    // Limpiar cualquier error
    const errorElements = document.querySelectorAll('.scanner-error');
    errorElements.forEach(el => el.remove());
  }
}

// Inicializar escáner QR
let qrScanner;

function initializeQRScanner() {
  console.log('🎯 Inicializando escáner QR/Barcode...');
  qrScanner = new QRScanner();
  return qrScanner;
}
