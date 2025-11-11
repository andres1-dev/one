// Configuración de la API de Google Sheets (variables globales)
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
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutos de cache
        this.concurrentRequests = 3; // Límite de requests concurrentes
    }

    // ✅ MANTENER COMPATIBILIDAD: Función legacy para sheets-sin-factura.js
    async obtenerDatosCombinados() {
        console.warn('⚠️ obtenerDatosCombinados() está deprecado. Usar obtenerDatosCompletos()');
        return await this.obtenerDatosCompletos();
    }

    // ✅ FUNCIÓN OPTIMIZADA: Fetch con cache, retry y timeout
    async fetchSheetData(spreadsheetId, range, useCache = true) {
        const cacheKey = `${spreadsheetId}_${range}`;
        
        // Verificar cache
        if (useCache && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                console.log(`📦 Cache hit: ${cacheKey}`);
                return cached.data;
            }
        }

        try {
            const url = `${API_BASE_URL}/${spreadsheetId}/values/${range}?key=${SHEETS_API_KEY}`;
            
            const response = await Promise.race([
                fetch(url),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout después de 30s')), 30000)
                )
            ]);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            const values = data.values || [];
            
            // Guardar en cache
            if (useCache) {
                this.cache.set(cacheKey, {
                    data: values,
                    timestamp: Date.now()
                });
            }
            
            return values;
        } catch (error) {
            console.error(`❌ Error fetching ${spreadsheetId}/${range}:`, error);
            throw error;
        }
    }

    // ✅ FUNCIÓN OPTIMIZADA: Carga masiva paralela con límite de concurrencia
    async fetchMultipleSheets(requests) {
        const results = [];
        
        // Procesar en lotes para no saturar la API
        for (let i = 0; i < requests.length; i += this.concurrentRequests) {
            const batch = requests.slice(i, i + this.concurrentRequests);
            const batchPromises = batch.map(async ({ id, range, cache }) => {
                try {
                    const data = await this.fetchSheetData(id, range, cache);
                    return { success: true, data, id, range };
                } catch (error) {
                    return { success: false, error: error.message, id, range };
                }
            });
            
            const batchResults = await Promise.allSettled(batchPromises);
            results.push(...batchResults.map(result => result.value));
        }
        
        return results;
    }

    // ✅ FUNCIÓN PRINCIPAL OPTIMIZADA: Carga todos los datos
    async obtenerDatosCompletos() {
        console.time('🚀 Carga_Completa_Optimizada');
        
        try {
            // 1. CARGAR TODOS LOS DATOS EN PARALELO
            const allData = await this.fetchMultipleSheets([
                { id: SPREADSHEET_IDS.DATA2, range: 'DATA2!S:S', cache: true },
                { id: SPREADSHEET_IDS.SIESA, range: 'SIESA!A:G', cache: true },
                { id: SPREADSHEET_IDS.SIESA, range: 'SIESA_V2!A:D', cache: true },
                { id: SPREADSHEET_IDS.DATA, range: 'DATA!C:C', cache: true },
                { id: SPREADSHEET_IDS.REC, range: 'DataBase!A2:AB', cache: true },
                { id: SPREADSHEET_IDS.REC, range: 'DataBase!A:HR', cache: true },
                { id: SPREADSHEET_IDS.DIS, range: 'DIS.!A:N', cache: true },
                { id: SPREADSHEET_IDS.SOPORTES, range: 'SOPORTES!A:G', cache: true }
            ]);

            // 2. VERIFICAR ERRORES
            const errors = allData.filter(item => !item.success);
            if (errors.length > 0) {
                console.warn('⚠️ Algunas hojas tuvieron errores:', errors);
            }

            // 3. PROCESAR DATOS EN PARALELO
            const processedData = await this.procesarDatosEnParalelo(allData);
            
            console.timeEnd('🚀 Carga_Completa_Optimizada');
            
            return {
                success: true,
                data: processedData.datosCombinados,
                estadisticas: processedData.estadisticas,
                timestamp: new Date().toISOString(),
                count: processedData.datosCombinados.length,
                source: 'datos-completos-optimizados'
            };

        } catch (error) {
            console.error('❌ Error crítico en carga completa:', error);
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // ✅ PROCESAMIENTO PARALELO OPTIMIZADO
    async procesarDatosEnParalelo(allData) {
        const dataMap = {};
        allData.forEach(item => {
            if (item.success) {
                dataMap[`${item.id}_${item.range}`] = item.data;
            }
        });

        // Procesar en paralelo
        const [
            datosData2,
            datosSiesaCombinados,
            datosData,
            datosRec,
            datosGlobales,
            datosSoportes
        ] = await Promise.all([
            this.procesarData2(dataMap[`${SPREADSHEET_IDS.DATA2}_DATA2!S:S`]),
            this.procesarSiesa(
                dataMap[`${SPREADSHEET_IDS.SIESA}_SIESA!A:G`],
                dataMap[`${SPREADSHEET_IDS.SIESA}_SIESA_V2!A:D`]
            ),
            this.procesarData(dataMap[`${SPREADSHEET_IDS.DATA}_DATA!C:C`]),
            this.procesarRec(dataMap[`${SPREADSHEET_IDS.REC}_DataBase!A2:AB`]),
            this.procesarGlobales(
                dataMap[`${SPREADSHEET_IDS.REC}_DataBase!A:HR`],
                dataMap[`${SPREADSHEET_IDS.DIS}_DIS.!A:N`]
            ),
            this.procesarSoportes(dataMap[`${SPREADSHEET_IDS.SOPORTES}_SOPORTES!A:G`])
        ]);

        // Combinar datos
        return this.combinarDatosOptimizado(
            datosData2, datosSiesaCombinados, datosData, datosSoportes, datosRec, datosGlobales
        );
    }

    // ✅ PROCESADORES ESPECÍFICOS OPTIMIZADOS

    async procesarData2(data2Values) {
        if (!data2Values) return [];
        
        const datosFiltrados = [];
        const batchSize = 100; // Procesar por lotes

        for (let i = 0; i < data2Values.length; i += batchSize) {
            const batch = data2Values.slice(i, i + batchSize);
            
            batch.forEach(cellValue => {
                if (!cellValue[0]) return;
                
                try {
                    const data = JSON.parse(cellValue[0]);
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
                            tipo: data.TIPO,
                            rawData: data // Mantener datos originales para debug
                        });
                    }
                } catch (e) {
                    // Ignorar JSON inválido
                }
            });
        }

        console.log(`✅ DATA2 procesado: ${datosFiltrados.length} registros`);
        return datosFiltrados;
    }

    async procesarSiesa(siesaValues, siesaV2Values) {
        if (!siesaValues || !siesaV2Values) return [];

        const clientesEspecificos = new Map([
            ["INVERSIONES URBANA SAS", "901920844"],
            ["EL TEMPLO DE LA MODA FRESCA SAS", "900047252"],
            ["EL TEMPLO DE LA MODA SAS", "805027653"],
            ["ARISTIZABAL LOPEZ JESUS MARIA", "70825517"],
            ["QUINTERO ORTIZ JOSE ALEXANDER", "14838951"],
            ["QUINTERO ORTIZ PATRICIA YAMILET", "67006141"],
            ["ZULUAGA GOMEZ RUBEN ESTEBAN", "1007348825"]
        ]);

        const estadosExcluir = new Set(["Anuladas", "En elaboración"]);
        const prefijosValidos = new Set(["017", "FEV", "029", "FVE"]);

        // Procesar SIESA_V2 primero (más eficiente con Map)
        const siesaV2Map = new Map();
        siesaV2Values.forEach(row => {
            if (row.length >= 3) {
                const key = row[0];
                if (!siesaV2Map.has(key)) {
                    siesaV2Map.set(key, {
                        sumValue1: parseFloat(row[1]) || 0,
                        value2Items: [row[2] || ''],
                        sumValue3: parseFloat(row[3]) || 0,
                        count: 1
                    });
                } else {
                    const existing = siesaV2Map.get(key);
                    existing.sumValue1 += parseFloat(row[1]) || 0;
                    existing.value2Items.push(row[2] || '');
                    existing.sumValue3 += parseFloat(row[3]) || 0;
                    existing.count += 1;
                }
            }
        });

        // Procesar SIESA principal
        const datosSiesa = siesaValues
            .filter(row => {
                const estado = row[0] || '';
                return !estadosExcluir.has(estado);
            })
            .filter(row => {
                const codigo = row[1] || '';
                return Array.from(prefijosValidos).some(prefijo => codigo.startsWith(prefijo));
            })
            .map(row => {
                const normalizarCliente = (nombre) => 
                    nombre ? nombre.replace(/S\.A\.S\.?/g, 'SAS').replace(/\s+/g, ' ').trim() : '';
                
                const formatearFecha = (fechaStr) => {
                    if (!fechaStr || typeof fechaStr !== 'string') return fechaStr;
                    const partes = fechaStr.split('/');
                    return partes.length === 3 ? `${partes[1]}/${partes[0]}/${partes[2]}` : fechaStr;
                };

                if (row.length >= 7) {
                    const col6Value = row[6];
                    let selectedValue = '';
                    
                    if (col6Value == "5") selectedValue = row[4] || '';
                    else if (col6Value == "3") selectedValue = row[5] || '';
                    
                    const clienteNormalizado = normalizarCliente(row[3]);
                    const complementData = siesaV2Map.get(row[1]) || { 
                        sumValue1: 0, value2Items: [], sumValue3: 0, count: 0 
                    };
                    
                    let value2Result = '';
                    if (complementData.count === 1) {
                        value2Result = complementData.value2Items[0];
                    } else if (complementData.count > 1) {
                        value2Result = "RefVar";
                    }
                    
                    const nitCliente = clientesEspecificos.get(clienteNormalizado) || '';

                    return [
                        row[0], row[1], formatearFecha(row[2]), selectedValue, row[6],
                        clienteNormalizado, complementData.sumValue1, value2Result,
                        complementData.sumValue3, nitCliente
                    ];
                }
                
                return null;
            })
            .filter(row => row !== null && row[5] && clientesEspecificos.has(row[5]));

        console.log(`✅ SIESA procesado: ${datosSiesa.length} registros`);
        return datosSiesa;
    }

    async procesarData(dataValues) {
        if (!dataValues) return {};
        
        const datosPorDocumento = {};
        dataValues.forEach(cellValue => {
            if (!cellValue[0]) return;
            
            try {
                const data = JSON.parse(cellValue[0]);
                const documento = data.Documento;
                datosPorDocumento[documento] = {};

                for (const [clienteKey, clienteData] of Object.entries(data.Clientes || {})) {
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
                // Ignorar JSON inválido
            }
        });

        console.log(`✅ DATA procesado: ${Object.keys(datosPorDocumento).length} documentos`);
        return datosPorDocumento;
    }

    async procesarRec(recValues) {
        if (!recValues) return [];
        
        const datosRec = recValues
            .filter(row => {
                const columnaG = row[6] ? row[6].trim() : '';
                const columnaAB = row[27] ? row[27].trim().toUpperCase() : '';
                return columnaG !== '' && columnaAB === 'FULL';
            })
            .map(row => [row[0] || '', row[6] || '', row[8] || '']);

        console.log(`✅ REC procesado: ${datosRec.length} registros`);
        return datosRec;
    }

    async procesarGlobales(globalValues, disValues) {
        if (!globalValues) return [];

        const clienteTipoMap = new Map([
            ["ESTEBAN", { nombre: "ZULUAGA GOMEZ RUBEN ESTEBAN", nit: "1007348825" }],
            ["JESUS", { nombre: "ARISTIZABAL LOPEZ JESUS MARIA", nit: "70825517" }],
            ["ALEX", { nombre: "QUINTERO ORTIZ JOSE ALEXANDER", nit: "14838951" }],
            ["YAMILET", { nombre: "QUINTERO ORTIZ PATRICIA YAMILET", nit: "67006141" }],
            ["RUBEN", { nombre: "ZULUAGA GOMEZ RUBEN ESTEBAN", nit: "1007348825" }],
            ["PROMO", { nombre: "EL TEMPLO DE LA MODA SAS", nit: "805027653" }],
            ["MUESTRA", { nombre: "EL TEMPLO DE LA MODA SAS", nit: "805027653" }],
            ["PENDIENTE", { nombre: "EL TEMPLO DE LA MODA SAS", nit: "805027653" }]
        ]);

        // Procesar DIS
        const cantidadesDIS = new Map();
        if (disValues) {
            disValues.forEach(fila => {
                const doc = fila[8];
                if (doc) {
                    cantidadesDIS.set(doc, {
                        "805027653": fila[10] || "",
                        "900047252": fila[12] || ""
                    });
                }
            });
        }

        const resultado = [];
        const loteMap = new Map();

        // Primera pasada: agrupar por lote
        globalValues.forEach((fila, index) => {
            const documento = fila[0];
            const tipo = fila[27];
            const lote = fila[8] || "";
            
            if (documento && tipo === "FULL" && lote) {
                if (!loteMap.has(lote)) {
                    loteMap.set(lote, {
                        documento,
                        referencia: fila[6] || "",
                        lote,
                        proveedor: (fila[3] === "LINEA ANGELES") ? 
                            "TEXTILES Y CREACIONES LOS ANGELES S.A.S." : 
                            "TEXTILES Y CREACIONES EL UNIVERSO S.A.S.",
                        datosGlobal: []
                    });
                }
            }
        });

        // Segunda pasada: procesar datos globales
        globalValues.forEach(fila => {
            const tipoRel = fila[27];
            const lote = fila[8] || "";
            
            if (tipoRel !== "FULL" && loteMap.has(lote)) {
                const grupo = loteMap.get(lote);
                let tipoCliente = tipoRel;
                if (tipoCliente === "PENDIENTE") tipoCliente = "PENDIENTES";

                const clienteInfo = clienteTipoMap.get(tipoRel);
                if (!clienteInfo) return;

                const estado = tipoCliente.charAt(0).toUpperCase() + tipoCliente.slice(1).toLowerCase();

                grupo.datosGlobal.push({
                    estado,
                    factura: "",
                    fecha: "",
                    lote,
                    proovedor: grupo.proveedor,
                    cliente: clienteInfo.nombre,
                    valorBruto: "",
                    referencia: fila[6] || "",
                    cantidad: fila[18] || "",
                    nit: clienteInfo.nit
                });
            }
        });

        // Tercera pasada: agregar datos DIS y construir resultado
        loteMap.forEach((grupo, lote) => {
            if (cantidadesDIS.has(grupo.documento)) {
                const disData = cantidadesDIS.get(grupo.documento);
                const clientesExtra = [
                    { nit: "805027653", nombre: "EL TEMPLO DE LA MODA SAS", estado: "Templo" },
                    { nit: "900047252", nombre: "EL TEMPLO DE LA MODA FRESCA SAS", estado: "Shopping" }
                ];

                clientesExtra.forEach(cliente => {
                    const cantidad = disData[cliente.nit];
                    if (cantidad) {
                        grupo.datosGlobal.push({
                            estado: cliente.estado,
                            factura: "",
                            fecha: "",
                            lote,
                            proovedor: grupo.proveedor,
                            cliente: cliente.nombre,
                            valorBruto: "",
                            referencia: grupo.referencia,
                            cantidad,
                            nit: cliente.nit
                        });
                    }
                });
            }

            resultado.push(grupo);
        });

        console.log(`✅ GLOBALES procesado: ${resultado.length} lotes`);
        return resultado;
    }

    async procesarSoportes(soportesValues) {
        if (!soportesValues) return {};
        
        const soportesMap = {};
        // Saltar header (fila 0)
        for (let i = 1; i < soportesValues.length; i++) {
            const row = soportesValues[i];
            if (row.length >= 7) {
                const documento = String(row[1] || '').trim();
                const lote = String(row[2] || '').trim();
                const referencia = String(row[3] || '').trim();
                const cantidad = String(row[4] || '').trim();
                const factura = row[5] || '';
                const nit = String(row[6] || '').trim();
                
                const clave = `${documento}_${lote}_${referencia}_${cantidad}_${nit}`;
                soportesMap[clave] = factura;
            }
        }

        console.log(`✅ SOPORTES procesado: ${Object.keys(soportesMap).length} registros`);
        return soportesMap;
    }

    // ✅ COMBINACIÓN OPTIMIZADA DE DATOS
    
    // ✅ FUNCIONES AUXILIARES OPTIMIZADAS
// En sheets-api.js, modifica la función combinarDatosOptimizado:

combinarDatosOptimizado(datosData2, datosSiesa, datosData, datosSoportes, datosRec, datosGlobales) {
    const datosCombinados = [];
    const loteMap = new Map();
    let estadisticas = {
        data2: 0,
        rec: 0,
        conFactura: 0,
        sinFactura: 0,
        data2_conFactura: 0,
        data2_sinFactura: 0,
        rec_conFactura: 0,
        rec_sinFactura: 0
    };

    // 1. PROCESAR DATA2 - GARANTIZAR DATOS SIN FACTURA
    datosData2.forEach(itemData2 => {
        const documento = "REC" + itemData2.documento;
        const referencia = itemData2.referencia;
        const lote = itemData2.lote;
        const clave = `${documento}_${lote}`;

        if (loteMap.has(clave)) return;

        const coincidenciasSiesa = datosSiesa.filter(filaSiesa => 
            String(filaSiesa[3]).trim() === String(lote).trim()
        );

        let datosRelacionados = [];

        if (coincidenciasSiesa.length > 0) {
            // ✅ TIENE FACTURAS EN SIESA - PROCESAR NORMAL
            datosRelacionados = coincidenciasSiesa.map(fila => {
                estadisticas.conFactura++;
                estadisticas.data2_conFactura++;
                return this.crearRegistroSiesa(fila, datosSoportes, documento, lote, 'DATA2');
            });
        } else {
            // ✅ NO TIENE FACTURAS EN SIESA - PROCESAR DISTRIBUCIÓN (ENTREGAS SIN FACTURA)
            datosRelacionados = this.procesarDistribucionData2(
                documento, itemData2, datosData, datosSoportes
            );
            
            if (datosRelacionados.length > 0) {
                estadisticas.sinFactura += datosRelacionados.length;
                estadisticas.data2_sinFactura += datosRelacionados.length;
                console.log(`📦 DATA2 sin factura: ${documento} - ${datosRelacionados.length} distribuciones`);
            } else {
                console.log(`⚠️ DATA2 sin distribución: ${documento}`);
            }
        }

        if (datosRelacionados.length > 0) {
            datosCombinados.push({
                documento,
                referencia,
                lote,
                datosSiesa: datosRelacionados,
                fuente: 'DATA2'
            });
            loteMap.set(clave, true);
            estadisticas.data2++;
        }
    });

    // 2. PROCESAR REC - GARANTIZAR DATOS SIN FACTURA
    const datosGlobalesPorLote = new Map();
    datosGlobales.forEach(item => {
        datosGlobalesPorLote.set(item.lote, item.datosGlobal || []);
    });

    datosRec.forEach(filaRec => {
        const documento = filaRec[0];
        const referencia = filaRec[1];
        const lote = filaRec[2];
        const clave = `${documento}_${lote}`;

        if (loteMap.has(clave)) return;

        const coincidenciasSiesa = datosSiesa.filter(filaSiesa => 
            String(filaSiesa[3]).trim() === String(lote).trim()
        );

        let datosRelacionados = [];

        if (coincidenciasSiesa.length > 0) {
            // ✅ TIENE FACTURAS EN SIESA
            datosRelacionados = coincidenciasSiesa.map(fila => {
                estadisticas.conFactura++;
                estadisticas.rec_conFactura++;
                return this.crearRegistroSiesa(fila, datosSoportes, documento, lote, 'REC');
            });
        } else if (datosGlobalesPorLote.has(lote)) {
            // ✅ USAR DATOS GLOBALES (ENTREGAS SIN FACTURA)
            const datosGlobal = datosGlobalesPorLote.get(lote);
            datosRelacionados = datosGlobal.map(item => {
                const confirmacion = this.obtenerConfirmacion(
                    datosSoportes, documento, lote, item.referencia, item.cantidad, item.nit
                );
                estadisticas.sinFactura++;
                estadisticas.rec_sinFactura++;
                return { 
                    ...item, 
                    confirmacion, 
                    fuente: 'REC',
                    // Asegurar que tenga todos los campos necesarios
                    estado: item.estado || '',
                    factura: item.factura || '',
                    fecha: item.fecha || '',
                    proovedor: item.proovedor || '',
                    cliente: item.cliente || '',
                    valorBruto: item.valorBruto || '',
                    cantidad: item.cantidad || '',
                    nit: item.nit || ''
                };
            });
            console.log(`📦 REC sin factura: ${documento} - ${datosRelacionados.length} registros globales`);
        } else {
            console.log(`⚠️ REC sin datos: ${documento} - lote ${lote}`);
        }

        if (datosRelacionados.length > 0) {
            datosCombinados.push({
                documento,
                referencia,
                lote,
                datosSiesa: datosRelacionados,
                fuente: 'REC'
            });
            loteMap.set(clave, true);
            estadisticas.rec++;
        }
    });

    console.log(`📊 Estadísticas finales:`, estadisticas);
    console.log(`✅ Datos combinados: ${datosCombinados.length} registros totales`);
    
    // Log detallado de registros sin factura
    const totalSinFactura = datosCombinados.filter(item => 
        item.datosSiesa.some(siesa => !siesa.factura || siesa.factura.trim() === '')
    ).length;
    console.log(`📦 Registros con entregas sin factura: ${totalSinFactura}`);

    return { datosCombinados, estadisticas };
}
    
    crearRegistroSiesa(fila, datosSoportes, documento, lote, fuente) {
        const codProveedor = Number(fila[4]);
        let nombreProveedor = fila[4];
        
        if (codProveedor === 5) {
            nombreProveedor = "TEXTILES Y CREACIONES EL UNIVERSO SAS";
        } else if (codProveedor === 3) {
            nombreProveedor = "TEXTILES Y CREACIONES LOS ANGELES SAS";
        }

        const nitCliente = fila[9] || '';
        const referenciaItem = fila[7] || '';
        const cantidadItem = String(fila[8] || '');
        const confirmacion = this.obtenerConfirmacion(
            datosSoportes, documento, lote, referenciaItem, cantidadItem, nitCliente
        );

        return {
            estado: fila[0],
            factura: fila[1],
            fecha: fila[2],
            lote: fila[3],
            proovedor: nombreProveedor,
            cliente: fila[5],
            valorBruto: fila[6],
            referencia: referenciaItem,
            cantidad: cantidadItem,
            nit: nitCliente,
            confirmacion: confirmacion,
            fuente: fuente
        };
    }

    procesarDistribucionData2(documento, itemData2, datosData, datosSoportes) {
        const datosRelacionados = [];
        const referencia = itemData2.referencia;
        const lote = itemData2.lote;

        // Procesar distribución principal
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
                            datosSoportes, documento, lote, referencia, String(cantidadTotal), nitCliente
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
                            confirmacion: confirmacion,
                            fuente: 'DATA2'
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
            
            const anexosAgrupados = new Map();
            
            anexosPromo.forEach(anexo => {
                const ref = anexo.DOCUMENTO || referencia;
                if (!anexosAgrupados.has(ref)) {
                    anexosAgrupados.set(ref, {
                        cantidad: 0,
                        anexo: anexo
                    });
                }
                const existing = anexosAgrupados.get(ref);
                existing.cantidad += parseInt(anexo.CANTIDAD) || 0;
            });
            
            anexosAgrupados.forEach(item => {
                const anexo = item.anexo;
                const nombreCliente = this.getNombreCliente(anexo.TIPO);
                const nitCliente = this.getNitCliente(anexo.TIPO);
                
                const confirmacion = this.obtenerConfirmacion(
                    datosSoportes, documento, lote, referencia, String(item.cantidad), nitCliente
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
                    confirmacion: confirmacion,
                    fuente: 'DATA2'
                });
            });
        }
        
        return datosRelacionados;
    }

    obtenerConfirmacion(soportesMap, documento, lote, referencia, cantidad, nit) {
        const clave = `${String(documento).trim()}_${String(lote).trim()}_${String(referencia).trim()}_${String(cantidad).trim()}_${String(nit).trim()}`;
        
        if (clave in soportesMap) {
            if (!soportesMap[clave] || soportesMap[clave] === '') {
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

    // ✅ MÉTODOS DE UTILIDAD
    clearCache() {
        this.cache.clear();
        console.log('🧹 Cache limpiado');
    }

    getCacheStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }

    // ✅ MÉTODO PARA VERIFICACIÓN EN TIEMPO REAL
    async verificarConfirmacion(documento, lote, referencia, cantidad, nit) {
        try {
            const datosSoportes = await this.procesarSoportes(
                await this.fetchSheetData(SPREADSHEET_IDS.SOPORTES, 'SOPORTES!A:G', false)
            );
            const confirmacion = this.obtenerConfirmacion(datosSoportes, documento, lote, referencia, cantidad, nit);
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
}

// Instancia global optimizada
const sheetsAPI = new SheetsAPI();

// Funciones globales para debug
window.debugSheetsAPI = function() {
    console.log('🔧 Debug SheetsAPI:');
    console.log('Cache Stats:', sheetsAPI.getCacheStats());
    console.log('Config:', {
        concurrentRequests: sheetsAPI.concurrentRequests,
        cacheTimeout: sheetsAPI.cacheTimeout
    });
};

window.forceRefreshData = function() {
    sheetsAPI.clearCache();
    console.log('🔄 Forzando refresco de datos...');
    // Aquí puedes llamar a la función de carga de datos de tu app
};
