// datatable.js - Funciones para manejar la tabla de datos detallados

// Variables globales para DataTable
let detailedDataTable;
let allDetailsData = [];
let dateRangePicker;

/**
 * Inicializa la DataTable con los datos consolidados
 */
function initDetailedDataTable() {
    // Destruir la DataTable existente si ya está inicializada
    if ($.fn.DataTable.isDataTable('#detailedDataTable')) {
        $('#detailedDataTable').DataTable().destroy();
    }
    
    // Extraer todos los detalles
    const detailsData = extractAllDetails();
    
    // Inicializar DataTable
    detailedDataTable = $('#detailedDataTable').DataTable({
        data: detailsData,
        columns: [
            { 
                data: 'Fecha',
                render: function(data, type, row) {
                    if (type === 'display' || type === 'filter') {
                        return formatDateForDisplay(data);
                    }
                    return data;
                }
            },
            { data: 'Documento' },
            { data: 'Linea' },
            { data: 'Referencia' },
            { 
                data: 'Cantidad',
                render: function(data) {
                    return formatoCantidad(data);
                }
            },
            { 
                data: 'PVP',
                render: function(data) {
                    return formatoCantidad(data);
                }
            },
            { data: 'Prenda' },
            { data: 'Genero' },
            { data: 'Clase' },
            { data: 'Gestor' },
            { data: 'Proveedor' },
            { data: 'Fuente' }
        ],
        language: {
            url: '//cdn.datatables.net/plug-ins/1.10.25/i18n/Spanish.json'
        },
        dom: '<"top"lBf>rt<"bottom"ip>',
        buttons: [
            {
                extend: 'excel',
                text: '<i class="fas fa-file-excel"></i> Excel',
                className: 'btn-excel',
                title: 'Ingresos_Detallados',
                exportOptions: {
                    columns: ':visible'
                }
            },
            {
                extend: 'colvis',
                text: '<i class="fas fa-eye"></i> Columnas',
                className: 'btn-colvis'
            }
        ],
        pageLength: 25,
        responsive: true,
        scrollX: true,
        scrollCollapse: true,
        order: [[0, 'desc']],
        initComplete: function() {
            // Actualizar fecha de actualización
            updateDataInfo();
            
            // Inicializar filtros automáticos
            initAutoFilters();
            
            // Inicializar date range picker
            initDateRangePicker();
        },
        drawCallback: function() {
            // Actualizar contador de registros después de cada dibujado
            updateDataInfo();
        }
    });
    
    // Aplicar filtros cuando cambien
    $('#linea-filter, #proveedor-filter, #fuente-filter, #gestor-filter').on('change', function() {
        detailedDataTable.draw();
    });
    
    // Búsqueda global
    $('#global-search').on('keyup', function() {
        detailedDataTable.search(this.value).draw();
    });
    
    // Exportar a Excel
    $('#export-btn').on('click', function() {
        detailedDataTable.button('.buttons-excel').trigger();
    });
}

/**
 * Extrae todos los detalles de los datos consolidados
 */
function extractAllDetails() {
    allDetailsData = [];
    
    consolidatedData.forEach(dayData => {
        dayData.Detalles.forEach(detalle => {
            allDetailsData.push({
                Fecha: dayData.Fecha,
                FechaObj: parseDate(dayData.Fecha),
                Documento: detalle.documento || '',
                Linea: detalle.linea || '',
                Referencia: detalle.referencia || '',
                Cantidad: detalle.cantidad || 0,
                PVP: detalle.pvp || 0,
                Prenda: detalle.prenda || '',
                Genero: detalle.genero || '',
                Clase: detalle.clase || '',
                Gestor: detalle.gestor || '',
                Proveedor: detalle.proveedor || '',
                Fuente: detalle.fuente || ''
            });
        });
    });
    
    return allDetailsData;
}

/**
 * Inicializa los filtros automáticos basados en los datos
 */
function initAutoFilters() {
    // Obtener valores únicos para cada filtro
    const lineas = [...new Set(allDetailsData.map(item => item.Linea))].filter(Boolean).sort();
    const proveedores = [...new Set(allDetailsData.map(item => item.Proveedor))].filter(Boolean).sort();
    const fuentes = [...new Set(allDetailsData.map(item => item.Fuente))].filter(Boolean).sort();
    const gestores = [...new Set(allDetailsData.map(item => item.Gestor))].filter(Boolean).sort();
    
    // Llenar filtro de líneas
    const lineaFilter = document.getElementById('linea-filter');
    lineaFilter.innerHTML = '<option value="">Todas</option>';
    lineas.forEach(linea => {
        lineaFilter.innerHTML += `<option value="${linea}">${linea}</option>`;
    });
    
    // Llenar filtro de proveedores
    const proveedorFilter = document.getElementById('proveedor-filter');
    proveedorFilter.innerHTML = '<option value="">Todos</option>';
    proveedores.forEach(proveedor => {
        proveedorFilter.innerHTML += `<option value="${proveedor}">${proveedor}</option>`;
    });
    
    // Llenar filtro de fuentes
    const fuenteFilter = document.getElementById('fuente-filter');
    fuenteFilter.innerHTML = '<option value="">Todas</option>';
    fuentes.forEach(fuente => {
        fuenteFilter.innerHTML += `<option value="${fuente}">${fuente}</option>`;
    });
    
    // Llenar filtro de gestores
    const gestorFilter = document.getElementById('gestor-filter');
    gestorFilter.innerHTML = '<option value="">Todos</option>';
    gestores.forEach(gestor => {
        gestorFilter.innerHTML += `<option value="${gestor}">${gestor}</option>`;
    });
}

/**
 * Inicializa el selector de rango de fechas con flatpickr
 */
function initDateRangePicker() {
    const firstDayOfMonth = getFirstDayOfCurrentMonth();
    const today = new Date();
    
    dateRangePicker = flatpickr("#date-range", {
        mode: "range",
        dateFormat: "d/m/Y",
        defaultDate: [firstDayOfMonth, today],
        locale: {
            firstDayOfWeek: 1,
            weekdays: {
                shorthand: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
                longhand: ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
            },
            months: {
                shorthand: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
                longhand: ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
            }
        },
        onChange: function(selectedDates) {
            if (selectedDates.length === 2) {
                detailedDataTable.draw();
            }
        }
    });
}

/**
 * Actualiza la información de datos mostrada (fecha y conteo)
 */
function updateDataInfo() {
    const filteredCount = detailedDataTable.rows({ search: 'applied' }).count();
    const totalCount = allDetailsData.length;
    
    document.getElementById('data-update-date').textContent = 
        `${filteredCount} registros (${new Date().toLocaleString('es-CO', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })})`;
}

/**
 * Obtiene el primer día del mes actual
 */
function getFirstDayOfCurrentMonth() {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Formatea una fecha para mostrarla en la tabla (DD/MM/YYYY)
 */
function formatDateForDisplay(dateStr) {
    if (!dateStr) return '';
    const [day, month, year] = dateStr.split('/');
    return `${day}/${month}/${year}`;
}

/**
 * Función para abrir el modal de filtros avanzados
 */
function openFiltersModal() {
    document.getElementById("filtersModal").style.display = "flex";
}

/**
 * Función para cerrar el modal de filtros avanzados
 */
function closeFiltersModal() {
    document.getElementById("filtersModal").style.display = "none";
    detailedDataTable.draw(); // Aplicar filtros al cerrar
}

// Función de filtrado personalizada para DataTables
$.fn.dataTable.ext.search.push(
    function(settings, data, dataIndex) {
        const rowData = settings.aoData[dataIndex]._aData;
        
        // Filtrar por rango de fechas
        const selectedDates = dateRangePicker.selectedDates;
        if (selectedDates.length === 2) {
            const startDate = selectedDates[0];
            const endDate = new Date(selectedDates[1]);
            endDate.setHours(23, 59, 59, 999); // Incluir todo el día final
            
            if (rowData.FechaObj < startDate || rowData.FechaObj > endDate) {
                return false;
            }
        }
        
        // Filtrar por línea
        const lineaFilter = $('#linea-filter').val();
        if (lineaFilter && lineaFilter !== rowData.Linea) {
            return false;
        }
        
        // Filtrar por proveedor
        const proveedorFilter = $('#proveedor-filter').val();
        if (proveedorFilter && proveedorFilter !== rowData.Proveedor) {
            return false;
        }
        
        // Filtrar por fuente
        const fuenteFilter = $('#fuente-filter').val();
        if (fuenteFilter && fuenteFilter !== rowData.Fuente) {
            return false;
        }
        
        // Filtrar por gestor
        const gestorFilter = $('#gestor-filter').val();
        if (gestorFilter && gestorFilter !== rowData.Gestor) {
            return false;
        }
        
        return true;
    }
);

// Event listeners para los controles de la tabla
document.addEventListener('DOMContentLoaded', function() {
    // Botón de refrescar datos
    document.getElementById('refresh-btn')?.addEventListener('click', function() {
        const loadingText = document.getElementById('loadingText');
        const loadingOverlay = document.getElementById('loadingOverlay');
        
        loadingText.textContent = "Actualizando tabla de datos...";
        loadingOverlay.classList.add('active');
        
        // Forzar recarga de datos
        consolidatedData = [];
        extractAllDetails();
        initDetailedDataTable();
        
        setTimeout(() => {
            loadingOverlay.classList.remove('active');
        }, 1000);
    });
    
    // Botón de abrir filtros
    document.querySelector('.table-btn[onclick="openFiltersModal()"]')?.addEventListener('click', openFiltersModal);
    
    // Botón de aplicar filtros
    document.querySelector('#filtersModal button')?.addEventListener('click', closeFiltersModal);
});

// Exportar funciones necesarias para otros módulos
export {
    initDetailedDataTable,
    extractAllDetails,
    updateDataInfo,
    openFiltersModal,
    closeFiltersModal
};
