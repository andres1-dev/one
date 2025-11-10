// Camera Scanner para PandaDash
class CameraScanner {
    constructor() {
        this.isActive = false;
        this.isScanning = false;
        this.quaggaInitialized = false;
        this.scanCount = 0;
        this.lastScanTime = 0;
    }

    async init() {
        try {
            // Verificar si Quagga está disponible
            if (typeof Quagga === 'undefined') {
                console.error('Quagga no está cargado');
                return false;
            }

            this.quaggaInitialized = true;
            return true;
        } catch (error) {
            console.error('Error inicializando escáner:', error);
            return false;
        }
    }

    setScannerActive(active) {
        this.isActive = active;
        
        if (active) {
            this.startScanner();
        } else {
            this.stopScanner();
        }
        
        // Actualizar UI
        this.updateScannerUI();
    }

    async startScanner() {
        if (!this.quaggaInitialized) {
            const initialized = await this.init();
            if (!initialized) return;
        }

        if (this.isScanning) return;

        try {
            await this.showScannerModal();
            
            Quagga.init({
                inputStream: {
                    name: "Live",
                    type: "LiveStream",
                    target: document.querySelector('#cameraScannerView'),
                    constraints: {
                        facingMode: "environment",
                        width: { min: 640, ideal: 1280, max: 1920 },
                        height: { min: 480, ideal: 720, max: 1080 }
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
                        "upc_e_reader"
                    ]
                },
                locator: {
                    patchSize: "medium",
                    halfSample: true
                },
                locate: true,
                numOfWorkers: 2
            }, (err) => {
                if (err) {
                    console.error('Error inicializando Quagga:', err);
                    this.updateScannerStatus('Error: ' + err.message, 'error');
                    return;
                }
                
                Quagga.start();
                this.isScanning = true;
                this.updateScannerStatus('Escaneando...', 'scanning');
            });

            Quagga.onDetected(this.onBarcodeDetected.bind(this));
            Quagga.onProcessed(this.onProcessed.bind(this));

        } catch (error) {
            console.error('Error iniciando escáner:', error);
            this.updateScannerStatus('Error al iniciar cámara', 'error');
        }
    }

    stopScanner() {
        if (this.isScanning) {
            Quagga.stop();
            this.isScanning = false;
        }
        this.hideScannerModal();
        this.updateScannerStatus('Escáner desactivado', 'idle');
    }

    onBarcodeDetected(result) {
        const currentTime = Date.now();
        const timeSinceLastScan = currentTime - this.lastScanTime;
        
        // Prevenir escaneos demasiado rápidos (mínimo 1 segundo entre escaneos)
        if (timeSinceLastScan < 1000) {
            return;
        }

        this.lastScanTime = currentTime;
        this.scanCount++;
        
        const code = result.codeResult.code;
        console.log('Código detectado:', code);
        
        // Actualizar estadísticas
        this.updateScannerStats();
        
        // Procesar el código (usar la misma lógica que el input manual)
        this.processScannedCode(code);
        
        // Efecto de éxito
        this.showScanSuccess();
    }

    onProcessed(result) {
        const drawingCtx = Quagga.canvas.ctx.overlay;
        const drawingCanvas = Quagga.canvas.dom.overlay;

        if (result) {
            if (result.boxes) {
                drawingCtx.clearRect(0, 0, parseInt(drawingCanvas.getAttribute("width")), parseInt(drawingCanvas.getAttribute("height")));
                result.boxes.filter(function (box) {
                    return box !== result.box;
                }).forEach(function (box) {
                    Quagga.ImageDebug.drawPath(box, {x: 0, y: 1}, drawingCtx, {color: "green", lineWidth: 2});
                });
            }

            if (result.box) {
                Quagga.ImageDebug.drawPath(result.box, {x: 0, y: 1}, drawingCtx, {color: "#00F", lineWidth: 2});
            }

            if (result.codeResult && result.codeResult.code) {
                Quagga.ImageDebug.drawPath(result.line, {x: 'x', y: 'y'}, drawingCtx, {color: 'red', lineWidth: 3});
            }
        }
    }

    processScannedCode(code) {
        // Simular el input en el campo de barcode
        const barcodeInput = document.getElementById('barcode');
        if (barcodeInput) {
            barcodeInput.value = code;
            
            // Disparar evento input para procesar el código
            const inputEvent = new Event('input', { bubbles: true });
            barcodeInput.dispatchEvent(inputEvent);
        }
        
        // Cerrar el escáner después de un escaneo exitoso
        setTimeout(() => {
            this.stopScanner();
        }, 1000);
    }

    showScanSuccess() {
        const statusElement = document.querySelector('.scanner-status');
        if (statusElement) {
            statusElement.textContent = '✓ Código detectado';
            statusElement.style.backgroundColor = 'rgba(0, 255, 0, 0.2)';
            statusElement.style.borderColor = '#00ff00';
            
            setTimeout(() => {
                this.updateScannerStatus('Escaneando...', 'scanning');
            }, 1000);
        }
    }

    async showScannerModal() {
        const modal = document.getElementById('cameraScannerModal');
        if (!modal) {
            this.createScannerModal();
        }
        
        document.getElementById('cameraScannerModal').style.display = 'flex';
        
        // Enfocar el modal para prevenir teclado
        setTimeout(() => {
            document.activeElement?.blur();
        }, 100);
    }

    hideScannerModal() {
        const modal = document.getElementById('cameraScannerModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    createScannerModal() {
        const modalHTML = `
            <div id="cameraScannerModal" class="camera-modal" style="display: none;">
                <div class="camera-scanner-header">
                    <h3><i class="fas fa-camera"></i> Escáner de Códigos</h3>
                    <button class="btn btn-danger btn-sm" onclick="window.cameraScanner.stopScanner()">
                        <i class="fas fa-times"></i> Cerrar
                    </button>
                </div>
                
                <div class="camera-scanner-view">
                    <div id="cameraScannerView"></div>
                    <div class="camera-overlay">
                        <div class="scan-line"></div>
                    </div>
                </div>
                
                <div class="camera-scanner-status">
                    <div class="scanner-status idle">Listo para escanear</div>
                    <div class="scanner-stats">Escaneos: <span id="scanCount">0</span></div>
                </div>
                
                <div class="scan-instruction">
                    <i class="fas fa-expand-arrows-alt"></i>
                    <p>Enfoca el código QR o de barras dentro del área de escaneo</p>
                </div>
                
                <div class="camera-scanner-actions">
                    <button class="btn btn-warning btn-sm" onclick="window.cameraScanner.toggleTorch()">
                        <i class="fas fa-lightbulb"></i> Flash
                    </button>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    updateScannerStatus(message, type = 'idle') {
        const statusElement = document.querySelector('.scanner-status');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `scanner-status ${type}`;
        }
    }

    updateScannerStats() {
        const statsElement = document.getElementById('scanCount');
        if (statsElement) {
            statsElement.textContent = this.scanCount;
        }
    }

    updateScannerUI() {
        const barcodeIcon = document.querySelector('.barcode-input-container i');
        if (barcodeIcon) {
            if (this.isActive) {
                barcodeIcon.classList.add('scanner-active');
            } else {
                barcodeIcon.classList.remove('scanner-active');
            }
        }
    }

    toggleTorch() {
        // Implementación básica de flash (depende del navegador/dispositivo)
        if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
            // En una implementación real, esto controlaría la antorcha de la cámara
            console.log('Toggle torch - funcionalidad dependiente del dispositivo');
        }
    }
}

// Inicializar el escáner de cámara global
const cameraScanner = new CameraScanner();

// Hacer disponible globalmente
window.cameraScanner = cameraScanner;

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    // El escáner se activará/desactivará mediante la configuración
    console.log('Camera Scanner cargado');
});
