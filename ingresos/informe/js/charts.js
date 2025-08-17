// ================== VARIABLES GLOBALES ==================
let tendenciaChart = null;
let comparativaChart = null;
let historicoChart = null;

// ================== FUNCIONES PRINCIPALES ==================

/**
 * Carga los datos de tendencia en la interfaz y genera el gráfico
 */
function cargarDatosTendencia() {
    if (!currentReportData) return;
    
    const data = currentReportData.mes;
    const actual = data.actual;
    const anterior = data.anterior;
    
    // Actualizar información básica
    document.getElementById("tendencia-mes").textContent = `${actual.mes}`;
    
    // Calcular tendencia actual (comparación con mes anterior)
    if (anterior) {
        const crecimiento = calculateGrowthValue(actual.ingreso, anterior.ingreso);
        const tendenciaEl = document.getElementById("tendencia-actual");
        tendenciaEl.textContent = crecimiento.value;
        tendenciaEl.className = "data-value " + crecimiento.tendencia;
    }
    
    // Calcular proyección mensual
    const fechaActual = parseDate(currentReportData.filtros.actual);
    const diaDelMes = fechaActual.getDate();
    const diasEnMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1, 0).getDate();
    const proporcionMes = diaDelMes / diasEnMes;
    
    let proyeccion = "N/A";
    if (proporcionMes > 0) {
        const valorProyectado = Math.round(actual.ingreso / proporcionMes);
        const diferenciaProyectada = valorProyectado - actual.meta;
        const porcentajeProyectado = (diferenciaProyectada / actual.meta * 100).toFixed(1);
        
        proyeccion = `${formatoCantidad(valorProyectado)} (${porcentajeProyectado >= 0 ? '+' : ''}${porcentajeProyectado}%)`;
        
        const proyeccionEl = document.getElementById("tendencia-proyeccion");
        proyeccionEl.textContent = proyeccion;
        proyeccionEl.className = "data-value " + (diferenciaProyectada >= 0 ? "positive" : "negative");
    }
    
    // Crecimiento interanual
    if (anterior) {
        const crecimiento = calculateGrowthValue(actual.ingreso, anterior.ingreso);
        const crecimientoEl = document.getElementById("tendencia-crecimiento");
        crecimientoEl.textContent = crecimiento.value;
        crecimientoEl.className = "data-value " + crecimiento.tendencia;
    }
    
    // Generar gráfico
    generarGraficoTendencia(actual.año, actual.mes);
}

/**
 * Genera el gráfico de tendencia anual
 * @param {number} año - Año actual
 * @param {string} mesActual - Mes actual
 */
function generarGraficoTendencia(año, mesActual) {
    // Filtrar datos para el año actual y el anterior
    const datosActuales = consolidatedData.filter(d => d.Año === año);
    const datosAnteriores = consolidatedData.filter(d => d.Año === año - 1);
    
    // Agrupar por mes
    const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 
                  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    
    // Preparar datos para el gráfico
    const labels = [];
    const dataActual = [];
    const dataAnterior = [];
    
    // Llenar con ceros para meses sin datos
    meses.forEach((mes, index) => {
        labels.push(mes.substring(0, 3));
        
        // Datos año actual
        const mesData = datosActuales.filter(d => d.Mes === mes);
        const totalMes = mesData.reduce((sum, d) => sum + d.Ingreso, 0);
        dataActual.push(totalMes);
        
        // Datos año anterior
        const mesDataAnt = datosAnteriores.filter(d => d.Mes === mes);
        const totalMesAnt = mesDataAnt.reduce((sum, d) => sum + d.Ingreso, 0);
        dataAnterior.push(totalMesAnt);
    });
    
    // Obtener contexto del canvas
    const ctx = document.getElementById('tendenciaChart').getContext('2d');
    
    // Destruir gráfico anterior si existe
    if (tendenciaChart) {
        tendenciaChart.destroy();
    }
    
    // Crear nuevo gráfico
    tendenciaChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: `${año - 1}`,
                    data: dataAnterior,
                    borderColor: '#95a5a6',
                    backgroundColor: 'rgba(149, 165, 166, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 4,
                    pointBackgroundColor: '#95a5a6'
                },
                {
                    label: `${año}`,
                    data: dataActual,
                    borderColor: '#9b59b6',
                    backgroundColor: 'rgba(155, 89, 182, 0.1)',
                    borderWidth: 3,
                    tension: 0.3,
                    pointRadius: 5,
                    pointBackgroundColor: '#9b59b6',
                    pointHoverRadius: 7
                }
            ]
        },
        options: getTrendChartOptions()
    });
    
    // Calcular estadísticas detalladas
    calcularEstadisticasTendencia(año, mesActual);
}

/**
 * Genera el gráfico de comparativa por líneas
 */
function generarGraficoComparativa() {
    if (!currentReportData) return;
    
    const fechaActual = parseDate(currentReportData.filtros.actual);
    const mesActual = getNombreMes(formatDate(fechaActual));
    const añoActual = fechaActual.getFullYear();
    
    // Filtrar datos del mes actual
    const datosMes = consolidatedData.filter(d => 
        d.Mes === mesActual && d.Año === añoActual
    );
    
    // Agrupar por línea
    const lineasData = {};
    datosMes.forEach(dia => {
        dia.Lineas.forEach(linea => {
            if (!lineasData[linea.nombre]) {
                lineasData[linea.nombre] = 0;
            }
            lineasData[linea.nombre] += linea.unidades;
        });
    });
    
    // Convertir a arrays y ordenar
    const lineasArray = Object.entries(lineasData)
        .map(([nombre, unidades]) => ({ nombre, unidades }))
        .sort((a, b) => b.unidades - a.unidades);
    
    // Tomar las 10 principales
    const topLineas = lineasArray.slice(0, 10);
    
    // Configurar colores
    const backgroundColors = [
        'rgba(67, 97, 238, 0.7)',
        'rgba(46, 204, 113, 0.7)',
        'rgba(155, 89, 182, 0.7)',
        'rgba(52, 152, 219, 0.7)',
        'rgba(241, 196, 15, 0.7)',
        'rgba(230, 126, 34, 0.7)',
        'rgba(231, 76, 60, 0.7)',
        'rgba(149, 165, 166, 0.7)',
        'rgba(44, 62, 80, 0.7)',
        'rgba(243, 156, 18, 0.7)'
    ];
    
    // Obtener contexto
    const ctx = document.getElementById('comparativaChart').getContext('2d');
    
    // Destruir gráfico anterior si existe
    if (comparativaChart) {
        comparativaChart.destroy();
    }
    
    // Crear nuevo gráfico
    comparativaChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: topLineas.map(item => item.nombre),
            datasets: [{
                label: 'Unidades',
                data: topLineas.map(item => item.unidades),
                backgroundColor: backgroundColors,
                borderColor: backgroundColors.map(color => color.replace('0.7', '1')),
                borderWidth: 1
            }]
        },
        options: getComparisonChartOptions()
    });
}

/**
 * Genera el gráfico histórico de los últimos 12 meses
 */
function generarGraficoHistorico() {
    if (!currentReportData || consolidatedData.length === 0) return;
    
    const fechaActual = parseDate(currentReportData.filtros.actual);
    const meses = [];
    const data = [];
    
    // Obtener los últimos 12 meses
    for (let i = 11; i >= 0; i--) {
        const fecha = new Date(fechaActual);
        fecha.setMonth(fecha.getMonth() - i);
        
        const mes = getNombreMes(formatDate(fecha));
        const año = fecha.getFullYear();
        const mesKey = `${mes}-${año}`;
        
        // Sumar ingresos del mes
        const ingresosMes = consolidatedData
            .filter(d => d.Mes === mes && d.Año === año)
            .reduce((sum, d) => sum + d.Ingreso, 0);
        
        meses.push(`${mes.substring(0, 3)} ${año}`);
        data.push(ingresosMes);
    }
    
    // Obtener contexto
    const ctx = document.getElementById('historicoChart').getContext('2d');
    
    // Destruir gráfico anterior si existe
    if (historicoChart) {
        historicoChart.destroy();
    }
    
    // Crear nuevo gráfico
    historicoChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: meses,
            datasets: [{
                label: 'Ingresos Mensuales',
                data: data,
                backgroundColor: 'rgba(67, 97, 238, 0.7)',
                borderColor: 'rgba(67, 97, 238, 1)',
                borderWidth: 1
            }]
        },
        options: getHistoryChartOptions()
    });
}

// ================== FUNCIONES AUXILIARES ==================

/**
 * Calcula estadísticas de tendencia
 * @param {number} año - Año actual
 * @param {string} mesActual - Mes actual
 */
function calcularEstadisticasTendencia(año, mesActual) {
    const datosActuales = consolidatedData.filter(d => d.Año === año);
    const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 
                  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    
    // Calcular promedios y valores extremos
    const ingresosPorMes = meses.map(mes => {
        const mesData = datosActuales.filter(d => d.Mes === mes);
        return mesData.reduce((sum, d) => sum + d.Ingreso, 0);
    });
    
    // Promedio de últimos 3 meses
    const mesIndex = meses.indexOf(mesActual);
    const ultimos3Meses = ingresosPorMes.slice(Math.max(0, mesIndex - 2), mesIndex + 1);
    const promedio3Meses = ultimos3Meses.reduce((a, b) => a + b, 0) / ultimos3Meses.length;
    
    // Mejor y peor mes
    const maxIngreso = Math.max(...ingresosPorMes);
    const minIngreso = Math.min(...ingresosPorMes);
    const mejorMes = meses[ingresosPorMes.indexOf(maxIngreso)];
    const peorMes = meses[ingresosPorMes.indexOf(minIngreso)];
    
    // Variabilidad (coeficiente de variación)
    const promedio = ingresosPorMes.reduce((a, b) => a + b, 0) / ingresosPorMes.length;
    const desviacion = Math.sqrt(ingresosPorMes.reduce((a, b) => a + Math.pow(b - promedio, 2), 0) / ingresosPorMes.length);
    const variabilidad = (desviacion / promedio * 100).toFixed(1) + '%';
    
    // Actualizar UI
    document.getElementById("tendencia-promedio-3m").textContent = formatoCantidad(Math.round(promedio3Meses));
    document.getElementById("tendencia-mejor-mes").textContent = `${mejorMes}: ${formatoCantidad(maxIngreso)}`;
    document.getElementById("tendencia-peor-mes").textContent = `${peorMes}: ${formatoCantidad(minIngreso)}`;
    document.getElementById("tendencia-variabilidad").textContent = variabilidad;
}

/**
 * Calcula el valor de crecimiento comparativo
 * @param {number} current - Valor actual
 * @param {number} previous - Valor anterior
 * @returns {Object} Objeto con valor y tendencia
 */
function calculateGrowthValue(current, previous) {
    if (!previous || previous === 0) return { value: "N/A", tendencia: "" };
    
    const growth = ((current / previous) - 1) * 100;
    const absGrowth = Math.abs(growth);
    let tendencia;
    
    if (absGrowth < 5) {
        tendencia = "neutral";
    } else if (growth > 0) {
        tendencia = "positive";
    } else {
        tendencia = "negative";
    }
    
    return {
        value: growth.toFixed(1) + "%",
        tendencia: tendencia
    };
}

// ================== CONFIGURACIONES DE GRÁFICOS ==================

/**
 * Obtiene las opciones para el gráfico de tendencia
 * @returns {Object} Opciones de configuración
 */
function getTrendChartOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    font: {
                        family: "'Inter', sans-serif",
                        size: 12
                    },
                    padding: 20
                }
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        return `${context.dataset.label}: ${formatoCantidad(context.raw)}`;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: function(value) {
                        return formatoCantidad(value);
                    }
                },
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)'
                }
            },
            x: {
                grid: {
                    display: false
                }
            }
        },
        interaction: {
            intersect: false,
            mode: 'index'
        }
    };
}

/**
 * Obtiene las opciones para el gráfico de comparación
 * @returns {Object} Opciones de configuración
 */
function getComparisonChartOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        return `Unidades: ${formatoCantidad(context.raw)}`;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: function(value) {
                        return formatoCantidad(value);
                    }
                },
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)'
                }
            },
            x: {
                grid: {
                    display: false
                }
            }
        }
    };
}

/**
 * Obtiene las opciones para el gráfico histórico
 * @returns {Object} Opciones de configuración
 */
function getHistoryChartOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        return `Ingresos: ${formatoCantidad(context.raw)}`;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: function(value) {
                        return formatoCantidad(value);
                    }
                },
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)'
                }
            },
            x: {
                grid: {
                    display: false
                }
            }
        }
    };
}

// ================== INICIALIZACIÓN ==================

/**
 * Inicializa todos los gráficos
 */
function initCharts() {
    if (document.getElementById('tendenciaChart')) {
        generarGraficoTendencia(new Date().getFullYear(), getNombreMes(formatDate(new Date())));
    }
    
    if (document.getElementById('comparativaChart')) {
        generarGraficoComparativa();
    }
    
    if (document.getElementById('historicoChart')) {
        generarGraficoHistorico();
    }
}

// Inicializar gráficos cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initCharts);
