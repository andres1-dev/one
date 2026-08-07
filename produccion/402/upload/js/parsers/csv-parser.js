// Parser de archivos CSV

const CSVParser = {
  /**
   * Parsea un archivo CSV completo
   */
  parse(text) {
    const lines = text.split('\n');
    if (lines.length < 2) {
      throw new Error('El archivo CSV está vacío o no tiene datos');
    }
    
    const headers = this.parseHeaders(lines[0]);
    Validators.validateHeaders(headers, 'csv');
    const records = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      try {
        const values = this.parseLine(lines[i]);
        const record = this.createRecord(headers, values);
        records.push(record);
      } catch (error) {
        // Ignorar líneas con error
      }
    }

    return records;
  },
  
  /**
   * Parsea los headers del CSV
   */
  parseHeaders(line) {
    return this.parseLine(line).map(h => h.trim());
  },
  
  /**
   * Parsea una línea del CSV respetando comillas
   */
  parseLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    values.push(current.trim());
    return values;
  },
  
  /**
   * Crea un objeto record a partir de headers y valores
   */
  createRecord(headers, values) {
    const record = {};
    
    headers.forEach((header, index) => {
      record[header] = values[index] || '';
    });
    
    return this.normalizeRecord(record);
  },
  
  /**
   * Normaliza un registro CSV a la estructura esperada
   */
  normalizeRecord(record) {
    const normalized = { _source: 'csv' };
    
    for (const key in record) {
      const lowerKey = key.toLowerCase().trim();
      const value = record[key];
      
      if (lowerKey.includes('nro') && lowerKey.includes('documento')) {
        normalized.nro_documento = Formatters.cleanText(value);
      }
      else if (lowerKey.includes('estado')) {
        normalized.estado = Formatters.cleanText(value);
      }
      else if (lowerKey.includes('fecha')) {
        normalized.fecha = Formatters.formatDate(value);
      }
      else if (lowerKey.includes('razón') || lowerKey.includes('razon')) {
        normalized.razon_social_cliente_factura = Formatters.cleanText(value);
      }
      else if (lowerKey.includes('docto') && lowerKey.includes('referencia')) {
        normalized.docto_referencia = Formatters.cleanText(value);
      }
      else if (lowerKey.includes('notas')) {
        normalized.notas = Formatters.cleanText(value);
      }
      else if (lowerKey.includes('compa') || lowerKey.includes('compañ')) {
        normalized.compania = Formatters.cleanText(value);
      }
    }
    
    // Validar que tenga al menos nro_documento
    if (!normalized.nro_documento) {
      throw new Error('Registro sin número de documento');
    }
    
    return normalized;
  }
};
