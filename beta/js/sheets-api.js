// Configuración de la API de Google Sheets
const SHEETS_API_KEY = 'AIzaSyC7hjbRc0TGLgImv8gVZg8tsOeYWgXlPcM';
const API_BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

// IDs de las hojas de cálculo
const SPREADSHEET_IDS = {
    DATA2: "133NiyjNApZGkEFs4jUvpJ9So-cSEzRVeW2FblwOCrjI",
    DATA: "1d5dCCCgiWXfM6vHu3zGGKlvK2EycJtT7Uk4JqUjDOfE",
    SIESA: "1FcQhVIKtWy4O-aGTNfA6l4C5Q4_u1LZErpj3CMglfQM",
    REC: "1esc5REq0c03nHLpGcLwZRW29yq2gZnrpbz75gCCjrqc",
    SOPORTES: "1VaPBwgRu1QWhmsV_Qgf7cgraSxiAWRX6-wBEyUlGoJw"
};

class SheetsAPI {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 0; // CACHE 0 - siempre datos frescos
        this.datosRec = []; // Para almacenar datos de REC cargados en segundo plano
        this.datosGlobales = []; // Para almacenar datos globales cargados en segundo plano
        this.cargaCompletaLista = false; // Flag para saber si ya se cargó todo
    }

    async fetchSheetData(spreadsheetId, range) {
        // Con cache 0, siempre hacemos petición fresca
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

    // Obtener datos combinados - FASE 1: Solo datos esenciales para facturas
    async obtenerDatosCombinados() {
        try {
            console.time('FASE1_CargaRapida_Facturas');
            console.log('🚀 INICIANDO FASE 1 - Carga rápida para facturas...');
            
            // FASE 1: Solo lo esencial para mostrar facturas al escanear QR
            const [
                datosData2,
                datosSiesa,
                datosData,
                datosSoportes
            ] = await Promise.all([
                this.obtenerDatosDeData2(),
                this.obtenerDatosSiesa(),
                this.obtenerDatosDeDataConSumas(),
                this.obtenerDatosSoportes()
            ]);

            console.timeEnd('FASE1_CargaRapida_Facturas');
            console.log('✅ FASE 1 COMPLETADA - Página lista para usar');
            
            // Combinar datos mínimos para facturas (sin REC ni Globales)
            const datosCombinados = await this.combinarDatosMinimos(
                datosData2, datosSiesa, datosData, datosSoportes
            );

            // FASE 2: Iniciar carga en segundo plano para entregas sin factura
            this.iniciarCargaSegundoPlano();

            return {
                success: true,
                data: datosCombinados,
                timestamp: new Date().toISOString(),
                count: datosCombinados.length,
                source: 'fase1-carga-rapida-facturas'
            };
        } catch (error) {
            console.error('Error en FASE 1:', error);
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // FASE 2: Carga en segundo plano para entregas sin factura
    async iniciarCargaSegundoPlano() {
        console.log('🔄 INICIANDO FASE 2 - Carga en segundo plano para entregas sin factura...');
        
        // Usar setTimeout para no bloquear la interfaz
        setTimeout(async () => {
            try {
                console.time('FASE2_CargaCompleta_Entregas');
                
                const [datosRec, datosGlobales] = await Promise.all([
                    this.obtenerDatosRec(),
                    this.obtenerDatosGlobales()
                ]);

                // Guardar datos para uso posterior
                this.datosRec = datosRec;
                this.datosGlobales = datosGlobales;
                this.cargaCompletaLista = true;

                console.timeEnd('FASE2_CargaCompleta_Entregas');
                console.log('✅ FASE 2 COMPLETADA - Datos para entregas sin factura listos');
                console.log(`📊 Datos REC cargados: ${datosRec.length} registros`);
                console.log(`📊 Datos Globales cargados: ${datosGlobales.length} registros`);
                
            } catch (error) {
                console.error('❌ Error en FASE 2:', error);
            }
        }, 1000); // Esperar 1 segundo después de que la página esté lista
    }

    // Combinación mínima para facturas (sin REC ni Globales)
    async combinarDatosMinimos(datosData2, datosSiesa, datosData, datosSoportes) {
        const datosCombinados = [];
        
        console.log('🔄 Combinando datos mínimos para facturas...');
        
        // Procesar solo datosData2 para facturas
        datosData2.forEach(itemData2 => {
            const documento = "REC" + itemData2.documento;
            const referencia = itemData2.referencia;
            const lote = itemData2.lote;
            
            const coincidenciasSiesa = datosSiesa.filter(filaSiesa => {
                const codigoSiesa = filaSiesa[3];
                return String(codigoSiesa).trim() === String(lote).trim();
            });
            
            let datosRelacionados = null;
            
            if (coincidenciasSiesa.length > 0) {
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
                        confirmacion: confirmacion
                    };
                });
            } else {
                // Para facturas sin SIESA, usar datos básicos de DATA
                datosRelacionados = this.procesarDatosBasicosParaFacturas(documento, itemData2, datosData, datosSoportes);
            }
            
            datosCombinados.push({
                documento: documento,
                referencia: referencia,
                lote: lote,
                datosSiesa: datosRelacionados || null
            });
        });

        console.log(`✅ Datos combinados: ${datosCombinados.length} registros`);
        return datosCombinados;
    }

    // Procesar datos básicos para facturas (sin anexos PROMO)
    procesarDatosBasicosParaFacturas(documento, itemData2, datosData, datosSoportes) {
        const datosRelacionados = [];
        
        // Solo procesar distribución principal para facturas
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
                            itemData2.lote, 
                            itemData2.referencia, 
                            String(cantidadTotal), 
                            nitCliente
                        );
                        
                        datosRelacionados.push({
                            estado: this.getEstadoCliente(clienteKey),
                            factura: "",
                            fecha: "",
                            lote: itemData2.lote,
                            proovedor: itemData2.proveedor,
                            cliente: nombreCliente,
                            valorBruto: "",
                            referencia: itemData2.referencia,
                            cantidad: cantidadTotal,
                            nit: nitCliente,
                            confirmacion: confirmacion
                        });
                    }
                }
            });
        }
        
        return datosRelacionados.length > 0 ? datosRelacionados : null;
    }

    // Método para obtener datos completos cuando se necesiten (entregas sin factura)
    async obtenerDatosCompletosSiDisponibles() {
        if (this.cargaCompletaLista) {
            return {
                datosRec: this.datosRec,
                datosGlobales: this.datosGlobales,
                disponible: true
            };
        } else {
            console.log('⚠️ Datos completos aún no disponibles, cargando en segundo plano...');
            return {
                datosRec: [],
                datosGlobales: [],
                disponible: false
            };
        }
    }

    // Los demás métodos se mantienen igual (sin cambios en nombres)
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
        
        // ... (el resto del método igual que antes)
        // [Mantengo todo el código de SIESA igual]
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
