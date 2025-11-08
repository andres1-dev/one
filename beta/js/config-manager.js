// Gestión simplificada del teclado y configuración
class ConfigManager {
  constructor() {
    this.keyboardEnabled = false;
    this.soundsEnabled = true;
    this.vibrationEnabled = false;
    
    this.init();
  }
  
  init() {
    this.setupEventListeners();
    this.loadSettings();
    this.applySettings();
  }
  
  setupEventListeners() {
    // Botón de configuración flotante
    document.getElementById('configBtn').addEventListener('click', () => {
      this.toggleConfigPanel();
    });
    
    // Cerrar panel de configuración
    document.getElementById('closeConfig').addEventListener('click', () => {
      this.hideConfigPanel();
    });
    
    // Toggles de configuración
    document.getElementById('keyboardToggle').addEventListener('change', (e) => {
      this.setKeyboardEnabled(e.target.checked);
    });
    
    document.getElementById('soundToggle').addEventListener('change', (e) => {
      this.soundsEnabled = e.target.checked;
      this.saveSettings();
    });
    
    document.getElementById('vibrationToggle').addEventListener('change', (e) => {
      this.vibrationEnabled = e.target.checked;
      this.saveSettings();
    });
    
    // Input de barcode - SIEMPRE captura input físico (lector láser PDA)
    const barcodeInput = document.getElementById('barcode');
    
    // El input siempre está activo para capturar lecturas físicas
    barcodeInput.addEventListener('input', (e) => {
      this.processBarcodeInput(e.target.value);
    });
    
    barcodeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.processBarcodeInput(e.target.value);
      }
    });
    
    // Prevenir focus no deseado (solo teclado virtual)
    barcodeInput.addEventListener('focus', (e) => {
      if (!this.keyboardEnabled) {
        e.target.blur();
      }
    });
    
    // Cerrar panel al hacer clic fuera
    document.getElementById('configPanel').addEventListener('click', (e) => {
      if (e.target.id === 'configPanel') {
        this.hideConfigPanel();
      }
    });
  }
  
  toggleConfigPanel() {
    const panel = document.getElementById('configPanel');
    panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
  }
  
  hideConfigPanel() {
    document.getElementById('configPanel').style.display = 'none';
  }
  
  setKeyboardEnabled(enabled) {
    this.keyboardEnabled = enabled;
    const barcodeInput = document.getElementById('barcode');
    
    if (enabled) {
      barcodeInput.readOnly = false;
      barcodeInput.classList.remove('readonly');
      barcodeInput.placeholder = "Escanea o escribe manualmente";
    } else {
      barcodeInput.readOnly = true;
      barcodeInput.classList.add('readonly');
      barcodeInput.placeholder = "Escanea un código QR";
      barcodeInput.blur();
    }
    
    this.saveSettings();
  }
  
  processBarcodeInput(code) {
    if (!code || code.length < 3) return;
    
    // Vibrar si está habilitado
    if (this.vibrationEnabled && navigator.vibrate) {
      navigator.vibrate(50);
    }
    
    // Procesar el código
    const cleanCode = code.trim().toUpperCase();
    const parts = parseQRCode(cleanCode);
    
    if (parts) {
      currentQRParts = parts;
      processQRCodeParts(parts);
      
      // Limpiar input después del procesamiento exitoso
      setTimeout(() => {
        document.getElementById('barcode').value = '';
      }, 100);
      
      // Sonido de éxito
      if (this.soundsEnabled && typeof playSuccessSound === 'function') {
        playSuccessSound();
      }
    } else {
      // Formato inválido
      if (this.soundsEnabled && typeof playErrorSound === 'function') {
        playErrorSound();
      }
    }
  }
  
  saveSettings() {
    const settings = {
      keyboardEnabled: this.keyboardEnabled,
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
        this.soundsEnabled = settings.soundsEnabled !== undefined ? settings.soundsEnabled : true;
        this.vibrationEnabled = settings.vibrationEnabled || false;
      }
    } catch (e) {
      console.error('Error al cargar configuración:', e);
    }
  }
  
  applySettings() {
    // Aplicar configuración a la UI
    document.getElementById('keyboardToggle').checked = this.keyboardEnabled;
    document.getElementById('soundToggle').checked = this.soundsEnabled;
    document.getElementById('vibrationToggle').checked = this.vibrationEnabled;
    
    // Aplicar estado del teclado
    this.setKeyboardEnabled(this.keyboardEnabled);
  }
}

// Inicializar gestor de configuración
let configManager;

function initializeConfigManager() {
  configManager = new ConfigManager();
  return configManager;
}

// Función global para procesar input de barcode
function processBarcodeInput() {
  const barcodeInput = document.getElementById('barcode');
  const code = barcodeInput.value.trim();
  
  if (code && code.length >= 3) {
    configManager.processBarcodeInput(code);
  }
}
