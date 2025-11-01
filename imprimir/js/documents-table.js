// Configuración de DataTable para documentos disponibles
let documentosTable = null;
let listaResponsables = [];
let timers = {}; // Almacenar los intervalos de tiempo

// Estados permitidos para mostrar
let mostrarFinalizados = false;
const ESTADOS_VISIBLES = ['PENDIENTE', 'DIRECTO', 'ELABORACION', 'PAUSADO'];
const ESTADOS_FINALIZADOS = ['FINALIZADO'];

// URL de tu Google Apps Script
const GAS_URL = 'https://script.google.com/macros/s/AKfycbzeG16VGHb63ePAwm00QveNsdbMEHi9dFbNsmQCreNOXDtwIh22NHxzRpwuzZBZ-oIJWg/exec';

// Función para llamar a Google Apps Script
async function callGoogleAppsScript(functionName, params = {}) {
    try {
        const url = `${GAS_URL}?function=${functionName}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(params)
        });

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error(`Error llamando ${functionName}:`, error);
        return { 
            success: false, 
            message: `Error de conexión: ${error.message}` 
        };
    }
}

// Función para calcular la duración desde la fecha del documento
function calcularDuracion(fechaDocumento, estado) {
    if (!fechaDocumento) return '--:--:--';
    
    const fechaInicio = new Date(fechaDocumento);
    if (isNaN(fechaInicio.getTime())) return '--:--:--';
    
    const ahora = new Date();
    let diferencia = ahora - fechaInicio;
    
    // Si está pausado o finalizado, no contar el tiempo
    if (estado === 'PAUSADO' || estado === 'FINALIZADO') {
        return 'Pausado';
    }
    
    // Calcular horas, minutos y segundos
    const horas = Math.floor(diferencia / (1000 * 60 * 60));
    const minutos = Math.floor((diferencia % (1000 * 60 * 60)) / (1000 * 60));
    const segundos = Math.floor((diferencia % (1000 * 60)) / 1000);
    
    return `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
}

// Función para formatear fecha a un formato válido
function formatearFecha(fechaStr) {
    if (!fechaStr) return null;
    
    // Si ya es una fecha válida
    if (fechaStr.includes('-')) {
        return fechaStr;
    }
    
    // Si está en formato DD/MM/YYYY
    if (fechaStr.includes('/')) {
        const [day, month, year] = fechaStr.split('/');
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    return null;
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
        if (doc.estado !== 'PAUSADO' && doc.estado !== 'FINALIZADO' && doc.fecha) {
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
            const nuevaDuracion = calcularDuracion(datos.fecha, datos.estado);
            
            // Actualizar solo si la duración cambió
            const celdaDuracion = $(fila.node()).find('.duracion-tiempo');
            if (celdaDuracion.length && celdaDuracion.text() !== nuevaDuracion) {
                celdaDuracion.text(nuevaDuracion);
            }
        }
    }
}

// Función para cargar responsables desde Google Apps Script
async function cargarResponsables() {
    try {
        const resultado = await callGoogleAppsScript('obtenerResponsablesActivos');
        
        if (resultado.success && Array.isArray(resultado.data)) {
            listaResponsables = resultado.data;
        } else {
            // Lista por defecto en caso de error
            listaResponsables = [
                'VILLAMIZAR GOMEZ LUIS',
                'FABIAN MARIN FLOREZ', 
                'CESAR AUGUSTO LOPEZ GIRALDO',
                'KELLY GIOVANA ZULUAGA HOYOS',
                'MARYI ANDREA GONZALEZ SILVA',
                'JOHAN STEPHANIE ESPÍNOSA RAMIREZ',
                'SANCHEZ LOPEZ YULIETH',
                'JUAN ESTEBAN ZULUAGA HOYOS'
            ];
        }
        
        console.log('Responsables cargados:', listaResponsables);
        return listaResponsables;
    } catch (error) {
        console.error('Error cargando responsables:', error);
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
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/DATA!A2:E?key=${API_KEY}`;
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
                const fecha = formatearFecha(row[1] || '');
                
                const datosCompletos = datosGlobalesMap[documento];
                const cantidadTotal = datosCompletos ? calcularCantidadTotal({ datosCompletos }) : 0;
                
                return {
                    rec: documento,
                    estado: estado,
                    colaborador: colaborador,
                    fecha: fecha,
                    cantidad: cantidadTotal,
                    lote: datosCompletos ? (datosCompletos.LOTE || '') : '',
                    refProv: datosCompletos ? (datosCompletos.REFPROV || '') : '',
                    linea: datosCompletos ? (datosCompletos.LINEA || '') : '',
                    tieneClientes: datosCompletos ? 
                        (datosCompletos.DISTRIBUCION && datosCompletos.DISTRIBUCION.Clientes && 
                         Object.keys(datosCompletos.DISTRIBUCION.Clientes).length > 0) : false,
                    datosCompletos: datosCompletos
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

// Función para cambiar responsable (llamada real a GAS)
async function cambiarResponsable(rec, responsable) {
    try {
        console.log(`Cambiando responsable de REC${rec} a: ${responsable}`);
        
        const resultado = await callGoogleAppsScript('actualizarResponsable', {
            id: rec,
            nuevoNombre: responsable
        });
        
        if (resultado.success) {
            mostrarMensaje(resultado.message, 'success');
            setTimeout(() => cargarTablaDocumentos(), 1000);
        } else {
            mostrarMensaje(resultado.message, 'error');
        }
        
    } catch (error) {
        console.error('Error cambiando responsable:', error);
        mostrarMensaje('Error al cambiar responsable', 'error');
    }
}

// Función para cambiar estado del documento (llamada real a GAS)
async function cambiarEstadoDocumento(rec, nuevoEstado) {
    try {
        console.log(`Cambiando estado del documento REC${rec} a: ${nuevoEstado}`);
        
        let resultado;
        
        // Determinar qué función de GAS llamar según el estado
        switch(nuevoEstado) {
            case 'PAUSADO':
                resultado = await callGoogleAppsScript('pausarTarea', { id: rec });
                break;
            case 'ELABORACION':
                resultado = await callGoogleAppsScript('reanudarTarea', { id: rec });
                break;
            case 'FINALIZADO':
                resultado = await callGoogleAppsScript('finalizarTarea', { id: rec });
                break;
            default:
                resultado = { success: false, message: 'Estado no válido' };
        }
        
        if (resultado.success) {
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
            
            mostrarMensaje(resultado.message, 'success');
            setTimeout(() => cargarTablaDocumentos(), 1000);
        } else {
            mostrarMensaje(resultado.message, 'error');
        }
        
    } catch (error) {
        console.error('Error cambiando estado:', error);
        mostrarMensaje('Error al cambiar estado', 'error');
    }
}

// Función para restablecer documento (llamada real a GAS)
async function restablecerDocumento(rec) {
    const password = prompt('Ingrese la contraseña para restablecer:');
    if (password === 'cmendoza') {
        try {
            console.log(`Restableciendo documento REC${rec}`);
            
            const resultado = await callGoogleAppsScript('restablecerDocumento', {
                id: rec,
                password: password
            });
            
            if (resultado.success) {
                // Detener timer si existe
                if (timers[rec]) {
                    clearInterval(timers[rec]);
                    delete timers[rec];
                }
                
                mostrarMensaje(resultado.message, 'success');
                setTimeout(() => cargarTablaDocumentos(), 1000);
            } else {
                mostrarMensaje(resultado.message, 'error');
            }
            
        } catch (error) {
            console.error('Error restableciendo documento:', error);
            mostrarMensaje('Error al restablecer documento', 'error');
        }
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
                render: function(data) {
                    return data ? `<span class="small">${data}</span>` : '<span class="text-muted small">-</span>';
                }
            },
            { 
                data: null,
                render: function(data) {
                    const duracion = calcularDuracion(data.fecha, data.estado);
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
            { responsivePriority: 2, targets: 9 }, // Acciones
            { responsivePriority: 3, targets: 5 }, // Cantidad
            { responsivePriority: 4, targets: 4 }, // Duración
            { responsivePriority: 5, targets: 1 }, // Estado
            { responsivePriority: 6, targets: 2 }  // Responsable
        ],
        initComplete: function() {
            // Agregar evento change a los selects de responsables
            $('.select-responsable').on('change', function() {
                const rec = $(this).data('rec');
                const responsable = $(this).val();
                cambiarResponsable(rec, responsable);
            });
            
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
        },
        destroyCallback: function() {
            // Limpiar todos los timers al destruir la tabla
            Object.keys(timers).forEach(rec => {
                clearInterval(timers[rec]);
                delete timers[rec];
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

function mostrarError(mensaje) {
    mostrarMensaje(mensaje, 'error');
}

// Cargar tabla cuando la página esté lista
document.addEventListener('DOMContentLoaded', function() {
    const checkDataLoaded = setInterval(() => {
        if (datosGlobales && datosGlobales.length > 0) {
            clearInterval(checkDataLoaded);
            cargarTablaDocumentos();
        }
    }, 500);
});

// Limpiar timers cuando se cierre la página
window.addEventListener('beforeunload', function() {
    Object.keys(timers).forEach(rec => {
        clearInterval(timers[rec]);
    });
});
