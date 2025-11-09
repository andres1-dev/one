// Configuración de la API de Google Sheets
const SHEETS_API_KEY = 'AIzaSyC7hjbRc0TGLgImv8gVZg8tsOeYWgXlPcM';
const API_BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

// IDs de las hojas de cálculo (eliminamos DIS)
const SPREADSHEET_IDS = {
    DATA2: "133NiyjNApZGkEFs4jUvpJ9So-cSEzRVeW2FblwOCrjI",
    DATA: "1d5dCCCgiWXfM6vHu3zGGKlvK2EycJtT7Uk4JqUjDOfE",
    SIESA: "1FcQhVIKtWy4O-aGTNfA6l4C5Q4_u1LZErpj3CMglfQM",
    REC: "1esc5REq0c03nHLpGcLwZRW29yq2gZnrpbz75gCCjrqc",
    SOPORTES: "1VaPBwgRu1QWhmsV_Qgf7cgraSxiAWRX6-wBEyUlGoJw"
};

class UltraOptimizedSheetsAPI {
    constructor() {
        this.cache = new Map();
        this.cacheTimeouts = {
            SIESA: 300000,      // 5 min
            SOPORTES: 0,        // 30 seg - más frecuente para confirmaciones
            DATA2: 300000,      // 5 min
            DATA: 300000,       // 5 min
            REC: 300000         // 5 min
        };
    }

    /**
     * Fetch ultra optimizado con rangos específicos
     */
    async fetchSheetData(spreadsheetId, range, cacheKey = null) {
        const key = cacheKey || `${spreadsheetId}_${range}`;
        const cached = this.cache.get(key);
        
        const sheetType = Object.keys(SPREADSHEET_IDS).find(k => SPREADSHEET_IDS[k] === spreadsheetId);
        const timeout = this.cacheTimeouts[sheetType] || 120000;
        
        if (cached && Date.now() - cached.timestamp < timeout) {
            return cached.data;
        }

        try {
            const url = `${API_BASE_URL}/${spreadsheetId}/values/${range}?key=${SHEETS_API_KEY}`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
            
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            const values = data.values || [];
            
            this.cache.set(key, { data: values, timestamp: Date.now() });
            return values;
        } catch (error) {
            console.error(`Fetch error ${range}:`, error);
            // Retornar cache expirado como fallback
            return cached ? cached.data : [];
        }
    }

    /**
     * Método principal ULTRA RÁPIDO
     */
    async obtenerDatosCombinados() {
        try {
            console.time('🚀 Total Data Load');
            
            // Solo cargar datos esenciales en paralelo
            const [datosData2, datosSoportes, datosRec] = await Promise.all([
                this.obtenerDatosData2UltraRapido(),
                this.obtenerDatosSoportesUltraRapido(),
                this.obtenerDatosRecUltraRapido()
            ]);

            console.timeEnd('🚀 Total Data Load');
            
            // Combinación ultra rápida
            const datosCombinados = this.combinarDatosUltraRapido(datosData2, datosSoportes, datosRec);

            return {
                success: true,
                data: datosCombinados,
                timestamp: new Date().toISOString(),
                count: datosCombinados.length,
                source: 'ultra-optimized-v1'
            };
        } catch (error) {
            console.error('Error:', error);
            return { success: false, error: error.message, timestamp: new Date().toISOString() };
        }
    }

    /**
     * DATA2 ultra rápido - solo campos esenciales
     */
    async obtenerDatosData2UltraRapido() {
        const values = await this.fetchSheetData(SPREADSHEET_IDS.DATA2, 'DATA2!S2:S1000'); // Limitar rango
        const datosFiltrados = [];

        for (let i = 0; i < values.length; i++) {
            const cellValue = values[i][0];
            if (!cellValue) continue;
            
            try {
                const data = JSON.parse(cellValue);
                if (data.TIPO === "FULL") {
                    datosFiltrados.push({
                        documento: data.A?.toString() || '',
                        referencia: data.REFERENCIA || '',
                        lote: data.LOTE?.toString() || '',
                        proveedor: data.PROVEEDOR || ''
                    });
                }
            } catch (e) {
                // Ignorar parsing errors
            }
        }

        return datosFiltrados;
    }

    /**
     * REC ultra rápido - solo columnas necesarias
     */
    async obtenerDatosRecUltraRapido() {
        const values = await this.fetchSheetData(SPREADSHEET_IDS.REC, 'DataBase!A2:AB500'); // Limitar filas
        
        return values
            .filter(row => {
                const tieneDocumento = row[0] && row[0].trim() !== '';
                const esFull = row[27] && row[27].trim().toUpperCase() === 'FULL';
                return tieneDocumento && esFull;
            })
            .map(row => [
                row[0] || '',
                row[6] || '', // referencia
                row[8] || ''  // lote
            ]);
    }

    /**
     * SOPORTES ultra rápido - solo confirmaciones activas
     */
    async obtenerDatosSoportesUltraRapido() {
        const values = await this.fetchSheetData(SPREADSHEET_IDS.SOPORTES, 'SOPORTES!A2:G1000'); // Limitar rango
        const soportesMap = new Map();

        for (let i = 0; i < values.length; i++) {
            const row = values[i];
            if (!row || row.length < 7) continue;
            
            const documento = String(row[1] || '').trim();
            const lote = String(row[2] || '').trim();
            const referencia = String(row[3] || '').trim();
            const cantidad = String(row[4] || '').trim();
            const factura = row[5] || '';
            const nit = String(row[6] || '').trim();
            
            if (documento && lote && nit) {
                const clave = `${documento}_${lote}_${referencia}_${cantidad}_${nit}`;
                soportesMap.set(clave, {
                    factura: factura,
                    confirmado: !!factura && factura.trim() !== ''
                });
            }
        }

        return soportesMap;
    }

    /**
     * Combinación ULTRA RÁPIDA
     */
    combinarDatosUltraRapido(datosData2, datosSoportes, datosRec) {
        const datosCombinados = [];
        const lotesProcesados = new Set();

        // Procesar DATA2 primero (más confiable)
        datosData2.forEach(item => {
            const documento = "REC" + item.documento;
            const lote = item.lote;
            const claveLote = `${documento}_${lote}`;
            
            if (!lotesProcesados.has(claveLote)) {
                lotesProcesados.add(claveLote);
                
                const datosRelacionados = this.generarDatosRelacionados(documento, item, datosSoportes);
                
                datosCombinados.push({
                    documento: documento,
                    referencia: item.referencia,
                    lote: lote,
                    datosSiesa: datosRelacionados
                });
            }
        });

        // Procesar REC para completar datos faltantes
        datosRec.forEach(filaRec => {
            const documento = filaRec[0];
            const lote = filaRec[2];
            const claveLote = `${documento}_${lote}`;
            
            if (!lotesProcesados.has(claveLote)) {
                lotesProcesados.add(claveLote);
                
                const datosRelacionados = this.generarDatosBasicos(documento, filaRec, datosSoportes);
                
                datosCombinados.push({
                    documento: documento,
                    referencia: filaRec[1] || '',
                    lote: lote,
                    datosSiesa: datosRelacionados
                });
            }
        });

        return datosCombinados;
    }

    /**
     * Generar datos relacionados de forma optimizada
     */
    generarDatosRelacionados(documento, itemData2, datosSoportes) {
        const datosRelacionados = [];
        
        // Clientes básicos (sin DIS, todo desde DATA)
        const clientesBasicos = [
            { nit: "805027653", nombre: "EL TEMPLO DE LA MODA SAS", estado: "Templo" },
            { nit: "900047252", nombre: "EL TEMPLO DE LA MODA FRESCA SAS", estado: "Shopping" },
            { nit: "901920844", nombre: "INVERSIONES URBANA SAS", estado: "Ruben" },
            { nit: "1007348825", nombre: "ZULUAGA GOMEZ RUBEN ESTEBAN", estado: "Esteban" },
            { nit: "70825517", nombre: "ARISTIZABAL LOPEZ JESUS MARIA", estado: "Jesus" },
            { nit: "14838951", nombre: "QUINTERO ORTIZ JOSE ALEXANDER", estado: "Alex" },
            { nit: "67006141", nombre: "QUINTERO ORTIZ PATRICIA YAMILET", estado: "Yamilet" }
        ];

        clientesBasicos.forEach(cliente => {
            const confirmacion = this.obtenerConfirmacionRapida(
                datosSoportes, 
                documento,
                itemData2.lote, 
                itemData2.referencia, 
                "1", // Cantidad por defecto
                cliente.nit
            );
            
            if (confirmacion) {
                datosRelacionados.push({
                    estado: cliente.estado,
                    factura: "",
                    fecha: "",
                    lote: itemData2.lote,
                    proovedor: itemData2.proveedor,
                    cliente: cliente.nombre,
                    valorBruto: "",
                    referencia: itemData2.referencia,
                    cantidad: 1,
                    nit: cliente.nit,
                    confirmacion: confirmacion
                });
            }
        });

        return datosRelacionados.length > 0 ? datosRelacionados : null;
    }

    generarDatosBasicos(documento, filaRec, datosSoportes) {
        const datosRelacionados = [];
        
        const clientesBasicos = [
            { nit: "805027653", nombre: "EL TEMPLO DE LA MODA SAS", estado: "Templo" },
            { nit: "900047252", nombre: "EL TEMPLO DE LA MODA FRESCA SAS", estado: "Shopping" }
        ];

        clientesBasicos.forEach(cliente => {
            const confirmacion = this.obtenerConfirmacionRapida(
                datosSoportes, 
                documento,
                filaRec[2], 
                filaRec[1] || '', 
                "1", 
                cliente.nit
            );
            
            if (confirmacion) {
                datosRelacionados.push({
                    estado: cliente.estado,
                    factura: "",
                    fecha: "",
                    lote: filaRec[2],
                    proovedor: "",
                    cliente: cliente.nombre,
                    valorBruto: "",
                    referencia: filaRec[1] || '',
                    cantidad: 1,
                    nit: cliente.nit,
                    confirmacion: confirmacion
                });
            }
        });

        return datosRelacionados.length > 0 ? datosRelacionados : null;
    }

    /**
     * Confirmación ultra rápida
     */
    obtenerConfirmacionRapida(soportesMap, documento, lote, referencia, cantidad, nit) {
        const clave = `${String(documento).trim()}_${String(lote).trim()}_${String(referencia).trim()}_${String(cantidad).trim()}_${String(nit).trim()}`;
        
        if (soportesMap.has(clave)) {
            const soporte = soportesMap.get(clave);
            return soporte.factura && soporte.factura.trim() !== '' ? "ENTREGADO" : "ENTREGADO, PENDIENTE FACTURA";
        }
        
        return "";
    }

    /**
     * Verificación en tiempo real (MUY RÁPIDO)
     */
    async verificarConfirmacion(documento, lote, referencia, cantidad, nit) {
        try {
            // Solo actualizar cache de SOPORTES
            this.cache.delete(`${SPREADSHEET_IDS.SOPORTES}_SOPORTES!A2:G1000`);
            const datosSoportes = await this.obtenerDatosSoportesUltraRapido();
            
            const confirmacion = this.obtenerConfirmacionRapida(datosSoportes, documento, lote, referencia, cantidad, nit);
            
            return {
                confirmado: confirmacion.includes("ENTREGADO"),
                estado: confirmacion,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error en verificación:', error);
            return { confirmado: false, estado: "ERROR", timestamp: new Date().toISOString() };
        }
    }

    /**
     * Limpiar cache selectivo
     */
    clearCache(sheetType = null) {
        if (sheetType) {
            const spreadsheetId = SPREADSHEET_IDS[sheetType];
            if (spreadsheetId) {
                for (const [key] of this.cache) {
                    if (key.startsWith(spreadsheetId)) this.cache.delete(key);
                }
            }
        } else {
            this.cache.clear();
        }
    }
}

// Instancia global ULTRA RÁPIDA
const ultraSheetsAPI = new UltraOptimizedSheetsAPI();
