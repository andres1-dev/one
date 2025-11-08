// Gestor de datos con actualización en tiempo real
class DataManager {
  constructor() {
    this.data = [];
    this.listeners = new Set();
    this.isRefreshing = false;
    this.autoRefreshInterval = null;
    this.stats = {
      total: 0,
      entregados: 0,
      pendientes: 0,
      ultimaActualizacion: null
    };
  }

  // Agregar listener para cambios de datos
  addListener(callback) {
    this.listeners.add(callback);
  }

  // Remover listener
  removeListener(callback) {
    this.listeners.delete(callback);
  }

  // Notificar a todos los listeners
  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.data, this.stats);
      } catch (error) {
        console.error('Error en listener:', error);
      }
    });
  }

  // Cargar datos iniciales
  async loadInitialData() {
    try {
      this.data = await sheetsAPI.getAllData();
      await this.updateStats();
      this.notifyListeners();
      return this.data;
    } catch (error) {
      console.error('Error cargando datos iniciales:', error);
      throw error;
    }
  }

  // Actualizar datos
  async refreshData() {
    if (this.isRefreshing) return;

    this.isRefreshing = true;
    try {
      const newData = await sheetsAPI.forceRefresh();
      this.data = newData;
      await this.updateStats();
      this.notifyListeners();
      return newData;
    } catch (error) {
      console.error('Error actualizando datos:', error);
      throw error;
    } finally {
      this.isRefreshing = false;
    }
  }

  // Actualizar estadísticas
  async updateStats() {
    this.stats = await sheetsAPI.getStats();
  }

  // Buscar por documento (QR)
  async searchByDocument(documento) {
    return await sheetsAPI.buscarPorDocumento(documento);
  }

  // Verificar si una factura puede ser procesada
  async canProcessFactura(factura) {
    return !(await sheetsAPI.verificarEntregaFactura(factura));
  }

  // Iniciar auto-refresh
  startAutoRefresh(interval = 60000) { // 1 minuto por defecto
    this.stopAutoRefresh();
    this.autoRefreshInterval = setInterval(async () => {
      try {
        await this.refreshData();
        console.log('Datos actualizados automáticamente');
      } catch (error) {
        console.error('Error en auto-refresh:', error);
      }
    }, interval);
  }

  // Detener auto-refresh
  stopAutoRefresh() {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
    }
  }

  // Obtener datos actuales
  getCurrentData() {
    return this.data;
  }

  // Obtener estadísticas actuales
  getCurrentStats() {
    return this.stats;
  }
}

// Instancia global de DataManager
const dataManager = new DataManager();
