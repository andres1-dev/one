// Configuración de la API de Google Sheets (variables globales)
const SHEETS_API_KEY = 'AIzaSyC7hjbRc0TGLgImv8gVZg8tsOeYWgXlPcM';
const API_BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

// IDs de las hojas de cálculo (TODAS las fuentes)
const SPREADSHEET_IDS = {
    DATA2: "133NiyjNApZGkEFs4jUvpJ9So-cSEzRVeW2FblwOCrjI",
    SIESA: "1FcQhVIKtWy4O-aGTNfA6l4C5Q4_u1LZErpj3CMglfQM",
    SOPORTES: "1VaPBwgRu1QWhmsV_Qgf7cgraSxiAWRX6-wBEyUlGoJw",
    DATA: "1d5dCCCgiWXfM6vHu3zGGKlvK2EycJtT7Uk4JqUjDOfE",
    REC: "1esc5REq0c03nHLpGcLwZRW29yq2gZnrpbz75gCCjrqc",
    DIS: "1HajVbIqwuthx1dnc9rTXu8GIN-HoTKHggEYXWJZnhvc"
};

class SheetsAPI {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 0;
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

    // Obtener SOLO datos con facturas (compatibilidad con versión anterior)
    async obtenerDatosCombinados() {
        try {
            console.time('Carga_Facturas');
            console.log('🚀 Cargando SOLO datos con facturas...');
            
            const [
                datosData2,
                datosSiesa,
                datosSoportes
            ] = await Promise.all([
                this.obtenerDatosDeData2(),
                this.obtenerDatosSiesa(),
                this.obtenerDatosSoportes()
            ]);

            console.timeEnd('Carga_Facturas');
            
            // Combinar SOLO datos con facturas
            const datosCombinados = this.combinarDatosFacturas(datosData2, datosSiesa, datosSoportes);

            console.log(`✅ Carga completada: ${datosCombinados.length} registros con facturas`);

            return {
                success: true,
                data: datosCombinados,
                timestamp: new Date().toISOString(),
                count: datosCombinados.length,
                source: 'solo-facturas'
            };
        } catch (error) {
            console.error('Error cargando facturas:', error);
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // Obtener TODOS los datos unificados (DATA2 + REC)
    async obtenerDatosCompletos() {
        try {
            console.time('Carga_Completa');
            console.log('🚀 Cargando TODOS los datos (DATA2 + REC)...');
            
            const [
                datosData2,
                datosSiesa,
                datosSoportes,
                datosData,
                datosRec,
                datosGlobales
            ] = await Promise.all([
                this.obtenerDatosDeData2(),
                this.obtenerDatosSiesa(),
                this.obtenerDatosSoportes(),
                this.obtenerDatosDeDataConSumas(),
                this.obtenerDatosRec(),
                this.obtenerDatosGlobales()
            ]);

            console.timeEnd('Carga_Completa');
            
            // Combinar TODOS los datos
            const datosCombinados = this.combinarTodosLosDatos(
                datosData2, datosSiesa, datosSoportes, datosData, datosRec, datosGlobales
            );

            console.log(`✅ Carga completa: ${datosCombinados.length} registros totales`);

            return {
                success: true,
                data: datosCombinados,
                timestamp: new Date().toISOString(),
                count: datosCombinados.length,
                source: 'datos-completos'
            };
        } catch (error) {
            console.error('Error cargando datos completos:', error);
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // Combinar SOLO datos que tienen facturas (para compatibilidad)
    combinarDatosFacturas(datosData2, datosSiesa, datosSoportes) {
        const datosCombinados = [];
        
        console.log('🔄 Combinando datos con facturas...');
        
        // Procesar solo datosData2 que tienen coincidencias en SIESA (facturas)
        datosData2.forEach(itemData2 => {
            const documento = "REC" + itemData2.documento;
            const referencia = itemData2.referencia;
            const lote = itemData2.lote;
            
            // Buscar coincidencias en SIESA (facturas)
            const coincidenciasSiesa = datosSiesa.filter(filaSiesa => {
                const codigoSiesa = filaSiesa[3];
                return String(codigoSiesa).trim() === String(lote).trim();
            });
            
            // SOLO incluir si tiene facturas en SIESA
            if (coincidenciasSiesa.length > 0) {
                const datosRelacionados = coincidenciasSiesa.map(fila => {
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
                    const confirmacion = this.obtenerConfirmacion(datosSoportes, documento, lote, referenciaItem, cantidadItem, nitCliente);
                    
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
                        confirmacion: confirmacion,
                        fuente: 'DATA2'
                    };
                });
                
                datosCombinados.push({
                    documento: documento,
                    referencia: referencia,
                    lote: lote,
                    datosSiesa: datosRelacionados,
                    fuente: 'DATA2'
                });
            }
        });

        console.log(`📊 Registros con facturas: ${datosCombinados.length}`);
        return datosCombinados;
    }

    // Combinar TODOS los datos de ambas fuentes
    combinarTodosLosDatos(datosData2, datosSiesa, datosSoportes, datosData, datosRec, datosGlobales) {
        const datosCombinados = [];
        
        console.log('🔄 Combinando datos de DATA2 y REC...');
        
        // 1. Procesar datos de DATA2 (SISPRO)
        datosData2.forEach(itemData2 => {
            const documento = "REC" + itemData2.documento;
            const referencia = itemData2.referencia;
            const lote = itemData2.lote;
            
            // Buscar coincidencias en SIESA (facturas)
            const coincidenciasSiesa = datosSiesa.filter(filaSiesa => {
                const codigoSiesa = filaSiesa[3];
                return String(codigoSiesa).trim() === String(lote).trim();
            });
            
            let datosRelacionados = [];
            
            if (coincidenciasSiesa.length > 0) {
                // Tiene facturas en SIESA
                datosRelacionados = coincidenciasSiesa.map(fila => {
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
                    const confirmacion = this.obtenerConfirmacion(datosSoportes, documento, lote, referenciaItem, cantidadItem, nitCliente);
                    
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
                        confirmacion: confirmacion,
                        fuente: 'DATA2'
                    };
                });
            } else {
                // No tiene facturas en SIESA - procesar distribución
                datosRelacionados = this.procesarDistribucionSinFactura(
                    documento, itemData2, datosData, datosSoportes
                );
            }
            
            if (datosRelacionados.length > 0) {
                datosCombinados.push({
                    documento: documento,
                    referencia: referencia,
                    lote: lote,
                    datosSiesa: datosRelacionados,
                    fuente: 'DATA2'
                });
            }
        });

        // 2. Procesar datos de REC (GLOBAL)
        const datosGlobalesPorLote = {};
        datosGlobales.forEach(item => {
            datosGlobalesPorLote[item.lote] = item.datosGlobal || [];
        });
        
        datosRec.forEach(filaRec => {
            const documento = filaRec[0];
            const referencia = filaRec[1];
            const lote = filaRec[2];
            
            // Verificar si ya existe en datosCombinados (para evitar duplicados)
            const existe = datosCombinados.some(item => 
                item.documento === documento && item.lote === lote
            );
            
            if (!existe) {
                let datosRelacionados = [];
                
                // Buscar coincidencias en SIESA
                const coincidenciasSiesa = datosSiesa.filter(filaSiesa => {
                    const codigoSiesa = filaSiesa[3];
                    return String(codigoSiesa).trim() === String(lote).trim();
                });
                
                if (coincidenciasSiesa.length > 0) {
                    // Tiene facturas en SIESA
                    datosRelacionados = coincidenciasSiesa.map(fila => {
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
                        const confirmacion = this.obtenerConfirmacion(datosSoportes, documento, lote, referenciaItem, cantidadItem, nitCliente);
                        
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
                            confirmacion: confirmacion,
                            fuente: 'REC'
                        };
                    });
                } else if (datosGlobalesPorLote[lote] && datosGlobalesPorLote[lote].length > 0) {
                    // Usar datos globales
                    datosRelacionados = datosGlobalesPorLote[lote].map(item => {
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
                            confirmacion: confirmacion,
                            fuente: 'REC'
                        };
                    });
                }
                
                if (datosRelacionados.length > 0) {
                    datosCombinados.push({
                        documento: documento,
                        referencia: referencia,
                        lote: lote,
                        datosSiesa: datosRelacionados,
                        fuente: 'REC'
                    });
                }
            }
        });

        console.log(`📊 Registros totales: ${datosCombinados.length} (DATA2: ${datosCombinados.filter(d => d.fuente === 'DATA2').length}, REC: ${datosCombinados.filter(d => d.fuente === 'REC').length})`);
        return datosCombinados;
    }

    procesarDistribucionSinFactura(documento, itemData2, datosData, datosSoportes) {
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
                    confirmacion: confirmacion,
                    fuente: 'DATA2'
                });
            });
        }
        
        return datosRelacionados;
    }

    async obtenerDatosDeData2() {
        const values = await this.fetchSheetData(SPREADSHEET_IDS.DATA2, 'DATA2!S:S');
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
        const values = await this.fetchSheetData(SPREADSHEET_IDS.DATA, 'DATA!C:C');
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
        const values = await this.fetchSheetData(SPREADSHEET_IDS.REC, 'DataBase!A2:AB');
        
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
        const values = await this.fetchSheetData(SPREADSHEET_IDS.SOPORTES, 'SOPORTES!A:G');
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
        const values = await this.fetchSheetData(SPREADSHEET_IDS.REC, 'DataBase!A:HR');
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

        // Obtener datos DIS
        const cantidadesDIS = {};
        try {
            const disValues = await this.fetchSheetData(SPREADSHEET_IDS.DIS, 'DIS.!A:N');
            disValues.forEach(fila => {
                const doc = fila[8];
                if (!doc) return;
                cantidadesDIS[doc] = {
                    "805027653": fila[10] || "",
                    "900047252": fila[12] || ""
                };
            });
        } catch (error) {
            console.error("Error obteniendo datos DIS:", error);
        }

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

                // Agregar datos DIS si existen
                if (cantidadesDIS[documento]) {
                    const clientesExtra = [
                        { nit: "805027653", nombre: "EL TEMPLO DE LA MODA SAS", estado: "Templo" },
                        { nit: "900047252", nombre: "EL TEMPLO DE LA MODA FRESCA SAS", estado: "Shopping" }
                    ];

                    clientesExtra.forEach(cliente => {
                        const cantidad = cantidadesDIS[documento][cliente.nit];
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
        }

        return resultado;
    }

    async obtenerDatosSiesa() {
        const [siesaValues, siesaV2Values] = await Promise.all([
            this.fetchSheetData(SPREADSHEET_IDS.SIESA, 'SIESA!A:G'),
            this.fetchSheetData(SPREADSHEET_IDS.SIESA, 'SIESA_V2!A:D')
        ]);

        const clientesEspecificos = [
            { nombre: "INVERSIONES URBANA SAS", nit: "901920844" },
            { nombre: "EL TEMPLO DE LA MODA FRESCA SAS", nit: "900047252" },
            { nombre: "EL TEMPLO DE LA MODA SAS", nit: "805027653" },
            { nombre: "ARISTIZABAL LOPEZ JESUS MARIA", nit: "70825517" },
            { nombre: "QUINTERO ORTIZ JOSE ALEXANDER", nit: "14838951" },
            { nombre: "QUINTERO ORTIZ PATRICIA YAMILET", nit: "67006141" },
            { nombre: "ZULUAGA GOMEZ RUBEN ESTEBAN", nit: "1007348825" },
        ];
        
        const estadosExcluir = ["Anuladas", "En elaboración"];
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
        
        const obtenerNitDeCliente = (nombreNormalizado) => {
            const clienteEncontrado = clientesEspecificos.find(
                cliente => normalizarCliente(cliente.nombre) === nombreNormalizado
            );
            return clienteEncontrado ? clienteEncontrado.nit : '';
        };
        
        const processedSiesaV2 = {};
        
        siesaV2Values.forEach(row => {
            if (row.length >= 3) {
                const key = row[0];
                const value1 = parseFloat(row[1]) || 0;
                const value2 = row[2] || '';
                const value3 = parseFloat(row[3]) || 0;
                
                if (!processedSiesaV2[key]) {
                    processedSiesaV2[key] = {
                        sumValue1: value1,
                        value2Items: [value2],
                        sumValue3: value3,
                        count: 1
                    };
                } else {
                    processedSiesaV2[key].sumValue1 += value1;
                    processedSiesaV2[key].value2Items.push(value2);
                    processedSiesaV2[key].sumValue3 += value3;
                    processedSiesaV2[key].count += 1;
                }
            }
        });
        
        return siesaValues
            .filter(row => {
                const estado = row[0] || '';
                return !estadosExcluir.includes(estado);
            })
            .filter(row => {
                const codigo = row[1] || '';
                return tienePrefijoValido(codigo);
            })
            .map(row => {
                if (row.length >= 7) {
                    const col6Value = row[6];
                    let selectedValue;
                    
                    if (col6Value == "5") {
                        selectedValue = row[4] || '';
                    } else if (col6Value == "3") {
                        selectedValue = row[5] || '';
                    } else {
                        selectedValue = '';
                    }
                    
                    const clienteNormalizado = row[3] ? normalizarCliente(row[3]) : '';
                    const fechaFormateada = formatearFecha(row[2] || '');
                    const complementData = processedSiesaV2[row[1]] || { 
                        sumValue1: 0, 
                        value2Items: [], 
                        sumValue3: 0,
                        count: 0
                    };
                    
                    let value2Result;
                    if (complementData.count === 0) {
                        value2Result = '';
                    } else if (complementData.count === 1) {
                        value2Result = complementData.value2Items[0];
                    } else {
                        value2Result = "RefVar";
                    }
                    
                    const nitCliente = obtenerNitDeCliente(clienteNormalizado);
                    
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
                } else {
                    const clienteNormalizado = row[3] ? normalizarCliente(row[3]) : '';
                    const complementData = processedSiesaV2[row[1]] || { 
                        sumValue1: 0, 
                        value2Items: [], 
                        sumValue3: 0,
                        count: 0
                    };
                    
                    let value2Result = complementData.count === 0 ? '' : 
                                    (complementData.count === 1 ? complementData.value2Items[0] : "RefVar");
                    
                    const nitCliente = obtenerNitDeCliente(clienteNormalizado);
                    
                    return [
                        row[0] || '',
                        row[1] || '',
                        formatearFecha(row[2] || ''),
                        '',
                        row[6] || '', 
                        clienteNormalizado,
                        complementData.sumValue1,
                        value2Result,
                        complementData.sumValue3,
                        nitCliente
                    ];
                }
            })
            .filter(row => {
                const clienteNormalizado = row[5];
                return clientesEspecificos.some(cliente => 
                    normalizarCliente(cliente.nombre) === clienteNormalizado
                );
            });
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

    // Método para verificar confirmación en tiempo real
    async verificarConfirmacion(documento, lote, referencia, cantidad, nit) {
        try {
            const datosSoportes = await this.obtenerDatosSoportes();
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

    clearCache() {
        this.cache.clear();
    }
}

// Instancia global
const sheetsAPI = new SheetsAPI();
