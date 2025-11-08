// Configuración de la API de Google Sheets
const SHEETS_API_KEY = 'AIzaSyC7hjbRc0TGLgImv8gVZg8tsOeYWgXlPcM';
const API_BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

// IDs de las hojas de cálculo
const SPREADSHEET_IDS = {
    DATA2: "133NiyjNApZGkEFs4jUvpJ9So-cSEzRVeW2FblwOCrjI",
    DATA: "1d5dCCCgiWXfM6vHu3zGGKlvK2EycJtT7Uk4JqUjDOfE",
    SIESA: "1FcQhVIKtWy4O-aGTNfA6l4C5Q4_u1LZErpj3CMglfQM",
    REC: "1esc5REq0c03nHLpGcLwZRW29yq2gZnrpbz75gCCjrqc",
    DIS: "1HajVbIqwuthx1dnc9rTXu8GIN-HoTKHggEYXWJZnhvc",
    SOPORTES: "1VaPBwgRu1QWhmsV_Qgf7cgraSxiAWRX6-wBEyUlGoJw"
};

class SheetsAPI {
    constructor() {
        this.cache = new Map();
        // Cache diferenciado por tipo de dato
        this.cacheTimeouts = {
            SIESA: 300000,      // 5 min - datos históricos, cambian poco
            SOPORTES: 60000,    // 1 min - confirmaciones activas
            DATA2: 120000,      // 2 min - datos de recepción
            DATA: 120000,       // 2 min
            REC: 180000,        // 3 min
            DIS: 180000         // 3 min
        };
    }

    /**
     * Fetch con cache inteligente
     */
    async fetchSheetData(spreadsheetId, range, cacheKey = null) {
        const key = cacheKey || `${spreadsheetId}_${range}`;
        const cached = this.cache.get(key);
        
        // Determinar timeout basado en el tipo de hoja
        const sheetType = Object.keys(SPREADSHEET_IDS).find(k => SPREADSHEET_IDS[k] === spreadsheetId);
        const timeout = this.cacheTimeouts[sheetType] || 120000;
        
        if (cached && Date.now() - cached.timestamp < timeout) {
            console.log(`✓ Cache hit: ${key}`);
            return cached.data;
        }

        try {
            const url = `${API_BASE_URL}/${spreadsheetId}/values/${range}?key=${SHEETS_API_KEY}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            const values = data.values || [];
            
            this.cache.set(key, {
                data: values,
                timestamp: Date.now()
            });
            
            console.log(`✓ Fetched: ${key} (${values.length} rows)`);
            return values;
        } catch (error) {
            console.error('Error fetching sheet data:', error);
            throw error;
        }
    }

    /**
     * Batch fetch - múltiples rangos en una sola petición
     */
    async batchFetchSheetData(spreadsheetId, ranges) {
        const cacheKeys = ranges.map(r => `${spreadsheetId}_${r}`);
        const cachedResults = [];
        const rangesToFetch = [];
        
        // Verificar cache
        ranges.forEach((range, index) => {
            const cached = this.cache.get(cacheKeys[index]);
            const sheetType = Object.keys(SPREADSHEET_IDS).find(k => SPREADSHEET_IDS[k] === spreadsheetId);
            const timeout = this.cacheTimeouts[sheetType] || 120000;
            
            if (cached && Date.now() - cached.timestamp < timeout) {
                cachedResults[index] = cached.data;
            } else {
                rangesToFetch.push({ range, index });
            }
        });

        // Si todo está en cache, retornar
        if (rangesToFetch.length === 0) {
            console.log(`✓ All data from cache (${ranges.length} ranges)`);
            return cachedResults;
        }

        // Fetch batch
        try {
            const rangesParam = rangesToFetch.map(r => `ranges=${encodeURIComponent(r.range)}`).join('&');
            const url = `${API_BASE_URL}/${spreadsheetId}/values:batchGet?${rangesParam}&key=${SHEETS_API_KEY}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Guardar en cache y combinar con resultados cacheados
            data.valueRanges.forEach((valueRange, i) => {
                const values = valueRange.values || [];
                const originalIndex = rangesToFetch[i].index;
                const cacheKey = cacheKeys[originalIndex];
                
                this.cache.set(cacheKey, {
                    data: values,
                    timestamp: Date.now()
                });
                
                cachedResults[originalIndex] = values;
            });
            
            console.log(`✓ Batch fetched: ${rangesToFetch.length} ranges`);
            return cachedResults;
        } catch (error) {
            console.error('Error in batch fetch:', error);
            throw error;
        }
    }

    /**
     * Método principal optimizado
     */
    async obtenerDatosCombinados() {
        try {
            console.time('⏱️ Total Data Fetch');
            
            // Fase 1: Fetch paralelo optimizado
            const [
                datosData2,
                datosSiesa,
                datosData,
                datosSoportes,
                datosRec,
                datosGlobales
            ] = await Promise.all([
                this.obtenerDatosDeData2Optimizado(),
                this.obtenerDatosSiesaOptimizado(),
                this.obtenerDatosDeDataConSumasOptimizado(),
                this.obtenerDatosSoportesOptimizado(),
                this.obtenerDatosRecOptimizado(),
                this.obtenerDatosGlobalesOptimizado()
            ]);

            console.timeEnd('⏱️ Total Data Fetch');
            
            // Fase 2: Crear índices para búsqueda rápida
            console.time('⏱️ Building Indexes');
            const indices = this.construirIndices(datosSiesa, datosData, datosSoportes);
            console.timeEnd('⏱️ Building Indexes');
            
            // Fase 3: Combinar datos con índices
            console.time('⏱️ Data Combination');
            const datosCombinados = await this.combinarDatosOptimizado(
                datosData2, datosSiesa, datosData, datosSoportes, datosRec, datosGlobales, indices
            );
            console.timeEnd('⏱️ Data Combination');

            return {
                success: true,
                data: datosCombinados,
                timestamp: new Date().toISOString(),
                count: datosCombinados.length,
                source: 'sheets-api-v4-optimized'
            };
        } catch (error) {
            console.error('Error en obtenerDatosCombinados:', error);
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Construir índices para búsqueda O(1)
     */
    construirIndices(datosSiesa, datosData, datosSoportes) {
        const indiceSiesaPorLote = new Map();
        const indiceDataPorDocumento = new Map();
        
        // Índice de SIESA por lote
        datosSiesa.forEach(fila => {
            const lote = String(fila[3] || '').trim();
            if (!indiceSiesaPorLote.has(lote)) {
                indiceSiesaPorLote.set(lote, []);
            }
            indiceSiesaPorLote.get(lote).push(fila);
        });
        
        // Índice de DATA por documento
        Object.entries(datosData).forEach(([doc, data]) => {
            indiceDataPorDocumento.set(doc, data);
        });
        
        return {
            siesaPorLote: indiceSiesaPorLote,
            dataPorDocumento: indiceDataPorDocumento,
            soportes: datosSoportes
        };
    }

    /**
     * DATA2 optimizado - solo columna S con rango específico
     */
    async obtenerDatosDeData2Optimizado() {
        const values = await this.fetchSheetData(SPREADSHEET_IDS.DATA2, 'DATA2!S2:S');
        const datosFiltrados = [];

        for (let i = 0; i < values.length; i++) {
            const cellValue = values[i][0];
            if (!cellValue) continue;
            
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
                // Ignorar celdas inválidas
            }
        }

        return datosFiltrados;
    }

    /**
     * DATA con sumas optimizado
     */
    async obtenerDatosDeDataConSumasOptimizado() {
        const values = await this.fetchSheetData(SPREADSHEET_IDS.DATA, 'DATA!C2:C');
        const datosPorDocumento = {};

        for (let i = 0; i < values.length; i++) {
            const cellValue = values[i][0];
            if (!cellValue) continue;
            
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
                // Ignorar celdas inválidas
            }
        }

        return datosPorDocumento;
    }

    /**
     * REC optimizado - solo columnas necesarias
     */
    async obtenerDatosRecOptimizado() {
        const values = await this.fetchSheetData(SPREADSHEET_IDS.REC, 'DataBase!A2:AB');
        
        return values
            .filter(row => {
                const columnaG = row[6] ? row[6].trim() : '';
                const columnaAB = row[27] ? row[27].trim().toUpperCase() : '';
                return columnaG !== '' && columnaAB === 'FULL';
            })
            .map(row => [
                row[0] || '',
                row[6] || '',
                row[8] || ''
            ]);
    }

    /**
     * Soportes optimizado con Map
     */
    async obtenerDatosSoportesOptimizado() {
        const values = await this.fetchSheetData(SPREADSHEET_IDS.SOPORTES, 'SOPORTES!A2:G');
        const soportesMap = new Map();

        for (let i = 0; i < values.length; i++) {
            const row = values[i];
            if (row.length >= 7) {
                const documento = String(row[1] || '').trim();
                const lote = String(row[2] || '').trim();
                const referencia = String(row[3] || '').trim();
                const cantidad = String(row[4] || '').trim();
                const factura = row[5] || '';
                const nit = String(row[6] || '').trim();
                
                const clave = `${documento}_${lote}_${referencia}_${cantidad}_${nit}`;
                soportesMap.set(clave, {
                    factura: factura,
                    confirmado: !!factura && factura.trim() !== '',
                    timestamp: new Date().toISOString()
                });
            }
        }

        return soportesMap;
    }

    /**
     * Datos globales optimizado con batch fetch
     */
    async obtenerDatosGlobalesOptimizado() {
        // Usar batch fetch para REC y DIS
        const [valuesRec, valuesDis] = await this.batchFetchSheetData(
            SPREADSHEET_IDS.REC,
            ['DataBase!A2:AB']
        ).then(async (recData) => {
            const disData = await this.fetchSheetData(SPREADSHEET_IDS.DIS, 'DIS.!A2:N');
            return [recData[0], disData];
        });

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

        // Construir mapa de cantidades DIS
        const cantidadesDIS = new Map();
        valuesDis.forEach(fila => {
            const doc = fila[8];
            if (doc) {
                cantidadesDIS.set(doc, {
                    "805027653": fila[10] || "",
                    "900047252": fila[12] || ""
                });
            }
        });

        // Construir mapa de filas por lote para búsqueda rápida
        const filasPorLote = new Map();
        valuesRec.forEach(fila => {
            const lote = fila[8];
            if (lote) {
                if (!filasPorLote.has(lote)) {
                    filasPorLote.set(lote, []);
                }
                filasPorLote.get(lote).push(fila);
            }
        });

        // Procesar documentos FULL
        valuesRec.forEach(fila => {
            const documento = fila[0];
            const tipo = fila[27];
            const lote = fila[8] || "";
            const referencia = fila[6] || "";
            const proveedor = (fila[3] === "LINEA ANGELES") 
                ? "TEXTILES Y CREACIONES LOS ANGELES S.A.S." 
                : "TEXTILES Y CREACIONES EL UNIVERSO S.A.S.";

            if (documento && tipo === "FULL") {
                const grupo = {
                    documento,
                    referencia,
                    lote,
                    datosGlobal: []
                };

                // Usar mapa en lugar de búsqueda lineal
                const filasRelacionadas = filasPorLote.get(lote) || [];
                filasRelacionadas.forEach(filaRel => {
                    const tipoRel = filaRel[27];
                    if (tipoRel !== "FULL") {
                        let tipoCliente = tipoRel === "PENDIENTE" ? "PENDIENTES" : tipoRel;
                        const clienteInfo = clienteTipoMap[tipoRel];
                        
                        if (clienteInfo) {
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
                });

                // Agregar clientes DIS
                const cantDis = cantidadesDIS.get(documento);
                if (cantDis) {
                    const clientesExtra = [
                        { nit: "805027653", nombre: "EL TEMPLO DE LA MODA SAS", estado: "Templo" },
                        { nit: "900047252", nombre: "EL TEMPLO DE LA MODA FRESCA SAS", estado: "Shopping" }
                    ];

                    clientesExtra.forEach(cliente => {
                        const cantidad = cantDis[cliente.nit];
                        if (cantidad) {
                            grupo.datosGlobal.push({
                                estado: cliente.estado,
                                factura: "",
                                fecha: "",
                                lote,
                                proovedor: proveedor,
                                cliente: cliente.nombre,
                                valorBruto: "",
                                referencia,
                                cantidad,
                                nit: cliente.nit
                            });
                        }
                    });
                }

                resultado.push(grupo);
            }
        });

        return resultado;
    }

    /**
     * SIESA optimizado con batch fetch y Map
     */
    async obtenerDatosSiesaOptimizado() {
        const [siesaValues, siesaV2Values] = await this.batchFetchSheetData(
            SPREADSHEET_IDS.SIESA,
            ['SIESA!A2:G', 'SIESA_V2!A2:D']
        );

        const clientesEspecificos = [
            { nombre: "INVERSIONES URBANA SAS", nit: "901920844" },
            { nombre: "EL TEMPLO DE LA MODA FRESCA SAS", nit: "900047252" },
            { nombre: "EL TEMPLO DE LA MODA SAS", nit: "805027653" },
            { nombre: "ARISTIZABAL LOPEZ JESUS MARIA", nit: "70825517" },
            { nombre: "QUINTERO ORTIZ JOSE ALEXANDER", nit: "14838951" },
            { nombre: "QUINTERO ORTIZ PATRICIA YAMILET", nit: "67006141" },
            { nombre: "ZULUAGA GOMEZ RUBEN ESTEBAN", nit: "1007348825" },
        ];
        
        const estadosExcluir = new Set(["Anuladas", "En elaboración"]);
        const prefijosValidos = ["017", "FEV", "029", "FVE"];
        
        const normalizarCliente = (nombreCliente) => {
            if (!nombreCliente) return nombreCliente;
            return nombreCliente
                .replace(/S\.A\.S\.?/g, 'SAS')
                .replace(/\s+/g, ' ')
                .trim();
        };
        
        const formatearFecha = (fechaStr) => {
            if (!fechaStr || typeof fechaStr !== 'string') return fechaStr;
            const partes = fechaStr.split('/');
            return partes.length === 3 ? `${partes[1]}/${partes[0]}/${partes[2]}` : fechaStr;
        };
        
        const tienePrefijoValido = (valor) => {
            if (!valor || typeof valor !== 'string') return false;
            return prefijosValidos.some(prefijo => valor.startsWith(prefijo));
        };
        
        // Crear mapa de clientes para búsqueda O(1)
        const clientesMap = new Map();
        clientesEspecificos.forEach(cliente => {
            clientesMap.set(normalizarCliente(cliente.nombre), cliente.nit);
        });
        
        // Procesar SIESA_V2 con Map
        const processedSiesaV2 = new Map();
        
        siesaV2Values.forEach(row => {
            if (row.length >= 3) {
                const key = row[0];
                const value1 = parseFloat(row[1]) || 0;
                const value2 = row[2] || '';
                const value3 = parseFloat(row[3]) || 0;
                
                if (!processedSiesaV2.has(key)) {
                    processedSiesaV2.set(key, {
                        sumValue1: value1,
                        value2Items: [value2],
                        sumValue3: value3,
                        count: 1
                    });
                } else {
                    const existing = processedSiesaV2.get(key);
                    existing.sumValue1 += value1;
                    existing.value2Items.push(value2);
                    existing.sumValue3 += value3;
                    existing.count += 1;
                }
            }
        });
        
        return siesaValues
            .filter(row => !estadosExcluir.has(row[0] || ''))
            .filter(row => tienePrefijoValido(row[1] || ''))
            .map(row => {
                if (row.length >= 7) {
                    const col6Value = row[6];
                    let selectedValue = col6Value == "5" ? (row[4] || '') : 
                                      col6Value == "3" ? (row[5] || '') : '';
                    
                    const clienteNormalizado = row[3] ? normalizarCliente(row[3]) : '';
                    const fechaFormateada = formatearFecha(row[2] || '');
                    const complementData = processedSiesaV2.get(row[1]) || { 
                        sumValue1: 0, 
                        value2Items: [], 
                        sumValue3: 0,
                        count: 0
                    };
                    
                    const value2Result = complementData.count === 0 ? '' : 
                                       complementData.count === 1 ? complementData.value2Items[0] : "RefVar";
                    
                    const nitCliente = clientesMap.get(clienteNormalizado) || '';
                    
                    return [
                        row[0],
                        row[1],
                        fechaFormateada,
                        selectedValue,
                        row[6],
                        clienteNormalizado,
                        complementData.sumValue1,
                        value2Result,
                        complementData.sumValue3,
                        nitCliente
                    ];
                }
                return null;
            })
            .filter(row => row && clientesMap.has(row[5]));
    }

    /**
     * Combinar datos optimizado con índices
     */
    async combinarDatosOptimizado(datosData2, datosSiesa, datosData, datosSoportes, datosRec, datosGlobales, indices) {
        const datosCombinados = [];
        
        // Crear mapa de datos globales por lote
        const datosGlobalesPorLote = new Map();
        datosGlobales.forEach(item => {
            datosGlobalesPorLote.set(item.lote, item.datosGlobal || []);
        });
        
        // Procesar DATA2 con índices
        datosData2.forEach(itemData2 => {
            const documento = "REC" + itemData2.documento;
            const referencia = itemData2.referencia;
            const lote = itemData2.lote;
            
            // Búsqueda O(1) en lugar de filter
            const coincidenciasSiesa = indices.siesaPorLote.get(String(lote).trim()) || [];
            
            let datosRelacionados = null;
            
            if (coincidenciasSiesa.length > 0) {
                datosRelacionados = coincidenciasSiesa.map(fila => {
                    const codProveedor = Number(fila[4]);
                    let nombreProveedor = codProveedor === 5 ? "TEXTILES Y CREACIONES EL UNIVERSO SAS" :
                                         codProveedor === 3 ? "TEXTILES Y CREACIONES LOS ANGELES SAS" : fila[4];

                    const nitCliente = fila[9] || '';
                    const referenciaItem = fila[7] || '';
                    const cantidadItem = String(fila[8] || '');
                    const confirmacion = this.obtenerConfirmacionOptimizado(datosSoportes, documento, lote, referenciaItem, cantidadItem, nitCliente);
                    
                    return {
                        estado: fila[0],
                        factura: fila[1],
                        fecha: fila[2],
                        lote: fila[3],
                        proovedor: nombreProveedor,
                        cliente: fila[5],
                        valorBruto: fila[6],
                        referencia: fila[7],
                        cantidad: fila[8],
                        nit: fila[9],
                        confirmacion: confirmacion
                    };
                });
            } else {
                datosRelacionados = [];
                
                // Búsqueda O(1) en índice de DATA
                const distribucion = indices.dataPorDocumento.get(itemData2.documento);
                
                if (distribucion) {
                    const clientesRequeridos = ['Templo', 'Shopping', 'Esteban', 'Ruben', 'Jesus', 'Alex', 'Yamilet'];
                    
                    clientesRequeridos.forEach(clienteKey => {
                        if (distribucion[clienteKey]) {
                            const clienteData = distribucion[clienteKey];
                            const nombreCliente = this.getNombreCliente(clienteKey);
                            const nitCliente = clienteData.id;
                            const cantidadTotal = clienteData.cantidadTotal || 0;
                            
                            if (cantidadTotal > 0) {
                                const confirmacion = this.obtenerConfirmacionOptimizado(
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
                            anexosAgrupados[ref] = { cantidad: 0, anexo: anexo };
                        }
                        anexosAgrupados[ref].cantidad += parseInt(anexo.CANTIDAD) || 0;
                    });
                    
                    Object.values(anexosAgrupados).forEach(item => {
                        const anexo = item.anexo;
                        const nombreCliente = this.getNombreCliente(anexo.TIPO);
                        const nitCliente = this.getNitCliente(anexo.TIPO);
                        
                        const confirmacion = this.obtenerConfirmacionOptimizado(
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
            }
            
            datosCombinados.push({
                documento: documento,
                referencia: referencia,
                lote: lote,
                datosSiesa: datosRelacionados || null
            });
        });
        
        // Crear Set de documentos+lotes ya procesados para búsqueda O(1)
        const documentosYaIncluidos = new Set();
        datosCombinados.forEach(item => {
            documentosYaIncluidos.add(`${item.documento}_${item.lote}`);
        });
        
        // Procesar datos de REC
        datosRec.forEach(filaRec => {
            const documento = filaRec[0];
            const referencia = filaRec[1];
            const lote = filaRec[2];
            
            // Búsqueda O(1) en Set
            if (!documentosYaIncluidos.has(`${documento}_${lote}`)) {
                // Búsqueda O(1) en índice de SIESA
                const coincidenciasSiesa = indices.siesaPorLote.get(String(lote).trim()) || [];
                
                let datosRelacionados = null;
                
                if (coincidenciasSiesa.length > 0) {
                    datosRelacionados = coincidenciasSiesa.map(fila => {
                        const codProveedor = Number(fila[4]);
                        let nombreProveedor = codProveedor === 5 ? "TEXTILES Y CREACIONES EL UNIVERSO SAS" :
                                             codProveedor === 3 ? "TEXTILES Y CREACIONES LOS ANGELES SAS" : fila[4];

                        const nitCliente = fila[9] || '';
                        const referenciaItem = fila[7] || '';
                        const cantidadItem = String(fila[8] || '');
                        const confirmacion = this.obtenerConfirmacionOptimizado(datosSoportes, documento, lote, referenciaItem, cantidadItem, nitCliente);
                        
                        return {
                            estado: fila[0],
                            factura: fila[1],
                            fecha: fila[2],
                            lote: fila[3],
                            proovedor: nombreProveedor,
                            cliente: fila[5],
                            valorBruto: fila[6],
                            referencia: fila[7],
                            cantidad: fila[8],
                            nit: fila[9],
                            confirmacion: confirmacion
                        };
                    });
                } else {
                    // Búsqueda O(1) en Map de datos globales
                    const datosGlobal = datosGlobalesPorLote.get(lote);
                    if (datosGlobal && datosGlobal.length > 0) {
                        datosRelacionados = datosGlobal.map(item => {
                            const confirmacion = this.obtenerConfirmacionOptimizado(
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
                }
                
                datosCombinados.push({
                    documento: documento,
                    referencia: referencia,
                    lote: lote,
                    datosSiesa: datosRelacionados
                });
            }
        });
        
        return datosCombinados;
    }

    /**
     * Obtener confirmación optimizado - usa Map en lugar de objeto
     */
    obtenerConfirmacionOptimizado(soportesMap, documento, lote, referencia, cantidad, nit) {
        documento = String(documento || '').trim();
        lote = String(lote || '').trim();
        referencia = String(referencia || '').trim();
        cantidad = String(cantidad || '').trim();
        nit = String(nit || '').trim();
        
        const clave = `${documento}_${lote}_${referencia}_${cantidad}_${nit}`;
        
        if (soportesMap.has(clave)) {
            const soporte = soportesMap.get(clave);
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
            'Yamilet': 'QUINTERO ORTIZ PATRICIA YAMILET',
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
            'Yamilet': '67006141',
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
            'Yamilet': 'Yamilet',
            'PROMO': 'PROMO',
            'MUESTRA': 'MUESTRA'
        };
        return estados[clienteKey] || clienteKey;
    }

    /**
     * Verificar confirmación en tiempo real (optimizado)
     */
    async verificarConfirmacion(documento, lote, referencia, cantidad, nit) {
        try {
            // Limpiar cache de soportes para obtener datos frescos
            this.cache.delete(`${SPREADSHEET_IDS.SOPORTES}_SOPORTES!A2:G`);
            const datosSoportes = await this.obtenerDatosSoportesOptimizado();
            
            const confirmacion = this.obtenerConfirmacionOptimizado(datosSoportes, documento, lote, referencia, cantidad, nit);
            return {
                confirmado: confirmacion.includes("ENTREGADO"),
                estado: confirmacion,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error verificando confirmación:', error);
            return {
                confirmado: false,
                estado: "ERROR",
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Limpiar cache
     */
    clearCache(sheetType = null) {
        if (sheetType) {
            // Limpiar solo cache de una hoja específica
            const spreadsheetId = SPREADSHEET_IDS[sheetType];
            if (spreadsheetId) {
                for (const [key] of this.cache) {
                    if (key.startsWith(spreadsheetId)) {
                        this.cache.delete(key);
                    }
                }
                console.log(`✓ Cache cleared for ${sheetType}`);
            }
        } else {
            // Limpiar todo el cache
            this.cache.clear();
            console.log('✓ All cache cleared');
        }
    }

    /**
     * Obtener estadísticas del cache
     */
    getCacheStats() {
        const stats = {
            totalEntries: this.cache.size,
            entries: []
        };

        for (const [key, value] of this.cache) {
            const age = Date.now() - value.timestamp;
            const ageMinutes = Math.floor(age / 60000);
            stats.entries.push({
                key,
                dataSize: value.data.length,
                ageMinutes,
                isExpired: age > 300000 // 5 minutos
            });
        }

        return stats;
    }

    /**
     * Pre-cargar datos en cache (útil para inicialización)
     */
    async preloadCache() {
        console.log('🚀 Preloading cache...');
        try {
            await this.obtenerDatosCombinados();
            console.log('✓ Cache preloaded successfully');
            return true;
        } catch (error) {
            console.error('Error preloading cache:', error);
            return false;
        }
    }
}

// Instancia global
const sheetsAPI = new SheetsAPI();

// Exportar para uso en módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SheetsAPI, sheetsAPI };
}
