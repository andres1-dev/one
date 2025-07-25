// datatable-manager.js
let dataTable;
let flatpickrInstance;
let allData = [];

export const initializeDataTable = (data) => {
    allData = data;
    
    if (dataTable) {
        dataTable.destroy();
    }
    
    // Configuración de Flatpickr
    flatpickrInstance = flatpickr("#filterFecha", {
        mode: "range",
        locale: "es",
        dateFormat: "d/m/Y",
        allowInput: true,
        onClose: function(selectedDates) {
            if (selectedDates.length === 1) {
                filterByExactDate(selectedDates[0]);
            } else if (selectedDates.length === 2) {
                filterByDateRange(selectedDates[0], selectedDates[1]);
            } else {
                dataTable.search('').draw();
            }
            updateSummaryCard();
        }
    });
    
    initializeSelectFilters(data);
    
    // Configuración optimizada de DataTable
    dataTable = $('#data-table').DataTable({
        data: data,
        columns: [
            { 
                title: "Documento", 
                data: "DOCUMENTO",
                className: "text-nowrap"
            },
            { 
                title: "Fecha", 
                data: "FECHA",
                render: formatDate,
                className: "text-nowrap"
            },
            { title: "Taller", data: "TALLER" },
            { title: "Línea", data: "LINEA" },
            { title: "Auditor", data: "AUDITOR" },
            { title: "Escáner", data: "ESCANER" },
            { title: "Lote", data: "LOTE" },
            { title: "Ref. Prov.", data: "REFPROV" },
            { title: "Descripción", data: "DESCRIPCIÓN" },
            { 
                title: "Cantidad", 
                data: "CANTIDAD",
                className: "text-end"
            },
            { title: "Referencia", data: "REFERENCIA" },
            { title: "Tipo", data: "TIPO" },
            { 
                title: "PVP", 
                data: "PVP",
                render: formatCurrency,
                className: "text-end"
            },
            { title: "Prenda", data: "PRENDA" },
            { title: "Género", data: "GENERO" },
            { title: "Gestor", data: "GESTOR" },
            { title: "Proveedor", data: "PROVEEDOR" },
            { title: "Clase", data: "CLASE" },
            { title: "Fuente", data: "FUENTE" }
        ],
        dom: '<"top"<"table-top d-flex flex-column flex-md-row justify-content-between"lf>>rt<"bottom"<"table-bottom d-flex flex-column flex-md-row justify-content-between"ip>>',
        language: {
            url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json'
        },
        pageLength: 25,
        lengthMenu: [10, 25, 50, 100],
        order: [[1, 'desc']],
        responsive: {
            details: {
                display: $.fn.dataTable.Responsive.display.modal({
                    header: function(row) {
                        const data = row.data();
                        return `<h6>Detalles: ${data.DOCUMENTO || 'Registro'}</h6>`;
                    }
                }),
                renderer: $.fn.dataTable.Responsive.renderer.tableAll({
                    tableClass: 'table table-sm'
                })
            }
        },
        initComplete: function() {
            // Mejora de accesibilidad
            this.api().columns().header().each(function(header) {
                header.setAttribute('scope', 'col');
            });
        },
        drawCallback: function() {
            updateSummaryCard();
            // Mejora de accesibilidad para paginación
            $('.paginate_button').attr('aria-label', function(i, val) {
                return val.replace('page', 'Página');
            });
        }
    });
    
    updateSummaryCard();
};

export const updateDataTable = (newData) => {
    allData = newData;
    
    if (dataTable) {
        dataTable.clear().rows.add(newData).draw();
        if (flatpickrInstance) {
            flatpickrInstance.clear();
        }
        
        initializeSelectFilters(newData);
        updateSummaryCard();
    }
};

// Funciones auxiliares
function formatDate(data) {
    if (!data) return '';
    if (data.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = data.split('-');
        return `${day}/${month}/${year}`;
    }
    return data;
}

function formatCurrency(data) {
    if (!data) return '';
    const amount = parseFloat(data.replace(/[^0-9.-]+/g, "")) || 0;
    return '$' + amount.toLocaleString('es-CO', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
}

function initializeSelectFilters(data) {
    const uniqueValues = {
        PROVEEDOR: new Set(),
        LINEA: new Set(),
        GESTOR: new Set(),
        CLASE: new Set()
    };
    
    data.forEach(item => {
        if (item.PROVEEDOR) uniqueValues.PROVEEDOR.add(item.PROVEEDOR);
        if (item.LINEA) uniqueValues.LINEA.add(item.LINEA);
        if (item.GESTOR) uniqueValues.GESTOR.add(item.GESTOR);
        if (item.CLASE) uniqueValues.CLASE.add(item.CLASE);
    });
    
    // Función para llenar selects
    const fillSelect = (id, values, placeholder) => {
        const select = $(id);
        select.empty().append(`<option value="">${placeholder}</option>`);
        Array.from(values).sort().forEach(value => {
            select.append(`<option value="${value}">${value}</option>`);
        });
    };
    
    fillSelect('#filterProveedor', uniqueValues.PROVEEDOR, 'Todos los proveedores');
    fillSelect('#filterLinea', uniqueValues.LINEA, 'Todas las líneas');
    fillSelect('#filterGestor', uniqueValues.GESTOR, 'Todos los gestores');
    fillSelect('#filterClase', uniqueValues.CLASE, 'Todas las clases');
    
    // Configurar eventos para los filtros
    $('#filterProveedor, #filterLinea, #filterGestor, #filterClase, #filterFuente').off('change').on('change', function() {
        applyAllFilters();
    });
}

function applyAllFilters() {
    dataTable.columns().search('');
    
    const filters = {
        16: $('#filterProveedor').val(),  // PROVEEDOR
        3: $('#filterLinea').val(),       // LINEA
        15: $('#filterGestor').val(),     // GESTOR
        17: $('#filterClase').val(),      // CLASE
        18: $('#filterFuente').val()     // FUENTE
    };
    
    Object.entries(filters).forEach(([column, value]) => {
        if (value) {
            dataTable.column(column).search("^" + value + "$", true, false);
        }
    });
    
    dataTable.draw();
}

function updateSummaryCard() {
    if (!dataTable) return;
    
    const filteredData = dataTable.rows({ search: 'applied' }).data().toArray();
    
    const totalRecords = filteredData.length;
    const totalQuantity = filteredData.reduce((sum, item) => sum + (parseInt(item.CANTIDAD) || 0), 0);
    const totalPVP = filteredData.reduce((sum, item) => {
        const pvp = parseFloat(item.PVP?.replace(/[^0-9.-]+/g, "") || 0);
        return sum + pvp;
    }, 0);
    
    $('#total-records').text(totalRecords.toLocaleString());
    $('#total-quantity').text(totalQuantity.toLocaleString());
    $('#total-pvp').text('$' + totalPVP.toLocaleString('es-CO', { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 0 
    }));
}

function filterByExactDate(date) {
    const formattedDate = formatDateForFilter(date);
    dataTable.column(1).search("^" + formattedDate + "$", true, false).draw();
}

function filterByDateRange(startDate, endDate) {
    const startStr = formatDateForFilter(startDate);
    const endStr = formatDateForFilter(endDate);
    
    $.fn.dataTable.ext.search.push(
        function(settings, data, dataIndex) {
            const dateStr = data[1];
            if (!dateStr) return false;
            
            const currentDate = dateStr.split('/').reverse().join('');
            const startCompare = startStr.split('/').reverse().join('');
            const endCompare = endStr.split('/').reverse().join('');
            
            return currentDate >= startCompare && currentDate <= endCompare;
        }
    );
    
    dataTable.draw();
    $.fn.dataTable.ext.search.pop();
}

function formatDateForFilter(date) {
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}
