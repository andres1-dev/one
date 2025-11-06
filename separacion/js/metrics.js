// ===== SISTEMA DE MÉTRICAS DE RENDIMIENTO - VERSIÓN CORREGIDA =====
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
    console.log('🔧 Inicializando sistema de métricas...');
    
    // Verificar que Chart.js esté disponible
    if (typeof Chart === 'undefined') {
        console.error('❌ Chart.js no está cargado');
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Chart.js no está disponible. Por favor recarga la página.',
            timer: 3000
        });
        return;
    }
    
    console.log('✅ Chart.js disponible');
    
    // Inicializar flatpickr de métricas (INDEPENDIENTE)
    const inputFechas = document.getElementById('filtroFechasMetricas');
    if (inputFechas) {
        try {
            // Destruir instancia anterior si existe
            if (flatpickrMetricas) {
                flatpickrMetricas.destroy();
            }
            
            const fechaInicio = obtenerInicioSemana();
            const fechaFin = obtenerFinSemana();
            
            flatpickrMetricas = flatpickr(inputFechas, {
                mode: "range",
                locale: "es",
                dateFormat: "d/m/Y",
                allowInput: false,
                defaultDate: [fechaInicio, fechaFin],
                onChange: function(selectedDates) {
                    console.log('📅 Fechas métricas cambiadas:', selectedDates);
                    if (selectedDates.length === 2) {
                        rangoFechasMetricas = selectedDates;
                        actualizarMetricas();
                    }
                }
            });
            
            rangoFechasMetricas = [fechaInicio, fechaFin];
            console.log('✅ Flatpickr métricas inicializado correctamente');
        } catch (error) {
            console.error('❌ Error inicializando flatpickr métricas:', error);
        }
    } else {
        console.error('❌ No se encontró el input #filtroFechasMetricas');
    }
    
    // Cargar métricas iniciales
    setTimeout(() => {
        console.log('🔄 Cargando métricas iniciales...');
        actualizarMetricas();
    }, 500);
}

// ===== FUNCIONES DE FECHA =====
function obtenerInicioSemana() {
    const hoy = new Date();
    const dia = hoy.getDay();
    const diff = hoy.getDate() - dia + (dia === 0 ? -6 : 1);
    const inicio = new Date(hoy.setDate(diff));
    inicio.setHours(0, 0, 0, 0);
    return inicio;
}

function obtenerFinSemana() {
    const inicio = obtenerInicioSemana();
    const fin = new Date(inicio);
    fin.setDate(inicio.getDate() + 6);
    fin.setHours(23, 59, 59, 999);
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
        
        const fecha = new Date(año, mes - 1, dia);
        fecha.setHours(0, 0, 0, 0);
        return fecha;
    } catch (e) {
        console.error('Error parseando fecha:', e, fechaStr);
        return null;
    }
}

// ===== OBTENCIÓN DE DATOS =====
async function obtenerDocumentosFinalizados() {
    const SPREADSHEET_ID = "1d5dCCCgiWXfM6vHu3zGGKlvK2EycJtT7Uk4JqUjDOfE";
    const API_KEY = 'AIzaSyC7hjbRc0TGLgImv8gVZg8tsOeYWgXlPcM';
    
    try {
        console.log('📊 Obteniendo documentos finalizados...');
        
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/DATA!A2:K?key=${API_KEY}`;
        const response = await fetch(url);
        
        if (!response.ok) throw new Error('Error al obtener datos');
        
        const data = await response.json();
        const values = data.values || [];
        
        console.log(`📄 Documentos totales en DATA: ${values.length}`);
        
        // Crear mapa de datosGlobales para búsqueda rápida
        const datosMap = new Map();
        if (window.datosGlobales && Array.isArray(window.datosGlobales)) {
            window.datosGlobales.forEach(item => {
                if (item.REC) {
                    datosMap.set(String(item.REC), item);
                }
            });
        }
        
        console.log(`🗂️ Datos globales mapeados: ${datosMap.size}`);
        
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
                const datosCompletos = datosMap.get(rec);
                const cantidad = datosCompletos ? (parseInt(datosCompletos.CANTIDAD) || 0) : 0;
                
                return {
                    rec: rec,
                    fecha: fechaSolo,
                    fecha_objeto: parsearFechaMetricas(fechaSolo),
                    colaborador: String(row[4] || '').trim(),
                    duracion_guardada: row[7] || '00:00:00',
                    duracion_pausas: row[10] || '00:00:00',
                    cantidad: cantidad,
                    datosCompletos: datosCompletos
                };
            })
            .filter(doc => {
                const valido = doc.fecha_objeto !== null && doc.cantidad > 0 && doc.colaborador !== '';
                if (!valido) {
                    console.log(`⚠️ Documento filtrado REC${doc.rec}: fecha=${doc.fecha_objeto !== null}, cantidad=${doc.cantidad}, colaborador=${doc.colaborador !== ''}`);
                }
                return valido;
            });
        
        console.log(`✅ Documentos finalizados válidos: ${finalizados.length}`);
        return finalizados;
        
    } catch (error) {
        console.error('❌ Error obteniendo documentos finalizados:', error);
        return [];
    }
}

function filtrarPorRangoFechas(documentos) {
    if (!rangoFechasMetricas || rangoFechasMetricas.length !== 2) {
        console.log('⚠️ No hay rango de fechas definido, mostrando todos');
        return documentos;
    }
    
    const fechaInicio = new Date(rangoFechasMetricas[0]);
    fechaInicio.setHours(0, 0, 0, 0);
    
    const fechaFin = new Date(rangoFechasMetricas[1]);
    fechaFin.setHours(23, 59, 59, 999);
    
    console.log(`📅 Filtrando desde ${fechaInicio.toLocaleDateString()} hasta ${fechaFin.toLocaleDateString()}`);
    
    const filtrados = documentos.filter(doc => {
        return doc.fecha_objeto >= fechaInicio && doc.fecha_objeto <= fechaFin;
    });
    
    console.log(`📊 Documentos en rango: ${filtrados.length} de ${documentos.length}`);
    return filtrados;
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
    const porcentaje = (METRICAS_CONFIG.EFICIENCIA_TARGET / segundosPorUnidad) * 100;
    return Math.min(Math.max(porcentaje, 0), 150);
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
    if (diasTrabajados === 0) return 100;
    const jornadaTotalEsperada = METRICAS_CONFIG.JORNADA_SEGUNDOS * diasTrabajados;
    const tiempoMuerto = Math.max(0, duracionTotalSegundos - jornadaTotalEsperada);
    const tiempoMuertoPorDia = tiempoMuerto / diasTrabajados;
    const porcentaje = 100 - ((tiempoMuertoPorDia / METRICAS_CONFIG.TIEMPO_MUERTO_MAX) * 100);
    return Math.min(Math.max(porcentaje, 0), 100);
}

function calcularPausas(pausasTotalSegundos, diasTrabajados) {
    if (diasTrabajados === 0) return 100;
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
    console.log('🔄 Actualizando métricas...');
    
    try {
        mostrarLoadingMetricas(true);
        
        const documentos = await obtenerDocumentosFinalizados();
        
        if (documentos.length === 0) {
            console.log('⚠️ No hay documentos finalizados');
            mostrarMensajeVacio();
            mostrarLoadingMetricas(false);
            return;
        }
        
        const documentosFiltrados = filtrarPorRangoFechas(documentos);
        
        if (documentosFiltrados.length === 0) {
            console.log('⚠️ No hay documentos en el rango de fechas');
            mostrarMensajeVacio();
            mostrarLoadingMetricas(false);
            return;
        }
        
        // Agrupar por responsable
        const porResponsable = {};
        documentosFiltrados.forEach(doc => {
            const resp = doc.colaborador || 'Sin asignar';
            if (!porResponsable[resp]) {
                porResponsable[resp] = [];
            }
            porResponsable[resp].push(doc);
        });
        
        console.log(`👥 Responsables encontrados: ${Object.keys(porResponsable).length}`);
        
        // Calcular métricas por responsable
        const metricasPorResponsable = {};
        Object.keys(porResponsable).forEach(resp => {
            metricasPorResponsable[resp] = calcularMetricasResponsable(porResponsable[resp]);
            console.log(`📊 ${resp}:`, metricasPorResponsable[resp]);
        });
        
        // Actualizar interfaz
        actualizarTarjetasMetricas(metricasPorResponsable);
        actualizarGraficoRadar(metricasPorResponsable);
        actualizarTopSemanal(metricasPorResponsable);
        actualizarCapacidadInstalada(documentosFiltrados, porResponsable);
        
        mostrarLoadingMetricas(false);
        console.log('✅ Métricas actualizadas correctamente');
        
    } catch (error) {
        console.error('❌ Error actualizando métricas:', error);
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

function mostrarMensajeVacio() {
    // Limpiar tarjetas
    const tarjetas = ['metrica-eficiencia', 'metrica-capacidad', 'metrica-efectividad', 'metrica-capacidad-instalada'];
    tarjetas.forEach(id => {
        const elem = document.getElementById(id);
        if (elem) elem.textContent = '0%';
    });
    
    // Mensaje en gráfico
    const canvas = document.getElementById('chartRadar');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        if (chartRadar) chartRadar.destroy();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '14px Arial';
        ctx.fillStyle = '#999';
        ctx.textAlign = 'center';
        ctx.fillText('No hay datos en el rango seleccionado', canvas.width / 2, canvas.height / 2);
    }
    
    // Limpiar top
    const topLista = document.getElementById('top-semanal-lista');
    if (topLista) {
        topLista.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-chart-bar" style="font-size: 2rem; opacity: 0.3;"></i>
                <p class="small mt-2">No hay datos disponibles</p>
            </div>
        `;
    }
}

// ===== ACTUALIZACIÓN DE INTERFAZ =====
function actualizarTarjetasMetricas(metricas) {
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
    
    const tarjetas = {
        'metrica-eficiencia': { valor: promedios.eficiencia },
        'metrica-capacidad': { valor: promedios.capacidad },
        'metrica-efectividad': { valor: promedios.efectividad },
        'metrica-capacidad-instalada': { valor: calcularCapacidadInstaladaTotal(metricas) }
    };
    
    Object.keys(tarjetas).forEach(id => {
        const elem = document.getElementById(id);
        if (elem) {
            const info = tarjetas[id];
            elem.textContent = `${info.valor}%`;
            elem.className = 'metric-value ' + obtenerClaseEficiencia(parseFloat(info.valor));
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
    
    let respActual = responsableSeleccionado;
    
    if (!respActual || !metricas[respActual]) {
        respActual = responsables[0];
        responsableSeleccionado = respActual;
    }
    
    const datos = metricas[respActual];
    
    const ctx = document.getElementById('chartRadar');
    if (!ctx) {
        console.error('❌ No se encontró canvas #chartRadar');
        return;
    }
    
    if (chartRadar) {
        chartRadar.destroy();
    }
    
    try {
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
        
        console.log('✅ Gráfico radar creado');
    } catch (error) {
        console.error('❌ Error creando gráfico radar:', error);
    }
    
    actualizarSelectorResponsable(responsables, respActual);
}

function actualizarSelectorResponsable(responsables, seleccionado) {
    const select = document.getElementById('selector-responsable-metricas');
    if (!select) return;
    
    select.innerHTML = responsables.map(resp => 
        `<option value="${resp}" ${resp === seleccionado ? 'selected' : ''}>${resp}</option>`
    ).join('');
    
    select.onchange = function() {
        responsableSeleccionado = this.value;
        actualizarMetricas();
    };
}

// ===== TOP SEMANAL =====
function actualizarTopSemanal(metricas) {
    const responsables = Object.keys(metricas);
    if (responsables.length === 0) return;
    
    const ranking = responsables.map(resp => {
        const m = metricas[resp];
        const score = (m.eficiencia + m.capacidad + m.efectividad + m.tiempoMuerto + m.pausas) / 5;
        return {
            nombre: resp,
            score: score,
            metricas: m
        };
    }).sort((a, b) => b.score - a.score);
    
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

// ===== INICIALIZACIÓN AL CARGAR =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM cargado, esperando datos globales...');
    
    let intentos = 0;
    const maxIntentos = 50;
    
    const checkData = setInterval(() => {
        intentos++;
        
        if (typeof datosGlobales !== 'undefined' && datosGlobales.length > 0) {
            clearInterval(checkData);
            console.log(`✅ Datos globales disponibles (${datosGlobales.length} registros)`);
            setTimeout(inicializarSistemaMetricas, 1000);
        } else if (intentos >= maxIntentos) {
            clearInterval(checkData);
            console.error('❌ Timeout esperando datos globales');
        }
    }, 200);
});

// Exportar funciones
window.inicializarSistemaMetricas = inicializarSistemaMetricas;
window.actualizarMetricas = actualizarMetricas;

console.log('📦 metrics.js cargado correctamente');
