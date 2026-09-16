/**
 * Vista de KPIs - Muestra indicadores clave de rendimiento desde Google Sheets
 */
export class KPIsView {
  constructor({ obtenerKPIsUseCase }) {
    this.obtenerKPIsUseCase = obtenerKPIsUseCase;
    this.container = null;
    this.kpisData = null;
  }

  render() {
    // Crear contenedor si no existe
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'kpis-container';
      this.container.className = 'kpis-panel';
      
      // Insertar en el contenido del panel de KPIs
      const kpisContent = document.getElementById('panel-kpis-content');
      if (kpisContent) {
        kpisContent.appendChild(this.container);
      }
    }

    this._renderContent();
    this._loadKPIs();
  }

  _renderContent() {
    this.container.innerHTML = `
      <div class="kpis-header">
        <h3>KPIs desde Google Sheets</h3>
        <button id="refresh-kpis" class="refresh-btn">
          <span class="codicon codicon-refresh"></span>
        </button>
      </div>
      <div id="kpis-content" class="kpis-content">
        <div class="loading-state">Cargando KPIs...</div>
      </div>
    `;

    // Agregar event listener para el botón de refresh
    const refreshBtn = document.getElementById('refresh-kpis');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this._loadKPIs());
    }
  }

  async _loadKPIs() {
    const content = document.getElementById('kpis-content');
    if (!content) return;

    try {
      content.innerHTML = '<div class="loading-state">Cargando KPIs...</div>';
      
      this.kpisData = await this.obtenerKPIsUseCase.execute();
      this._renderKPIs(content);
    } catch (error) {
      content.innerHTML = `
        <div class="error-state">
          <span class="codicon codicon-error"></span>
          <p>Error al cargar KPIs: ${error.message}</p>
        </div>
      `;
    }
  }

  _renderKPIs(container) {
    if (!this.kpisData || Object.keys(this.kpisData).length === 0) {
      container.innerHTML = '<div class="empty-state">No hay datos de KPIs disponibles</div>';
      return;
    }

    let html = '<div class="kpis-grid">';
    
    // Renderizar cada KPI
    for (const [key, value] of Object.entries(this.kpisData)) {
      const formattedValue = this._formatKPIValue(key, value);
      const label = this._formatKPILabel(key);
      
      html += `
        <div class="kpi-card">
          <div class="kpi-label">${label}</div>
          <div class="kpi-value">${formattedValue}</div>
        </div>
      `;
    }
    
    html += '</div>';
    container.innerHTML = html;
  }

  _formatKPIValue(key, value) {
    // Formatear según el tipo de KPI
    if (typeof value === 'number') {
      if (key.toLowerCase().includes('tiempo') || key.toLowerCase().includes('segundos')) {
        return `${value.toFixed(2)}s`;
      } else if (key.toLowerCase().includes('porcentaje') || key.toLowerCase().includes('%')) {
        return `${value.toFixed(1)}%`;
      } else {
        return value.toLocaleString();
      }
    }
    return String(value);
  }

  _formatKPILabel(key) {
    // Convertir camelCase a título legible
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  destroy() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}