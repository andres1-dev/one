// datatable-manager.js
let dataTable;
let flatpickrInstance;

export const initializeDataTable = (data) => {
    if (dataTable) {
        dataTable.destroy();
    }
    
    // Configuración simple de Flatpickr (solo fechas)
    flatpickrInstance = flatpickr("#filterFecha", {
        mode: "range",
        locale: "es",
        dateFormat: "Y-m-d",
        onClose: function(selectedDates) {
            if (selectedDates.length === 1) {
                // Filtra un día específico
                filterByExactDate(selectedDates[0]);
            } else if (selectedDates.length === 2) {
                // Filtra por rango
                filterByDateRange(selectedDates[0], selectedDates[1]);
            } else {
                // Limpiar filtro
                dataTable.search('').draw();
            }
        }
    });
    
    // Configuración mínima de DataTable
    dataTable = $('#data-table').DataTable({
        data: data,
        columns: [
            { title: "Documento", data: "DOCUMENTO" },
            { 
                title: "Fecha", 
                data: "FECHA",
                render: function(data, type) {
                    if (type === 'sort' || type === 'filter') return data;
                    return data ? new Date(data).toLocaleDateString('es-ES') : '';
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
        dom: 'Bfrtip',
        buttons: [
            {
                extend: 'excel',
                text: '<i class="fas fa-file-excel me-1"></i> Excel',
                className: 'btn btn-sm btn-success'
            },
            {
                extend: 'csv',
                text: '<i class="fas fa-file-csv me-1"></i> CSV',
                className: 'btn btn-sm btn-secondary'
            }
        ],
        pageLength: 25,
        order: [[1, 'desc']]
    });
    
    // Función para filtrar por fecha exacta
    function filterByExactDate(date) {
        const dateStr = flatpickrInstance.formatDate(date, "Y-m-d");
        dataTable.columns(1).search(dateStr).draw();
    }
    
    // Función para filtrar por rango de fechas
    function filterByDateRange(startDate, endDate) {
        const startStr = flatpickrInstance.formatDate(startDate, "Y-m-d");
        const endStr = flatpickrInstance.formatDate(endDate, "Y-m-d");
        
        $.fn.dataTable.ext.search.push(
            function(settings, data, dataIndex) {
                const dateStr = data[1]; // Columna de fecha
                return (!startStr || dateStr >= startStr) && 
                       (!endStr || dateStr <= endStr);
            }
        );
        
        dataTable.draw();
        $.fn.dataTable.ext.search.pop();
    }
};

export const updateDataTable = (newData) => {
    if (dataTable) {
        dataTable.clear().rows.add(newData).draw();
    }
};
