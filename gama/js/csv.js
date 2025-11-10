// Función optimizada para Excel español - CORREGIDA para incluir todas las fuentes
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
            'Confirmación',
            'Fuente' // NUEVO: Para identificar la fuente de los datos
        ];
        csvData.push(headers.join(';'));

        // Procesar registros con factura de TODAS las fuentes
        database.forEach(item => {
            if (item.datosSiesa && Array.isArray(item.datosSiesa)) {
                item.datosSiesa.forEach(siesa => {
                    // Filtrar por factura no vacía
                    if (siesa.factura && siesa.factura.trim() !== '') {
                        // Determinar la fuente del dato
                        const fuente = determinarFuenteDato(item, siesa);
                        
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
                            `"${confirmacion}"`,
                            `"${fuente}"` // NUEVO: Incluir la fuente
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

// Función auxiliar para determinar la fuente del dato
function determinarFuenteDato(item, siesa) {
    // Si el documento empieza con "REC" y tiene estructura de DATA2
    if (item.documento && item.documento.toString().startsWith('REC')) {
        // Verificar características de DATA2
        if (item.referencia && item.lote && siesa.proovedor) {
            // Proveedores específicos de DATA2
            if (siesa.proovedor.includes('TEXTILES Y CREACIONES')) {
                return 'DATA2/SISPRO';
            }
        }
    }
    
    // Verificar características de REC/GLOBAL
    if (siesa.estado) {
        const estadosGlobales = ['Esteban', 'Jesus', 'Alex', 'Yamilet', 'Ruben', 'PROMO', 'MUESTRA', 'PENDIENTE'];
        if (estadosGlobales.includes(siesa.estado)) {
            return 'REC/GLOBAL';
        }
    }
    
    // Características específicas de REC
    if (siesa.cliente) {
        const clientesGlobales = [
            'ZULUAGA GOMEZ RUBEN ESTEBAN',
            'ARISTIZABAL LOPEZ JESUS MARIA', 
            'QUINTERO ORTIZ JOSE ALEXANDER',
            'QUINTERO ORTIZ PATRICIA YAMILET',
            'INVERSIONES URBANA SAS'
        ];
        if (clientesGlobales.some(cliente => siesa.cliente.includes(cliente))) {
            return 'REC/GLOBAL';
        }
    }
    
    return 'DESCONOCIDA';
}

// Función alternativa más robusta si la anterior no funciona
function descargarDatosCSVCompleto() {
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
            'Confirmación',
            'Tipo_Registro'
        ];
        csvData.push(headers.join(';'));

        // Procesar TODOS los registros con factura sin importar la fuente
        database.forEach(item => {
            if (item.datosSiesa && Array.isArray(item.datosSiesa)) {
                item.datosSiesa.forEach(siesa => {
                    // Filtrar SOLO registros con factura
                    if (siesa.factura && siesa.factura.trim() !== '') {
                        // Determinar tipo de registro basado en características
                        let tipoRegistro = 'DATA2';
                        
                        // Heurística para identificar registros REC/GLOBAL
                        if (siesa.estado && ['Esteban', 'Jesus', 'Alex', 'Yamilet', 'Ruben', 'PROMO', 'MUESTRA'].includes(siesa.estado)) {
                            tipoRegistro = 'REC';
                        }
                        if (siesa.cliente && siesa.cliente.includes('ZULUAGA') || siesa.cliente.includes('ARISTIZABAL') || siesa.cliente.includes('QUINTERO')) {
                            tipoRegistro = 'REC';
                        }
                        
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
                            `"${confirmacion}"`,
                            `"${tipoRegistro}"`
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
        link.setAttribute('download', `Facturas_PandaDash_Completo_${fecha}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // Mostrar estadísticas por fuente
        const stats = {};
        csvData.slice(1).forEach(row => {
            const columns = row.split(';');
            const fuente = columns[12]?.replace(/"/g, '') || 'DESCONOCIDA';
            stats[fuente] = (stats[fuente] || 0) + 1;
        });

        let statsMessage = `${registrosConFactura} facturas exportadas`;
        Object.keys(stats).forEach(fuente => {
            statsMessage += `\n${fuente}: ${stats[fuente]}`;
        });

        mostrarNotificacion('success', 'CSV Exportado', statsMessage);

    } catch (error) {
        console.error('Error al exportar CSV:', error);
        mostrarNotificacion('error', 'Error', 'Error al exportar: ' + error.message);
    }
}

// Reemplazar la función original con la versión corregida
window.descargarDatosCSV = descargarDatosCSVCompleto;
