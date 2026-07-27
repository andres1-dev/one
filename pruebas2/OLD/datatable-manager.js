let dataTable;
let flatpickrInstance;
let allData = [];

export const initializeDataTable = (data) => {
    allData = data;
    
    if (dataTable) {
        dataTable.destroy();
    }
    
    flatpickrInstance = flatpickr("#filterFecha", {
        mode: "range",
        locale: "es",
        dateFormat: "d/m/Y",
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
    
    dataTable = $('#data-table').DataTable({
        data: data,
        columns: [
            { title: "Documento", data: "DOCUMENTO" },
            { 
                title: "Fecha", 
                data: "FECHA",
                render: function(data) {
                    if (!data) return '';
                    if (data.match(/^\d{4}-\d{2}-\d{2}$/)) {
                        const [year, month, day] = data.split('-');
                        return `${day}/${month}/${year}`;
                    }
                    return data;
                }
            },
            { title: "Taller", data: "TALLER" },
            { title: "Línea", data: "LINEA" },
            { title: "Auditor", data: "AUDITOR" },
            { title: "Escáner", data: "ESCANER" },
            { title: "Lote", data: "LOTE" },
            { title: "Ref. Prov.", data: "REFPROV" },
            { title: "Descripción", data: "DESCRIPCIÓN" },
            { title: "Cantidad", data: "CANTIDAD" },
            { title: "Referencia", data: "REFERENCIA" },
            { title: "Tipo", data: "TIPO" },
            { title: "PVP", data: "PVP" },
            { title: "Prenda", data: "PRENDA" },
            { title: "Género", data: "GENERO" },
            { title: "Gestor", data: "GESTOR" },
            { title: "Proveedor", data: "PROVEEDOR" },
            { title: "Clase", data: "CLASE" },
            { title: "Fuente", data: "FUENTE" }
        ],
        dom: '<"top"<"row"<"col-md-6"l><"col-md-6"f>>><"row"<"col-md-12"tr>><"bottom"<"row"<"col-md-5"i><"col-md-7"p>>>',
        buttons: [
            {
                extend: 'excel',
                text: '<i class="fas fa-file-excel me-1"></i> Excel',
                className: 'btn btn-success btn-sm',
                filename: 'Reporte_Ingresos',
                title: '',
                exportOptions: {
                    format: {
                        body: function(data, row, column, node) {
                            if (column === 1 && data.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
                                const [day, month, year] = data.split('/');
                                return `${year}-${month}-${day}`;
                            }
                            return data;
                        }
                    }
                }
            },
            {
                extend: 'print',
                text: '<i class="fas fa-print me-1"></i> Imprimir',
                className: 'btn btn-primary btn-sm',
                title: 'Reporte de Ingresos',
                exportOptions: {
                    columns: ':visible'
                },
                customize: function(win) {
                    $(win.document.body).css('font-size', '10pt');
                    $(win.document.body).find('table').addClass('compact').css('font-size', 'inherit');
                }
            }
        ],
        language: {
            url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json'
        },
        pageLength: 10,
        lengthMenu: [5, 10, 25, 50, 100],
        order: [[1, 'desc']],
        responsive: {
            details: {
                display: $.fn.dataTable.Responsive.display.modal({
                    header: function(row) {
                        var data = row.data();
                        return 'Detalles: ' + data.DOCUMENTO;
                    }
                }),
                renderer: $.fn.dataTable.Responsive.renderer.tableAll({
                    tableClass: 'table'
                })
            }
        },
        initComplete: function() {
            this.api().buttons().container().appendTo($('.card-header'));
        },
        drawCallback: function() {
            updateSummaryCard();
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
    
    // Llenar select de Proveedor
    const proveedorSelect = $('#filterProveedor');
    proveedorSelect.empty().append('<option value="">Todos</option>');
    Array.from(uniqueValues.PROVEEDOR).sort().forEach(value => {
        proveedorSelect.append(`<option value="${value}">${value}</option>`);
    });
    
    // Llenar select de Línea
    const lineaSelect = $('#filterLinea');
    lineaSelect.empty().append('<option value="">Todos</option>');
    Array.from(uniqueValues.LINEA).sort().forEach(value => {
        lineaSelect.append(`<option value="${value}">${value}</option>`);
    });
    
    // Llenar select de Gestor
    const gestorSelect = $('#filterGestor');
    gestorSelect.empty().append('<option value="">Todos</option>');
    Array.from(uniqueValues.GESTOR).sort().forEach(value => {
        gestorSelect.append(`<option value="${value}">${value}</option>`);
    });
    
    // Llenar select de Clase
    const claseSelect = $('#filterClase');
    claseSelect.empty().append('<option value="">Todos</option>');
    Array.from(uniqueValues.CLASE).sort().forEach(value => {
        claseSelect.append(`<option value="${value}">${value}</option>`);
    });
    
    // Configurar eventos para los filtros
    $('#filterProveedor, #filterLinea, #filterGestor, #filterClase, #filterFuente').off('change').on('change', function() {
        applyAllFilters();
    });
}

function applyAllFilters() {
    // Limpiar todos los filtros primero
    dataTable.columns().search('');
    
    // Aplicar filtros individuales
    const proveedor = $('#filterProveedor').val();
    if (proveedor) {
        dataTable.column(16).search("^" + proveedor + "$", true, false); // Columna 15 = PROVEEDOR (búsqueda exacta)
    }
    
    const linea = $('#filterLinea').val();
    if (linea) {
        dataTable.column(3).search("^" + linea + "$", true, false); // Columna 3 = LINEA (búsqueda exacta)
    }
    
    const gestor = $('#filterGestor').val();
    if (gestor) {
        dataTable.column(15).search("^" + gestor + "$", true, false); // Columna 14 = GESTOR (búsqueda exacta)
    }
    
    const clase = $('#filterClase').val();
    if (clase) {
        dataTable.column(17).search("^" + clase + "$", true, false); // Columna 16 = CLASE (búsqueda exacta)
    }
    
    const fuente = $('#filterFuente').val();
    if (fuente) {
        dataTable.column(18).search("^" + fuente + "$", true, false); // Columna 17 = FUENTE (búsqueda exacta)
    }
    
    // Redibujar la tabla con todos los filtros aplicados
    dataTable.draw();
}

function updateSummaryCard() {
    if (!dataTable) return;
    
    const filteredData = dataTable.rows({ search: 'applied' }).data().toArray();
    
    const totalRecords = filteredData.length;
    const totalQuantity = filteredData.reduce((sum, item) => sum + (parseInt(item.CANTIDAD) || 0), 0);
    const totalPVP = filteredData.reduce((sum, item) => {
        const pvp = parseFloat(item.PVP.replace(/[^0-9.-]+/g, "")) || 0;
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
