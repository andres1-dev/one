// Parser de archivos XLSX

const XLSXParser = {
  /**
   * Parsea un archivo XLSX completo
   */
  parse(arrayBuffer) {
    try {
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('El archivo XLSX no tiene hojas');
      }
      
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      if (jsonData.length === 0) {
        throw new Error('La hoja del XLSX está vacía');
      }
      
      const headers = Object.keys(jsonData[0]);
      Validators.validateHeaders(headers, 'xlsx');
      
      return jsonData.map(row => this.normalizeRecord(row));
      
    } catch (error) {
      throw new Error(`Error parseando XLSX: ${error.message}`);
    }
  },
  
  /**
   * Normaliza un registro XLSX a la estructura esperada
   */
  normalizeRecord(record) {
    const normalized = { _source: 'xlsx' };
    
    for (const key in record) {
      const lowerKey = key.toLowerCase().trim();
      const value = record[key];
      
      if (lowerKey.includes('nro') && lowerKey.includes('documento')) {
        normalized.nro_documento = Formatters.cleanText(value);
      }
      else if (lowerKey === 'referencia' || (lowerKey.includes('referencia') && !lowerKey.includes('docto'))) {
        normalized.referencia = Formatters.cleanText(value);
      }
      else if (lowerKey.includes('valor') && lowerKey.includes('subtotal')) {
        normalized.valor_subtotal = Formatters.cleanMoneyValue(value);
      }
      else if (lowerKey.includes('cantidad')) {
        normalized.cantidad = Formatters.cleanNumericValue(value);
      }
    }
    
    // Validar campos requeridos
    if (!normalized.nro_documento) {
      throw new Error('Registro sin número de documento');
    }
    if (!normalized.referencia) {
      throw new Error('Registro sin referencia');
    }
    
    return normalized;
  }
};
