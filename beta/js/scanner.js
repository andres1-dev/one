// Funciones relacionadas con la cámara y procesamiento de imágenes

// Función para convertir Blob a Base64
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
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

// Función actualizada para procesar entregas
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
  //statusDiv.innerHTML = '<i class="fas fa-image"></i> Procesando imagen...';
  
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
        
        // Opcionalmente mostrar una vista previa
        //mostrarVistaPrevia(URL.createObjectURL(blob));
        
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

// Función para mostrar brevemente una vista previa (opcional)
function mostrarVistaPrevia(imgUrl) {
  // Crear elemento para vista previa temporal
  let preview = document.createElement('div');
  preview.style.position = 'fixed';
  preview.style.top = '50%';
  preview.style.left = '50%';
  preview.style.transform = 'translate(-50%, -50%)';
  preview.style.zIndex = '10000';
  preview.style.backgroundColor = 'rgba(0,0,0,0.8)';
  preview.style.padding = '10px';
  preview.style.borderRadius = '8px';
  preview.style.boxShadow = '0 0 20px rgba(0,0,0,0.5)';
  preview.style.maxWidth = '90%';
  preview.style.maxHeight = '70%';
  
  let img = document.createElement('img');
  img.src = imgUrl;
  img.style.width = '100%';
  img.style.height = 'auto';
  img.style.maxHeight = '70vh';
  img.style.objectFit = 'contain';
  img.style.borderRadius = '4px';
  
  let mensaje = document.createElement('div');
  mensaje.textContent = 'Procesando imagen...';
  mensaje.style.color = 'white';
  mensaje.style.textAlign = 'center';
  mensaje.style.padding = '10px';
  
  preview.appendChild(img);
  preview.appendChild(mensaje);
  document.body.appendChild(preview);
  
  // Eliminar después de 3 segundos
  setTimeout(() => {
    document.body.removeChild(preview);
  }, 3000);
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
          
          // Mostrar notificación
          /*mostrarNotificacion(
            'success',
            'Entrega sin factura',
            'La entrega ha sido registrada y está en cola para procesarse.'
          );*/
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
