// Configuración de Sheets API v4
const SHEETS_API_CONFIG = {
  API_KEY: 'AIzaSyC7hjbRc0TGLgImv8gVZg8tsOeYWgXlPcM', // Reemplazar con tu API Key real
  SPREADSHEET_ID_SIESA: '1FcQhVIKtWy4O-aGTNfA6l4C5Q4_u1LZErpj3CMglfQM',
  SPREADSHEET_ID_SOPORTES: '1VaPBwgRu1QWhmsV_Qgf7cgraSxiAWRX6-wBEyUlGoJw',
  RANGES: {
    SIESA: 'SIESA!A:G',
    SIESA_V2: 'SIESA_V2!A:D',
    SOPORTES: 'SOPORTES!A:I'
  }
};

// Clase para manejar la comunicación con Google Sheets API
class SheetsAPI {
  constructor() {
    this.baseURL = 'https://sheets.googleapis.com/v4/spreadsheets';
    this.apiKey = SHEETS_API_CONFIG.API_KEY;
    this.cache = new Map();
    this.cacheTimeout = 30000; // 30 segundos de cache
  }

  // Método genérico para hacer requests a Sheets API
  async makeRequest(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error en Sheets API request:', error);
      throw error;
    }
  }

  // Obtener datos de un rango específico
  async getRangeData(spreadsheetId, range) {
    const cacheKey = `${spreadsheetId}-${range}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    const url = `${this.baseURL}/${spreadsheetId}/values/${range}?key=${this.apiKey}`;
    const data = await this.makeRequest(url);
    
    this.cache.set(cacheKey, {
      data: data.values || [],
      timestamp: Date.now()
    });
    
    return data.values || [];
  }

  // Obtener datos de soportes
  async getSoportesData() {
    try {
      const values = await this.getRangeData(
        SHEETS_API_CONFIG.SPREADSHEET_ID_SOPORTES,
        SHEETS_API_CONFIG.RANGES.SOPORTES
      );

      if (values.length <= 1) return {};

      const headers = values[0];
      const facturaIndex = headers.indexOf("Factura");
      const registroIndex = headers.indexOf("Registro");
      const urlIndex = headers.indexOf("Url_Ih3");

      if (facturaIndex === -1 || registroIndex === -1 || urlIndex === -1) {
        throw new Error("Columnas requeridas no encontradas en SOPORTES");
      }

      const soportesPorFactura = {};

      for (let i = 1; i < values.length; i++) {
        const row = values[i];
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
      console.error("Error obteniendo datos de soportes:", error);
      return {};
    }
  }

  // Obtener datos de SIESA y SIESA_V2
  async getSiesaData() {
    try {
      const [siesaData, siesaV2Data] = await Promise.all([
        this.getRangeData(
          SHEETS_API_CONFIG.SPREADSHEET_ID_SIESA,
          SHEETS_API_CONFIG.RANGES.SIESA
        ),
        this.getRangeData(
          SHEETS_API_CONFIG.SPREADSHEET_ID_SIESA,
          SHEETS_API_CONFIG.RANGES.SIESA_V2
        )
      ]);

      return { siesaData, siesaV2Data };
    } catch (error) {
      console.error("Error obteniendo datos de SIESA:", error);
      return { siesaData: [], siesaV2Data: [] };
    }
  }

  // Limpiar cache
  clearCache() {
    this.cache.clear();
  }

  // Forzar actualización de datos específicos
  async forceRefresh() {
    this.clearCache();
    return await this.getAllData();
  }

  // Obtener todos los datos procesados
  async getAllData() {
    try {
      const [soportesData, siesaData] = await Promise.all([
        this.getSoportesData(),
        this.getSiesaData()
      ]);

      return this.processData(siesaData.siesaData, siesaData.siesaV2Data, soportesData);
    } catch (error) {
      console.error("Error obteniendo todos los datos:", error);
      throw error;
    }
  }

  // Procesar los datos (similar a tu lógica de GAS)
  processData(dataSiesa, dataSiesaV2, soportesPorFactura) {
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
    const datosComplementarios = this.procesarDatosComplementarios(dataSiesaV2);
    
    // Procesar datos principales
    return this.procesarDatosPrincipales(
      dataSiesa,
      soportesPorFactura,
      datosComplementarios,
      clientesEspecificos,
      estadosExcluir,
      prefijosValidos
    );
  }

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

  procesarDatosPrincipales(
    dataSiesa,
    soportesPorFactura,
    datosComplementarios,
    clientesEspecificos,
    estadosExcluir,
    prefijosValidos
  ) {
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

      // Obtener soportes y fecha de entrega
      const soportes = soportesPorFactura[factura] || [];
      const fechaEntrega = soportes.length > 0 ? extraerSoloFecha(soportes[0].registro) : '';

      // Determinar proveedor
      let proveedor = '';
      if (col6Value == "5") proveedor = "TEXTILES Y CREACIONES EL UNIVERSO SAS";
      if (col6Value == "3") proveedor = "TEXTILES Y CREACIONES LOS ANGELES SAS";

      // Determinar estado de confirmación
      let confirmacion = '';
      if (soportes.length > 0) {
        confirmacion = "ENTREGADO";
      } else if (estado === "Aprobadas") {
        confirmacion = "PENDIENTE FACTURA";
      }

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
        confirmacion: confirmacion,
        documento: `${selectedValue}-${obtenerNitCliente(nombreClienteOriginal)}` // Para búsqueda por QR
      });
    }

    return resultados;
  }

  // Buscar datos específicos por documento (para el escaneo QR)
  async buscarPorDocumento(documento) {
    const allData = await this.getAllData();
    return allData.filter(item => item.documento === documento);
  }

  // Verificar si una factura ya fue entregada
  async verificarEntregaFactura(factura) {
    const allData = await this.getAllData();
    const item = allData.find(item => item.factura === factura);
    return item ? item.confirmacion === "ENTREGADO" : false;
  }

  // Obtener estadísticas actualizadas
  async getStats() {
    const allData = await this.getAllData();
    const total = allData.length;
    const entregados = allData.filter(item => item.confirmacion === "ENTREGADO").length;
    const pendientes = allData.filter(item => item.confirmacion === "PENDIENTE FACTURA").length;

    return {
      total,
      entregados,
      pendientes,
      ultimaActualizacion: new Date().toISOString()
    };
  }
}

// Instancia global de SheetsAPI
const sheetsAPI = new SheetsAPI();
