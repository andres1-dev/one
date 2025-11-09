// Configuración de la API de Google Sheets (variables globales)
const SHEETS_API_KEY = 'AIzaSyC7hjbRc0TGLgImv8gVZg8tsOeYWgXlPcM';
const API_BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

// IDs de las hojas de cálculo (solo las necesarias para facturas)
const SPREADSHEET_IDS = {
    DATA2: "133NiyjNApZGkEFs4jUvpJ9So-cSEzRVeW2FblwOCrjI",
    SIESA: "1FcQhVIKtWy4O-aGTNfA6l4C5Q4_u1LZErpj3CMglfQM",
    SOPORTES: "1VaPBwgRu1QWhmsV_Qgf7cgraSxiAWRX6-wBEyUlGoJw"
};

class SheetsAPI {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 0; // CACHE 0 - siempre datos frescos
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

    // Obtener SOLO datos con facturas
    async obtenerDatosCombinados() {
        try {
            console.time('Carga_Facturas');
            console.log('🚀 Cargando SOLO datos con facturas...');
            
            // SOLO lo esencial para facturas
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

    // Combinar SOLO datos que tienen facturas
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
                        confirmacion: confirmacion
                    };
                });
                
                datosCombinados.push({
                    documento: documento,
                    referencia: referencia,
                    lote: lote,
                    datosSiesa: datosRelacionados
                });
            }
        });

        console.log(`📊 Registros con facturas: ${datosCombinados.length}`);
        return datosCombinados;
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

    // ✅ NUEVO MÉTODO: Consulta rápida de factura en tiempo real
    async consultarFacturaEnTiempoReal(factura) {
        try {
            console.log(`🔍 Búsqueda rápida de factura: ${factura}`);
            
            if (!factura || factura.trim() === '') {
                return { existe: false, confirmado: false };
            }
            
            const facturaBuscada = String(factura).trim();
            
            // ✅ CONSULTA MÁS RÁPIDA - Solo traer columnas necesarias
            const values = await this.fetchSheetData(SPREADSHEET_IDS.SOPORTES, 'SOPORTES!F:F');
            
            if (!values || values.length === 0) {
                console.log('📋 Hoja SOPORTES vacía o no accesible');
                return { existe: false, confirmado: false };
            }
            
            // ✅ BÚSQUEDA RÁPIDA - Solo en columna F (facturas)
            let encontrada = false;
            
            // Empezar desde la fila 1 (saltar encabezado si existe)
            for (let i = 1; i < values.length; i++) {
                const row = values[i];
                if (row && row.length > 0) {
                    const facturaEnFila = String(row[0] || '').trim();
                    
                    // Comparación exacta
                    if (facturaEnFila === facturaBuscada) {
                        encontrada = true;
                        break; // ✅ SALIR INMEDIATAMENTE AL ENCONTRAR
                    }
                }
            }
            
            console.log(`📋 Factura ${facturaBuscada} ${encontrada ? '✅ ENCONTRADA' : '❌ NO encontrada'} en SOPORTES`);
            
            return {
                existe: encontrada,
                confirmado: encontrada,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ Error crítico en consulta rápida:', error);
            throw new Error(`Error consultando factura: ${error.message}`);
        }
    }

    clearCache() {
        this.cache.clear();
    }
}

// Instancia global
const sheetsAPI = new SheetsAPI();
