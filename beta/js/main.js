// nuevo.js - Sistema completo con Sheets API v4
class SheetsPandaDash {
    constructor() {
        this.API_KEY = 'AIzaSyC4QAAHwWX7dGsBm7GJN5o6tVdKb6P8L9k'; // Reemplaza con tu API Key
        this.SPREADSHEET_ID_SIESA = '1FcQhVIKtWy4O-aGTNfA6l4C5Q4_u1LZErpj3CMglfQM';
        this.SPREADSHEET_ID_SOPORTES = '1VaPBwgRu1QWhmsV_Qgf7cgraSxiAWRX6-wBEyUlGoJw';
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutos de cache
    }

    // Función para obtener datos de las hojas
    async obtenerDatosCompletos() {
        try {
            const cacheKey = 'datos_completos';
            const cached = this.getCachedData(cacheKey);
            if (cached) return cached;

            console.log('📡 Obteniendo datos desde Sheets API...');

            // Obtener datos de ambas hojas en paralelo
            const [datosSiesa, datosSoportes] = await Promise.all([
                this.obtenerDatosSiesa(),
                this.obtenerDatosSoportes()
            ]);

            const datosProcesados = this.procesarDatosCompletos(datosSiesa, datosSoportes);
            
            this.setCachedData(cacheKey, datosProcesados);
            return datosProcesados;

        } catch (error) {
            console.error('❌ Error obteniendo datos completos:', error);
            throw error;
        }
    }

    // Obtener datos de la hoja SIESA
    async obtenerDatosSiesa() {
        try {
            const ranges = [
                `${encodeURIComponent('SIESA')}!A:G`,
                `${encodeURIComponent('SIESA_V2')}!A:D`
            ];

            const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.SPREADSHEET_ID_SIESA}/values:batchGet?ranges=${ranges.join('&ranges=')}&key=${this.API_KEY}`;
            
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            
            const data = await response.json();
            
            return {
                siesa: data.valueRanges[0]?.values || [],
                siesaV2: data.valueRanges[1]?.values || []
            };

        } catch (error) {
            console.error('❌ Error obteniendo datos SIESA:', error);
            throw error;
        }
    }

    // Obtener datos de la hoja SOPORTES
    async obtenerDatosSoportes() {
        try {
            const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.SPREADSHEET_ID_SOPORTES}/values/${encodeURIComponent('SOPORTES')}!A:I?key=${this.API_KEY}`;
            
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            
            const data = await response.json();
            return data.values || [];

        } catch (error) {
            console.error('❌ Error obteniendo datos SOPORTES:', error);
            throw error;
        }
    }

    // Procesar datos completos
    procesarDatosCompletos(datosSiesa, datosSoportes) {
        const { siesa, siesaV2 } = datosSiesa;
        
        // Procesar soportes
        const soportesPorFactura = this.procesarSoportes(datosSoportes);
        
        // Procesar datos complementarios
        const datosComplementarios = this.procesarDatosComplementarios(siesaV2);
        
        // Procesar datos principales
        const datosProcesados = this.procesarDatosPrincipales(
            siesa, 
            soportesPorFactura, 
            datosComplementarios
        );

        return datosProcesados;
    }

    // Procesar datos de soportes
    procesarSoportes(datosSoportes) {
        const soportesPorFactura = {};
        
        if (!datosSoportes || datosSoportes.length <= 1) return soportesPorFactura;

        const headers = datosSoportes[0];
        const facturaIndex = headers.indexOf("Factura");
        const registroIndex = headers.indexOf("Registro");
        const urlIndex = headers.indexOf("Url_Ih3");

        for (let i = 1; i < datosSoportes.length; i++) {
            const row = datosSoportes[i];
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

    // Procesar datos complementarios de SIESA_V2
    procesarDatosComplementarios(siesaV2) {
        const complementData = {};

        for (let i = 1; i < siesaV2.length; i++) {
            const row = siesaV2[i];
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

    // Procesar datos principales
    procesarDatosPrincipales(siesa, soportesPorFactura, datosComplementarios) {
        const resultados = [];
        
        // Configuración de clientes y filtros
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

        // Funciones de ayuda
        const normalizarCliente = nombre => (nombre || '').replace(/S\.A\.S\.?/g, 'SAS').replace(/\s+/g, ' ').trim();

        const esClienteValido = (nombreCliente, listaClientes) => {
            const clienteNormalizado = normalizarCliente(nombreCliente);
            
            // Buscar coincidencia exacta primero
            const coincidenciaExacta = listaClientes.find(c => 
                normalizarCliente(c.nombre) === clienteNormalizado
            );
            
            if (coincidenciaExacta) return true;
            
            // Para clientes que comparten apellidos
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

        // Procesar filas de SIESA
        for (let i = 1; i < siesa.length; i++) {
            const row = siesa[i];
            if (!row || row.length < 7) continue;

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

            // Obtener soportes y determinar estado de entrega
            const soportes = soportesPorFactura[factura] || [];
            const fechaEntrega = soportes.length > 0 ? extraerSoloFecha(soportes[0].registro) : '';
            
            // DETERMINAR ESTADO DE CONFIRMACIÓN
            let confirmacion = '';
            if (soportes.length > 0) {
                confirmacion = "ENTREGADO";
            } else if (factura && !factura.includes('FEV') && !factura.includes('FVE')) {
                confirmacion = "PENDIENTE FACTURA";
            }

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
                confirmacion: confirmacion, // NUEVO CAMPO CRÍTICO
                documento: `REC${selectedValue}` // Crear documento único
            });
        }

        return resultados;
    }

    // Sistema de cache
    getCachedData(key) {
        const item = this.cache.get(key);
        if (item && Date.now() - item.timestamp < this.cacheTimeout) {
            return item.data;
        }
        this.cache.delete(key);
        return null;
    }

    setCachedData(key, data) {
        this.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }

    // Limpiar cache forzadamente
    clearCache() {
        this.cache.clear();
        console.log('🧹 Cache limpiado');
    }

    // Actualizar datos en tiempo real
    async actualizarDatos() {
        this.clearCache();
        return await this.obtenerDatosCompletos();
    }
}

// Sistema de gestión de estado global
class EstadoGlobal {
    constructor() {
        this.datos = [];
        this.escaneosActivos = new Set();
        this.subidasPendientes = new Map();
        this.sheetsAPI = new SheetsPandaDash();
    }

    // Cargar datos iniciales
    async cargarDatosIniciales() {
        try {
            console.log('🔄 Cargando datos iniciales...');
            this.datos = await this.sheetsAPI.obtenerDatosCompletos();
            console.log(`✅ ${this.datos.length} registros cargados`);
            return this.datos;
        } catch (error) {
            console.error('❌ Error cargando datos iniciales:', error);
            throw error;
        }
    }

    // Actualizar datos en tiempo real
    async actualizarDatos() {
        try {
            console.log('🔄 Actualizando datos en tiempo real...');
            const nuevosDatos = await this.sheetsAPI.actualizarDatos();
            this.datos = nuevosDatos;
            console.log(`✅ ${this.datos.length} registros actualizados`);
            return this.datos;
        } catch (error) {
            console.error('❌ Error actualizando datos:', error);
            throw error;
        }
    }

    // Verificar si una factura ya fue entregada
    verificarEntrega(factura) {
        const registro = this.datos.find(item => item.factura === factura);
        if (!registro) return false;
        
        return registro.confirmacion === "ENTREGADO";
    }

    // Registrar escaneo activo
    registrarEscaneo(factura) {
        if (this.verificarEntrega(factura)) {
            return false; // Ya está entregado, no permitir nuevo escaneo
        }
        this.escaneosActivos.add(factura);
        return true;
    }

    // Liberar escaneo activo
    liberarEscaneo(factura) {
        this.escaneosActivos.delete(factura);
    }

    // Registrar subida pendiente
    registrarSubidaPendiente(factura, jobId) {
        this.subidasPendientes.set(factura, {
            jobId: jobId,
            timestamp: Date.now(),
            intentos: 0
        });
    }

    // Eliminar subida pendiente
    eliminarSubidaPendiente(factura) {
        this.subidasPendientes.delete(factura);
    }

    // Verificar si hay subida pendiente
    tieneSubidaPendiente(factura) {
        return this.subidasPendientes.has(factura);
    }

    // Obtener datos para display
    obtenerDatosParaDisplay() {
        return this.datos;
    }

    // Buscar por documento y NIT
    buscarPorDocumentoYNit(documento, nit) {
        return this.datos.filter(item => 
            item.documento === documento && 
            item.nit.includes(nit)
        );
    }
}

// Integración con el sistema existente
class SistemaPandaDashIntegrado {
    constructor() {
        this.estadoGlobal = new EstadoGlobal();
        this.sheetsAPI = new SheetsPandaDash();
        this.inicializado = false;
    }

    // Inicializar sistema
    async inicializar() {
        try {
            await this.estadoGlobal.cargarDatosIniciales();
            this.inicializado = true;
            
            // Configurar actualización automática cada 2 minutos
            setInterval(() => {
                this.actualizarEnSegundoPlano();
            }, 2 * 60 * 1000);

            console.log('🚀 Sistema PandaDash integrado inicializado');
            return true;
        } catch (error) {
            console.error('❌ Error inicializando sistema:', error);
            return false;
        }
    }

    // Actualizar en segundo plano
    async actualizarEnSegundoPlano() {
        try {
            await this.estadoGlobal.actualizarDatos();
            console.log('🔄 Datos actualizados en segundo plano');
        } catch (error) {
            console.error('❌ Error en actualización en segundo plano:', error);
        }
    }

    // Procesar escaneo de QR
    async procesarQR(documento, nit) {
        if (!this.inicializado) {
            throw new Error('Sistema no inicializado');
        }

        const resultados = this.estadoGlobal.buscarPorDocumentoYNit(documento, nit);
        
        // Verificar entregas y actualizar estado
        const resultadosActualizados = resultados.map(item => {
            const entregado = this.estadoGlobal.verificarEntrega(item.factura);
            return {
                ...item,
                confirmacion: entregado ? "ENTREGADO" : item.confirmacion
            };
        });

        return resultadosActualizados;
    }

    // Verificar si se puede procesar entrega
    async verificarEntrega(factura) {
        if (!this.inicializado) return false;

        // Actualizar datos antes de verificar
        await this.actualizarEnSegundoPlano();

        const puedeProcesar = !this.estadoGlobal.verificarEntrega(factura) && 
                             !this.estadoGlobal.tieneSubidaPendiente(factura);

        if (puedeProcesar) {
            this.estadoGlobal.registrarEscaneo(factura);
        }

        return puedeProcesar;
    }

    // Confirmar entrega exitosa
    async confirmarEntrega(factura, jobId) {
        if (!this.inicializado) return;

        this.estadoGlobal.registrarSubidaPendiente(factura, jobId);
        
        // Esperar un momento y actualizar para reflejar el cambio
        setTimeout(async () => {
            await this.estadoGlobal.actualizarDatos();
            this.estadoGlobal.eliminarSubidaPendiente(factura);
            this.estadoGlobal.liberarEscaneo(factura);
        }, 3000);
    }

    // Obtener datos para UI
    obtenerDatosUI() {
        return this.estadoGlobal.obtenerDatosParaDisplay();
    }

    // Forzar actualización manual
    async forzarActualizacion() {
        try {
            await this.estadoGlobal.actualizarDatos();
            return true;
        } catch (error) {
            console.error('❌ Error forzando actualización:', error);
            return false;
        }
    }
}

// Instancia global del sistema
const sistemaPandaDash = new SistemaPandaDashIntegrado();

// Inicialización automática al cargar
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const exito = await sistemaPandaDash.inicializar();
        if (exito) {
            console.log('✅ Sistema PandaDash listo');
            // Integrar con UI existente
            if (window.integracionUI) {
                window.integracionUI.sistemaListo();
            }
        } else {
            console.error('❌ Sistema PandaDash no pudo inicializarse');
        }
    } catch (error) {
        console.error('❌ Error en inicialización:', error);
    }
});

// Exportar para uso global
window.sistemaPandaDash = sistemaPandaDash;
window.SheetsPandaDash = SheetsPandaDash;
