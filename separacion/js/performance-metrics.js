// performance-metrics.js - VERSIÓN CORREGIDA
// Sistema de medición de rendimiento para documentos finalizados

let metricsData = {
    selectedDates: null,
    selectedResponsable: null,
    metrics: {},
    topWeekly: [],
    allResponsables: [],
    selectedUsersForChart: []
};

// Configuración de métricas
const METRICS_CONFIG = {
    eficiencia: {
        target: 4, // segundos por unidad
        description: "Tiempo promedio por unidad"
    },
    capacidad: {
        target: 7920, // unidades por persona/día
        description: "Capacidad máxima teórica"
    },
    efectividad: {
        target: 20, // documentos por día
        description: "Documentos finalizados por día"
    },
    tiemposMuertos: {
        target: 3600, // 1 hora en segundos
        description: "Tiempos muertos máximos"
    },
    pausas: {
        target: 1800, // 30 minutos en segundos
        description: "Pausas máximas"
    }
};

// Inicializar el sistema de métricas
function inicializarSistemaMetricas() {
    console.log('Inicializando sistema de métricas...');
    
    // Agregar botón de estadísticas al header
    agregarBotonEstadisticas();
    
    // Inicializar modal de estadísticas
    inicializarModalEstadisticas();
}

// Agregar botón de estadísticas al header
function agregarBotonEstadisticas() {
    const headerControls = document.querySelector('.header-controls');
    if (!headerControls) {
        console.warn('No se encontró header-controls, reintentando en 1 segundo...');
        setTimeout(agregarBotonEstadisticas, 1000);
        return;
    }

    // Verificar si el botón ya existe
    if (document.getElementById('btnEstadisticas')) {
        return;
    }

    const botonEstadisticas = document.createElement('button');
    botonEstadisticas.className = 'control-item control-btn';
    botonEstadisticas.id = 'btnEstadisticas';
    botonEstadisticas.innerHTML = `
        <i class="fas fa-chart-line"></i>
        <span class="hide-xs">Estadísticas</span>
    `;
    botonEstadisticas.title = 'Ver estadísticas de rendimiento';
    botonEstadisticas.onclick = mostrarModalEstadisticas;

    // Insertar antes del botón móvil
    const mobileBtn = document.querySelector('.mobile-menu-btn');
    if (mobileBtn) {
        headerControls.insertBefore(botonEstadisticas, mobileBtn);
    } else {
        headerControls.appendChild(botonEstadisticas);
    }

    console.log('Botón de estadísticas agregado');
}

// Inicializar modal de estadísticas
function inicializarModalEstadisticas() {
    // Crear modal si no existe
    if (!document.getElementById('metricsModal')) {
        const modalHTML = `
            <div class="modal fade" id="metricsModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-chart-line me-2"></i>
                                Estadísticas de Rendimiento
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <!-- Filtros -->
                            <div class="row mb-4">
                                <div class="col-md-6">
                                    <label class="form-label">Rango de Fechas</label>
                                    <input type="text" class="form-control" id="metricsDateRange" placeholder="Seleccionar rango">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Responsable</label>
                                    <select class="form-select" id="metricsResponsable">
                                        <option value="">Todos los responsables</option>
                                    </select>
                                </div>
                            </div>
                            
                            <!-- Selector de Usuarios para Gráfica -->
                            <div class="card mb-4">
                                <div class="card-header">
                                    <h6 class="mb-0">
                                        <i class="fas fa-users me-2"></i>
                                        Seleccionar Usuarios para Comparación
                                    </h6>
                                </div>
                                <div class="card-body">
                                    <div id="usersSelector" class="row">
                                        <!-- Los checkboxes de usuarios se cargarán aquí -->
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Métricas Principales -->
                            <div class="row mb-4" id="metricsCards">
                                <!-- Las métricas se cargarán aquí -->
                            </div>
                            
                            <!-- Gráfica Spider -->
                            <div class="card mb-4">
                                <div class="card-header">
                                    <h6 class="mb-0">Comparación de Rendimiento</h6>
                                </div>
                                <div class="card-body">
                                    <canvas id="spiderChart" height="300"></canvas>
                                </div>
                            </div>
                            
                            <!-- Top Semanal -->
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="card">
                                        <div class="card-header">
                                            <h6 class="mb-0">Top Semanal - Eficiencia</h6>
                                        </div>
                                        <div class="card-body">
                                            <div id="topEficiencia">
                                                <!-- Top se cargará aquí -->
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="card">
                                        <div class="card-header">
                                            <h6 class="mb-0">Resumen del Equipo</h6>
                                        </div>
                                        <div class="card-body">
                                            <div id="teamSummary">
                                                <!-- Resumen del equipo se cargará aquí -->
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                            <button type="button" class="btn btn-primary" onclick="generarReporteCompleto()">
                                <i class="fas fa-download me-1"></i>Exportar Reporte
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // Inicializar flatpickr para métricas
    setTimeout(() => {
        const flatpickrInstance = flatpickr("#metricsDateRange", {
            mode: "range",
            locale: "es",
            dateFormat: "d/m/Y",
            allowInput: true,
            onChange: function(selectedDates, dateStr) {
                console.log('Fechas seleccionadas en métricas:', selectedDates);
                if (selectedDates.length === 2) {
                    metricsData.selectedDates = selectedDates;
                    cargarMetricasIniciales();
                } else if (selectedDates.length === 0) {
                    metricsData.selectedDates = null;
                    cargarMetricasIniciales();
                }
            }
        });
        
        // Hacer disponible globalmente
        window.metricsFlatpickr = flatpickrInstance;
    }, 500);
}

// Mostrar modal de estadísticas
function mostrarModalEstadisticas() {
    const modal = new bootstrap.Modal(document.getElementById('metricsModal'));
    
    // Cargar datos iniciales
    cargarResponsablesParaMetricas();
    cargarMetricasIniciales();
    
    modal.show();
}

// Cargar responsables para el selector de métricas
async function cargarResponsablesParaMetricas() {
    const select = document.getElementById('metricsResponsable');
    if (!select) return;

    try {
        // Obtener responsables únicos de documentos finalizados
        const responsables = await obtenerResponsablesFinalizados();
        metricsData.allResponsables = responsables;
        
        // Limpiar opciones existentes (excepto la primera)
        while (select.options.length > 1) {
            select.remove(1);
        }
        
        // Agregar responsables
        responsables.forEach(responsable => {
            if (responsable && responsable.trim() !== '') {
                const option = document.createElement('option');
                option.value = responsable;
                option.textContent = responsable;
                select.appendChild(option);
            }
        });
        
        // Cargar selector de usuarios para gráfica
        cargarSelectorUsuariosGrafica(responsables);
        
    } catch (error) {
        console.error('Error cargando responsables para métricas:', error);
    }
}

// Cargar selector de usuarios para gráfica spider
function cargarSelectorUsuariosGrafica(responsables) {
    const container = document.getElementById('usersSelector');
    if (!container) return;

    const html = responsables.map((responsable, index) => `
        <div class="col-md-4 col-sm-6 mb-2">
            <div class="form-check">
                <input class="form-check-input user-checkbox" 
                       type="checkbox" 
                       value="${responsable}" 
                       id="user-${index}"
                       ${index < 3 ? 'checked' : ''} 
                       onchange="actualizarGraficaSpider()">
                <label class="form-check-label" for="user-${index}">
                    ${responsable}
                </label>
            </div>
        </div>
    `).join('');

    container.innerHTML = html;
    
    // Actualizar lista de usuarios seleccionados
    actualizarUsuariosSeleccionados();
}

// Actualizar lista de usuarios seleccionados para la gráfica
function actualizarUsuariosSeleccionados() {
    const checkboxes = document.querySelectorAll('.user-checkbox:checked');
    metricsData.selectedUsersForChart = Array.from(checkboxes).map(cb => cb.value);
}

// Obtener responsables de documentos finalizados
async function obtenerResponsablesFinalizados() {
    return new Promise((resolve) => {
        try {
            // Obtener TODOS los documentos finalizados independientemente del filtro de la tabla
            const documentosFinalizados = obtenerTodosDocumentosFinalizados();
            
            const responsables = [...new Set(
                documentosFinalizados
                    .filter(doc => doc.colaborador && doc.colaborador.trim() !== '')
                    .map(doc => doc.colaborador)
            )].sort();
            
            console.log(`Encontrados ${responsables.length} responsables en documentos finalizados`);
            resolve(responsables);
        } catch (error) {
            console.error('Error obteniendo responsables:', error);
            resolve([]);
        }
    });
}

// Obtener TODOS los documentos finalizados (independiente del filtro de la tabla)
function obtenerTodosDocumentosFinalizados() {
    try {
        // Primero intentar con datosGlobales (datos completos del sistema)
        if (typeof datosGlobales !== 'undefined' && Array.isArray(datosGlobales)) {
            console.log('Usando datosGlobales para métricas');
            return datosGlobales.filter(doc => 
                doc.estado === 'FINALIZADO' && 
                doc.duracion_guardada && 
                doc.cantidad > 0
            );
        }
        
        // Si no hay datosGlobales, usar documentosGlobales de la tabla
        if (typeof documentosGlobales !== 'undefined' && Array.isArray(documentosGlobales)) {
            console.log('Usando documentosGlobales para métricas');
            return documentosGlobales.filter(doc => 
                doc.estado === 'FINALIZADO' && 
                doc.duracion_guardada && 
                doc.cantidad > 0
            );
        }
        
        console.warn('No se encontraron datos para métricas');
        return [];
        
    } catch (error) {
        console.error('Error obteniendo documentos finalizados:', error);
        return [];
    }
}

// Cargar métricas iniciales
async function cargarMetricasIniciales() {
    try {
        mostrarLoadingMetricas();
        
        // Obtener documentos finalizados con filtros aplicados
        const documentosFinalizados = await obtenerDocumentosFinalizadosFiltrados();
        
        console.log(`Procesando ${documentosFinalizados.length} documentos para métricas`);
        
        // Calcular métricas
        await calcularTodasLasMetricas(documentosFinalizados);
        
        // Actualizar interfaz
        actualizarInterfazMetricas();
        
    } catch (error) {
        console.error('Error cargando métricas:', error);
        mostrarErrorMetricas('Error al cargar las métricas: ' + error.message);
    }
}

// Obtener documentos finalizados con filtros aplicados
async function obtenerDocumentosFinalizadosFiltrados() {
    return new Promise((resolve) => {
        const todosDocumentos = obtenerTodosDocumentosFinalizados();
        
        // Aplicar filtro de responsable si está seleccionado
        let documentosFiltrados = todosDocumentos;
        const responsableFiltro = document.getElementById('metricsResponsable')?.value;
        
        if (responsableFiltro) {
            documentosFiltrados = documentosFiltrados.filter(doc => doc.colaborador === responsableFiltro);
            console.log(`Filtrado por responsable: ${responsableFiltro}, documentos: ${documentosFiltrados.length}`);
        }
        
        // Aplicar filtro de fechas si está seleccionado
        if (metricsData.selectedDates && metricsData.selectedDates.length === 2) {
            const [fechaInicio, fechaFin] = metricsData.selectedDates;
            documentosFiltrados = documentosFiltrados.filter(doc => {
                if (!doc.fecha) return false;
                const fechaDoc = parsearFechaParaFiltro(doc.fecha);
                return fechaDoc >= fechaInicio && fechaDoc <= fechaFin;
            });
            console.log(`Filtrado por fechas: ${fechaInicio.toLocaleDateString()} - ${fechaFin.toLocaleDateString()}, documentos: ${documentosFiltrados.length}`);
        }
        
        resolve(documentosFiltrados);
    });
}

// Función para parsear fechas en formato dd/mm/yyyy
function parsearFechaParaFiltro(fechaStr) {
    if (!fechaStr) return null;
    
    try {
        const partes = fechaStr.split('/');
        if (partes.length === 3) {
            const dia = parseInt(partes[0], 10);
            const mes = parseInt(partes[1], 10) - 1; // Meses en JS son 0-11
            const año = parseInt(partes[2], 10);
            
            return new Date(año, mes, dia);
        }
        return null;
    } catch (error) {
        console.error('Error parseando fecha:', error);
        return null;
    }
}

// Calcular todas las métricas
async function calcularTodasLasMetricas(documentos) {
    const responsableFiltro = document.getElementById('metricsResponsable')?.value;
    const documentosFiltrados = responsableFiltro 
        ? documentos.filter(doc => doc.colaborador === responsableFiltro)
        : documentos;

    console.log(`Calculando métricas para ${documentosFiltrados.length} documentos`);

    // 1. Cálculo de Eficiencia (segundos por unidad)
    const eficiencia = calcularEficiencia(documentosFiltrados);
    
    // 2. Cálculo de Capacidad
    const capacidad = calcularCapacidad(documentosFiltrados);
    
    // 3. Cálculo de Efectividad
    const efectividad = calcularEfectividad(documentosFiltrados);
    
    // 4. Cálculo de Tiempos Muertos
    const tiemposMuertos = calcularTiemposMuertos(documentosFiltrados);
    
    // 5. Cálculo de Pausas
    const pausas = calcularPausas(documentosFiltrados);
    
    // 6. Top Semanal
    const topSemanal = calcularTopSemanal(documentos);
    
    // 7. Resumen del Equipo
    const resumenEquipo = calcularResumenEquipo(documentos);
    
    // 8. Datos para gráfica spider por usuario
    const datosGraficaUsuarios = calcularDatosGraficaUsuarios(documentos);

    metricsData.metrics = {
        eficiencia,
        capacidad,
        efectividad,
        tiemposMuertos,
        pausas,
        topSemanal,
        resumenEquipo,
        datosGraficaUsuarios,
        totalDocumentos: documentosFiltrados.length
    };
}

// Calcular datos para gráfica spider por usuario
function calcularDatosGraficaUsuarios(documentos) {
    const datosPorUsuario = {};
    
    // Agrupar documentos por responsable
    documentos.forEach(doc => {
        if (!doc.colaborador) return;
        
        if (!datosPorUsuario[doc.colaborador]) {
            datosPorUsuario[doc.colaborador] = {
                documentos: [],
                totalUnidades: 0,
                totalSegundos: 0,
                totalSegundosPausas: 0
            };
        }
        
        datosPorUsuario[doc.colaborador].documentos.push(doc);
        datosPorUsuario[doc.colaborador].totalUnidades += doc.cantidad;
        datosPorUsuario[doc.colaborador].totalSegundos += convertirDuracionASegundos(doc.duracion_guardada);
        
        if (doc.duracion_pausas) {
            datosPorUsuario[doc.colaborador].totalSegundosPausas += convertirDuracionASegundos(doc.duracion_pausas);
        }
    });
    
    // Calcular métricas para cada usuario
    const resultados = {};
    
    Object.keys(datosPorUsuario).forEach(responsable => {
        const data = datosPorUsuario[responsable];
        const diasTrabajados = calcularDiasTrabajados(data.documentos);
        
        // Eficiencia
        const eficiencia = data.totalUnidades > 0 ? data.totalSegundos / data.totalUnidades : 0;
        const porcentajeEficiencia = METRICS_CONFIG.eficiencia.target > 0 
            ? Math.min(100, (METRICS_CONFIG.eficiencia.target / eficiencia) * 100) 
            : 0;
        
        // Capacidad
        const capacidad = data.totalUnidades / Math.max(1, diasTrabajados);
        const porcentajeCapacidad = (capacidad / METRICS_CONFIG.capacidad.target) * 100;
        
        // Efectividad
        const efectividad = data.documentos.length / Math.max(1, diasTrabajados);
        const porcentajeEfectividad = (efectividad / METRICS_CONFIG.efectividad.target) * 100;
        
        // Tiempos Muertos
        const JORNADA_SEGUNDOS = 31680;
        const tiempoMuertoPorDia = Math.max(0, (JORNADA_SEGUNDOS * diasTrabajados) - data.totalSegundos) / Math.max(1, diasTrabajados);
        const porcentajeTiemposMuertos = Math.min(100, (tiempoMuertoPorDia / METRICS_CONFIG.tiemposMuertos.target) * 100);
        
        // Pausas
        const pausasPorDia = data.totalSegundosPausas / Math.max(1, diasTrabajados);
        const porcentajePausas = Math.min(100, (pausasPorDia / METRICS_CONFIG.pausas.target) * 100);
        
        resultados[responsable] = {
            eficiencia: Math.round(porcentajeEficiencia),
            capacidad: Math.round(porcentajeCapacidad),
            efectividad: Math.round(porcentajeEfectividad),
            tiemposMuertos: Math.round(100 - porcentajeTiemposMuertos), // Invertir para que mayor sea mejor
            pausas: Math.round(100 - porcentajePausas) // Invertir para que mayor sea mejor
        };
    });
    
    return resultados;
}

// Resto de las funciones de cálculo se mantienen igual...
// [Aquí van todas las funciones de cálculo que ya estaban: calcularEficiencia, calcularCapacidad, etc.]

// Cálculo de Eficiencia (tiempo por unidad en segundos)
function calcularEficiencia(documentos) {
    if (documentos.length === 0) return { valor: 0, porcentaje: 0, estado: 'sin-datos' };

    let totalSegundos = 0;
    let totalUnidades = 0;

    documentos.forEach(doc => {
        const segundos = convertirDuracionASegundos(doc.duracion_guardada);
        totalSegundos += segundos;
        totalUnidades += doc.cantidad;
    });

    const tiempoPorUnidad = totalUnidades > 0 ? totalSegundos / totalUnidades : 0;
    const porcentaje = METRICS_CONFIG.eficiencia.target > 0 
        ? Math.min(100, (METRICS_CONFIG.eficiencia.target / tiempoPorUnidad) * 100) 
        : 0;

    return {
        valor: tiempoPorUnidad,
        porcentaje: Math.round(porcentaje),
        estado: obtenerEstadoMetrica(porcentaje),
        descripcion: `${tiempoPorUnidad.toFixed(2)} seg/unidad`,
        meta: METRICS_CONFIG.eficiencia.target
    };
}

// Cálculo de Capacidad (unidades por jornada)
function calcularCapacidad(documentos) {
    if (documentos.length === 0) return { valor: 0, porcentaje: 0, estado: 'sin-datos' };

    const JORNADA_SEGUNDOS = 31680; // 8:48:00 en segundos
    const totalDias = calcularDiasTrabajados(documentos);
    
    let totalUnidades = 0;
    documentos.forEach(doc => {
        totalUnidades += doc.cantidad;
    });

    const unidadesPorDia = totalDias > 0 ? totalUnidades / totalDias : 0;
    const porcentaje = (unidadesPorDia / METRICS_CONFIG.capacidad.target) * 100;

    return {
        valor: unidadesPorDia,
        porcentaje: Math.round(porcentaje),
        estado: obtenerEstadoMetrica(porcentaje),
        descripcion: `${Math.round(unidadesPorDia)} und/día`,
        meta: METRICS_CONFIG.capacidad.target
    };
}

// Cálculo de Efectividad (documentos por día)
function calcularEfectividad(documentos) {
    if (documentos.length === 0) return { valor: 0, porcentaje: 0, estado: 'sin-datos' };

    const totalDias = calcularDiasTrabajados(documentos);
    const documentosPorDia = totalDias > 0 ? documentos.length / totalDias : 0;
    const porcentaje = (documentosPorDia / METRICS_CONFIG.efectividad.target) * 100;

    return {
        valor: documentosPorDia,
        porcentaje: Math.round(porcentaje),
        estado: obtenerEstadoMetrica(porcentaje),
        descripcion: `${documentosPorDia.toFixed(1)} docs/día`,
        meta: METRICS_CONFIG.efectividad.target
    };
}

// Cálculo de Tiempos Muertos
function calcularTiemposMuertos(documentos) {
    if (documentos.length === 0) return { valor: 0, porcentaje: 0, estado: 'sin-datos' };

    const JORNADA_SEGUNDOS = 31680;
    const totalDias = calcularDiasTrabajados(documentos);
    
    let totalSegundosTrabajados = 0;
    documentos.forEach(doc => {
        totalSegundosTrabajados += convertirDuracionASegundos(doc.duracion_guardada);
    });

    const tiempoMuertoTotal = Math.max(0, (JORNADA_SEGUNDOS * totalDias) - totalSegundosTrabajados);
    const tiempoMuertoPorDia = totalDias > 0 ? tiempoMuertoTotal / totalDias : 0;
    const porcentaje = Math.min(100, (tiempoMuertoPorDia / METRICS_CONFIG.tiemposMuertos.target) * 100);

    return {
        valor: tiempoMuertoPorDia,
        porcentaje: Math.round(porcentaje),
        estado: obtenerEstadoMetrica(100 - porcentaje), // Invertir para que menor sea mejor
        descripcion: `${formatearSegundosATiempo(tiempoMuertoPorDia)}/día`,
        meta: METRICS_CONFIG.tiemposMuertos.target
    };
}

// Cálculo de Pausas
function calcularPausas(documentos) {
    if (documentos.length === 0) return { valor: 0, porcentaje: 0, estado: 'sin-datos' };

    const totalDias = calcularDiasTrabajados(documentos);
    
    let totalSegundosPausas = 0;
    documentos.forEach(doc => {
        if (doc.duracion_pausas) {
            totalSegundosPausas += convertirDuracionASegundos(doc.duracion_pausas);
        }
    });

    const pausasPorDia = totalDias > 0 ? totalSegundosPausas / totalDias : 0;
    const porcentaje = Math.min(100, (pausasPorDia / METRICS_CONFIG.pausas.target) * 100);

    return {
        valor: pausasPorDia,
        porcentaje: Math.round(porcentaje),
        estado: obtenerEstadoMetrica(100 - porcentaje), // Invertir para que menor sea mejor
        descripcion: `${formatearSegundosATiempo(pausasPorDia)}/día`,
        meta: METRICS_CONFIG.pausas.target
    };
}

// Calcular días trabajados únicos
function calcularDiasTrabajados(documentos) {
    const diasUnicos = new Set();
    documentos.forEach(doc => {
        if (doc.fecha) {
            diasUnicos.add(doc.fecha);
        }
    });
    return Math.max(1, diasUnicos.size); // Mínimo 1 día para evitar división por cero
}

// Calcular Top Semanal
function calcularTopSemanal(documentos) {
    // Agrupar por responsable
    const porResponsable = {};
    
    documentos.forEach(doc => {
        if (!doc.colaborador) return;
        
        if (!porResponsable[doc.colaborador]) {
            porResponsable[doc.colaborador] = {
                documentos: [],
                totalUnidades: 0,
                totalSegundos: 0
            };
        }
        
        porResponsable[doc.colaborador].documentos.push(doc);
        porResponsable[doc.colaborador].totalUnidades += doc.cantidad;
        porResponsable[doc.colaborador].totalSegundos += convertirDuracionASegundos(doc.duracion_guardada);
    });
    
    // Calcular eficiencia por responsable
    const top = Object.keys(porResponsable).map(responsable => {
        const data = porResponsable[responsable];
        const eficiencia = data.totalUnidades > 0 ? data.totalSegundos / data.totalUnidades : 0;
        const capacidad = data.totalUnidades / Math.max(1, calcularDiasTrabajados(data.documentos));
        
        return {
            responsable,
            eficiencia,
            capacidad: Math.round(capacidad),
            documentos: data.documentos.length,
            estado: obtenerEstadoMetrica((METRICS_CONFIG.eficiencia.target / eficiencia) * 100)
        };
    });
    
    // Ordenar por eficiencia (menor tiempo por unidad = mejor)
    return top.sort((a, b) => a.eficiencia - b.eficiencia).slice(0, 5);
}

// Calcular Resumen del Equipo
function calcularResumenEquipo(documentos) {
    const totalDocumentos = documentos.length;
    const totalUnidades = documentos.reduce((sum, doc) => sum + doc.cantidad, 0);
    const totalSegundos = documentos.reduce((sum, doc) => sum + convertirDuracionASegundos(doc.duracion_guardada), 0);
    
    const eficienciaGeneral = totalUnidades > 0 ? totalSegundos / totalUnidades : 0;
    const capacidadInstalada = totalUnidades / Math.max(1, calcularDiasTrabajados(documentos));
    
    return {
        eficienciaGeneral: eficienciaGeneral.toFixed(2),
        capacidadInstalada: Math.round(capacidadInstalada),
        totalDocumentos,
        totalUnidades,
        diasTrabajados: calcularDiasTrabajados(documentos)
    };
}

// Utilidades de conversión
function convertirDuracionASegundos(duracion) {
    if (!duracion) return 0;
    
    try {
        const partes = duracion.split(':').map(part => parseInt(part) || 0);
        if (partes.length === 3) {
            return partes[0] * 3600 + partes[1] * 60 + partes[2];
        } else if (partes.length === 2) {
            return partes[0] * 60 + partes[1];
        }
        return 0;
    } catch (error) {
        console.error('Error convirtiendo duración a segundos:', error);
        return 0;
    }
}

function formatearSegundosATiempo(segundos) {
    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    const segs = Math.floor(segundos % 60);
    
    return `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segs.toString().padStart(2, '0')}`;
}

function obtenerEstadoMetrica(porcentaje) {
    if (porcentaje >= 90) return 'excelente';
    if (porcentaje >= 80) return 'bueno';
    if (porcentaje >= 70) return 'regular';
    return 'bajo';
}

// Actualizar interfaz de métricas
function actualizarInterfazMetricas() {
    actualizarTarjetasMetricas();
    actualizarGraficaSpider();
    actualizarTopSemanal();
    actualizarResumenEquipo();
}

// Actualizar tarjetas de métricas
function actualizarTarjetasMetricas() {
    const container = document.getElementById('metricsCards');
    if (!container) return;

    const metricas = metricsData.metrics;
    if (!metricas.eficiencia) return;

    const html = `
        <div class="col-md-2 col-6 mb-3">
            <div class="metric-card eficiencia">
                <div class="metric-content">
                    <div class="metric-icon">
                        <i class="fas fa-bolt"></i>
                    </div>
                    <div class="metric-info">
                        <div class="metric-value">${metricas.eficiencia.porcentaje}%</div>
                        <div class="metric-label">Eficiencia</div>
                        <div class="metric-target">${metricas.eficiencia.descripcion}</div>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-md-2 col-6 mb-3">
            <div class="metric-card capacidad">
                <div class="metric-content">
                    <div class="metric-icon">
                        <i class="fas fa-industry"></i>
                    </div>
                    <div class="metric-info">
                        <div class="metric-value">${metricas.capacidad.porcentaje}%</div>
                        <div class="metric-label">Capacidad</div>
                        <div class="metric-target">${metricas.capacidad.descripcion}</div>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-md-2 col-6 mb-3">
            <div class="metric-card efectividad">
                <div class="metric-content">
                    <div class="metric-icon">
                        <i class="fas fa-chart-line"></i>
                    </div>
                    <div class="metric-info">
                        <div class="metric-value">${metricas.efectividad.porcentaje}%</div>
                        <div class="metric-label">Efectividad</div>
                        <div class="metric-target">${metricas.efectividad.descripcion}</div>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-md-2 col-6 mb-3">
            <div class="metric-card capacidad-instalada">
                <div class="metric-content">
                    <div class="metric-icon">
                        <i class="fas fa-users"></i>
                    </div>
                    <div class="metric-info">
                        <div class="metric-value">${metricas.resumenEquipo.capacidadInstalada}</div>
                        <div class="metric-label">Cap. Instalada</div>
                        <div class="metric-target">unidades/día</div>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-md-2 col-6 mb-3">
            <div class="metric-card">
                <div class="metric-content">
                    <div class="metric-icon" style="background: rgba(245, 158, 11, 0.1); color: #f59e0b;">
                        <i class="fas fa-clock"></i>
                    </div>
                    <div class="metric-info">
                        <div class="metric-value">${metricas.tiemposMuertos.porcentaje}%</div>
                        <div class="metric-label">T. Muertos</div>
                        <div class="metric-target">${metricas.tiemposMuertos.descripcion}</div>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-md-2 col-6 mb-3">
            <div class="metric-card">
                <div class="metric-content">
                    <div class="metric-icon" style="background: rgba(156, 163, 175, 0.1); color: #9ca3af;">
                        <i class="fas fa-pause"></i>
                    </div>
                    <div class="metric-info">
                        <div class="metric-value">${metricas.pausas.porcentaje}%</div>
                        <div class="metric-label">Pausas</div>
                        <div class="metric-target">${metricas.pausas.descripcion}</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

// Actualizar gráfica spider
function actualizarGraficaSpider() {
    const canvas = document.getElementById('spiderChart');
    if (!canvas) return;

    // Actualizar usuarios seleccionados
    actualizarUsuariosSeleccionados();
    
    const ctx = canvas.getContext('2d');
    const metricas = metricsData.metrics;

    if (!metricas.datosGraficaUsuarios || Object.keys(metricas.datosGraficaUsuarios).length === 0) {
        // Mostrar mensaje de no hay datos
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '16px Arial';
        ctx.fillStyle = '#6c757d';
        ctx.textAlign = 'center';
        ctx.fillText('No hay datos para mostrar', canvas.width / 2, canvas.height / 2);
        return;
    }

    // Filtrar usuarios seleccionados
    const usuariosParaGrafica = metricsData.selectedUsersForChart.filter(
        usuario => metricas.datosGraficaUsuarios[usuario]
    );

    if (usuariosParaGrafica.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '16px Arial';
        ctx.fillStyle = '#6c757d';
        ctx.textAlign = 'center';
        ctx.fillText('Selecciona usuarios para comparar', canvas.width / 2, canvas.height / 2);
        return;
    }

    // Colores para diferentes usuarios
    const colores = [
        'rgba(54, 162, 235, 0.6)',
        'rgba(255, 99, 132, 0.6)',
        'rgba(75, 192, 192, 0.6)',
        'rgba(255, 159, 64, 0.6)',
        'rgba(153, 102, 255, 0.6)',
        'rgba(201, 203, 207, 0.6)'
    ];

    // Preparar datasets
    const datasets = usuariosParaGrafica.map((usuario, index) => {
        const datosUsuario = metricas.datosGraficaUsuarios[usuario];
        return {
            label: usuario,
            data: [
                datosUsuario.eficiencia,
                datosUsuario.capacidad,
                datosUsuario.efectividad,
                datosUsuario.tiemposMuertos,
                datosUsuario.pausas
            ],
            backgroundColor: colores[index % colores.length],
            borderColor: colores[index % colores.length].replace('0.6', '1'),
            pointBackgroundColor: colores[index % colores.length].replace('0.6', '1'),
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: colores[index % colores.length].replace('0.6', '1')
        };
    });

    // Datos para la gráfica spider
    const data = {
        labels: ['Eficiencia', 'Capacidad', 'Efectividad', 'T. Muertos', 'Pausas'],
        datasets: datasets
    };

    // Configuración de la gráfica
    const config = {
        type: 'radar',
        data: data,
        options: {
            responsive: true,
            scales: {
                r: {
                    angleLines: {
                        display: true
                    },
                    suggestedMin: 0,
                    suggestedMax: 100,
                    ticks: {
                        stepSize: 20
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
                            return `${context.dataset.label}: ${context.raw}%`;
                        }
                    }
                }
            }
        }
    };

    // Destruir gráfica anterior si existe
    if (window.spiderChartInstance) {
        window.spiderChartInstance.destroy();
    }

    // Crear nueva gráfica
    window.spiderChartInstance = new Chart(ctx, config);
}

// Actualizar top semanal
function actualizarTopSemanal() {
    const container = document.getElementById('topEficiencia');
    if (!container) return;

    const top = metricsData.metrics.topSemanal || [];

    if (top.length === 0) {
        container.innerHTML = '<p class="text-muted text-center">No hay datos para mostrar</p>';
        return;
    }

    const html = top.map((item, index) => `
        <div class="top-item">
            <div class="top-posicion">${index + 1}</div>
            <div class="top-info">
                <div class="top-nombre">${item.responsable}</div>
                <div class="top-metricas">
                    <div class="top-metrica">
                        <i class="fas fa-bolt"></i>
                        ${item.eficiencia.toFixed(2)}s/u
                    </div>
                    <div class="top-metrica">
                        <i class="fas fa-chart-bar"></i>
                        ${item.capacidad} u/d
                    </div>
                </div>
            </div>
        </div>
    `).join('');

    container.innerHTML = html;
}

// Actualizar resumen del equipo
function actualizarResumenEquipo() {
    const container = document.getElementById('teamSummary');
    if (!container) return;

    const resumen = metricsData.metrics.resumenEquipo || {};

    const html = `
        <div class="mb-3">
            <strong>Eficiencia General:</strong>
            <span class="float-end">${resumen.eficienciaGeneral || '0.00'} seg/unidad</span>
        </div>
        <div class="mb-3">
            <strong>Capacidad Instalada:</strong>
            <span class="float-end">${resumen.capacidadInstalada || 0} unidades/día</span>
        </div>
        <div class="mb-3">
            <strong>Total Documentos:</strong>
            <span class="float-end">${resumen.totalDocumentos || 0}</span>
        </div>
        <div class="mb-3">
            <strong>Total Unidades:</strong>
            <span class="float-end">${resumen.totalUnidades || 0}</span>
        </div>
        <div class="mb-3">
            <strong>Días Trabajados:</strong>
            <span class="float-end">${resumen.diasTrabajados || 0}</span>
        </div>
    `;

    container.innerHTML = html;
}

// Mostrar loading en métricas
function mostrarLoadingMetricas() {
    const containers = ['metricsCards', 'topEficiencia', 'teamSummary'];
    containers.forEach(containerId => {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="text-center py-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Cargando...</span>
                    </div>
                    <p class="mt-2 text-muted">Cargando métricas...</p>
                </div>
            `;
        }
    });
}

// Mostrar error en métricas
function mostrarErrorMetricas(mensaje) {
    const container = document.getElementById('metricsCards');
    if (container) {
        container.innerHTML = `
            <div class="col-12">
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    ${mensaje}
                </div>
            </div>
        `;
    }
}

// Generar reporte completo
function generarReporteCompleto() {
    // Implementar generación de reporte (PDF/Excel)
    Swal.fire({
        icon: 'info',
        title: 'Generar Reporte',
        text: 'Esta función generará un reporte completo en PDF/Excel',
        showCancelButton: true,
        confirmButtonText: 'Generar',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            // Aquí iría la lógica para generar el reporte
            Swal.fire({
                icon: 'success',
                title: 'Reporte Generado',
                text: 'El reporte se ha generado correctamente',
                timer: 2000,
                showConfirmButton: false
            });
        }
    });
}

// Event listeners para filtros
document.addEventListener('DOMContentLoaded', function() {
    // Event listener para cambio de responsable
    setTimeout(() => {
        const selectResponsable = document.getElementById('metricsResponsable');
        if (selectResponsable) {
            selectResponsable.addEventListener('change', function() {
                console.log('Responsable cambiado:', this.value);
                cargarMetricasIniciales();
            });
        }
    }, 1000);
});

// Inicializar cuando esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarSistemaMetricas);
} else {
    inicializarSistemaMetricas();
}

// Hacer funciones disponibles globalmente
window.mostrarModalEstadisticas = mostrarModalEstadisticas;
window.generarReporteCompleto = generarReporteCompleto;
window.actualizarGraficaSpider = actualizarGraficaSpider;
window.actualizarUsuariosSeleccionados = actualizarUsuariosSeleccionados;
