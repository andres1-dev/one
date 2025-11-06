// ===== SISTEMA DE MÉTRICAS DE RENDIMIENTO =====
// Archivo: metrics.js

// Constantes de medición
const METRICAS_CONFIG = {
    EFICIENCIA_TARGET: 4, // segundos por unidad
    JORNADA_HORAS: 8.8, // 8 horas 48 minutos
    JORNADA_MINUTOS: 528,
    JORNADA_SEGUNDOS: 31680,
    DOCUMENTOS_TARGET: 20,
    TIEMPO_MUERTO_MAX: 3600, // 1 hora en segundos
    PAUSAS_MAX: 1800, // 30 minutos en segundos
    CAPACIDAD_DIA_PERSONA: 7920 // unidades por persona día
};

// Variables globales del sistema de métricas
let flatpickrMetricas = null;
let rangoFechasMetricas = null;
let chartRadar = null;
let responsableSeleccionado = null;

// ===== INICIALIZACIÓN =====
function inicializarSistemaMetricas() {
    console.log('Inicializando sistema de métricas...');
    
    // Inicializar flatpickr independiente
    const inputFechas = document.getElementById('filtroFechasMetricas');
    if (inputFechas) {
        flatpickrMetricas = flatpickr(inputFechas, {
            mode: "range",
            locale: "es",
            dateFormat: "d/m/Y",
            allowInput: true,
            defaultDate: [
                obtenerInicioSemana(),
                obtenerFinSemana()
            ],
            onChange: function(selectedDates) {
                if (selectedDates.length === 2) {
                    rangoFechasMetricas = selectedDates;
                    actualizarMetricas();
                }
            }
        });
        
        // Establecer rango inicial
        rangoFechasMetricas = [obtenerInicioSemana(), obtenerFinSemana()];
    }
    
    // Cargar responsables en el selector
    cargarResponsablesMetricas();
    
    // Cargar métricas iniciales
    actualizarMetricas();
}

// ===== FUNCIONES DE FECHA =====
function obtenerInicioSemana() {
    const hoy = new Date();
    const dia = hoy.getDay();
    const diff = hoy.getDate() - dia + (dia === 0 ? -6 : 1); // Lunes
    return new Date(hoy.setDate(diff));
}

function obtenerFinSemana() {
    const inicio = obtenerInicioSemana();
    const fin = new Date(inicio);
    fin.setDate(inicio.getDate() + 6); // Domingo
    return fin;
}

function parsearFechaMetricas(fechaStr) {
    if (!fechaStr || fechaStr === '-') return null;
    
    try {
        const partes = fechaStr.split('/');
        if (partes.length !== 3) return null;
        
        const dia = parseInt(partes[0], 10);
        const mes = parseInt(partes[1], 10);
        const año = parseInt(partes[2], 10);
        
        if (isNaN(dia) || isNaN(mes) || isNaN(año)) return null;
        
        return new Date(año, mes - 1, dia);
    } catch (e) {
        return null;
    }
}

// ===== OBTENCIÓN DE DATOS =====
async function obtenerDocumentosFinalizados() {
    const SPREADSHEET_ID = "1d5dCCCgiWXfM6vHu3zGGKlvK2EycJtT7Uk4JqUjDOfE";
    const API_KEY = 'AIzaSyC7hjbRc0TGLgImv8gVZg8tsOeYWgXlPcM';
    
    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/DATA!A2:K?key=${API_KEY}`;
        const response = await fetch(url);
        
        if (!response.ok) throw new Error('Error al obtener datos');
        
        const data = await response.json();
        const values = data.values || [];
        
        // Filtrar solo finalizados
        const finalizados = values
            .filter(row => {
                const estado = String(row[3] || '').trim().toUpperCase();
                return estado === 'FINALIZADO';
            })
            .map(row => {
                const rec = String(row[0] || '').trim();
                const fechaStr = row[1] || '';
                const fechaSolo = fechaStr.includes(' ') ? fechaStr.split(' ')[0] : fechaStr;
                
                // Buscar datos completos
                const datosCompletos = datosGlobales.find(d => d.REC === rec);
                
                return {
                    rec: rec,
                    fecha: fechaSolo,
                    fecha_objeto: parsearFechaMetricas(fechaSolo),
                    colaborador: String(row[4] || '').trim(),
                    duracion_guardada: row[7] || '00:00:00',
                    duracion_pausas: row[10] || '00:00:00',
                    cantidad: datosCompletos ? (datosCompletos.CANTIDAD || 0) : 0,
                    datosCompletos: datosCompletos
                };
            })
            .filter(doc => doc.fecha_objeto !== null && doc.cantidad > 0);
        
        console.log('Documentos finalizados obtenidos:', finalizados.length);
        return finalizados;
        
    } catch (error) {
        console.error('Error obteniendo documentos finalizados:', error);
        return [];
    }
}

function filtrarPorRangoFechas(documentos) {
    if (!rangoFechasMetricas || rangoFechasMetricas.length !== 2) {
        return documentos;
    }
    
    const fechaInicio = new Date(rangoFechasMetricas[0]);
    fechaInicio.setHours(0, 0, 0, 0);
    
    const fechaFin = new Date(rangoFechasMetricas[1]);
    fechaFin.setHours(23, 59, 59, 999);
    
    return documentos.filter(doc => {
        return doc.fecha_objeto >= fechaInicio && doc.fecha_objeto <= fechaFin;
    });
}

// ===== CÁLCULOS DE MÉTRICAS =====
function tiempoASegundos(tiempoStr) {
    if (!tiempoStr) return 0;
    try {
        const partes = tiempoStr.split(':');
        const horas = parseInt(partes[0]) || 0;
        const minutos = parseInt(partes[1]) || 0;
        const segundos = parseInt(partes[2]) || 0;
        return horas * 3600 + minutos * 60 + segundos;
    } catch (e) {
        return 0;
    }
}

function calcularEficiencia(duracionSegundos, cantidad) {
    if (cantidad === 0) return 0;
    const segundosPorUnidad = duracionSegundos / cantidad;
    // Porcentaje: (target / real) * 100
    const porcentaje = (METRICAS_CONFIG.EFICIENCIA_TARGET / segundosPorUnidad) * 100;
    return Math.min(Math.max(porcentaje, 0), 150); // Limitar entre 0-150%
}

function calcularCapacidad(unidadesTotales, diasTrabajados, numeroPersonas) {
    if (diasTrabajados === 0 || numeroPersonas === 0) return 0;
    const capacidadReal = unidadesTotales / (diasTrabajados * numeroPersonas);
    const porcentaje = (capacidadReal / METRICAS_CONFIG.CAPACIDAD_DIA_PERSONA) * 100;
    return Math.min(Math.max(porcentaje, 0), 150);
}

function calcularEfectividad(documentosFinalizados, diasTrabajados) {
    if (diasTrabajados === 0) return 0;
    const docsPorDia = documentosFinalizados / diasTrabajados;
    const porcentaje = (docsPorDia / METRICAS_CONFIG.DOCUMENTOS_TARGET) * 100;
    return Math.min(Math.max(porcentaje, 0), 150);
}

function calcularTiempoMuerto(duracionTotalSegundos, diasTrabajados) {
    const jornadaTotalEsperada = METRICAS_CONFIG.JORNADA_SEGUNDOS * diasTrabajados;
    const tiempoMuerto = Math.max(0, duracionTotalSegundos - jornadaTotalEsperada);
    const porcentaje = 100 - ((tiempoMuerto / METRICAS_CONFIG.TIEMPO_MUERTO_MAX) * 100 / diasTrabajados);
    return Math.min(Math.max(porcentaje, 0), 100);
}

function calcularPausas(pausasTotalSegundos, diasTrabajados) {
    const pausaPromedio = pausasTotalSegundos / diasTrabajados;
    const porcentaje = 100 - ((pausaPromedio / METRICAS_CONFIG.PAUSAS_MAX) * 100);
    return Math.min(Math.max(porcentaje, 0), 100);
}

function calcularMetricasResponsable(documentos) {
    const totalDocs = documentos.length;
    const totalUnidades = documentos.reduce((sum, doc) => sum + doc.cantidad, 0);
    const totalDuracion = documentos.reduce((sum, doc) => 
        sum + tiempoASegundos(doc.duracion_guardada), 0);
    const totalPausas = documentos.reduce((sum, doc) => 
        sum + tiempoASegundos(doc.duracion_pausas), 0);
    
    // Calcular días trabajados (días únicos en el rango)
    const diasUnicos = new Set(documentos.map(doc => doc.fecha)).size;
    
    return {
        documentos: totalDocs,
        unidades: totalUnidades,
        duracionSegundos: totalDuracion,
        pausasSegundos: totalPausas,
        diasTrabajados: diasUnicos,
        eficiencia: calcularEficiencia(totalDuracion, totalUnidades),
        capacidad: calcularCapacidad(totalUnidades, diasUnicos, 1),
        efectividad: calcularEfectividad(totalDocs, diasUnicos),
        tiempoMuerto: calcularTiempoMuerto(totalDuracion, diasUnicos),
        pausas: calcularPausas(totalPausas, diasUnicos)
    };
}

// ===== ACTUALIZACIÓN DE MÉTRICAS =====
async function actualizarMetricas() {
    console.log('Actualizando métricas...');
    
    try {
        // Mostrar loading
        mostrarLoadingMetricas(true);
        
        // Obtener documentos finalizados
        const documentos = await obtenerDocumentosFinalizados();
        const documentosFiltrados = filtrarPorRangoFechas(documentos);
        
        console.log('Documentos filtrados:', documentosFiltrados.length);
        
        // Agrupar por responsable
        const porResponsable = {};
        documentosFiltrados.forEach(doc => {
            const resp = doc.colaborador || 'Sin asignar';
            if (!porResponsable[resp]) {
                porResponsable[resp] = [];
            }
            porResponsable[resp].push(doc);
        });
        
        // Calcular métricas por responsable
        const metricasPorResponsable = {};
        Object.keys(porResponsable).forEach(resp => {
            metricasPorResponsable[resp] = calcularMetricasResponsable(porResponsable[resp]);
        });
        
        // Actualizar interfaz
        actualizarTarjetasMetricas(metricasPorResponsable);
        actualizarGraficoRadar(metricasPorResponsable);
        actualizarTopSemanal(metricasPorResponsable);
        actualizarCapacidadInstalada(documentosFiltrados, porResponsable);
        
        // Ocultar loading
        mostrarLoadingMetricas(false);
        
    } catch (error) {
        console.error('Error actualizando métricas:', error);
        mostrarLoadingMetricas(false);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Error al calcular métricas: ' + error.message,
            timer: 3000
        });
    }
}

function mostrarLoadingMetricas(mostrar) {
    const loader = document.getElementById('metricas-loader');
    if (loader) {
        loader.style.display = mostrar ? 'flex' : 'none';
    }
}

// ===== ACTUALIZACIÓN DE INTERFAZ =====
function actualizarTarjetasMetricas(metricas) {
    // Calcular promedios generales
    const responsables = Object.keys(metricas);
    if (responsables.length === 0) return;
    
    const promedios = {
        eficiencia: 0,
        capacidad: 0,
        efectividad: 0,
        tiempoMuerto: 0,
        pausas: 0
    };
    
    responsables.forEach(resp => {
        const m = metricas[resp];
        promedios.eficiencia += m.eficiencia;
        promedios.capacidad += m.capacidad;
        promedios.efectividad += m.efectividad;
        promedios.tiempoMuerto += m.tiempoMuerto;
        promedios.pausas += m.pausas;
    });
    
    Object.keys(promedios).forEach(key => {
        promedios[key] = (promedios[key] / responsables.length).toFixed(1);
    });
    
    // Actualizar tarjetas
    const tarjetas = {
        'metrica-eficiencia': { 
            valor: promedios.eficiencia, 
            target: 100,
            label: 'Eficiencia',
            desc: `Target: ${METRICAS_CONFIG.EFICIENCIA_TARGET}seg/unidad`
        },
        'metrica-capacidad': { 
            valor: promedios.capacidad, 
            target: 100,
            label: 'Capacidad',
            desc: `Target: ${METRICAS_CONFIG.CAPACIDAD_DIA_PERSONA} unidades/día`
        },
        'metrica-efectividad': { 
            valor: promedios.efectividad, 
            target: 100,
            label: 'Efectividad',
            desc: `Target: ${METRICAS_CONFIG.DOCUMENTOS_TARGET} docs/día`
        },
        'metrica-capacidad-instalada': {
            valor: calcularCapacidadInstaladaTotal(metricas),
            target: 100,
            label: 'Cap. Instalada',
            desc: 'Capacidad real del equipo'
        }
    };
    
    Object.keys(tarjetas).forEach(id => {
        const elem = document.getElementById(id);
        if (elem) {
            const info = tarjetas[id];
            const valueElem = elem.querySelector('.metric-value');
            const targetElem = elem.querySelector('.metric-target');
            
            if (valueElem) {
                valueElem.textContent = `${info.valor}%`;
                valueElem.className = 'metric-value ' + obtenerClaseEficiencia(info.valor);
            }
            
            if (targetElem) {
                targetElem.textContent = info.desc;
            }
        }
    });
}

function calcularCapacidadInstaladaTotal(metricas) {
    const responsables = Object.keys(metricas);
    if (responsables.length === 0) return 0;
    
    let totalUnidades = 0;
    let totalDiasTrabajados = 0;
    
    responsables.forEach(resp => {
        totalUnidades += metricas[resp].unidades;
        totalDiasTrabajados += metricas[resp].diasTrabajados;
    });
    
    const capacidadReal = totalUnidades / totalDiasTrabajados;
    const capacidadTeorica = METRICAS_CONFIG.CAPACIDAD_DIA_PERSONA * responsables.length;
    
    return ((capacidadReal / capacidadTeorica) * 100).toFixed(1);
}

function obtenerClaseEficiencia(valor) {
    if (valor >= 90) return 'eficiencia-alta';
    if (valor >= 70) return 'eficiencia-media';
    return 'eficiencia-baja';
}

// ===== GRÁFICO RADAR =====
function actualizarGraficoRadar(metricas) {
    const responsables = Object.keys(metricas);
    if (responsables.length === 0) return;
    
    // Si hay un responsable seleccionado, usar ese
    let respActual = responsableSeleccionado;
    
    // Si no hay seleccionado o no existe, usar el primero
    if (!respActual || !metricas[respActual]) {
        respActual = responsables[0];
        responsableSeleccionado = respActual;
    }
    
    const datos = metricas[respActual];
    
    const ctx = document.getElementById('chartRadar');
    if (!ctx) return;
    
    // Destruir gráfico anterior
    if (chartRadar) {
        chartRadar.destroy();
    }
    
    // Crear nuevo gráfico
    chartRadar = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Eficiencia', 'Capacidad', 'Efectividad', 'Tiempo Muerto', 'Pausas'],
            datasets: [{
                label: respActual,
                data: [
                    datos.eficiencia,
                    datos.capacidad,
                    datos.efectividad,
                    datos.tiempoMuerto,
                    datos.pausas
                ],
                backgroundColor: 'rgba(15, 52, 96, 0.2)',
                borderColor: 'rgba(15, 52, 96, 1)',
                borderWidth: 2,
                pointBackgroundColor: 'rgba(15, 52, 96, 1)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgba(15, 52, 96, 1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        stepSize: 20
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.label + ': ' + context.parsed.r.toFixed(1) + '%';
                        }
                    }
                }
            }
        }
    });
    
    // Actualizar selector de responsable
    actualizarSelectorResponsable(responsables, respActual);
}

function actualizarSelectorResponsable(responsables, seleccionado) {
    const select = document.getElementById('selector-responsable-metricas');
    if (!select) return;
    
    select.innerHTML = responsables.map(resp => 
        `<option value="${resp}" ${resp === seleccionado ? 'selected' : ''}>${resp}</option>`
    ).join('');
    
    // Evento de cambio
    select.onchange = function() {
        responsableSeleccionado = this.value;
        actualizarMetricas();
    };
}

// ===== TOP SEMANAL =====
function actualizarTopSemanal(metricas) {
    const responsables = Object.keys(metricas);
    if (responsables.length === 0) return;
    
    // Calcular score general para cada responsable
    const ranking = responsables.map(resp => {
        const m = metricas[resp];
        const score = (m.eficiencia + m.capacidad + m.efectividad + m.tiempoMuerto + m.pausas) / 5;
        return {
            nombre: resp,
            score: score,
            metricas: m
        };
    }).sort((a, b) => b.score - a.score);
    
    // Mostrar top 5
    const container = document.getElementById('top-semanal-lista');
    if (!container) return;
    
    container.innerHTML = ranking.slice(0, 5).map((item, index) => `
        <div class="top-item">
            <div class="top-posicion">${index + 1}</div>
            <div class="top-info">
                <div class="top-nombre">${item.nombre}</div>
                <div class="top-metricas">
                    <span class="top-metrica">
                        <i class="fas fa-bolt"></i>
                        ${item.metricas.eficiencia.toFixed(0)}%
                    </span>
                    <span class="top-metrica">
                        <i class="fas fa-chart-line"></i>
                        ${item.metricas.capacidad.toFixed(0)}%
                    </span>
                    <span class="top-metrica">
                        <i class="fas fa-check-circle"></i>
                        ${item.metricas.efectividad.toFixed(0)}%
                    </span>
                    <span class="top-metrica">
                        <i class="fas fa-box"></i>
                        ${item.metricas.unidades} uds
                    </span>
                </div>
            </div>
        </div>
    `).join('');
}

// ===== CAPACIDAD INSTALADA =====
function actualizarCapacidadInstalada(documentos, porResponsable) {
    const responsables = Object.keys(porResponsable);
    const totalUnidades = documentos.reduce((sum, doc) => sum + doc.cantidad, 0);
    const diasUnicos = new Set(documentos.map(doc => doc.fecha)).size;
    
    const capacidadRealDia = totalUnidades / diasUnicos;
    const capacidadTeoricaDia = METRICAS_CONFIG.CAPACIDAD_DIA_PERSONA * responsables.length;
    const porcentajeCapacidad = ((capacidadRealDia / capacidadTeoricaDia) * 100).toFixed(1);
    
    // Actualizar elementos
    const elemCapacidad = document.getElementById('capacidad-real-valor');
    const elemTeorica = document.getElementById('capacidad-teorica-valor');
    const elemPorcentaje = document.getElementById('capacidad-porcentaje-valor');
    
    if (elemCapacidad) elemCapacidad.textContent = capacidadRealDia.toFixed(0);
    if (elemTeorica) elemTeorica.textContent = capacidadTeoricaDia.toFixed(0);
    if (elemPorcentaje) {
        elemPorcentaje.textContent = `${porcentajeCapacidad}%`;
        elemPorcentaje.className = 'metric-value ' + obtenerClaseEficiencia(parseFloat(porcentajeCapacidad));
    }
}

// ===== CARGAR RESPONSABLES =====
async function cargarResponsablesMetricas() {
    // Usar la lista de responsables ya cargada
    if (window.listaResponsables && window.listaResponsables.length > 0) {
        return;
    }
    
    // Si no está cargada, esperar
    const interval = setInterval(() => {
        if (window.listaResponsables && window.listaResponsables.length > 0) {
            clearInterval(interval);
        }
    }, 100);
}

// ===== INICIALIZACIÓN AL CARGAR =====
document.addEventListener('DOMContentLoaded', function() {
    // Esperar a que datosGlobales esté disponible
    const checkData = setInterval(() => {
        if (typeof datosGlobales !== 'undefined' && datosGlobales.length > 0) {
            clearInterval(checkData);
            console.log('Datos globales disponibles, inicializando métricas...');
            setTimeout(inicializarSistemaMetricas, 1000);
        }
    }, 200);
});

// Exportar funciones
window.inicializarSistemaMetricas = inicializarSistemaMetricas;
window.actualizarMetricas = actualizarMetricas;
