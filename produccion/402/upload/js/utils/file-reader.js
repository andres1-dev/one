// Lector de archivos

const FileReader = {
  /**
   * Lee un archivo y retorna los registros parseados
   */
  async read(file, fileType) {
    return new Promise((resolve, reject) => {
      const reader = new window.FileReader();
      
      reader.onload = (e) => {
        try {
          if (fileType === 'csv') {
            const text = e.target.result;
            const records = CSVParser.parse(text);
            resolve(records);
          } else {
            const arrayBuffer = e.target.result;
            const records = XLSXParser.parse(arrayBuffer);
            resolve(records);
          }
        } catch (error) {
          reject(new Error(`Error procesando ${fileType.toUpperCase()}: ${error.message}`));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Error leyendo el archivo'));
      };
      
      if (fileType === 'csv') {
        // Usar ISO-8859-1 (Latin-1) para respetar ñ y tildes del Excel en español
        reader.readAsText(file, 'ISO-8859-1');
      } else {
        reader.readAsArrayBuffer(file);
      }
    });
  }
};
