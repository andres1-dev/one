// Función para descargar datos CON FACTURA en CSV con separador ;
async function descargarDatosCSV() {
    if (!database || database.length === 0) {
        mostrarNotificacion('error', 'Sin datos', 'No hay datos disponibles para exportar');
        return;
    }

    try {
        let csvData = [];
        
        // Encabezados con las columnas solicitadas
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
            'RefProv',
            'Descripción',
            'PVP',
            'Prenda',
            'Género',
            'Clasificación'
        ];
        csvData.push(headers.join(';'));

        let registrosConFactura = 0;
        let registrosConDatosCompletos = 0;

        // Asegurar que los datos de main.js estén cargados
        await inicializarDatosCompletos();

        // Procesar solo registros CON FACTURA
        for (const item of database) {
            if (item.datosSiesa && Array.isArray(item.datosSiesa)) {
                for (const siesa of item.datosSiesa) {
                    // FILTRAR: Solo procesar registros que tienen factura
                    if (siesa.factura && siesa.factura.trim() !== '') {
                        registrosConFactura++;
                        
                        // Buscar datos completos en main.js usando el documento
                        const datosCompletos = await buscarDatosCompletos(item, siesa);
                        
                        if (datosCompletos) {
                            registrosConDatosCompletos++;
                            
                            // Calcular PVP (Precio Unitario)
                            const valorBruto = parseFloat(siesa.valorBruto) || 0;
                            const cantidad = parseFloat(siesa.cantidad) || 1;
                            const pvp = cantidad > 0 ? valorBruto / cantidad : 0;
                            
                            // Determinar clasificación por PVP
                            const clasificacion = determinarClasificacionPVP(pvp);
                            
                            // Obtener todos los datos de main.js
                            const refProv = datosCompletos.REFPROV || datosCompletos.refProv || '';
                            const referencia = datosCompletos.REFERENCIA || datosCompletos.referencia || '';
                            const descripcion = datosCompletos.DESCRIPCIÓN || datosCompletos.descripcion || datosCompletos.DESCRIPCION || '';
                            const prenda = datosCompletos.PRENDA || datosCompletos.prenda || '';
                            const genero = datosCompletos.GENERO || datosCompletos.genero || '';
                            const pvpOriginal = datosCompletos.PVP || datosCompletos.pvp || '';

                            const row = [
                                `"CON_FACTURA"`,
                                `"${item.documento || ''}"`,
                                `"${referencia}"`, // REFERENCIA de main.js
                                `"${item.lote || ''}"`,
                                `"${siesa.estado || ''}"`,
                                `"${siesa.factura || ''}"`,
                                `"${siesa.fecha || ''}"`,
                                `"${siesa.proovedor || ''}"`,
                                `"${siesa.cliente || ''}"`,
                                `"${valorBruto.toFixed(2).replace('.', ',')}"`,
                                `"${cantidad}"`,
                                `"${siesa.nit || ''}"`,
                                `"${siesa.confirmacion || ''}"`,
                                `"${refProv}"`, // REFPROV de main.js
                                `"${descripcion}"`, // DESCRIPCIÓN de main.js
                                `"${pvp.toFixed(2).replace('.', ',')}"`, // PVP calculado
                                `"${prenda}"`, // PRENDA de main.js
                                `"${genero}"`, // GÉNERO de main.js
                                `"${clasificacion}"` // Clasificación calculada
                            ];
                            csvData.push(row.join(';'));
                        } else {
                            console.warn('No se encontraron datos completos para:', item.documento);
                        }
                    }
                }
            }
        }

        // Verificar si hay registros con factura
        if (registrosConFactura === 0) {
            mostrarNotificacion('warning', 'Sin datos', 'No hay registros con factura para exportar');
            return;
        }

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
        link.setAttribute('download', `pandadash-facturas-${fecha}_${hora}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // Mostrar notificación de éxito
        mostrarNotificacion('success', 'CSV Facturas Exportado', 
            `${registrosConDatosCompletos} registros exportados (de ${registrosConFactura} con factura)`);

    } catch (error) {
        console.error('Error al exportar CSV facturas:', error);
        mostrarNotificacion('error', 'Error CSV', 
            'No se pudo exportar los datos: ' + error.message);
    }
}

// Función para buscar datos completos por múltiples criterios
async function buscarDatosCompletos(item, siesa) {
    // Intentar por documento (normalizado)
    let datos = await buscarDatosPorDocumento(item.documento);
    
    // Si no se encuentra, intentar por documento y lote
    if (!datos && item.lote) {
        datos = await buscarDatosPorDocumentoYLote(item.documento, item.lote);
    }
    
    // Si aún no se encuentra, buscar por referencia de SIESA
    if (!datos && siesa.referencia) {
        datos = await buscarDatosPorReferencia(siesa.referencia);
    }
    
    // Si aún no se encuentra, buscar por referencia del item principal
    if (!datos && item.referencia) {
        datos = await buscarDatosPorReferencia(item.referencia);
    }
    
    return datos;
}

// Función para buscar por documento en datosGlobales
async function buscarDatosPorDocumento(documento) {
    try {
        if (typeof window.datosGlobales !== 'undefined' && Array.isArray(window.datosGlobales)) {
            const documentoNormalizado = normalizarDocumento(documento);
            
            const encontrado = window.datosGlobales.find(item => {
                const itemDoc = normalizarDocumento(item.DOCUMENTO || item.REC || '');
                return itemDoc === documentoNormalizado;
            });
            
            return encontrado || null;
        }
        return null;
    } catch (error) {
        console.error('Error buscando datos por documento:', error);
        return null;
    }
}

// Función para buscar por documento y lote
async function buscarDatosPorDocumentoYLote(documento, lote) {
    try {
        if (typeof window.datosGlobales !== 'undefined' && Array.isArray(window.datosGlobales)) {
            const documentoNormalizado = normalizarDocumento(documento);
            const loteNormalizado = String(lote || '').trim();
            
            const encontrado = window.datosGlobales.find(item => {
                const itemDoc = normalizarDocumento(item.DOCUMENTO || item.REC || '');
                const itemLote = String(item.LOTE || '').trim();
                
                return itemDoc === documentoNormalizado && itemLote === loteNormalizado;
            });
            
            return encontrado || null;
        }
        return null;
    } catch (error) {
        console.error('Error buscando datos por documento y lote:', error);
        return null;
    }
}

// Función para buscar por referencia
async function buscarDatosPorReferencia(referencia) {
    try {
        if (typeof window.datosGlobales !== 'undefined' && Array.isArray(window.datosGlobales)) {
            const refNormalizada = String(referencia || '').trim().toUpperCase();
            
            const encontrado = window.datosGlobales.find(item => {
                const itemRef = String(item.REFERENCIA || item.REFPROV || '').trim().toUpperCase();
                return itemRef === refNormalizada;
            });
            
            return encontrado || null;
        }
        return null;
    } catch (error) {
        console.error('Error buscando datos por referencia:', error);
        return null;
    }
}

// Función para normalizar documentos (quitar "REC" y espacios)
function normalizarDocumento(documento) {
    if (!documento) return '';
    return String(documento).replace(/^REC/i, '').replace(/\s+/g, '').trim();
}

// Función para determinar clasificación por PVP
function determinarClasificacionPVP(pvp) {
    if (pvp <= 39900) {
        return "LINEA";
    } else if (pvp <= 69900) {
        return "MODA";
    } else {
        return "PRONTAMODA";
    }
}

// Función para inicializar la conexión entre las bases de datos
async function inicializarDatosCompletos() {
    try {
        // Verificar si main.js ya cargó los datos
        if (typeof window.datosGlobales === 'undefined') {
            console.log('Cargando datos de main.js...');
            
            // Si la función cargarDatos existe, ejecutarla
            if (typeof cargarDatos === 'function') {
                await cargarDatos();
                console.log('Datos de main.js cargados correctamente');
            } else {
                console.warn('Función cargarDatos no disponible en window');
                // Intentar cargar el script si no está disponible
                await cargarScriptMainJS();
            }
        } else {
            console.log('Datos de main.js ya están cargados:', window.datosGlobales.length, 'registros');
        }
    } catch (error) {
        console.error('Error inicializando datos completos:', error);
    }
}

// Función para cargar main.js si no está disponible
async function cargarScriptMainJS() {
    return new Promise((resolve, reject) => {
        if (typeof cargarDatos !== 'undefined') {
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = './js/main.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Hacer disponibles globalmente
window.descargarDatosCSV = descargarDatosCSV;
window.descargarDatosCSVCompleto = descargarDatosCSVCompleto;
