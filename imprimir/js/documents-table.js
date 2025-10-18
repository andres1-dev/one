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

        // Obtener datos de la hoja DATA
        const documentosDisponibles = await obtenerDocumentosDisponibles();
        
        // Inicializar DataTable
        inicializarDataTable(documentosDisponibles);
        
    } catch (error) {
        console.error('Error al cargar tabla de documentos:', error);
        mostrarError('Error al cargar los documentos: ' + error.message);
    }
}

// Función para obtener documentos de la hoja DATA
async function obtenerDocumentosDisponibles() {
    const SPREADSHEET_ID = "1d5dCCCgiWXfM6vHu3zGGKlvK2EycJtT7Uk4JqUjDOfE";
    const API_KEY = 'AIzaSyC7hjbRc0TGLgImv8gVZg8tsOeYWgXlPcM';
    
    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/DATA!A2:E?key=${API_KEY}`;
        const response = await fetch(url);
        
        if (!response.ok) throw new Error('Error al obtener datos de la hoja DATA');
        
        const data = await response.json();
        const values = data.values || [];
        
        // Procesar y filtrar datos
        return values
            .map((row, index) => {
                const documento = String(row[0] || '').trim();
                const estado = String(row[3] || '').trim().toUpperCase();
                const colaborador = String(row[4] || '').trim();
                
                return {
                    rec: documento,
                    estado: estado,
                    colaborador: colaborador,
                    fecha: row[1] || '',
                    linea: row[2] || '',
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
                render: function(data) {
                    if (!data) {
                        return '<span class="text-danger"><i class="fas fa-times-circle me-1"></i>Sin asignar</span>';
                    }
                    return `<span class="text-success"><i class="fas fa-check-circle me-1"></i>${data}</span>`;
                }
            },
            { data: 'fecha' },
            { data: 'linea' },
            {
                data: null,
                render: function(data) {
                    const tieneColaborador = data.colaborador && data.colaborador.trim() !== '';
                    const btnClass = tieneColaborador ? 'btn-primary' : 'btn-secondary';
                    const disabledAttr = tieneColaborador ? '' : 'disabled';
                    const tooltip = tieneColaborador ? 'Imprimir documento' : 'Sin colaborador asignado';
                    
                    return `
                        <div class="btn-group btn-group-sm">
                            <button class="btn ${btnClass} btn-action" ${disabledAttr} 
                                    onclick="imprimirDocumento('${data.rec}')"
                                    title="${tooltip}">
                                <i class="fas fa-print"></i>
                            </button>
                            <button class="btn btn-info btn-action" 
                                    onclick="buscarDocumentoEnTabla('${data.rec}')"
                                    title="Buscar documento">
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
        ]
    });
}

// Función para imprimir documento desde la tabla
function imprimirDocumento(rec) {
    document.getElementById('recInput').value = rec;
    buscarPorREC();
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

// Función para mostrar error
function mostrarError(mensaje) {
    const resultado = document.getElementById('resultado');
    resultado.innerHTML = `
        <div class="col-12">
            <div class="alert alert-danger alert-dismissible fade show" role="alert">
                <i class="fas fa-exclamation-triangle me-2"></i>
                ${mensaje}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        </div>
    `;
}

// Cargar tabla cuando la página esté lista
document.addEventListener('DOMContentLoaded', function() {
    // Esperar a que los datos globales estén cargados
    setTimeout(() => {
        cargarTablaDocumentos();
    }, 1000);
});
