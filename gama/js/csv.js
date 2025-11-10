// Función optimizada para Excel español con datos completos
function descargarDatosCSV() {
    if (!database || database.length === 0) {
        mostrarNotificacion('error', 'Sin datos', 'No hay datos disponibles para exportar');
        return;
    }

    try {
        let csvData = [];
        let registrosConFactura = 0;

        // Encabezados en español con las nuevas columnas
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
            'REFERENCIA',      // Nueva columna
            'REFPROV',         // Nueva columna  
            'DESCRIPCION',     // Nueva columna
            'PVP',             // Nueva columna
            'PRENDA',          // Nueva columna
            'GENERO',          // Nueva columna
            'CLASE'            // Nueva columna
        ];
        csvData.push(headers.join(';'));

        // Procesar SOLO registros con factura
        database.forEach(item => {
            if (item.datosSiesa && Array.isArray(item.datosSiesa)) {
                item.datosSiesa.forEach(siesa => {
                    // Filtrar por factura no vacía
                    if (siesa.factura && siesa.factura.trim() !== '') {
                        // Obtener datos adicionales de main.js
                        const datosAdicionales = obtenerDatosCompletos(
                            item.documento?.replace(/^REC/i, '') || item.documento,
                            item.referencia, 
                            item.lote
                        );

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

                        // Datos adicionales (usar datos de main.js o calcular)
                        const refAdicional = datosAdicionales?.REFERENCIA || referencia;
                        const refProv = datosAdicionales?.REFPROV || '';
                        const descripcion = datosAdicionales?.DESCRIPCION || '';
                        const pvp = datosAdicionales?.PVP || '';
                        const prenda = datosAdicionales?.PRENDA || '';
                        const genero = datosAdicionales?.GENERO || '';
                        
                        // Determinar CLASE (usar datos de main.js o calcular desde PVP)
                        let clase = datosAdicionales?.CLASE || '';
                        if (!clase && pvp) {
                            clase = determinarClasePorPVP(pvp);
                        }

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
                            `"${refAdicional}"`,
                            `"${refProv}"`,
                            `"${descripcion}"`,
                            `"${pvp}"`,
                            `"${prenda}"`,
                            `"${genero}"`,
                            `"${clase}"`
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

        mostrarNotificacion('success', 'CSV Exportado', 
            `${registrosConFactura} facturas exportadas con datos completos`);

    } catch (error) {
        console.error('Error al exportar CSV:', error);
        mostrarNotificacion('error', 'Error', 'Error al exportar: ' + error.message);
    }
}

window.descargarDatosCSV = descargarDatosCSV;

// Función para cruzar datos con main.js usando solo el documento
function obtenerDatosCompletos(documento) {
    try {
        // Verificar si main.js está cargado y tiene los datos globales
        if (typeof datosGlobales === 'undefined' || !Array.isArray(datosGlobales)) {
            console.warn('datosGlobales no está disponible');
            return null;
        }

        // Normalizar el documento (remover "REC" si existe)
        const docNormalizado = String(documento).replace(/^REC/i, '').trim();
        
        console.log('Buscando documento en main.js:', docNormalizado);
        console.log('Total de registros en datosGlobales:', datosGlobales.length);

        // Buscar coincidencia por documento (usando DOCUMENTO normalizado)
        const coincidencia = datosGlobales.find(item => {
            const itemDoc = String(item.DOCUMENTO || '').trim();
            return itemDoc === docNormalizado;
        });

        if (!coincidencia) {
            console.log('No se encontró coincidencia en main.js para documento:', docNormalizado);
            return null;
        }

        console.log('Coincidencia encontrada en main.js:', coincidencia);

        // Extraer los campos necesarios
        return {
            REFERENCIA: coincidencia.REFERENCIA || '',
            REFPROV: coincidencia.REFPROV || '',
            DESCRIPCION: coincidencia.DESCRIPCIÓN || coincidencia.DESCRIPCION || '',
            PVP: coincidencia.PVP || '',
            PRENDA: coincidencia.PRENDA || '',
            GENERO: coincidencia.GENERO || '',
            CLASE: coincidencia.CLASE || determinarClasePorPVP(coincidencia.PVP || '')
        };
    } catch (error) {
        console.error('Error al cruzar datos con main.js:', error);
        return null;
    }
}

// Función para determinar la CLASE basada en el PVP
function determinarClasePorPVP(pvp) {
    if (!pvp || pvp.trim() === '') return 'NO DEFINIDO';
    
    try {
        // Limpiar el PVP (remover símbolos de moneda, espacios, etc.)
        const pvpLimpio = pvp.toString().replace(/[^\d.,]/g, '').replace(',', '.');
        const valorNumerico = parseFloat(pvpLimpio);
        
        if (isNaN(valorNumerico)) {
            console.log('PVP no numérico:', pvp);
            return 'NO DEFINIDO';
        }
        
        console.log('Calculando CLASE para PVP:', valorNumerico);
        
        if (valorNumerico <= 39900) return 'LINEA';
        if (valorNumerico <= 69900) return 'MODA';
        if (valorNumerico > 69900) return 'PRONTAMODA';
        
        return 'NO DEFINIDO';
    } catch (error) {
        console.error('Error al parsear PVP:', pvp, error);
        return 'NO DEFINIDO';
    }
}
