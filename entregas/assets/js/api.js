// API URLs
const API_URL_GET = "https://script.google.com/macros/s/AKfycbzja5L4QU5qLBO0vSG2cGga18h_Mea3aJEHKyYrWx5_YssSKVLW4Q_Q6egqhel9M0dlKg/exec";
const API_URL_POST = "https://script.google.com/macros/s/AKfycbwgnkjVCMWlWuXnVaxSBD18CGN3rXGZtQZIvX9QlBXSgbQndWC4uqQ2sc00DuNH6yrb/exec";
const API_URL_ASENTAR_FACTURA = "https://script.google.com/macros/s/AKfycbz0cNRHuZYIeouAOZKsVZZSavN325HCr-6BN_7-bfFCQg5PoCybMYvQmLRRjcSSsXQR/exec";

// Función genérica para fetch
async function fetchData(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Error HTTP: ${response.status}`);
  }
  return response.json();
}

// Función para asentar facturas
async function asentarFactura(documento, lote, referencia, cantidad, factura, nit, btnElement) {
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
  updateStatus('loading', '<i class="fas fa-sync fa-spin"></i> ASENTANDO FACTURA...');
  
  // Crear un FormData para enviar los parámetros
  const formData = new FormData();
  formData.append('documento', documento);
  formData.append('lote', lote);
  formData.append('referencia', referencia);
  formData.append('cantidad', cantidad);
  formData.append('factura', factura);
  formData.append('nit', nit);
  
  try {
    const data = await fetchData(API_URL_ASENTAR_FACTURA, {
      method: 'POST',
      body: formData
    });
    
    if (data.success) {
      if (btnElement) {
        btnElement.innerHTML = '<i class="fas fa-check-circle"></i> FACTURA ASENTADA';
        btnElement.style.backgroundColor = '#28a745';
        btnElement.disabled = true;
      }
      
      updateStatus('processed', '<i class="fas fa-check-circle"></i> FACTURA ASENTADA CORRECTAMENTE');
      playSuccessSound();
    } else {
      if (btnElement) {
        btnElement.innerHTML = '<i class="fas fa-exclamation-triangle"></i> NO ENCONTRADO';
        btnElement.style.backgroundColor = '#f8961e';
        btnElement.disabled = false;
      }
      
      updateStatus('warning', '<i class="fas fa-exclamation-triangle"></i> NO SE PUDO ASENTAR LA FACTURA');
      mostrarNotificacion(
        'warning',
        'No se pudo asentar la factura.',
        data.message || 'El servidor no pudo procesar la solicitud.'
      );
      playErrorSound();
    }
  } catch (error) {
    console.error("Error al asentar factura:", error);
    
    if (btnElement) {
      btnElement.innerHTML = '<i class="fas fa-exclamation-circle"></i> ERROR';
      btnElement.style.backgroundColor = '#f72585';
      btnElement.disabled = false;
    }
    
    updateStatus('error', `<i class="fas fa-exclamation-circle"></i> ERROR: ${error.message}`);
    mostrarNotificacion(
      'error',
      'Error de conexión',
      `No se pudo conectar con el servidor: ${error.message}`
    );
    playErrorSound();
  }
}
