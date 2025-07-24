// datatable-manager.js - Módulo para manejar DataTables
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
        order: [[1, 'desc']]
    });
};

export const updateDataTable = (newData) => {
    if (dataTable) {
        dataTable.clear().rows.add(newData).draw();
    } else {
        initializeDataTable(newData);
    }
};
