// ===== SISTEMA DE MÉTRICAS DE RENDIMIENTO =====
let metricsData = {
    documentosFinalizados: [],
    rangosFechas: {
        inicio: null,
        fin: null
    },
    configuracion: {
        eficienciaObjetivo: 4, // unidades por minuto
        capacidadObjetivo: 7920, // unidades por persona/día
        efectividadObjetivo: 20, // documentos por persona/día
        jornadaDiaria: 31680, // segundos (8:48:00)
        tiempoMuertoMaximo: 3600, // 1 hora en segundos
        pausasMaximas: 1800 // 30 minutos en segundos
    },
    metricasCalculadas: {},
    topSemanal: []
};

// Elementos DOM
let metricsContainer = null;
let flatpickrMetrics = null;

// ===== INICIALIZACIÓN =====
function inicializarSistemaMetricas() {
    console.log('Inicializando sistema de métricas...');
    
    // Crear contenedor para métricas
    crearEstructuraDOM();
    
    // Inicializar flatpickr para métricas
    inicializarFlatpickrMetricas();
    
    // Cargar datos iniciales
    cargarDatosMetricas();
    
    console.log('Sistema de métricas inicializado');
}

// ===== ESTRUCTURA DOM =====
function crearEstructuraDOM() {
    // Crear panel de métricas debajo de las tarjetas de resumen
    const resumenGrid = document.querySelector('.resumen-grid');
    
    if (!resumenGrid) {
        console.error('No se encontró el contenedor de resumen');
        return;
    }
    
    // Crear panel de métricas
    const metricsPanel = document.createElement('div');
    metricsPanel.id = 'metricsPanel';
    metricsPanel.className = 'metrics-panel fade-in';
    metricsPanel.innerHTML = `
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="card-title mb-0">
                    <i class="fas fa-chart-line me-2"></i>
                    Métricas de Rendimiento
                </h5>
                <div class="header-controls">
                    <div class="control-item flatpickr-control">
                        <input type="text" 
                               class="form-control form-control-sm flatpickr-header-input" 
                               id="filtroFechasMetricas" 
                               placeholder="Rango de fechas para métricas"
                               autocomplete="off">
                    </div>
                    <button class="control-item control-btn" onclick="actualizarMetricas()" title="Actualizar métricas">
                        <i class="fas fa-sync-alt"></i>
                        <span class="hide-xs">Actualizar</span>
                    </button>
                    <button class="control-item control-btn" onclick="toggleMetricsPanel()" title="Mostrar/ocultar panel">
                        <i class="fas fa-chevron-up"></i>
                    </button>
                </div>
            </div>
            <div class="card-body" id="metricsContent">
                <div class="text-center py-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Cargando métricas...</span>
                    </div>
                    <p class="mt-2 text-muted">Cargando métricas de rendimiento...</p>
                </div>
            </div>
        </div>
    `;
    
    // Insertar después del resumen grid
    resumenGrid.parentNode.insertBefore(metricsPanel, resumenGrid.nextSibling);
    
    metricsContainer = metricsPanel;
    
    // Añadir estilos específicos para métricas
    añadirEstilosMetricas();
}

function añadirEstilosMetricas() {
    const styles = `
        <style>
            .metrics-panel {
                margin-bottom: var(--spacing-xl);
            }
            
            .metrics-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                gap: var(--spacing-md);
                margin-bottom: var(--spacing-lg);
            }
            
            .metric-card {
                background: var(--bg-secondary);
                border-radius: var(--radius-lg);
                padding: var(--spacing-lg);
                box-shadow: var(--shadow-sm);
                border: 1px solid var(--border-light);
                transition: all var(--transition-base);
                height: 100%;
                position: relative;
                overflow: hidden;
            }
            
            .metric-card::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 4px;
            }
            
            .metric-card.eficiencia::before { background: var(--info-color); }
            .metric-card.capacidad::before { background: var(--success-color); }
            .metric-card.efectividad::before { background: var(--warning-color); }
            .metric-card.capacidad-instalada::before { background: var(--accent-color); }
            
            .metric-card:hover {
                transform: translateY(-2px);
                box-shadow: var(--shadow-md);
            }
            
            .metric-content {
                display: flex;
                align-items: center;
                gap: var(--spacing-md);
            }
            
            .metric-icon {
                width: 50px;
                height: 50px;
                border-radius: var(--radius-lg);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.5rem;
            }
            
            .metric-card.eficiencia .metric-icon { 
                background: rgba(59, 130, 246, 0.1); 
                color: var(--info-color); 
            }
            .metric-card.capacidad .metric-icon { 
                background: rgba(16, 185, 129, 0.1); 
                color: var(--success-color); 
            }
            .metric-card.efectividad .metric-icon { 
                background: rgba(245, 158, 11, 0.1); 
                color: var(--warning-color); 
            }
            .metric-card.capacidad-instalada .metric-icon { 
                background: rgba(15, 52, 96, 0.1); 
                color: var(--accent-color); 
            }
            
            .metric-info {
                flex: 1;
            }
            
            .metric-value {
                font-size: 1.75rem;
                font-weight: 700;
                line-height: 1;
                margin-bottom: var(--spacing-xs);
                color: var(--text-primary);
                font-variant-numeric: tabular-nums;
            }
            
            .metric-label {
                font-size: 0.875rem;
                font-weight: 600;
                color: var(--text-secondary);
                margin-bottom: var(--spacing-xs);
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }
            
            .metric-target {
                font-size: 0.75rem;
                color: var(--text-muted);
                font-weight: 500;
            }
            
            .chart-container {
                background: var(--bg-secondary);
                border-radius: var(--radius-lg);
                padding: var(--spacing-lg);
                box-shadow: var(--shadow-sm);
                border: 1px solid var(--border-light);
                height: 400px;
                margin-bottom: var(--spacing-lg);
            }
            
            .top-list {
                background: var(--bg-secondary);
                border-radius: var(--radius-lg);
                padding: var(--spacing-lg);
                box-shadow: var(--shadow-sm);
                border: 1px solid var(--border-light);
            }
            
            .top-item {
                display: flex;
                align-items: center;
                padding: var(--spacing-sm) 0;
                border-bottom: 1px solid var(--border-light);
            }
            
            .top-item:last-child {
                border-bottom: none;
            }
            
            .top-posicion {
                width: 24px;
                height: 24px;
                border-radius: var(--radius-full);
                background: var(--accent-color);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 0.75rem;
                font-weight: 600;
                margin-right: var(--spacing-sm);
                flex-shrink: 0;
            }
            
            .top-info {
                flex: 1;
                min-width: 0;
            }
            
            .top-nombre {
                font-weight: 600;
                color: var(--text-primary);
                font-size: 0.875rem;
                margin-bottom: 2px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .top-metricas {
                display: flex;
                gap: var(--spacing-md);
                font-size: 0.75rem;
            }
            
            .top-metrica {
                display: flex;
                align-items: center;
                gap: 4px;
                color: var(--text-muted);
            }
            
            .top-metrica i {
                font-size: 0.625rem;
            }
            
            .eficiencia-baja { color: var(--danger-color); font-weight: 600; }
            .eficiencia-media { color: var(--warning-color); font-weight: 600; }
            .eficiencia-alta { color: var(--success-color); font-weight: 600; }
            
            .metrics-collapsed .card-body {
                display: none;
            }
            
            @media (max-width: 768px) {
                .metric-content {
                    flex-direction: column;
                    text-align: center;
                    gap: var(--spacing-sm);
                }
                
                .metric-icon {
                    width: 40px;
                    height: 40px;
                    font-size: 1.25rem;
                }
                
                .metric-value {
                    font-size: 1.5rem;
                }
                
                .chart-container {
                    height: 300px;
                    padding: var(--spacing-md);
                }
            }
        </style>
    `;
    
    document.head.insertAdjacentHTML('beforeend', styles);
}

// ===== FLATPICKR PARA MÉTRICAS =====
function inicializarFlatpickrMetricas() {
    flatpickrMetrics = flatpickr("#filtroFechasMetricas", {
        mode: "range",
        locale: "es",
        dateFormat: "d/m/Y",
        allowInput: true,
        defaultDate: [getFechaInicioSemana(), getFechaFinSemana()],
        onChange: function(selectedDates, dateStr, instance) {
            if (selectedDates.length === 2) {
                metricsData.rangosFechas.inicio = selectedDates[0];
                metricsData.rangosFechas.fin = selectedDates[1];
                console.log('Rango de fechas para métricas:', metricsData.rangosFechas);
                actualizarMetricas();
            }
        }
    });
    
    // Establecer rango por defecto (última semana)
    const fechaInicio = getFechaInicioSemana();
    const fechaFin = getFechaFinSemana();
    metricsData.rangosFechas.inicio = fechaInicio;
    metricsData.rangosFechas.fin = fechaFin;
}

function getFechaInicioSemana() {
    const hoy = new Date();
    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - hoy.getDay()); // Domingo de esta semana
    inicioSemana.setHours(0, 0, 0, 0);
    return inicioSemana;
}

function getFechaFinSemana() {
    const hoy = new Date();
    const finSemana = new Date(hoy);
    finSemana.setDate(hoy.getDate() + (6 - hoy.getDay())); // Sábado de esta semana
    finSemana.setHours(23, 59, 59, 999);
    return finSemana;
}

// ===== CARGAR DATOS =====
async function cargarDatosMetricas() {
    try {
        console.log('Cargando datos para métricas...');
        
        // Obtener documentos finalizados del rango de fechas
        const documentosFinalizados = await obtenerDocumentosFinalizados();
        metricsData.documentosFinalizados = documentosFinalizados;
        
        // Calcular métricas
        await calcularMetricas();
        
        // Renderizar interfaz
        renderizarMetricas();
        
    } catch (error) {
        console.error('Error cargando datos de métricas:', error);
        mostrarErrorMetricas('Error al cargar los datos de métricas');
    }
}

async function obtenerDocumentosFinalizados() {
    // Usar los mismos datos globales que ya están cargados
    if (!datosGlobales || datosGlobales.length === 0) {
        console.warn('No hay datos globales disponibles');
        return [];
    }
    
    // Filtrar documentos finalizados en el rango de fechas
    const documentosFiltrados = datosGlobales.filter(doc => {
        // Verificar si está finalizado (debes adaptar según tu estructura de datos)
        const estaFinalizado = doc.estado === 'FINALIZADO' || 
                              (doc.DISTRIBUCION && doc.DISTRIBUCION.estado === 'FINALIZADO');
        
        if (!estaFinalizado) return false;
        
        // Verificar rango de fechas
        if (!metricsData.rangosFechas.inicio || !metricsData.rangosFechas.fin) {
            return true; // Si no hay filtro de fecha, incluir todos
        }
        
        const fechaDoc = parsearFechaDocumento(doc.FECHA);
        if (!fechaDoc) return false;
        
        return fechaDoc >= metricsData.rangosFechas.inicio && 
               fechaDoc <= metricsData.rangosFechas.fin;
    });
    
    console.log(`Documentos finalizados encontrados: ${documentosFiltrados.length}`);
    return documentosFiltrados;
}

function parsearFechaDocumento(fechaStr) {
    if (!fechaStr) return null;
    
    try {
        // Formato esperado: "1/11/2025" (día/mes/año)
        const partes = fechaStr.split('/');
        if (partes.length !== 3) return null;
        
        const dia = parseInt(partes[0], 10);
        const mes = parseInt(partes[1], 10);
        const año = parseInt(partes[2], 10);
        
        if (isNaN(dia) || isNaN(mes) || isNaN(año)) return null;
        
        const fecha = new Date(año, mes - 1, dia);
        return isNaN(fecha.getTime()) ? null : fecha;
    } catch (e) {
        console.error('Error parseando fecha del documento:', e);
        return null;
    }
}

// ===== CÁLCULO DE MÉTRICAS =====
async function calcularMetricas() {
    console.log('Calculando métricas de rendimiento...');
    
    const documentos = metricsData.documentosFinalizados;
    
    if (documentos.length === 0) {
        console.warn('No hay documentos para calcular métricas');
        metricsData.metricasCalculadas = {};
        metricsData.topSemanal = [];
        return;
    }
    
    // Agrupar por responsable
    const metricasPorResponsable = agruparPorResponsable(documentos);
    
    // Calcular métricas individuales
    const metricasCalculadas = calcularMetricasIndividuales(metricasPorResponsable);
    
    // Calcular métricas generales del equipo
    const metricasGenerales = calcularMetricasGenerales(metricasCalculadas);
    
    // Generar top semanal
    const topSemanal = generarTopSemanal(metricasCalculadas);
    
    metricsData.metricasCalculadas = {
        individuales: metricasCalculadas,
        generales: metricasGenerales
    };
    
    metricsData.topSemanal = topSemanal;
    
    console.log('Métricas calculadas:', metricsData.metricasCalculadas);
    console.log('Top semanal:', metricsData.topSemanal);
}

function agruparPorResponsable(documentos) {
    const agrupados = {};
    
    documentos.forEach(doc => {
        const responsable = doc.COLABORADOR || doc.DISTRIBUCION?.Colaborador || 'Sin responsable';
        
        if (!agrupados[responsable]) {
            agrupados[responsable] = {
                documentos: [],
                totalUnidades: 0,
                totalDuracion: 0,
                totalPausas: 0
            };
        }
        
        agrupados[responsable].documentos.push(doc);
        agrupados[responsable].totalUnidades += parseInt(doc.CANTIDAD) || 0;
        
        // Calcular duración (necesitas adaptar según tu estructura de datos)
        const duracion = calcularDuracionDocumento(doc);
        agrupados[responsable].totalDuracion += duracion;
        
        // Calcular pausas (necesitas adaptar según tu estructura de datos)
        const pausas = calcularPausasDocumento(doc);
        agrupados[responsable].totalPausas += pausas;
    });
    
    return agrupados;
}

function calcularDuracionDocumento(doc) {
    // Adaptar según tu estructura de datos
    // Esto es un ejemplo - debes ajustarlo a tu estructura real
    if (doc.duracion_guardada) {
        return tiempoAMilisegundos(doc.duracion_guardada) / 1000; // Convertir a segundos
    }
    
    // Fallback: estimar basado en cantidad
    const cantidad = parseInt(doc.CANTIDAD) || 1;
    return cantidad * 60; // 1 minuto por unidad como estimación
}

function calcularPausasDocumento(doc) {
    // Adaptar según tu estructura de datos
    // Esto es un ejemplo - debes ajustarlo a tu estructura real
    if (doc.duracion_pausas) {
        return tiempoAMilisegundos(doc.duracion_pausas) / 1000; // Convertir a segundos
    }
    
    return 0; // Sin pausas registradas
}

function tiempoAMilisegundos(tiempo) {
    if (!tiempo) return 0;
    try {
        const partes = tiempo.split(":");
        const horas = parseInt(partes[0]) || 0;
        const minutos = parseInt(partes[1]) || 0;
        const segundos = parseInt(partes[2]) || 0;
        return (horas * 3600 + minutos * 60 + segundos) * 1000;
    } catch (e) {
        console.error("Error convirtiendo tiempo a ms:", e);
        return 0;
    }
}

function calcularMetricasIndividuales(agrupados) {
    const metricas = {};
    const config = metricsData.configuracion;
    
    Object.keys(agrupados).forEach(responsable => {
        const data = agrupados[responsable];
        const diasTrabajados = calcularDiasTrabajados(data.documentos);
        
        // Eficiencia = unidades / tiempo (unidades por minuto)
        const eficiencia = data.totalDuracion > 0 ? 
            (data.totalUnidades / (data.totalDuracion / 60)) : 0;
        
        // Capacidad = unidades por día
        const capacidad = diasTrabajados > 0 ? 
            (data.totalUnidades / diasTrabajados) : 0;
        
        // Efectividad = documentos por día
        const efectividad = diasTrabajados > 0 ? 
            (data.documentos.length / diasTrabajados) : 0;
        
        // Tiempos muertos = duración total - (jornada * días)
        const tiempoMuerto = Math.max(0, data.totalDuracion - (config.jornadaDiaria * diasTrabajados));
        
        // Porcentajes de cumplimiento
        const porcentajeEficiencia = (eficiencia / config.eficienciaObjetivo) * 100;
        const porcentajeCapacidad = (capacidad / config.capacidadObjetivo) * 100;
        const porcentajeEfectividad = (efectividad / config.efectividadObjetivo) * 100;
        
        metricas[responsable] = {
            documentos: data.documentos.length,
            totalUnidades: data.totalUnidades,
            totalDuracion: data.totalDuracion,
            totalPausas: data.totalPausas,
            diasTrabajados: diasTrabajados,
            eficiencia: eficiencia,
            capacidad: capacidad,
            efectividad: efectividad,
            tiempoMuerto: tiempoMuerto,
            porcentajeEficiencia: porcentajeEficiencia,
            porcentajeCapacidad: porcentajeCapacidad,
            porcentajeEfectividad: porcentajeEfectividad,
            cumplimientoTiempoMuerto: tiempoMuerto <= config.tiempoMuertoMaximo,
            cumplimientoPausas: data.totalPausas <= config.pausasMaximas
        };
    });
    
    return metricas;
}

function calcularDiasTrabajados(documentos) {
    // Contar días únicos con documentos
    const diasUnicos = new Set();
    
    documentos.forEach(doc => {
        if (doc.FECHA) {
            const fecha = parsearFechaDocumento(doc.FECHA);
            if (fecha) {
                diasUnicos.add(fecha.toDateString());
            }
        }
    });
    
    return Math.max(diasUnicos.size, 1); // Mínimo 1 día
}

function calcularMetricasGenerales(metricasIndividuales) {
    const responsables = Object.keys(metricasIndividuales);
    if (responsables.length === 0) return {};
    
    const config = metricsData.configuracion;
    
    // Promedios del equipo
    const promedios = {
        eficiencia: 0,
        capacidad: 0,
        efectividad: 0,
        tiempoMuerto: 0
    };
    
    // Sumar métricas
    responsables.forEach(responsable => {
        const metrica = metricasIndividuales[responsable];
        promedios.eficiencia += metrica.eficiencia;
        promedios.capacidad += metrica.capacidad;
        promedios.efectividad += metrica.efectividad;
        promedios.tiempoMuerto += metrica.tiempoMuerto;
    });
    
    // Calcular promedios
    promedios.eficiencia /= responsables.length;
    promedios.capacidad /= responsables.length;
    promedios.efectividad /= responsables.length;
    promedios.tiempoMuerto /= responsables.length;
    
    // Capacidad instalada real (considerando eficiencia de cada colaborador)
    let capacidadInstaladaReal = 0;
    responsables.forEach(responsable => {
        const metrica = metricasIndividuales[responsable];
        const eficienciaRelativa = metrica.eficiencia / config.eficienciaObjetivo;
        capacidadInstaladaReal += config.capacidadObjetivo * Math.min(eficienciaRelativa, 1);
    });
    
    return {
        totalResponsables: responsables.length,
        totalDocumentos: metricsData.documentosFinalizados.length,
        totalUnidades: Object.values(metricasIndividuales).reduce((sum, m) => sum + m.totalUnidades, 0),
        promedios: promedios,
        capacidadInstaladaReal: capacidadInstaladaReal,
        porcentajeCapacidadInstalada: (capacidadInstaladaReal / (config.capacidadObjetivo * responsables.length)) * 100
    };
}

function generarTopSemanal(metricasIndividuales) {
    const responsables = Object.keys(metricasIndividuales);
    
    if (responsables.length === 0) return [];
    
    // Calcular puntuación compuesta para ranking
    const ranking = responsables.map(responsable => {
        const metrica = metricasIndividuales[responsable];
        const config = metricsData.configuracion;
        
        // Puntuación basada en eficiencia, capacidad y cumplimiento de tiempos
        let puntuacion = (
            (metrica.porcentajeEficiencia / 100) * 40 + // 40% eficiencia
            (metrica.porcentajeCapacidad / 100) * 35 +  // 35% capacidad
            (metrica.porcentajeEfectividad / 100) * 15 + // 15% efectividad
            (metrica.cumplimientoTiempoMuerto ? 5 : 0) + // 5% tiempo muerto
            (metrica.cumplimientoPausas ? 5 : 0)         // 5% pausas
        );
        
        return {
            responsable: responsable,
            puntuacion: puntuacion,
            eficiencia: metrica.eficiencia,
            capacidad: metrica.capacidad,
            efectividad: metrica.efectividad,
            documentos: metrica.documentos,
            unidades: metrica.totalUnidades
        };
    });
    
    // Ordenar por puntuación descendente
    ranking.sort((a, b) => b.puntuacion - a.puntuacion);
    
    return ranking.slice(0, 5); // Top 5
}

// ===== RENDERIZADO =====
function renderizarMetricas() {
    const content = document.getElementById('metricsContent');
    
    if (!content) {
        console.error('No se encontró el contenedor de métricas');
        return;
    }
    
    if (metricsData.documentosFinalizados.length === 0) {
        content.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-chart-bar fa-3x text-muted mb-3"></i>
                <h5 class="text-muted">No hay datos disponibles</h5>
                <p class="text-muted">No se encontraron documentos finalizados en el rango de fechas seleccionado.</p>
            </div>
        `;
        return;
    }
    
    const { generales, individuales } = metricsData.metricasCalculadas;
    const topSemanal = metricsData.topSemanal;
    
    content.innerHTML = `
        <!-- Métricas Generales -->
        <div class="metrics-grid">
            <div class="metric-card eficiencia">
                <div class="metric-content">
                    <div class="metric-icon">
                        <i class="fas fa-tachometer-alt"></i>
                    </div>
                    <div class="metric-info">
                        <div class="metric-label">Eficiencia Promedio</div>
                        <div class="metric-value">${generales.promedios.eficiencia.toFixed(2)}</div>
                        <div class="metric-target">Objetivo: ${metricsData.configuracion.eficienciaObjetivo} und/min</div>
                    </div>
                </div>
            </div>
            
            <div class="metric-card capacidad">
                <div class="metric-content">
                    <div class="metric-icon">
                        <i class="fas fa-boxes"></i>
                    </div>
                    <div class="metric-info">
                        <div class="metric-label">Capacidad Promedio</div>
                        <div class="metric-value">${generales.promedios.capacidad.toFixed(0)}</div>
                        <div class="metric-target">Objetivo: ${metricsData.configuracion.capacidadObjetivo} und/día</div>
                    </div>
                </div>
            </div>
            
            <div class="metric-card efectividad">
                <div class="metric-content">
                    <div class="metric-icon">
                        <i class="fas fa-clipboard-check"></i>
                    </div>
                    <div class="metric-info">
                        <div class="metric-label">Efectividad Promedio</div>
                        <div class="metric-value">${generales.promedios.efectividad.toFixed(1)}</div>
                        <div class="metric-target">Objetivo: ${metricsData.configuracion.efectividadObjetivo} doc/día</div>
                    </div>
                </div>
            </div>
            
            <div class="metric-card capacidad-instalada">
                <div class="metric-content">
                    <div class="metric-icon">
                        <i class="fas fa-users"></i>
                    </div>
                    <div class="metric-info">
                        <div class="metric-label">Capacidad Instalada</div>
                        <div class="metric-value">${generales.capacidadInstaladaReal.toFixed(0)}</div>
                        <div class="metric-target">${generales.porcentajeCapacidadInstalada.toFixed(1)}% del potencial</div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Gráfica Spider -->
        <div class="chart-container">
            <h6 class="text-center mb-3">Rendimiento por Responsable</h6>
            <canvas id="spiderChart"></canvas>
        </div>
        
        <!-- Top Semanal -->
        <div class="row">
            <div class="col-md-6">
                <div class="top-list">
                    <h6 class="mb-3">Top 5 Semanal</h6>
                    ${topSemanal.length > 0 ? 
                        topSemanal.map((item, index) => `
                            <div class="top-item">
                                <div class="top-posicion">${index + 1}</div>
                                <div class="top-info">
                                    <div class="top-nombre">${item.responsable}</div>
                                    <div class="top-metricas">
                                        <div class="top-metrica">
                                            <i class="fas fa-tachometer-alt"></i>
                                            ${item.eficiencia.toFixed(2)}
                                        </div>
                                        <div class="top-metrica">
                                            <i class="fas fa-boxes"></i>
                                            ${item.capacidad.toFixed(0)}
                                        </div>
                                        <div class="top-metrica">
                                            <i class="fas fa-file"></i>
                                            ${item.documentos}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('') : 
                        '<p class="text-muted text-center py-3">No hay datos para el top semanal</p>'
                    }
                </div>
            </div>
            
            <div class="col-md-6">
                <div class="top-list">
                    <h6 class="mb-3">Detalle de Métricas</h6>
                    <div class="table-responsive">
                        <table class="table table-sm" id="tablaMetricas">
                            <thead>
                                <tr>
                                    <th>Responsable</th>
                                    <th>Eficiencia</th>
                                    <th>Capacidad</th>
                                    <th>Efectividad</th>
                                    <th>T. Muerto</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${Object.keys(individuales).map(responsable => {
                                    const metrica = individuales[responsable];
                                    const claseEficiencia = metrica.porcentajeEficiencia >= 100 ? 'eficiencia-alta' : 
                                                          metrica.porcentajeEficiencia >= 80 ? 'eficiencia-media' : 
                                                          'eficiencia-baja';
                                    
                                    return `
                                        <tr>
                                            <td class="small">${responsable}</td>
                                            <td class="${claseEficiencia}">${metrica.eficiencia.toFixed(2)}</td>
                                            <td>${metrica.capacidad.toFixed(0)}</td>
                                            <td>${metrica.efectividad.toFixed(1)}</td>
                                            <td>${(metrica.tiempoMuerto / 60).toFixed(1)} min</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Inicializar gráfica spider
    inicializarSpiderChart(individuales);
}

function inicializarSpiderChart(metricasIndividuales) {
    const ctx = document.getElementById('spiderChart');
    if (!ctx) return;
    
    const responsables = Object.keys(metricasIndividuales);
    if (responsables.length === 0) return;
    
    const config = metricsData.configuracion;
    
    // Preparar datos para la gráfica
    const datasets = responsables.map((responsable, index) => {
        const metrica = metricasIndividuales[responsable];
        const colores = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
        
        return {
            label: responsable,
            data: [
                (metrica.eficiencia / config.eficienciaObjetivo) * 100, // Eficiencia (% del objetivo)
                (metrica.capacidad / config.capacidadObjetivo) * 100,   // Capacidad (% del objetivo)
                (metrica.efectividad / config.efectividadObjetivo) * 100, // Efectividad (% del objetivo)
                Math.max(0, 100 - (metrica.tiempoMuerto / config.tiempoMuertoMaximo) * 100), // Tiempo muerto (invertido)
                Math.max(0, 100 - (metrica.totalPausas / config.pausasMaximas) * 100) // Pausas (invertido)
            ],
            backgroundColor: `${colores[index % colores.length]}20`,
            borderColor: colores[index % colores.length],
            pointBackgroundColor: colores[index % colores.length],
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: colores[index % colores.length]
        };
    });
    
    // Crear gráfica spider
    new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Eficiencia', 'Capacidad', 'Efectividad', 'Tiempo Muerto', 'Pausas'],
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: {
                        display: true
                    },
                    suggestedMin: 0,
                    suggestedMax: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.dataset.label || '';
                            const value = context.raw;
                            const metric = context.chart.data.labels[context.dataIndex];
                            return `${label}: ${value.toFixed(1)}%`;
                        }
                    }
                }
            }
        }
    });
}

// ===== FUNCIONES DE INTERFAZ =====
function toggleMetricsPanel() {
    if (metricsContainer) {
        metricsContainer.classList.toggle('metrics-collapsed');
        const icon = metricsContainer.querySelector('.fa-chevron-up');
        if (icon) {
            icon.classList.toggle('fa-chevron-up');
            icon.classList.toggle('fa-chevron-down');
        }
    }
}

function actualizarMetricas() {
    console.log('Actualizando métricas...');
    cargarDatosMetricas();
}

function mostrarErrorMetricas(mensaje) {
    const content = document.getElementById('metricsContent');
    if (content) {
        content.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                ${mensaje}
            </div>
        `;
    }
}

// ===== INICIALIZACIÓN AUTOMÁTICA =====
// Esperar a que el DOM esté listo y los datos globales estén cargados
document.addEventListener('DOMContentLoaded', function() {
    // Esperar a que los datos globales estén disponibles
    const checkDataLoaded = setInterval(() => {
        if (typeof datosGlobales !== 'undefined') {
            clearInterval(checkDataLoaded);
            inicializarSistemaMetricas();
        }
    }, 100);
    
    // Timeout de seguridad
    setTimeout(() => {
        clearInterval(checkDataLoaded);
        if (typeof datosGlobales === 'undefined') {
            console.warn('No se detectaron datos globales, inicializando sistema de métricas con datos vacíos');
            datosGlobales = [];
            inicializarSistemaMetricas();
        }
    }, 5000);
});
