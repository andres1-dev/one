// Función optimizada para Excel español
function descargarDatosCSV() {
    if (!database || database.length === 0) {
        mostrarNotificacion('error', 'Sin datos', 'No hay datos disponibles para exportar');
        return;
    }

    try {
        let csvData = [];
        let registrosConFactura = 0;

        // Encabezados en español
        const headers = [
            'Documento',
            'Referencia',
            'Lote',
            'Estado',
            'Factura',
            'Fecha_Factura',
            'Proveedor',
            'Cliente',
            'Valor_Bruto',
            'Cantidad',
            'NIT_Cliente',
            'Confirmación'
        ];
        csvData.push(headers.join(';'));

        // Procesar SOLO registros con factura
        database.forEach(item => {
            if (item.datosSiesa && Array.isArray(item.datosSiesa)) {
                item.datosSiesa.forEach(siesa => {
                    // Filtrar por factura no vacía
                    if (siesa.factura && siesa.factura.trim() !== '') {
                        // Formatear valores para CSV
                        const documento = item.documento || '';
                        const referencia = item.referencia || '';
                        const lote = item.lote || '';
                        const estado = siesa.estado || '';
                        const factura = siesa.factura || '';
                        const fecha = siesa.fecha || '';
                        const proveedor = (siesa.proovedor || '').replace(/"/g, '""');
                        const cliente = (siesa.cliente || '').replace(/"/g, '""');
                        const valorBruto = siesa.valorBruto || '';
                        const cantidad = siesa.cantidad || '';
                        const nit = siesa.nit || '';
                        const confirmacion = siesa.confirmacion || '';

                        const row = [
                            `"${documento}"`,
                            `"${referencia}"`,
                            `"${lote}"`,
                            `"${estado}"`,
                            `"${factura}"`,
                            `"${fecha}"`,
                            `"${proveedor}"`,
                            `"${cliente}"`,
                            `"${valorBruto}"`,
                            `"${cantidad}"`,
                            `"${nit}"`,
                            `"${confirmacion}"`
                        ];
                        csvData.push(row.join(';'));
                        registrosConFactura++;
                    }
                });
            }
        });

        if (registrosConFactura === 0) {
            mostrarNotificacion('warning', 'Sin facturas', 
                'No se encontraron registros con número de factura');
            return;
        }

        // Crear CSV con BOM para Excel
        const BOM = '\uFEFF';
        const csvContent = BOM + csvData.join('\n');
        
        // Descargar archivo
        const blob = new Blob([csvContent], { 
            type: 'text/csv;charset=utf-8;' 
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        const fecha = new Date().toISOString().split('T')[0];
        link.href = url;
        link.setAttribute('download', `Facturas_PandaDash_${fecha}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        mostrarNotificacion('success', 'CSV Exportado', 
            `${registrosConFactura} facturas exportadas`);

    } catch (error) {
        console.error('Error al exportar CSV:', error);
        mostrarNotificacion('error', 'Error', 'Error al exportar: ' + error.message);
    }
}

window.descargarDatosCSV = descargarDatosCSV;
