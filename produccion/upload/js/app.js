// Aplicación principal SIESA

const SiesaApp = {
  selectedFiles: [],
  isProcessing: false,
  
  /**
   * Inicializa la aplicación
   */
  init() {
    this.setupEventListeners();
    this.setupDragAndDrop();
    UIController.showConnected();
  },
  
  /**
   * Configura los event listeners
   */
  setupEventListeners() {
    document.getElementById('uploadArea').addEventListener('click', () => {
      document.getElementById('fileInput').click();
    });
    
    document.getElementById('fileInput').addEventListener('change', (e) => {
      this.handleFileSelect(e);
    });
  },
  
  /**
   * Configura drag and drop
   */
  setupDragAndDrop() {
    const dropzone = document.getElementById('uploadArea');
    
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('active');
    });
    
    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('active');
    });
    
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('active');
      this.handleDroppedFiles(e.dataTransfer.files);
    });
  },
  
  /**
   * Maneja la selección de archivos
   */
  handleFileSelect(e) {
    this.handleDroppedFiles(e.target.files);
    e.target.value = '';
  },
  
  /**
   * Maneja archivos arrastrados
   */
  handleDroppedFiles(fileList) {
    const files = Array.from(fileList);
    
    let addedFiles = false;
    
    for (const file of files) {
      // Validar tipo
      if (!Validators.validateFileType(file)) {
        UIController.showAlert('warning', 'Formato no soportado', 
          `"${file.name}" no es un archivo válido. Solo se aceptan CSV y XLSX`);
        continue;
      }
      
      // Validar tamaño
      if (!Validators.validateFileSize(file)) {
        UIController.showAlert('warning', 'Archivo muy grande',
          `"${file.name}" excede el límite de 10MB. Tamaño: ${Formatters.formatFileSize(file.size)}`);
        continue;
      }
      
      // Evitar duplicados
      const isDuplicate = this.selectedFiles.some(f => 
        f.name === file.name && f.size === file.size
      );
      
      if (isDuplicate) {
        UIController.showAlert('info', 'Archivo duplicado', 
          `"${file.name}" ya está en la lista`);
        continue;
      }
      
      // Agregar archivo
      this.selectedFiles.push({
        file: file,
        name: file.name,
        type: Validators.getFileType(file),
        size: file.size,
        status: 'waiting'
      });
      addedFiles = true;
    }
    
    UIController.updateFileList(this.selectedFiles);
    
    if (addedFiles) {
      setTimeout(() => {
        this.processFiles();
      }, 500);
    }
  },
  
  /**
   * Procesa todos los archivos
   */
  async processFiles() {
    if (this.isProcessing || this.selectedFiles.length === 0) return;
    
    this.isProcessing = true;
    
    try {
      
      // 1. Leer todos los archivos
      const allRecords = [];
      
      for (let i = 0; i < this.selectedFiles.length; i++) {
        const fileData = this.selectedFiles[i];
        
        if (fileData.status === 'waiting') {
          this.selectedFiles[i].status = 'processing';
          UIController.updateFileList(this.selectedFiles);
          
          const records = await FileReader.read(fileData.file, fileData.type);
          allRecords.push(...records);
        }
      }
      
      // 2. Unificar CSV + XLSX
      const unified = Unifier.unify(allRecords);
      
      // 3. Consolidar por nro_documento
      const consolidated = Consolidator.consolidate(unified);
      
      // 4. Subir a Supabase
      const result = await Uploader.upload(consolidated);
      
      // Actualizar estados
      this.selectedFiles.forEach(f => {
        if (f.status === 'processing') f.status = 'success';
      });
      UIController.updateFileList(this.selectedFiles);
      
      // Mostrar resultados
      UIController.showResults(result, allRecords.length, consolidated.length);
      
    } catch (error) {
      console.error('[ERROR] Proceso fallido:', error);
      
      this.selectedFiles.forEach(f => {
        if (f.status === 'processing') f.status = 'error';
      });
      UIController.updateFileList(this.selectedFiles);
      UIController.showAlert('error', 'Error de procesamiento', error.message);
      
    } finally {
      this.isProcessing = false;
    }
  },
  
  /**
   * Limpia todos los archivos
   */
  clearAllFiles() {
    this.selectedFiles = [];
    UIController.updateFileList(this.selectedFiles);
  },
  
  /**
   * Remueve un archivo específico
   */
  removeFile(index) {
    this.selectedFiles.splice(index, 1);
    UIController.updateFileList(this.selectedFiles);
  }
};

// Función global para remover archivos (llamada desde HTML)
function removeFile(index) {
  SiesaApp.removeFile(index);
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  SiesaApp.init();
});
