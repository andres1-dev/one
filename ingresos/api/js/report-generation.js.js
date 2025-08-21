// ================== FUNCIONES DE GENERACIÓN DE REPORTE ==================

/**
 * Función principal que genera el reporte completo
 * @param {Date|string} [targetDate] - Fecha objetivo (opcional, por defecto fecha actual)
 * @returns {Promise<Object>} Objeto JSON con el reporte completo
 */
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

// Función auxiliar para mantener datos de tendencias
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

// ================== FUNCIONES DE MÉTRICAS ==================

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

// ================== FUNCIONES DE CARGA DE DATOS ==================

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
    
    // Gestión - CORRECCIÓN COMPLETA AQUÍ
    const gestEl = document.getElementById("dia-gestion");
    const trendIcon = document.getElementById("dia-trendIcon");
    
    if (actual.gestion) {
        // CORRECCIÓN: Extraer el valor numérico completo (incluyendo signo negativo)
        const gestionValue = parseFloat(actual.gestion);
        
        gestEl.textContent = actual.gestion;
        
        // CORRECCIÓN: Usar el valor completo con signo
        if (gestionValue > 5) {
            gestEl.className = "positive";
            trendIcon.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
            trendIcon.style.color = "var(--success-color)";
        } else if (gestionValue < -5) {
            gestEl.className = "negative";  // Ahora usa clase negative
            trendIcon.innerHTML = '<i class="fa-solid fa-arrow-down"></i>';  // Flecha hacia abajo
            trendIcon.style.color = "var(--danger-color)";  // Color rojo
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
    
    // Gestión - CORRECCIÓN COMPLETA AQUÍ
    const gestEl = document.getElementById("mes-gestion");
    const trendIcon = document.getElementById("mes-trendIcon");
    
    if (actual.gestion) {
        // CORRECCIÓN: Extraer el valor numérico completo (incluyendo signo negativo)
        const gestionValue = parseFloat(actual.gestion);
        
        gestEl.textContent = actual.gestion;
        
        // CORRECCIÓN: Usar el valor completo con signo
        if (gestionValue > 5) {
            gestEl.className = "positive";
            trendIcon.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
            trendIcon.style.color = "var(--success-color)";
        } else if (gestionValue < -5) {
            gestEl.className = "negative";  // Ahora usa clase negative
            trendIcon.innerHTML = '<i class="fa-solid fa-arrow-down"></i>';  // Flecha hacia abajo
            trendIcon.style.color = "var(--danger-color)";  // Color rojo
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
    
    // Gestión - CORRECCIÓN COMPLETA AQUÍ
    const gestEl = document.getElementById("año-gestion");
    const trendIcon = document.getElementById("año-trendIcon");
    
    if (actual.gestion) {
        // CORRECCIÓN: Extraer el valor numérico completo (incluyendo signo negativo)
        const gestionValue = parseFloat(actual.gestion);
        
        gestEl.textContent = actual.gestion;
        
        // CORRECCIÓN: Usar el valor completo con signo
        if (gestionValue > 5) {
            gestEl.className = "positive";
            trendIcon.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
            trendIcon.style.color = "var(--success-color)";
        } else if (gestionValue < -5) {
            gestEl.className = "negative";  // Ahora usa clase negative
            trendIcon.innerHTML = '<i class="fa-solid fa-arrow-down"></i>';  // Flecha hacia abajo
            trendIcon.style.color = "var(--danger-color)";  // Color rojo
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