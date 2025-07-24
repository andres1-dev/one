// datatable-manager.js
let dataTable;
let flatpickrInstance;

export const initializeDataTable = (data) => {
    // Destruir la tabla existente si hay una
    if (dataTable) {
        dataTable.destroy();
    }
    
    // Inicializar Flatpickr si no existe
    if (!flatpickrInstance) {
        flatpickrInstance = flatpickr("#filterFecha", {
            mode: "range",
            locale: "es",
            dateFormat: "Y-m-d",
            allowInput: true,
            onClose: function(selectedDates, dateStr, instance) {
                if (selectedDates.length === 2) {
                    filterByDateRange(selectedDates[0], selectedDates[1]);
                } else if (selectedDates.length === 0) {
                    // Si se limpia el filtro, mostrar todos los datos
                    dataTable.search('').columns().search('').draw();
                }
            }
        });
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
                    if (type === 'sort' || type === 'filter') {
                        return data; // Usar el valor original para ordenar/filtrar
                    }
                    // Formatear para mostrar (opcional)
                    return new Date(data).toLocaleDateString('es-ES');
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
        dom: '<"top"<"row"<"col-md-6"l><"col-md-6"f>>>rt<"bottom"<"row"<"col-md-6"i><"col-md-6"p>>><"clear">',
        buttons: [
            {
                extend: 'copy',
                text: '<i class="fas fa-copy"></i> Copiar',
                className: 'btn btn-secondary'
            },
            {
                extend: 'excel',
                text: '<i class="fas fa-file-excel"></i> Excel',
                className: 'btn btn-success'
            },
            {
                extend: 'print',
                text: '<i class="fas fa-print"></i> Imprimir',
                className: 'btn btn-info'
            }
        ],
        language: {
            url: '//cdn.datatables.net/plug-ins/1.10.25/i18n/Spanish.json'
        },
        pageLength: 10,
        order: [[1, 'desc']],
        initComplete: function() {
            // Aplicar estilo a los botones
            $('.dt-buttons .btn').removeClass('btn-secondary');
        }
    });
    
    // Función para filtrar por rango de fechas
    function filterByDateRange(startDate, endDate) {
        // Limpiar filtros previos
        dataTable.search('').columns().search('').draw();
        
        // Aplicar filtro personalizado
        $.fn.dataTable.ext.search.push(
            function(settings, data, dataIndex) {
                const dateStr = data[1]; // Índice de la columna de fecha (segunda columna)
                if (!dateStr) return false;
                
                try {
                    const cellDate = new Date(dateStr);
                    // Ajustar las fechas para comparar solo día/mes/año
                    const start = new Date(startDate);
                    start.setHours(0, 0, 0, 0);
                    
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    
                    return start <= cellDate && cellDate <= end;
                } catch (e) {
                    console.error("Error al parsear fecha:", dateStr, e);
                    return false;
                }
            }
        );
        
        dataTable.draw();
        $.fn.dataTable.ext.search.pop(); // Eliminar el filtro para futuras búsquedas
    }
    
    // Limpiar filtro cuando se hace clic en el botón de actualización
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
