// Utilidades de validación

const Validators = {
  /**
   * Valida si un archivo es del tipo correcto
   */
  validateFileType(file) {
    const fileName = file.name.toLowerCase();
    const fileType = file.type;
    
    const isCSV = SiesaConfig.FILES.ALLOWED_TYPES.CSV.some(type => 
      fileName.endsWith(type) || fileType === type
    );
    
    const isXLSX = SiesaConfig.FILES.ALLOWED_TYPES.XLSX.some(type => 
      fileName.endsWith(type) || fileType === type
    );
    
    return isCSV || isXLSX;
  },
  
  /**
   * Valida el tamaño del archivo
   */
  validateFileSize(file) {
    return file.size <= SiesaConfig.FILES.MAX_SIZE;
  },
  
  /**
   * Obtiene el tipo de archivo (csv o xlsx)
   */
  getFileType(file) {
    const fileName = file.name.toLowerCase();
    
    if (fileName.endsWith('.csv')) return 'csv';
    if (fileName.endsWith('.xlsx')) return 'xlsx';
    
    return null;
  },
  
  validateRecord(record, fileType) {
    if (fileType === 'csv') {
      return record.nro_documento && record.nro_documento.trim() !== '';
    } else {
      return record.nro_documento && 
             record.referencia && 
             record.valor_subtotal !== undefined &&
             record.cantidad !== undefined;
    }
  },
  
  /**
   * Valida estrictamente los encabezados del archivo
   */
  validateHeaders(headers, fileType) {
    const headerStr = headers.map(h => String(h).toLowerCase().trim()).join(' ');
    let required = [];
    
    if (fileType === 'csv') {
      required = ['estado', 'documento', 'fecha', 'raz', 'referencia', 'notas', 'compa'];
    } else {
      required = ['documento', 'referencia', 'valor', 'cantidad'];
    }
    
    const missing = required.filter(key => !headerStr.includes(key));
    if (missing.length > 0) {
      const typeStr = fileType === 'csv' ? 'CSV (Maestro)' : 'Excel (Detalles)';
      throw new Error(`El archivo ${typeStr} no tiene la estructura de columnas correcta de SIESA. Formato inválido.`);
    }
    return true;
  }
};
