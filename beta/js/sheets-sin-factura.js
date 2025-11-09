// Configuración de la API de Google Sheets para datos SIN FACTURA
// const SHEETS_API_KEY = 'AIzaSyC7hjbRc0TGLgImv8gVZg8tsOeYWgXlPcM';
const API_BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

// IDs de las hojas de cálculo para datos SIN FACTURA
const SPREADSHEET_IDS_SF = {
    DATA2: "133NiyjNApZGkEFs4jUvpJ9So-cSEzRVeW2FblwOCrjI",
    DATA: "1d5dCCCgiWXfM6vHu3zGGKlvK2EycJtT7Uk4JqUjDOfE",
    REC: "1esc5REq0c03nHLpGcLwZRW29yq2gZnrpbz75gCCjrqc",
    SOPORTES: "1VaPBwgRu1QWhmsV_Qgf7cgraSxiAWRX6-wBEyUlGoJw"
};

class SheetsSinFactura {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 0;
        this.cargando = false;
    }

    async fetchSheetData(spreadsheetId, range) {
        try {
            const url = `${API_BASE_URL}/${spreadsheetId}/values/${range}?key=${SHEETS_API_KEY}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return data.values || [];
        } catch (error) {
            console.error('Error fetching sheet data:', error);
            throw error;
        }
    }

    // Obtener SOLO datos SIN facturas
    async obtenerDatosSinFactura() {
        if (this.cargando) {
            console.log('⚠️ Ya se está cargando datos sin factura...');
            return { success: false, error: 'Ya se está cargando' };
        }

        try {
            this.cargando = true;
            console.time('Carga_Sin_Factura');
            console.log('🚀 Cargando SOLO datos SIN facturas...');
            
            const [
                datosData2,
                datosData,
                datosSoportes,
                datosRec,
                datosGlobales
            ] = await Promise.all([
                this.obtenerDatosDeData2(),
                this.obtenerDatosDeDataConSumas(),
                this.obtenerDatosSoportes(),
                this.obtenerDatosRec(),
                this.obtenerDatosGlobales()
            ]);

            console.timeEnd('Carga_Sin_Factura');
            
            // Combinar SOLO datos SIN facturas
            const datosCombinados = this.combinarDatosSinFactura(
                datosData2, datosData, datosSoportes, datosRec, datosGlobales
            );

            console.log(`✅ Carga sin factura completada: ${datosCombinados.length} registros`);

            return {
                success: true,
                data: datosCombinados,
                timestamp: new Date().toISOString(),
                count: datosCombinados.length,
                source: 'solo-sin-factura'
            };
        } catch (error) {
            console.error('Error cargando datos sin factura:', error);
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        } finally {
            this.cargando = false;
        }
    }

    // Combinar SOLO datos que NO tienen facturas
    combinarDatosSinFactura(datosData2, datosData, datosSoportes, datosRec, datosGlobales) {
        const datosCombinados = [];
        
        console.log('🔄 Combinando datos SIN facturas...');
        
        // Procesar datosData2 que NO tienen coincidencias en SIESA
        datosData2.forEach(itemData2 => {
            const documento = "REC" + itemData2.documento;
            const referencia = itemData2.referencia;
            const lote = itemData2.lote;
            
            // SOLO incluir si NO tiene facturas (usamos datos de DATA y anexos)
            const datosRelacionados = this.procesarDatosSinFactura(documento, itemData2, datosData, datosSoportes);
            
            if (datosRelacionados && datosRelacionados.length > 0) {
                datosCombinados.push({
                    documento: documento,
                    referencia: referencia,
                    lote: lote,
                    datosSiesa: datosRelacionados
                });
            }
        });

        // Procesar datos de REC que no estén en datosData2
        const datosGlobalesPorLote = {};
        datosGlobales.forEach(item => {
            datosGlobalesPorLote[item.lote] = item.datosGlobal || [];
        });
        
        datosRec.forEach(filaRec => {
            const documento = filaRec[0];
            const lote = filaRec[2];
            
            const existe = datosCombinados.some(item => item.documento === documento && item.lote === lote);
            
            if (!existe) {
                const datosRelacionados = this.procesarDatosRecSinFactura(documento, filaRec, datosGlobalesPorLote, datosSoportes);
                
                if (datosRelacionados && datosRelacionados.length > 0) {
                    datosCombinados.push({
                        documento: documento,
                        referencia: filaRec[1] || '',
                        lote: lote,
                        datosSiesa: datosRelacionados
                    });
                }
            }
        });

        console.log(`📊 Registros sin factura: ${datosCombinados.length}`);
        return datosCombinados;
    }

    procesarDatosSinFactura(documento, itemData2, datosData, datosSoportes) {
        const datosRelacionados = [];
        const referencia = itemData2.referencia;
        const lote = itemData2.lote;
        
        // Procesar distribución principal (Templo, Shopping, etc.)
        if (datosData[itemData2.documento]) {
            const distribucion = datosData[itemData2.documento];
            const clientesRequeridos = ['Templo', 'Shopping', 'Esteban', 'Ruben', 'Jesus', 'Alex', 'Yamilet'];
            
            clientesRequeridos.forEach(clienteKey => {
                if (distribucion[clienteKey]) {
                    const clienteData = distribucion[clienteKey];
                    const nombreCliente = this.getNombreCliente(clienteKey);
                    const nitCliente = clienteData.id;
                    const cantidadTotal = clienteData.cantidadTotal || 0;
                    
                    if (cantidadTotal > 0) {
                        const confirmacion = this.obtenerConfirmacion(
                            datosSoportes, 
                            documento,
                            lote, 
                            referencia, 
                            String(cantidadTotal), 
                            nitCliente
                        );
                        
                        datosRelacionados.push({
                            estado: this.getEstadoCliente(clienteKey),
                            factura: "",
                            fecha: "",
                            lote: lote,
                            proovedor: itemData2.proveedor,
                            cliente: nombreCliente,
                            valorBruto: "",
                            referencia: referencia,
                            cantidad: cantidadTotal,
                            nit: nitCliente,
                            confirmacion: confirmacion
                        });
                    }
                }
            });
        }
        
        // Procesar anexos PROMO
        if (itemData2.anexos && itemData2.anexos.length > 0) {
            const anexosPromo = itemData2.anexos.filter(anexo => 
                anexo.TIPO && anexo.TIPO.toUpperCase() === "PROMO"
            );
            
            const anexosAgrupados = {};
            
            anexosPromo.forEach(anexo => {
                const ref = anexo.DOCUMENTO || referencia;
                if (!anexosAgrupados[ref]) {
                    anexosAgrupados[ref] = {
                        cantidad: 0,
                        anexo: anexo
                    };
                }
                anexosAgrupados[ref].cantidad += parseInt(anexo.CANTIDAD) || 0;
            });
            
            Object.values(anexosAgrupados).forEach(item => {
                const anexo = item.anexo;
                const nombreCliente = this.getNombreCliente(anexo.TIPO);
                const nitCliente = this.getNitCliente(anexo.TIPO);
                
                const confirmacion = this.obtenerConfirmacion(
                    datosSoportes, 
                    documento,
                    lote, 
                    referencia, 
                    String(item.cantidad), 
                    nitCliente
                );
                
                datosRelacionados.push({
                    estado: "PROMO",
                    factura: "",
                    fecha: "",
                    lote: lote,
                    proovedor: itemData2.proveedor,
                    cliente: nombreCliente,
                    valorBruto: "",
                    referencia: referencia,
                    cantidad: item.cantidad,
                    nit: nitCliente,
                    confirmacion: confirmacion
                });
            });
        }
        
        return datosRelacionados.length > 0 ? datosRelacionados : null;
    }

    procesarDatosRecSinFactura(documento, filaRec, datosGlobalesPorLote, datosSoportes) {
        const lote = filaRec[2];
        const referencia = filaRec[1] || '';
        
        if (datosGlobalesPorLote[lote] && datosGlobalesPorLote[lote].length > 0) {
            return datosGlobalesPorLote[lote].map(item => {
                const confirmacion = this.obtenerConfirmacion(
                    datosSoportes, 
                    documento, 
                    lote, 
                    item.referencia || '', 
                    String(item.cantidad || ''), 
                    item.nit || ''
                );
                
                return {
                    ...item,
                    confirmacion: confirmacion
                };
            });
        }
        
        return null;
    }

    async obtenerDatosDeData2() {
        const values = await this.fetchSheetData(SPREADSHEET_IDS_SF.DATA2, 'DATA2!S:S');
        const datosFiltrados = [];

        for (let i = 0; i < values.length; i++) {
            const cellValue = values[i][0];
            try {
                const data = JSON.parse(cellValue);
                if (data.TIPO === "FULL") {
                    datosFiltrados.push({
                        documento: data.A.toString(),
                        referencia: data.REFERENCIA,
                        lote: data.LOTE.toString(),
                        descripcion: data.DESCRIPCIÓN,
                        cantidad: data.CANTIDAD,
                        proveedor: data.PROVEEDOR,
                        anexos: data.ANEXOS || [],
                        hr: data.HR || [],
                        tipo: data.TIPO
                    });
                }
            } catch (e) {
                // Ignorar celdas que no son JSON válido
            }
        }

        return datosFiltrados;
    }

    async obtenerDatosDeDataConSumas() {
        const values = await this.fetchSheetData(SPREADSHEET_IDS_SF.DATA, 'DATA!C:C');
        const datosPorDocumento = {};

        for (let i = 0; i < values.length; i++) {
            const cellValue = values[i][0];
            try {
                const data = JSON.parse(cellValue);
                const documento = data.Documento;
                datosPorDocumento[documento] = {};

                for (const [clienteKey, clienteData] of Object.entries(data.Clientes)) {
                    let cantidadTotal = 0;
                    
                    if (clienteData.distribucion && Array.isArray(clienteData.distribucion)) {
                        cantidadTotal = clienteData.distribucion.reduce((sum, item) => {
                            return sum + (parseInt(item.cantidad) || 0);
                        }, 0);
                    }
                    
                    datosPorDocumento[documento][clienteKey] = {
                        id: clienteData.id,
                        cantidadTotal: cantidadTotal,
                        porcentaje: clienteData.porcentaje || ''
                    };
                }
            } catch (e) {
                // Ignorar celdas que no son JSON válido
            }
        }

        return datosPorDocumento;
    }

    async obtenerDatosRec() {
        const values = await this.fetchSheetData(SPREADSHEET_IDS_SF.REC, 'DataBase!A2:AB');
        
        return values
            .filter(row => {
                const columnaG = row[6] ? row[6].trim() : '';
                const columnaAB = row[27] ? row[27].trim().toUpperCase() : '';
                return columnaG !== '' && columnaAB === 'FULL';
            })
            .map(row => {
                return [
                    row[0] || '',
                    row[6] || '',
                    row[8] || ''
                ];
            });
    }

    async obtenerDatosSoportes() {
        const values = await this.fetchSheetData(SPREADSHEET_IDS_SF.SOPORTES, 'SOPORTES!A:G');
        const soportesMap = {};

        for (let i = 1; i < values.length; i++) {
            const row = values[i];
            if (row.length >= 7) {
                const documento = String(row[1] || '').trim();
                const lote = String(row[2] || '').trim();
                const referencia = String(row[3] || '').trim();
                const cantidad = String(row[4] || '').trim();
                const factura = row[5] || '';
                const nit = String(row[6] || '').trim();
                
                const clave = `${documento}_${lote}_${referencia}_${cantidad}_${nit}`;
                soportesMap[clave] = {
                    factura: factura,
                    confirmado: !!factura && factura.trim() !== '',
                    timestamp: new Date().toISOString()
                };
            }
        }

        return soportesMap;
    }

    async obtenerDatosGlobales() {
        const values = await this.fetchSheetData(SPREADSHEET_IDS_SF.REC, 'DataBase!A:HR');
        if (!values) return [];

        const resultado = [];
        const clienteTipoMap = {
            "ESTEBAN": { nombre: "ZULUAGA GOMEZ RUBEN ESTEBAN", nit: "1007348825" },
            "JESUS": { nombre: "ARISTIZABAL LOPEZ JESUS MARIA", nit: "70825517" },
            "ALEX": { nombre: "QUINTERO ORTIZ JOSE ALEXANDER", nit: "14838951" },
            "YAMILET": { nombre: "QUINTERO ORTIZ PATRICIA YAMILET", nit: "67006141" },
            "RUBEN": { nombre: "ZULUAGA GOMEZ RUBEN ESTEBAN", nit: "1007348825" },
            "PROMO": { nombre: "EL TEMPLO DE LA MODA SAS", nit: "805027653" },
            "MUESTRA": { nombre: "EL TEMPLO DE LA MODA SAS", nit: "805027653" },
            "PENDIENTE": { nombre: "EL TEMPLO DE LA MODA SAS", nit: "805027653" }
        };

        for (let i = 0; i < values.length; i++) {
            const fila = values[i];
            const documento = fila[0];
            const tipo = fila[27];
            const lote = fila[8] || "";
            const referencia = fila[6] || "";
            const proveedor = (fila[3] === "LINEA ANGELES") ? "TEXTILES Y CREACIONES LOS ANGELES S.A.S." : "TEXTILES Y CREACIONES EL UNIVERSO S.A.S.";

            if (documento && tipo === "FULL") {
                const grupo = {
                    documento,
                    referencia,
                    lote,
                    datosGlobal: []
                };

                for (let j = 0; j < values.length; j++) {
                    const filaRel = values[j];
                    const tipoRel = filaRel[27];
                    if (filaRel[8] === lote && tipoRel !== "FULL") {
                        let tipoCliente = tipoRel;
                        if (tipoCliente === "PENDIENTE") tipoCliente = "PENDIENTES";

                        const clienteInfo = clienteTipoMap[tipoRel];
                        if (!clienteInfo) continue;

                        const estado = tipoCliente.charAt(0).toUpperCase() + tipoCliente.slice(1).toLowerCase();

                        grupo.datosGlobal.push({
                            estado,
                            factura: "",
                            fecha: "",
                            lote,
                            proovedor: proveedor,
                            cliente: clienteInfo.nombre,
                            valorBruto: "",
                            referencia: filaRel[6] || "",
                            cantidad: filaRel[18] || "",
                            nit: clienteInfo.nit
                        });
                    }
                }

                resultado.push(grupo);
            }
        }

        return resultado;
    }

    obtenerConfirmacion(soportesMap, documento, lote, referencia, cantidad, nit) {
        documento = String(documento || '').trim();
        lote = String(lote || '').trim();
        referencia = String(referencia || '').trim();
        cantidad = String(cantidad || '').trim();
        nit = String(nit || '').trim();
        
        const clave = `${documento}_${lote}_${referencia}_${cantidad}_${nit}`;
        
        if (clave in soportesMap) {
            const soporte = soportesMap[clave];
            if (!soporte.factura || soporte.factura === '') {
                return "ENTREGADO, PENDIENTE FACTURA";
            } else {
                return "ENTREGADO";
            }
        }
        
        return "";
    }

    getNombreCliente(clienteKey) {
        const nombres = {
            'Templo': 'EL TEMPLO DE LA MODA SAS',
            'Shopping': 'EL TEMPLO DE LA MODA FRESCA SAS',
            'Esteban': 'ZULUAGA GOMEZ RUBEN ESTEBAN',
            'Ruben': 'INVERSIONES URBANA SAS',
            'Jesus': 'ARISTIZABAL LOPEZ JESUS MARIA',
            'Alex': 'QUINTERO ORTIZ JOSE ALEXANDER',
            'PROMO': 'EL TEMPLO DE LA MODA SAS',
            'MUESTRA': 'EL TEMPLO DE LA MODA SAS'
        };
        return nombres[clienteKey] || clienteKey;
    }

    getNitCliente(clienteKey) {
        const nits = {
            'Templo': '805027653',
            'Shopping': '900047252',
            'Esteban': '1007348825',
            'Ruben': '901920844',
            'Jesus': '70825517',
            'Alex': '14838951',
            'PROMO': '805027653',
            'MUESTRA': '805027653'
        };
        return nits[clienteKey] || '';
    }

    getEstadoCliente(clienteKey) {
        const estados = {
            'Templo': 'Templo',
            'Shopping': 'Shopping',
            'Esteban': 'Esteban',
            'Ruben': 'Ruben',
            'Jesus': 'Jesus',
            'Alex': 'Alex',
            'PROMO': 'PROMO',
            'MUESTRA': 'MUESTRA'
        };
        return estados[clienteKey] || clienteKey;
    }

    clearCache() {
        this.cache.clear();
    }
}

// Instancia global para datos sin factura
const sheetsSinFactura = new SheetsSinFactura();
