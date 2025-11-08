// Variables globales 1
let database = [];
let currentQRParts = null;
let dataLoaded = false;

// Elementos del DOM
const loadingScreen = document.getElementById('loadingScreen');
const scanner = document.getElementById('scanner');
const barcodeInput = document.getElementById('barcode');
const statusDiv = document.getElementById('status');
const resultsDiv = document.getElementById('results');
const dataStats = document.getElementById('data-stats');
const offlineBanner = document.getElementById('offline-banner');
const installBtn = document.getElementById('installBtn');

// Función para procesar entregas
function procesarEntrega(documento, lote, referencia, cantidad, factura, nit, btnElement) {
  // Verificar si la entrega no tiene factura y manejarlo apropiadamente
  const esSinFactura = !factura || factura.trim() === "";
  
  // Guardar todos los datos específicos de la factura
  currentDocumentData = {
    documento: documento,
    lote: lote || '',
    referencia: referencia || '',
    cantidad: parseFloat(cantidad) || 0,
    factura: factura || '', // Mantener factura como está, vacía si no hay factura
    nit: nit || '',
    btnElement: btnElement,
    esSinFactura: esSinFactura // Marcamos si es sin factura para tratamiento especial después
  };
  
  // Crear un input de tipo file temporal para capturar fotos
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.capture = 'environment'; // Usar cámara trasera por defecto
  
  // Agregar evento para procesar la imagen cuando se capture
  fileInput.addEventListener('change', function(e) {
    if (e.target.files && e.target.files[0]) {
      procesarImagenCapturada(e.target.files[0]);
    }
  });
  
  // Simular clic para abrir la cámara del dispositivo
  fileInput.click();
}

// Nueva función para procesar la imagen capturada
function procesarImagenCapturada(archivo) {
  if (!archivo) {
    console.error("No se seleccionó ninguna imagen");
    return;
  }
  
  // Mostrar estado de carga
  const statusDiv = document.getElementById('status');
  statusDiv.innerHTML = '<i class="fas fa-image"></i> Procesando imagen...';
  
  const lector = new FileReader();
  lector.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      // Crear canvas para procesamiento
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Establecer dimensiones manteniendo proporciones pero limitando tamaño
      let width = img.width;
      let height = img.height;
      
      // Redimensionar si la imagen es muy grande (para optimizar)
      const maxDimension = CONFIG.MAX_IMAGE_SIZE || 1200;
      if (width > height && width > maxDimension) {
        height = (height / width) * maxDimension;
        width = maxDimension;
      } else if (height > width && height > maxDimension) {
        width = (width / height) * maxDimension;
        height = maxDimension;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Dibujar imagen en el canvas
      ctx.drawImage(img, 0, 0, width, height);
      
      // Aplicar marca de agua
      aplicarMarcaDeAgua(ctx, width, height);
      
      // Convertir a Blob
      canvas.toBlob(function(blob) {
        photoBlob = blob;
        
        // Subir la imagen procesada a la cola
        subirFotoCapturada(blob);
      }, 'image/jpeg', 0.85);
    };
    img.src = e.target.result;
  };
  lector.readAsDataURL(archivo);
}

// Función para aplicar marca de agua
function aplicarMarcaDeAgua(ctx, width, height) {
  // Área para la marca de agua
  const marcaHeight = Math.floor(height / 6);

  // Fondo degradado
  const gradient = ctx.createLinearGradient(0, height - marcaHeight, 0, height);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(0.2, "rgba(0, 0, 0, 0.6)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0.8)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, height - marcaHeight, width, marcaHeight);

  // Fuente y estilo
  const fontFamily = "Inter, sans-serif";
  const fontSize = Math.max(10, Math.floor(width / 70)); // Tamaño base
  const fontSizeTitle = fontSize * 2; // Título al doble
  ctx.fillStyle = "white";
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";

  // Márgenes y espaciado
  const marginLeft = Math.floor(width / 20);
  const lineSpacing = Math.floor(fontSize * 1.6);
  let posY = height - Math.floor(marcaHeight * 0.2);

  // 1. Fecha y hora
  ctx.font = `500 ${fontSize}px ${fontFamily}`;
  const fecha = new Date().toLocaleString();
  ctx.fillText(fecha, marginLeft, posY);
  posY -= lineSpacing;

  // 2. Datos técnicos (FACTURA | LOTE | REF | CANT)
  const datos = [];
  if (currentDocumentData) {
    if (currentDocumentData.factura) datos.push(currentDocumentData.factura);
    if (currentDocumentData.lote) datos.push(currentDocumentData.lote);
    if (currentDocumentData.referencia) datos.push(currentDocumentData.referencia);
    if (currentDocumentData.cantidad) datos.push(currentDocumentData.cantidad);
  }

  if (datos.length > 0) {
    ctx.fillText(datos.join(" | "), marginLeft, posY);
    posY -= lineSpacing;
  }

  // 3. Título: PandaDash (más grande)
  ctx.font = `700 ${fontSizeTitle}px ${fontFamily}`;
  ctx.fillText("PandaDash", marginLeft, posY);
}

// Función para subir la foto capturada
async function subirFotoCapturada(blob) {
  if (!currentDocumentData || !blob) {
    console.error("No hay datos disponibles para subir");
    statusDiv.innerHTML = '<span style="color: var(--danger)">Error: No hay datos para subir</span>';
    return;
  }
  
  const { documento, lote, referencia, cantidad, factura, nit, btnElement, esSinFactura } = currentDocumentData;
  
  try {
    // Convertir blob a base64
    const base64Data = await blobToBase64(blob);
    const nombreArchivo = `${factura}_${Date.now()}.jpg`.replace(/[^a-zA-Z0-9\-]/g, '');
    
    // Crear objeto de trabajo para la cola
    const jobData = {
      documento: documento,
      lote: lote,
      referencia: referencia,
      cantidad: cantidad,
      factura: factura,
      nit: nit,
      fotoBase64: base64Data,
      fotoNombre: nombreArchivo,
      fotoTipo: 'image/jpeg',
      timestamp: new Date().toISOString(),
      esSinFactura: esSinFactura // Pasar esta propiedad a la cola
    };
    
    // Agregar a la cola
    uploadQueue.addJob({
      type: 'photo',
      data: jobData,
      factura: factura,
      btnElementId: btnElement ? btnElement.getAttribute('data-factura') : null,
      esSinFactura: esSinFactura
    });
    
    // Actualizar botón de entrega si existe
    if (btnElement) {
      btnElement.innerHTML = '<i class="fas fa-hourglass-half"></i> PROCESANDO...';
      btnElement.style.backgroundColor = '#4cc9f0';
      
      // Si es sin factura, actualizamos el botón inmediatamente después de añadirlo a la cola
      if (esSinFactura) {
        setTimeout(() => {
          btnElement.innerHTML = '<i class="fas fa-check-circle"></i> ENTREGA CONFIRMADA';
          btnElement.style.backgroundColor = '#28a745';
          btnElement.disabled = true;
          
          // Actualizar estado global
          actualizarEstado('processed', '<i class="fas fa-check-circle"></i> ENTREGA SIN FACTURA CONFIRMADA');
        }, 2000);
      }
    }
    
    // Reproducir sonido de éxito
    playSuccessSound();
    
  } catch (error) {
    console.error("Error al preparar foto:", error);
    statusDiv.innerHTML = '<span style="color: var(--danger)">Error al procesar la imagen</span>';
    
    // Reproducir sonido de error
    playErrorSound();
  }
}

// Funciones para sonidos de feedback
function playSuccessSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)(); 
    const osc = ctx.createOscillator(); 
    const gainNode = ctx.createGain(); 
    osc.type = "sine"; 
    osc.frequency.value = 800; 
    gainNode.gain.value = 1; 
    osc.connect(gainNode); 
    gainNode.connect(ctx.destination); 
    osc.start(); 
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) {
    console.log("Error al reproducir sonido de éxito:", e);
  }
}

function playErrorSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)(); 
    const osc = ctx.createOscillator(); 
    const gainNode = ctx.createGain(); 
    osc.type = "sawtooth"; 
    osc.frequency.setValueAtTime(300, ctx.currentTime); 
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.5); 
    gainNode.gain.value = 0.8; 
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5); 
    osc.connect(gainNode); 
    gainNode.connect(ctx.destination); 
    osc.start(); 
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    console.log("Error al reproducir sonido de error:", e);
  }
}

// Inicialización al cargar el documento
document.addEventListener('DOMContentLoaded', () => {
  // Cargar datos desde el servidor
  loadDataFromServer();
  
  setupEventListeners();
  
  // Agregar eventos para prevenir el teclado virtual en la cámara
  document.addEventListener('focusin', function(e) {
    if (document.getElementById('cameraModal').style.display === 'flex' && 
        e.target.id !== 'dummyInput') {
      e.preventDefault();
      e.target.blur();
    }
  });
  
  // Manejar el cambio de orientación en dispositivos móviles
  window.addEventListener('orientationchange', function() {
    if (document.getElementById('cameraModal').style.display === 'flex') {
      setTimeout(() => {
        document.activeElement.blur();
      }, 300);
    }
  });
  
  // Verificar si estamos en modo offline
  window.addEventListener('online', function() {
    offlineBanner.style.display = 'none';
    statusDiv.className = 'reconnected';
    statusDiv.innerHTML = '<i class="fas fa-wifi"></i> CONEXIÓN RESTABLECIDA';
    // Si los datos aún no se han cargado, intentar cargarlos de nuevo
    if (!dataLoaded) {
      setTimeout(() => loadDataFromServer(), 1000);
    }
  });
  
  window.addEventListener('offline', function() {
    offlineBanner.style.display = 'block';
    statusDiv.className = 'offline';
    statusDiv.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; gap: 10px; text-align: center;">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-wifi-off" viewBox="0 0 16 16">
          <path d="M10.706 3.294A12.6 12.6 0 0 0 8 3C5.259 3 2.723 3.882.663 5.379a.485.485 0 0 0-.048.736.52.52 0 0 0 .668.05A11.45 11.45 0 0 1 8 4q.946 0 1.852.148zM8 6c-1.905 0-3.68.56-5.166 1.526a.48.48 0 0 0-.063.745.525.525 0 0 0 .652.065 8.45 8.45 0 0 1 3.51-1.27zm2.596 1.404.785-.785q.947.362 1.785.907a.482.482 0 0 1 .063.745.525.525 0 0 1-.652.065 8.5 8.5 0 0 0-1.98-.932zM8 10l.933-.933a6.5 6.5 0 0 1 2.013.637c.285.145.326.524.1.75l-.015.015a.53.53 0 0 1-.611.09A5.5 5.5 0 0 0 8 10m4.905-4.905.747-.747q.886.451 1.685 1.03a.485.485 0 0 1 .047.737.52.52 0 0 1-.668.05 11.5 11.5 0 0 0-1.811-1.07M9.02 11.78c.238.14.236.464.04.66l-.707.706a.5.5 0 0 1-.707 0l-.707-.707c-.195-.195-.197-.518.04-.66A2 2 0 0 1 8 11.5c.374 0 .723.102 1.021.28zm4.355-9.905a.53.53 0 0 1 .75.75l-10.75 10.75a.53.53 0 0 1-.75-.75z"/>
        </svg>
        <span>MODO OFFLINE ACTIVO</span>
      </div>
    `;
  });
});

// FUNCIÓN CORREGIDA - usa sheetsDataService en lugar de dataService
function loadDataFromServer() {
    statusDiv.className = 'loading';
    statusDiv.innerHTML = '<i class="fas fa-sync fa-spin"></i> CARGANDO DATOS...';
    dataStats.innerHTML = '<i class="fas fa-server"></i> Conectando con Sheets API...';

    sheetsDataService.getData()
        .then(serverData => handleDataLoadSuccess(serverData))
        .catch(error => handleDataLoadError(error));
}

function handleDataLoadSuccess(serverData) {
  if (serverData && serverData.success && serverData.data) {
    database = serverData.data;
    dataLoaded = true;
    cacheData(database);
    
    // Actualizar UI de estado
    statusDiv.className = 'ready';
    statusDiv.innerHTML = `
      <i class="fas fa-check-circle"></i> SISTEMA LISTO
    `;
    dataStats.innerHTML = `
      <i class="fas fa-database"></i> ${database.length} registros | ${new Date().toLocaleTimeString()}
    `;
    
    // Mostrar contenido principal
    resultsDiv.innerHTML = `
      <div class="result-item" style="text-align: center; color: var(--gray);">
        <div style="text-align: center;">
          <i class="fas fa-qrcode fa-4x logo" aria-label="PandaDash QR Icon"></i>
        </div>
        <h1 style="margin: 0;">PandaDash</h1>
        <div style="margin-top: 6px; font-size: 13px; line-height: 1.3;">
          <p style="margin: 2px 0;">Developed by Andrés Mendoza © 2025</p>
          <p style="margin: 2px 0;">
            Supported by 
            <a href="https://www.eltemplodelamoda.com/" target="_blank" style="color: var(--primary); text-decoration: none; font-weight: 500;">
              GrupoTDM
            </a>
          </p>
          <div style="display: flex; justify-content: center; gap: 8px; margin-top: 6px;">
            <a href="https://www.facebook.com/templodelamoda/" target="_blank" style="color: var(--primary);"><i class="fab fa-facebook"></i></a>
            <a href="https://www.instagram.com/eltemplodelamoda/" target="_blank" style="color: var(--primary);"><i class="fab fa-instagram"></i></a>
            <a href="https://wa.me/573176418529" target="_blank" style="color: var(--primary);"><i class="fab fa-whatsapp"></i></a>
          </div>
        </div>
      </div>
    `;
    
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
    
    statusDiv.innerHTML = '<i class="fas fa-database"></i> SISTEMA LISTO (DATOS CACHEADOS)';
    dataStats.innerHTML = `${database.length} registros | Última actualización: ${new Date(cachedData.timestamp).toLocaleString()}`;
    
    resultsDiv.innerHTML = `
      <div class="result-item" style="text-align: center; color: var(--gray);">
        <div style="text-align: center;">
          <i class="fas fa-qrcode fa-4x logo" aria-label="PandaDash QR Icon"></i>
        </div>
        <h1 style="margin: 0;">PandaDash</h1>
        <div style="margin-top: 6px; font-size: 13px; line-height: 1.3;">
          <p style="margin: 2px 0;">Developed by Andrés Mendoza © 2025</p>
          <p style="margin: 2px 0;">
            Supported by 
            <a href="https://www.eltemplodelamoda.com/" target="_blank" style="color: var(--primary); text-decoration: none; font-weight: 500;">
              GrupoTDM
            </a>
          </p>
          <div style="display: flex; justify-content: center; gap: 8px; margin-top: 6px;">
            <a href="https://www.facebook.com/templodelamoda/" target="_blank" style="color: var(--primary);"><i class="fab fa-facebook"></i></a>
            <a href="https://www.instagram.com/eltemplodelamoda/" target="_blank" style="color: var(--primary);"><i class="fab fa-instagram"></i></a>
            <a href="https://wa.me/573176418529" target="_blank" style="color: var(--primary);"><i class="fab fa-whatsapp"></i></a>
          </div>
        </div>
      </div>
    `;
    
    offlineBanner.style.display = 'block';
    
    // Ocultar pantalla de carga ya que tenemos datos en caché
    hideLoadingScreen();
  } else {
    statusDiv.className = 'error';
    statusDiv.innerHTML = '<span style="color: var(--danger)">ERROR AL CARGAR DATOS</span>';
    dataStats.textContent = error.message || 'Error desconocido';
    resultsDiv.innerHTML = `<div class="error"><i class="fas fa-exclamation-circle"></i> No se pudo cargar la base de datos: ${error.message || 'Error desconocido'}</div>`;
    
    // Mostrar mensaje de error en la pantalla de carga pero no ocultarla
    const loadingName = document.querySelector('#loadingScreen .name');
    if (loadingName) {
      loadingName.innerHTML = 'Error al cargar datos. <br>Comprueba tu conexión.';
      loadingName.style.color = '#f72585';
    }
    
    playErrorSound();
  }
}

// Función para ocultar la pantalla de carga
function hideLoadingScreen() {
  // Mostrar el contenido principal
  scanner.style.display = 'flex';
  
  // Desvanecer la pantalla de carga
  loadingScreen.style.opacity = '0';
  
  // Eliminar la pantalla de carga después de la transición
  setTimeout(() => {
    loadingScreen.style.display = 'none';
    
    // Enfocar el campo de entrada
    if (barcodeInput) {
      barcodeInput.focus();
    }
  }, 500);
}

function getCachedData() {
  const cache = localStorage.getItem('pdaScannerCache');
  if (!cache) return null;
  
  try {
    const parsed = JSON.parse(cache);
    if (Date.now() - parsed.timestamp > CONFIG.CACHE_TTL) return null;
    return parsed;
  } catch (e) {
    console.error("Error al parsear cache:", e);
    return null;
  }
}

function cacheData(data) {
  const cache = {
    data: data,
    timestamp: Date.now(),
    version: CONFIG.VERSION
  };
  
  try {
    localStorage.setItem('pdaScannerCache', JSON.stringify(cache));
  } catch (e) {
    console.error("Error al guardar en cache:", e);
    if (e.name === 'QuotaExceededError') {
      clearOldCache();
      cacheData(data);
    }
  }
}

function clearOldCache() {
  const keys = Object.keys(localStorage);
  for (const key of keys) {
    if (key.startsWith('pdaScannerCache')) {
      localStorage.removeItem(key);
    }
  }
}

function setupEventListeners() {
  // Foco persistente excepto cuando la cámara está abierta
  function enforceFocus() {
    // Solo aplicar foco si la cámara no está abierta
    if (document.activeElement !== barcodeInput && 
        document.getElementById('cameraModal').style.display !== 'flex') {
      barcodeInput.focus();
    }
    setTimeout(enforceFocus, 100);
  }
  enforceFocus();
  
  // Detector para deshabilitar el teclado virtual en dispositivos móviles
  document.addEventListener('touchstart', function(e) {
    if (document.getElementById('cameraModal').style.display === 'flex' && 
        e.target.tagName !== 'BUTTON') {
      e.preventDefault();
      if (document.activeElement) {
        document.activeElement.blur();
      }
    }
  }, { passive: false });
  
  // Detectar escaneo
  barcodeInput.addEventListener('input', function() {
    const code = this.value.trim();
    if (code.length < 5) return; // Un código válido debe tener al menos 5 caracteres
    
    // Analizar el formato del código: DOCUMENTO-NIT
    const parts = parseQRCode(code);
    
    if (parts) {
      currentQRParts = parts; // Guardar las partes para uso posterior
      const startTime = Date.now();
      processQRCodeParts(parts);
      const searchTime = Date.now() - startTime;
      
      statusDiv.className = 'processed';
      statusDiv.textContent = `REGISTRO PROCESADO (${searchTime}ms)`;
    } else {
      showError(code, "Formato de código QR no válido. Use formato: DOCUMENTO-NIT");
      playErrorSound();
      statusDiv.textContent = `FORMATO INVÁLIDO`;
    }
    
    setTimeout(() => {
      this.value = '';
      this.focus();
    }, 50);
  });
}

// Función para analizar el código QR
function parseQRCode(code) {
  // Buscamos un formato como "REC58101-805027653"
  const regex = /^([A-Za-z0-9-]+)-([0-9]+)$/;
  const match = code.match(regex);
  
  if (match) {
    return {
      documento: match[1],
      nit: match[2]
    };
  }
  
  return null;
}

// Procesa las partes del código QR y muestra los resultados
function processQRCodeParts(parts) {
  const { documento, nit } = parts;
  
  // Buscar un registro que coincida con el documento
  const result = database.find(item => 
    item.documento && item.documento.toString() === documento
  );
  
  if (result) {
    // Filtramos los datosSiesa para mostrar solo los que coinciden con el NIT
    const filteredItem = JSON.parse(JSON.stringify(result));
    
    if (filteredItem.datosSiesa && Array.isArray(filteredItem.datosSiesa)) {
      // Filtramos por NIT en lugar de por cliente
      filteredItem.datosSiesa = filteredItem.datosSiesa.filter(siesa => {
        // Extraemos solo dígitos del NIT para comparar (por si acaso viene con formato)
        const siesaNitDigits = siesa.nit ? siesa.nit.toString().replace(/\D/g, '') : '';
        const scanNitDigits = nit.replace(/\D/g, '');
        
        return siesaNitDigits.includes(scanNitDigits) || scanNitDigits.includes(siesaNitDigits);
      });
      
      displayFullResult(filteredItem, parts);
      playSuccessSound();
    } else {
      displayFullResult(filteredItem, parts);
      playSuccessSound();
    }
  } else {
    showError(`${documento}-${nit}`, "Documento no encontrado en la base de datos");
    playErrorSound();
  }
}

function displayFullResult(item, qrParts) {
  const totalRegistros = item.datosSiesa ? item.datosSiesa.length : 0;
  const filtradosRegistros = item.datosSiesa ? item.datosSiesa.length : 0;
  
  resultsDiv.innerHTML = `
    <div class="result-item">
      ${filtradosRegistros < totalRegistros ? `
        <div class="filter-info">
          <i class="fas fa-info-circle"></i> Mostrando ${filtradosRegistros} de ${totalRegistros} registros (filtrado por NIT ${qrParts.nit})
        </div>
      ` : ''}
      
      ${displayItemData(item, 'Datos del Documento', qrParts)}
    </div>
  `;
}

function displayItemData(data, title = 'Datos', qrParts) {
  let html = `<div class="siesa-header">${title} <span class="timestamp">${new Date().toLocaleString()}</span></div>`;
  
  // Asegurar que se muestra el lote en primer lugar, seguido de otras propiedades
  // Orden de propiedades: documento, lote, referencia, y luego el resto
  const ordenPropiedades = ['documento', 'lote', 'referencia'];
  
  // Mostrar primero las propiedades prioritarias en el orden deseado
  ordenPropiedades.forEach(propKey => {
    if (propKey in data && propKey !== 'datosSiesa') {
      html += `
        <div class="result-row">
          <div class="col-header">${formatKey(propKey)}:</div>
          <div class="json-value">${formatValue(data[propKey], propKey)}</div>
        </div>
      `;
    }
  });
  
  // Mostrar el resto de propiedades que no están en la lista de prioridad
  for (const key in data) {
    if (key === 'datosSiesa' || ordenPropiedades.includes(key)) continue;
    
    html += `
      <div class="result-row">
        <div class="col-header">${formatKey(key)}:</div>
        <div class="json-value">${formatValue(data[key], key)}</div>
      </div>
    `;
  }
  
  // Mostrar datosSiesa si existen
  if (data.datosSiesa && Array.isArray(data.datosSiesa)) {
    if (data.datosSiesa.length === 0) {
      html += `<div class="no-data" style="padding: 15px; text-align: center;"><i class="fas fa-search"></i> No hay registros que coincidan con el NIT escaneado</div>`;
    } else {
      html += `<div class="siesa-header">Documentos Relacionados <span class="badge badge-success">${data.datosSiesa.length} registros</span></div>`;
      
      data.datosSiesa.forEach((siesa, index) => {
        const estadoBadge = siesa.estado === 'Aprobadas' ? 'badge-success' : 'badge-warning';
        
        html += `<div class="siesa-item">`;
        html += `<div class="siesa-header">Factura #${index + 1} <span class="badge ${estadoBadge}">${siesa.estado || 'Sin estado'}</span></div>`;
        
        // Orden preferido para propiedades de datosSiesa
        const ordenSiesaPropiedades = ['factura', 'nit', 'lote', 'referencia', 'cantidad', 'estado', 'cliente', 'valorBruto', 'fecha', 'proovedor'];
        
        // Mostrar propiedades en el orden preferido
        ordenSiesaPropiedades.forEach(propKey => {
          if (propKey in siesa) {
            html += `
              <div class="result-row">
                <div class="col-header">${formatKey(propKey)}:</div>
                <div class="json-value">${formatValue(siesa[propKey], propKey)}</div>
              </div>
            `;
          }
        });
        
        // Mostrar cualquier propiedad adicional que no esté en la lista ordenada
        for (const key in siesa) {
          if (ordenSiesaPropiedades.includes(key)) continue;
          
          html += `
            <div class="result-row">
              <div class="col-header">${formatKey(key)}:</div>
              <div class="json-value">${formatValue(siesa[key], key)}</div>
            </div>
          `;
        }
        
        // Verifica el estado de confirmación
        if (siesa.confirmacion && siesa.confirmacion.trim() === "ENTREGADO") { 
          // Si ya está entregado, mostrar mensaje sin botón
          html += `
            <div class="action-buttons">
              <div style="background-color: #28a745; color: white; text-align: center; padding: 12px 20px; border-radius: 8px; font-weight: 500; height: 48px; display: inline-flex; align-items: center; justify-content: center; gap: 8px;">
                <i class="fas fa-check-circle"></i> ENTREGA CONFIRMADA
              </div>
            </div>
          `;
        } else if (siesa.confirmacion && siesa.confirmacion.includes("PENDIENTE FACTURA")) {
          // Caso pendiente factura - verificar si tiene número de factura
          const tieneFactura = siesa.factura && siesa.factura.trim() !== "";
          
          if (tieneFactura) {
            // Si tiene factura, mostrar botón para asentar
            html += `
              <div class="action-buttons">
                <button class="delivery-btn" 
                  data-factura="${siesa.factura}"
                  style="background-color: #f8961e; height: 48px; padding: 12px 20px; border-radius: 8px; font-weight: 500; display: inline-flex; align-items: center; justify-content: center; gap: 8px;"
                  onclick="asentarFactura(
                    '${data.documento}', 
                    '${siesa.lote || data.lote}', 
                    '${siesa.referencia}', 
                    '${siesa.cantidad}', 
                    '${siesa.factura}', 
                    '${siesa.nit || qrParts.nit}', 
                    this
                  )">
                  <i class="fas fa-file-invoice"></i> ASENTAR FACTURA
                </button>
              </div>
            `;
          } else {
            // Si no tiene factura, mostrar solo mensaje (no botón)
            html += `
              <div class="action-buttons">
                <div style="background-color: #6c757d; color: white; text-align: center; padding: 12px 20px; border-radius: 8px; font-weight: 500; height: 48px; display: inline-flex; align-items: center; justify-content: center; gap: 8px;">
                  <i class="fas fa-clock"></i> PENDIENTE FACTURA
                </div>
              </div>
            `;
          }
        } else {
          // Caso normal - confirmar entrega
          html += `
            <div class="action-buttons">
              <button class="delivery-btn" 
                data-factura="${siesa.factura}"
                style="height: 48px; padding: 12px 20px; border-radius: 8px; font-weight: 500; display: inline-flex; align-items: center; justify-content: center; gap: 8px;"
                onclick="procesarEntrega(
                  '${data.documento}', 
                  '${siesa.lote || data.lote}', 
                  '${siesa.referencia}', 
                  '${siesa.cantidad}', 
                  '${siesa.factura}', 
                  '${siesa.nit || qrParts.nit}', 
                  this
                )">
                <i class="fas fa-truck"></i> CONFIRMAR ENTREGA
              </button>
            </div>
          `;
        }
        
        html += `</div>`;
      });
    }
  }
  
  return html;
}

function formatKey(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .replace('columna', '')
    .trim();
}

function formatValue(value, key = '') {
  if (value === null || value === undefined) {
    return '<span class="no-data">N/A</span>';
  }
  
  if (typeof value === 'object') {
    return '<span class="no-data">[Datos complejos]</span>';
  }
  
  if (typeof value === 'number') {
    if (key.toLowerCase().includes('valor') || key.toLowerCase().includes('suma')) {
      return `<span class="numeric-value">${value.toLocaleString('es-CO')}</span>`;
    }
    return value.toString();
  }
  
  if (typeof value === 'boolean') {
    return value ? 'Sí' : 'No';
  }
  
  return value.toString();
}

function showError(barcode, message = "Código no encontrado") {
  resultsDiv.innerHTML = `
    <div class="error">
      <i class="fas fa-times-circle"></i> ${message}: <strong>${barcode}</strong>
    </div>
  `;
}

// Función para asentar facturas
function asentarFactura(documento, lote, referencia, cantidad, factura, nit, btnElement) {
  // Validar datos requeridos
  if (!documento || !lote || !referencia || !cantidad || !factura || !nit) {
    mostrarError("Faltan datos obligatorios para asentar la factura");
    return;
  }
  
  // Mostrar estado de carga en el botón
  if (btnElement) {
    btnElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ASENTANDO...';
    btnElement.style.backgroundColor = '#4cc9f0';
    btnElement.disabled = true;
  }
  
  // Actualizar el estado general
  actualizarEstado('loading', '<i class="fas fa-sync fa-spin"></i> ASENTANDO FACTURA...');
  
  // Crear un FormData para enviar los parámetros
  const formData = new FormData();
  formData.append('documento', documento);
  formData.append('lote', lote);
  formData.append('referencia', referencia);
  formData.append('cantidad', cantidad);
  formData.append('factura', factura);
  formData.append('nit', nit);
  
  // Enviar solicitud al servidor
  fetch(API_URL_ASENTAR_FACTURA, {
    method: 'POST',
    body: formData
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    // Verificar el resultado
    if (data.success) {
      // Operación exitosa
      if (btnElement) {
        btnElement.innerHTML = '<i class="fas fa-check-circle"></i> FACTURA ASENTADA';
        btnElement.style.backgroundColor = '#28a745';
        btnElement.disabled = true;
      }
      
      // Actualizar estado
      actualizarEstado('processed', '<i class="fas fa-check-circle"></i> FACTURA ASENTADA CORRECTAMENTE');
      
      // Reproducir sonido de éxito
      playSuccessSound();
    } else {
      // Operación fallida pero respuesta recibida
      if (btnElement) {
        btnElement.innerHTML = '<i class="fas fa-exclamation-triangle"></i> NO ENCONTRADO';
        btnElement.style.backgroundColor = '#f8961e';
        btnElement.disabled = false;
      }
      
      // Actualizar estado
      actualizarEstado('warning', '<i class="fas fa-exclamation-triangle"></i> NO SE PUDO ASENTAR LA FACTURA');
      
      // Reproducir sonido de error
      playErrorSound();
    }
  })
  .catch(error => {
    console.error("Error al asentar factura:", error);
    
    // Actualizar UI en caso de error
    if (btnElement) {
      btnElement.innerHTML = '<i class="fas fa-exclamation-circle"></i> ERROR';
      btnElement.style.backgroundColor = '#f72585';
      btnElement.disabled = false;
    }
    
    // Actualizar estado
    actualizarEstado('error', `<i class="fas fa-exclamation-circle"></i> ERROR: ${error.message}`);
    
    // Reproducir sonido de error
    playErrorSound();
  });
}

/**
 * Actualiza el estado general de la aplicación
 */
function actualizarEstado(className, html) {
  if (!statusDiv) return;
  statusDiv.className = className;
  statusDiv.innerHTML = html;
}

/**
 * Muestra un error en el estado
 */
function mostrarError(mensaje) {
  console.error(mensaje);
  if (!statusDiv) return;
  statusDiv.className = 'error';
  statusDiv.innerHTML = `<span style="color: var(--danger)">${mensaje}</span>`;
}

// FUNCIÓN CORREGIDA para pull-to-refresh
function refreshData() {
    statusDiv.className = 'loading';
    statusDiv.innerHTML = '<i class="fas fa-sync fa-spin"></i> ACTUALIZANDO...';
    dataStats.innerHTML = '<i class="fas fa-server"></i> Conectando...';

    sheetsDataService.forceRefresh()
        .then(serverData => {
            if (serverData && serverData.success && serverData.data) {
                database = serverData.data;
                dataLoaded = true;
                cacheData(database);

                statusDiv.className = 'ready';
                statusDiv.innerHTML = '<i class="fas fa-check-circle"></i> DATOS ACTUALIZADOS';
                dataStats.innerHTML = `<i class="fas fa-database"></i> ${database.length} registros | ${new Date().toLocaleTimeString()}`;

                if (currentQRParts) {
                    processQRCodeParts(currentQRParts);
                } else {
                    resultsDiv.innerHTML = `
                        <div class="result-item" style="text-align: center; color: var(--gray);">
                            <div style="text-align: center;">
                                <i class="fas fa-qrcode fa-4x logo" aria-label="PandaDash QR Icon"></i>
                            </div>
                            <h1>PandaDash</h1>
                            <div class="name">Andrés Mendoza</div>
                        </div>
                    `;
                }

                playSuccessSound();
            } else {
                throw new Error('Datos incorrectos');
            }
        })
        .catch(error => {
            console.error("Error:", error);
            statusDiv.className = 'error';
            statusDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> ERROR';
            playErrorSound();
        });
}

// Detector de eventos para PWA Install
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevenir que Chrome muestre automáticamente el prompt
  e.preventDefault();
  // Guardar el evento para usarlo después
  deferredPrompt = e;
  // Mostrar el botón de instalación
  installBtn.style.display = 'block';
});

installBtn.addEventListener('click', async () => {
  if (deferredPrompt) {
    // Mostrar el prompt de instalación
    deferredPrompt.prompt();
    // Esperar a que el usuario responda al prompt
    const choiceResult = await deferredPrompt.userChoice;
    if (choiceResult.outcome === 'accepted') {
      console.log('App instalada');
    } else {
      console.log('Instalación cancelada');
    }
    // Limpiar el prompt guardado
    deferredPrompt = null;
    // Ocultar botón
    installBtn.style.display = 'none';
  }
});

// Bloqueo de zoom con JavaScript (para mayor seguridad)
document.addEventListener('DOMContentLoaded', function() {
  // Prevenir gestos de zoom
  document.addEventListener('gesturestart', function(e) {
    e.preventDefault();
  });
  
  // Prevenir doble toque para zoom
  let lastTouchEnd = 0;
  document.addEventListener('touchend', function(e) {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });
  
  // Prevenir zoom con teclado (Ctrl + +/-)
  document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && (e.key === '+' || e.key === '-' || e.key === '0')) {
      e.preventDefault();
    }
  });
});

// Detectar si es móvil para ajustes específicos
function esMovil() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Registrar Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js');
  });
}
