// Función para descargar datos básicos en CSV con separador ;
function descargarDatosCSV() {
    if (!database || database.length === 0) {
        mostrarNotificacion('error', 'Sin datos', 'No hay datos disponibles para exportar');
        return;
    }

    try {
        // Crear array para almacenar todas las filas CSV
        let csvData = [];
        
        // Encabezados del CSV con separador ;
        const headers = [
            'Documento',
            'Referencia', 
            'Lote',
            'Estado',
            'Factura',
            'Fecha',
            'Proveedor',
            'Cliente',
            'Valor Bruto',
            'Cantidad',
            'NIT',
            'Confirmación'
        ];
        csvData.push(headers.join(';'));

        // Procesar cada registro
        database.forEach(item => {
            if (item.datosSiesa && Array.isArray(item.datosSiesa)) {
                item.datosSiesa.forEach(siesa => {
                    const row = [
                        `"${item.documento || ''}"`,
                        `"${item.referencia || ''}"`,
                        `"${item.lote || ''}"`,
                        `"${siesa.estado || ''}"`,
                        `"${siesa.factura || ''}"`,
                        `"${siesa.fecha || ''}"`,
                        `"${siesa.proovedor || ''}"`,
                        `"${siesa.cliente || ''}"`,
                        `"${siesa.valorBruto || ''}"`,
                        `"${siesa.cantidad || ''}"`,
                        `"${siesa.nit || ''}"`,
                        `"${siesa.confirmacion || ''}"`
                    ];
                    csvData.push(row.join(';'));
                });
            }
        });

        // Crear el contenido CSV
        const csvContent = csvData.join('\n');
        
        // Crear blob y descargar
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        // Nombre del archivo con fecha
        const fecha = new Date().toISOString().split('T')[0];
        const hora = new Date().toLocaleTimeString('es-CO', { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }).replace(/:/g, '-');
        
        link.href = url;
        link.setAttribute('download', `pandadash-datos-basicos-${fecha}_${hora}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // Mostrar notificación de éxito
        const totalRegistros = database.reduce((total, item) => 
            total + (item.datosSiesa ? item.datosSiesa.length : 0), 0
        );
        
        mostrarNotificacion('success', 'CSV Básico Exportado', 
            `${totalRegistros} registros exportados correctamente`);

    } catch (error) {
        console.error('Error al exportar CSV básico:', error);
        mostrarNotificacion('error', 'Error CSV', 
            'No se pudo exportar los datos: ' + error.message);
    }
}

// Función para descargar datos completos en CSV con separador ;
function descargarDatosCSVCompleto() {
    if (!database || database.length === 0) {
        mostrarNotificacion('error', 'Sin datos', 'No hay datos disponibles para exportar');
        return;
    }

    try {
        let csvData = [];
        
        // Encabezados más completos con separador ;
        const headers = [
            'Tipo_Dato',
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
            'Confirmación',
            'Tiene_Factura',
            'Fecha_Exportacion',
            'Hora_Exportacion'
        ];
        csvData.push(headers.join(';'));

        // Procesar cada registro
        database.forEach(item => {
            if (item.datosSiesa && Array.isArray(item.datosSiesa)) {
                item.datosSiesa.forEach(siesa => {
                    // Determinar tipo de dato
                    const tieneFactura = siesa.factura && siesa.factura.trim() !== '';
                    const tipoDato = tieneFactura ? 'CON_FACTURA' : 'SIN_FACTURA';
                    
                    // Formatear valores numéricos
                    const valorBruto = siesa.valorBruto ? 
                        String(siesa.valorBruto).replace('.', ',') : '';
                    const cantidad = siesa.cantidad ? 
                        String(siesa.cantidad).replace('.', ',') : '';
                    
                    // Fechas para exportación
                    const ahora = new Date();
                    const fechaExportacion = ahora.toLocaleDateString('es-CO');
                    const horaExportacion = ahora.toLocaleTimeString('es-CO');

                    const row = [
                        `"${tipoDato}"`,
                        `"${item.documento || ''}"`,
                        `"${item.referencia || ''}"`,
                        `"${item.lote || ''}"`,
                        `"${siesa.estado || ''}"`,
                        `"${siesa.factura || ''}"`,
                        `"${siesa.fecha || ''}"`,
                        `"${siesa.proovedor || ''}"`,
                        `"${siesa.cliente || ''}"`,
                        `"${valorBruto}"`,
                        `"${cantidad}"`,
                        `"${siesa.nit || ''}"`,
                        `"${siesa.confirmacion || ''}"`,
                        `"${tieneFactura ? 'SI' : 'NO'}"`,
                        `"${fechaExportacion}"`,
                        `"${horaExportacion}"`
                    ];
                    csvData.push(row.join(';'));
                });
            } else {
                // Incluir registros sin datosSiesa
                const ahora = new Date();
                const fechaExportacion = ahora.toLocaleDateString('es-CO');
                const horaExportacion = ahora.toLocaleTimeString('es-CO');

                const row = [
                    '"SIN_DETALLES"',
                    `"${item.documento || ''}"`,
                    `"${item.referencia || ''}"`,
                    `"${item.lote || ''}"`,
                    '""', '""', '""', '""', '""', '""', '""', '""', '""',
                    '"NO"',
                    `"${fechaExportacion}"`,
                    `"${horaExportacion}"`
                ];
                csvData.push(row.join(';'));
            }
        });

        // Crear y descargar archivo
        const csvContent = csvData.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        const fecha = new Date().toISOString().split('T')[0];
        const hora = new Date().toLocaleTimeString('es-CO', { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }).replace(/:/g, '-');
        
        link.href = url;
        link.setAttribute('download', `pandadash-datos-completos-${fecha}_${hora}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // Estadísticas
        const totalRegistros = database.reduce((total, item) => 
            total + (item.datosSiesa ? item.datosSiesa.length : 1), 0
        );
        
        const conFactura = database.reduce((total, item) => 
            total + (item.datosSiesa ? 
                item.datosSiesa.filter(s => s.factura && s.factura.trim() !== '').length : 0), 0
        );
        
        const sinFactura = totalRegistros - conFactura;
        
        mostrarNotificacion('success', 'CSV Completo Exportado', 
            `${totalRegistros} registros (${conFactura} con factura, ${sinFactura} sin factura)`);

    } catch (error) {
        console.error('Error al exportar CSV completo:', error);
        mostrarNotificacion('error', 'Error CSV', 'Error: ' + error.message);
    }
}

// Hacer disponibles globalmente
window.descargarDatosCSV = descargarDatosCSV;
window.descargarDatosCSVCompleto = descargarDatosCSVCompleto;
