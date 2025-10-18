// Configuración de DataTable para documentos disponibles
let documentosTable = null;
let listaResponsables = [];
let responsablesDisponibles = [];

// Estados permitidos para mostrar
const ESTADOS_PERMITIDOS = ['PENDIENTE', 'DIRECTO', 'ELABORACION', 'PAUSADO'];

// Estados que no permiten responsables específicos
const ESTADOS_SIN_RESPONSABLES = ['ELABORACION', 'PAUSADO'];

// Función independiente para obtener responsables desde Google Sheets
async function obtenerResponsablesDesdeSheets() {
    const SPREADSHEET_ID = "1d5dCCCgiWXfM6vHu3zGGKlvK2EycJtT7Uk4JqUjDOfE";
    const API_KEY = 'AIzaSyC7hjbRc0TGLgImv8gVZg8tsOeYWgXlPcM';
    
    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/RESPONSABLES!A:B?key=${API_KEY}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.values || data.values.length === 0) {
            throw new Error('No se encontraron datos en la hoja RESPONSABLES');
        }
        
        // Procesar datos - columna A: nombre, columna B: activo (true/false)
        const responsables = [];
        
        for (let i = 0; i < data.values.length; i++) {
            const row = data.values[i];
            const nombre = row[0] ? String(row[0]).trim() : '';
            const activo = row[1] ? String(row[1]).trim().toLowerCase() === 'true' : false;
            
            if (nombre && activo) {
                responsables.push(nombre);
            }
        }
        
        if (responsables.length === 0) {
            throw new Error('No se encontraron responsables activos en la hoja RESPONSABLES');
        }
        
        return responsables;
        
    } catch (error) {
        console.error('Error obteniendo responsables:', error);
        throw new Error(`No se pudieron cargar los responsables: ${error.message}`);
    }
}

// Función para obtener documentos de DATA
async function obtenerDocumentosDesdeDATA() {
    const SPREADSHEET_ID = "1d5dCCCgiWXfM6vHu3zGGKlvK2EycJtT7Uk4JqUjDOfE";
    const API_KEY = 'AIzaSyC7hjbRc0TGLgImv8gVZg8tsOeYWgXlPcM';
    
    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/DATA!A:E?key=${API_KEY}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.values || data.values.length === 0) {
            throw new Error('No se encontraron datos en la hoja DATA');
        }
        
        return data.values;
        
    } catch (error) {
        console.error('Error obteniendo documentos:', error);
        throw new Error(`No se pudieron cargar los documentos: ${error.message}`);
    }
}

// Función para filtrar responsables disponibles
function filtrarResponsablesDisponibles(documentos) {
    // Obtener responsables que ya están asignados a documentos en estados ELABORACION/PAUSADO
    const responsablesOcupados = new Set();
    
    documentos.forEach(doc => {
        if (ESTADOS_SIN_RESPONSABLES.includes(doc.estado) && doc.colaborador) {
            responsablesOcupados.add(doc.colaborador);
        }
    });
    
    // Filtrar la lista de responsables para excluir los ocupados
    responsablesDisponibles = listaResponsables.filter(responsable => 
        !responsablesOcupados.has(responsable)
    );
    
    console.log('Responsables ocupados:', Array.from(responsablesOcupados));
    console.log('Responsables disponibles:', responsablesDisponibles);
}

// Función para validar si un documento puede tener responsable
function puedeTenerResponsable(documento) {
    // Si el estado es ELABORACION o PAUSADO, no puede tener responsables de la lista
    if (ESTADOS_SIN_RESPONSABLES.includes(documento.estado)) {
        if (documento.colaborador && listaResponsables.includes(documento.colaborador)) {
            return false;
        }
    }
    return true;
}

// Función principal para cargar la tabla de documentos
async function cargarTablaDocumentos() {
    try {
        // 1. Obtener responsables desde RESPONSABLES
        listaResponsables = await obtenerResponsablesDesdeSheets();
        
        // 2. Obtener documentos desde DATA
        const datosDATA = await obtenerDocumentosDesdeDATA();
        
        // 3. Combinar con datos globales
        const documentosCombinados = await combinarConDatosGlobales(datosDATA);
        
        // 4. Filtrar responsables disponibles
        filtrarResponsablesDisponibles(documentosCombinados);
        
        // 5. Inicializar DataTable
        if (documentosTable) {
            documentosTable.destroy();
        }
        inicializarDataTable(documentosCombinados);
        
    } catch (error) {
        console.error('Error en cargarTablaDocumentos:', error);
        mostrarError(error.message);
    }
}

// Función para combinar datos de DATA con datos globales
async function combinarConDatosGlobales(datosDATA) {
    // Crear mapa de datos globales para búsqueda rápida
    const datosGlobalesMap = {};
    if (datosGlobales && Array.isArray(datosGlobales)) {
        datosGlobales.forEach(item => {
            if (item.REC) {
                datosGlobalesMap[item.REC] = item;
            }
        });
    }

    // Procesar y combinar datos
    const documentosProcesados = datosDATA
        .map((row, index) => {
            // Saltar fila si no hay datos suficientes
            if (row.length < 5) return null;
            
            const documento = String(row[0] || '').trim();
            const estado = String(row[3] || '').trim().toUpperCase();
            const colaborador = String(row[4] || '').trim();
            
            // Validar documento y estado
            if (!documento || !ESTADOS_PERMITIDOS.includes(estado)) {
                return null;
            }
            
            // Buscar información adicional en datosGlobales
            const datosCompletos = datosGlobalesMap[documento];
            
            return {
                rec: documento,
                estado: estado,
                colaborador: colaborador,
                fecha: row[1] || '',
                lote: datosCompletos ? (datosCompletos.LOTE || '') : '',
                refProv: datosCompletos ? (datosCompletos.REFPROV || '') : '',
                tieneClientes: datosCompletos ? 
                    (datosCompletos.DISTRIBUCION && datosCompletos.DISTRIBUCION.Clientes && 
                     Object.keys(datosCompletos.DISTRIBUCION.Clientes).length > 0) : false,
                datosCompletos: datosCompletos,
                puedeTenerResponsable: true, // Se calculará después
                rawData: row
            };
        })
        .filter(doc => doc !== null);

    // Validar qué documentos pueden tener responsables
    documentosProcesados.forEach(doc => {
        doc.puedeTenerResponsable = puedeTenerResponsable(doc);
    });

    return documentosProcesados;
}

// Función para inicializar DataTable
function inicializarDataTable(documentos) {
    const table = $('#documentosTable');
    
    if (documentos.length === 0) {
        table.html('<tr><td colspan="7" class="text-center">No se encontraron documentos con los estados permitidos</td></tr>');
        return;
    }
    
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
                    const puedeAsignar = row.puedeTenerResponsable;
                    
                    if (!data) {
                        if (puedeAsignar) {
                            // Usar la lista filtrada de responsables disponibles
                            const opcionesResponsables = responsablesDisponibles.map(resp => 
                                `<option value="${resp}">${resp}</option>`
                            ).join('');
                            
                            return `
                                <div class="d-flex align-items-center">
                                    <span class="text-danger me-2"><i class="fas fa-times-circle"></i></span>
                                    <select class="form-select form-select-sm asignar-colaborador" 
                                            data-rec="${row.rec}" style="min-width: 180px;">
                                        <option value="">Seleccionar responsable</option>
                                        ${opcionesResponsables}
                                    </select>
                                </div>
                            `;
                        } else {
                            return `
                                <div class="d-flex align-items-center">
                                    <span class="text-warning me-2"><i class="fas fa-exclamation-triangle"></i></span>
                                    <span class="text-muted">No requiere responsable</span>
                                </div>
                            `;
                        }
                    }
                    
                    // Si ya tiene colaborador asignado
                    const esResponsableLista = listaResponsables.includes(data);
                    const icono = esResponsableLista ? 'fa-check-circle text-success' : 'fa-user text-info';
                    const estaDisponible = responsablesDisponibles.includes(data);
                    
                    return `
                        <div class="d-flex align-items-center">
                            <span class="me-2"><i class="fas ${icono}"></i></span>
                            <span class="${estaDisponible ? '' : 'text-muted'}">${data}</span>
                        </div>
                    `;
                }
            },
            { data: 'fecha' },
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
                    const puedeImprimir = data.puedeTenerResponsable && tieneColaborador && tieneClientes;
                    
                    const btnImprimirClass = puedeImprimir ? 'btn-primary' : 'btn-secondary';
                    const btnImprimirDisabled = !puedeImprimir ? 'disabled' : '';
                    
                    let tooltipImprimir = 'Imprimir solo clientes';
                    if (!tieneColaborador) tooltipImprimir = 'Sin colaborador asignado';
                    else if (!tieneClientes) tooltipImprimir = 'Sin clientes asignados';
                    else if (!data.puedeTenerResponsable) tooltipImprimir = 'Estado no permite impresión';
                    
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
        initComplete: function() {
            // Agregar evento para los select de colaboradores
            $('.asignar-colaborador').on('change', function() {
                const rec = $(this).data('rec');
                const colaborador = $(this).val();
                if (colaborador) {
                    asignarColaborador(rec, colaborador);
                }
            });
        },
        drawCallback: function() {
            // Re-agregar evento después de cada redibujado de la tabla
            $('.asignar-colaborador').on('change', function() {
                const rec = $(this).data('rec');
                const colaborador = $(this).val();
                if (colaborador) {
                    asignarColaborador(rec, colaborador);
                }
            });
        }
    });
}

// Función para asignar colaborador
async function asignarColaborador(rec, colaborador) {
    try {
        console.log(`Asignando colaborador ${colaborador} al documento REC${rec}`);
        
        // Aquí iría la lógica para guardar en Google Sheets
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
        if (datosGlobales && Array.isArray(datosGlobales)) {
            clearInterval(checkDataLoaded);
            cargarTablaDocumentos();
        }
    }, 1000);
    
    // Timeout de seguridad
    setTimeout(() => {
        clearInterval(checkDataLoaded);
        if (!documentosTable) {
            cargarTablaDocumentos();
        }
    }, 10000);
});
