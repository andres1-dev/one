// URL específica para el endpoint de asentar facturas
const API_URL_ASENTAR_FACTURA = "https://script.google.com/macros/s/AKfycbz0cNRHuZYIeouAOZKsVZZSavN325HCr-6BN_7-bfFCQg5PoCybMYvQmLRRjcSSsXQR/exec";

/**
 * Función para asentar facturas (versión independiente)
 * Esta función se conecta directamente con el endpoint doPost2
 */
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
      reproducirSonidoExito();
      
      // Mostrar notificación temporal
      /*mostrarNotificacion(
        'success',
        `Factura "${factura}" asentada correctamente.`,
        data.message
      );*/
    } else {
      // Operación fallida pero respuesta recibida
      if (btnElement) {
        btnElement.innerHTML = '<i class="fas fa-exclamation-triangle"></i> NO ENCONTRADO';
        btnElement.style.backgroundColor = '#f8961e';
        btnElement.disabled = false;
      }
      
      // Actualizar estado
      actualizarEstado('warning', '<i class="fas fa-exclamation-triangle"></i> NO SE PUDO ASENTAR LA FACTURA');
      
      // Mostrar notificación de advertencia
      mostrarNotificacion(
        'warning',
        'No se pudo asentar la factura.',
        data.message || 'El servidor no pudo procesar la solicitud.'
      );
      
      // Reproducir sonido de advertencia (opcional, puedes usar el mismo que el de error)
      reproducirSonidoError();
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
    
    // Mostrar notificación de error
    mostrarNotificacion(
      'error',
      'Error de conexión',
      `No se pudo conectar con el servidor: ${error.message}`
    );
    
    // Reproducir sonido de error
    reproducirSonidoError();
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

/**
 * Muestra una notificación temporal
 */
function mostrarNotificacion(tipo, titulo, mensaje) {
  // Crear elemento de notificación
  const notificacion = document.createElement('div');
  notificacion.className = `result-item notificacion-${tipo}`;
  
  // Estilos según el tipo
  let colorFondo, colorTexto, icono;
  
  if (tipo === 'success') {
    colorFondo = '#d4edda';
    colorTexto = '#155724';
    icono = 'fa-check-circle';
  } else if (tipo === 'warning') {
    colorFondo = '#fff3cd';
    colorTexto = '#856404';
    icono = 'fa-exclamation-triangle';
  } else { // error
    colorFondo = '#f8d7da';
    colorTexto = '#721c24';
    icono = 'fa-exclamation-circle';
  }
  
  // Aplicar estilos
  notificacion.style.backgroundColor = colorFondo;
  notificacion.style.color = colorTexto;
  notificacion.style.padding = '15px';
  notificacion.style.marginTop = '10px';
  notificacion.style.borderRadius = '8px';
  notificacion.style.textAlign = 'center';
  notificacion.style.fontWeight = '500';
  notificacion.style.position = 'relative';
  
  // Contenido
  notificacion.innerHTML = `
    <i class="fas ${icono}"></i> 
    <strong>${titulo}</strong>
    <div style="font-size: 13px; margin-top: 5px; opacity: 0.8">
      ${mensaje}
    </div>
    <span class="cerrar-notificacion" style="position: absolute; top: 5px; right: 10px; cursor: pointer;">
      <i class="fas fa-times"></i>
    </span>
  `;
  
  // Insertar al principio de los resultados
  if (resultsDiv) {
    const firstChild = resultsDiv.firstChild;
    if (firstChild) {
      resultsDiv.insertBefore(notificacion, firstChild);
    } else {
      resultsDiv.appendChild(notificacion);
    }
  } else {
    // Si no hay contenedor de resultados, agregar al body
    document.body.appendChild(notificacion);
    notificacion.style.position = 'fixed';
    notificacion.style.top = '20px';
    notificacion.style.left = '50%';
    notificacion.style.transform = 'translateX(-50%)';
    notificacion.style.zIndex = '9999';
    notificacion.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    notificacion.style.maxWidth = '90%';
    notificacion.style.width = '350px';
  }
  
  // Agregar evento para cerrar la notificación
  const cerrarBtn = notificacion.querySelector('.cerrar-notificacion');
  if (cerrarBtn) {
    cerrarBtn.addEventListener('click', () => {
      notificacion.remove();
    });
  }
  
  // Eliminar automáticamente después de 6 segundos
  setTimeout(() => {
    if (notificacion.parentNode) {
      notificacion.parentNode.removeChild(notificacion);
    }
  }, 6000);
}

/**
 * Reproduce un sonido de éxito
 */
function reproducirSonidoExito() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)(); 
    const osc = ctx.createOscillator(); 
    const gainNode = ctx.createGain(); 
    osc.type = "sine"; 
    osc.frequency.value = 800; 
    gainNode.gain.value = 0.7; 
    osc.connect(gainNode); 
    gainNode.connect(ctx.destination); 
    osc.start(); 
    
    // Cambio gradual para un sonido más agradable
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    
    // Detener después de un tiempo
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {
    console.log("Error al reproducir sonido de éxito:", e);
  }
}

/**
 * Reproduce un sonido de error
 */
function reproducirSonidoError() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)(); 
    const osc = ctx.createOscillator(); 
    const gainNode = ctx.createGain(); 
    osc.type = "sawtooth"; 
    osc.frequency.setValueAtTime(300, ctx.currentTime); 
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.5); 
    gainNode.gain.value = 0.6; 
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5); 
    osc.connect(gainNode); 
    gainNode.connect(ctx.destination); 
    osc.start(); 
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    console.log("Error al reproducir sonido de error:", e);
  }
}
