// Controlador de interfaz de usuario

const UIController = {
  /**
   * Muestra estado conectado
   */
  showConnected() {
    const miniStatus = document.getElementById('miniStatus');
    if (miniStatus) {
        miniStatus.style.opacity = '1';
        miniStatus.style.filter = 'drop-shadow(0 0 2px rgba(62, 207, 142, 0.4))';
    }
  },
  
  /**
   * Actualiza la lista de archivos
   */
  updateFileList(files) {
    const container = document.getElementById('filesContainer');
    const list = document.getElementById('fileList');
    const count = document.getElementById('filesCount');
    const uploadArea = document.getElementById('uploadArea');
    const btnProcess = document.getElementById('btnProcess');
    const resultsSection = document.getElementById('resultsSection');
    
    list.innerHTML = '';
    
    if (files.length === 0) {
      container.style.display = 'none';
      resultsSection.style.display = 'none';
      uploadArea.style.display = 'block';
      return;
    }
    
    uploadArea.style.display = 'none';
    resultsSection.style.display = 'none';
    container.style.display = 'block';
    
    count.textContent = `${files.length} archivo(s)`;
    
    files.forEach((file, index) => {
      const fileElement = document.createElement('div');
      fileElement.className = 'file-item fade-in';
      fileElement.innerHTML = `
        <div class="file-icon ${file.type}">
          <i class="fa-solid ${file.type === 'csv' ? 'fa-file-csv' : 'fa-file-excel'}"></i>
        </div>
        <div class="file-info">
          <div class="file-name">${file.name}</div>
          <div class="file-meta">
            <i class="fa-solid fa-hard-drive me-1"></i>${Formatters.formatFileSize(file.size)}
            <span class="mx-2">•</span>
            <i class="fa-regular fa-calendar-alt me-1"></i>${new Date().toLocaleTimeString()}
          </div>
        </div>
        <div class="file-status">
          <span class="status-badge status-${file.status}">
            <i class="${this.getStatusIcon(file.status)}"></i>
            ${this.getStatusText(file.status)}
          </span>
          <button class="btn btn-sm btn-link text-danger ms-2" onclick="removeFile(${index})" title="Eliminar">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      `;
      list.appendChild(fileElement);
    });
  },
  
  /**
   * Muestra los resultados
   */
  showResults(result, totalRecords, consolidatedCount) {
    const section = document.getElementById('resultsSection');
    const content = document.getElementById('resultsContent');
    const container = document.getElementById('filesContainer');
    
    // Ocultar sección de archivos
    container.style.display = 'none';
    
    let html = `
      <div class="summary-card fade-in">
        <h5 class="fw-semibold mb-3">
          <i class="fa-solid fa-clipboard-check me-2"></i>Resumen del Proceso
        </h5>
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-value">${totalRecords}</div>
            <div class="stat-label">Registros Leídos</div>
          </div>
          <div class="stat-item">
            <div class="stat-value text-primary">${consolidatedCount}</div>
            <div class="stat-label">Documentos Únicos</div>
          </div>
          <div class="stat-item">
            <div class="stat-value text-success">${result.success || 0}</div>
            <div class="stat-label">Nuevos Subidos</div>
          </div>
          <div class="stat-item">
            <div class="stat-value text-warning">${result.ignored || 0}</div>
            <div class="stat-label">Omitidos (Ya existen)</div>
          </div>
          <div class="stat-item">
            <div class="stat-value text-danger">${result.failed || 0}</div>
            <div class="stat-label">Fallidos</div>
          </div>
        </div>
        <p class="mt-3 mb-0">
          <i class="fa-solid fa-circle-info me-1"></i>
          <strong>Consolidación automática: ${totalRecords - consolidatedCount} registros consolidados</strong>
        </p>
        <hr class="my-4" style="border-color: #e2e8f0;">
        <div class="text-center">
            <button class="btn btn-outline-primary" onclick="SiesaApp.clearAllFiles()">
                <i class="fa-solid fa-rotate-left me-2"></i>Nueva Carga
            </button>
        </div>
      </div>
    `;
    
    if (result.errors && result.errors.length > 0) {
      html += '<h6 class="fw-semibold mb-3 text-danger">Errores encontrados:</h6>';
      result.errors.forEach(error => {
        html += `
          <div class="file-result error fade-in">
            <i class="fa-solid fa-triangle-exclamation text-danger me-2"></i>
            ${error}
          </div>
        `;
      });
    }
    
    content.innerHTML = html;
    section.style.display = 'block';
    
    // Relacionar con la interfaz principal: refrescar y cerrar modal
    if (result.success > 0) {
        if (typeof cargarDatos === 'function') {
            // Usamos las fechas actuales de flatpickr si está disponible
            if (window.flatpickrInstance && window.flatpickrInstance.selectedDates.length === 2) {
                cargarDatos(window.flatpickrInstance.selectedDates[0], window.flatpickrInstance.selectedDates[1]);
            } else if (typeof getPrimerDiaMes === 'function') {
                // Fallback a mes actual
                cargarDatos(getPrimerDiaMes(), getHoy());
            }
        }
        
        // Auto-cierre del modal en 2 segundos
        setTimeout(() => {
            const modalEl = document.getElementById('uploadModal');
            if (modalEl) {
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
            }
            // Limpiamos los archivos seleccionados para la próxima carga
            if (typeof SiesaApp !== 'undefined') SiesaApp.clearAllFiles();
        }, 2000);
    }
    
    setTimeout(() => {
      section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 300);
  },
  
  /**
   * Muestra una alerta
   */
  showAlert(type, title, message) {
    alert(`${title}\n\n${message}`);
  },
  
  /**
   * Obtiene el icono según el estado
   */
  getStatusIcon(status) {
    const icons = {
      'waiting': 'fa-regular fa-clock',
      'processing': 'fa-solid fa-rotate fa-spin',
      'success': 'fa-solid fa-circle-check',
      'error': 'fa-solid fa-circle-exclamation'
    };
    return icons[status] || 'fa-solid fa-circle-question';
  },
  
  /**
   * Obtiene el texto según el estado
   */
  getStatusText(status) {
    const texts = {
      'waiting': 'En espera',
      'processing': 'Procesando',
      'success': 'Completado',
      'error': 'Error'
    };
    return texts[status] || status;
  }
};
