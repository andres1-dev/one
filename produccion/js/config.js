// Configuración global del sistema SIESA 
const SiesaConfig = {
  // URL de las Edge Functions de Supabase
  FUNCTIONS_URL: 'https://iladaofarozipitwaeti.supabase.co/functions/v1',
  
  // Configuración de archivos
  FILES: {
    MAX_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_TYPES: {
      CSV: ['text/csv', '.csv'],
      XLSX: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.xlsx']
    }
  },
  
  // Configuración de procesamiento
  PROCESSING: {
    BATCH_SIZE: 250, // Registros por lote para enviar a Supabase
    DELAY_BETWEEN_BATCHES: 100 // ms entre lotes
  },
  
  // Mapeo de columnas esperadas
  COLUMNS: {
    CSV: {
      ESTADO: 'estado',
      NRO_DOCUMENTO: 'nro_documento',
      FECHA: 'fecha',
      RAZON_SOCIAL: 'razon_social_cliente_factura',
      DOCTO_REFERENCIA: 'docto_referencia',
      NOTAS: 'notas',
      COMPANIA: 'compania'
    },
    XLSX: {
      NRO_DOCUMENTO: 'nro_documento',
      VALOR_SUBTOTAL: 'valor_subtotal',
      REFERENCIA: 'referencia',
      CANTIDAD: 'cantidad'
    }
  },
  
  // Constantes
  CONSTANTS: {
    REFVAR: 'REFVAR' // Valor para referencias múltiples
  }
};
