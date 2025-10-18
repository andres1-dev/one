// Configuración de DataTable para documentos disponibles
let documentosTable = null;

// Estados permitidos para mostrar
const ESTADOS_PERMITIDOS = ['PENDIENTE', 'DIRECTO', 'ELABORACION', 'PAUSADO'];

// Función para cargar la tabla de documentos
async function cargarTablaDocumentos() {
    try {
        // Mostrar loader
        if (documentosTable) {
            documentosTable.destroy();
        }

        // Obtener datos combinados de DATA y datos globales
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
        return values
            .map((row, index) => {
                const documento = String(row[0] || '').trim();
                const estado = String(row[3] || '').trim().toUpperCase();
                const colaborador = String(row[4] || '').trim();
                
                // Buscar información adicional en datosGlobales
                const datosCompletos = datosGlobalesMap[documento];
                
                return {
                    rec: documento,
                    estado: estado,
                    colaborador: colaborador,
                    fecha: row[1] || '',
                    linea: row[2] || '',
                    lote: datosCompletos ? (datosCompletos.LOTE || '') : '',
                    refProv: datosCompletos ? (datosCompletos.REFPROV || '') : '',
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
            
    } catch (error) {
        console.error('Error obteniendo documentos:', error);
        throw error;
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
                    return `<strong>REC${data}</strong>`;
                }
            },
            { 
                data: 'estado',
                render: function(data) {
                    const clase = `estado-${data.toLowerCase()}`;
                    return `<span class="${clase}">${data}</span>`;
                }
            },
            { 
                data: 'colaborador',
                render: function(data, type, row) {
                    if (!data) {
                        return `
                            <div class="d-flex align-items-center">
                                <span class="text-danger me-2"><i class="fas fa-times-circle"></i></span>
                                <select class="form-select form-select-sm asignar-colaborador" 
                                        data-rec="${row.rec}" style="min-width: 150px;">
                                    <option value="">Seleccionar responsable</option>
                                    <option value="VILLAMIZAR GOMEZ LUIS">VILLAMIZAR GOMEZ LUIS</option>
                                    <option value="FABIAN MARIN FLOREZ">FABIAN MARIN FLOREZ</option>
                                    <option value="CESAR AUGUSTO LOPEZ GIRALDO">CESAR AUGUSTO LOPEZ GIRALDO</option>
                                    <option value="KELLY GIOVANA ZULUAGA HOYOS">KELLY GIOVANA ZULUAGA HOYOS</option>
                                    <option value="MARYI ANDREA GONZALEZ SILVA">MARYI ANDREA GONZALEZ SILVA</option>
                                    <option value="JOHAN STEPHANIE ESPÍNOSA RAMIREZ">JOHAN STEPHANIE ESPÍNOSA RAMIREZ</option>
                                    <option value="SANCHEZ LOPEZ YULIETH">SANCHEZ LOPEZ YULIETH</option>
                                    <option value="JUAN ESTEBAN ZULUAGA HOYOS">JUAN ESTEBAN ZULUAGA HOYOS</option>
                                </select>
                            </div>
                        `;
                    }
                    return `
                        <div class="d-flex align-items-center">
                            <span class="text-success me-2"><i class="fas fa-check-circle"></i></span>
                            <span>${data}</span>
                        </div>
                    `;
                }
            },
            { data: 'fecha' },
            { data: 'linea' },
            { 
                data: 'lote',
                render: function(data) {
                    return data || '<span class="text-muted">-</span>';
                }
            },
            { 
                data: 'refProv',
                render: function(data) {
                    return data || '<span class="text-muted">-</span>';
                }
            },
            {
                data: null,
                render: function(data) {
                    const tieneColaborador = data.colaborador && data.colaborador.trim() !== '';
                    const tieneClientes = data.tieneClientes;
                    
                    const btnImprimirClass = tieneColaborador && tieneClientes ? 'btn-primary' : 'btn-secondary';
                    const btnImprimirDisabled = !(tieneColaborador && tieneClientes) ? 'disabled' : '';
                    
                    const tooltipImprimir = tieneColaborador && tieneClientes ? 
                        'Imprimir solo clientes' : 
                        (!tieneColaborador ? 'Sin colaborador asignado' : 'Sin clientes asignados');
                    
                    return `
                        <div class="btn-group btn-group-sm">
                            <button class="btn ${btnImprimirClass} btn-action" ${btnImprimirDisabled}
                                    onclick="imprimirSoloClientesDesdeTabla('${data.rec}')"
                                    title="${tooltipImprimir}">
                                <i class="fas fa-print"></i> Clientes
                            </button>
                            <button class="btn btn-info btn-action" 
                                    onclick="buscarDocumentoEnTabla('${data.rec}')"
                                    title="Ver detalles completos">
                                <i class="fas fa-search"></i>
                            </button>
                            <button class="btn btn-success btn-action" 
                                    onclick="mostrarOpcionesDocumento('${data.rec}')"
                                    title="Opciones de impresión">
                                <i class="fas fa-cog"></i>
                            </button>
                        </div>
                    `;
                },
                orderable: false
            }
        ],
        language: {
            url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json'
        },
        pageLength: 25,
        responsive: true,
        dom: '<"row"<"col-sm-12 col-md-6"l><"col-sm-12 col-md-6"f>>rt<"row"<"col-sm-12 col-md-6"i><"col-sm-12 col-md-6"p>>',
        buttons: [
            {
                extend: 'colvis',
                text: '<i class="fas fa-columns me-1"></i>Columnas',
                className: 'btn btn-secondary'
            }
        ],
        initComplete: function() {
            // Agregar evento para los select de colaboradores
            $('.asignar-colaborador').on('change', function() {
                const rec = $(this).data('rec');
                const colaborador = $(this).val();
                asignarColaborador(rec, colaborador);
            });
        },
        drawCallback: function() {
            // Re-agregar evento después de cada redibujado de la tabla
            $('.asignar-colaborador').on('change', function() {
                const rec = $(this).data('rec');
                const colaborador = $(this).val();
                asignarColaborador(rec, colaborador);
            });
        }
    });
}

// Función para asignar colaborador
async function asignarColaborador(rec, colaborador) {
    if (!colaborador) return;
    
    try {
        // Aquí implementarías la lógica para guardar en Google Sheets
        console.log(`Asignando colaborador ${colaborador} al documento REC${rec}`);
        
        // Por ahora, mostramos un mensaje y recargamos la tabla
        mostrarMensaje(`Colaborador ${colaborador} asignado a REC${rec}`, 'success');
        
        // Recargar tabla después de un breve delay
        setTimeout(() => {
            cargarTablaDocumentos();
        }, 1000);
        
    } catch (error) {
        console.error('Error asignando colaborador:', error);
        mostrarMensaje('Error al asignar colaborador', 'error');
    }
}

// Función para imprimir solo clientes desde la tabla
function imprimirSoloClientesDesdeTabla(rec) {
    document.getElementById('recInput').value = rec;
    imprimirSoloClientes();
}

// Función para buscar documento en el sistema principal
function buscarDocumentoEnTabla(rec) {
    document.getElementById('recInput').value = rec;
    buscarPorREC();
}

// Función para mostrar opciones de impresión específicas
function mostrarOpcionesDocumento(rec) {
    document.getElementById('recInput').value = rec;
    mostrarOpcionesImpresion();
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
