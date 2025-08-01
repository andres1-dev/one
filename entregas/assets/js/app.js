// Configuración y constantes
const CONFIG = {
  VERSION: "4.0.0",
  CACHE_TTL: 24 * 60 * 60 * 1000, // 24 horas en milisegundos
  MAX_IMAGE_SIZE: 800, // Tamaño máximo para redimensionar imágenes
  MAX_CHUNK_SIZE: 50000, // ~50KB por solicitud
};

// Variables globales
let database = [];
let currentDocumentData = null;
let currentQRParts = null;
let dataLoaded = false;

// Inicialización al cargar el documento
document.addEventListener('DOMContentLoaded', () => {
  // Cargar datos desde el servidor
  loadDataFromServer();
  
  setupEventListeners();
  
  // Verificar si estamos en modo offline
  window.addEventListener('online', function() {
    document.getElementById('offline-banner').style.display = 'none';
    updateStatus('reconnected', '<i class="fas fa-wifi"></i> CONEXIÓN RESTABLECIDA');
    
    // Si los datos aún no se han cargado, intentar cargarlos de nuevo
    if (!dataLoaded) {
      setTimeout(() => loadDataFromServer(), 1000);
    }
  });
  
  window.addEventListener('offline', function() {
    document.getElementById('offline-banner').style.display = 'block';
    updateStatus('offline', '<i class="fas fa-wifi-slash"></i> MODO OFFLINE ACTIVO');
  });
});

// Funciones principales
function loadDataFromServer() {
  updateStatus('loading', '<i class="fas fa-sync fa-spin"></i> CARGANDO DATOS...');
  document.getElementById('data-stats').innerHTML = '<i class="fas fa-server"></i> Conectando con el servidor...';
  
  fetchData(`${API_URL_GET}?nocache=${new Date().getTime()}`)
    .then(serverData => handleDataLoadSuccess(serverData))
    .catch(error => handleDataLoadError(error));
}

function handleDataLoadSuccess(serverData) {
  if (serverData && serverData.success && serverData.data) {
    database = serverData.data;
    dataLoaded = true;
    cacheData(database);
    
    updateStatus('ready', '<i class="fas fa-check-circle"></i> SISTEMA LISTO');
    document.getElementById('data-stats').innerHTML = `
      <i class="fas fa-database"></i> ${database.length} registros | ${new Date().toLocaleTimeString()}
    `;
    
    showWelcomeScreen();
    hideLoadingScreen();
    playSuccessSound();
  } else {
    handleDataLoadError(new Error('Formato de datos incorrecto'));
  }
}

function handleDataLoadError(error) {
  console.error("Error al cargar datos:", error);
  
  // Verificar si hay datos en caché
  const cachedData = getCachedData();
  if (cachedData) {
    database = cachedData.data;
    dataLoaded = true;
    
    updateStatus('ready', '<i class="fas fa-database"></i> SISTEMA LISTO (DATOS CACHEADOS)');
    document.getElementById('data-stats').innerHTML = `
      ${database.length} registros | Última actualización: ${new Date(cachedData.timestamp).toLocaleString()}
    `;
    
    showWelcomeScreen();
    document.getElementById('offline-banner').style.display = 'block';
    hideLoadingScreen();
  } else {
    updateStatus('error', '<span style="color: var(--danger)">ERROR AL CARGAR DATOS</span>');
    document.getElementById('data-stats').textContent = error.message || 'Error desconocido';
    document.getElementById('results').innerHTML = `
      <div class="error"><i class="fas fa-exclamation-circle"></i> No se pudo cargar la base de datos: ${error.message || 'Error desconocido'}</div>
    `;
    
    // Mostrar mensaje de error en la pantalla de carga
    const loadingName = document.querySelector('#loadingScreen .name');
    if (loadingName) {
      loadingName.innerHTML = 'Error al cargar datos. <br>Comprueba tu conexión.';
      loadingName.style.color = '#f72585';
    }
    
    playErrorSound();
  }
}

// Resto de funciones principales...
