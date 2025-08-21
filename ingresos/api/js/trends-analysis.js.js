// ================== FUNCIONES DE ANÁLISIS DE TENDENCIAS ==================

// Función optimizada para cargar datos de tendencia DIARIA
function cargarDatosTendencia() {
    if (!currentReportData) return;
    
    const data = currentReportData.mes;
    const actual = data.actual;
    const anterior = data.anterior;
    
    // 1. Actualizar información básica
    document.getElementById("tendencia-mes").textContent = `${actual.mes} ${actual.año}`;
    
    // 2. Realizar análisis diario
    const analisisDiario = analizarTendenciaDiaria(actual.año, actual.mes);
    
    if (!analisisDiario) {
        console.error("No se pudieron analizar los datos diarios");
        return;
    }
    
    // 3. Actualizar UI con análisis diario
    actualizarTendenciaUI(analisisDiario, actual, anterior);
    
    // 4. Generar gráfico con datos diarios
    generarGraficoTendenciaDiaria(analisisDiario, actual.año, actual.mes);
    
    // 5. Calcular estadísticas detalladas
    calcularEstadisticasTendenciaDiaria(analisisDiario, actual.año, actual.mes, actual);
}

// Función para calcular estadísticas de tendencia DIARIA
function calcularEstadisticasTendenciaDiaria(analisisDiario, año, mesActual, actual) {
    const { datosDiarios, patronesSemanales, diasDestacados, proyeccion } = analisisDiario;
    
    // Calcular métricas básicas
    const ingresos = datosDiarios.map(d => d.Ingreso);
    const promedio = Math.round(ingresos.reduce((a, b) => a + b, 0) / ingresos.length);
    const maxIngreso = Math.max(...ingresos);
    const minIngreso = Math.min(...ingresos);
    
    // Encontrar mejor y peor día
    const mejorDia = datosDiarios.find(d => d.Ingreso === maxIngreso);
    const peorDia = datosDiarios.find(d => d.Ingreso === minIngreso);
    
    // Calcular variabilidad (coeficiente de variación)
    const desviacion = calcularDesviacionEstandar(ingresos);
    const variabilidad = ((desviacion / promedio) * 100).toFixed(1) + '%';
    
    // Actualizar UI
    document.getElementById("tendencia-promedio-3m").textContent = formatoCantidad(promedio);
    
    if (mejorDia) {
        document.getElementById("tendencia-mejor-mes").textContent = `${mejorDia.Fecha}: ${formatoCantidad(maxIngreso)}`;
    }
    
    if (peorDia) {
        document.getElementById("tendencia-peor-mes").textContent = `${peorDia.Fecha}: ${formatoCantidad(minIngreso)}`;
    }
    
    document.getElementById("tendencia-variabilidad").textContent = variabilidad;
    
    // Actualizar información de proyección si existe
    if (proyeccion) {
        const proyeccionItem = document.createElement('div');
        proyeccionItem.className = 'comparison-item';
        proyeccionItem.innerHTML = `
            <div class="comparison-label">
                <i class="fas fa-project-diagram"></i> Proyección mensual
            </div>
            <div class="comparison-value">${formatoCantidad(proyeccion.proyeccionConservadora)}</div>
            <div class="comparison-description">Basada en tendencia y patrones</div>
        `;
        
        // Asegurarse de que el contenedor existe antes de agregar
        const comparisonGrid = document.querySelector('.comparison-grid');
        if (comparisonGrid) {
            comparisonGrid.appendChild(proyeccionItem);
        }
    }
    
    // Calcular tendencia del promedio y agregar al cálculo global
    if (actual && actual.meta) {
        const tendenciaPromedio = promedio > (actual.meta / 30) ? 'positive' : 'negative';
        tendenciaValues.push(tendenciaPromedio);
    }
    
    // Finalmente determinar la tendencia global con todos los datos
    determinarTendenciaGlobal();
}

// Actualizar la UI con los resultados del análisis diario
function actualizarTendenciaUI(analisisDiario, actual, anterior) {
    const { proyeccion, patronesSemanales } = analisisDiario;
    
    // Actualizar tendencia actual (comparación con mes anterior)
    if (anterior) {
        const crecimiento = calculateGrowthValue(actual.ingreso, anterior.ingreso);
        const tendenciaEl = document.getElementById("tendencia-actual");
        tendenciaEl.textContent = crecimiento.value;
        tendenciaEl.className = "data-value " + crecimiento.tendencia;
        tendenciaValues.push(crecimiento.tendencia);
    }
    
    // Actualizar proyección mensual
    if (proyeccion) {
        const proyeccionEl = document.getElementById("tendencia-proyeccion");
        const diferencia = proyeccion.proyeccionConservadora - actual.meta;
        const porcentaje = ((diferencia / actual.meta) * 100).toFixed(1);
        
        proyeccionEl.textContent = `${formatoCantidad(proyeccion.proyeccionConservadora)} (${porcentaje >= 0 ? '+' : ''}${porcentaje}%)`;
        proyeccionEl.className = "data-value " + (diferencia >= 0 ? "positive" : "negative");
        
        updateResumenEjecutivo('proyeccion', {
            valor: proyeccion.proyeccionConservadora,
            meta: actual.meta,
            porcentaje: porcentaje,
            tendencia: diferencia >= 0 ? "positive" : "negative"
        });
    }
    
    // Actualizar crecimiento interanual
    if (anterior) {
        const crecimiento = calculateGrowthValue(actual.ingreso, anterior.ingreso);
        const crecimientoEl = document.getElementById("tendencia-crecimiento");
        crecimientoEl.textContent = crecimiento.value;
        crecimientoEl.className = "data-value " + crecimiento.tendencia;
        tendenciaValues.push(crecimiento.tendencia);
        
        updateResumenEjecutivo('interanual', {
            valor: crecimiento.value,
            tendencia: crecimiento.tendencia
        });
    }
    
    // Actualizar resumen con patrones semanales
    if (patronesSemanales && patronesSemanales.viernes) {
        const resumenEl = document.getElementById("tendencia-resumen-texto");
        const promedioViernes = patronesSemanales.viernes.promedio;
        const promedioGeneral = analisisDiario.datosDiarios.reduce((sum, d) => sum + d.Ingreso, 0) / analisisDiario.datosDiarios.length;
        const incrementoViernes = ((promedioViernes - promedioGeneral) / promedioGeneral * 100).toFixed(1);
        
        resumenEl.textContent = `Patrón detectado: Los viernes tienen un incremento del ${incrementoViernes}% respecto al promedio diario.`;
    }
}

// Función para actualizar el resumen ejecutivo
function updateResumenEjecutivo(tipo, datos) {
    const resumenEl = document.getElementById("tendencia-resumen-texto");
    
    switch(tipo) {
        case 'actual':
            resumenEl.textContent = `El mes actual muestra ${datos.tendencia === 'positive' ? 'un crecimiento' : 
                        datos.tendencia === 'negative' ? 'una disminución' : 'una estabilidad'} ` +
                        `de ${datos.comparativo} respecto al mes anterior.`;
            break;
        case 'proyeccion':
            const vsMeta = parseFloat(datos.porcentaje);
            resumenEl.textContent = `Proyección mensual: ${vsMeta >= 0 ? 'supera' : 'está por debajo de'} ` +
                        `la meta en un ${Math.abs(vsMeta)}%.`;
            break;
        case 'interanual':
            resumenEl.textContent = `En comparación anual, el crecimiento es ${datos.tendencia === 'positive' ? 'positivo' : 
                        datos.tendencia === 'negative' ? 'negativo' : 'neutral'} (${datos.valor}).`;
            break;
    }
    
    // Actualizar tendencia global después de cada actualización
    determinarTendenciaGlobal();
}

// Función para determinar la tendencia global
function determinarTendenciaGlobal() {
    if (!tendenciaValues || tendenciaValues.length === 0) {
        globalTrend = 'neutral';
        updateTrendIndicator();
        return;
    }
    
    // Contar ocurrencias de cada tendencia
    const counts = {
        positive: tendenciaValues.filter(t => t === 'positive').length,
        negative: tendenciaValues.filter(t => t === 'negative').length,
        neutral: tendenciaValues.filter(t => t === 'neutral').length
    };
    
    // Determinar tendencia predominante
    if (counts.positive > counts.negative && counts.positive > counts.neutral) {
        globalTrend = 'positive';
    } else if (counts.negative > counts.positive && counts.negative > counts.neutral) {
        globalTrend = 'negative';
    } else {
        globalTrend = 'neutral';
    }
    
    updateTrendIndicator();
}

// Función optimizada para generar el gráfico de tendencia DIARIA
function generarGraficoTendenciaDiaria(analisisDiario, año, mesActual) {
    const { datosDiarios, tendencia, promedioMovil } = analisisDiario;
    
    // Preparar datos para el gráfico
    const labels = datosDiarios.map(d => {
        const fecha = parseDate(d.Fecha);
        return `${fecha.getDate()}/${fecha.getMonth() + 1}`;
    });
    
    const dataActual = datosDiarios.map(d => d.Ingreso);
    
    // Obtener contexto del canvas
    const ctx = document.getElementById('tendenciaChart').getContext('2d');
    
    // Destruir gráfico anterior si existe
    if (tendenciaChart) {
        tendenciaChart.destroy();
    }
    
    // Determinar colores para puntos destacados (viernes)
    const pointBackgroundColors = datosDiarios.map(d => {
        const fecha = parseDate(d.Fecha);
        return fecha.getDay() === 5 ? '#e74c3c' : '#9b59b6'; // Destacar viernes
    });
    
    // Crear nuevo gráfico con datos diarios
    tendenciaChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Ingresos diarios',
                    data: dataActual,
                    borderColor: '#4361ee',
                    backgroundColor: 'rgba(67, 97, 238, 0.1)',
                    borderWidth: 1,
                    tension: 0.1,
                    pointBackgroundColor: pointBackgroundColors,
                    pointRadius: 4,
                    fill: true
                },
                {
                    label: 'Promedio móvil (7 días)',
                    data: promedioMovil,
                    borderColor: '#f39c12',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.4,
                    pointRadius: 0,
                    borderDash: [5, 5],
                    fill: false
                },
                {
                    label: 'Tendencia lineal',
                    data: tendencia,
                    borderColor: '#2ecc71',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0,
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += formatoCantidad(context.parsed.y);
                            }
                            return label;
                        },
                        afterLabel: function(context) {
                            if (context.datasetIndex === 0) {
                                const index = context.dataIndex;
                                const dia = datosDiarios[index].Dia;
                                return `Día: ${dia}`;
                            }
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
        }
    });
}

// ================== FUNCIONES DE ANÁLISIS DIARIO ==================

function analizarTendenciaDiaria(año, mes) {
    if (!consolidatedData || consolidatedData.length === 0) return null;
    
    // Obtener datos del mes específico
    const datosMensuales = consolidatedData.filter(d => 
        d.Año === año && d.Mes === mes
    );
    
    if (datosMensuales.length === 0) return null;
    
    // Ordenar por fecha
    datosMensuales.sort((a, b) => parseDate(a.Fecha) - parseDate(b.Fecha));
    
    // Calcular diferentes métricas
    const analisis = {
        datosDiarios: datosMensuales,
        tendencia: calcularTendenciaLineal(datosMensuales),
        promedioMovil: calcularPromedioMovil(datosMensuales, 7),
        patronesSemanales: analizarPatronesSemanales(datosMensuales),
        desviacionEstandar: calcularDesviacionEstandar(datosMensuales.map(d => d.Ingreso)),
        proyeccion: calcularProyeccionDiaria(datosMensuales),
        diasDestacados: identificarDiasDestacados(datosMensuales)
    };
    
    return analisis;
}

// Calcular tendencia lineal (regresión)
function calcularTendenciaLineal(datos) {
    if (!datos || datos.length < 2) return null;
    
    const n = datos.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    
    datos.forEach((d, i) => {
        sumX += i;
        sumY += d.Ingreso;
        sumXY += i * d.Ingreso;
        sumXX += i * i;
    });
    
    const pendiente = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercepto = (sumY - pendiente * sumX) / n;
    
    // Generar puntos de la línea de tendencia
    return datos.map((d, i) => Math.round(intercepto + pendiente * i));
}

// Calcular promedio móvil
function calcularPromedioMovil(datos, ventana = 7) {
    if (!datos || datos.length < ventana) return null;
    
    const promedios = [];
    
    for (let i = 0; i < datos.length; i++) {
        if (i < ventana - 1) {
            promedios.push(null); // No hay suficientes datos para el promedio
        } else {
            const ventanaDatos = datos.slice(i - ventana + 1, i + 1);
            const suma = ventanaDatos.reduce((total, d) => total + d.Ingreso, 0);
            promedios.push(Math.round(suma / ventana));
        }
    }
    
    return promedios;
}

// Analizar patrones por día de la semana
function analizarPatronesSemanales(datos) {
    const diasSemana = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const patrones = {};
    
    // Inicializar estructura
    diasSemana.forEach(dia => {
        patrones[dia] = {
            total: 0,
            count: 0,
            promedio: 0,
            dias: []
        };
    });
    
    // Agrupar por día de la semana
    datos.forEach(d => {
        const dia = d.Dia.toLowerCase();
        if (patrones[dia]) {
            patrones[dia].total += d.Ingreso;
            patrones[dia].count++;
            patrones[dia].dias.push({
                fecha: d.Fecha,
                ingreso: d.Ingreso
            });
        }
    });
    
    // Calcular promedios
    Object.keys(patrones).forEach(dia => {
        if (patrones[dia].count > 0) {
            patrones[dia].promedio = Math.round(patrones[dia].total / patrones[dia].count);
        }
    });
    
    return patrones;
}

// Calcular proyección basada en tendencia y patrones
function calcularProyeccionDiaria(datos) {
    if (!datos || datos.length < 5) return null;
    
    const ultimaFecha = parseDate(datos[datos.length - 1].Fecha);
    const diasEnMes = new Date(ultimaFecha.getFullYear(), ultimaFecha.getMonth() + 1, 0).getDate();
    const diasTranscurridos = datos.length;
    const diasRestantes = diasEnMes - diasTranscurridos;
    
    if (diasRestantes <= 0) return null;
    
    // Calcular diferentes métodos de proyección
    const ingresosAcumulados = datos.reduce((sum, d) => sum + d.Ingreso, 0);
    const promedioSimple = Math.round(ingresosAcumulados / diasTranscurridos);
    
    // Proyección basada en tendencia lineal
    const tendencia = calcularTendenciaLineal(datos);
    const ultimaTendencia = tendencia[tendencia.length - 1];
    const proyeccionTendencia = ultimaTendencia * diasEnMes;
    
    // Proyección basada en promedio móvil (últimos 7 días)
    const ultimos7Dias = datos.slice(-7);
    const promedioMovil = ultimos7Dias.reduce((sum, d) => sum + d.Ingreso, 0) / ultimos7Dias.length;
    const proyeccionMovil = Math.round(promedioMovil * diasEnMes);
    
    // Proyección considerando patrones semanales
    const patrones = analizarPatronesSemanales(datos);
    let proyeccionPatrones = 0;
    
    // Simular los días restantes aplicando patrones semanales
    for (let i = 0; i < diasRestantes; i++) {
        const fechaProyeccion = new Date(ultimaFecha);
        fechaProyeccion.setDate(ultimaFecha.getDate() + i + 1);
        
        const diaSemana = fechaProyeccion.getDay();
        const nombreDia = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][diaSemana];
        
        if (patrones[nombreDia] && patrones[nombreDia].count > 0) {
            proyeccionPatrones += patrones[nombreDia].promedio;
        } else {
            proyeccionPatrones += promedioSimple;
        }
    }
    
    proyeccionPatrones += ingresosAcumulados;
    
    return {
        diasTranscurridos,
        diasRestantes,
        ingresosAcumulados,
        promedioDiario: promedioSimple,
        proyeccionTendencia: Math.round(proyeccionTendencia),
        proyeccionMovil: Math.round(proyeccionMovil),
        proyeccionPatrones: Math.round(proyeccionPatrones),
        proyeccionConservadora: Math.round((proyeccionTendencia + proyeccionMovil + proyeccionPatrones) / 3)
    };
}

// Identificar días con comportamiento destacado (alto/bajo)
function identificarDiasDestacados(datos) {
    if (!datos || datos.length < 5) return [];
    
    const ingresos = datos.map(d => d.Ingreso);
    const promedio = ingresos.reduce((a, b) => a + b, 0) / ingresos.length;
    const desviacion = calcularDesviacionEstandar(ingresos);
    
    const diasDestacados = [];
    
    datos.forEach(d => {
        const zScore = (d.Ingreso - promedio) / desviacion;
        
        if (Math.abs(zScore) > 1.5) { // Más de 1.5 desviaciones estándar
            diasDestacados.push({
                fecha: d.Fecha,
                dia: d.Dia,
                ingreso: d.Ingreso,
                desviacion: zScore.toFixed(2),
                tipo: zScore > 0 ? 'pico' : 'valle'
            });
        }
    });
    
    return diasDestacados;
}

// Calcular desviación estándar
function calcularDesviacionEstandar(valores) {
    if (!valores || valores.length < 2) return 0;
    
    const n = valores.length;
    const media = valores.reduce((a, b) => a + b) / n;
    const sumaDiferencias = valores.reduce((sum, val) => sum + Math.pow(val - media, 2), 0);
    
    return Math.sqrt(sumaDiferencias / n);
}