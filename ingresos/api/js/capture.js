// ================== FUNCIONES DE CAPTURA Y WHATSAPP ==================

// Función para subir la imagen a Drive y obtener el enlace
async function uploadImageToDrive(imageData) {
  try {
    const response = await fetch('https://script.google.com/macros/s/AKfycbz6sUS28Xza02Kjwg-Eez1TPn4BBj2XcZGF8gKxEHr4Fsxz4eqYoQYHCqx5NWaOP1OR8g/exec', {
      method: 'POST',
      body: imageData
    });
    
    const result = await response.json();
    
    if (result.status === "success") {
      return result.imageUrl;
    } else {
      console.error("Error al subir la imagen:", result.message);
      return null;
    }
  } catch (error) {
    console.error("Error en la petición:", error);
    return null;
  }
}

async function captureAndDownloadCards() {
    try {
        const captureBtn = document.getElementById('captureBtn');
        const originalHtml = captureBtn.innerHTML;
        captureBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        captureBtn.disabled = true;

        // 1. Abrir todas las tarjetas y guardar estado original
        const cardHeaders = document.querySelectorAll('.card-header');
        const originalStates = [];
        
        cardHeaders.forEach(header => {
            const cardContent = header.nextElementSibling;
            originalStates.push(cardContent.classList.contains('expanded'));
            if (!cardContent.classList.contains('expanded')) {
                cardContent.classList.add('expanded');
                header.querySelector('.collapse-indicator').classList.add('expanded');
            }
        });

        await new Promise(resolve => setTimeout(resolve, 500));

        // 2. Configuración para captura
        const isMobile = window.matchMedia("(max-width: 768px)").matches;
        const cardsContainer = document.querySelector('.cards-container');
        
        // Ocultar elementos temporales
        const elementsToHide = document.querySelectorAll('.date-selector-container');
        elementsToHide.forEach(el => el.style.visibility = 'hidden');

        // Guardar estilos originales
        const originalStyles = {
            width: cardsContainer.style.width,
            overflow: cardsContainer.style.overflow,
            margin: cardsContainer.style.margin,
            transform: cardsContainer.style.transform,
            zoom: document.body.style.zoom
        };

        // Ajustar para captura
        cardsContainer.style.width = isMobile ? '1400px' : 'fit-content';
        cardsContainer.style.overflow = 'visible';
        cardsContainer.style.margin = '0 auto';
        if (isMobile) {
            document.body.style.zoom = '1';
        }

        // 3. Capturar con html2canvas
        const canvasOptions = {
            scale: isMobile ? 3 : 2,
            logging: false,
            useCORS: true,
            allowTaint: true,
            scrollX: 0,
            scrollY: 0,
            windowWidth: isMobile ? 2400 : cardsContainer.scrollWidth,
            windowHeight: cardsContainer.scrollHeight,
            backgroundColor: '#f5f7fa'
        };

        await new Promise(resolve => setTimeout(resolve, 300));
        const canvas = await html2canvas(cardsContainer, canvasOptions);

        // 4. Restaurar todo al estado original
        elementsToHide.forEach(el => el.style.visibility = 'visible');
        Object.assign(cardsContainer.style, originalStyles);
        document.body.style.zoom = originalStyles.zoom;
        
        // Restaurar estado de las tarjetas
        cardHeaders.forEach((header, index) => {
            const cardContent = header.nextElementSibling;
            const indicator = header.querySelector('.collapse-indicator');
            
            if (!originalStates[index]) {
                cardContent.classList.remove('expanded');
                indicator.classList.remove('expanded');
            }
        });

        // 5. Obtener imagen y subir a Drive
        const imageQuality = isMobile ? 1.0 : 0.9;
        const imageData = canvas.toDataURL('image/png', imageQuality).split(',')[1];
        const imageUrl = await uploadImageToDrive(imageData);
        
        // 6. Generar y abrir mensaje de WhatsApp
        const whatsappMessage = generateWhatsAppMessage(imageUrl);
        openWhatsApp(whatsappMessage);

    } catch (error) {
        console.error("Error al capturar:", error);
        alert("Error al generar captura. Intente nuevamente.");
    } finally {
        const captureBtn = document.getElementById('captureBtn');
        if (captureBtn) {
            captureBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
            captureBtn.disabled = false;
        }
    }
}

// Función para generar el mensaje de WhatsApp
function generateWhatsAppMessage(imageUrl = "") {
    if (!currentReportData) return "";
    
    const diaData = currentReportData.dia.actual;
    const mesData = currentReportData.mes.actual;
    const fechaObj = parseDate(diaData.fecha);
    
    // Formatear fechas
    const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    
    const diaNombre = dias[fechaObj.getDay()];
    const diaNumero = fechaObj.getDate();
    const mesNombre = meses[fechaObj.getMonth()];
    const año = fechaObj.getFullYear();
    
    // Datos de semanas
    const semanaActual = getWeekNumber(fechaObj);
    const semanaAnterior = semanaActual - 1 > 0 ? semanaActual - 1 : 52;
    
    // Preparar comparativo
    let comparativoAnterior = '';
    if (currentReportData.dia.anterior) {
        const fechaAnterior = parseDate(currentReportData.filtros.anterior);
        comparativoAnterior = `(vs ${fechaAnterior.getDate()} ${meses[fechaAnterior.getMonth()]} ${año-1})`;
    }

    // Determinar flecha de gestión
    let flechaGestion = '';
    if (diaData.gestion) {
        const valorGestion = parseFloat(diaData.gestion);
        flechaGestion = valorGestion < 0 ? '↓' : '↑';
    }

    // Obtener la tendencia global
    const tendenciaGlobal = getGlobalTrend();
    let textoTendencia = '';
    
    switch(tendenciaGlobal) {
        case 'positive':
            textoTendencia = '↑ Tendencia a la alza';
            break;
        case 'negative':
            textoTendencia = '↓ Tendencia a la baja';
            break;
        default:
            textoTendencia = 'Tendencia Estable';
    }

    // Construir el mensaje base
    let mensaje = `¡Bendiciones para todos!

Adjunto el Cierre de Ingresos del Día:
\`${diaNombre, ${diaNumero} de ${mesNombre} del ${año}\`

*${formatoCantidad(diaData.ingreso)}* unidades | Cumplimiento *${diaData.porcentaje}*
Meta: *${formatoCantidad(diaData.meta)}* ${comparativoAnterior}

${textoTendencia}

Muestra Semanal (S${semanaActual}/S${semanaAnterior}) Gestión ${flechaGestion} *${diaData.gestion || 'N/A'}*
* Promedio: *${formatoCantidad(diaData.promedio)}*
* Ponderado: *${formatoCantidad(diaData.ponderado)}*
* Desviación: *${formatoCantidad(diaData.desvest)}*
* Máximo: *${formatoCantidad(diaData.max)}*`;

    // Agregar enlaces
    mensaje += `\n\nEnlaces importantes:
☆ Link a la aplicación: https://andres1-dev.github.io/one/ingresos/informe/generar`;

    if (imageUrl) {
        mensaje += `\n★ Resumen visual: ${imageUrl}`;
    }

    // Cierre del mensaje
    mensaje += `\n\nQuedo atento a sus comentarios.`;

    return encodeURIComponent(mensaje);
}

// Función para abrir WhatsApp
function openWhatsApp(message) {
    const phoneNumber = "573168007979";
    const url = `https://wa.me/${phoneNumber}?text=${message}`;
    
    // Solución universal que funciona en iOS
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    
    // Crear un evento de click confiable
    const event = document.createEvent('MouseEvents');
    event.initEvent('click', true, true);
    
    // Disparar el evento
    anchor.dispatchEvent(event);
    
    // Forzar apertura en iOS si aún no funciona
    setTimeout(() => {
        window.location.href = url;
    }, 500);
}
