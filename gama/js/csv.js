// Función optimizada para Excel español - VERSIÓN CORREGIDA SIN BUCLE
function descargarDatosCSV() {
    // Verificar si tenemos datos
    const tieneDatosSISPRO = database && database.length > 0;
    const tieneDatosGLOBAL = window.datosGlobalesCompletos && window.datosGlobalesCompletos.length > 0;
    
    if (!tieneDatosSISPRO && !tieneDatosGLOBAL) {
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
            'Fuente'
        ];
        csvData.push(headers.join(';'));

        // Procesar SOLO registros con factura de AMBAS fuentes
        console.log('📊 Procesando datos SISPRO...');
        let facturasSISPRO = 0;
        if (tieneDatosSISPRO) {
            database.forEach(item => {
                if (item.datosSiesa && Array.isArray(item.datosSiesa)) {
                    item.datosSiesa.forEach(siesa => {
                        // Filtrar por factura no vacía
                        if (siesa.factura && siesa.factura.trim() !== '') {
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
                                `"SISPRO"`
                            ];
                            csvData.push(row.join(';'));
                            registrosConFactura++;
                            facturasSISPRO++;
                        }
                    });
                }
            });
        }

        // Procesar datos GLOBALES con facturas
        console.log('📊 Procesando datos GLOBALES...');
        let facturasGLOBAL = 0;
        if (tieneDatosGLOBAL) {
            window.datosGlobalesCompletos.forEach(item => {
                if (item.datosSiesa && Array.isArray(item.datosSiesa)) {
                    item.datosSiesa.forEach(siesa => {
                        // Filtrar por factura no vacía
                        if (siesa.factura && siesa.factura.trim() !== '') {
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
                                `"GLOBAL"`
                            ];
                            csvData.push(row.join(';'));
                            registrosConFactura++;
                            facturasGLOBAL++;
                        }
                    });
                }
            });
        }

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
            `${registrosConFactura} facturas exportadas (SISPRO: ${facturasSISPRO} + GLOBAL: ${facturasGLOBAL})`);

    } catch (error) {
        console.error('Error al exportar CSV:', error);
        mostrarNotificacion('error', 'Error', 'Error al exportar: ' + error.message);
    }
}

// Función para cargar datos globales con facturas
async function cargarDatosGlobalesParaCSV() {
    try {
        if (typeof sheetsSinFactura !== 'undefined') {
            console.log('🔄 Cargando datos globales para CSV...');
            const resultado = await sheetsSinFactura.obtenerDatosSinFactura();
            if (resultado.success && resultado.data) {
                // Filtrar solo los que tienen facturas
                const datosConFacturas = resultado.data.filter(item => 
                    item.datosSiesa && item.datosSiesa.some(siesa => 
                        siesa.factura && siesa.factura.trim() !== ''
                    )
                );
                console.log(`📁 Datos globales con facturas: ${datosConFacturas.length} registros`);
                return datosConFacturas;
            }
        }
        return [];
    } catch (error) {
        console.error('Error cargando datos globales:', error);
        return [];
    }
}

// Función mejorada para descargar CSV que carga datos globales si es necesario
async function descargarDatosCSVCompleto() {
    const statusDiv = document.getElementById('status');
    const originalStatus = statusDiv.innerHTML;
    
    try {
        // Mostrar estado de carga
        statusDiv.className = 'loading';
        statusDiv.innerHTML = '<i class="fas fa-sync fa-spin"></i> PREPARANDO EXPORTACIÓN...';
        
        // Verificar si tenemos datos globales, si no, cargarlos
        if (!window.datosGlobalesCompletos || window.datosGlobalesCompletos.length === 0) {
            statusDiv.innerHTML = '<i class="fas fa-sync fa-spin"></i> CARGANDO DATOS GLOBALES...';
            window.datosGlobalesCompletos = await cargarDatosGlobalesParaCSV();
        }
        
        // Esperar un momento para que la UI se actualice
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Llamar a la función de descarga PRINCIPAL (no recursiva)
        descargarDatosCSV();
        
    } catch (error) {
        console.error('Error en descarga completa:', error);
        mostrarNotificacion('error', 'Error', 'No se pudieron cargar todos los datos: ' + error.message);
    } finally {
        // Restaurar estado original
        setTimeout(() => {
            statusDiv.className = 'ready';
            statusDiv.innerHTML = originalStatus;
        }, 2000);
    }
}

// Reemplazar la función original con la versión mejorada
window.descargarDatosCSV = descargarDatosCSVCompleto;

// También mantener disponible la función original por si acaso
window.descargarDatosCSVDirecto = function() {
    descargarDatosCSV();
};
