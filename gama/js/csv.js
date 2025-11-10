// Función para descargar datos en formato CSV
function descargarDatosCSV() {
    if (!database || database.length === 0) {
        mostrarNotificacion('error', 'Sin datos', 'No hay datos disponibles para exportar');
        return;
    }

    try {
        // Crear array para almacenar todas las filas CSV
        let csvData = [];
        
        // Encabezados del CSV
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
        csvData.push(headers.join(','));

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
                    csvData.push(row.join(','));
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
        link.setAttribute('download', `pandadash-datos-${fecha}_${hora}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // Mostrar notificación de éxito
        const totalRegistros = database.reduce((total, item) => 
            total + (item.datosSiesa ? item.datosSiesa.length : 0), 0
        );
        
        mostrarNotificacion('success', 'CSV Exportado', 
            `${totalRegistros} registros exportados correctamente`);

    } catch (error) {
        console.error('Error al exportar CSV:', error);
        mostrarNotificacion('error', 'Error CSV', 
            'No se pudo exportar los datos: ' + error.message);
    }
}

// Hacer disponible globalmente
window.descargarDatosCSV = descargarDatosCSV;


// Función mejorada para descargar datos en CSV (incluye sin factura)
function descargarDatosCSVCompleto() {
    if (!database || database.length === 0) {
        mostrarNotificacion('error', 'Sin datos', 'No hay datos disponibles para exportar');
        return;
    }

    try {
        let csvData = [];
        
        // Encabezados más completos
        const headers = [
            'Tipo',
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
            'Confirmación',
            'Timestamp'
        ];
        csvData.push(headers.join(','));

        // Procesar cada registro
        database.forEach(item => {
            const tipo = item.datosSiesa && item.datosSiesa.length > 0 ? 
                (item.datosSiesa[0].factura && item.datosSiesa[0].factura.trim() !== '' ? 
                 'CON_FACTURA' : 'SIN_FACTURA') : 'SIN_DATOS';

            if (item.datosSiesa && Array.isArray(item.datosSiesa)) {
                item.datosSiesa.forEach(siesa => {
                    const row = [
                        `"${tipo}"`,
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
                        `"${siesa.confirmacion || ''}"`,
                        `"${new Date().toISOString()}"`
                    ];
                    csvData.push(row.join(','));
                });
            } else {
                // Incluir registros sin datosSiesa
                const row = [
                    `"SIN_DETALLES"`,
                    `"${item.documento || ''}"`,
                    `"${item.referencia || ''}"`,
                    `"${item.lote || ''}"`,
                    '""', '""', '""', '""', '""', '""', '""', '""', '""',
                    `"${new Date().toISOString()}"`
                ];
                csvData.push(row.join(','));
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
        
        mostrarNotificacion('success', 'CSV Exportado', 
            `${totalRegistros} registros exportados`);

    } catch (error) {
        console.error('Error al exportar CSV:', error);
        mostrarNotificacion('error', 'Error CSV', 'Error: ' + error.message);
    }
}

// Hacer disponible globalmente
window.descargarDatosCSV_2 = descargarDatosCSVCompleto;
