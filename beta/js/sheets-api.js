// Configuración de Sheets API v4
const SHEETS_API_KEY = "AIzaSyC7hjbRc0TGLgImv8gVZg8tsOeYWgXlPcM";
const SOURCE_SPREADSHEET_ID_SIESA = "1FcQhVIKtWy4O-aGTNfA6l4C5Q4_u1LZErpj3CMglfQM";
const SUPPORT_SPREADSHEET_ID = "1VaPBwgRu1QWhmsV_Qgf7cgraSxiAWRX6-wBEyUlGoJw";

// URLs de la API
const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const BATCH_GET_URL = `${SHEETS_API_BASE}/{spreadsheetId}/values:batchGet?key=${SHEETS_API_KEY}`;

class SheetsDataService {
    constructor() {
        this.cache = null;
        this.lastUpdate = null;
        this.cacheDuration = 30000; // 30 segundos de cache
        this.isUpdating = false;
    }

    // Función principal para obtener datos
    async getData() {
        // Usar cache si está disponible y no ha expirado
        if (this.cache && this.lastUpdate && 
            (Date.now() - this.lastUpdate) < this.cacheDuration) {
            return this.cache;
        }

        // Evitar múltiples llamadas simultáneas
        if (this.isUpdating) {
            return this.cache || await this.waitForUpdate();
        }

        this.isUpdating = true;

        try {
            const data = await this.fetchAllData();
            this.cache = data;
            this.lastUpdate = Date.now();
            return data;
        } catch (error) {
            console.error("Error fetching data:", error);
            // Si hay error pero tenemos cache, devolver cache
            if (this.cache) {
                console.warn("Using cached data due to fetch error");
                return this.cache;
            }
            throw error;
        } finally {
            this.isUpdating = false;
        }
    }

    // Esperar a que termine una actualización en curso
    async waitForUpdate() {
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (!this.isUpdating && this.cache) {
                    clearInterval(checkInterval);
                    resolve(this.cache);
                }
            }, 100);
        });
    }

    // Obtener todos los datos necesarios
    async fetchAllData() {
        try {
            // Obtener datos de soportes primero
            const soportesPorFactura = await this.obtenerDatosSoportes();
            
            // Obtener datos de SIESA y SIESA_V2 en paralelo
            const [dataSiesa, dataSiesaV2] = await Promise.all([
                this.obtenerDatosHoja(SOURCE_SPREADSHEET_ID_SIESA, "SIESA!A:G"),
                this.obtenerDatosHoja(SOURCE_SPREADSHEET_ID_SIESA, "SIESA_V2!A:D")
            ]);

            // Procesar datos
            const datosProcesados = this.procesarDatosCompletos(
                dataSiesa.values || [],
                dataSiesaV2.values || [],
                soportesPorFactura
            );

            return {
                success: true,
                data: datosProcesados,
                timestamp: new Date().toISOString(),
                count: datosProcesados.length,
                ultimaEntrega: this.encontrarUltimaFecha(datosProcesados)
            };

        } catch (error) {
            console.error("Error in fetchAllData:", error);
            throw error;
        }
    }

    // Obtener datos de una hoja específica
    async obtenerDatosHoja(spreadsheetId, range) {
        const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?key=${SHEETS_API_KEY}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    }

    // Obtener datos de soportes
    async obtenerDatosSoportes() {
        try {
            const data = await this.obtenerDatosHoja(
                SUPPORT_SPREADSHEET_ID, 
                "SOPORTES!A:I"
            );
            
            const allValues = data.values || [];
            if (allValues.length <= 1) return {};

            const headers = allValues[0];
            const facturaIndex = headers.indexOf("Factura");
            const registroIndex = headers.indexOf("Registro");
            const urlIndex = headers.indexOf("Url_Ih3");

            if (facturaIndex === -1 || registroIndex === -1 || urlIndex === -1) {
                throw new Error("Columnas requeridas no encontradas en SOPORTES");
            }

            const soportesPorFactura = {};

            for (let i = 1; i < allValues.length; i++) {
                const row = allValues[i];
                if (row && row.length > Math.max(facturaIndex, registroIndex, urlIndex)) {
                    const factura = row[facturaIndex];
                    const registro = row[registroIndex];
                    const url = row[urlIndex];

                    if (factura) {
                        if (!soportesPorFactura[factura]) {
                            soportesPorFactura[factura] = [];
                        }
                        if (registro) {
                            soportesPorFactura[factura].push({
                                registro: registro.trim(),
                                url: url || ''
                            });
                        }
                    }
                }
            }

            return soportesPorFactura;
        } catch (error) {
            console.error("Error en obtenerDatosSoportes:", error);
            return {};
        }
    }

    // Encontrar la última fecha de entrega
    encontrarUltimaFecha(datos) {
        let ultimaFecha = null;
        let ultimaFechaStr = '';

        datos.forEach(item => {
            if (item.soportes && Array.isArray(item.soportes)) {
                item.soportes.forEach(soporte => {
                    if (soporte.registro) {
                        try {
                            const [fecha, hora] = soporte.registro.split(' ');
                            const [day, month, year] = fecha.split('/').map(Number);
                            const [hours, minutes, seconds] = hora.split(':').map(Number);
                            const fechaObj = new Date(year, month - 1, day, hours, minutes, seconds);

                            if (!ultimaFecha || fechaObj > ultimaFecha) {
                                ultimaFecha = fechaObj;
                                ultimaFechaStr = soporte.registro;
                            }
                        } catch (e) {
                            console.error("Error procesando fecha:", soporte.registro, e);
                        }
                    }
                });
            }
        });

        return ultimaFechaStr;
    }

    // Procesar datos complementarios de SIESA_V2
    procesarDatosComplementarios(dataSiesaV2) {
        const complementData = {};

        for (let i = 1; i < dataSiesaV2.length; i++) {
            const row = dataSiesaV2[i];
            if (row && row.length >= 3) {
                const key = row[0];
                if (key) {
                    if (!complementData[key]) {
                        complementData[key] = {
                            sumValue1: parseFloat(row[1]) || 0,
                            value2Items: [row[2] || ''],
                            sumValue3: parseFloat(row[3]) || 0,
                            count: 1
                        };
                    } else {
                        complementData[key].sumValue1 += parseFloat(row[1]) || 0;
                        complementData[key].value2Items.push(row[2] || '');
                        complementData[key].sumValue3 += parseFloat(row[3]) || 0;
                        complementData[key].count += 1;
                    }
                }
            }
        }

        return complementData;
    }

    // Función principal para procesar datos completos
    procesarDatosCompletos(dataSiesa, dataSiesaV2, soportesPorFactura) {
        const soportes = soportesPorFactura || {};
        const datosComplementarios = this.procesarDatosComplementarios(dataSiesaV2);

        // Configuración de clientes
        const clientesEspecificos = [
            { nombre: "INVERSIONES URBANA SAS", nit: "901920844" },
            { nombre: "EL TEMPLO DE LA MODA FRESCA SAS", nit: "900047252" },
            { nombre: "EL TEMPLO DE LA MODA SAS", nit: "805027653" },
            { nombre: "ARISTIZABAL LOPEZ JESUS MARIA", nit: "70825517" },
            { nombre: "ZULUAGA GOMEZ RUBEN ESTEBAN", nit: "1007348825" },
            { nombre: "QUINTERO ORTIZ JOSE ALEXANDER", nit: "14838951" },
            { nombre: "QUINTERO ORTIZ PATRICIA YAMILET", nit: "67006141" }
        ];

        const estadosExcluir = ["Anuladas", "En elaboración"];
        const prefijosValidos = ["017", "FEV", "029", "FVE"];

        return this.procesarDatosPrincipales(
            dataSiesa,
            soportes,
            datosComplementarios,
            clientesEspecificos,
            estadosExcluir,
            prefijosValidos
        );
    }

    // Procesar datos principales de SIESA
    procesarDatosPrincipales(
        dataSiesa,
        soportesPorFactura,
        datosComplementarios,
        clientesEspecificos,
        estadosExcluir,
        prefijosValidos
    ) {
        const resultados = [];

        // Funciones de ayuda
        const normalizarCliente = nombre => (nombre || '').replace(/S\.A\.S\.?/g, 'SAS').replace(/\s+/g, ' ').trim();

        const esClienteValido = (nombreCliente, listaClientes) => {
            const clienteNormalizado = normalizarCliente(nombreCliente);

            // Buscar coincidencia exacta primero
            const coincidenciaExacta = listaClientes.find(c =>
                normalizarCliente(c.nombre) === clienteNormalizado
            );

            if (coincidenciaExacta) return true;

            // Para clientes que comparten apellidos, buscar coincidencia parcial más estricta
            return listaClientes.some(c => {
                const clienteListaNormalizado = normalizarCliente(c.nombre);

                // Si ambos nombres tienen más de 2 palabras, considerar coincidencia parcial
                const palabrasCliente = clienteNormalizado.split(' ');
                const palabrasLista = clienteListaNormalizado.split(' ');

                if (palabrasCliente.length > 2 && palabrasLista.length > 2) {
                    // Verificar si comparten los primeros dos elementos (normalmente apellidos)
                    const primerosDosCliente = palabrasCliente.slice(0, 2).join(' ');
                    const primerosDosLista = palabrasLista.slice(0, 2).join(' ');

                    return primerosDosCliente === primerosDosLista;
                }

                return false;
            });
        };

        const formatearFecha = fechaStr => {
            const partes = (fechaStr || '').split('/');
            return partes.length === 3 ? `${partes[1]}/${partes[0]}/${partes[2]}` : fechaStr;
        };

        const extraerSoloFecha = fechaHoraStr => (fechaHoraStr || '').split(' ')[0];

        const tienePrefijoValido = valor => prefijosValidos.some(p => (valor || '').toUpperCase().startsWith(p));

        const obtenerNitCliente = nombre => {
            const clienteNormalizado = normalizarCliente(nombre);
            const cliente = clientesEspecificos.find(c => normalizarCliente(c.nombre) === clienteNormalizado);
            return cliente ? cliente.nit : '';
        };

        for (let i = 1; i < dataSiesa.length; i++) {
            const row = dataSiesa[i];
            if (!row || row.length < 7) continue;

            const estado = row[0] || '';
            const factura = row[1] || '';
            const nombreClienteOriginal = row[3] || '';

            // Aplicar filtros
            if (estadosExcluir.includes(estado)) continue;
            if (!tienePrefijoValido(factura)) continue;

            // Validar cliente
            if (!esClienteValido(nombreClienteOriginal, clientesEspecificos)) continue;

            // Procesar datos según estructura
            const col6Value = row[6] || '';
            let selectedValue = '';

            if (col6Value == "5" && row.length > 4) selectedValue = row[4] || '';
            if (col6Value == "3" && row.length > 5) selectedValue = row[5] || '';

            const complementData = datosComplementarios[factura] || {
                sumValue1: 0,
                value2Items: [],
                sumValue3: 0,
                count: 0
            };

            let referencia = '';
            if (complementData.count === 1) {
                referencia = complementData.value2Items[0];
            } else if (complementData.count > 1) {
                referencia = "RefVar";
            }

            // Obtener soportes y fecha de entrega
            const soportes = soportesPorFactura[factura] || [];
            const fechaEntrega = soportes.length > 0 ? extraerSoloFecha(soportes[0].registro) : '';

            // Determinar proveedor
            let proveedor = '';
            if (col6Value == "5") proveedor = "TEXTILES Y CREACIONES EL UNIVERSO SAS";
            if (col6Value == "3") proveedor = "TEXTILES Y CREACIONES LOS ANGELES SAS";

            // Agregar resultado
            resultados.push({
                estado: estado,
                factura: factura,
                fecha: formatearFecha(row[2] || ''),
                lote: selectedValue,
                codProveedor: col6Value,
                proveedor: proveedor,
                cliente: normalizarCliente(nombreClienteOriginal),
                valorBruto: complementData.sumValue1,
                referencia: referencia,
                cantidad: complementData.sumValue3,
                nit: obtenerNitCliente(nombreClienteOriginal),
                fechaEntrega: fechaEntrega,
                soportes: soportes,
                confirmacion: this.determinarConfirmacion(soportes, estado)
            });
        }

        return resultados;
    }

    // Determinar estado de confirmación basado en soportes
    determinarConfirmacion(soportes, estado) {
        if (soportes && soportes.length > 0) {
            return "ENTREGADO";
        }
        return estado === "Aprobadas" ? "PENDIENTE FACTURA" : "PENDIENTE";
    }

    // Verificar confirmación específica para una factura
    async verificarConfirmacion(factura) {
        try {
            const data = await this.getData();
            const registro = data.data.find(item => item.factura === factura);
            
            if (registro) {
                return {
                    confirmado: registro.soportes && registro.soportes.length > 0,
                    estado: registro.estado,
                    confirmacion: registro.confirmacion,
                    soportes: registro.soportes || []
                };
            }
            
            return { confirmado: false, estado: 'NO_ENCONTRADO' };
        } catch (error) {
            console.error("Error verificando confirmación:", error);
            return { confirmado: false, estado: 'ERROR' };
        }
    }

    // Forzar actualización de datos
    async forceRefresh() {
        this.cache = null;
        this.lastUpdate = null;
        return await this.getData();
    }

    // Obtener estadísticas de uso
    getStats() {
        return {
            lastUpdate: this.lastUpdate,
            hasCache: !!this.cache,
            isUpdating: this.isUpdating
        };
    }
}

// Instancia global del servicio
const sheetsDataService = new SheetsDataService();
