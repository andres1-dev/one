// datatable-manager.js
let dataTable;

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
                    // Asegúrate de que las fechas estén en formato adecuado
                    if (type === 'sort' || type === 'type') {
                        return data; // Devuelve el valor original para ordenar/filtrar
                    }
                    // Formatea la fecha para mostrar (opcional)
                    return data; // O usa new Date(data).toLocaleDateString()
                }
            },
        columns: [
            { title: "Documento", data: "DOCUMENTO" },
            { title: "Fecha", data: "FECHA" },
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
            'copy', 'csv', 'excel', 'print',
        ],
        language: {
            url: '//cdn.datatables.net/plug-ins/1.10.25/i18n/Spanish.json'
        },
        pageLength: 10,
        order: [[1, 'desc']]
    });

    // Inicializar Flatpickr para el rango de fechas
    flatpickr("#date-range", {
        mode: "range",
        locale: "es",
        dateFormat: "Y-m-d",
        onChange: function(selectedDates, dateStr, instance) {
            if (selectedDates.length === 2) {
                filterByDateRange(selectedDates[0], selectedDates[1]);
            } else if (selectedDates.length === 0) {
                // Si se borra el filtro, mostrar todos los datos
                dataTable.columns(1).search("").draw();
            }
        }
    });
};

// Función para filtrar por rango de fechas
function filterByDateRange(startDate, endDate) {
    if (dataTable) {
        dataTable.columns(1).search("").draw(); // Limpiar filtros previos
        
        // Convertir fechas a formato comparable
        const start = startDate.setHours(0, 0, 0, 0);
        const end = endDate.setHours(23, 59, 59, 999);
        
        // Aplicar filtro personalizado
        $.fn.dataTable.ext.search.push(
            function(settings, data, dataIndex) {
                const dateStr = data[1]; // Columna de fecha (índice 1)
                if (!dateStr) return false;
                
                const date = new Date(dateStr);
                if (!date) return false;
                
                const time = date.getTime();
                return time >= start && time <= end;
            }
        );
        
        dataTable.draw();
        $.fn.dataTable.ext.search.pop(); // Eliminar el filtro para futuras búsquedas
    }
}

export const updateDataTable = (newData) => {
    if (dataTable) {
        dataTable.clear().rows.add(newData).draw();
    } else {
        initializeDataTable(newData);
    }
};
