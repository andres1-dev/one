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
            console.log('Flatpickr métricas - Fechas seleccionadas:', selectedDates);
            if (selectedDates.length === 2) {
                console.log('Rango completo seleccionado para métricas:', selectedDates);
                // Actualizar automáticamente las métricas cuando se selecciona un rango
                setTimeout(() => {
                    actualizarMetricasRendimiento();
                }, 500);
            } else if (selectedDates.length === 0) {
                console.log('Filtro de fechas limpiado');
                limpiarFiltrosMetricas();
            }
        }
    });
    
    console.log('Flatpickr métricas inicializado:', flatpickrMetricas);
    
    // Configurar el evento change del selector de responsables
    const selectResponsable = document.getElementById('selectResponsableMetricas');
    if (selectResponsable) {
        selectResponsable.addEventListener('change', function() {
            console.log('Responsable cambiado:', this.value);
            // Si hay fechas seleccionadas, actualizar métricas automáticamente
            if (flatpickrMetricas && flatpickrMetricas.selectedDates.length === 2) {
                setTimeout(() => {
                    actualizarMetricasRendimiento();
                }, 300);
            }
        });
    }
    
    // Cargar lista de responsables después de un delay para asegurar que los datos globales estén cargados
    setTimeout(() => {
        cargarResponsablesParaMetricas();
    }, 2000);
    
    console.log('Sistema de métricas inicializado');
}

// Cargar responsables en el selector
async function cargarResponsablesParaMetricas() {
    try {
        const select = document.getElementById('selectResponsableMetricas');
        if (!select) {
            console.error('No se encontró el selector de responsables');
            return;
        }
        
        // Limpiar opciones excepto la primera
        while (select.children.length > 1) {
            select.removeChild(select.lastChild);
        }
        
        // Obtener responsables únicos de documentos finalizados
        const responsablesUnicos = await obtenerResponsablesFinalizados();
        
        console.log('Responsables encontrados:', responsablesUnicos);
        
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
        console.log('Obteniendo responsables de documentos finalizados...');
        
        // Usar los datos globales ya cargados en lugar de hacer una nueva petición
        if (!window.datosGlobales || window.datosGlobales.length === 0) {
            console.warn('datosGlobales no está disponible, intentando cargar datos...');
            if (typeof cargarDatos === 'function') {
                await cargarDatos();
            } else {
                console.error('Función cargarDatos no disponible');
                return [];
            }
        }
        
        console.log('Total de documentos en datosGlobales:', window.datosGlobales.length);
        
        const responsables = new Set();
        
        // Buscar en datosGlobales los documentos finalizados
        window.datosGlobales.forEach(doc => {
            const estado = doc.ESTADO || doc.estado || '';
            const colaborador = doc.COLABORADOR || doc.colaborador || '';
            
            if (estado.toString().toUpperCase() === 'FINALIZADO' && colaborador && colaborador.trim() !== '') {
                responsables.add(colaborador.trim());
            }
        });
        
        const responsablesArray = Array.from(responsables).sort();
        console.log('Responsables finalizados encontrados:', responsablesArray);
        return responsablesArray;
        
    } catch (error) {
        console.error('Error obteniendo responsables finalizados:', error);
        
        // Fallback: intentar obtener de la tabla de documentos si está disponible
        try {
            if (window.documentosGlobales && window.documentosGlobales.length > 0) {
                const responsables = new Set();
                window.documentosGlobales.forEach(doc => {
                    if (doc.estado === 'FINALIZADO' && doc.colaborador && doc.colaborador.trim() !== '') {
                        responsables.add(doc.colaborador.trim());
                    }
                });
                return Array.from(responsables).sort();
            }
        } catch (fallbackError) {
            console.error('Error en fallback:', fallbackError);
        }
        
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
        
        console.log('Filtros aplicados:', {
            fechas: fechas,
            responsable: responsableSeleccionado
        });
        
        if (!fechas || fechas.length !== 2) {
            await mostrarNotificacion('Información', 'Seleccione un rango de fechas para calcular las métricas', 'info');
            ocultarLoadingMetricas();
            return;
        }
        
        // Calcular métricas
        const metricas = await calcularMetricasRendimiento(fechas[0], fechas[1], responsableSeleccionado);
        metricasGlobales = metricas;
        
        console.log('Métricas calculadas:', metricas);
        
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

// Calcular métricas de rendimiento - VERSIÓN CORREGIDA
async function calcularMetricasRendimiento(fechaInicio, fechaFin, responsableFiltro = '') {
    try {
        console.log('Calculando métricas para rango:', fechaInicio, 'a', fechaFin, 'Responsable:', responsableFiltro);
        
        // Asegurarse de que los datos globales estén disponibles
        if (!window.datosGlobales || window.datosGlobales.length === 0) {
            console.warn('datosGlobales vacío, intentando cargar...');
            if (typeof cargarDatos === 'function') {
                await cargarDatos();
            }
        }
        
        if (!window.datosGlobales || window.datosGlobales.length === 0) {
            throw new Error('No hay datos disponibles para calcular métricas');
        }
        
        console.log('Total de documentos en datosGlobales:', window.datosGlobales.length);
        
        // También usar documentosGlobales si está disponible para obtener información de estado actual
        let documentosConEstado = [];
        
        if (window.documentosGlobales && window.documentosGlobales.length > 0) {
            console.log('Usando documentosGlobales para estados actuales');
            documentosConEstado = window.documentosGlobales;
        } else {
            console.log('Usando datosGlobales como fuente principal');
            // Convertir datosGlobales al formato necesario
            documentosConEstado = window.datosGlobales.map(doc => ({
                rec: doc.REC || doc.rec || '',
                estado: doc.ESTADO || doc.estado || '',
                colaborador: doc.COLABORADOR || doc.colaborador || '',
                fecha: doc.FECHA || doc.fecha || '',
                cantidad: parseInt(doc.CANTIDAD) || 0,
                datosCompletos: doc
            }));
        }
        
        console.log('Documentos con estado:', documentosConEstado.length);
        
        // Procesar documentos finalizados en el rango de fechas
        const documentosFinalizados = [];
        const metricasPorResponsable = {};
        
        for (const doc of documentosConEstado) {
            const estado = String(doc.estado || '').toUpperCase();
            const colaborador = String(doc.colaborador || '').trim();
            const fechaDoc = doc.fecha || '';
            
            // Filtrar solo documentos finalizados
            if (estado !== 'FINALIZADO' || !colaborador || colaborador === '') {
                continue;
            }
            
            // Filtrar por responsable si se especifica
            if (responsableFiltro && colaborador !== responsableFiltro) {
                continue;
            }
            
            // FILTRAR POR FECHA usando el flatpickr
            if (fechaDoc) {
                const fechaDocObj = parsearFechaParaFiltro(fechaDoc);
                if (fechaDocObj) {
                    // Normalizar fechas para comparación (sin horas)
                    const inicioNormalizado = new Date(fechaInicio);
                    inicioNormalizado.setHours(0, 0, 0, 0);
                    
                    const finNormalizado = new Date(fechaFin);
                    finNormalizado.setHours(23, 59, 59, 999);
                    
                    fechaDocObj.setHours(12, 0, 0, 0); // Hora media para comparación
                    
                    if (fechaDocObj < inicioNormalizado || fechaDocObj > finNormalizado) {
                        continue; // Saltar documentos fuera del rango de fechas
                    }
                }
            }
            
            // Obtener datos completos del documento
            const datosCompletos = doc.datosCompletos || doc;
            if (!datosCompletos) continue;
            
            const cantidad = parseInt(datosCompletos.CANTIDAD) || 0;
            if (cantidad <= 0) continue;
            
            // Buscar información de duración en la hoja DATA
            const duracion = await obtenerDuracionDocumento(doc.rec);
            if (!duracion || duracion.segundos <= 0) continue;
            
            // Calcular eficiencia (unidades por segundo)
            const eficiencia = cantidad / duracion.segundos;
            
            // Calcular capacidad proyectada (unidades por jornada)
            const capacidad = (cantidad / duracion.segundos) * JORNADA_SEGUNDOS;
            
            const documentoMetrica = {
                rec: doc.rec,
                responsable: colaborador,
                cantidad: cantidad,
                duracionSegundos: duracion.segundos,
                duracionFormateada: duracion.formateada,
                eficiencia: eficiencia,
                capacidad: capacidad,
                fecha: fechaDoc
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
            metricasPorResponsable[colaborador].totalTiempoSegundos += duracion.segundos;
        }
        
        console.log('Documentos finalizados procesados después de filtro de fecha:', documentosFinalizados.length);
        console.log('Responsables con métricas:', Object.keys(metricasPorResponsable));
        
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
            metrica.eficienciaPromedio = metrica.totalTiempoSegundos > 0 ? 
                metrica.totalUnidades / metrica.totalTiempoSegundos : 0;
            metrica.capacidadPromedio = metrica.eficienciaPromedio * JORNADA_SEGUNDOS;
            
            // Calcular efectividad (documentos por jornada)
            const diasTrabajados = calcularDiasTrabajados(documentosFinalizados.filter(d => d.responsable === responsable));
            metrica.documentosPorDia = diasTrabajados > 0 ? metrica.documentos / diasTrabajados : metrica.documentos;
            
            // Calcular porcentaje de eficiencia respecto a la meta
            metrica.porcentajeEficiencia = metrica.eficienciaPromedio > 0 ? 
                (metrica.eficienciaPromedio / META_EFICIENCIA) * 100 : 0;
            
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
            totalGeneral.efectividadPromedio = totalDiasTrabajados > 0 ? 
                totalGeneral.documentos / totalDiasTrabajados : totalGeneral.documentos;
        }
        
        console.log('Métricas calculadas:', {
            totalDocumentos: documentosFinalizados.length,
            totalResponsables: metricasFinales.length,
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

// Función auxiliar para parsear fechas para el filtro
function parsearFechaParaFiltro(fechaStr) {
    if (!fechaStr) return null;
    
    try {
        // Probar diferentes formatos de fecha
        if (fechaStr.includes('/')) {
            // Formato "dd/mm/yyyy" o "dd/mm/yyyy hh:mm:ss"
            const fechaPartes = fechaStr.split(' ')[0].split('/');
            if (fechaPartes.length === 3) {
                const dia = parseInt(fechaPartes[0], 10);
                const mes = parseInt(fechaPartes[1], 10) - 1; // Meses en JS son 0-11
                const año = parseInt(fechaPartes[2], 10);
                return new Date(año, mes, dia);
            }
        } else if (fechaStr.includes('-')) {
            // Formato "yyyy-mm-dd"
            return new Date(fechaStr);
        }
        
        return null;
    } catch (e) {
        console.error('Error parseando fecha para filtro:', e, 'Fecha:', fechaStr);
        return null;
    }
}

// Obtener duración de un documento desde la hoja DATA
async function obtenerDuracionDocumento(rec) {
    try {
        const SPREADSHEET_ID = "1d5dCCCgiWXfM6vHu3zGGKlvK2EycJtT7Uk4JqUjDOfE";
        const API_KEY = 'AIzaSyC7hjbRc0TGLgImv8gVZg8tsOeYWgXlPcM';
        
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/DATA!A2:K?key=${API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        const values = data.values || [];
        
        // Buscar el documento específico
        const fila = values.find(row => String(row[0] || '').trim() === String(rec));
        
        if (fila) {
            const duracion = fila[7] || '00:00:00'; // Columna H (índice 7) - duración guardada
            const segundos = tiempoASegundos(duracion);
            
            return {
                formateada: duracion,
                segundos: segundos
            };
        }
        
        return {
            formateada: '00:00:00',
            segundos: 0
        };
        
    } catch (error) {
        console.error('Error obteniendo duración para REC' + rec + ':', error);
        return {
            formateada: '00:00:00',
            segundos: 0
        };
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
        console.error("Error convirtiendo tiempo a segundos:", e, "Tiempo:", tiempo);
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
    
    console.log('Actualizando resumen con:', total);
    
    // Eficiencia promedio
    document.getElementById('eficienciaPromedio').textContent = total.eficienciaPromedio.toFixed(4);
    
    // Capacidad promedio
    document.getElementById('capacidadPromedio').textContent = Math.round(total.capacidadPromedio).toLocaleString();
    
    // Efectividad promedio
    document.getElementById('efectividadPromedio').textContent = Math.round(total.efectividadPromedio);
    
    // Capacidad instalada (porcentaje de eficiencia)
    const capacidadInstalada = total.eficienciaPromedio > 0 ? 
        (total.eficienciaPromedio / META_EFICIENCIA) * 100 : 0;
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
    
    const porcentaje = valorMeta > 0 ? (valorActual / valorMeta) * 100 : 0;
    
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

// Actualizar gráfico spider - VERSIÓN CORREGIDA (solo 3 métricas)
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
                            size: 12,
                            family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                            weight: 'bold'
                        },
                        color: 'var(--text-primary)'
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: {
                            size: 11,
                            weight: 'bold'
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
                    borderWidth: 3
                },
                point: {
                    radius: 4,
                    hoverRadius: 6
                }
            }
        }
    });
}

// Generar datos para gráfico spider individual - VERSIÓN CORREGIDA (solo 3 métricas)
function generarDatosSpiderIndividual(metricas, responsable) {
    const metricaResponsable = metricas.metricasPorResponsable.find(m => m.responsable === responsable);
    
    if (!metricaResponsable) {
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
        Math.min(metricaResponsable.porcentajeEficiencia, 100), // Eficiencia (% de la meta 4.0)
        Math.min((metricaResponsable.capacidadPromedio / META_CAPACIDAD) * 100, 100), // Capacidad (% de la meta 7,920)
        Math.min((metricaResponsable.documentosPorDia / META_EFECTIVIDAD) * 100, 100) // Efectividad (% de la meta 25)
    ];
    
    console.log('Datos spider individual para', responsable, ':', datos);
    
    return {
        labels: ['Eficiencia', 'Capacidad', 'Efectividad'],
        datasets: [{
            label: responsable,
            data: datos,
            backgroundColor: 'rgba(59, 130, 246, 0.3)',
            borderColor: 'rgba(59, 130, 246, 1)',
            pointBackgroundColor: 'rgba(59, 130, 246, 1)',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: 'rgba(59, 130, 246, 1)'
        }, {
            label: 'Meta (100%)',
            data: [100, 100, 100],
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderColor: 'rgba(16, 185, 129, 0.6)',
            borderDash: [5, 5],
            pointBackgroundColor: 'rgba(16, 185, 129, 0.6)',
            pointBorderColor: 'rgba(16, 185, 129, 0.6)'
        }]
    };
}

// Generar datos para gráfico spider general - VERSIÓN CORREGIDA (solo 3 métricas)
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
        Math.min((total.eficienciaPromedio / META_EFICIENCIA) * 100, 100), // Eficiencia (% de la meta 4.0)
        Math.min((total.capacidadPromedio / META_CAPACIDAD) * 100, 100), // Capacidad (% de la meta 7,920)
        Math.min((total.efectividadPromedio / META_EFECTIVIDAD) * 100, 100) // Efectividad (% de la meta 25)
    ];
    
    console.log('Datos spider general:', datos);
    
    return {
        labels: ['Eficiencia', 'Capacidad', 'Efectividad'],
        datasets: [{
            label: 'Promedio Equipo',
            data: datos,
            backgroundColor: 'rgba(245, 158, 11, 0.3)',
            borderColor: 'rgba(245, 158, 11, 1)',
            pointBackgroundColor: 'rgba(245, 158, 11, 1)',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: 'rgba(245, 158, 11, 1)'
        }, {
            label: 'Meta (100%)',
            data: [100, 100, 100],
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderColor: 'rgba(16, 185, 129, 0.6)',
            borderDash: [5, 5],
            pointBackgroundColor: 'rgba(16, 185, 129, 0.6)',
            pointBorderColor: 'rgba(16, 185, 129, 0.6)'
        }]
    };
}

// Limpiar filtros de métricas
function limpiarFiltrosMetricas() {
    if (flatpickrMetricas) {
        flatpickrMetricas.clear();
    }
    
    const selectResponsable = document.getElementById('selectResponsableMetricas');
    if (selectResponsable) {
        selectResponsable.value = '';
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
    
    // Limpiar gráfico
    if (spiderChart) {
        spiderChart.destroy();
        spiderChart = null;
    }
}

// Mostrar loading en métricas
function mostrarLoadingMetricas() {
    const cardBody = document.querySelector('#resumenMetricas').parentElement;
    if (!cardBody) return;
    
    // Crear overlay de loading si no existe
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

// Inicializar cuando el DOM esté listo y los datos estén cargados
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM cargado, inicializando sistema de métricas...');
    
    // Esperar a que los datos globales estén cargados
    const checkDataLoaded = setInterval(() => {
        if (typeof datosGlobales !== 'undefined') {
            clearInterval(checkDataLoaded);
            console.log('Datos globales disponibles, inicializando métricas...');
            
            // Inicializar después de un breve delay para asegurar que todo esté listo
            setTimeout(() => {
                inicializarSistemaMetricas();
            }, 1000);
        }
    }, 500);
    
    // Timeout de seguridad
    setTimeout(() => {
        if (typeof inicializarSistemaMetricas === 'function') {
            console.log('Inicializando métricas por timeout de seguridad...');
            inicializarSistemaMetricas();
        }
    }, 5000);
});
