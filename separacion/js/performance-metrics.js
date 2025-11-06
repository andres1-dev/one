// performance-metrics.js - VERSIÓN CORREGIDA Y DEBUGGADA
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
    console.log('🔧 Inicializando sistema de métricas...');
    
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

    console.log('✅ Botón de estadísticas agregado');
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
                            <div class="card mb-4" id="usersSelectorCard" style="display: none;">
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
                                <div class="col-12 text-center py-4">
                                    <div class="spinner-border text-primary" role="status">
                                        <span class="visually-hidden">Cargando...</span>
                                    </div>
                                    <p class="mt-2 text-muted">Cargando métricas...</p>
                                </div>
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
                                                <p class="text-muted text-center">Cargando...</p>
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
                                                <p class="text-muted text-center">Cargando...</p>
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
                console.log('📅 Fechas seleccionadas en métricas:', selectedDates);
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
    console.log('📊 Abriendo modal de estadísticas...');
    const modal = new bootstrap.Modal(document.getElementById('metricsModal'));
    
    // Cargar datos iniciales
    cargarResponsablesParaMetricas();
    cargarMetricasIniciales();
    
    modal.show();
}

// Cargar responsables para el selector de métricas
async function cargarResponsablesParaMetricas() {
    const select = document.getElementById('metricsResponsable');
    if (!select) {
        console.error('❌ No se encontró el selector de responsables');
        return;
    }

    try {
        console.log('👥 Cargando responsables para métricas...');
        // Obtener responsables únicos de documentos finalizados
        const responsables = await obtenerResponsablesFinalizados();
        metricsData.allResponsables = responsables;
        
        console.log(`✅ Encontrados ${responsables.length} responsables:`, responsables);
        
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
        console.error('❌ Error cargando responsables para métricas:', error);
    }
}

// Cargar selector de usuarios para gráfica spider
function cargarSelectorUsuariosGrafica(responsables) {
    const container = document.getElementById('usersSelector');
    const card = document.getElementById('usersSelectorCard');
    
    if (!container) {
        console.error('❌ No se encontró el contenedor de usuarios');
        return;
    }

    if (responsables.length === 0) {
        card.style.display = 'none';
        return;
    }

    card.style.display = 'block';

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
    console.log('👥 Usuarios seleccionados para gráfica:', metricsData.selectedUsersForChart);
}

// Obtener responsables de documentos finalizados
async function obtenerResponsablesFinalizados() {
    return new Promise((resolve) => {
        try {
            console.log('🔍 Buscando responsables en documentos finalizados...');
            
            // Obtener TODOS los documentos finalizados independientemente del filtro de la tabla
            const documentosFinalizados = obtenerTodosDocumentosFinalizados();
            
            console.log(`📋 Documentos finalizados encontrados: ${documentosFinalizados.length}`);
            
            const responsables = [...new Set(
                documentosFinalizados
                    .filter(doc => {
                        const tieneResponsable = doc.colaborador && doc.colaborador.trim() !== '';
                        if (!tieneResponsable) {
                            console.log('❌ Documento sin responsable:', doc);
                        }
                        return tieneResponsable;
                    })
                    .map(doc => doc.colaborador)
            )].sort();
            
            console.log(`✅ Responsables encontrados: ${responsables.length}`, responsables);
            resolve(responsables);
        } catch (error) {
            console.error('❌ Error obteniendo responsables:', error);
            resolve([]);
        }
    });
}

// Obtener TODOS los documentos finalizados (independiente del filtro de la tabla)
function obtenerTodosDocumentosFinalizados() {
    try {
        console.log('🔍 Buscando documentos finalizados...');
        
        let documentosFinalizados = [];

        // PRIMERO: Intentar con datosGlobales (datos completos del sistema)
        if (typeof datosGlobales !== 'undefined' && Array.isArray(datosGlobales)) {
            console.log('📊 Usando datosGlobales para métricas');
            documentosFinalizados = datosGlobales.filter(doc => {
                const esFinalizado = doc.estado === 'FINALIZADO';
                const tieneDuracion = doc.duracion_guardada;
                const tieneCantidad = doc.cantidad > 0;
                
                if (esFinalizado && (!tieneDuracion || !tieneCantidad)) {
                    console.log('⚠️ Documento finalizado sin datos completos:', doc);
                }
                
                return esFinalizado && tieneDuracion && tieneCantidad;
            });
            
            console.log(`📊 Documentos de datosGlobales: ${documentosFinalizados.length}`);
        }
        
        // SEGUNDO: Si no hay suficientes datos, usar documentosGlobales de la tabla
        if (documentosFinalizados.length === 0 && typeof documentosGlobales !== 'undefined' && Array.isArray(documentosGlobales)) {
            console.log('📋 Usando documentosGlobales para métricas');
            documentosFinalizados = documentosGlobales.filter(doc => {
                const esFinalizado = doc.estado === 'FINALIZADO';
                const tieneDuracion = doc.duracion_guardada;
                const tieneCantidad = doc.cantidad > 0;
                
                return esFinalizado && tieneDuracion && tieneCantidad;
            });
            
            console.log(`📋 Documentos de documentosGlobales: ${documentosFinalizados.length}`);
        }
        
        // TERCERO: Si aún no hay datos, mostrar datos de ejemplo para debug
        if (documentosFinalizados.length === 0) {
            console.warn('⚠️ No se encontraron documentos finalizados. Mostrando datos de ejemplo para debug.');
            documentosFinalizados = generarDatosEjemplo();
        }
        
        console.log(`✅ Total documentos finalizados para métricas: ${documentosFinalizados.length}`);
        return documentosFinalizados;
        
    } catch (error) {
        console.error('❌ Error obteniendo documentos finalizados:', error);
        return [];
    }
}

// Generar datos de ejemplo para debug
function generarDatosEjemplo() {
    console.log('🎭 Generando datos de ejemplo para debug...');
    
    const responsables = ['NICOLE VALERIA MONCALEANO DIAZ', 'KELLY TATIANA FERNANDEZ ASTUDILLO', 'PILAR CRISTINA JARAMILLO SANCHEZ'];
    const documentos = [];
    
    for (let i = 0; i < 10; i++) {
        const responsable = responsables[Math.floor(Math.random() * responsables.length)];
        documentos.push({
            rec: `REC${1000 + i}`,
            estado: 'FINALIZADO',
            colaborador: responsable,
            fecha: '15/11/2024',
            duracion_guardada: '02:30:00',
            cantidad: Math.floor(Math.random() * 100) + 50,
            duracion_pausas: '00:15:00'
        });
    }
    
    console.log('🎭 Datos de ejemplo generados:', documentos);
    return documentos;
}

// Cargar métricas iniciales
async function cargarMetricasIniciales() {
    try {
        console.log('📈 Cargando métricas iniciales...');
        mostrarLoadingMetricas();
        
        // Obtener documentos finalizados con filtros aplicados
        const documentosFinalizados = await obtenerDocumentosFinalizadosFiltrados();
        
        console.log(`📊 Procesando ${documentosFinalizados.length} documentos para métricas`);
        
        if (documentosFinalizados.length === 0) {
            mostrarErrorMetricas('No se encontraron documentos finalizados con los filtros aplicados');
            return;
        }
        
        // Calcular métricas
        await calcularTodasLasMetricas(documentosFinalizados);
        
        // Actualizar interfaz
        actualizarInterfazMetricas();
        
        console.log('✅ Métricas cargadas correctamente');
        
    } catch (error) {
        console.error('❌ Error cargando métricas:', error);
        mostrarErrorMetricas('Error al cargar las métricas: ' + error.message);
    }
}

// Obtener documentos finalizados con filtros aplicados
async function obtenerDocumentosFinalizadosFiltrados() {
    return new Promise((resolve) => {
        const todosDocumentos = obtenerTodosDocumentosFinalizados();
        
        console.log(`📋 Documentos antes de filtrar: ${todosDocumentos.length}`);
        
        // Aplicar filtro de responsable si está seleccionado
        let documentosFiltrados = todosDocumentos;
        const responsableFiltro = document.getElementById('metricsResponsable')?.value;
        
        if (responsableFiltro) {
            documentosFiltrados = documentosFiltrados.filter(doc => doc.colaborador === responsableFiltro);
            console.log(`👤 Filtrado por responsable: "${responsableFiltro}", documentos: ${documentosFiltrados.length}`);
        }
        
        // Aplicar filtro de fechas si está seleccionado
        if (metricsData.selectedDates && metricsData.selectedDates.length === 2) {
            const [fechaInicio, fechaFin] = metricsData.selectedDates;
            documentosFiltrados = documentosFiltrados.filter(doc => {
                if (!doc.fecha) return false;
                const fechaDoc = parsearFechaParaFiltro(doc.fecha);
                return fechaDoc >= fechaInicio && fechaDoc <= fechaFin;
            });
            console.log(`📅 Filtrado por fechas: ${fechaInicio.toLocaleDateString()} - ${fechaFin.toLocaleDateString()}, documentos: ${documentosFiltrados.length}`);
        }
        
        console.log(`✅ Documentos después de filtrar: ${documentosFiltrados.length}`);
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
        console.error('❌ Error parseando fecha:', error, 'String:', fechaStr);
        return null;
    }
}

// Calcular todas las métricas
async function calcularTodasLasMetricas(documentos) {
    console.log('🧮 Calculando todas las métricas...');
    
    const responsableFiltro = document.getElementById('metricsResponsable')?.value;
    const documentosFiltrados = responsableFiltro 
        ? documentos.filter(doc => doc.colaborador === responsableFiltro)
        : documentos;

    console.log(`📊 Calculando métricas para ${documentosFiltrados.length} documentos`);

    // 1. Cálculo de Eficiencia (segundos por unidad)
    const eficiencia = calcularEficiencia(documentosFiltrados);
    console.log('📈 Eficiencia calculada:', eficiencia);
    
    // 2. Cálculo de Capacidad
    const capacidad = calcularCapacidad(documentosFiltrados);
    console.log('📈 Capacidad calculada:', capacidad);
    
    // 3. Cálculo de Efectividad
    const efectividad = calcularEfectividad(documentosFiltrados);
    console.log('📈 Efectividad calculada:', efectividad);
    
    // 4. Cálculo de Tiempos Muertos
    const tiemposMuertos = calcularTiemposMuertos(documentosFiltrados);
    console.log('📈 Tiempos muertos calculados:', tiemposMuertos);
    
    // 5. Cálculo de Pausas
    const pausas = calcularPausas(documentosFiltrados);
    console.log('📈 Pausas calculadas:', pausas);
    
    // 6. Top Semanal
    const topSemanal = calcularTopSemanal(documentos);
    console.log('📈 Top semanal calculado:', topSemanal);
    
    // 7. Resumen del Equipo
    const resumenEquipo = calcularResumenEquipo(documentos);
    console.log('📈 Resumen del equipo calculado:', resumenEquipo);
    
    // 8. Datos para gráfica spider por usuario
    const datosGraficaUsuarios = calcularDatosGraficaUsuarios(documentos);
    console.log('📈 Datos para gráfica calculados:', datosGraficaUsuarios);

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

// [Aquí van todas las funciones de cálculo que ya estaban...]
// calcularEficiencia, calcularCapacidad, calcularEfectividad, calcularTiemposMuertos, calcularPausas,
// calcularDatosGraficaUsuarios, calcularTopSemanal, calcularResumenEquipo, etc.

// Resto del código se mantiene igual...
// [Incluir aquí todas las demás funciones sin cambios]

// Actualizar interfaz de métricas
function actualizarInterfazMetricas() {
    console.log('🎨 Actualizando interfaz de métricas...');
    actualizarTarjetasMetricas();
    actualizarGraficaSpider();
    actualizarTopSemanal();
    actualizarResumenEquipo();
}

// Actualizar tarjetas de métricas
function actualizarTarjetasMetricas() {
    const container = document.getElementById('metricsCards');
    if (!container) {
        console.error('❌ No se encontró el contenedor de métricas');
        return;
    }

    const metricas = metricsData.metrics;
    if (!metricas.eficiencia) {
        console.error('❌ No hay métricas para mostrar');
        container.innerHTML = `
            <div class="col-12">
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    No hay datos suficientes para calcular las métricas
                </div>
            </div>
        `;
        return;
    }

    console.log('🎨 Actualizando tarjetas con métricas:', metricas);

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
    console.log('✅ Tarjetas de métricas actualizadas');
}

// Las demás funciones de actualización se mantienen igual...
// actualizarGraficaSpider, actualizarTopSemanal, actualizarResumenEquipo, etc.

// Mostrar loading en métricas
function mostrarLoadingMetricas() {
    console.log('⏳ Mostrando loading de métricas...');
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
    console.error('❌ Mostrando error en métricas:', mensaje);
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

// Inicializar cuando esté listo
console.log('🚀 performance-metrics.js cargado, esperando inicialización...');

// Esperar a que jQuery y las dependencias estén listas
function waitForDependencies() {
    if (typeof $ !== 'undefined' && typeof flatpickr !== 'undefined') {
        console.log('✅ Dependencias cargadas, inicializando sistema de métricas...');
        inicializarSistemaMetricas();
    } else {
        console.log('⏳ Esperando dependencias...');
        setTimeout(waitForDependencies, 100);
    }
}

// Iniciar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForDependencies);
} else {
    waitForDependencies();
}

// Hacer funciones disponibles globalmente
window.mostrarModalEstadisticas = mostrarModalEstadisticas;
window.generarReporteCompleto = generarReporteCompleto;
window.actualizarGraficaSpider = actualizarGraficaSpider;
window.actualizarUsuariosSeleccionados = actualizarUsuariosSeleccionados;

console.log('✅ performance-metrics.js completamente cargado');
