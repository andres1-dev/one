
// Variables globales para la cámara
let cameraStream = null;
let currentDocumentData = null;
let photoBlob = null;
let preventKeyboardTimer = null;

// Función para abrir la cámara
function abrirCamara(factura) {
  // Guardar datos para uso posterior
  currentDocumentData = {
    factura: factura,
    btnElement: document.querySelector(`.delivery-btn[data-factura="${factura}"]`)
  };
  
  // Mostrar la cámara
  mostrarCamara();
}

// Función para mostrar la cámara
function mostrarCamara() {
  const cameraModal = document.getElementById('cameraModal');
  const cameraFeed = document.getElementById('cameraFeed');
  const photoPreview = document.getElementById('photoPreview');
  const takePhotoBtn = document.getElementById('takePhotoBtn');
  const dummyInput = document.getElementById('dummyInput');
  
  // Ocultar teclado al abrir la cámara
  const barcodeInput = document.getElementById('barcode');
  if (barcodeInput) {
    barcodeInput.blur();
  }
  
  if (document.activeElement) {
    document.activeElement.blur();
  }
  
  // Forzar que no se muestre el teclado
  if (dummyInput) {
    dummyInput.readOnly = true; 
    dummyInput.setAttribute('inputmode', 'none');
  }
  
  // Prevenir que cualquier elemento obtenga el foco mientras la cámara está abierta
  preventKeyboardTimer = setInterval(() => {
    if (document.activeElement && document.activeElement.tagName === 'INPUT' && document.activeElement.id !== 'dummyInput') {
      document.activeElement.blur();
    }
  }, 100);
  
  // Mostrar modal y ocultar vista previa
  cameraModal.style.display = 'flex';
  if (photoPreview) {
    photoPreview.style.display = 'none';
  }
  if (cameraFeed) {
    cameraFeed.style.display = 'block';
  }
  
  // Configurar cámara - usar cámara trasera por defecto
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ 
      video: { 
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      } 
    })
      .then(stream => {
        cameraStream = stream;
        if (cameraFeed) {
          cameraFeed.srcObject = stream;
        }
      })
      .catch(error => {
        console.error("Error al acceder a la cámara:", error);
        alert("No se pudo acceder a la cámara. Por favor permite el acceso.");
        cerrarCamara();
      });
  } else {
    console.error("getUserMedia no está soportado en este navegador");
    alert("La cámara no está disponible en este dispositivo/navegador.");
    cerrarCamara();
  }
  
  // Configurar botones
  if (takePhotoBtn) {
    takePhotoBtn.innerHTML = '<i class="fas fa-camera"></i> Tomar Foto';
    takePhotoBtn.disabled = false;
    takePhotoBtn.onclick = capturarFoto;
  }
  
  const uploadStatus = document.getElementById('uploadStatus');
  if (uploadStatus) {
    uploadStatus.style.display = 'none';
  }
  
  // Agregar listener para prevenir el comportamiento predeterminado de los clics
  cameraModal.addEventListener('touchstart', preventDefaultBehavior, { passive: false });
  cameraModal.addEventListener('touchmove', preventDefaultBehavior, { passive: false });
}

// Prevenir comportamiento predeterminado para evitar enfoque de teclado
function preventDefaultBehavior(e) {
  if (e.target.tagName !== 'BUTTON') {
    e.preventDefault();
  }
}

// Función para capturar foto - CORREGIDA
function capturarFoto() {
  const cameraFeed = document.getElementById('cameraFeed');
  const photoPreview = document.getElementById('photoPreview');
  const takePhotoBtn = document.getElementById('takePhotoBtn');
  
  if (!cameraFeed || !photoPreview || !takePhotoBtn) {
    console.error("Elementos de cámara no encontrados");
    return;
  }
  
  // Crear canvas temporal con dimensiones correctas
  const canvas = document.createElement('canvas');
  const video = cameraFeed;
  
  // Usar las dimensiones reales del video
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  
  const ctx = canvas.getContext('2d');
  
  // Dibujar el frame actual del video en el canvas
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  // ✅ CORRECCIÓN: Obtener la imagen como base64 directamente
  try {
    const imageDataURL = canvas.toDataURL('image/jpeg', 0.85);
    
    // Convertir DataURL a blob para preview
    fetch(imageDataURL)
      .then(res => res.blob())
      .then(blob => {
        photoBlob = blob;
        
        // Mostrar vista previa
        photoPreview.src = imageDataURL;
        photoPreview.style.display = 'block';
        cameraFeed.style.display = 'none';
        
        // Guardar el base64 para la cola
        currentDocumentData.fotoBase64 = imageDataURL.split(',')[1];
        
        // Cambiar botón para subir foto
        takePhotoBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Subir Foto';
        takePhotoBtn.onclick = subirFoto;
      })
      .catch(error => {
        console.error("Error al procesar imagen:", error);
        alert("Error al procesar la imagen. Intenta de nuevo.");
      });
      
  } catch (error) {
    console.error("Error al convertir imagen:", error);
    alert("No se pudo procesar la imagen. Intenta de nuevo.");
  }
}

// Función para subir foto (ahora usa la cola)
// ✅ MODIFICAR la función subirFoto en camera.js
async function subirFoto() {
  if (!currentDocumentData || !photoBlob) {
    console.error("No hay datos disponibles para subir");
    return;
  }
  
  const { factura, btnElement } = currentDocumentData;
  const takePhotoBtn = document.getElementById('takePhotoBtn');
  const uploadStatus = document.getElementById('uploadStatus');
  
  if (!takePhotoBtn || !uploadStatus) {
    console.error("Elementos de UI no encontrados");
    return;
  }
  
  // Deshabilitar botón y mostrar estado de carga
  takePhotoBtn.disabled = true;
  takePhotoBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Preparando...';
  uploadStatus.style.display = 'flex';
  uploadStatus.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Preparando foto...';
  
  try {
    // Convertir blob a base64
    const base64Data = await blobToBase64(photoBlob);
    const nombreArchivo = `${factura}_${Date.now()}.jpg`.replace(/[^a-zA-Z0-9\-]/g, '');
    
    // Extraer datos específicos de la factura
    const facturaData = getFacturaData(factura);
    if (!facturaData) {
      throw new Error("No se pudieron obtener los datos de la factura");
    }
    
    // Crear objeto de trabajo para la cola
    const jobData = {
      ...facturaData,
      fotoBase64: base64Data,
      fotoNombre: nombreArchivo,
      fotoTipo: 'image/jpeg',
      timestamp: new Date().toISOString()
    };
    
    // ✅ USAR EXCLUSIVAMENTE LA COLA - SIN SUBIDA DIRECTA
    if (typeof window.uploadQueue === 'undefined') {
      throw new Error("El sistema de colas no está disponible");
    }
    
    // Agregar a la cola
    const jobId = window.uploadQueue.addJob({
      type: 'photo',
      data: jobData,
      factura: factura,
      btnElementId: btnElement ? btnElement.getAttribute('data-factura') : null
    });
    
    console.log(`✅ Foto agregada a cola con ID: ${jobId}`);
    
    // Actualizar UI
    uploadStatus.innerHTML = '<i class="fas fa-check-circle"></i> En cola para subir';
    takePhotoBtn.innerHTML = '<i class="fas fa-check"></i> En cola';
    
    // Forzar procesamiento si hay conexión
    if (navigator.onLine) {
      setTimeout(() => {
        window.uploadQueue.processQueue();
      }, 500);
    }
    
    // Cerrar cámara después de un breve retraso
    setTimeout(cerrarCamara, 1500);
    
  } catch (error) {
    console.error("Error al preparar foto:", error);
    uploadStatus.innerHTML = '<i class="fas fa-exclamation-circle"></i> Error al preparar';
    takePhotoBtn.disabled = false;
    takePhotoBtn.innerHTML = '<i class="fas fa-redo"></i> Reintentar';
  }
}

// Función para extraer datos específicos de la factura seleccionada
function getFacturaData(factura) {
  const facturaContainer = document.querySelector(`.siesa-item button[data-factura="${factura}"]`)?.closest('.siesa-item');
  if (!facturaContainer) return null;
  
  const data = {
    documento: '',
    lote: '',
    referencia: '',
    cantidad: 0,
    factura: factura,
    nit: ''
  };
  
  // Extraer datos del contenedor principal (documento)
  const mainContainer = document.querySelector('.result-item');
  if (mainContainer) {
    // Buscar documento
    const docElements = mainContainer.querySelectorAll('.result-row');
    docElements.forEach(row => {
      const header = row.querySelector('.col-header');
      const value = row.querySelector('.json-value');
      if (header && value) {
        const headerText = header.textContent.trim();
        if (headerText.includes('Documento')) {
          data.documento = value.textContent.trim();
        } else if (headerText.includes('Lote')) {
          data.lote = value.textContent.trim();
        }
      }
    });
  }
  
  // Extraer datos específicos de la factura
  const rows = facturaContainer.querySelectorAll('.result-row');
  rows.forEach(row => {
    const header = row.querySelector('.col-header')?.textContent.trim();
    const value = row.querySelector('.json-value')?.textContent.trim();
    
    if (!header || !value) return;
    
    if (header.includes('Referencia')) data.referencia = value;
    else if (header.includes('Cantidad')) data.cantidad = parseFloat(value) || 0;
    else if (header.includes('NIT')) data.nit = value;
    else if (header.includes('Nit')) data.nit = value;
  });
  
  return data;
}

// Función para cerrar la cámara
function cerrarCamara() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  
  const cameraModal = document.getElementById('cameraModal');
  if (!cameraModal) return;
  
  // Eliminar los listeners para prevenir comportamiento predeterminado
  cameraModal.removeEventListener('touchstart', preventDefaultBehavior);
  cameraModal.removeEventListener('touchmove', preventDefaultBehavior);
  
  // Limpiar el timer de prevención de teclado
  if (preventKeyboardTimer) {
    clearInterval(preventKeyboardTimer);
    preventKeyboardTimer = null;
  }
  
  cameraModal.style.display = 'none';
  photoBlob = null;
  
  // Restauramos el foco normal después de cerrar la cámara
  setTimeout(() => {
    const barcodeInput = document.getElementById('barcode');
    if (barcodeInput) {
      barcodeInput.focus();
    }
  }, 300);
}

// Configurar botón cancelar
document.addEventListener('DOMContentLoaded', function() {
  const cancelButton = document.getElementById('cancelCaptureBtn');
  if (cancelButton) {
    cancelButton.addEventListener('click', cerrarCamara);
  }
});

// Función auxiliar para convertir Blob a Base64 (si no está disponible globalmente)
if (typeof blobToBase64 === 'undefined') {
  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          resolve(result.split(',')[1]);
        } else {
          reject(new Error('No se pudo convertir el blob a base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

// Hacer funciones disponibles globalmente
window.abrirCamara = abrirCamara;
window.mostrarCamara = mostrarCamara;
window.capturarFoto = capturarFoto;
window.subirFoto = subirFoto;
window.cerrarCamara = cerrarCamara;
