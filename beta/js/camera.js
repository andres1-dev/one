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
  barcodeInput.blur();
  document.activeElement.blur();
  
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
  photoPreview.style.display = 'none';
  cameraFeed.style.display = 'block';
  
  // Configurar cámara - usar cámara trasera por defecto
  navigator.mediaDevices.getUserMedia({ 
    video: { 
      facingMode: 'environment',
      width: { ideal: 1280 },
      height: { ideal: 720 }
    } 
  })
    .then(stream => {
      cameraStream = stream;
      cameraFeed.srcObject = stream;
    })
    .catch(error => {
      console.error("Error al acceder a la cámara:", error);
      alert("No se pudo acceder a la cámara. Por favor permite el acceso.");
      cerrarCamara();
    });
  
  // Configurar botones
  takePhotoBtn.innerHTML = '<i class="fas fa-camera"></i> Tomar Foto';
  takePhotoBtn.disabled = false;
  takePhotoBtn.onclick = capturarFoto;
  document.getElementById('uploadStatus').style.display = 'none';
  
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

// Función para capturar foto
function capturarFoto() {
  const cameraFeed = document.getElementById('cameraFeed');
  const photoPreview = document.getElementById('photoPreview');
  const takePhotoBtn = document.getElementById('takePhotoBtn');
  
  // Crear canvas temporal
  const canvas = document.createElement('canvas');
  canvas.width = cameraFeed.videoWidth;
  canvas.height = cameraFeed.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(cameraFeed, 0, 0, canvas.width, canvas.height);
  
  // Obtener blob de la imagen
  canvas.toBlob(blob => {
    photoBlob = blob;
    
    // Mostrar vista previa
    photoPreview.src = URL.createObjectURL(blob);
    photoPreview.style.display = 'block';
    cameraFeed.style.display = 'none';
    
    // Cambiar botón para subir foto
    takePhotoBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Subir Foto';
    takePhotoBtn.onclick = subirFoto;
  }, 'image/jpeg', 0.85);
}

// Función para subir foto (ahora usa la cola)
async function subirFoto() {
  if (!currentDocumentData || !photoBlob) {
    console.error("No hay datos disponibles para subir");
    return;
  }
  
  const { factura, btnElement } = currentDocumentData;
  const takePhotoBtn = document.getElementById('takePhotoBtn');
  const uploadStatus = document.getElementById('uploadStatus');
  
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
    
    // Crear objeto de trabajo para la cola con TODOS los datos específicos
    const jobData = {
      ...facturaData,
      fotoBase64: base64Data,
      fotoNombre: nombreArchivo,
      fotoTipo: 'image/jpeg',
      timestamp: new Date().toISOString()
    };
    
    // Agregar a la cola
    uploadQueue.addJob({
      type: 'photo',
      data: jobData,
      factura: factura,
      btnElementId: btnElement ? btnElement.getAttribute('data-factura') : null
    });
    
    // Actualizar UI
    uploadStatus.innerHTML = '<i class="fas fa-check-circle"></i> En cola para subir';
    takePhotoBtn.innerHTML = '<i class="fas fa-check"></i> En cola';
    
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
    const docElement = mainContainer.querySelector('.col-header:contains("Documento") + .json-value');
    if (docElement) data.documento = docElement.textContent.trim();
    
    const loteElement = mainContainer.querySelector('.col-header:contains("Lote") + .json-value');
    if (loteElement) data.lote = loteElement.textContent.trim();
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
    barcodeInput.focus();
  }, 300);
}

// Configurar botón cancelar
document.getElementById('cancelCaptureBtn').addEventListener('click', cerrarCamara);
