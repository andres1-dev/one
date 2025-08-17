// pwa.js - Manejo de la funcionalidad PWA

// Configuración de la PWA
const PWA_CONFIG = {
  appName: 'Ingresos de Marca Propia',
  shortName: 'Ingresos MP',
  themeColor: '#4361ee',
  backgroundColor: '#ffffff',
  iconPaths: {
    '192': '/one/ingresos/informe/icons/icon-192.png',
    '512': '/one/ingresos/informe/icons/icon-512.png'
  }
};

/**
 * Registra el Service Worker para la PWA
 */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/one/ingresos/informe/sw.js')
        .then(registration => {
          console.log('ServiceWorker registrado con éxito:', registration.scope);
          
          // Verificar actualizaciones periódicamente
          setInterval(() => {
            registration.update().then(() => {
              console.log('Verificación de actualizaciones del Service Worker');
            });
          }, 60 * 60 * 1000); // Cada hora
        })
        .catch(error => {
          console.log('Error al registrar ServiceWorker:', error);
        });
    });
  }
}

/**
 * Maneja el evento beforeinstallprompt para mostrar el botón de instalación
 */
function handleInstallPrompt() {
  let deferredPrompt;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallPromotion();
  });

  // Mostrar el botón de instalación
  function showInstallPromotion() {
    // Contenedor del botón
    const container = document.createElement('div');
    container.id = 'install-container';
    container.style.position = 'fixed';
    container.style.bottom = '20px';
    container.style.right = '20px';
    container.style.zIndex = '1000';
    container.style.animation = 'fadeInUp 0.5s forwards';

    // Botón de instalación
    const installBtn = document.createElement('button');
    installBtn.className = 'install-btn pulse';
    installBtn.innerHTML = `
      <i class="fas fa-download"></i> Instalar App
    `;

    // Estilos del botón
    const style = document.createElement('style');
    style.textContent = `
      .install-btn {
        padding: 12px 24px;
        border-radius: 50px;
        border: none;
        background: linear-gradient(135deg, #4361ee, #3a0ca3);
        color: white;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        font-weight: 600;
        font-size: 14px;
        box-shadow: 0 4px 20px rgba(67, 97, 238, 0.3);
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 10px;
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
      }
      
      .install-btn i {
        font-size: 16px;
      }
      
      .install-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(67, 97, 238, 0.4);
        background: linear-gradient(135deg, #3a56d4, #2f0a8a);
      }
      
      .install-btn:active {
        transform: translateY(0);
        box-shadow: 0 2px 10px rgba(67, 97, 238, 0.3);
      }
      
      .install-btn.hidden {
        display: none;
      }
      
      @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(67, 97, 238, 0.7); }
        70% { box-shadow: 0 0 0 12px rgba(67, 97, 238, 0); }
        100% { box-shadow: 0 0 0 0 rgba(67, 97, 238, 0); }
      }
      
      .install-btn.pulse {
        animation: pulse 2s infinite;
      }
      
      @keyframes fadeInUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      
      @media (max-width: 768px) {
        .install-btn {
          bottom: 20px;
          right: 20px;
          padding: 10px 20px;
          font-size: 13px;
        }
      }
    `;
    
    document.head.appendChild(style);

    // Acción de instalación
    installBtn.addEventListener('click', () => {
      installBtn.disabled = true;
      deferredPrompt.prompt();
      
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('Usuario aceptó la instalación');
          container.remove();
        } else {
          console.log('Usuario rechazó la instalación');
          installBtn.disabled = false;
        }
        deferredPrompt = null;
      });
    });

    container.appendChild(installBtn);
    document.body.appendChild(container);

    // Ocultar después de 30 segundos si no se interactúa
    setTimeout(() => {
      if (deferredPrompt) {
        container.style.animation = 'fadeOut 0.5s forwards';
        setTimeout(() => container.remove(), 500);
      }
    }, 30000);
  }
}

/**
 * Verifica si la app está instalada como PWA
 */
function isRunningAsPWA() {
  return window.matchMedia('(display-mode: standalone)').matches || 
         window.navigator.standalone ||
         document.referrer.includes('android-app://');
}

/**
 * Maneja el evento de conexión/desconexión
 */
function handleConnectionStatus() {
  const connectionStatus = document.createElement('div');
  connectionStatus.id = 'connection-status';
  connectionStatus.style.position = 'fixed';
  connectionStatus.style.bottom = '70px';
  connectionStatus.style.right = '20px';
  connectionStatus.style.padding = '8px 16px';
  connectionStatus.style.borderRadius = '20px';
  connectionStatus.style.backgroundColor = '#2ecc71';
  connectionStatus.style.color = 'white';
  connectionStatus.style.fontSize = '14px';
  connectionStatus.style.zIndex = '1000';
  connectionStatus.style.display = 'none';
  connectionStatus.style.alignItems = 'center';
  connectionStatus.style.gap = '8px';
  document.body.appendChild(connectionStatus);

  function updateConnectionStatus() {
    if (navigator.onLine) {
      connectionStatus.innerHTML = '<i class="fas fa-wifi"></i> En línea';
      connectionStatus.style.backgroundColor = '#2ecc71';
      setTimeout(() => {
        connectionStatus.style.display = 'none';
      }, 3000);
    } else {
      connectionStatus.innerHTML = '<i class="fas fa-wifi-slash"></i> Sin conexión';
      connectionStatus.style.backgroundColor = '#e74c3c';
      connectionStatus.style.display = 'flex';
    }
  }

  window.addEventListener('online', updateConnectionStatus);
  window.addEventListener('offline', updateConnectionStatus);
  updateConnectionStatus();
}

/**
 * Muestra un toast de actualización cuando hay una nueva versión disponible
 */
function handleAppUpdates() {
  let newWorker;

  // Escuchar el evento de actualización del Service Worker
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (newWorker) {
      showUpdateToast();
    }
  });

  function showUpdateToast() {
    const toast = document.createElement('div');
    toast.id = 'update-toast';
    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <i class="fas fa-sync-alt" style="font-size: 18px;"></i>
        <span>¡Nueva versión disponible!</span>
      </div>
      <button id="refresh-btn" style="margin-left: 15px; padding: 5px 10px; border-radius: 4px; border: none; background: rgba(255,255,255,0.2); color: white; cursor: pointer;">
        Actualizar
      </button>
    `;
    
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '20px';
    toast.style.right = '20px';
    toast.style.maxWidth = '400px';
    toast.style.padding = '12px 16px';
    toast.style.backgroundColor = '#4361ee';
    toast.style.color = 'white';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    toast.style.display = 'flex';
    toast.style.justifyContent = 'space-between';
    toast.style.alignItems = 'center';
    toast.style.zIndex = '1000';
    toast.style.animation = 'fadeInUp 0.3s ease-out';
    
    document.body.appendChild(toast);

    document.getElementById('refresh-btn').addEventListener('click', () => {
      window.location.reload();
    });

    // Ocultar después de 30 segundos
    setTimeout(() => {
      toast.style.animation = 'fadeOut 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 30000);
  }
}

/**
 * Inicializa todas las funcionalidades PWA
 */
function initPWA() {
  registerServiceWorker();
  handleInstallPrompt();
  handleConnectionStatus();
  handleAppUpdates();
  
  // Añadir meta tag para theme-color dinámico
  const themeColorMeta = document.createElement('meta');
  themeColorMeta.name = 'theme-color';
  themeColorMeta.content = PWA_CONFIG.themeColor;
  document.head.appendChild(themeColorMeta);
  
  // Mostrar mensaje especial si se ejecuta como PWA
  if (isRunningAsPWA()) {
    console.log('Ejecutando como PWA instalada');
    document.documentElement.setAttribute('data-pwa', 'true');
  }
}

// Exportar funciones para uso en otros módulos
export {
  initPWA,
  isRunningAsPWA,
  PWA_CONFIG
};
