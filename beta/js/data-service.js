// Data Service para Sheets API v4
class DataService {
    constructor() {
        this.API_KEY = 'AIzaSyC7hjbRc0TGLgImv8gVZg8tsOeYWgXlPcM';
        this.SPREADSHEET_ID_SIESA = '1FcQhVIKtWy4O-aGTNfA6l4C5Q4_u1LZErpj3CMglfQM';
        this.SPREADSHEET_ID_SOPORTES = '1VaPBwgRu1QWhmsV_Qgf7cgraSxiAWRX6-wBEyUlGoJw';
        this.cache = null;
        this.lastUpdate = null;
        this.CACHE_DURATION = 30000; // 30 segundos de cache
    }

    // Obtener datos combinados de SIESA y SOPORTES
   async getCombinedData() {
    // Verificar cache
    if (this.cache && this.lastUpdate && 
        (Date.now() - this.lastUpdate) < this.CACHE_DURATION) {
        return this.cache;
    }

    try {
        console.log('📡 Obteniendo datos desde Sheets API...');
        
        // Obtener datos en paralelo
        const [siesaData, soportesData] = await Promise.all([
            this.getSiesaData(),
            this.getSoportesData()
        ]);

        // Combinar datos
        const combinedData = this.combineData(siesaData, soportesData);
        
        // Formatear para compatibilidad
        const compatibleData = this.formatForLegacyCompatibility(combinedData);
        
        // Actualizar cache
        this.cache = compatibleData;
        this.lastUpdate = Date.now();
        
        console.log('✅ Datos actualizados correctamente. Registros:', compatibleData.length);
        return compatibleData;
        
    } catch (error) {
        console.error('❌ Error obteniendo datos:', error);
        throw error;
    }
}

    // Obtener datos de SIESA
    async getSiesaData() {
        const ranges = [
            'SIESA!A:G',
            'SIESA_V2!A:D'
        ];

        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${this.SPREADSHEET_ID_SIESA}/values:batchGet?` +
            `ranges=${ranges.map(range => encodeURIComponent(range)).join('&ranges=')}&key=${this.API_KEY}`
        );

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const data = await response.json();
        return this.processSiesaData(data.valueRanges);
    }

    // Obtener datos de SOPORTES
    async getSoportesData() {
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${this.SPREADSHEET_ID_SOPORTES}/values/SOPORTES!A:I?key=${this.API_KEY}`
        );

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const data = await response.json();
        return this.processSoportesData(data.values || []);
    }

    // Procesar datos de SIESA
    processSiesaData(valueRanges) {
        const siesaData = valueRanges[0].values || [];
        const siesaV2Data = valueRanges[1].values || [];

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

        // Procesar datos complementarios de SIESA_V2
        const datosComplementarios = {};
        for (let i = 1; i < siesaV2Data.length; i++) {
            const row = siesaV2Data[i];
            if (row && row.length >= 3) {
                const key = row[0];
                if (key) {
                    if (!datosComplementarios[key]) {
                        datosComplementarios[key] = {
                            sumValue1: parseFloat(row[1]) || 0,
                            value2Items: [row[2] || ''],
                            sumValue3: parseFloat(row[3]) || 0,
                            count: 1
                        };
                    } else {
                        datosComplementarios[key].sumValue1 += parseFloat(row[1]) || 0;
                        datosComplementarios[key].value2Items.push(row[2] || '');
                        datosComplementarios[key].sumValue3 += parseFloat(row[3]) || 0;
                        datosComplementarios[key].count += 1;
                    }
                }
            }
        }

        // Procesar datos principales de SIESA
        const resultados = [];
        const headers = siesaData[0] || [];

        for (let i = 1; i < siesaData.length; i++) {
            const row = siesaData[i];
            if (!row || row.length < 7) continue;

            const estado = row[0] || '';
            const factura = row[1] || '';
            const nombreClienteOriginal = row[3] || '';

            // Aplicar filtros
            if (estadosExcluir.includes(estado)) continue;
            if (!prefijosValidos.some(p => factura.toUpperCase().startsWith(p))) continue;
            
            // Validar cliente
            const normalizarCliente = nombre => (nombre || '').replace(/S\.A\.S\.?/g, 'SAS').replace(/\s+/g, ' ').trim();
            const clienteNormalizado = normalizarCliente(nombreClienteOriginal);
            
            const esClienteValido = clientesEspecificos.some(c => {
                const clienteListaNormalizado = normalizarCliente(c.nombre);
                if (clienteNormalizado === clienteListaNormalizado) return true;
                
                // Coincidencia parcial para apellidos compartidos
                const palabrasCliente = clienteNormalizado.split(' ');
                const palabrasLista = clienteListaNormalizado.split(' ');
                if (palabrasCliente.length > 2 && palabrasLista.length > 2) {
                    return palabrasCliente.slice(0, 2).join(' ') === palabrasLista.slice(0, 2).join(' ');
                }
                return false;
            });

            if (!esClienteValido) continue;

            // Procesar datos según estructura
            const col6Value = row[6] || '';
            let selectedValue = '';
            
            if (col6Value == "5" && row.length > 4) selectedValue = row[4] || '';
            if (col6Value == "3" && row.length > 5) selectedValue = row[5] || '';

            const complementData = datosComplementarios[factura] || { 
                sumValue1: 0, value2Items: [], sumValue3: 0, count: 0 
            };

            let referencia = '';
            if (complementData.count === 1) {
                referencia = complementData.value2Items[0];
            } else if (complementData.count > 1) {
                referencia = "RefVar";
            }

            // Determinar proveedor y obtener NIT
            let proveedor = '';
            if (col6Value == "5") proveedor = "TEXTILES Y CREACIONES EL UNIVERSO SAS";
            if (col6Value == "3") proveedor = "TEXTILES Y CREACIONES LOS ANGELES SAS";

            const obtenerNitCliente = nombre => {
                const cliente = clientesEspecificos.find(c => 
                    normalizarCliente(c.nombre) === normalizarCliente(nombre)
                );
                return cliente ? cliente.nit : '';
            };

            // Formatear fecha
            const formatearFecha = fechaStr => {
                const partes = (fechaStr || '').split('/');
                return partes.length === 3 ? `${partes[1]}/${partes[0]}/${partes[2]}` : fechaStr;
            };

            resultados.push({
                estado: estado,
                factura: factura,
                fecha: formatearFecha(row[2] || ''),
                lote: selectedValue,
                codProveedor: col6Value,
                proveedor: proveedor,
                cliente: clienteNormalizado,
                valorBruto: complementData.sumValue1,
                referencia: referencia,
                cantidad: complementData.sumValue3,
                nit: obtenerNitCliente(nombreClienteOriginal),
                fechaEntrega: '', // Se llenará al combinar con soportes
                soportes: [],
                confirmacion: '' // Se determinará al combinar con soportes
            });
        }

        return resultados;
    }

    // Procesar datos de SOPORTES
    processSoportesData(soportesData) {
        if (!soportesData || soportesData.length <= 1) return {};

        const headers = soportesData[0];
        const facturaIndex = headers.indexOf("Factura");
        const registroIndex = headers.indexOf("Registro");
        const urlIndex = headers.indexOf("Url_Ih3");

        if (facturaIndex === -1 || registroIndex === -1) {
            throw new Error("Columnas requeridas no encontradas en SOPORTES");
        }

        const soportesPorFactura = {};

        for (let i = 1; i < soportesData.length; i++) {
            const row = soportesData[i];
            if (row && row.length > Math.max(facturaIndex, registroIndex, urlIndex)) {
                const factura = row[facturaIndex];
                const registro = row[registroIndex];
                const url = row[urlIndex];

                if (factura && registro) {
                    if (!soportesPorFactura[factura]) {
                        soportesPorFactura[factura] = [];
                    }
                    soportesPorFactura[factura].push({
                        registro: registro.trim(),
                        url: url || ''
                    });
                }
            }
        }

        return soportesPorFactura;
    }

    // Combinar datos de SIESA y SOPORTES
    combineData(siesaData, soportesData) {
        return siesaData.map(item => {
            const soportes = soportesData[item.factura] || [];
            const fechaEntrega = soportes.length > 0 ? soportes[0].registro.split(' ')[0] : '';
            
            // Determinar estado de confirmación
            let confirmacion = '';
            if (soportes.length > 0) {
                confirmacion = "ENTREGADO";
            } else if (item.estado.includes("PENDIENTE")) {
                confirmacion = "PENDIENTE FACTURA";
            }

            return {
                ...item,
                fechaEntrega: fechaEntrega,
                soportes: soportes,
                confirmacion: confirmacion,
                // Campo adicional para compatibilidad con el sistema existente
                datosSiesa: [{
                    factura: item.factura,
                    nit: item.nit,
                    lote: item.lote,
                    referencia: item.referencia,
                    cantidad: item.cantidad,
                    estado: item.estado,
                    cliente: item.cliente,
                    valorBruto: item.valorBruto,
                    fecha: item.fecha,
                    proveedor: item.proveedor,
                    confirmacion: confirmacion
                }]
            };
        });
    }

        formatForLegacyCompatibility(data) {
    return data.map(item => {
        // Crear estructura compatible con el sistema anterior
        return {
            documento: item.documento || '',
            lote: item.lote || '',
            referencia: item.referencia || '',
            // Mantener datosSiesa en el formato esperado
            datosSiesa: [{
                factura: item.factura,
                nit: item.nit,
                lote: item.lote,
                referencia: item.referencia,
                cantidad: item.cantidad,
                estado: item.estado,
                cliente: item.cliente,
                valorBruto: item.valorBruto,
                fecha: item.fecha,
                proveedor: item.proveedor,
                confirmacion: item.confirmacion,
                fechaEntrega: item.fechaEntrega
            }]
        };
    });
}

    // Forzar actualización de datos (ignorar cache)
    async forceRefresh() {
        this.cache = null;
        this.lastUpdate = null;
        return await this.getCombinedData();
    }

    // Verificar si una factura específica está entregada
    async isFacturaEntregada(factura) {
        const data = await this.getCombinedData();
        const item = data.find(d => d.factura === factura);
        return item ? item.confirmacion === "ENTREGADO" : false;
    }

    // Obtener datos de una factura específica
    async getFacturaData(factura) {
        const data = await this.getCombinedData();
        return data.find(d => d.factura === factura);
    }
}

// Instancia global del servicio de datos
const dataService = new DataService();
