// Control completo del teclado y escáner QR
class InputController {
  constructor() {
    this.keyboardEnabled = false;
    this.isScanningQR = false;
    this.qrScanner = null;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.disableKeyboard(); // Por defecto deshabilitado
  }

  setupEventListeners() {
    // Botón toggle teclado
    const keyboardBtn = document.getElementById('keyboardToggleBtn');
    const qrBtn = document.getElementById('qrScannerBtn');
    
    if (keyboardBtn) {
      keyboardBtn.addEventListener('click', () => {
        this.toggleKeyboard();
      });
    } else {
      console.error('keyboardToggleBtn no encontrado');
    }

    // Botón escáner QR
    if (qrBtn) {
      qrBtn.addEventListener('click', () => {
        this.openQRScanner();
      });
    } else {
      console.error('qrScannerBtn no encontrado');
    }

    // Eventos del input
    const barcodeInput = document.getElementById('barcode');
    
    if (barcodeInput) {
      // Prevenir cualquier foco no deseado
      barcodeInput.addEventListener('mousedown', (e) => {
        if (!this.keyboardEnabled) {
          e.preventDefault();
          this.showKeyboardDisabledMessage();
        }
      });

      barcodeInput.addEventListener('touchstart', (e) => {
        if (!this.keyboardEnabled) {
          e.preventDefault();
          this.showKeyboardDisabledMessage();
        }
      });

      barcodeInput.addEventListener('focus', () => {
        if (!this.keyboardEnabled) {
          setTimeout(() => barcodeInput.blur(), 100);
        }
      });

      // Manejar entrada manual cuando el teclado está habilitado
      barcodeInput.addEventListener('input', (e) => {
        if (this.keyboardEnabled) {
          // Solo procesar si el teclado está habilitado
          this.handleManualInput(e.target.value);
        } else {
          // Si no está habilitado, limpiar el input
          e.target.value = '';
        }
      });

      // Prevenir Enter automático
      barcodeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (this.keyboardEnabled && barcodeInput.value.trim().length > 0) {
            this.processInput(barcodeInput.value.trim());
            barcodeInput.value = '';
          }
        }
      });
    } else {
      console.error('barcode input no encontrado');
    }

    // Cerrar escáner QR con Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isScanningQR) {
        this.closeQRScanner();
      }
    });

    // Botón cerrar escáner QR
    const closeQRBtn = document.getElementById('closeQRScanner');
    if (closeQRBtn) {
      closeQRBtn.addEventListener('click', () => {
        this.closeQRScanner();
      });
    } else {
      console.error('closeQRScanner no encontrado');
    }
  }

  toggleKeyboard() {
    const barcodeInput = document.getElementById('barcode');
    const keyboardBtn = document.getElementById('keyboardToggleBtn');
    
    if (this.keyboardEnabled) {
      this.disableKeyboard();
    } else {
      this.enableKeyboard();
    }
    
    // Actualizar UI
    this.updateKeyboardUI();
  }

  enableKeyboard() {
    this.keyboardEnabled = true;
    const barcodeInput = document.getElementById('barcode');
    
    if (barcodeInput) {
      barcodeInput.readOnly = false;
      barcodeInput.classList.remove('readonly');
      barcodeInput.classList.add('editable');
      barcodeInput.placeholder = "Escribe el código manualmente...";
    }
    
    console.log("Teclado habilitado - Modo edición manual");
  }

  disableKeyboard() {
    this.keyboardEnabled = false;
    const barcodeInput = document.getElementById('barcode');
    
    if (barcodeInput) {
      barcodeInput.readOnly = true;
      barcodeInput.classList.remove('editable');
      barcodeInput.classList.add('readonly');
      barcodeInput.placeholder = "Escanea un código QR";
      barcodeInput.blur();
    }
    
    // Forzar blur en cualquier elemento activo
    if (document.activeElement && document.activeElement.tagName === 'INPUT') {
      document.activeElement.blur();
    }
    
    console.log("Teclado deshabilitado - Solo escáner");
  }

  updateKeyboardUI() {
    const keyboardBtn = document.getElementById('keyboardToggleBtn');
    
    if (keyboardBtn) {
      if (this.keyboardEnabled) {
        keyboardBtn.classList.remove('keyboard-disabled');
        keyboardBtn.classList.add('keyboard-enabled');
        keyboardBtn.title = "Teclado habilitado - Click para deshabilitar";
      } else {
        keyboardBtn.classList.remove('keyboard-enabled');
        keyboardBtn.classList.add('keyboard-disabled');
        keyboardBtn.title = "Teclado deshabilitado - Click para habilitar";
      }
    }
  }

  showKeyboardDisabledMessage() {
    // Mostrar mensaje temporal
    const statusDiv = document.getElementById('status');
    if (!statusDiv) return;
    
    const originalContent = statusDiv.innerHTML;
    const originalClass = statusDiv.className;
    
    statusDiv.className = 'warning';
    statusDiv.innerHTML = '<i class="fas fa-keyboard-slash"></i> TECLADO DESHABILITADO - Use el ícono para activar';
    
    setTimeout(() => {
      statusDiv.className = originalClass;
      statusDiv.innerHTML = originalContent;
    }, 2000);
  }

  handleManualInput(value) {
    // Aquí puedes agregar validaciones específicas para entrada manual
    if (value.length >= 10) { // Ejemplo: procesar después de 10 caracteres
      // Opcional: auto-procesar después de cierta longitud
      // this.processInput(value);
    }
  }

  openQRScanner() {
    this.isScanningQR = true;
    const modal = document.getElementById('qrScannerModal');
    const video = document.getElementById('qrScannerVideo');
    const canvas = document.getElementById('qrScannerCanvas');
    const status = document.getElementById('scannerStatus');
    
    if (!modal || !video || !canvas || !status) {
      console.error("Elementos del escáner QR no encontrados");
      return;
    }
    
    modal.style.display = 'flex';
    status.textContent = 'Iniciando cámara...';
    
    // Configurar cámara
    navigator.mediaDevices.getUserMedia({ 
      video: { 
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      } 
    })
    .then(stream => {
      video.srcObject = stream;
      video.play();
      
      status.textContent = 'Escaneando códigos QR...';
      
      // Iniciar detección de QR
      this.startQRDetection(video, canvas, status);
    })
    .catch(error => {
      console.error("Error al acceder a la cámara:", error);
      status.textContent = 'Error: No se pudo acceder a la cámara';
      status.style.color = '#f72585';
    });
  }

  startQRDetection(video, canvas, status) {
    const ctx = canvas.getContext('2d');
    
    const checkQR = () => {
      if (!this.isScanningQR) return;
      
      try {
        // Dibujar frame actual en canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Obtener datos de imagen para procesar
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Usar jsQR para detectar códigos
        if (typeof jsQR !== 'undefined') {
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });
          
          if (code) {
            // Código QR detectado
            this.processScannedQR(code.data);
            return; // Salir del loop
          }
        } else {
          console.error("jsQR no está cargado");
          status.textContent = 'Error: Librería QR no disponible';
          this.closeQRScanner();
          return;
        }
        
        // Continuar escaneando
        requestAnimationFrame(checkQR);
      } catch (error) {
        console.error("Error en detección QR:", error);
        status.textContent = 'Error en escáner';
        setTimeout(() => {
          if (this.isScanningQR) {
            requestAnimationFrame(checkQR);
          }
        }, 1000);
      }
    };
    
    // Ajustar tamaño del canvas
    video.addEventListener('loadedmetadata', () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      checkQR();
    }, { once: true });
  }

  processScannedQR(qrData) {
    console.log("Código QR detectado:", qrData);
    
    // Cerrar escáner
    this.closeQRScanner();
    
    // Procesar el código QR
    this.processInput(qrData);
    
    // Mostrar confirmación
    this.showScanSuccess();
  }

  processInput(inputData) {
    // Usar las funciones globales existentes
    if (typeof parseQRCode === 'function' && typeof processQRCodeParts === 'function') {
      const parts = parseQRCode(inputData);
      
      if (parts) {
        if (typeof currentQRParts !== 'undefined') {
          currentQRParts = parts;
        }
        const startTime = Date.now();
        processQRCodeParts(parts);
        const searchTime = Date.now() - startTime;
        
        const statusDiv = document.getElementById('status');
        if (statusDiv) {
          statusDiv.className = 'processed';
          statusDiv.textContent = `REGISTRO PROCESADO (${searchTime}ms)`;
        }
      } else {
        if (typeof showError === 'function' && typeof playErrorSound === 'function') {
          showError(inputData, "Formato de código no válido");
          playErrorSound();
        }
      }
    } else {
      console.error("Funciones de procesamiento QR no disponibles");
    }
  }

  showScanSuccess() {
    const statusDiv = document.getElementById('status');
    if (!statusDiv) return;
    
    const originalContent = statusDiv.innerHTML;
    const originalClass = statusDiv.className;
    
    statusDiv.className = 'processed';
    statusDiv.innerHTML = '<i class="fas fa-qrcode"></i> CÓDIGO ESCANEADO EXITOSAMENTE';
    
    setTimeout(() => {
      statusDiv.className = originalClass;
      statusDiv.innerHTML = originalContent;
    }, 2000);
  }

  closeQRScanner() {
    this.isScanningQR = false;
    const modal = document.getElementById('qrScannerModal');
    const video = document.getElementById('qrScannerVideo');
    
    // Detener stream de cámara
    if (video && video.srcObject) {
      video.srcObject.getTracks().forEach(track => track.stop());
    }
    
    if (modal) {
      modal.style.display = 'none';
    }
  }
}

// SOLUCIÓN: No declares la variable aquí, solo la función de inicialización
function initializeInputController() {
  // Si ya existe, no crear otra instancia
  if (!window.appInputController) {
    window.appInputController = new InputController();
  }
  return window.appInputController;
}
