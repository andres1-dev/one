// datatable-manager.js - Módulo para manejar DataTables
let dataTable;
let flatpickrInstance;

export const initializeDataTable = (data) => {
    // Destruir la tabla existente si hay una
    if (dataTable) {
        dataTable.destroy();
    }
    
    dataTable = $('#data-table').DataTable({
        responsive: true,
        data: data,
        columns: [
            { title: "Documento", data: "DOCUMENTO" },
            { 
                title: "Fecha", 
                data: "FECHA",
                render: function(data, type, row) {
                    if (type === 'sort') {
                        return new Date(data.split('-').reverse().join('-')).getTime();
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
            { title: "Proveedor", data: "PROVEEDOR" }
        ],
        dom: 'Bfrtip',
        buttons: [
            'copy', 'csv', 'excel', 'pdf', 'print',
            {
                text: 'Actualizar',
                action: function(e, dt, node, config) {
                    updateData();
                }
            }
        ],
        language: {
            url: '//cdn.datatables.net/plug-ins/1.10.25/i18n/Spanish.json'
        },
        pageLength: 25,
        order: [[1, 'desc']],
        initComplete: function() {
            // Inicializar Flatpickr después de que la tabla esté lista
            initDateRangeFilter();
        }
    });
};

export const initDateRangeFilter = () => {
    flatpickrInstance = flatpickr("#filterFecha", {
        mode: "range",
        locale: "es",
        dateFormat: "d-m-Y",
        allowInput: true,
        onClose: function(selectedDates, dateStr, instance) {
            if (selectedDates.length === 2) {
                filterByDateRange(selectedDates[0], selectedDates[1]);
            } else if (selectedDates.length === 0) {
                // Si se borra el filtro, mostrar todos los datos
                dataTable.columns().search('').draw();
            }
        }
    });
};

export const filterByDateRange = (startDate, endDate) => {
    if (!dataTable) return;
    
    // Ajustar las fechas para incluir todo el día
    const adjustedStart = new Date(startDate);
    adjustedStart.setHours(0, 0, 0, 0);
    
    const adjustedEnd = new Date(endDate);
    adjustedEnd.setHours(23, 59, 59, 999);
    
    // Filtrar la tabla
    dataTable.columns(1).search('').draw(); // Limpiar búsqueda previa
    
    dataTable.rows().every(function() {
        const rowData = this.data();
        const rowDate = new Date(rowData.FECHA.split('-').reverse().join('-'));
        const isVisible = rowDate >= adjustedStart && rowDate <= adjustedEnd;
        this.node().style.display = isVisible ? '' : 'none';
    });
};

export const updateDataTable = (newData) => {
    if (dataTable) {
        dataTable.clear().rows.add(newData).draw();
        // Reiniciar el filtro de fechas al actualizar datos
        if (flatpickrInstance) {
            flatpickrInstance.clear();
        }
    } else {
        initializeDataTable(newData);
    }
};
