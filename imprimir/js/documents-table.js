// Configuración de DataTable para documentos disponibles
let documentosTable = null;
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbwRo5v0SGGFBOZP6TPKR_jejz9iBk32ZWlsFICCyFr1EGgwWYMvn1iX33upRNqi6w98/exec'; // Reemplazar con tu URL de GAS

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
                    const btnImprimirClass = tieneColaborador ? 'btn-primary' : 'btn-secondary';
                    const disabledAttr = tieneColaborador ? '' : 'disabled';
                    const tooltipImprimir = tieneColaborador ? 'Imprimir solo clientes' : 'Sin colaborador asignado';
                    
                    return `
                        <div class="btn-group btn-group-sm">
                            <button class="btn ${btnImprimirClass} btn-action" ${disabledAttr} 
                                    onclick="imprimirSoloClientesDesdeTabla('${data.rec}')"
                                    title="${tooltipImprimir}">
                                <i class="fas fa-print"></i>
                            </button>
                            <button class="btn btn-info btn-action" 
                                    onclick="mostrarInfoDocumento('${data.rec}')"
                                    title="Información completa">
                                <i class="fas fa-info-circle"></i>
                            </button>
                            <button class="btn btn-warning btn-action" 
                                    onclick="asignarColaboradorModal('${data.rec}')"
                                    title="Asignar colaborador">
                                <i class="fas fa-user-plus"></i>
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

// ========== NUEVAS FUNCIONES PARA GAS ==========

// Función para cargar colaboradores desde GAS
async function cargarColaboradores() {
    try {
        const response = await fetch(`${GAS_API_URL}?action=getResponsables`);
        const data = await response.json();
        
        if (data.responsables) {
            const select = document.getElementById('selectColaborador');
            select.innerHTML = '<option value="">Seleccione un colaborador</option>';
            
            data.responsables.forEach(colaborador => {
                const option = document.createElement('option');
                option.value = colaborador;
                option.textContent = colaborador;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error cargando colaboradores:', error);
        document.getElementById('selectColaborador').innerHTML = '<option value="">Error cargando colaboradores</option>';
    }
}

// Función para mostrar modal de asignación
async function asignarColaboradorModal(rec) {
    document.getElementById('modalRec').value = rec;
    document.getElementById('modalMessage').innerHTML = '';
    
    // Cargar colaboradores
    await cargarColaboradores();
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('modalAsignarColaborador'));
    modal.show();
}

// Función para confirmar asignación
async function confirmarAsignacion() {
    const rec = document.getElementById('modalRec').value;
    const colaborador = document.getElementById('selectColaborador').value;
    
    if (!colaborador) {
        mostrarModalMessage('Por favor seleccione un colaborador', 'danger');
        return;
    }
    
    try {
        const response = await fetch(GAS_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `action=asignarColaborador&rec=${encodeURIComponent(rec)}&colaborador=${encodeURIComponent(colaborador)}`
        });
        
        const data = await response.json();
        
        if (data.success) {
            mostrarModalMessage(data.message, 'success');
            
            // Cerrar modal después de 2 segundos y recargar tabla
            setTimeout(() => {
                const modal = bootstrap.Modal.getInstance(document.getElementById('modalAsignarColaborador'));
                modal.hide();
                cargarTablaDocumentos();
            }, 2000);
        } else {
            mostrarModalMessage(data.error, 'danger');
        }
    } catch (error) {
        console.error('Error asignando colaborador:', error);
        mostrarModalMessage('Error al asignar colaborador: ' + error.message, 'danger');
    }
}

// Función para mostrar información completa del documento
async function mostrarInfoDocumento(rec) {
    try {
        const response = await fetch(`${GAS_API_URL}?action=getDocumentoInfo&rec=${encodeURIComponent(rec)}`);
        const data = await response.json();
        
        if (data.error) {
            document.getElementById('infoDocumentoContent').innerHTML = `
                <div class="alert alert-danger">${data.error}</div>
            `;
        } else {
            document.getElementById('infoDocumentoContent').innerHTML = `
                <div class="row">
                    <div class="col-md-6">
                        <strong>REC:</strong> ${data.rec || 'N/A'}<br>
                        <strong>Estado:</strong> ${data.estado || 'N/A'}<br>
                        <strong>Colaborador:</strong> ${data.colaborador || 'No asignado'}<br>
                        <strong>Fecha Guardado:</strong> ${data.guardado || 'N/A'}<br>
                    </div>
                    <div class="col-md-6">
                        <strong>Duración:</strong> ${data.duracion || 'N/A'}<br>
                        <strong>Pausas:</strong> ${data.pausas || 'N/A'}<br>
                        <strong>Fin:</strong> ${data.fin || 'N/A'}<br>
                        <strong>Última Actualización:</strong> ${data.datetime || 'N/A'}<br>
                    </div>
                </div>
                ${data.distribucion ? `
                <div class="mt-3">
                    <strong>Distribución:</strong>
                    <pre class="bg-light p-2 mt-1">${JSON.stringify(JSON.parse(data.distribucion), null, 2)}</pre>
                </div>
                ` : ''}
            `;
        }
        
        const modal = new bootstrap.Modal(document.getElementById('modalInfoDocumento'));
        modal.show();
    } catch (error) {
        console.error('Error obteniendo información:', error);
        document.getElementById('infoDocumentoContent').innerHTML = `
            <div class="alert alert-danger">Error al cargar información: ${error.message}</div>
        `;
        const modal = new bootstrap.Modal(document.getElementById('modalInfoDocumento'));
        modal.show();
    }
}

// Función para imprimir solo clientes desde la tabla
function imprimirSoloClientesDesdeTabla(rec) {
    document.getElementById('recInput').value = rec;
    imprimirSoloClientes();
}

// Función auxiliar para mostrar mensajes en modal
function mostrarModalMessage(message, type) {
    const messageDiv = document.getElementById('modalMessage');
    messageDiv.innerHTML = `
        <div class="alert alert-${type} alert-dismissible fade show">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
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
