// Unificador de registros CSV + XLSX

const Unifier = {
  /**
   * Unifica registros de CSV y XLSX por nro_documento
   */
  unify(allRecords) {
    // Separar registros por tipo
    const csvRecords = new Map();
    const xlsxRecords = [];
    
    for (const record of allRecords) {
      if (record._source === 'csv') {
        // CSV: datos maestros (1 por documento)
        csvRecords.set(record.nro_documento, {
          estado: record.estado,
          fecha: record.fecha,
          razon_social_cliente_factura: record.razon_social_cliente_factura,
          docto_referencia: record.docto_referencia,
          notas: record.notas,
          compania: record.compania
        });
      } else if (record._source === 'xlsx') {
        // XLSX: detalles (puede haber N por documento)
        xlsxRecords.push(record);
      }
    }
    
    // Unir XLSX con datos del CSV
    const unified = [];
    const missingInCSV = new Set();
    
    for (const xlsxRecord of xlsxRecords) {
      const csvData = csvRecords.get(xlsxRecord.nro_documento);
      
      if (!csvData) {
        missingInCSV.add(xlsxRecord.nro_documento);
        // Continuar sin datos del CSV (solo con datos del XLSX)
        unified.push({
          nro_documento: xlsxRecord.nro_documento,
          referencia: xlsxRecord.referencia,
          valor_subtotal: xlsxRecord.valor_subtotal,
          cantidad: xlsxRecord.cantidad
        });
      } else {
        // Unir datos del CSV con datos del XLSX
        unified.push({
          ...csvData,
          nro_documento: xlsxRecord.nro_documento,
          referencia: xlsxRecord.referencia,
          valor_subtotal: xlsxRecord.valor_subtotal,
          cantidad: xlsxRecord.cantidad
        });
      }
    }
    
    return unified;
  }
};
