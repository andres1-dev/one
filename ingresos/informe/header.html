<!-- components/header.html -->
<header class="dashboard-header">
  <h1 class="dashboard-title">
    <i class="fas fa-chart-line"></i> 
    Ingresos de Marca Propia
    <button id="updateReportBtn" class="update-btn-small" title="Actualizar Reporte">
      <i class="fas fa-sync-alt"></i>
    </button>
  </h1>
  
  <div class="date-selector-container">
    <input type="date" id="datePicker" class="date-picker">
    
    <button id="captureBtn" class="capture-btn" title="Enviar informe">
      <i class="fas fa-paper-plane"></i>
    </button>
    
    <!-- Botón adicional para PWA (se muestra solo cuando hay evento beforeinstallprompt) -->
    <div id="installContainer" style="display: none;">
      <button id="installBtn" class="install-btn">
        <i class="fas fa-download"></i> Instalar
      </button>
    </div>
  </div>
  
  <!-- Notificación de conexión -->
  <div id="connectionStatus" class="connection-status">
    <i class="fas fa-wifi"></i>
    <span>Conectado</span>
  </div>
</header>

<style>
  /* Estilos específicos del header */
  .dashboard-header {
    position: relative;
  }
  
  .connection-status {
    position: absolute;
    top: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.2);
    padding: 5px 10px;
    border-radius: 15px;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 5px;
    color: white;
    transition: var(--transition);
  }
  
  .connection-status.offline {
    background: rgba(231, 76, 60, 0.8);
  }
  
  .connection-status.offline i {
    animation: pulse 1.5s infinite;
  }
  
  @keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.3; }
    100% { opacity: 1; }
  }
  
  /* Ajustes para móviles */
  @media (max-width: 768px) {
    .dashboard-title {
      flex-direction: column;
      gap: 10px;
    }
    
    .connection-status {
      position: static;
      margin-top: 10px;
      justify-content: center;
    }
  }
</style>

<script>
  // Script específico del header
  document.addEventListener('DOMContentLoaded', function() {
    // Manejar el estado de conexión
    function updateConnectionStatus() {
      const statusElement = document.getElementById('connectionStatus');
      if (navigator.onLine) {
        statusElement.innerHTML = '<i class="fas fa-wifi"></i><span>Conectado</span>';
        statusElement.classList.remove('offline');
      } else {
        statusElement.innerHTML = '<i class="fas fa-wifi-slash"></i><span>Sin conexión</span>';
        statusElement.classList.add('offline');
      }
    }
    
    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);
    updateConnectionStatus();
    
    // Manejar el botón de instalación PWA
    let deferredPrompt;
    const installContainer = document.getElementById('installContainer');
    const installBtn = document.getElementById('installBtn');
    
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      installContainer.style.display = 'block';
    });
    
    installBtn?.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        installContainer.style.display = 'none';
      }
      deferredPrompt = null;
    });
    
    // Verificar si ya está instalado
    window.addEventListener('appinstalled', () => {
      installContainer.style.display = 'none';
    });
  });
</script>
