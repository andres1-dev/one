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
        dateFormat: "d/m/Y",
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
        pageLength: 5,
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
        }
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
};

export const updateDataTable = (newData) => {
    if (dataTable) {
        dataTable.clear().rows.add(newData).draw();
        if (flatpickrInstance) {
            flatpickrInstance.clear();
        }
    }
};
