// ================== CONSTANTES Y VARIABLES GLOBALES ==================
const MAX_RETRIES = 3;
let currentReportData = null;
let isLoading = false;
let retryCount = 0;
let consolidatedData = [];
let budgetData = [];
let detailedDataTable;
let dateRangePicker;
let tendenciaChart;

// ================== FUNCIONES DE FORMATO ==================

/**
 * Formatea un número con separadores de miles
 * @param {number|string} num - Número a formatear
 * @returns {string} Número formateado
 */
function formatoCantidad(num) {
    if (typeof num === 'string') {
        const numValue = parseFloat(num.replace(/\./g, '').replace(',', '.'));
        return !isNaN(numValue) ? numValue.toLocaleString("es-ES") : num;
    }
    return num.toLocaleString("es-ES");
}

/**
 * Extrae el valor numérico de un porcentaje
 * @param {string} porcentajeStr - Cadena con porcentaje (ej. "25.5%")
 * @returns {number} Valor numérico
 */
function extraerPorcentaje(porcentajeStr) {
    if (!porcentajeStr) return 0;
    const match = porcentajeStr.match(/(\d+\.?\d*)/);
    return match ? parseFloat(match[0]) : 0;
}

// ================== FUNCIONES DE INTERFAZ ==================

/**
 * Alterna la visualización de una tarjeta
 * @param {HTMLElement} header - Elemento de cabecera de la tarjeta
 */
function toggleCard(header) {
    const cardContent = header.nextElementSibling;
    const indicator = header.querySelector('.collapse-indicator');
    
    cardContent.classList.toggle('expanded');
    indicator.classList.toggle('expanded');
}

/**
 * Alterna la visualización de comparativos
 * @param {HTMLElement} header - Elemento de cabecera del comparativo
 */
function toggleComparison(header) {
    const content = header.nextElementSibling;
    const indicator = header.querySelector('.comparison-collapse-icon');
    
    content.classList.toggle('expanded');
    indicator.classList.toggle('expanded');
}

/**
 * Abre todas las tarjetas
 */
function openAllCards() {
    document.querySelectorAll('.card-header').forEach(header => {
        const cardContent = header.nextElementSibling;
        const indicator = header.querySelector('.collapse-indicator');
        
        if (!cardContent.classList.contains('expanded')) {
            cardContent.classList.add('expanded');
            indicator.classList.add('expanded');
        }
    });
}

// ================== FUNCIONES DE CARGA DE DATOS ==================

/**
 * Actualiza el reporte con una nueva fecha
 * @param {Date} newDate - Fecha para el reporte
 * @param {boolean} forceReload - Forzar recarga de datos
 */
async function updateReportWithDate(newDate, forceReload = false) {
    if (isLoading) return;
    
    isLoading = true;
    retryCount = 0;
    const updateBtn = document.getElementById('updateReportBtn');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    const loadingProgress = document.getElementById('loadingProgress');
    
    try {
        loadingOverlay.classList.add('active');
        loadingText.textContent = "Actualizando datos...";
        loadingProgress.style.width = '10%';
        
        updateBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
        updateBtn.style.pointerEvents = 'none';
        
        if (forceReload || consolidatedData.length === 0 || budgetData.length === 0) {
            loadingText.textContent = "Cargando datos iniciales...";
            loadingProgress.style.width = '30%';
            
            consolidatedData = [];
            budgetData = [];
            await cargarDatosIniciales();
            
            loadingProgress.style.width = '50%';
        }
        
        loadingText.textContent = "Generando reporte...";
        loadingProgress.style.width = '70%';
        
        const reporte = await generarReporteCompleto(newDate);
        currentReportData = reporte;
        
        loadingText.textContent = "Actualizando interfaz...";
        loadingProgress.style.width = '90%';
        
        cargarDatosDia();
        cargarDatosMes();
        cargarDatosAño();
        cargarDatosTendencia();
        
        loadingProgress.style.width = '100%';
        await new Promise(resolve => setTimeout(resolve, 300));
        
    } catch (error) {
        console.error("Error:", error);
        loadingText.textContent = "Error al cargar datos";
        loadingProgress.style.backgroundColor = "#e74c3c";
        await new Promise(resolve => setTimeout(resolve, 1500));
    } finally {
        loadingOverlay.classList.remove('active');
        loadingProgress.style.width = '0%';
        loadingProgress.style.backgroundColor = "";
        
        isLoading = false;
        if (updateBtn) {
            updateBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
            updateBtn.style.pointerEvents = 'auto';
        }
        
        setTimeout(() => {
            loadingProgress.style.width = '0%';
        }, 300);
    }
}

// ================== FUNCIONES DE ACTUALIZACIÓN DE UI ==================

/**
 * Carga los datos diarios en la interfaz
 */
function cargarDatosDia() {
    if (!currentReportData) return;
    
    const data = currentReportData.dia;
    const actual = data.actual;
    const anterior = data.anterior;
    
    document.getElementById("dia-fecha").textContent = `${actual.fecha}`;
    document.getElementById("dia-meta").textContent = formatoCantidad(actual.meta);
    document.getElementById("dia-ingreso").textContent = formatoCantidad(actual.ingreso);
    
    // Diferencia
    const diffEl = document.getElementById("dia-diferencia");
    diffEl.textContent = formatoCantidad(actual.diferencia);
    diffEl.className = "data-value " + (actual.diferencia >= 0 ? "positive" : "negative");
    
    // Porcentaje
    document.getElementById("dia-porcentaje").textContent = actual.porcentaje;
    
    // Barra de progreso
    const progressBar = document.getElementById("dia-progressBar");
    const progressPercent = document.getElementById("dia-progressPercent");
    let progreso = extraerPorcentaje(actual.porcentaje);
    let colorBarra;
    
    if (progreso < 30) {
        colorBarra = "linear-gradient(90deg, #e74c3c, #f39c12)";
    } else if (progreso < 70) {
        colorBarra = "linear-gradient(90deg, #f39c12, #f1c40f)";
    } else if (progreso < 100) {
        colorBarra = "linear-gradient(90deg, #2ecc71, #27ae60)";
    } else {
        colorBarra = "linear-gradient(90deg, #27ae60, #219653)";
    }
    
    progressBar.style.background = colorBarra;
    progressPercent.textContent = "0%";
    
    setTimeout(() => {
        progressBar.style.width = progreso + "%";
        progressPercent.textContent = actual.porcentaje;
    }, 300);
    
    // Mostrar restante
    document.getElementById("dia-restante").textContent = 
        `Faltan ${formatoCantidad(actual.meta - actual.ingreso)} para alcanzar la meta`;
    
    // Gestión
    const gestEl = document.getElementById("dia-gestion");
    const trendIcon = document.getElementById("dia-trendIcon");
    
    if (actual.gestion) {
        const gestionValue = extraerPorcentaje(actual.gestion);
        gestEl.textContent = actual.gestion;
        
        if (gestionValue > 5) {
            gestEl.className = "positive";
            trendIcon.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
            trendIcon.style.color = "var(--success-color)";
        } else if (gestionValue < -5) {
            gestEl.className = "negative";
            trendIcon.innerHTML = '<i class="fa-solid fa-arrow-down"></i>';
            trendIcon.style.color = "var(--danger-color)";
        } else {
            gestEl.className = "neutral";
            trendIcon.innerHTML = '<i class="fa-solid fa-equals"></i>';
            trendIcon.style.color = "var(--warning-color)";
        }
    } else {
        gestEl.textContent = "N/A";
        gestEl.className = "";
        trendIcon.innerHTML = '';
    }
    
    // Estadísticas adicionales
    document.getElementById("dia-average").textContent = formatoCantidad(actual.promedio);
    document.getElementById("dia-weighted").textContent = formatoCantidad(actual.ponderado);
    document.getElementById("dia-desvest").textContent = formatoCantidad(actual.desvest);
    document.getElementById("dia-max").textContent = formatoCantidad(actual.max);
    
    // Comparativo extendido
    if (anterior) {
        document.getElementById("dia-metaAnterior").textContent = formatoCantidad(anterior.meta);
        document.getElementById("dia-ingresoAnterior").textContent = formatoCantidad(anterior.ingreso);
        document.getElementById("dia-porcentajeAnterior").textContent = anterior.porcentaje;
        document.getElementById("dia-diaAnterior").textContent = anterior.dia_letras;
        document.getElementById("dia-averageAnterior").textContent = formatoCantidad(anterior.promedio);
        document.getElementById("dia-weightedAnterior").textContent = formatoCantidad(anterior.ponderado);
        document.getElementById("dia-desvestAnterior").textContent = formatoCantidad(anterior.desvest);
        document.getElementById("dia-maxAnterior").textContent = formatoCantidad(anterior.max);
    }
}

/**
 * Carga los datos mensuales en la interfaz
 */
function cargarDatosMes() {
    if (!currentReportData) return;
    
    const data = currentReportData.mes;
    const actual = data.actual;
    const anterior = data.anterior;
    
    document.getElementById("mes-mes").textContent = `${actual.mes}`;
    document.getElementById("mes-meta").textContent = formatoCantidad(actual.meta);
    document.getElementById("mes-ingreso").textContent = formatoCantidad(actual.ingreso);
    
    // Diferencia
    const diffEl = document.getElementById("mes-diferencia");
    diffEl.textContent = formatoCantidad(actual.diferencia);
    diffEl.className = "data-value " + (actual.diferencia >= 0 ? "positive" : "negative");
    
    // Porcentaje
    document.getElementById("mes-porcentaje").textContent = actual.porcentaje;
    
    // Barra de progreso
    const progressBar = document.getElementById("mes-progressBar");
    const progressPercent = document.getElementById("mes-progressPercent");
    let progreso = extraerPorcentaje(actual.porcentaje);
    let colorBarra;
    
    if (progreso < 30) {
        colorBarra = "linear-gradient(90deg, #e74c3c, #f39c12)";
    } else if (progreso < 70) {
        colorBarra = "linear-gradient(90deg, #f39c12, #f1c40f)";
    } else if (progreso < 100) {
        colorBarra = "linear-gradient(90deg, #2ecc71, #27ae60)";
    } else {
        colorBarra = "linear-gradient(90deg, #27ae60, #219653)";
    }
    
    progressBar.style.background = colorBarra;
    progressPercent.textContent = "0%";
    
    setTimeout(() => {
        progressBar.style.width = progreso + "%";
        progressPercent.textContent = actual.porcentaje;
    }, 500);
    
    // Mostrar restante
    document.getElementById("mes-restante").textContent = 
        `Faltan ${formatoCantidad(actual.meta - actual.ingreso)} para alcanzar la meta`;
    
    // Gestión
    const gestEl = document.getElementById("mes-gestion");
    const trendIcon = document.getElementById("mes-trendIcon");
    
    if (actual.gestion) {
        const gestionValue = extraerPorcentaje(actual.gestion);
        gestEl.textContent = actual.gestion;
        
        if (gestionValue > 5) {
            gestEl.className = "positive";
            trendIcon.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
            trendIcon.style.color = "var(--success-color)";
        } else if (gestionValue < -5) {
            gestEl.className = "negative";
            trendIcon.innerHTML = '<i class="fa-solid fa-arrow-down"></i>';
            trendIcon.style.color = "var(--danger-color)";
        } else {
            gestEl.className = "neutral";
            trendIcon.innerHTML = '<i class="fa-solid fa-equals"></i>';
            trendIcon.style.color = "var(--warning-color)";
        }
    } else {
        gestEl.textContent = "N/A";
        gestEl.className = "";
        trendIcon.innerHTML = '';
    }
    
    // Estadísticas adicionales
    document.getElementById("mes-average").textContent = formatoCantidad(actual.promedio);
    document.getElementById("mes-weighted").textContent = formatoCantidad(actual.ponderado);
    document.getElementById("mes-desvest").textContent = formatoCantidad(actual.desvest);
    document.getElementById("mes-max").textContent = formatoCantidad(actual.max);
    
    // Comparativo extendido
    if (anterior) {
        document.getElementById("mes-metaAnterior").textContent = formatoCantidad(anterior.meta);
        document.getElementById("mes-ingresoAnterior").textContent = formatoCantidad(anterior.ingreso);
        document.getElementById("mes-porcentajeAnterior").textContent = anterior.porcentaje;
        document.getElementById("mes-habilAnterior").textContent = anterior.registros + " días";
        document.getElementById("mes-averageAnterior").textContent = formatoCantidad(anterior.promedio);
        document.getElementById("mes-weightedAnterior").textContent = formatoCantidad(anterior.ponderado);
        document.getElementById("mes-desvestAnterior").textContent = formatoCantidad(anterior.desvest);
        document.getElementById("mes-maxAnterior").textContent = formatoCantidad(anterior.max);
    }
}

/**
 * Carga los datos anuales en la interfaz
 */
function cargarDatosAño() {
    if (!currentReportData) return;
    
    const data = currentReportData.año;
    const actual = data.actual;
    const anterior = data.anterior;
    
    document.getElementById("año-año").textContent = actual.año;
    document.getElementById("año-meta").textContent = formatoCantidad(actual.meta);
    document.getElementById("año-ingreso").textContent = formatoCantidad(actual.ingreso);
    
    // Diferencia
    const diffEl = document.getElementById("año-diferencia");
    diffEl.textContent = formatoCantidad(actual.diferencia);
    diffEl.className = "data-value " + (actual.diferencia >= 0 ? "positive" : "negative");
    
    // Porcentaje
    document.getElementById("año-porcentaje").textContent = actual.porcentaje;
    
    // Barra de progreso
    const progressBar = document.getElementById("año-progressBar");
    const progressPercent = document.getElementById("año-progressPercent");
    let progreso = extraerPorcentaje(actual.porcentaje);
    let colorBarra;
    
    if (progreso < 30) {
        colorBarra = "linear-gradient(90deg, #e74c3c, #f39c12)";
    } else if (progreso < 70) {
        colorBarra = "linear-gradient(90deg, #f39c12, #f1c40f)";
    } else if (progreso < 100) {
        colorBarra = "linear-gradient(90deg, #2ecc71, #27ae60)";
    } else {
        colorBarra = "linear-gradient(90deg, #27ae60, #219653)";
    }
    
    progressBar.style.background = colorBarra;
    progressPercent.textContent = "0%";
    
    setTimeout(() => {
        progressBar.style.width = progreso + "%";
        progressPercent.textContent = actual.porcentaje;
    }, 700);
    
    // Mostrar restante
    document.getElementById("año-restante").textContent = 
        `Faltan ${formatoCantidad(actual.meta - actual.ingreso)} para alcanzar la meta`;
    
    // Gestión
    const gestEl = document.getElementById("año-gestion");
    const trendIcon = document.getElementById("año-trendIcon");
    
    if (actual.gestion) {
        const gestionValue = extraerPorcentaje(actual.gestion);
        gestEl.textContent = actual.gestion;
        
        if (gestionValue > 5) {
            gestEl.className = "positive";
            trendIcon.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
            trendIcon.style.color = "var(--success-color)";
        } else if (gestionValue < -5) {
            gestEl.className = "negative";
            trendIcon.innerHTML = '<i class="fa-solid fa-arrow-down"></i>';
            trendIcon.style.color = "var(--danger-color)";
        } else {
            gestEl.className = "neutral";
            trendIcon.innerHTML = '<i class="fa-solid fa-equals"></i>';
            trendIcon.style.color = "var(--warning-color)";
        }
    } else {
        gestEl.textContent = "N/A";
        gestEl.className = "";
        trendIcon.innerHTML = '';
    }
    
    // Estadísticas adicionales
    document.getElementById("año-average").textContent = formatoCantidad(actual.promedio);
    document.getElementById("año-weighted").textContent = formatoCantidad(actual.ponderado);
    document.getElementById("año-desvest").textContent = formatoCantidad(actual.desvest);
    document.getElementById("año-max").textContent = formatoCantidad(actual.max);
    
    // Comparativo extendido
    if (anterior) {
        document.getElementById("año-metaAnterior").textContent = formatoCantidad(anterior.meta);
        document.getElementById("año-ingresoAnterior").textContent = formatoCantidad(anterior.ingreso);
        document.getElementById("año-porcentajeAnterior").textContent = anterior.porcentaje;
        document.getElementById("año-diferenciaAnterior").textContent = formatoCantidad(anterior.diferencia);
        document.getElementById("año-averageAnterior").textContent = formatoCantidad(anterior.promedio);
        document.getElementById("año-weightedAnterior").textContent = formatoCantidad(anterior.ponderado);
        document.getElementById("año-desvestAnterior").textContent = formatoCantidad(anterior.desvest);
        document.getElementById("año-maxAnterior").textContent = formatoCantidad(anterior.max);
    }
}

// ================== FUNCIONES DE CAPTURA Y COMPARTIR ==================

/**
 * Captura y descarga las tarjetas como imagen
 */
async function captureAndDownloadCards() {
    try {
        const captureBtn = document.getElementById('captureBtn');
        const originalHtml = captureBtn.innerHTML;
        captureBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        captureBtn.disabled = true;

        // 1. Abrir todas las tarjetas
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

/**
 * Genera el mensaje para WhatsApp
 * @param {string} imageUrl - URL de la imagen (opcional)
 * @returns {string} Mensaje formateado
 */
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

    // Construir el mensaje base
    let mensaje = `¡Bendiciones para todos!

Adjunto el Cierre de Ingresos del Día:
\`${diaNombre}, ${diaNumero} de ${mesNombre} del ${año}\`

*${formatoCantidad(diaData.ingreso)}* unidades | Cumplimiento *${diaData.porcentaje}*
Meta: *${formatoCantidad(diaData.meta)}* ${comparativoAnterior}

Muestra Semanal (S${semanaActual}/S${semanaAnterior}) Gestión ${flechaGestion} *${diaData.gestion || 'N/A'}*
* Promedio: *${formatoCantidad(diaData.promedio)}*
* Ponderado: *${formatoCantidad(diaData.ponderado)}*
* Desviación: *${formatoCantidad(diaData.desvest)}*
* Máximo: *${formatoCantidad(diaData.max)}*`;

    // Agregar enlaces
    mensaje += `\n\nEnlaces importantes:
📊 Reporte detallado: https://andres1-dev.github.io/one/ingresos/informe/generar`;

    if (imageUrl) {
        mensaje += `\n📷 Resumen visual: ${imageUrl}`;
    }

    // Cierre del mensaje
    mensaje += `\n\nQuedo atento a sus comentarios.`;

    return encodeURIComponent(mensaje);
}

/**
 * Abre WhatsApp con el mensaje generado
 * @param {string} message - Mensaje codificado
 */
function openWhatsApp(message) {
    const phoneNumber = "573168007979";
    const url = `https://wa.me/${phoneNumber}?text=${message}`;
    
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    
    const event = document.createEvent('MouseEvents');
    event.initEvent('click', true, true);
    anchor.dispatchEvent(event);
    
    setTimeout(() => {
        window.location.href = url;
    }, 500);
}

// ================== FUNCIONES DE INICIALIZACIÓN ==================

/**
 * Inicializa el selector de fecha
 */
function initDatePicker() {
    const datePicker = document.getElementById('datePicker');
    const updateBtn = document.getElementById('updateReportBtn');
    
    const today = new Date();
    datePicker.valueAsDate = today;
    
    datePicker.addEventListener('change', () => {
        const selectedDate = datePicker.valueAsDate;
        if (selectedDate && currentReportData) {
            generarReporteCompleto(selectedDate)
                .then(reporte => {
                    currentReportData = reporte;
                    cargarDatosDia();
                    cargarDatosMes();
                    cargarDatosAño();
                })
                .catch(error => console.error("Error al generar reporte:", error));
        }
    });
    
    updateBtn.addEventListener('click', () => {
        const selectedDate = datePicker.valueAsDate || new Date();
        updateReportWithDate(selectedDate, true);
    });
}

/**
 * Inicializa el botón de captura
 */
function initCaptureButton() {
    const captureBtn = document.getElementById('captureBtn');
    if (captureBtn) {
        captureBtn.addEventListener('click', function(e) {
            if (!checkPassword()) {
                e.preventDefault();
                return false;
            }
            captureAndDownloadCards();
        });
    }
}

/**
 * Inicializa el botón de WhatsApp
 */
function initWhatsAppButton() {
    const whatsappBtn = document.getElementById('whatsappBtn');
    if (whatsappBtn) {
        whatsappBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            if (!checkPassword()) {
                return false;
            }
            
            const icon = whatsappBtn.querySelector('i');
            const originalIconClass = icon.className;
            icon.className = 'fas fa-spinner fa-spin';
            
            captureAndDownloadCards().finally(() => {
                icon.className = originalIconClass;
            });
        });
    }
}

/**
 * Verifica la contraseña
 * @returns {boolean} True si la contraseña es correcta
 */
function checkPassword() {
    const password = prompt("Ingrese la contraseña para enviar el informe:");
    if (password === "one") {
        return true;
    } else {
        alert("Contraseña incorrecta");
        return false;
    }
}

// ================== INICIALIZACIÓN DE LA APLICACIÓN ==================

document.addEventListener('DOMContentLoaded', async function() {
    initDatePicker();
    initCaptureButton();
    initWhatsAppButton();
    
    try {
        const today = new Date();
        await updateReportWithDate(today, true);
        
        document.querySelectorAll('.comparison-content').forEach(content => {
            content.classList.remove('expanded');
        });
    } catch (error) {
        console.error("Error al cargar el reporte inicial:", error);
        alert("Error al cargar los datos iniciales. Por favor recargue la página.");
    }
});

// ================== FUNCIONES AUXILIARES ==================

/**
 * Obtiene el número de semana para una fecha
 * @param {Date} date - Fecha a evaluar
 * @returns {number} Número de semana
 */
function getWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

/**
 * Parsea una fecha en formato string a objeto Date
 * @param {string} dateStr - Fecha en formato string
 * @returns {Date} Objeto Date
 */
function parseDate(dateStr) {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;
    if (dateStr.includes('/')) {
        const [day, month, year] = dateStr.split('/');
        return new Date(`${year}-${month}-${day}T00:00:00-05:00`);
    }
    if (dateStr.includes('-')) {
        return new Date(`${dateStr}T00:00:00-05:00`);
    }
    console.error(`Formato de fecha no reconocido: ${dateStr}`);
    return null;
}
