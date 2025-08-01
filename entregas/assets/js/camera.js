let cameraStream = null;
let photoBlob = null;
let preventKeyboardTimer = null;

// Función para abrir la cámara
function abrirCamara(factura) {
  currentDocumentData = {
    factura: factura,
    btnElement: document.querySelector(`.delivery-btn[data-factura="${factura}"]`)
  };
  
  mostrarCamara();
}

// Función para mostrar la cámara
function mostrarCamara() {
  const cameraModal = document.getElementById('cameraModal');
  const cameraFeed = document.getElementById('cameraFeed');
  const photoPreview = document.getElementById('photoPreview');
  const takePhotoBtn = document.getElementById('takePhotoBtn');
  const dummyInput = document.getElementById('dummyInput');
  
  // Ocultar teclado
  document.getElementById('barcode').blur();
  document.activeElement.blur();
  
  // Forzar que no se muestre el teclado
  if (dummyInput) {
    dummyInput.readOnly = true; 
    dummyInput.setAttribute('inputmode', 'none');
  }
  
  // Prevenir que cualquier elemento obtenga el foco
  preventKeyboardTimer = setInterval(() => {
    if (document.activeElement && document.activeElement.tagName === 'INPUT' && document.activeElement.id !== 'dummyInput') {
      document.activeElement.blur();
    }
  }, 100);
  
  // Mostrar modal
  cameraModal.style.display = 'flex';
  photoPreview.style.display = 'none';
  cameraFeed.style.display = 'block';
  
  // Configurar cámara
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
  
  // Agregar listener para prevenir el comportamiento predeterminado
  cameraModal.addEventListener('touchstart', preventDefaultBehavior, { passive: false });
  cameraModal.addEventListener('touchmove', preventDefaultBehavior, { passive: false });
}

// Resto de funciones de cámara...
