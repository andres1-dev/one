// Sistema de Métricas de Rendimiento
let metricasGlobales = [];
let spiderChart = null;
let flatpickrMetricas = null;

// Constantes del sistema
const META_EFICIENCIA = 4.0;
const META_CAPACIDAD = 7920;
const META_EFECTIVIDAD = 25;
const JORNADA_SEGUNDOS = 31680;

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
            console.log('Flatpickr métricas - Fechas seleccionadas:', selectedDates);
            if (selectedDates.length === 2) {
                actualizarMetricasRendimiento();
            } else if (selectedDates.length === 0) {
                limpiarFiltrosMetricas();
            }
        }
    });
    
    console.log('Sistema de métricas inicializado');
}

// Función principal para actualizar métricas
async function actualizarMetricasRendimiento() {
    try {
        console.log('=== INICIANDO ACTUALIZACIÓN DE MÉTRICAS ===');
        
        // Mostrar loading
        mostrarLoadingMetricas();
        
        // Obtener parámetros de filtro
        const fechas = flatpickrMetricas.selectedDates;
        const responsableSeleccionado = document.getElementById('selectResponsableMetricas').value;
        
        console.log('Filtros:', { fechas, responsable: responsableSeleccionado });
        
        if (!fechas || fechas.length !== 2) {
            await mostrarNotificacion('Información', 'Seleccione un rango de fechas', 'info');
            ocultarLoadingMetricas();
            return;
        }
        
        // Calcular métricas
        const metricas = await calcularMetricasRendimiento(fechas[0], fechas[1], responsableSeleccionado);
        
        console.log('Métricas calculadas:', metricas);
        
        // Actualizar interfaz
        actualizarResumenMetricas(metricas);
        actualizarTablaMetricas(metricas);
        actualizarTopSemanal(metricas);
        actualizarGraficoSpider(metricas, responsableSeleccionado);
        
        console.log('=== MÉTRICAS ACTUALIZADAS CORRECTAMENTE ===');
        
    } catch (error) {
        console.error('Error actualizando métricas:', error);
        await mostrarNotificacion('Error', 'Error al calcular métricas: ' + error.message, 'error');
    } finally {
        ocultarLoadingMetricas();
    }
}

// Calcular métricas de rendimiento - VERSIÓN SIMPLIFICADA Y FUNCIONAL
async function calcularMetricasRendimiento(fechaInicio, fechaFin, responsableFiltro = '') {
    try {
        console.log('Calculando métricas para:', fechaInicio, 'a', fechaFin);
        
        // Usar documentosGlobales que ya tiene la información combinada
        if (!window.documentosGlobales || window.documentosGlobales.length === 0) {
            throw new Error('No hay documentos disponibles. Cargue la tabla primero.');
        }
        
        console.log('Total documentos disponibles:', window.documentosGlobales.length);
        
        const fechaInicioObj = new Date(fechaInicio);
        const fechaFinObj = new Date(fechaFin);
        fechaFinObj.setHours(23, 59, 59, 999); // Incluir todo el día final
        
        // Procesar documentos finalizados en el rango
        const documentosFinalizados = [];
        const metricasPorResponsable = {};
        
        for (const doc of window.documentosGlobales) {
            // Solo documentos finalizados
            if (doc.estado !== 'FINALIZADO') continue;
            
            // Filtrar por responsable si se especifica
            if (responsableFiltro && doc.colaborador !== responsableFiltro) continue;
            
            // Verificar fecha
            if (!doc.fecha_objeto) continue;
            
            const fechaDoc = doc.fecha_objeto;
            if (fechaDoc < fechaInicioObj || fechaDoc > fechaFinObj) continue;
            
            const cantidad = doc.cantidad || 0;
            if (cantidad <= 0) continue;
            
            // Obtener duración en segundos
            const duracionSegundos = tiempoASegundos(doc.duracion_guardada);
            if (duracionSegundos <= 0) continue;
            
            // Calcular métricas
            const eficiencia = cantidad / duracionSegundos;
            const capacidad = eficiencia * JORNADA_SEGUNDOS;
            
            const documentoMetrica = {
                rec: doc.rec,
                responsable: doc.colaborador,
                cantidad: cantidad,
                duracionSegundos: duracionSegundos,
                duracionFormateada: doc.duracion_guardada,
                eficiencia: eficiencia,
                capacidad: capacidad,
                fecha: doc.fecha
            };
            
            documentosFinalizados.push(documentoMetrica);
            
            // Agrupar por responsable
            if (!metricasPorResponsable[doc.colaborador]) {
                metricasPorResponsable[doc.colaborador] = {
                    responsable: doc.colaborador,
                    documentos: 0,
                    totalUnidades: 0,
                    totalTiempoSegundos: 0,
                    eficienciaPromedio: 0,
                    capacidadPromedio: 0,
                    documentosPorDia: 0
                };
            }
            
            metricasPorResponsable[doc.colaborador].documentos++;
            metricasPorResponsable[doc.colaborador].totalUnidades += cantidad;
            metricasPorResponsable[doc.colaborador].totalTiempoSegundos += duracionSegundos;
        }
        
        console.log('Documentos finalizados encontrados:', documentosFinalizados.length);
        console.log('Responsables con datos:', Object.keys(metricasPorResponsable));
        
        // Calcular métricas finales
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
            metrica.eficienciaPromedio = metrica.totalTiempoSegundos > 0 ? 
                metrica.totalUnidades / metrica.totalTiempoSegundos : 0;
            metrica.capacidadPromedio = metrica.eficienciaPromedio * JORNADA_SEGUNDOS;
            
            // Calcular efectividad
            const diasTrabajados = calcularDiasTrabajados(documentosFinalizados.filter(d => d.responsable === responsable));
            metrica.documentosPorDia = diasTrabajados > 0 ? metrica.documentos / diasTrabajados : metrica.documentos;
            
            // Porcentaje de eficiencia
            metrica.porcentajeEficiencia = (metrica.eficienciaPromedio / META_EFICIENCIA) * 100;
            
            metricasFinales.push(metrica);
            
            // Totales generales
            totalGeneral.documentos += metrica.documentos;
            totalGeneral.totalUnidades += metrica.totalUnidades;
            totalGeneral.totalTiempoSegundos += metrica.totalTiempoSegundos;
        }
        
        // Promedios generales
        if (totalGeneral.totalTiempoSegundos > 0) {
            totalGeneral.eficienciaPromedio = totalGeneral.totalUnidades / totalGeneral.totalTiempoSegundos;
            totalGeneral.capacidadPromedio = totalGeneral.eficienciaPromedio * JORNADA_SEGUNDOS;
            
            const totalDiasTrabajados = calcularDiasTrabajados(documentosFinalizados);
            totalGeneral.efectividadPromedio = totalDiasTrabajados > 0 ? 
                totalGeneral.documentos / totalDiasTrabajados : totalGeneral.documentos;
        }
        
        // Actualizar lista de responsables
        actualizarSelectResponsables(metricasFinales);
        
        return {
            metricasPorResponsable: metricasFinales,
            totalGeneral: totalGeneral,
            documentosProcesados: documentosFinalizados.length
        };
        
    } catch (error) {
        console.error('Error en cálculo de métricas:', error);
        throw error;
    }
}

// Actualizar select de responsables con los que tienen datos
function actualizarSelectResponsables(metricas) {
    const select = document.getElementById('selectResponsableMetricas');
    if (!select) return;
    
    // Limpiar opciones excepto la primera
    while (select.children.length > 1) {
        select.removeChild(select.lastChild);
    }
    
    // Agregar responsables que tienen datos
    metricas.forEach(metrica => {
        const option = document.createElement('option');
        option.value = metrica.responsable;
        option.textContent = metrica.responsable;
        select.appendChild(option);
    });
    
    console.log('Select actualizado con', metricas.length, 'responsables');
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
        return 0;
    }
}

// Calcular días trabajados únicos
function calcularDiasTrabajados(documentos) {
    const diasUnicos = new Set();
    documentos.forEach(doc => {
        if (doc.fecha) {
            const fecha = doc.fecha.split(' ')[0];
            diasUnicos.add(fecha);
        }
    });
    return Math.max(diasUnicos.size, 1);
}

// Actualizar resumen de métricas
function actualizarResumenMetricas(metricas) {
    const total = metricas.totalGeneral;
    
    // Actualizar valores
    document.getElementById('eficienciaPromedio').textContent = total.eficienciaPromedio.toFixed(4);
    document.getElementById('capacidadPromedio').textContent = Math.round(total.capacidadPromedio).toLocaleString();
    document.getElementById('efectividadPromedio').textContent = Math.round(total.efectividadPromedio);
    
    const capacidadInstalada = (total.eficienciaPromedio / META_EFICIENCIA) * 100;
    document.getElementById('capacidadInstalada').textContent = capacidadInstalada.toFixed(1) + '%';
    
    // Aplicar estilos de color
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
                    No se encontraron documentos finalizados en el rango seleccionado
                </td>
            </tr>
        `;
        return;
    }
    
    metricas.metricasPorResponsable.forEach(metrica => {
        const fila = document.createElement('tr');
        
        const tiempoTotalFormateado = segundosATiempo(metrica.totalTiempoSegundos);
        const claseEficiencia = metrica.porcentajeEficiencia >= 90 ? 'eficiencia-alta' : 
                               metrica.porcentajeEficiencia >= 70 ? 'eficiencia-media' : 'eficiencia-baja';
        
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
    
    const topEficiencia = [...metricas.metricasPorResponsable]
        .sort((a, b) => b.eficienciaPromedio - a.eficienciaPromedio)
        .slice(0, 5);
    
    let html = '';
    topEficiencia.forEach((metrica, index) => {
        const posicion = index + 1;
        
        html += `
            <div class="top-item ${posicion === 1 ? 'bg-light rounded p-2' : ''}">
                <div class="top-posicion ${posicion === 1 ? 'bg-warning' : ''}">
                    ${posicion}
                </div>
                <div class="top-info">
                    <div class="top-nombre">${metrica.responsable}</div>
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
                    angleLines: { display: true, color: 'rgba(0, 0, 0, 0.1)' },
                    suggestedMin: 0,
                    suggestedMax: 100,
                    ticks: { display: false, stepSize: 20 },
                    pointLabels: {
                        font: { size: 11, family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" },
                        color: 'var(--text-secondary)'
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: { size: 11 },
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
                line: { borderWidth: 2 }
            }
        }
    });
}

// Generar datos para gráfico spider individual
function generarDatosSpiderIndividual(metricas, responsable) {
    const metrica = metricas.metricasPorResponsable.find(m => m.responsable === responsable);
    
    if (!metrica) {
        return {
            labels: ['Eficiencia', 'Capacidad', 'Efectividad'],
            datasets: [{
                label: 'Sin datos',
                data: [0, 0, 0],
                backgroundColor: 'rgba(200, 200, 200, 0.2)',
                borderColor: 'rgba(200, 200, 200, 1)',
                pointBackgroundColor: 'rgba(200, 200, 200, 1)'
            }]
        };
    }
    
    const datos = [
        Math.min(metrica.porcentajeEficiencia, 100),
        Math.min((metrica.capacidadPromedio / META_CAPACIDAD) * 100, 100),
        Math.min((metrica.documentosPorDia / META_EFECTIVIDAD) * 100, 100),
    ];
    
    return {
        labels: ['Eficiencia', 'Capacidad', 'Efectividad'],
        datasets: [{
            label: responsable,
            data: datos,
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            borderColor: 'rgba(59, 130, 246, 1)',
            pointBackgroundColor: 'rgba(59, 130, 246, 1)',
            pointBorderColor: '#fff'
        }, {
            label: 'Meta',
            data: [100, 100, 100],
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderColor: 'rgba(16, 185, 129, 0.5)',
            borderDash: [5, 5],
            pointBackgroundColor: 'rgba(16, 185, 129, 0.5)'
        }]
    };
}

// Generar datos para gráfico spider general
function generarDatosSpiderGeneral(metricas) {
    if (metricas.metricasPorResponsable.length === 0) {
        return {
            labels: ['Eficiencia', 'Capacidad', 'Efectividad'],
            datasets: [{
                label: 'Sin datos',
                data: [0, 0, 0],
                backgroundColor: 'rgba(200, 200, 200, 0.2)',
                borderColor: 'rgba(200, 200, 200, 1)',
                pointBackgroundColor: 'rgba(200, 200, 200, 1)'
            }]
        };
    }
    
    const total = metricas.totalGeneral;
    
    const datos = [
        Math.min((total.eficienciaPromedio / META_EFICIENCIA) * 100, 100),
        Math.min((total.capacidadPromedio / META_CAPACIDAD) * 100, 100),
        Math.min((total.efectividadPromedio / META_EFECTIVIDAD) * 100, 100),
    ];
    
    return {
        labels: ['Eficiencia', 'Capacidad', 'Efectividad'],
        datasets: [{
            label: 'Promedio Equipo',
            data: datos,
            backgroundColor: 'rgba(245, 158, 11, 0.2)',
            borderColor: 'rgba(245, 158, 11, 1)',
            pointBackgroundColor: 'rgba(245, 158, 11, 1)',
            pointBorderColor: '#fff'
        }, {
            label: 'Meta',
            data: [100, 100, 100],
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderColor: 'rgba(16, 185, 129, 0.5)',
            borderDash: [5, 5],
            pointBackgroundColor: 'rgba(16, 185, 129, 0.5)'
        }]
    };
}

// Limpiar filtros de métricas
function limpiarFiltrosMetricas() {
    if (flatpickrMetricas) {
        flatpickrMetricas.clear();
    }
    
    const select = document.getElementById('selectResponsableMetricas');
    if (select) {
        while (select.children.length > 1) {
            select.removeChild(select.lastChild);
        }
    }
    
    // Limpiar interfaz
    document.getElementById('eficienciaPromedio').textContent = '0.00';
    document.getElementById('capacidadPromedio').textContent = '0';
    document.getElementById('efectividadPromedio').textContent = '0';
    document.getElementById('capacidadInstalada').textContent = '0%';
    
    const tbody = document.querySelector('#tablaMetricas tbody');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-muted py-4">
                    Seleccione un rango de fechas para ver las métricas
                </td>
            </tr>
        `;
    }
    
    const topSemanal = document.getElementById('topSemanalLista');
    if (topSemanal) {
        topSemanal.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-chart-bar fa-2x mb-2"></i>
                <p>Seleccione un rango de fechas</p>
            </div>
        `;
    }
    
    if (spiderChart) {
        spiderChart.destroy();
        spiderChart = null;
    }
}

// Mostrar loading en métricas
function mostrarLoadingMetricas() {
    const cardBody = document.querySelector('#resumenMetricas').parentElement;
    if (!cardBody) return;
    
    let loadingOverlay = document.getElementById('loadingMetricas');
    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'loadingMetricas';
        loadingOverlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255, 255, 255, 0.9);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            border-radius: var(--radius-lg);
        `;
        loadingOverlay.innerHTML = `
            <div class="text-center">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Cargando métricas...</span>
                </div>
                <p class="mt-2">Calculando métricas...</p>
            </div>
        `;
        cardBody.style.position = 'relative';
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

// Hacer funciones disponibles globalmente
window.actualizarMetricasRendimiento = actualizarMetricasRendimiento;
window.limpiarFiltrosMetricas = limpiarFiltrosMetricas;

// Inicializar cuando esté listo
document.addEventListener('DOMContentLoaded', function() {
    console.log('Inicializando sistema de métricas...');
    
    // Esperar a que la tabla principal esté cargada
    const checkTableLoaded = setInterval(() => {
        if (window.documentosGlobales && window.documentosGlobales.length > 0) {
            clearInterval(checkTableLoaded);
            console.log('Tabla cargada, inicializando métricas...');
            setTimeout(() => {
                inicializarSistemaMetricas();
            }, 1000);
        }
    }, 500);
    
    // Timeout de seguridad
    setTimeout(() => {
        if (typeof inicializarSistemaMetricas === 'function') {
            console.log('Inicializando métricas por timeout...');
            inicializarSistemaMetricas();
        }
    }, 3000);
});
