// Sistema de Métricas de Rendimiento
let metricasGlobales = [];
let spiderChart = null;
let flatpickrMetricas = null;

// Constantes del sistema
const META_EFICIENCIA = 4.0;
const META_CAPACIDAD = 7920; // unidades por persona-día
const META_EFECTIVIDAD = 25; // documentos por persona
const JORNADA_MINUTOS = 528; // 8:48:00 en minutos
const JORNADA_SEGUNDOS = 31680; // 8:48:00 en segundos

// Inicializar el sistema de métricas
function inicializarSistemaMetricas() {
    console.log('Inicializando sistema de métricas...');
    
    // Inicializar flatpickr para métricas
    flatpickrMetricas = flatpickr("#filtroFechaMetricas", {
        mode: "range",
        locale: "es",
        dateFormat: "d/m/Y",
        allowInput: true,
        onChange: function(selectedDates, dateStr, instance) {
            if (selectedDates.length === 2) {
                console.log('Rango seleccionado para métricas:', selectedDates);
                actualizarMetricasRendimiento();
            } else if (selectedDates.length === 0) {
                limpiarFiltrosMetricas();
            }
        }
    });
    
    // Cargar lista de responsables
    cargarResponsablesParaMetricas();
    
    console.log('Sistema de métricas inicializado');
}

// Cargar responsables en el selector
async function cargarResponsablesParaMetricas() {
    try {
        const select = document.getElementById('selectResponsableMetricas');
        if (!select) return;
        
        // Limpiar opciones excepto la primera
        while (select.children.length > 1) {
            select.removeChild(select.lastChild);
        }
        
        // Obtener responsables únicos de documentos finalizados
        const responsablesUnicos = await obtenerResponsablesFinalizados();
        
        responsablesUnicos.forEach(responsable => {
            if (responsable && responsable.trim() !== '') {
                const option = document.createElement('option');
                option.value = responsable;
                option.textContent = responsable;
                select.appendChild(option);
            }
        });
        
        console.log('Responsables cargados para métricas:', responsablesUnicos.length);
    } catch (error) {
        console.error('Error cargando responsables para métricas:', error);
    }
}

// Obtener responsables únicos de documentos finalizados
async function obtenerResponsablesFinalizados() {
    try {
        const SPREADSHEET_ID = "1d5dCCCgiWXfM6vHu3zGGKlvK2EycJtT7Uk4JqUjDOfE";
        const API_KEY = 'AIzaSyC7hjbRc0TGLgImv8gVZg8tsOeYWgXlPcM';
        
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/DATA!A2:K?key=${API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        const values = data.values || [];
        
        const responsables = new Set();
        
        values.forEach(row => {
            const estado = String(row[3] || '').trim().toUpperCase();
            const colaborador = String(row[4] || '').trim();
            
            if (estado === 'FINALIZADO' && colaborador && colaborador.trim() !== '') {
                responsables.add(colaborador);
            }
        });
        
        return Array.from(responsables).sort();
    } catch (error) {
        console.error('Error obteniendo responsables finalizados:', error);
        return [];
    }
}

// Función principal para actualizar métricas
async function actualizarMetricasRendimiento() {
    try {
        console.log('Actualizando métricas de rendimiento...');
        
        // Mostrar loading
        mostrarLoadingMetricas();
        
        // Obtener parámetros de filtro
        const fechas = flatpickrMetricas.selectedDates;
        const responsableSeleccionado = document.getElementById('selectResponsableMetricas').value;
        
        if (!fechas || fechas.length !== 2) {
            await mostrarNotificacion('Información', 'Seleccione un rango de fechas para calcular las métricas', 'info');
            ocultarLoadingMetricas();
            return;
        }
        
        // Calcular métricas
        const metricas = await calcularMetricasRendimiento(fechas[0], fechas[1], responsableSeleccionado);
        metricasGlobales = metricas;
        
        // Actualizar interfaz
        actualizarResumenMetricas(metricas);
        actualizarTablaMetricas(metricas);
        actualizarTopSemanal(metricas);
        actualizarGraficoSpider(metricas, responsableSeleccionado);
        
        console.log('Métricas actualizadas correctamente');
        
    } catch (error) {
        console.error('Error actualizando métricas:', error);
        await mostrarNotificacion('Error', 'Error al calcular las métricas: ' + error.message, 'error');
    } finally {
        ocultarLoadingMetricas();
    }
}

// Calcular métricas de rendimiento
async function calcularMetricasRendimiento(fechaInicio, fechaFin, responsableFiltro = '') {
    try {
        console.log('Calculando métricas para rango:', fechaInicio, 'a', fechaFin, 'Responsable:', responsableFiltro);
        
        const SPREADSHEET_ID = "1d5dCCCgiWXfM6vHu3zGGKlvK2EycJtT7Uk4JqUjDOfE";
        const API_KEY = 'AIzaSyC7hjbRc0TGLgImv8gVZg8tsOeYWgXlPcM';
        
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/DATA!A2:K?key=${API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        const values = data.values || [];
        
        // Procesar documentos finalizados en el rango de fechas
        const documentosFinalizados = [];
        const metricasPorResponsable = {};
        
        for (const row of values) {
            const documento = String(row[0] || '').trim();
            const fechaHora = row[1] || '';
            const estado = String(row[3] || '').trim().toUpperCase();
            const colaborador = String(row[4] || '').trim();
            const datetime_fin = row[6] || '';
            const duracion_guardada = row[7] || '';
            
            // Filtrar solo documentos finalizados
            if (estado !== 'FINALIZADO' || !colaborador || colaborador.trim() === '') {
                continue;
            }
            
            // Filtrar por responsable si se especifica
            if (responsableFiltro && colaborador !== responsableFiltro) {
                continue;
            }
            
            // Obtener datos completos del documento
            const datosCompletos = datosGlobales.find(d => d.REC === documento);
            if (!datosCompletos) continue;
            
            const cantidad = parseInt(datosCompletos.CANTIDAD) || 0;
            if (cantidad <= 0) continue;
            
            // Calcular duración en segundos
            const duracionSegundos = tiempoASegundos(duracion_guardada);
            if (duracionSegundos <= 0) continue;
            
            // Calcular eficiencia (unidades por segundo)
            const eficiencia = cantidad / duracionSegundos;
            
            // Calcular capacidad proyectada (unidades por jornada)
            const capacidad = (cantidad / duracionSegundos) * JORNADA_SEGUNDOS;
            
            const documentoMetrica = {
                rec: documento,
                responsable: colaborador,
                cantidad: cantidad,
                duracionSegundos: duracionSegundos,
                duracionFormateada: duracion_guardada,
                eficiencia: eficiencia,
                capacidad: capacidad,
                fecha: fechaHora
            };
            
            documentosFinalizados.push(documentoMetrica);
            
            // Agrupar por responsable
            if (!metricasPorResponsable[colaborador]) {
                metricasPorResponsable[colaborador] = {
                    responsable: colaborador,
                    documentos: 0,
                    totalUnidades: 0,
                    totalTiempoSegundos: 0,
                    eficienciaPromedio: 0,
                    capacidadPromedio: 0,
                    documentosPorDia: 0
                };
            }
            
            metricasPorResponsable[colaborador].documentos++;
            metricasPorResponsable[colaborador].totalUnidades += cantidad;
            metricasPorResponsable[colaborador].totalTiempoSegundos += duracionSegundos;
        }
        
        // Calcular métricas finales por responsable
        const metricasFinales = [];
        let totalGeneral = {
            documentos: 0,
            totalUnidades: 0,
            totalTiempoSegundos: 0,
            eficienciaPromedio: 0,
            capacidadPromedio: 0,
            efectividadPromedio: 0
        };
        
        for (const [responsable, metrica] of Object.entries(metricasPorResponsable)) {
            // Calcular promedios
            metrica.eficienciaPromedio = metrica.totalUnidades / metrica.totalTiempoSegundos;
            metrica.capacidadPromedio = metrica.eficienciaPromedio * JORNADA_SEGUNDOS;
            
            // Calcular efectividad (documentos por jornada)
            const diasTrabajados = calcularDiasTrabajados(documentosFinalizados.filter(d => d.responsable === responsable));
            metrica.documentosPorDia = diasTrabajados > 0 ? metrica.documentos / diasTrabajados : metrica.documentos;
            
            // Calcular porcentaje de eficiencia respecto a la meta
            metrica.porcentajeEficiencia = (metrica.eficienciaPromedio / META_EFICIENCIA) * 100;
            
            metricasFinales.push(metrica);
            
            // Acumular para total general
            totalGeneral.documentos += metrica.documentos;
            totalGeneral.totalUnidades += metrica.totalUnidades;
            totalGeneral.totalTiempoSegundos += metrica.totalTiempoSegundos;
        }
        
        // Calcular promedios generales
        if (totalGeneral.totalTiempoSegundos > 0) {
            totalGeneral.eficienciaPromedio = totalGeneral.totalUnidades / totalGeneral.totalTiempoSegundos;
            totalGeneral.capacidadPromedio = totalGeneral.eficienciaPromedio * JORNADA_SEGUNDOS;
            
            const totalDiasTrabajados = calcularDiasTrabajados(documentosFinalizados);
            totalGeneral.efectividadPromedio = totalDiasTrabajados > 0 ? totalGeneral.documentos / totalDiasTrabajados : totalGeneral.documentos;
        }
        
        console.log('Métricas calculadas:', {
            totalDocumentos: documentosFinalizados.length,
            totalResponsables: metricasFinales.length,
            metricasFinales: metricasFinales,
            totalGeneral: totalGeneral
        });
        
        return {
            metricasPorResponsable: metricasFinales,
            totalGeneral: totalGeneral,
            documentosProcesados: documentosFinalizados.length
        };
        
    } catch (error) {
        console.error('Error calculando métricas:', error);
        throw error;
    }
}

// Función auxiliar para convertir tiempo a segundos
function tiempoASegundos(tiempo) {
    if (!tiempo) return 0;
    try {
        const partes = tiempo.split(":");
        const horas = parseInt(partes[0]) || 0;
        const minutos = parseInt(partes[1]) || 0;
        const segundos = parseInt(partes[2]) || 0;
        return (horas * 3600) + (minutos * 60) + segundos;
    } catch (e) {
        console.error("Error convirtiendo tiempo a segundos:", e);
        return 0;
    }
}

// Calcular días trabajados únicos
function calcularDiasTrabajados(documentos) {
    const diasUnicos = new Set();
    documentos.forEach(doc => {
        if (doc.fecha) {
            const fecha = doc.fecha.split(' ')[0]; // Solo la fecha sin hora
            diasUnicos.add(fecha);
        }
    });
    return Math.max(diasUnicos.size, 1); // Mínimo 1 día para evitar división por cero
}

// Actualizar resumen de métricas
function actualizarResumenMetricas(metricas) {
    const total = metricas.totalGeneral;
    
    // Eficiencia promedio
    document.getElementById('eficienciaPromedio').textContent = total.eficienciaPromedio.toFixed(4);
    
    // Capacidad promedio
    document.getElementById('capacidadPromedio').textContent = Math.round(total.capacidadPromedio).toLocaleString();
    
    // Efectividad promedio
    document.getElementById('efectividadPromedio').textContent = Math.round(total.efectividadPromedio);
    
    // Capacidad instalada (porcentaje de eficiencia)
    const capacidadInstalada = (total.eficienciaPromedio / META_EFICIENCIA) * 100;
    document.getElementById('capacidadInstalada').textContent = capacidadInstalada.toFixed(1) + '%';
    
    // Aplicar clases de color según el rendimiento
    aplicarEstilosRendimiento('eficienciaPromedio', total.eficienciaPromedio, META_EFICIENCIA);
    aplicarEstilosRendimiento('capacidadPromedio', total.capacidadPromedio, META_CAPACIDAD);
    aplicarEstilosRendimiento('efectividadPromedio', total.efectividadPromedio, META_EFECTIVIDAD);
    aplicarEstilosRendimiento('capacidadInstalada', capacidadInstalada, 100);
}

// Aplicar estilos de color según el rendimiento
function aplicarEstilosRendimiento(elementId, valorActual, valorMeta) {
    const elemento = document.getElementById(elementId);
    if (!elemento) return;
    
    const porcentaje = (valorActual / valorMeta) * 100;
    
    elemento.classList.remove('eficiencia-baja', 'eficiencia-media', 'eficiencia-alta');
    
    if (porcentaje < 70) {
        elemento.classList.add('eficiencia-baja');
    } else if (porcentaje < 90) {
        elemento.classList.add('eficiencia-media');
    } else {
        elemento.classList.add('eficiencia-alta');
    }
}

// Actualizar tabla de métricas
function actualizarTablaMetricas(metricas) {
    const tbody = document.querySelector('#tablaMetricas tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (metricas.metricasPorResponsable.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-muted py-4">
                    No hay datos para mostrar con los filtros seleccionados
                </td>
            </tr>
        `;
        return;
    }
    
    metricas.metricasPorResponsable.forEach(metrica => {
        const fila = document.createElement('tr');
        
        // Formatear tiempo total
        const tiempoTotalFormateado = segundosATiempo(metrica.totalTiempoSegundos);
        
        // Determinar clase de eficiencia
        let claseEficiencia = 'eficiencia-baja';
        if (metrica.porcentajeEficiencia >= 90) {
            claseEficiencia = 'eficiencia-alta';
        } else if (metrica.porcentajeEficiencia >= 70) {
            claseEficiencia = 'eficiencia-media';
        }
        
        fila.innerHTML = `
            <td class="fw-semibold">${metrica.responsable}</td>
            <td>${metrica.documentos}</td>
            <td>${metrica.totalUnidades.toLocaleString()}</td>
            <td>${tiempoTotalFormateado}</td>
            <td class="${claseEficiencia}">${metrica.eficienciaPromedio.toFixed(4)}</td>
            <td>${Math.round(metrica.capacidadPromedio).toLocaleString()}</td>
            <td>${Math.round(metrica.documentosPorDia)}</td>
            <td class="${claseEficiencia}">${metrica.porcentajeEficiencia.toFixed(1)}%</td>
        `;
        
        tbody.appendChild(fila);
    });
}

// Actualizar top semanal
function actualizarTopSemanal(metricas) {
    const container = document.getElementById('topSemanalLista');
    if (!container) return;
    
    if (metricas.metricasPorResponsable.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-chart-bar fa-2x mb-2"></i>
                <p>No hay datos para mostrar</p>
            </div>
        `;
        return;
    }
    
    // Ordenar por eficiencia (descendente)
    const topEficiencia = [...metricas.metricasPorResponsable]
        .sort((a, b) => b.eficienciaPromedio - a.eficienciaPromedio)
        .slice(0, 5);
    
    let html = '';
    topEficiencia.forEach((metrica, index) => {
        const posicion = index + 1;
        const esTop1 = posicion === 1;
        
        html += `
            <div class="top-item ${esTop1 ? 'bg-light rounded p-2' : ''}">
                <div class="top-posicion ${esTop1 ? 'bg-warning' : ''}">
                    ${posicion}
                </div>
                <div class="top-info">
                    <div class="top-nombre" title="${metrica.responsable}">
                        ${metrica.responsable}
                    </div>
                    <div class="top-metricas">
                        <div class="top-metrica">
                            <i class="fas fa-bolt ${metrica.eficienciaPromedio >= META_EFICIENCIA ? 'text-success' : 'text-warning'}"></i>
                            ${metrica.eficienciaPromedio.toFixed(4)}
                        </div>
                        <div class="top-metrica">
                            <i class="fas fa-cube"></i>
                            ${Math.round(metrica.capacidadPromedio).toLocaleString()}
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Actualizar gráfico spider
function actualizarGraficoSpider(metricas, responsableFiltro = '') {
    const ctx = document.getElementById('spiderChart');
    if (!ctx) return;
    
    // Destruir gráfico anterior si existe
    if (spiderChart) {
        spiderChart.destroy();
    }
    
    const datos = responsableFiltro 
        ? generarDatosSpiderIndividual(metricas, responsableFiltro)
        : generarDatosSpiderGeneral(metricas);
    
    spiderChart = new Chart(ctx, {
        type: 'radar',
        data: datos,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: {
                        display: true,
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    suggestedMin: 0,
                    suggestedMax: 100,
                    ticks: {
                        display: false,
                        stepSize: 20
                    },
                    pointLabels: {
                        font: {
                            size: 11,
                            family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
                        },
                        color: 'var(--text-secondary)'
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: {
                            size: 11
                        },
                        color: 'var(--text-primary)'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.raw.toFixed(1)}%`;
                        }
                    }
                }
            },
            elements: {
                line: {
                    borderWidth: 2
                }
            }
        }
    });
}

// Generar datos para gráfico spider individual
function generarDatosSpiderIndividual(metricas, responsable) {
    const metricaResponsable = metricas.metricasPorResponsable.find(m => m.responsable === responsable);
    
    if (!metricaResponsable) {
        return {
            labels: ['Eficiencia', 'Capacidad', 'Efectividad', 'Productividad', 'Calidad'],
            datasets: [{
                label: 'Sin datos',
                data: [0, 0, 0, 0, 0],
                backgroundColor: 'rgba(200, 200, 200, 0.2)',
                borderColor: 'rgba(200, 200, 200, 1)',
                pointBackgroundColor: 'rgba(200, 200, 200, 1)'
            }]
        };
    }
    
    const datos = [
        (metricaResponsable.porcentajeEficiencia), // Eficiencia
        (metricaResponsable.capacidadPromedio / META_CAPACIDAD) * 100, // Capacidad
        (metricaResponsable.documentosPorDia / META_EFECTIVIDAD) * 100, // Efectividad
        Math.min((metricaResponsable.totalUnidades / metricaResponsable.documentos) / 100, 100), // Productividad (aproximada)
        85 // Calidad (valor fijo por ahora)
    ];
    
    return {
        labels: ['Eficiencia', 'Capacidad', 'Efectividad', 'Productividad', 'Calidad'],
        datasets: [{
            label: responsable,
            data: datos,
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            borderColor: 'rgba(59, 130, 246, 1)',
            pointBackgroundColor: 'rgba(59, 130, 246, 1)',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: 'rgba(59, 130, 246, 1)'
        }, {
            label: 'Meta',
            data: [100, 100, 100, 100, 100],
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderColor: 'rgba(16, 185, 129, 0.5)',
            borderDash: [5, 5],
            pointBackgroundColor: 'rgba(16, 185, 129, 0.5)',
            pointBorderColor: 'rgba(16, 185, 129, 0.5)'
        }]
    };
}

// Generar datos para gráfico spider general (promedio del equipo)
function generarDatosSpiderGeneral(metricas) {
    if (metricas.metricasPorResponsable.length === 0) {
        return {
            labels: ['Eficiencia', 'Capacidad', 'Efectividad', 'Productividad', 'Calidad'],
            datasets: [{
                label: 'Sin datos',
                data: [0, 0, 0, 0, 0],
                backgroundColor: 'rgba(200, 200, 200, 0.2)',
                borderColor: 'rgba(200, 200, 200, 1)',
                pointBackgroundColor: 'rgba(200, 200, 200, 1)'
            }]
        };
    }
    
    const total = metricas.totalGeneral;
    const promedioDocumentosPorDia = total.efectividadPromedio;
    
    const datos = [
        (total.eficienciaPromedio / META_EFICIENCIA) * 100, // Eficiencia
        (total.capacidadPromedio / META_CAPACIDAD) * 100, // Capacidad
        (promedioDocumentosPorDia / META_EFECTIVIDAD) * 100, // Efectividad
        Math.min((total.totalUnidades / total.documentos) / 100, 100), // Productividad (aproximada)
        85 // Calidad (valor fijo por ahora)
    ];
    
    return {
        labels: ['Eficiencia', 'Capacidad', 'Efectividad', 'Productividad', 'Calidad'],
        datasets: [{
            label: 'Promedio Equipo',
            data: datos,
            backgroundColor: 'rgba(245, 158, 11, 0.2)',
            borderColor: 'rgba(245, 158, 11, 1)',
            pointBackgroundColor: 'rgba(245, 158, 11, 1)',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: 'rgba(245, 158, 11, 1)'
        }, {
            label: 'Meta',
            data: [100, 100, 100, 100, 100],
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderColor: 'rgba(16, 185, 129, 0.5)',
            borderDash: [5, 5],
            pointBackgroundColor: 'rgba(16, 185, 129, 0.5)',
            pointBorderColor: 'rgba(16, 185, 129, 0.5)'
        }]
    };
}

// Limpiar filtros de métricas
function limpiarFiltrosMetricas() {
    flatpickrMetricas.clear();
    document.getElementById('selectResponsableMetricas').value = '';
    
    // Limpiar interfaz
    document.getElementById('eficienciaPromedio').textContent = '0.00';
    document.getElementById('capacidadPromedio').textContent = '0';
    document.getElementById('efectividadPromedio').textContent = '0';
    document.getElementById('capacidadInstalada').textContent = '0%';
    
    document.querySelector('#tablaMetricas tbody').innerHTML = `
        <tr>
            <td colspan="8" class="text-center text-muted py-4">
                Seleccione un rango de fechas para ver las métricas
            </td>
        </tr>
    `;
    
    document.getElementById('topSemanalLista').innerHTML = `
        <div class="text-center text-muted py-4">
            <i class="fas fa-chart-bar fa-2x mb-2"></i>
            <p>Seleccione un rango de fechas</p>
        </div>
    `;
    
    // Limpiar gráfico
    if (spiderChart) {
        spiderChart.destroy();
        spiderChart = null;
    }
}

// Mostrar loading en métricas
function mostrarLoadingMetricas() {
    const cardBody = document.querySelector('.card-body');
    if (!cardBody) return;
    
    // Crear overlay de loading si no existe
    let loadingOverlay = document.getElementById('loadingMetricas');
    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'loadingMetricas';
        loadingOverlay.className = 'loading-overlay';
        loadingOverlay.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Cargando métricas...</span>
                </div>
                <p class="mt-2">Calculando métricas...</p>
            </div>
        `;
        cardBody.appendChild(loadingOverlay);
    }
    
    loadingOverlay.style.display = 'flex';
}

// Ocultar loading de métricas
function ocultarLoadingMetricas() {
    const loadingOverlay = document.getElementById('loadingMetricas');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

// Función auxiliar para convertir segundos a formato tiempo
function segundosATiempo(segundos) {
    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    const segs = Math.floor(segundos % 60);
    
    return `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segs.toString().padStart(2, '0')}`;
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    // Esperar un poco para asegurar que todo esté cargado
    setTimeout(() => {
        inicializarSistemaMetricas();
    }, 1000);
});
