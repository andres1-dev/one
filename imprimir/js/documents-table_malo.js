// Configuración de DataTable para documentos disponibles
let documentosTable = null;
let listaResponsables = [];
let timers = {}; // Almacenar los intervalos de tiempo
let documentosGlobales = []; // Almacenar todos los documentos para los consolidados
let rangoFechasSeleccionado = null; // Almacenar rango de fechas para filtrado

// Estados permitidos para mostrar
let mostrarFinalizados = false;
const ESTADOS_VISIBLES = ['PENDIENTE', 'DIRECTO', 'ELABORACION', 'PAUSADO'];
const ESTADOS_FINALIZADOS = ['FINALIZADO'];

// Configuración de métricas
const CONFIG_METRICAS = {
    JORNADA_MINUTOS: 528, // 8 horas 48 minutos
    JORNADA_SEGUNDOS: 31680, // 528 * 60
    PROMEDIO_IDEAL_SEGUNDOS: 4, // 4 segundos por prenda
    HORAS_JORNADA: 8.8 // 8 horas 48 minutos en decimal
};

// ===== SISTEMA DE MÉTRICAS Y ANÁLISIS DE PRODUCTIVIDAD =====

// Función para calcular métricas de productividad
function calcularMetricasProductividad(documentos) {
    const metricas = {
        porUsuario: {},
        porDia: {},
        general: {
            totalPrendas: 0,
            totalSegundos: 0,
            promedioSegundosPorPrenda: 0,
            prendasPorHora: 0,
            eficienciaGeneral: 0,
            capacidadInstalada: CONFIG_METRICAS.JORNADA_SEGUNDOS,
            prendasIdealesPorJornada: Math.floor(CONFIG_METRICAS.JORNADA_SEGUNDOS / CONFIG_METRICAS.PROMEDIO_IDEAL_SEGUNDOS)
        }
    };

    // Procesar documentos finalizados
    documentos.filter(doc => doc.estado === 'FINALIZADO').forEach(doc => {
        const duracionSegundos = tiempoAMilisegundos(doc.duracion_guardada || '00:00:00') / 1000;
        const cantidad = doc.cantidad || 0;
        
        if (duracionSegundos > 0 && cantidad > 0) {
            const segundosPorPrenda = duracionSegundos / cantidad;
            const fecha = doc.fecha;
            const usuario = doc.colaborador || 'Sin asignar';

            // Métricas por usuario
            if (!metricas.porUsuario[usuario]) {
                metricas.porUsuario[usuario] = {
                    totalPrendas: 0,
                    totalSegundos: 0,
                    documentos: 0,
                    promedios: []
                };
            }
            
            metricas.porUsuario[usuario].totalPrendas += cantidad;
            metricas.porUsuario[usuario].totalSegundos += duracionSegundos;
            metricas.porUsuario[usuario].documentos++;
            metricas.porUsuario[usuario].promedios.push(segundosPorPrenda);

            // Métricas por día
            if (!metricas.porDia[fecha]) {
                metricas.porDia[fecha] = {
                    totalPrendas: 0,
                    totalSegundos: 0,
                    usuarios: new Set(),
                    documentos: 0
                };
            }
            
            metricas.porDia[fecha].totalPrendas += cantidad;
            metricas.porDia[fecha].totalSegundos += duracionSegundos;
            metricas.porDia[fecha].usuarios.add(usuario);
            metricas.porDia[fecha].documentos++;

            // Métricas generales
            metricas.general.totalPrendas += cantidad;
            metricas.general.totalSegundos += duracionSegundos;
        }
    });

    // Calcular promedios y eficiencias
    Object.keys(metricas.porUsuario).forEach(usuario => {
        const datos = metricas.porUsuario[usuario];
        datos.promedioSegundosPorPrenda = datos.totalSegundos / datos.totalPrendas;
        datos.prendasPorHora = (datos.totalPrendas / (datos.totalSegundos / 3600)) || 0;
        datos.eficiencia = (CONFIG_METRICAS.PROMEDIO_IDEAL_SEGUNDOS / datos.promedioSegundosPorPrenda) * 100;
        datos.prendasPorJornada = datos.prendasPorHora * CONFIG_METRICAS.HORAS_JORNADA;
        datos.cumplimientoCapacidad = (datos.prendasPorJornada / metricas.general.prendasIdealesPorJornada) * 100;
    });

    // Calcular métricas generales
    if (metricas.general.totalPrendas > 0) {
        metricas.general.promedioSegundosPorPrenda = metricas.general.totalSegundos / metricas.general.totalPrendas;
        metricas.general.prendasPorHora = metricas.general.totalPrendas / (metricas.general.totalSegundos / 3600);
        metricas.general.eficienciaGeneral = (CONFIG_METRICAS.PROMEDIO_IDEAL_SEGUNDOS / metricas.general.promedioSegundosPorPrenda) * 100;
    }

    return metricas;
}

// Función para formatear tiempo en segundos a formato legible
function formatearSegundos(segundos) {
    if (segundos < 60) {
        return `${segundos.toFixed(1)} seg`;
    } else if (segundos < 3600) {
        return `${(segundos / 60).toFixed(1)} min`;
    } else {
        return `${(segundos / 3600).toFixed(1)} h`;
    }
}

// Función para mostrar panel de métricas
function mostrarPanelMetricas() {
    const metricas = calcularMetricasProductividad(documentosGlobales);
    
    const modalHTML = `
        <div class="modal fade" id="metricasModal" tabindex="-1">
            <div class="modal-dialog modal-xl">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-chart-line me-2"></i>
                            Métricas de Productividad
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <!-- Resumen General -->
                        <div class="row mb-4">
                            <div class="col-12">
                                <div class="card">
                                    <div class="card-header">
                                        <h6 class="mb-0">Resumen General</h6>
                                    </div>
                                    <div class="card-body">
                                        <div class="row">
                                            <div class="col-md-3 text-center">
                                                <div class="metric-card">
                                                    <div class="metric-value text-primary">${metricas.general.totalPrendas}</div>
                                                    <div class="metric-label">Total Prendas</div>
                                                </div>
                                            </div>
                                            <div class="col-md-3 text-center">
                                                <div class="metric-card">
                                                    <div class="metric-value text-info">${formatearSegundos(metricas.general.promedioSegundosPorPrenda)}</div>
                                                    <div class="metric-label">Promedio/Prenda</div>
                                                </div>
                                            </div>
                                            <div class="col-md-3 text-center">
                                                <div class="metric-card">
                                                    <div class="metric-value text-success">${metricas.general.prendasPorHora.toFixed(1)}</div>
                                                    <div class="metric-label">Prendas/Hora</div>
                                                </div>
                                            </div>
                                            <div class="col-md-3 text-center">
                                                <div class="metric-card">
                                                    <div class="metric-value ${metricas.general.eficienciaGeneral >= 100 ? 'text-success' : 'text-warning'}">${metricas.general.eficienciaGeneral.toFixed(1)}%</div>
                                                    <div class="metric-label">Eficiencia</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="row mt-3">
                                            <div class="col-md-6">
                                                <small class="text-muted">
                                                    <strong>Capacidad Instalada:</strong> ${metricas.general.prendasIdealesPorJornada} prendas/jornada
                                                </small>
                                            </div>
                                            <div class="col-md-6">
                                                <small class="text-muted">
                                                    <strong>Meta:</strong> ${CONFIG_METRICAS.PROMEDIO_IDEAL_SEGUNDOS} segundos/prendas
                                                </small>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Métricas por Usuario -->
                        <div class="row mb-4">
                            <div class="col-12">
                                <div class="card">
                                    <div class="card-header d-flex justify-content-between align-items-center">
                                        <h6 class="mb-0">Desempeño por Usuario</h6>
                                        <small class="text-muted">${Object.keys(metricas.porUsuario).length} usuarios</small>
                                    </div>
                                    <div class="card-body p-0">
                                        <div class="table-responsive">
                                            <table class="table table-sm table-hover mb-0">
                                                <thead class="table-light">
                                                    <tr>
                                                        <th>Usuario</th>
                                                        <th>Documentos</th>
                                                        <th>Total Prendas</th>
                                                        <th>Promedio/Prenda</th>
                                                        <th>Prendas/Hora</th>
                                                        <th>Prendas/Jornada</th>
                                                        <th>Eficiencia</th>
                                                        <th>Cumplimiento</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    ${Object.entries(metricas.porUsuario).map(([usuario, datos]) => `
                                                        <tr>
                                                            <td><strong>${usuario}</strong></td>
                                                            <td>${datos.documentos}</td>
                                                            <td>${datos.totalPrendas}</td>
                                                            <td>${formatearSegundos(datos.promedioSegundosPorPrenda)}</td>
                                                            <td>${datos.prendasPorHora.toFixed(1)}</td>
                                                            <td>${datos.prendasPorJornada.toFixed(0)}</td>
                                                            <td>
                                                                <span class="badge ${datos.eficiencia >= 100 ? 'bg-success' : datos.eficiencia >= 80 ? 'bg-warning' : 'bg-danger'}">
                                                                    ${datos.eficiencia.toFixed(1)}%
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <div class="progress" style="height: 20px;">
                                                                    <div class="progress-bar ${datos.cumplimientoCapacidad >= 100 ? 'bg-success' : datos.cumplimientoCapacidad >= 80 ? 'bg-warning' : 'bg-danger'}" 
                                                                         style="width: ${Math.min(datos.cumplimientoCapacidad, 100)}%">
                                                                        ${datos.cumplimientoCapacidad.toFixed(1)}%
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    `).join('')}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Métricas por Día -->
                        <div class="row">
                            <div class="col-12">
                                <div class="card">
                                    <div class="card-header d-flex justify-content-between align-items-center">
                                        <h6 class="mb-0">Producción por Día</h6>
                                        <small class="text-muted">${Object.keys(metricas.porDia).length} días</small>
                                    </div>
                                    <div class="card-body p-0">
                                        <div class="table-responsive">
                                            <table class="table table-sm table-hover mb-0">
                                                <thead class="table-light">
                                                    <tr>
                                                        <th>Fecha</th>
                                                        <th>Documentos</th>
                                                        <th>Usuarios</th>
                                                        <th>Total Prendas</th>
                                                        <th>Tiempo Total</th>
                                                        <th>Promedio/Prenda</th>
                                                        <th>Prendas/Hora</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    ${Object.entries(metricas.porDia).map(([fecha, datos]) => {
                                                        const promedioSegundos = datos.totalSegundos / datos.totalPrendas;
                                                        const prendasPorHora = datos.totalPrendas / (datos.totalSegundos / 3600);
                                                        return `
                                                            <tr>
                                                                <td><strong>${fecha}</strong></td>
                                                                <td>${datos.documentos}</td>
                                                                <td>${datos.usuarios.size}</td>
                                                                <td>${datos.totalPrendas}</td>
                                                                <td>${formatearSegundos(datos.totalSegundos)}</td>
                                                                <td>${formatearSegundos(promedioSegundos)}</td>
                                                                <td>${prendasPorHora.toFixed(1)}</td>
                                                            </tr>
                                                        `;
                                                    }).join('')}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                        <button type="button" class="btn btn-primary" onclick="exportarMetricas()">
                            <i class="fas fa-download me-1"></i> Exportar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Agregar modal al DOM si no existe
    if (!document.getElementById('metricasModal')) {
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('metricasModal'));
    modal.show();
}

// Función para exportar métricas
function exportarMetricas() {
    const metricas = calcularMetricasProductividad(documentosGlobales);
    let csvContent = "Métricas de Productividad\n\n";

    // Resumen General
    csvContent += "RESUMEN GENERAL\n";
    csvContent += `Total Prendas,${metricas.general.totalPrendas}\n`;
    csvContent += `Promedio por Prenda (seg),${metricas.general.promedioSegundosPorPrenda.toFixed(2)}\n`;
    csvContent += `Prendas por Hora,${metricas.general.prendasPorHora.toFixed(2)}\n`;
    csvContent += `Eficiencia General,${metricas.general.eficienciaGeneral.toFixed(2)}%\n`;
    csvContent += `Capacidad Instalada,${metricas.general.prendasIdealesPorJornada}\n\n`;

    // Por Usuario
    csvContent += "DESEMPEÑO POR USUARIO\n";
    csvContent += "Usuario,Documentos,Total Prendas,Promedio/Prenda (seg),Prendas/Hora,Prendas/Jornada,Eficiencia (%),Cumplimiento (%)\n";
    Object.entries(metricas.porUsuario).forEach(([usuario, datos]) => {
        csvContent += `"${usuario}",${datos.documentos},${datos.totalPrendas},${datos.promedioSegundosPorPrenda.toFixed(2)},${datos.prendasPorHora.toFixed(2)},${datos.prendasPorJornada.toFixed(0)},${datos.eficiencia.toFixed(2)},${datos.cumplimientoCapacidad.toFixed(2)}\n`;
    });

    csvContent += "\nPRODUCCIÓN POR DÍA\n";
    csvContent += "Fecha,Documentos,Usuarios,Total Prendas,Tiempo Total (seg),Promedio/Prenda (seg),Prendas/Hora\n";
    Object.entries(metricas.porDia).forEach(([fecha, datos]) => {
        const promedioSegundos = datos.totalSegundos / datos.totalPrendas;
        const prendasPorHora = datos.totalPrendas / (datos.totalSegundos / 3600);
        csvContent += `"${fecha}",${datos.documentos},${datos.usuarios.size},${datos.totalPrendas},${datos.totalSegundos.toFixed(0)},${promedioSegundos.toFixed(2)},${prendasPorHora.toFixed(2)}\n`;
    });

    // Crear y descargar archivo
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `metricas_productividad_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ===== FUNCIONES BASE =====

// Función para formatear fecha a solo fecha (sin hora)
function formatearFechaSolo(fechaHoraStr) {
    if (!fechaHoraStr) return '-';
    
    try {
        // Si tiene formato con hora "1/11/2025 10:32:30"
        if (fechaHoraStr.includes(' ')) {
            return fechaHoraStr.split(' ')[0]; // Retorna solo "1/11/2025"
        }
        
        // Si ya es solo fecha
        return fechaHoraStr;
    } catch (e) {
        console.error('Error formateando fecha:', e);
        return fechaHoraStr;
    }
}

// Función para convertir fecha a objeto Date para comparación
function parsearFecha(fechaStr) {
    if (!fechaStr || fechaStr === '-') return null;
    
    try {
        // Formato "1/11/2025"
        const [day, month, year] = fechaStr.split('/');
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    } catch (e) {
        console.error('Error parseando fecha:', e, 'String:', fechaStr);
        return null;
    }
}

// Función para calcular consolidados
function calcularConsolidados(documentos) {
    const consolidados = {
        pendientes: { count: 0, unidades: 0 },
        proceso: { count: 0, unidades: 0 },
        directos: { count: 0, unidades: 0 },
        total: { count: 0, unidades: 0 }
    };

    documentos.forEach(doc => {
        if (ESTADOS_VISIBLES.includes(doc.estado)) {
            consolidados.total.count++;
            consolidados.total.unidades += doc.cantidad || 0;

            if (doc.estado === 'PENDIENTE') {
                consolidados.pendientes.count++;
                consolidados.pendientes.unidades += doc.cantidad || 0;
            } else if (doc.estado === 'DIRECTO') {
                consolidados.directos.count++;
                consolidados.directos.unidades += doc.cantidad || 0;
            } else if (doc.estado === 'ELABORACION' || doc.estado === 'PAUSADO') {
                consolidados.proceso.count++;
                consolidados.proceso.unidades += doc.cantidad || 0;
            }
        }
    });

    return consolidados;
}

// Función para actualizar las tarjetas de resumen
function actualizarTarjetasResumen(consolidados) {
    const pendientesElement = document.getElementById('contadorPendientes');
    const procesoElement = document.getElementById('contadorProceso');
    const directosElement = document.getElementById('contadorDirectos');
    const totalElement = document.getElementById('contadorTotal');
    
    if (pendientesElement) pendientesElement.textContent = consolidados.pendientes.count;
    if (document.getElementById('unidadesPendientes')) document.getElementById('unidadesPendientes').textContent = `${consolidados.pendientes.unidades} unidades`;
    
    if (procesoElement) procesoElement.textContent = consolidados.proceso.count;
    if (document.getElementById('unidadesProceso')) document.getElementById('unidadesProceso').textContent = `${consolidados.proceso.unidades} unidades`;
    
    if (directosElement) directosElement.textContent = consolidados.directos.count;
    if (document.getElementById('unidadesDirectos')) document.getElementById('unidadesDirectos').textContent = `${consolidados.directos.unidades} unidades`;
    
    if (totalElement) totalElement.textContent = consolidados.total.count;
    if (document.getElementById('unidadesTotal')) document.getElementById('unidadesTotal').textContent = `${consolidados.total.unidades} unidades`;
}

// Función para convertir hh:mm:ss a milisegundos
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

// Función para convertir milisegundos a hh:mm:ss
function milisegundosATiempo(ms) {
    const totalSec = Math.floor(ms / 1000);
    const horas = Math.floor(totalSec / 3600).toString().padStart(2, '0');
    const minutos = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
    const segundos = (totalSec % 60).toString().padStart(2, '0');
    return `${horas}:${minutos}:${segundos}`;
}

// Función para calcular la duración usando las columnas F-K
function calcularDuracionDesdeSheets(datos) {
    const {
        estado,
        datetime_inicio,     // Col F - Fecha/hora inicio
        datetime_fin,        // Col G - Fecha/hora fin
        duracion_guardada,   // Col H - Duración acumulada
        datetime_pausas,     // Col J - Fecha/hora última pausa
        duracion_pausas      // Col K - Duración pausas acumulada
    } = datos;

    if (estado === 'PAUSADO') {
        // Solo mostrar duración guardada cuando está pausado
        return duracion_guardada || '00:00:00';
    } else if (estado === 'FINALIZADO') {
        // Mostrar duración final cuando está finalizado
        return duracion_guardada || '00:00:00';
    } else {
        // Calcular duración en tiempo real para estados activos
        let msTotal = 0;

        // Sumar duración acumulada previa
        if (duracion_guardada) {
            msTotal += tiempoAMilisegundos(duracion_guardada);
        }

        // Sumar tiempo desde el último inicio/reanudación
        if (datetime_inicio) {
            const ahora = new Date();
            const ultimoInicio = new Date(datetime_inicio);
            if (!isNaN(ultimoInicio.getTime())) {
                msTotal += ahora - ultimoInicio;
            }
        }

        return milisegundosATiempo(msTotal);
    }
}

// Función para iniciar/actualizar timers
function iniciarTimers(documentos) {
    // Limpiar timers anteriores
    Object.keys(timers).forEach(rec => {
        clearInterval(timers[rec]);
        delete timers[rec];
    });
    
    // Iniciar timers para documentos activos
    documentos.forEach(doc => {
        if (doc.estado !== 'PAUSADO' && doc.estado !== 'FINALIZADO' && doc.datetime_inicio) {
            timers[doc.rec] = setInterval(() => {
                actualizarDuracionEnTabla(doc.rec);
            }, 1000);
        }
    });
}

// Función para actualizar la duración en la tabla
function actualizarDuracionEnTabla(rec) {
    if (documentosTable) {
        const fila = documentosTable.row((idx, data) => data.rec === rec);
        if (fila.any()) {
            const datos = fila.data();
            const nuevaDuracion = calcularDuracionDesdeSheets(datos);
            
            // Actualizar solo si la duración cambió
            const celdaDuracion = $(fila.node()).find('.duracion-tiempo');
            if (celdaDuracion.length && celdaDuracion.text() !== nuevaDuracion) {
                celdaDuracion.text(nuevaDuracion);
            }
        }
    }
}

// Función para configurar filtro de fecha CORREGIDA
function configurarFiltroFecha() {
    if (documentosTable) {
        // Limpiar filtros anteriores
        $.fn.dataTable.ext.search = [];
        
        // Agregar filtro personalizado para fechas
        $.fn.dataTable.ext.search.push(
            function(settings, data, dataIndex) {
                if (!rangoFechasSeleccionado) {
                    return true; // Mostrar todos si no hay filtro
                }

                try {
                    // Obtener los datos completos de la fila
                    const rowData = documentosTable.row(dataIndex).data();
                    if (!rowData || !rowData.fecha_objeto) {
                        return false;
                    }

                    const [fechaInicio, fechaFin] = rangoFechasSeleccionado;
                    
                    // Ajustar fechas para comparación (incluir todo el día)
                    const inicio = new Date(fechaInicio);
                    inicio.setHours(0, 0, 0, 0);
                    
                    const fin = new Date(fechaFin);
                    fin.setHours(23, 59, 59, 999);

                    const fechaFila = new Date(rowData.fecha_objeto);
                    return fechaFila >= inicio && fechaFila <= fin;
                } catch (e) {
                    console.error('Error filtrando fecha:', e);
                    return false;
                }
            }
        );
    }
}

// Función para aplicar filtro de fecha
function aplicarFiltroFecha(fechaInicio, fechaFin) {
    rangoFechasSeleccionado = [fechaInicio, fechaFin];
    
    if (documentosTable) {
        documentosTable.draw();
        
        // Recalcular consolidados con datos filtrados
        const datosFiltrados = documentosTable.rows({ search: 'applied' }).data().toArray();
        const consolidados = calcularConsolidados(datosFiltrados);
        actualizarTarjetasResumen(consolidados);
    }
}

// Función para limpiar filtros
function limpiarFiltros() {
    rangoFechasSeleccionado = null;
    if (document.getElementById('filtroFecha')) {
        document.getElementById('filtroFecha').value = '';
    }
    if (document.getElementById('recInput')) {
        document.getElementById('recInput').value = '';
    }
    
    if (documentosTable) {
        // Remover filtros personalizados
        $.fn.dataTable.ext.search = [];
        configurarFiltroFecha(); // Volver a agregar el filtro
        
        documentosTable.search('').draw();
        
        // Recalcular consolidados con todos los datos
        const consolidados = calcularConsolidados(documentosGlobales);
        actualizarTarjetasResumen(consolidados);
    }
}

// Función para cargar responsables desde Google Sheets
async function cargarResponsables() {
    const SPREADSHEET_ID = "1d5dCCCgiWXfM6vHu3zGGKlvK2EycJtT7Uk4JqUjDOfE";
    const API_KEY = 'AIzaSyC7hjbRc0TGLgImv8gVZg8tsOeYWgXlPcM';
    
    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/RESPONSABLES!A2:B?key=${API_KEY}`;
        const response = await fetch(url);
        
        if (!response.ok) throw new Error('Error al obtener responsables');
        
        const data = await response.json();
        const values = data.values || [];
        
        // Filtrar responsables activos (columna B = true)
        listaResponsables = values
            .filter(row => row[1] === 'true' || row[1] === 'TRUE')
            .map(row => row[0].trim())
            .filter(nombre => nombre !== '');
            
        console.log('Responsables cargados:', listaResponsables);
        return listaResponsables;
        
    } catch (error) {
        console.error('Error cargando responsables:', error);
        // Lista por defecto en caso de error
        listaResponsables = [
            'NICOLE VALERIA MONCALEANO DIAZ',
            'KELLY TATIANA FERNANDEZ ASTUDILLO',
            'PILAR CRISTINA JARAMILLO SANCHEZ',
            'LESLY CAMILA OCHOA PEDRAZA',
            'ANGIE LIZETH POLO CAPERA',
            'REYES PADILLA DONELLY',
            'NAILEN GABRIELA ZAPATA VIERA',
            'PAULA VANESSA SANCHEZ ERAZO',
            'PAOLA ANDREA ESCOBEDO JUSPIAN'
        ];
        return listaResponsables;
    }
}

// Función para obtener responsables disponibles para un documento específico
function obtenerResponsablesDisponibles(documentos, documentoActual) {
    const responsablesAsignados = documentos
        .filter(doc => doc.rec !== documentoActual.rec) // Excluir el documento actual
        .map(doc => doc.colaborador)
        .filter(resp => resp && resp.trim() !== '' && resp !== 'Sin responsable');
    
    return listaResponsables.filter(resp => !responsablesAsignados.includes(resp));
}

// Función para calcular cantidad total de un documento
function calcularCantidadTotal(documento) {
    if (!documento.datosCompletos) return 0;
    
    let cantidad = 0;
    
    // Sumar cantidad principal
    if (documento.datosCompletos.CANTIDAD) {
        cantidad += parseInt(documento.datosCompletos.CANTIDAD) || 0;
    }
    
    // Sumar distribución de clientes
    if (documento.datosCompletos.DISTRIBUCION && documento.datosCompletos.DISTRIBUCION.Clientes) {
        Object.values(documento.datosCompletos.DISTRIBUCION.Clientes).forEach(cliente => {
            if (cliente.distribucion && Array.isArray(cliente.distribucion)) {
                cliente.distribucion.forEach(item => {
                    cantidad += parseInt(item.cantidad) || 0;
                });
            }
        });
    }
    
    // Sumar anexos si existen
    if (documento.datosCompletos.ANEXOS && Array.isArray(documento.datosCompletos.ANEXOS)) {
        documento.datosCompletos.ANEXOS.forEach(anexo => {
            cantidad += parseInt(anexo.CANTIDAD) || 0;
        });
    }
    
    return cantidad;
}

// Función para obtener estados según configuración
function obtenerEstadosParaMostrar() {
    return mostrarFinalizados 
        ? [...ESTADOS_VISIBLES, ...ESTADOS_FINALIZADOS]
        : ESTADOS_VISIBLES;
}

// Función para alternar visibilidad de finalizados
function toggleFinalizados() {
    mostrarFinalizados = !mostrarFinalizados;
    const btn = document.getElementById('btnToggleFinalizados');
    if (btn) {
        btn.innerHTML = mostrarFinalizados 
            ? '<i class="fas fa-eye-slash me-1"></i>Ocultar Finalizados'
            : '<i class="fas fa-eye me-1"></i>Mostrar Finalizados';
    }
    cargarTablaDocumentos();
}

// Función para cargar la tabla de documentos
async function cargarTablaDocumentos() {
    try {
        // Cargar responsables primero
        await cargarResponsables();
        
        if (documentosTable) {
            documentosTable.destroy();
        }

        const documentosDisponibles = await obtenerDocumentosCombinados();
        documentosGlobales = documentosDisponibles; // Guardar para filtros
        
        // Calcular y mostrar consolidados
        const consolidados = calcularConsolidados(documentosDisponibles);
        actualizarTarjetasResumen(consolidados);
        
        inicializarDataTable(documentosDisponibles);
        
    } catch (error) {
        console.error('Error al cargar tabla de documentos:', error);
        mostrarError('Error al cargar los documentos: ' + error.message);
    }
}

// Función para obtener datos combinados
async function obtenerDocumentosCombinados() {
    const SPREADSHEET_ID = "1d5dCCCgiWXfM6vHu3zGGKlvK2EycJtT7Uk4JqUjDOfE";
    const API_KEY = 'AIzaSyC7hjbRc0TGLgImv8gVZg8tsOeYWgXlPcM';
    
    try {
        // Obtener datos de la hoja DATA (columnas A-K)
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/DATA!A2:K?key=${API_KEY}`;
        const response = await fetch(url);
        
        if (!response.ok) throw new Error('Error al obtener datos de la hoja DATA');
        
        const data = await response.json();
        const values = data.values || [];
        
        const datosGlobalesMap = {};
        datosGlobales.forEach(item => {
            if (item.REC) {
                datosGlobalesMap[item.REC] = item;
            }
        });

        const estadosParaMostrar = obtenerEstadosParaMostrar();
        const documentosProcesados = values
            .map((row) => {
                const documento = String(row[0] || '').trim();
                const estado = String(row[3] || '').trim().toUpperCase();
                const colaborador = String(row[4] || '').trim();
                const fechaHora = row[1] || ''; // Fecha completa con hora
                const fechaSolo = formatearFechaSolo(fechaHora); // Solo fecha para mostrar
                
                // Datos de duración desde columnas F-K
                const datetime_inicio = row[5] || '';    // Col F - DATETIME
                const datetime_fin = row[6] || '';       // Col G - FIN
                const duracion_guardada = row[7] || '';  // Col H - DURACION
                const pausas = row[8] || '';             // Col I - PAUSAS
                const datetime_pausas = row[9] || '';    // Col J - DATETIME_PAUSAS
                const duracion_pausas = row[10] || '';   // Col K - DURACION_PAUSAS
                
                const datosCompletos = datosGlobalesMap[documento];
                const cantidadTotal = datosCompletos ? calcularCantidadTotal({ datosCompletos }) : 0;
                
                return {
                    rec: documento,
                    estado: estado,
                    colaborador: colaborador,
                    fecha: fechaSolo, // Solo fecha para mostrar
                    fecha_completa: fechaHora, // Fecha completa para tooltip
                    fecha_objeto: parsearFecha(fechaSolo), // Para filtros
                    cantidad: cantidadTotal,
                    lote: datosCompletos ? (datosCompletos.LOTE || '') : '',
                    refProv: datosCompletos ? (datosCompletos.REFPROV || '') : '',
                    linea: datosCompletos ? (datosCompletos.LINEA || '') : '',
                    tieneClientes: datosCompletos ? 
                        (datosCompletos.DISTRIBUCION && datosCompletos.DISTRIBUCION.Clientes && 
                         Object.keys(datosCompletos.DISTRIBUCION.Clientes).length > 0) : false,
                    datosCompletos: datosCompletos,
                    // Datos de duración
                    datetime_inicio: datetime_inicio,
                    datetime_fin: datetime_fin,
                    duracion_guardada: duracion_guardada,
                    pausas: pausas,
                    datetime_pausas: datetime_pausas,
                    duracion_pausas: duracion_pausas
                };
            })
            .filter(doc => doc.rec && estadosParaMostrar.includes(doc.estado));

        return documentosProcesados;
            
    } catch (error) {
        console.error('Error obteniendo documentos:', error);
        throw error;
    }
}

// Función para verificar si un responsable puede ser modificado
function puedeModificarResponsable(documento) {
    // No se puede modificar si ya tiene un responsable asignado
    return !documento.colaborador || documento.colaborador.trim() === '';
}

// Función para generar el select de responsables
function generarSelectResponsables(rec, responsableActual = '', todosDocumentos, documentoActual) {
    const puedeModificar = puedeModificarResponsable(documentoActual);
    const responsablesDisponibles = puedeModificar 
        ? obtenerResponsablesDisponibles(todosDocumentos, documentoActual)
        : [];
    
    let opciones = '';
    
    if (puedeModificar) {
        // Puede seleccionar responsable
        opciones = `
            <option value="">Sin responsable</option>
            ${responsablesDisponibles.map(resp => 
                `<option value="${resp}" ${resp === responsableActual ? 'selected' : ''}>${resp}</option>`
            ).join('')}
        `;
        
        return `
            <select class="form-select form-select-sm select-responsable" 
                    data-rec="${rec}" 
                    style="min-width: 180px; font-size: 0.8rem;">
                ${opciones}
            </select>
        `;
    } else {
        // No puede modificar, mostrar como texto
        const tieneResponsable = responsableActual && responsableActual.trim() !== '';
        const texto = tieneResponsable ? responsableActual : 'Sin responsable';
        const clase = tieneResponsable ? 'text-success' : 'text-muted';
        
        return `
            <span class="${clase} small" title="Responsable asignado - No modificable">
                <i class="fas fa-user me-1"></i>${texto}
            </span>
        `;
    }
}

// Función para cambiar responsable
function cambiarResponsable(rec, responsable) {
    console.log(`Cambiando responsable de REC${rec} a: ${responsable}`);
    // Aquí iría la lógica para guardar en Google Sheets
    mostrarMensaje(`Responsable de REC${rec} actualizado a ${responsable}`, 'success');
    
    // Recargar tabla después de un breve delay
    setTimeout(() => {
        cargarTablaDocumentos();
    }, 1000);
}

// Función para cambiar estado del documento
function cambiarEstadoDocumento(rec, nuevoEstado) {
    console.log(`Cambiando estado del documento REC${rec} a: ${nuevoEstado}`);
    
    // Detener o iniciar timer según el nuevo estado
    if (nuevoEstado === 'PAUSADO' || nuevoEstado === 'FINALIZADO') {
        if (timers[rec]) {
            clearInterval(timers[rec]);
            delete timers[rec];
        }
    } else if (nuevoEstado === 'ELABORACION') {
        // Reiniciar timer si vuelve a elaboración
        if (!timers[rec]) {
            timers[rec] = setInterval(() => {
                actualizarDuracionEnTabla(rec);
            }, 1000);
        }
    }
    
    mostrarMensaje(`Estado de REC${rec} cambiado a ${nuevoEstado}`, 'success');
    
    setTimeout(() => {
        cargarTablaDocumentos();
    }, 1000);
}

// Función para restablecer documento
function restablecerDocumento(rec) {
    const password = prompt('Ingrese la contraseña para restablecer:');
    if (password === 'cmendoza') {
        console.log(`Restableciendo documento REC${rec}`);
        
        // Detener timer si existe
        if (timers[rec]) {
            clearInterval(timers[rec]);
            delete timers[rec];
        }
        
        mostrarMensaje(`Documento REC${rec} restablecido correctamente`, 'success');
        
        setTimeout(() => {
            cargarTablaDocumentos();
        }, 1000);
    } else if (password !== null) {
        alert('Contraseña incorrecta');
    }
}

// Función para determinar acciones según estado
function obtenerBotonesAccion(data) {
    const tieneColaborador = data.colaborador && data.colaborador.trim() !== '';
    const tieneClientes = data.tieneClientes;
    const puedeImprimir = tieneColaborador && tieneClientes;
    
    let botonesEstado = '';
    
    // Lógica de estados simplificada
    if (data.estado === 'PAUSADO') {
        botonesEstado = `
            <button class="btn btn-success btn-sm" 
                    onclick="cambiarEstadoDocumento('${data.rec}', 'ELABORACION')"
                    title="Reanudar">
                <i class="fas fa-play"></i>
            </button>`;
    } else if (data.estado === 'ELABORACION') {
        botonesEstado = `
            <button class="btn btn-warning btn-sm" 
                    onclick="cambiarEstadoDocumento('${data.rec}', 'PAUSADO')"
                    title="Pausar">
                <i class="fas fa-pause"></i>
            </button>`;
    } else if (data.estado === 'PENDIENTE' || data.estado === 'DIRECTO') {
        botonesEstado = `
            <button class="btn btn-warning btn-sm" 
                    onclick="cambiarEstadoDocumento('${data.rec}', 'PAUSADO')"
                    title="Pausar">
                <i class="fas fa-pause"></i>
            </button>`;
    }
    
    // Botón finalizar (siempre disponible excepto para FINALIZADO)
    if (data.estado !== 'FINALIZADO') {
        botonesEstado += `
            <button class="btn btn-info btn-sm" 
                    onclick="cambiarEstadoDocumento('${data.rec}', 'FINALIZADO')"
                    title="Finalizar">
                <i class="fas fa-check"></i>
            </button>`;
    }
    
    return `
        <div class="btn-group btn-group-sm">
            <!-- Imprimir Clientes (solo ícono) -->
            <button class="btn ${puedeImprimir ? 'btn-primary' : 'btn-secondary'} btn-sm" 
                    ${puedeImprimir ? '' : 'disabled'}
                    onclick="imprimirSoloClientesDesdeTabla('${data.rec}')"
                    title="${puedeImprimir ? 'Imprimir clientes' : 'No se puede imprimir'}">
                <i class="fas fa-print"></i>
            </button>
            
            ${botonesEstado}
            
            <!-- Restablecer (siempre disponible) -->
            <button class="btn btn-danger btn-sm" 
                    onclick="restablecerDocumento('${data.rec}')"
                    title="Restablecer">
                <i class="fas fa-undo"></i>
            </button>
        </div>
    `;
}

// Función para inicializar DataTable
function inicializarDataTable(documentos) {
    const table = $('#documentosTable');
    
    // Limpiar filtros anteriores
    $.fn.dataTable.ext.search = [];
    
    documentosTable = table.DataTable({
        data: documentos,
        columns: [
            { 
                data: 'rec',
                render: function(data) {
                    return `<strong class="text-primary">REC${data}</strong>`;
                }
            },
            { 
                data: 'estado',
                render: function(data) {
                    const clases = {
                        'PENDIENTE': 'badge bg-warning',
                        'DIRECTO': 'badge bg-success',
                        'ELABORACION': 'badge bg-info',
                        'PAUSADO': 'badge bg-secondary',
                        'FINALIZADO': 'badge bg-dark'
                    };
                    return `<span class="${clases[data] || 'badge bg-light text-dark'}">${data}</span>`;
                }
            },
            { 
                data: 'colaborador',
                render: function(data, type, row) {
                    return generarSelectResponsables(row.rec, data, documentos, row);
                }
            },
            { 
                data: 'fecha',
                render: function(data, type, row) {
                    const fechaCompleta = row.fecha_completa || data;
                    return `
                        <span class="small" title="${fechaCompleta}">
                            ${data}
                        </span>
                    `;
                }
            },
            { 
                data: null,
                render: function(data) {
                    const duracion = calcularDuracionDesdeSheets(data);
                    const clase = data.estado === 'PAUSADO' ? 'text-warning' : 
                                 data.estado === 'FINALIZADO' ? 'text-muted' : 'text-info';
                    
                    return `<span class="duracion-tiempo ${clase} small font-monospace">${duracion}</span>`;
                }
            },
            { 
                data: 'cantidad',
                render: function(data) {
                    return `<strong class="text-success">${data}</strong>`;
                }
            },
            { 
                data: null, // Nueva columna de eficiencia
                render: function(data, type, row) {
                    if (row.estado === 'FINALIZADO' && row.cantidad > 0 && row.duracion_guardada) {
                        const segundos = tiempoAMilisegundos(row.duracion_guardada) / 1000;
                        const segundosPorPrenda = segundos / row.cantidad;
                        const eficiencia = (CONFIG_METRICAS.PROMEDIO_IDEAL_SEGUNDOS / segundosPorPrenda) * 100;
                        
                        return `
                            <span class="badge ${eficiencia >= 100 ? 'bg-success' : eficiencia >= 80 ? 'bg-warning' : 'bg-danger'}" 
                                  title="${segundosPorPrenda.toFixed(1)} seg/prendas">
                                ${eficiencia.toFixed(1)}%
                            </span>
                        `;
                    }
                    return '<span class="text-muted">-</span>';
                },
                title: 'Eficiencia'
            },
            { 
                data: 'linea',
                render: function(data) {
                    return data ? `<span class="small">${data}</span>` : '<span class="text-muted small">-</span>';
                }
            },
            { 
                data: 'lote',
                render: function(data) {
                    return data ? `<span class="small">${data}</span>` : '<span class="text-muted small">-</span>';
                }
            },
            { 
                data: 'refProv',
                render: function(data) {
                    return data ? `<span class="small">${data}</span>` : '<span class="text-muted small">-</span>';
                }
            },
            {
                data: null,
                render: obtenerBotonesAccion,
                orderable: false
            }
        ],
        language: {
            url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json'
        },
        pageLength: 50,
        responsive: true,
        dom: '<"row"<"col-sm-12 col-md-6"l><"col-sm-12 col-md-6"f>>rt<"row"<"col-sm-12 col-md-6"i><"col-sm-12 col-md-6"p>>',
        order: [[0, 'desc']],
        columnDefs: [
            { responsivePriority: 1, targets: 0 }, // Documento
            { responsivePriority: 2, targets: 11 }, // Acciones (ahora índice 11)
            { responsivePriority: 3, targets: 5 }, // Cantidad
            { responsivePriority: 4, targets: 4 }, // Duración
            { responsivePriority: 5, targets: 6 }, // Eficiencia
            { responsivePriority: 6, targets: 1 }, // Estado
            { responsivePriority: 7, targets: 2 }  // Responsable
        ],
        initComplete: function() {
            // Agregar evento change a los selects de responsables
            $('.select-responsable').on('change', function() {
                const rec = $(this).data('rec');
                const responsable = $(this).val();
                cambiarResponsable(rec, responsable);
            });
            
            // Configurar filtro de fecha
            configurarFiltroFecha();
            
            // Iniciar timers para documentos activos
            iniciarTimers(documentos);
        },
        drawCallback: function() {
            // Re-agregar evento después de cada redibujado de la tabla
            $('.select-responsable').on('change', function() {
                const rec = $(this).data('rec');
                const responsable = $(this).val();
                cambiarResponsable(rec, responsable);
            });
        }
    });
}

// Función para mostrar mensajes
function mostrarMensaje(mensaje, tipo = 'info') {
    const alertClass = {
        'success': 'alert-success',
        'error': 'alert-danger',
        'info': 'alert-info'
    }[tipo] || 'alert-info';

    const resultado = document.getElementById('resultado');
    if (resultado) {
        resultado.innerHTML = `
            <div class="col-12">
                <div class="alert ${alertClass} alert-dismissible fade show" role="alert">
                    <i class="fas fa-info-circle me-2"></i>
                    ${mensaje}
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
            </div>
        `;
    }
}

function mostrarError(mensaje) {
    mostrarMensaje(mensaje, 'error');
}

// Agregar botón de métricas al header
function agregarBotonMetricas() {
    const header = document.querySelector('.header .d-flex');
    if (header && !document.getElementById('btnMetricas')) {
        const botonMetricas = document.createElement('button');
        botonMetricas.id = 'btnMetricas';
        botonMetricas.className = 'btn btn-success btn-sm ms-2';
        botonMetricas.innerHTML = '<i class="fas fa-chart-line me-1"></i>Métricas';
        botonMetricas.onclick = mostrarPanelMetricas;
        header.appendChild(botonMetricas);
    }
}

// Cargar tabla cuando la página esté lista
document.addEventListener('DOMContentLoaded', function() {
    const checkDataLoaded = setInterval(() => {
        if (datosGlobales && datosGlobales.length > 0) {
            clearInterval(checkDataLoaded);
            cargarTablaDocumentos();
            agregarBotonMetricas();
        }
    }, 500);
});

// Limpiar timers cuando se cierre la página
window.addEventListener('beforeunload', function() {
    Object.keys(timers).forEach(rec => {
        clearInterval(timers[rec]);
    });
});

// Hacer funciones disponibles globalmente
window.aplicarFiltroFecha = aplicarFiltroFecha;
window.limpiarFiltros = limpiarFiltros;
window.cambiarEstadoDocumento = cambiarEstadoDocumento;
window.restablecerDocumento = restablecerDocumento;
window.imprimirSoloClientesDesdeTabla = imprimirSoloClientesDesdeTabla;
window.buscarDocumentoEnTabla = buscarDocumentoEnTabla;
window.toggleFinalizados = toggleFinalizados;
window.cargarTablaDocumentos = cargarTablaDocumentos;
window.mostrarPanelMetricas = mostrarPanelMetricas;
window.exportarMetricas = exportarMetricas;
