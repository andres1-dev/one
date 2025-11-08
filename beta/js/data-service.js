// Servicio de datos con Sheets API v4
class DataService {
    constructor() {
        this.API_KEY = 'AIzaSyC7hjbRc0TGLgImv8gVZg8tsOeYWgXlPcM';
        this.SPREADSHEET_ID_SIESA = '1FcQhVIKtWy4O-aGTNfA6l4C5Q4_u1LZErpj3CMglfQM';
        this.SPREADSHEET_ID_SOPORTES = '1VaPBwgRu1QWhmsV_Qgf7cgraSxiAWRX6-wBEyUlGoJw';
        this.lastUpdate = null;
        this.currentData = [];
    }

    // Obtener datos en tiempo real sin cache
    async getRealTimeData() {
        try {
            console.log('🔄 Obteniendo datos en tiempo real...');
            
            // Obtener datos de ambas fuentes simultáneamente
            const [siesaData, soportesData] = await Promise.all([
                this.getSiesaData(),
                this.getSoportesData()
            ]);

            // Procesar y combinar datos
            const processedData = this.processData(siesaData, soportesData);
            
            this.currentData = processedData;
            this.lastUpdate = new Date();
            
            console.log(`✅ Datos actualizados: ${processedData.length} registros`);
            return processedData;
            
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
            `ranges=${ranges.map(range => encodeURIComponent(range)).join('&ranges=')}&key=${this.API_KEY}`,
            {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Error Sheets API: ${response.status}`);
        }

        const data = await response.json();
        return {
            siesa: data.valueRanges[0].values || [],
            siesaV2: data.valueRanges[1].values || []
        };
    }

    // Obtener datos de soportes
    async getSoportesData() {
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${this.SPREADSHEET_ID_SOPORTES}/values/SOPORTES!A:I?key=${this.API_KEY}`,
            {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Error Sheets API Soportes: ${response.status}`);
        }

        const data = await response.json();
        return data.values || [];
    }

    // Procesar y combinar datos (basado en la lógica del GAS)
    processData(siesaData, soportesData) {
        const { siesa, siesaV2 } = siesaData;
        
        // Procesar soportes
        const soportesPorFactura = this.processSoportes(soportesData);
        
        // Procesar datos complementarios de SIESA_V2
        const datosComplementarios = this.processComplementarios(siesaV2);
        
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
        
        return this.processDatosPrincipales(
            siesa,
            soportesPorFactura,
            datosComplementarios,
            clientesEspecificos,
            estadosExcluir,
            prefijosValidos
        );
    }

    processSoportes(soportesData) {
        if (soportesData.length <= 1) return {};
        
        const headers = soportesData[0];
        const facturaIndex = headers.indexOf("Factura");
        const registroIndex = headers.indexOf("Registro");
        const urlIndex = headers.indexOf("Url_Ih3");
        
        if (facturaIndex === -1 || registroIndex === -1 || urlIndex === -1) {
            throw new Error("Columnas requeridas no encontradas en SOPORTES");
        }
        
        const soportesPorFactura = {};
        
        for (let i = 1; i < soportesData.length; i++) {
            const row = soportesData[i];
            if (row.length > Math.max(facturaIndex, registroIndex, urlIndex)) {
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
    }

    processComplementarios(siesaV2) {
        const complementData = {};
        
        for (let i = 1; i < siesaV2.length; i++) {
            const row = siesaV2[i];
            if (row.length >= 3) {
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

    processDatosPrincipales(dataSiesa, soportesPorFactura, datosComplementarios, clientesEspecificos, estadosExcluir, prefijosValidos) {
        const resultados = [];
        
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
                
                const palabrasCliente = clienteNormalizado.split(' ');
                const palabrasLista = clienteListaNormalizado.split(' ');
                
                if (palabrasCliente.length > 2 && palabrasLista.length > 2) {
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
            if (row.length < 7) continue;
            
            const estado = row[0] || '';
            const factura = row[1] || '';
            const nombreClienteOriginal = row[3] || '';
            
            // Aplicar filtros
            if (estadosExcluir.includes(estado)) continue;
            if (!tienePrefijoValido(factura)) continue;
            if (!esClienteValido(nombreClienteOriginal, clientesEspecificos)) continue;
            
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
            
            // Obtener soportes y determinar confirmación
            const soportes = soportesPorFactura[factura] || [];
            const fechaEntrega = soportes.length > 0 ? extraerSoloFecha(soportes[0].registro) : '';
            
            // DETERMINAR CONFIRMACIÓN BASADA EN SOPORTES
            const confirmacion = soportes.length > 0 ? "ENTREGADO" : "PENDIENTE";
            
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
                confirmacion: confirmacion, // NUEVO CAMPO CRÍTICO
                soportes: soportes
            });
        }
        
        return resultados;
    }

    // Verificar si una factura específica está confirmada
    isFacturaConfirmed(factura) {
        const registro = this.currentData.find(item => item.factura === factura);
        return registro ? registro.confirmacion === "ENTREGADO" : false;
    }

    // Obtener datos de una factura específica
    getFacturaData(factura) {
        return this.currentData.find(item => item.factura === factura);
    }

    // Obtener tiempo desde última actualización
    getTimeSinceLastUpdate() {
        return this.lastUpdate ? new Date() - this.lastUpdate : null;
    }
}

// Instancia global del servicio de datos
const dataService = new DataService();
