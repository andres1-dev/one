// datatable-manager.js



let dataTable;
let flatpickrInstance;

export const initializeDataTable = (data) => {
    if (dataTable) {
        dataTable.destroy();
    }
    
    flatpickrInstance = flatpickr("#filterFecha", {
        mode: "range",
        locale: "es",
        dateFormat: "d/m/Y",  // Cambiado a formato día/mes/año
        onClose: function(selectedDates) {
            if (selectedDates.length === 1) {
                filterByExactDate(selectedDates[0]);
            } else if (selectedDates.length === 2) {
                filterByDateRange(selectedDates[0], selectedDates[1]);
            } else {
                dataTable.search('').draw();
            }
        }
    });
    
    dataTable = $('#data-table').DataTable({
        data: data,
        columns: [
            { title: "Documento", data: "DOCUMENTO" },
            { 
                title: "Fecha", 
                data: "FECHA",
                render: function(data) {
                    if (!data) return '';
                    // Parsear la fecha directamente sin conversión de zona horaria
                    const parts = data.split(/-|\//);
                    return `${parts[2]}/${parts[1]}/${parts[0]}`;
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
                className: 'btn btn-sm btn-success',
                customize: function(xlsx) {
                    // Asegurar que las fechas en Excel sean correctas
                    const sheet = xlsx.xl.worksheets['sheet1.xml'];
                    $('row c[r^="B"]', sheet).attr('s', '2'); // Formato fecha
                }
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
    
    function filterByExactDate(date) {
        const formattedDate = formatDateForFilter(date);
        dataTable.columns(1).search(formattedDate, true, false).draw();
    }
    
    function filterByDateRange(startDate, endDate) {
        const startStr = formatDateForFilter(startDate);
        const endStr = formatDateForFilter(endDate);
        
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
    
    // Función auxiliar para formatear fechas consistentemente
    function formatDateForFilter(date) {
        const d = new Date(date);
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear();
        return `${year}-${month}-${day}`; // Formato YYYY-MM-DD para filtrado
    }
};

export const updateDataTable = (newData) => {
    if (dataTable) {
        dataTable.clear().rows.add(newData).draw();
    }
};
