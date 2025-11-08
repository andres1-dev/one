// Gestión del teclado y entrada manual
class KeyboardManager {
  constructor() {
    this.keyboardEnabled = false;
    this.autoSubmit = true;
    this.soundsEnabled = true;
    this.vibrationEnabled = false;
    
    this.init();
  }
  
  init() {
    this.setupEventListeners();
    this.disableKeyboard(); // Deshabilitar por defecto
    this.updateUI();
  }
  
  setupEventListeners() {
    // Botón de teclado flotante
    document.getElementById('keyboardToggleBtn').addEventListener('click', () => {
      this.toggleKeyboard();
    });
    
    // Botón de entrada manual
    document.getElementById('manualInputBtn').addEventListener('click', () => {
      this.enableTemporaryKeyboard();
    });
    
    // Configuración del panel
    document.getElementById('keyboardToggle').addEventListener('change', (e) => {
      this.setKeyboardEnabled(e.target.checked);
    });
    
    document.getElementById('autoSubmitToggle').addEventListener('change', (e) => {
      this.autoSubmit = e.target.checked;
      this.saveSettings();
    });
    
    document.getElementById('soundToggle').addEventListener('change', (e) => {
      this.soundsEnabled = e.target.checked;
      this.saveSettings();
    });
    
    document.getElementById('vibrationToggle').addEventListener('change', (e) => {
      this.vibrationEnabled = e.target.checked;
      this.saveSettings();
    });
    
    // Input de barcode
    const barcodeInput = document.getElementById('barcode');
    barcodeInput.addEventListener('focus', () => {
      if (!this.keyboardEnabled) {
        barcodeInput.blur();
        this.showKeyboardMessage();
      }
    });
    
    barcodeInput.addEventListener('input', (e) => {
      if (this.autoSubmit && this.isValidFormat(e.target.value)) {
        this.processBarcode(e.target.value);
      }
    });
    
    barcodeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && barcodeInput.value.trim()) {
        this.processBarcode(barcodeInput.value);
      }
    });
    
    // Cargar configuración guardada
    this.loadSettings();
  }
  
  disableKeyboard() {
    this.keyboardEnabled = false;
    const barcodeInput = document.getElementById('barcode');
    barcodeInput.readOnly = true;
    barcodeInput.classList.add('readonly');
    barcodeInput.placeholder = "Usa el escáner QR o toca el ícono del teclado";
    this.updateUI();
    this.saveSettings();
  }
  
  enableKeyboard() {
    this.keyboardEnabled = true;
    const barcodeInput = document.getElementById('barcode');
    barcodeInput.readOnly = false;
    barcodeInput.classList.remove('readonly');
    barcodeInput.placeholder = "Escanea un código QR o ingresa manualmente";
    barcodeInput.focus();
    this.updateUI();
    this.saveSettings();
  }
  
  enableTemporaryKeyboard() {
    this.enableKeyboard();
    
    // Mostrar mensaje temporal
    this.showTemporaryMessage('Teclado activado temporalmente', 'success');
    
    // Deshabilitar automáticamente después de 30 segundos de inactividad
    clearTimeout(this.disableTimeout);
    this.disableTimeout = setTimeout(() => {
      if (document.activeElement !== barcodeInput) {
        this.disableKeyboard();
        this.showTemporaryMessage('Teclado desactivado automáticamente', 'info');
      }
    }, 30000);
  }
  
  toggleKeyboard() {
    if (this.keyboardEnabled) {
      this.disableKeyboard();
      this.showTemporaryMessage('Teclado desactivado', 'info');
    } else {
      this.enableKeyboard();
      this.showTemporaryMessage('Teclado activado', 'success');
    }
  }
  
  setKeyboardEnabled(enabled) {
    if (enabled) {
      this.enableKeyboard();
    } else {
      this.disableKeyboard();
    }
  }
  
  updateUI() {
    const keyboardBtn = document.getElementById('keyboardToggleBtn');
    const configToggle = document.getElementById('keyboardToggle');
    
    if (this.keyboardEnabled) {
      keyboardBtn.classList.add('active');
      keyboardBtn.title = 'Teclado Activado';
      keyboardBtn.innerHTML = '<i class="fas fa-keyboard"></i>';
      if (configToggle) configToggle.checked = true;
    } else {
      keyboardBtn.classList.remove('active');
      keyboardBtn.title = 'Teclado Desactivado';
      keyboardBtn.innerHTML = '<i class="fas fa-keyboard"></i>';
      if (configToggle) configToggle.checked = false;
    }
  }
  
  showKeyboardMessage() {
    this.showTemporaryMessage(
      'Teclado deshabilitado. Usa el escáner QR o activa el teclado manualmente.', 
      'warning',
      3000
    );
  }
  
  showTemporaryMessage(message, type = 'info', duration = 2000) {
    // Crear elemento de mensaje
    const messageEl = document.createElement('div');
    messageEl.className = `temp-message temp-message-${type}`;
    messageEl.textContent = message;
    messageEl.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: ${type === 'success' ? '#d4edda' : type === 'warning' ? '#fff3cd' : '#d1ecf1'};
      color: ${type === 'success' ? '#155724' : type === 'warning' ? '#856404' : '#0c5460'};
      padding: 15px 20px;
      border-radius: 8px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-weight: 500;
      text-align: center;
      max-width: 80%;
    `;
    
    document.body.appendChild(messageEl);
    
    // Remover después de la duración
    setTimeout(() => {
      if (messageEl.parentNode) {
        messageEl.parentNode.removeChild(messageEl);
      }
    }, duration);
  }
  
  isValidFormat(code) {
    if (!code || code.length < 3) return false;
    
    // Formato más flexible: permite varios formatos comunes
    const formats = [
      /^[A-Za-z0-9]+-[0-9]+$/, // DOCUMENTO-NIT (formato original)
      /^[A-Za-z0-9]+\s+[0-9]+$/, // DOCUMENTO NIT (con espacio)
      /^[0-9]+$/, // Solo números
      /^[A-Za-z0-9]+$/, // Solo letras y números
      /^[A-Za-z0-9]+\-[A-Za-z0-9]+/, // Cualquier formato con guión
    ];
    
    return formats.some(format => format.test(code.trim()));
  }
  
  processBarcode(code) {
    if (!code.trim()) return;
    
    // Vibrar si está habilitado
    if (this.vibrationEnabled && navigator.vibrate) {
      navigator.vibrate(100);
    }
    
    // Limpiar y normalizar el código
    const cleanCode = code.trim().toUpperCase();
    
    // Procesar el código
    if (typeof processQRCode === 'function') {
      const parts = parseQRCode(cleanCode);
      if (parts) {
        currentQRParts = parts;
        processQRCodeParts(parts);
        
        // Limpiar input después del procesamiento exitoso
        setTimeout(() => {
          document.getElementById('barcode').value = '';
        }, 100);
      } else {
        this.showTemporaryMessage('Formato no reconocido. Intenta con: DOCUMENTO-NIT', 'warning', 3000);
      }
    }
    
    // Reproducir sonido si está habilitado
    if (this.soundsEnabled && typeof playSuccessSound === 'function') {
      playSuccessSound();
    }
  }
  
  saveSettings() {
    const settings = {
      keyboardEnabled: this.keyboardEnabled,
      autoSubmit: this.autoSubmit,
      soundsEnabled: this.soundsEnabled,
      vibrationEnabled: this.vibrationEnabled
    };
    
    try {
      localStorage.setItem('pandaDashSettings', JSON.stringify(settings));
    } catch (e) {
      console.error('Error al guardar configuración:', e);
    }
  }
  
  loadSettings() {
    try {
      const saved = localStorage.getItem('pandaDashSettings');
      if (saved) {
        const settings = JSON.parse(saved);
        this.keyboardEnabled = settings.keyboardEnabled || false;
        this.autoSubmit = settings.autoSubmit !== undefined ? settings.autoSubmit : true;
        this.soundsEnabled = settings.soundsEnabled !== undefined ? settings.soundsEnabled : true;
        this.vibrationEnabled = settings.vibrationEnabled || false;
        
        // Aplicar configuración
        this.setKeyboardEnabled(this.keyboardEnabled);
        document.getElementById('autoSubmitToggle').checked = this.autoSubmit;
        document.getElementById('soundToggle').checked = this.soundsEnabled;
        document.getElementById('vibrationToggle').checked = this.vibrationEnabled;
      }
    } catch (e) {
      console.error('Error al cargar configuración:', e);
    }
  }
}

// Inicializar gestor de teclado
let keyboardManager;

function initializeKeyboardManager() {
  keyboardManager = new KeyboardManager();
  return keyboardManager;
}
