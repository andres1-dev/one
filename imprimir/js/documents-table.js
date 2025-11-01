// Configuración de DataTable para documentos disponibles
let documentosTable = null;
let listaResponsables = [];

// Estados permitidos para mostrar
const ESTADOS_PERMITIDOS = ['PENDIENTE', 'DIRECTO', 'ELABORACION', 'PAUSADO'];

// Estados y sus acciones permitidas
const ACCIONES_ESTADO = {
    'PENDIENTE': ['PAUSAR', 'FINALIZAR', 'RESTABLECER'],
    'DIRECTO': ['PAUSAR', 'FINALIZAR', 'RESTABLECER'],
    'ELABORACION': ['REANUDAR', 'FINALIZAR', 'RESTABLECER'],
    'PAUSADO': ['REANUDAR', 'FINALIZAR', 'RESTABLECER']
};

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

// Función para cargar la tabla de documentos
async function cargarTablaDocumentos() {
    try {
        // Mostrar loader
        if (documentosTable) {
            documentosTable.destroy();
        }

        // Obtener datos combinados
        const documentosDisponibles = await obtenerDocumentosCombinados();
        
        // Inicializar DataTable
        inicializarDataTable(documentosDisponibles);
        
    } catch (error) {
        console.error('Error al cargar tabla de documentos:', error);
        mostrarError('Error al cargar los documentos: ' + error.message);
    }
}

// Función para obtener datos combinados de DATA y datos globales
async function obtenerDocumentosCombinados() {
    const SPREADSHEET_ID = "1d5dCCCgiWXfM6vHu3zGGKlvK2EycJtT7Uk4JqUjDOfE";
    const API_KEY = 'AIzaSyC7hjbRc0TGLgImv8gVZg8tsOeYWgXlPcM';
    
    try {
        // Obtener datos básicos de la hoja DATA
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/DATA!A2:E?key=${API_KEY}`;
        const response = await fetch(url);
        
        if (!response.ok) throw new Error('Error al obtener datos de la hoja DATA');
        
        const data = await response.json();
        const values = data.values || [];
        
        // Crear mapa de datos globales para búsqueda rápida
        const datosGlobalesMap = {};
        datosGlobales.forEach(item => {
            if (item.REC) {
                datosGlobalesMap[item.REC] = item;
            }
        });

        // Procesar y combinar datos
        const documentosProcesados = values
            .map((row, index) => {
                const documento = String(row[0] || '').trim();
                const estado = String(row[3] || '').trim().toUpperCase();
                const colaborador = String(row[4] || '').trim();
                
                // Buscar información adicional en datosGlobales
                const datosCompletos = datosGlobalesMap[documento];
                
                // Calcular cantidad total
                const cantidadTotal = datosCompletos ? calcularCantidadTotal({ datosCompletos }) : 0;
                
                return {
                    rec: documento,
                    estado: estado,
                    colaborador: colaborador,
                    fecha: row[1] || '',
                    cantidad: cantidadTotal,
                    lote: datosCompletos ? (datosCompletos.LOTE || '') : '',
                    refProv: datosCompletos ? (datosCompletos.REFPROV || '') : '',
                    linea: datosCompletos ? (datosCompletos.LINEA || '') : '',
                    tieneClientes: datosCompletos ? 
                        (datosCompletos.DISTRIBUCION && datosCompletos.DISTRIBUCION.Clientes && 
                         Object.keys(datosCompletos.DISTRIBUCION.Clientes).length > 0) : false,
                    datosCompletos: datosCompletos,
                    rawData: row
                };
            })
            .filter(doc => 
                doc.rec && 
                ESTADOS_PERMITIDOS.includes(doc.estado)
            );

        return documentosProcesados;
            
    } catch (error) {
        console.error('Error obteniendo documentos:', error);
        throw error;
    }
}

// Función para determinar qué acciones mostrar según el estado
function obtenerAccionesDisponibles(estado) {
    return ACCIONES_ESTADO[estado] || [];
}

// Función para cambiar estado del documento
function cambiarEstadoDocumento(rec, nuevoEstado) {
    console.log(`Cambiando estado del documento REC${rec} a: ${nuevoEstado}`);
    // Aquí iría la lógica para actualizar en Google Sheets
    mostrarMensaje(`Estado de REC${rec} cambiado a ${nuevoEstado}`, 'success');
    
    // Recargar tabla después de un breve delay
    setTimeout(() => {
        cargarTablaDocumentos();
    }, 1000);
}

// Función para restablecer documento
function restablecerDocumento(rec) {
    const password = prompt('Ingrese la contraseña para restablecer:');
    if (password === 'cmendoza') {
        console.log(`Restableciendo documento REC${rec}`);
        // Aquí iría la lógica para restablecer en Google Sheets
        mostrarMensaje(`Documento REC${rec} restablecido correctamente`, 'success');
        
        // Recargar tabla después de un breve delay
        setTimeout(() => {
            cargarTablaDocumentos();
        }, 1000);
    } else if (password !== null) {
        alert('Contraseña incorrecta');
    }
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
                        'PAUSADO': 'badge bg-secondary'
                    };
                    return `<span class="${clases[data] || 'badge bg-light text-dark'}">${data}</span>`;
                }
            },
            { 
                data: 'colaborador',
                render: function(data) {
                    if (!data || data.trim() === '') {
                        return '<span class="text-muted small">Sin asignar</span>';
                    }
                    return `<span class="small">${data}</span>`;
                }
            },
            { 
                data: 'fecha',
                render: function(data) {
                    return data ? `<span class="small">${data}</span>` : '<span class="text-muted small">-</span>';
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
                render: function(data) {
                    const tieneColaborador = data.colaborador && data.colaborador.trim() !== '';
                    const tieneClientes = data.tieneClientes;
                    const accionesDisponibles = obtenerAccionesDisponibles(data.estado);
                    
                    // Botón de imprimir clientes
                    const btnImprimirClass = (tieneColaborador && tieneClientes) ? 'btn-primary' : 'btn-secondary';
                    const btnImprimirDisabled = !(tieneColaborador && tieneClientes) ? 'disabled' : '';
                    
                    let tooltipImprimir = 'Imprimir solo clientes';
                    if (!tieneColaborador) tooltipImprimir = 'Sin colaborador asignado';
                    else if (!tieneClientes) tooltipImprimir = 'Sin clientes asignados';
                    
                    let botonesAcciones = `
                        <div class="btn-group-vertical btn-group-sm" style="min-width: 120px;">
                            <!-- Botón Imprimir Clientes -->
                            <button class="btn ${btnImprimirClass} btn-sm mb-1" ${btnImprimirDisabled}
                                    onclick="imprimirSoloClientesDesdeTabla('${data.rec}')"
                                    title="${tooltipImprimir}">
                                <i class="fas fa-print me-1"></i>Clientes
                            </button>
                            <div class="btn-group btn-group-sm">
                    `;
                    
                    // Botones de estado según disponibilidad
                    if (accionesDisponibles.includes('PAUSAR')) {
                        botonesAcciones += `
                            <button class="btn btn-warning btn-sm" 
                                    onclick="cambiarEstadoDocumento('${data.rec}', 'PAUSADO')"
                                    title="Pausar documento">
                                <i class="fas fa-pause"></i>
                            </button>`;
                    }
                    
                    if (accionesDisponibles.includes('REANUDAR')) {
                        botonesAcciones += `
                            <button class="btn btn-success btn-sm" 
                                    onclick="cambiarEstadoDocumento('${data.rec}', 'ELABORACION')"
                                    title="Reanudar documento">
                                <i class="fas fa-play"></i>
                            </button>`;
                    }
                    
                    if (accionesDisponibles.includes('FINALIZAR')) {
                        botonesAcciones += `
                            <button class="btn btn-info btn-sm" 
                                    onclick="cambiarEstadoDocumento('${data.rec}', 'FINALIZADO')"
                                    title="Finalizar documento">
                                <i class="fas fa-check"></i>
                            </button>`;
                    }
                    
                    // Botón de restablecer (siempre disponible)
                    botonesAcciones += `
                            <button class="btn btn-danger btn-sm" 
                                    onclick="restablecerDocumento('${data.rec}')"
                                    title="Restablecer documento">
                                <i class="fas fa-undo"></i>
                            </button>
                            </div>
                        </div>
                    `;
                    
                    return botonesAcciones;
                },
                orderable: false
            }
        ],
        language: {
            url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json'
        },
        pageLength: 50,
        responsive: true,
        dom: '<"row"<"col-sm-12 col-md-6"l><"col-sm-12 col-md-6"f>>rt<"row"<"col-sm-12 col-md-6"i><"col-sm-12 col-md-6"p>>',
        order: [[0, 'desc']], // Ordenar por documento descendente
        columnDefs: [
            { responsivePriority: 1, targets: 0 }, // Documento
            { responsivePriority: 2, targets: 8 }, // Acciones
            { responsivePriority: 3, targets: 4 }, // Cantidad
            { responsivePriority: 4, targets: 1 }  // Estado
        ]
    });
}

// Función para mostrar mensajes
function mostrarMensaje(mensaje, tipo = 'info') {
    const alertClass = {
        'success': 'alert-success',
        'error': 'alert-danger',
        'info': 'alert-info'
    }[tipo] || 'alert-info';
    
    const icon = {
        'success': 'fa-check-circle',
        'error': 'fa-exclamation-triangle',
        'info': 'fa-info-circle'
    }[tipo] || 'fa-info-circle';

    const resultado = document.getElementById('resultado');
    resultado.innerHTML = `
        <div class="col-12">
            <div class="alert ${alertClass} alert-dismissible fade show" role="alert">
                <i class="fas ${icon} me-2"></i>
                ${mensaje}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        </div>
    `;
}

// Función para mostrar error
function mostrarError(mensaje) {
    mostrarMensaje(mensaje, 'error');
}

// Cargar tabla cuando la página esté lista
document.addEventListener('DOMContentLoaded', function() {
    // Esperar a que los datos globales estén cargados
    const checkDataLoaded = setInterval(() => {
        if (datosGlobales && datosGlobales.length > 0) {
            clearInterval(checkDataLoaded);
            cargarTablaDocumentos();
        }
    }, 500);
});
