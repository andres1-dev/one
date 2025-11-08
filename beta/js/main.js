// Archivo principal que inicializa la aplicación

// Inicialización al cargar el documento
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Iniciando PandaDash...');
  
  // Inicializar la cola de carga
  initializeUploadQueue();
  
  // Inicializar escáner QR - ESTA LÍNEA ES IMPORTANTE
  qrScanner = initializeQRScanner();
  
  // Configurar control de teclado
  setupKeyboardControl();
  
  // Cargar datos desde el servidor
  loadDataFromServer();
  
  // Configurar event listeners
  setupEventListeners();
  
  // Configurar PWA
  setupPWA();
  
  console.log('✅ PandaDash inicializado correctamente');
});

function setupKeyboardControl() {
  console.log('⌨️ Configurando control de teclado...');
  
  const keyboardToggleBtn = document.getElementById('keyboardToggleBtn');
  const barcodeInput = document.getElementById('barcode');
  
  if (!keyboardToggleBtn || !barcodeInput) {
    console.error('❌ No se encontraron elementos del teclado');
    return;
  }
  
  // Estado inicial - teclado DESHABILITADO
  keyboardEnabled = false;
  barcodeInput.readOnly = true;
  barcodeInput.className = '';
  keyboardToggleBtn.className = 'keyboard-disabled';
  keyboardToggleBtn.title = 'Activar teclado';
  
  // Evento para toggle de teclado
  keyboardToggleBtn.addEventListener('click', function() {
    keyboardEnabled = !keyboardEnabled;
    console.log(`⌨️ Teclado ${keyboardEnabled ? 'ACTIVADO' : 'DESACTIVADO'}`);
    
    if (keyboardEnabled) {
      // Habilitar teclado
      barcodeInput.readOnly = false;
      barcodeInput.className = 'enabled';
      barcodeInput.placeholder = 'Escribe el código manualmente';
      keyboardToggleBtn.className = 'keyboard-enabled';
      keyboardToggleBtn.title = 'Desactivar teclado';
      keyboardToggleBtn.innerHTML = '<i class="fas fa-keyboard"></i>';
      
      // Enfocar el input
      setTimeout(() => {
        barcodeInput.focus();
      }, 100);
      
      showKeyboardStatus('Teclado ACTIVADO - Puedes escribir manualmente', 'success');
      
    } else {
      // Deshabilitar teclado
      barcodeInput.readOnly = true;
      barcodeInput.className = '';
      barcodeInput.placeholder = 'Código escaneado aparecerá aquí';
      keyboardToggleBtn.className = 'keyboard-disabled';
      keyboardToggleBtn.title = 'Activar teclado';
      keyboardToggleBtn.innerHTML = '<i class="fas fa-keyboard"></i>';
      
      // Quitar foco
      barcodeInput.blur();
      
      showKeyboardStatus('Teclado DESACTIVADO - Usa escáner QR', 'info');
    }
  });
  
  // Prevenir cualquier foco no deseado cuando está deshabilitado
  barcodeInput.addEventListener('focus', function(e) {
    if (this.readOnly) {
      console.log('🛑 Foco prevenido - teclado deshabilitado');
      e.preventDefault();
      this.blur();
      
      // Sugerir usar el botón de teclado
      showKeyboardStatus('Presiona el botón del teclado para habilitar escritura', 'warning');
      
      // Efecto visual en el botón
      keyboardToggleBtn.style.transform = 'scale(1.2)';
      setTimeout(() => {
        keyboardToggleBtn.style.transform = 'scale(1)';
      }, 500);
    }
  });
  
  // Prevenir clics que puedan abrir el teclado
  barcodeInput.addEventListener('click', function(e) {
    if (this.readOnly) {
      console.log('🛑 Clic prevenido - teclado deshabilitado');
      e.preventDefault();
      this.blur();
      
      showKeyboardStatus('Habilita el teclado para escribir manualmente', 'info');
    }
  });
  
  // Manejar el evento de input (cuando se escribe manualmente)
  barcodeInput.addEventListener('input', function() {
    if (!keyboardEnabled) {
      console.log('🛑 Input ignorado - teclado deshabilitado');
      return;
    }
    
    const code = this.value.trim();
    console.log(`📝 Input recibido: "${code}"`);
    
    if (code.length < 5) return;
    
    // Procesar código como si fuera escaneado
    const parts = parseQRCode(code);
    
    if (parts) {
      console.log('✅ Código válido detectado:', parts);
      currentQRParts = parts;
      const startTime = Date.now();
      processQRCodeParts(parts);
      const searchTime = Date.now() - startTime;
      
      statusDiv.className = 'processed';
      statusDiv.textContent = `REGISTRO PROCESADO (${searchTime}ms)`;
    } else {
      console.log('❌ Formato de código inválido');
      showError(code, "Formato de código no válido. Use formato: DOCUMENTO-NIT");
      playErrorSound();
      statusDiv.textContent = `FORMATO INVÁLIDO`;
    }
    
    // Limpiar input después de procesar
    setTimeout(() => {
      this.value = '';
    }, 50);
  });
  
  console.log('✅ Control de teclado configurado');
}

function showKeyboardStatus(message, type = 'info') {
  // Remover notificación anterior si existe
  const existingNotification = document.querySelector('.keyboard-status-notification');
  if (existingNotification) {
    existingNotification.remove();
  }
  
  // Crear notificación
  const notification = document.createElement('div');
  notification.className = `keyboard-status-notification ${type}`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  // Remover después de 3 segundos
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 3000);
}

function setupEventListeners() {
  console.log('🔧 Configurando event listeners...');
  
  // Foco persistente SOLO cuando el teclado está habilitado
  function enforceFocus() {
    if (keyboardEnabled && 
        document.activeElement !== barcodeInput && 
        document.getElementById('cameraModal').style.display !== 'flex' &&
        document.getElementById('qrScannerModal').style.display !== 'flex') {
      barcodeInput.focus();
    }
    setTimeout(enforceFocus, 100);
  }
  enforceFocus();
  
  // Detector para deshabilitar el teclado virtual
  document.addEventListener('touchstart', function(e) {
    const cameraModal = document.getElementById('cameraModal');
    const qrScannerModal = document.getElementById('qrScannerModal');
    
    if ((cameraModal.style.display === 'flex' || qrScannerModal.style.display === 'flex') && 
        e.target.tagName !== 'BUTTON') {
      e.preventDefault();
      if (document.activeElement) {
        document.activeElement.blur();
      }
    }
    
    // Prevenir que toques en el input abran el teclado si está deshabilitado
    if (e.target === barcodeInput && barcodeInput.readOnly) {
      e.preventDefault();
      barcodeInput.blur();
    }
  }, { passive: false });
  
  // Prevenir enfoque no deseado en cualquier input
  document.addEventListener('focusin', function(e) {
    const cameraModal = document.getElementById('cameraModal');
    const qrScannerModal = document.getElementById('qrScannerModal');
    
    // Si algún modal está abierto, prevenir enfoque
    if ((cameraModal.style.display === 'flex' || qrScannerModal.style.display === 'flex') && 
        e.target.id !== 'dummyInput') {
      e.preventDefault();
      e.target.blur();
    }
    
    // Si el teclado está deshabilitado y se enfoca el input, prevenir
    if (e.target === barcodeInput && !keyboardEnabled) {
      e.preventDefault();
      e.target.blur();
    }
  });
  
  // Manejar el cambio de orientación
  window.addEventListener('orientationchange', function() {
    const cameraModal = document.getElementById('cameraModal');
    const qrScannerModal = document.getElementById('qrScannerModal');
    
    if (cameraModal.style.display === 'flex' || qrScannerModal.style.display === 'flex') {
      setTimeout(() => {
        document.activeElement.blur();
      }, 300);
    }
  });
  
  // Conexión/Desconexión
  window.addEventListener('online', function() {
    console.log('🌐 Conexión restablecida');
    offlineBanner.style.display = 'none';
    statusDiv.className = 'reconnected';
    statusDiv.innerHTML = '<i class="fas fa-wifi"></i> CONEXIÓN RESTABLECIDA';
    
    if (!dataLoaded) {
      setTimeout(() => loadDataFromServer(), 1000);
    }
  });
  
  window.addEventListener('offline', function() {
    console.log('📴 Sin conexión');
    offlineBanner.style.display = 'block';
    statusDiv.className = 'offline';
    statusDiv.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; gap: 10px; text-align: center;">
        <i class="fas fa-wifi-slash"></i>
        <span>MODO OFFLINE ACTIVO</span>
      </div>
    `;
  });
  
  console.log('✅ Event listeners configurados');
}
  
  // Pull-to-Refresh extremadamente simplificado, con dos dedos, sin banners ni notificaciones
  setupPullToRefresh();
});

function loadDataFromServer() {
  statusDiv.className = 'loading';
  statusDiv.innerHTML = '<i class="fas fa-sync fa-spin"></i> CARGANDO DATOS...';
  dataStats.innerHTML = '<i class="fas fa-server"></i> Conectando con el servidor...';
  
  // Usamos fetch para obtener los datos del servidor
  fetch(`${API_URL_GET}?nocache=${new Date().getTime()}`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }
      return response.json();
    })
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

function setupPullToRefresh() {
  // Variables de control
  let startY = 0;
  let isPulling = false;
  
  // Manejador para touchstart (inicio del gesto)
  document.addEventListener('touchstart', function(e) {
    // Solo activar si hay dos o más dedos tocando la pantalla
    if (e.touches.length >= 2 && window.scrollY < 10) {
      startY = e.touches[0].clientY;
      isPulling = true;
      e.preventDefault(); // Prevenir comportamiento por defecto
    }
  }, { passive: false });
  
  // Manejador para touchmove (movimiento durante el gesto)
  document.addEventListener('touchmove', function(e) {
    // Verificar si estamos en un gesto válido y hay dos dedos
    if (!isPulling || e.touches.length < 2) return;
    
    // Calcular la distancia desplazada
    const currentY = e.touches[0].clientY;
    const pullDistance = currentY - startY;
    
    // Si hay un movimiento hacia abajo de al menos 20px, activar actualización
    if (pullDistance > 20) {
      // Desactivar el gesto para evitar múltiples actualizaciones
      isPulling = false;
      
      // Iniciar la actualización inmediatamente
      refreshData();
      
      // Prevenir comportamiento predeterminado
      e.preventDefault();
    }
  }, { passive: false });
  
  // Manejador para touchend (fin del gesto)
  document.addEventListener('touchend', function() {
    isPulling = false;
  });
  
  // Función para refrescar los datos
  function refreshData() {
    // Actualizar el estado para mostrar que estamos cargando
    statusDiv.className = 'loading';
    statusDiv.innerHTML = '<i class="fas fa-sync fa-spin"></i> ACTUALIZANDO...';
    dataStats.innerHTML = '<i class="fas fa-server"></i> Conectando...';
    
    // Llamar a la API para obtener datos frescos
    fetch(`${API_URL_GET}?nocache=${new Date().getTime()}`)
      .then(response => {
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        return response.json();
      })
      .then(serverData => {
        if (serverData && serverData.success && serverData.data) {
          // Actualizar datos globales
          database = serverData.data;
          dataLoaded = true;
          cacheData(database);
          
          // Actualizar interfaz
          statusDiv.className = 'ready';
          statusDiv.innerHTML = '<i class="fas fa-check-circle"></i> DATOS ACTUALIZADOS';
          dataStats.innerHTML = `<i class="fas fa-database"></i> ${database.length} registros | ${new Date().toLocaleTimeString()}`;
          
          // Re-procesar datos actuales si hay un QR activo
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
          
          // Efecto sonoro de éxito
          if (typeof playSuccessSound === 'function') {
            playSuccessSound();
          }
        } else {
          throw new Error('Datos incorrectos');
        }
      })
      .catch(error => {
        console.error("Error:", error);
        statusDiv.className = 'error';
        statusDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> ERROR';
        
        // Efecto sonoro de error
        if (typeof playErrorSound === 'function') {
          playErrorSound();
        }
      });
  }
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

// Registrar Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js');
  });
}

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
