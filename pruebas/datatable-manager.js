// datatable-manager.js
let dataTable;
let flatpickrInstance;

export const initializeDataTable = (data) => {
    // Destruir tabla existente
    if (dataTable) {
        dataTable.destroy();
    }
    
    // Configuración de Flatpickr
    if (!flatpickrInstance) {
        flatpickrInstance = flatpickr("#filterFecha", {
            mode: "range",
            locale: "es",
            dateFormat: "Y-m-d",
            allowInput: true,
            onClose: function(selectedDates) {
                if (selectedDates.length === 2) {
                    filterByDateRange(selectedDates[0], selectedDates[1]);
                } else if (selectedDates.length === 1) {
                    // Si selecciona un solo día, filtrar ese día específico
                    filterByDateRange(selectedDates[0], selectedDates[0]);
                } else {
                    // Limpiar filtro
                    dataTable.search('').columns().search('').draw();
                }
            }
        });
    }
    
    // Configuración de DataTable
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
        dom: '<"top"<"row"<"col-sm-12 col-md-6"l><"col-sm-12 col-md-6"f>>>rt<"bottom"<"row"<"col-sm-12 col-md-6"i><"col-sm-12 col-md-6"p>><"col-sm-12"B>>',
        buttons: [
            {
                extend: 'excel',
                text: '<i class="fas fa-file-excel me-1"></i> Excel',
                className: 'btn btn-sm btn-success',
                exportOptions: {
                    columns: ':visible'
                }
            },
            {
                extend: 'csv',
                text: '<i class="fas fa-file-csv me-1"></i> CSV',
                className: 'btn btn-sm btn-outline-secondary',
                exportOptions: {
                    columns: ':visible'
                }
            },
            {
                extend: 'print',
                text: '<i class="fas fa-print me-1"></i> Imprimir',
                className: 'btn btn-sm btn-outline-primary',
                exportOptions: {
                    columns: ':visible'
                }
            }
        ],
        language: {
            url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json'
        },
        pageLength: 25,
        order: [[1, 'desc']],
        responsive: true,
        initComplete: function() {
            // Estilo para los inputs de búsqueda
            $('.dataTables_filter input').addClass('form-control form-control-sm');
        }
    });
    
    // Función mejorada para filtrar por fechas
    function filterByDateRange(startDate, endDate) {
        // Limpiar filtros previos
        dataTable.search('').columns().search('').draw();
        
        // Ajustar fechas para comparación
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        
        // Aplicar filtro
        $.fn.dataTable.ext.search.push(
            function(settings, data, dataIndex) {
                const dateStr = data[1]; // Columna de fecha
                if (!dateStr) return false;
                
                try {
                    const cellDate = new Date(dateStr);
                    return cellDate >= start && cellDate <= end;
                } catch (e) {
                    console.error("Error al parsear fecha:", dateStr, e);
                    return false;
                }
            }
        );
        
        dataTable.draw();
        $.fn.dataTable.ext.search.pop();
    }
    
    // Limpiar filtro al actualizar
    document.getElementById('refresh-btn').addEventListener('click', function() {
        if (flatpickrInstance) {
            flatpickrInstance.clear();
        }
    });
};

export const updateDataTable = (newData) => {
    if (dataTable) {
        dataTable.clear().rows.add(newData).draw();
    } else {
        initializeDataTable(newData);
    }
};
