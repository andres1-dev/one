async function generarReporteCompleto(targetDate = new Date()) {
    try {
        // 1. Cargar datos si no están en memoria
        if (consolidatedData.length === 0 || budgetData.length === 0) {
            await cargarDatosIniciales();
        }

        // 2. Validar y formatear fecha
        const fechaObj = parseDate(targetDate);
        if (!fechaObj) {
            throw new Error("Fecha no válida");
        }

        // 3. Buscar fecha actual más cercana con datos
        const currentYear = fechaObj.getFullYear();
        const currentResult = findClosestDateWithData(fechaObj, currentYear, consolidatedData);
        
        if (!currentResult) {
            throw new Error("No hay datos disponibles para el año actual");
        }

        // 4. Obtener fecha equivalente en el año anterior
        let previousResult = null;
        const previousYear = currentYear - 1;
        const previousDate = new Date(fechaObj);
        previousDate.setFullYear(previousYear);
        
        if (consolidatedData.some(d => d.Año === previousYear)) {
            previousResult = findClosestDateWithData(previousDate, previousYear, consolidatedData);
        }

        // 5. Generar reporte (manteniendo estructura original)
        const report = {
            filtros: {
                actual: formatDate(currentResult.date),
                anterior: previousResult ? formatDate(previousResult.date) : null,
                isExact: currentResult.isExact,
                previousIsExact: previousResult ? previousResult.isExact : false
            },
            dia: {
                actual: generateDayMetrics(currentResult.data, currentResult.date, consolidatedData, false),
                anterior: previousResult ? generateDayMetrics(
                    previousResult.data, 
                    previousResult.date, 
                    consolidatedData, 
                    true,
                    currentResult.date
                ) : null
            },
            mes: {
                actual: generatePeriodMetrics('mes', currentResult.date, consolidatedData, false),
                anterior: previousResult ? generatePeriodMetrics(
                    'mes', 
                    previousResult.date, 
                    consolidatedData, 
                    true, 
                    currentResult.date
                ) : null
            },
            año: {
                actual: generatePeriodMetrics('año', currentResult.date, consolidatedData, false),
                anterior: previousResult ? generatePeriodMetrics(
                    'año', 
                    previousResult.date, 
                    consolidatedData, 
                    true, 
                    currentResult.date
                ) : null
            },
            // Mantener datos para tendencias y gestión anual
            tendencias: getTrendsData(currentYear, previousYear, consolidatedData)
        };

        // Calcular gestiones anuales
        if (report.dia.anterior) {
            report.dia.actual.gestion = calculateGrowth(
                report.dia.actual.porcentaje,
                report.dia.anterior.porcentaje
            );
        }
        if (report.mes.anterior) {
            report.mes.actual.gestion = calculateGrowth(
                report.mes.actual.porcentaje,
                report.mes.anterior.porcentaje
            );
        }
        if (report.año.anterior) {
            report.año.actual.gestion = calculateGrowth(
                report.año.actual.porcentaje,
                report.año.anterior.porcentaje
            );
        }

        return report;

    } catch (error) {
        console.error("Error en generarReporteCompleto:", error);
        throw error;
    }
}




function generateDayMetrics(dayData, date, fullYearData, isFromPreviousYear = false, currentAnalysisDate = null) {
    let weekData, previousWeekData;
    
    if (isFromPreviousYear && currentAnalysisDate) {
        const limitDate = new Date(currentAnalysisDate);
        limitDate.setFullYear(date.getFullYear());
        weekData = getWeekData(date, fullYearData, formatDate(limitDate));
        previousWeekData = getPreviousWeekData(date, fullYearData, formatDate(limitDate));
    } else {
        weekData = getWeekData(date, fullYearData);
        previousWeekData = getPreviousWeekData(date, fullYearData);
    }
    
    return {
        medicion: "dia",
        fecha: dayData.Fecha,
        registros: 1,
        meta: dayData.Meta,
        ingreso: dayData.Ingreso,
        diferencia: dayData.Diferencia,
        porcentaje: dayData.Cumplimiento,
        gestion: null,
        n_semana: dayData.Semana,
        dia_letras: dayData.Dia,
        mes: dayData.Mes,
        año: dayData.Año,
        promedio: calculateAverage([...weekData, ...previousWeekData]),
        ponderado: calculateWeightedAvg([...weekData, ...previousWeekData]),
        desvest: calculateStdDev([...weekData, ...previousWeekData]),
        max: findMax([...weekData, ...previousWeekData])
    };
}

function generatePeriodMetrics(type, date, fullYearData, isFromPreviousYear = false, currentAnalysisDate = null) {
    const monthName = getNombreMes(formatDate(date));
    const year = date.getFullYear();
    
    let periodData = type === 'mes' 
        ? fullYearData.filter(d => d.Mes === monthName && d.Año === year)
        : fullYearData.filter(d => d.Año === year);

    if (isFromPreviousYear && currentAnalysisDate) {
        const limitDate = new Date(currentAnalysisDate);
        limitDate.setFullYear(year);
        const limitDateStr = formatDate(limitDate);
        
        periodData = periodData.filter(d => {
            const dDate = parseDate(d.Fecha);
            return dDate && dDate <= parseDate(limitDateStr);
        });
    }

    const totalMeta = periodData.reduce((sum, d) => sum + d.Meta, 0);
    const totalIngreso = periodData.reduce((sum, d) => sum + d.Ingreso, 0);
    const diferencia = totalIngreso - totalMeta;
    const porcentaje = totalMeta > 0 ? ((totalIngreso / totalMeta) * 100).toFixed(2) + '%' : '0%';

    return {
        medicion: type,
        fecha: formatDate(date),
        registros: periodData.length,
        meta: Math.round(totalMeta),
        ingreso: Math.round(totalIngreso),
        diferencia: Math.round(diferencia),
        porcentaje: porcentaje,
        gestion: null,
        mes: monthName,
        año: year,
        promedio: calculateAverage(periodData),
        ponderado: calculateWeightedAvg(periodData),
        desvest: calculateStdDev(periodData),
        max: findMax(periodData)
    };
}

function getWeekData(date, data, limitDate = null) {
    const targetWeek = getWeekNumber(date);
    const targetYear = date.getFullYear();
    
    let weekData = data.filter(d => {
        const dDate = parseDate(d.Fecha);
        return dDate && getWeekNumber(dDate) === targetWeek && d.Año === targetYear;
    });
    
    if (limitDate) {
        const limitTime = parseDate(limitDate).getTime();
        weekData = weekData.filter(d => {
            const dDate = parseDate(d.Fecha);
            return dDate && dDate.getTime() <= limitTime;
        });
    }
    
    return weekData;
}

function getPreviousWeekData(date, data, limitDate = null) {
    const targetWeek = getWeekNumber(date) - 1;
    const targetYear = date.getFullYear();
    
    let weekData;
    
    if (targetWeek < 1) {
        weekData = data.filter(d => {
            const dDate = parseDate(d.Fecha);
            return dDate && getWeekNumber(dDate) === 52 && d.Año === targetYear - 1;
        });
    } else {
        weekData = data.filter(d => {
            const dDate = parseDate(d.Fecha);
            return dDate && getWeekNumber(dDate) === targetWeek && d.Año === targetYear;
        });
    }
    
    if (limitDate) {
        const limitTime = parseDate(limitDate).getTime();
        weekData = weekData.filter(d => {
            const dDate = parseDate(d.Fecha);
            return dDate && dDate.getTime() <= limitTime;
        });
    }
    
    return weekData;
}

// Cargar datos iniciales
document.addEventListener('DOMContentLoaded', async function() {
    // Inicializar selector de fecha y botones
    initDatePicker();
    initCaptureButton();
    
    try {
        // Cargar reporte inicial con fecha actual
        const today = new Date();
        await updateReportWithDate(today, true); // forceReload = true para la carga inicial
        
        // Colapsar todos los comparativos al inicio
        document.querySelectorAll('.comparison-content').forEach(content => {
            content.classList.remove('expanded');
        });
    } catch (error) {
        console.error("Error al cargar el reporte inicial:", error);
        alert("Error al cargar los datos iniciales. Por favor recargue la página.");
    }
});


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

// Función para inicializar el botón de captura
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

// Función separada para la captura real
function initCaptureButton() {
    const captureBtn = document.getElementById('captureBtn');
    if (captureBtn) {
        captureBtn.addEventListener('click', captureAndDownloadCards);
    }
}


function getTrendsData(currentYear, previousYear, data) {
    const currentYearData = data.filter(d => d.Año === currentYear);
    const previousYearData = data.filter(d => d.Año === previousYear);
    
    const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 
                 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    
    return {
        meses: meses,
        actual: meses.reduce((acc, mes) => {
            acc[mes] = currentYearData
                .filter(d => d.Mes === mes)
                .reduce((sum, d) => sum + d.Ingreso, 0);
            return acc;
        }, {}),
        anterior: meses.reduce((acc, mes) => {
            acc[mes] = previousYearData
                .filter(d => d.Mes === mes)
                .reduce((sum, d) => sum + d.Ingreso, 0);
            return acc;
        }, {})
    };
}
