// Utilidades de formateo

const Formatters = {
  /**
   * Formatea el tamaño de archivo en formato legible
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },
  
  /**
   * Limpia valores monetarios (quita $, comas, etc.)
   */
  cleanMoneyValue(value) {
    if (typeof value === 'number') return value;
    return parseFloat(String(value).replace(/[$,]/g, '').trim()) || 0;
  },
  
  /**
   * Limpia valores numéricos
   */
  cleanNumericValue(value) {
    if (typeof value === 'number') return value;
    return parseFloat(String(value).replace(/,/g, '').trim()) || 0;
  },
  
  /**
   * Limpia texto (trim y normalización)
   */
  cleanText(value) {
    return String(value || '').trim();
  },
  
  /**
   * Formatea fecha
   */
  formatDate(dateString) {
    if (!dateString) return null;
    // Intentar parsear la fecha
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? dateString : date.toISOString().split('T')[0];
  }
};
