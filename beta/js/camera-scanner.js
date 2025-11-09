// Configuración y control del escáner de cámara
class CameraScanner {
    constructor() {
        this.isInitialized = false;
        this.isScanning = false;
        this.scannerActive = false; // Deshabilitado por defecto
        this.currentStream = null;
        
        // Configuración de Quagga
        this.quaggaConfig = {
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: document.querySelector('#cameraScannerView'),
                constraints: {
                    width: 640,
                    height: 480,
                    facingMode: "environment" // Cámara trasera
                }
            },
            locator: {
                patchSize: "medium",
                halfSample: true
            },
            numOfWorkers: 2,
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
                    "qrcode_reader" // Agregar soporte para QR
                ]
            },
            locate: true,
            frequency: 10
        };
        
        this.init();
    }

    init() {
        // Verificar si el navegador soporta Quagga
        if (!this.isQuaggaSupported()) {
            console.warn('Quagga no es soportado en este navegador');
            return;
        }
        
        this.isInitialized = true;
        console.log('CameraScanner inicializado');
    }

    isQuaggaSupported() {
        return typeof Quagga !== 'undefined' && 
               navigator.mediaDevices && 
               navigator.mediaDevices.getUserMedia;
    }

    // Activar/desactivar el escáner
    setScannerActive(active) {
        this.scannerActive = active;
        
        if (!active && this.isScanning) {
            this.stopScanner();
        }
        
        this.updateUI();
    }

    updateUI() {
        const barcodeInput = document.getElementById('barcode');
        const barcodeIcon = document.querySelector('.barcode-input-container i');
        
        if (!barcodeInput || !barcodeIcon) return;
        
        if (this.scannerActive) {
            // Cambiar ícono a cámara y hacerlo clickeable
            barcodeIcon.className = 'fas fa-camera';
            barcodeIcon.style.cursor = 'pointer';
            barcodeIcon.title = 'Haz clic para escanear con cámara';
            
            // Agregar evento de clic
            barcodeIcon.onclick = () => this.toggleCameraScanner();
            
        } else {
            // Volver al ícono QR normal
            barcodeIcon.className = 'fa-solid fa-qrcode';
            barcodeIcon.style.cursor = 'default';
            barcodeIcon.title = '';
            barcodeIcon.onclick = null;
        }
    }

    // Alternar el escáner de cámara
    async toggleCameraScanner() {
        if (!this.scannerActive) return;
        
        if (this.isScanning) {
            await this.stopScanner();
        } else {
            await this.startScanner();
        }
    }

    // Iniciar el escáner
    async startScanner() {
        if (!this.isInitialized || this.isScanning) return;
        
        try {
            console.log('Iniciando escáner de cámara...');
            
            // Mostrar modal de cámara
            this.showCameraModal();
            
            // Inicializar Quagga
            await this.initializeQuagga();
            
            this.isScanning = true;
            this.updateScannerUI();
            
        } catch (error) {
            console.error('Error iniciando escáner:', error);
            this.handleScannerError(error);
        }
    }

    // Detener el escáner
    async stopScanner() {
        if (!this.isScanning) return;
        
        console.log('Deteniendo escáner de cámara...');
        
        // Detener Quagga
        if (typeof Quagga !== 'undefined') {
            Quagga.stop();
        }
        
        // Detener stream de cámara
        if (this.currentStream) {
            this.currentStream.getTracks().forEach(track => track.stop());
            this.currentStream = null;
        }
        
        // Ocultar modal
        this.hideCameraModal();
        
        this.isScanning = false;
        this.updateScannerUI();
    }

    // Inicializar Quagga
    initializeQuagga() {
        return new Promise((resolve, reject) => {
            Quagga.init(this.quaggaConfig, (err) => {
                if (err) {
                    console.error('Error inicializando Quagga:', err);
                    reject(err);
                    return;
                }
                
                console.log('Quagga inicializado correctamente');
                
                // Configurar detección de códigos
                Quagga.onDetected(this.onBarcodeDetected.bind(this));
                
                // Iniciar el proceso
                Quagga.start();
                resolve();
            });
        });
    }

    // Cuando se detecta un código
    onBarcodeDetected(result) {
        if (!result || !result.codeResult || !result.codeResult.code) return;
        
        const code = result.codeResult.code;
        console.log('Código detectado:', code);
        
        // Vibrar y dar feedback
        if (typeof vibrar === 'function') {
            vibrar(100);
        }
        
        if (typeof playSuccessSound === 'function') {
            playSuccessSound();
        }
        
        // Procesar el código como si se hubiera ingresado manualmente
        this.processScannedCode(code);
        
        // Detener el escáner después de una detección exitosa
        setTimeout(() => {
            this.stopScanner();
        }, 1000);
    }

    // Procesar el código escaneado
    processScannedCode(code) {
        const barcodeInput = document.getElementById('barcode');
        if (!barcodeInput) return;
        
        // Simular entrada manual
        barcodeInput.value = code;
        
        // Disparar evento de input para procesar el código
        const inputEvent = new Event('input', { bubbles: true });
        barcodeInput.dispatchEvent(inputEvent);
        
        // Mostrar feedback visual
        this.showScanSuccess(code);
    }

    // Mostrar modal de cámara
    showCameraModal() {
        // Crear modal si no existe
        if (!document.getElementById('cameraScannerModal')) {
            this.createCameraModal();
        }
        
        const modal = document.getElementById('cameraScannerModal');
        modal.style.display = 'flex';
        
        // Enfocar el modal
        setTimeout(() => {
            const closeBtn = modal.querySelector('#closeCameraScanner');
            if (closeBtn) closeBtn.focus();
        }, 100);
    }

    // Ocultar modal de cámara
    hideCameraModal() {
        const modal = document.getElementById('cameraScannerModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // Crear el modal de cámara
    createCameraModal() {
        const modalHTML = `
            <div id="cameraScannerModal" class="camera-modal" style="display: none;">
                <div class="camera-scanner-header">
                    <h3><i class="fas fa-camera"></i> Escáner de Cámara</h3>
                    <button id="closeCameraScanner" class="btn btn-danger btn-sm">
                        <i class="fas fa-times"></i> Cerrar
                    </button>
                </div>
                
                <div class="camera-scanner-view">
                    <div id="cameraScannerView" class="camera-view"></div>
                    <div id="cameraScannerOverlay" class="camera-overlay">
                        <div class="scan-line"></div>
                        <div class="scan-instruction">
                            <i class="fas fa-arrows-alt-h"></i>
                            <p>Enfoca el código QR o código de barras dentro del marco</p>
                        </div>
                    </div>
                </div>
                
                <div class="camera-scanner-status">
                    <div id="scannerStatus" class="scanner-status">
                        <i class="fas fa-circle-notch fa-spin"></i> Escaneando...
                    </div>
                    <div id="scannerStats" class="scanner-stats">
                        <span id="detectedCodes">0 códigos detectados</span>
                    </div>
                </div>
                
                <div class="camera-scanner-actions">
                    <button id="toggleTorch" class="btn btn-outline-light btn-sm" style="display: none;">
                        <i class="fas fa-lightbulb"></i> Flash
                    </button>
                    <button id="switchCamera" class="btn btn-outline-light btn-sm">
                        <i class="fas fa-sync-alt"></i> Cambiar Cámara
                    </button>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Configurar eventos del modal
        this.setupModalEvents();
    }

    // Configurar eventos del modal
    setupModalEvents() {
        // Cerrar modal
        document.getElementById('closeCameraScanner').addEventListener('click', () => {
            this.stopScanner();
        });
        
        // Cambiar cámara
        document.getElementById('switchCamera').addEventListener('click', () => {
            this.switchCamera();
        });
        
        // Toggle flash (si está disponible)
        document.getElementById('toggleTorch').addEventListener('click', () => {
            this.toggleTorch();
        });
        
        // Cerrar con ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isScanning) {
                this.stopScanner();
            }
        });
    }

    // Cambiar entre cámaras
    async switchCamera() {
        if (!this.isScanning) return;
        
        // Detener escáner actual
        await this.stopScanner();
        
        // Cambiar configuración de cámara
        const currentConstraints = this.quaggaConfig.inputStream.constraints;
        currentConstraints.facingMode = currentConstraints.facingMode === 'environment' ? 'user' : 'environment';
        
        // Reiniciar escáner
        setTimeout(() => {
            this.startScanner();
        }, 500);
    }

    // Toggle flash (implementación básica)
    async toggleTorch() {
        // Esta funcionalidad requiere navegadores más modernos
        // Por ahora solo mostramos/ocultamos el botón según disponibilidad
        console.log('Toggle torch - funcionalidad avanzada');
    }

    // Actualizar UI del escáner
    updateScannerUI() {
        const statusElement = document.getElementById('scannerStatus');
        if (!statusElement) return;
        
        if (this.isScanning) {
            statusElement.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Escaneando...';
            statusElement.className = 'scanner-status scanning';
        } else {
            statusElement.innerHTML = '<i class="fas fa-camera"></i> Escáner detenido';
            statusElement.className = 'scanner-status idle';
        }
    }

    // Manejar errores del escáner
    handleScannerError(error) {
        console.error('Error del escáner:', error);
        
        let errorMessage = 'Error desconocido';
        
        if (error.name === 'NotAllowedError') {
            errorMessage = 'Permiso de cámara denegado. Por favor permite el acceso a la cámara.';
        } else if (error.name === 'NotFoundError') {
            errorMessage = 'No se encontró cámara en el dispositivo.';
        } else if (error.name === 'NotSupportedError') {
            errorMessage = 'El navegador no soporta el escaneo por cámara.';
        } else if (error.name === 'NotReadableError') {
            errorMessage = 'La cámara está siendo usada por otra aplicación.';
        }
        
        // Mostrar notificación de error
        if (typeof mostrarNotificacion === 'function') {
            mostrarNotificacion('error', 'Error de Cámara', errorMessage);
        }
        
        this.stopScanner();
    }

    // Mostrar éxito de escaneo
    showScanSuccess(code) {
        if (typeof mostrarNotificacion === 'function') {
            mostrarNotificacion('success', 'Código Detectado', `Código escaneado: ${code}`);
        }
    }

    // Limpiar recursos
    destroy() {
        this.stopScanner();
        this.isInitialized = false;
    }
}

// Instancia global
const cameraScanner = new CameraScanner();

// Integración con el sistema de configuración
function setupCameraScannerIntegration() {
    // Escuchar cambios en el toggle de cámara
    const toggleCamara = document.getElementById('toggleCamaraScanner');
    if (toggleCamara) {
        toggleCamara.addEventListener('change', function(e) {
            cameraScanner.setScannerActive(e.target.checked);
        });
    }
    
    // Inicializar con la configuración guardada
    if (typeof config !== 'undefined' && config.camaraScanner !== undefined) {
        cameraScanner.setScannerActive(config.camaraScanner);
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    setupCameraScannerIntegration();
});
