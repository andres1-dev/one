// Bloqueador completo de teclado - Medidas extremas
class KeyboardBlocker {
  constructor() {
    this.isBlocking = true;
    this.init();
  }
  
  init() {
    this.blockAllKeyboardEvents();
    this.blockAllFocusEvents();
    this.blockAllTouchEvents();
    this.disableExistingInputs();
    this.setupMutationObserver();
    this.preventContextMenu();
    this.disableCopyPaste();
    
    console.log('🚫 Teclado completamente bloqueado');
  }
  
  blockAllKeyboardEvents() {
    const events = ['keydown', 'keyup', 'keypress', 'input', 'beforeinput'];
    
    events.forEach(eventType => {
      document.addEventListener(eventType, this.handleKeyboardEvent, {
        capture: true,
        passive: false
      });
    });
  }
  
  handleKeyboardEvent = (e) => {
    if (!this.isBlocking) return;
    
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    // Permitir solo teclas específicas si es necesario (como ESC para emergencias)
    const allowedKeys = ['Escape', 'Tab'];
    if (!allowedKeys.includes(e.key)) {
      return false;
    }
  }
  
  blockAllFocusEvents() {
    document.addEventListener('focusin', this.handleFocus, {
      capture: true,
      passive: false
    });
    
    document.addEventListener('focus', this.handleFocus, {
      capture: true,
      passive: false
    });
    
    document.addEventListener('click', this.handleFocus, {
      capture: true,
      passive: false
    });
  }
  
  handleFocus = (e) => {
    if (!this.isBlocking) return;
    
    const target = e.target;
    if (this.isInputElement(target)) {
      e.preventDefault();
      e.stopPropagation();
      
      // Blur inmediato y múltiple
      target.blur();
      setTimeout(() => target.blur(), 0);
      setTimeout(() => target.blur(), 50);
      
      return false;
    }
  }
  
  blockAllTouchEvents() {
    const events = ['touchstart', 'touchend', 'touchmove', 'touchcancel'];
    
    events.forEach(eventType => {
      document.addEventListener(eventType, this.handleTouch, {
        capture: true,
        passive: false
      });
    });
  }
  
  handleTouch = (e) => {
    if (!this.isBlocking) return;
    
    const target = e.target;
    if (this.isInputElement(target)) {
      e.preventDefault();
      e.stopPropagation();
      
      target.blur();
      setTimeout(() => target.blur(), 0);
      
      return false;
    }
  }
  
  isInputElement(element) {
    if (!element || !element.tagName) return false;
    
    const inputTags = ['INPUT', 'TEXTAREA', 'SELECT'];
    const inputTypes = ['text', 'password', 'email', 'number', 'tel', 'url', 'search'];
    
    if (inputTags.includes(element.tagName)) {
      if (element.tagName === 'INPUT' && inputTypes.includes(element.type)) {
        return true;
      }
      return element.tagName !== 'INPUT';
    }
    
    return element.isContentEditable;
  }
  
  disableExistingInputs() {
    const inputs = document.querySelectorAll('input, textarea, [contenteditable="true"]');
    
    inputs.forEach(input => {
      this.disableElement(input);
    });
  }
  
  disableElement(element) {
    // Atributos HTML
    element.setAttribute('readonly', 'true');
    element.setAttribute('disabled', 'true');
    element.setAttribute('inputmode', 'none');
    element.setAttribute('autocomplete', 'off');
    element.setAttribute('autocorrect', 'off');
    element.setAttribute('autocapitalize', 'off');
    element.setAttribute('spellcheck', 'false');
    
    // Estilos CSS
    element.style.caretColor = 'transparent';
    element.style.color = 'transparent';
    element.style.textShadow = 'none';
    element.style.backgroundColor = 'transparent';
    element.style.border = 'none';
    element.style.outline = 'none';
    element.style.userSelect = 'none';
    element.style.webkitUserSelect = 'none';
    element.style.mozUserSelect = 'none';
    element.style.msUserSelect = 'none';
    element.style.webkitTapHighlightColor = 'transparent';
    
    // Event listeners adicionales
    const events = ['focus', 'click', 'touchstart', 'mousedown'];
    events.forEach(eventType => {
      element.addEventListener(eventType, this.forceBlur, {
        capture: true,
        passive: false
      });
    });
  }
  
  forceBlur = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.target.blur();
    
    // Blur múltiple para asegurar
    setTimeout(() => e.target.blur(), 0);
    setTimeout(() => e.target.blur(), 100);
    
    return false;
  }
  
  setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            if (this.isInputElement(node)) {
              this.disableElement(node);
            }
            
            const inputs = node.querySelectorAll && node.querySelectorAll('input, textarea, [contenteditable="true"]');
            if (inputs) {
              inputs.forEach(input => this.disableElement(input));
            }
          }
        });
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  preventContextMenu() {
    document.addEventListener('contextmenu', (e) => {
      if (this.isInputElement(e.target)) {
        e.preventDefault();
        return false;
      }
    });
  }
  
  disableCopyPaste() {
    const events = ['copy', 'cut', 'paste'];
    
    events.forEach(eventType => {
      document.addEventListener(eventType, (e) => {
        if (this.isInputElement(e.target)) {
          e.preventDefault();
          return false;
        }
      }, { capture: true });
    });
  }
  
  // Método para desbloquear temporalmente si es necesario
  temporaryUnlock(duration = 1000) {
    this.isBlocking = false;
    setTimeout(() => {
      this.isBlocking = true;
    }, duration);
  }
}

// Inicializar el bloqueador inmediatamente
let keyboardBlocker;

function initializeKeyboardBlocker() {
  keyboardBlocker = new KeyboardBlocker();
  return keyboardBlocker;
}
