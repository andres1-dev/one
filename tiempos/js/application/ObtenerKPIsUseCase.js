/**
 * Caso de Uso: ObtenerKPIsUseCase
 * Obtiene indicadores clave de rendimiento desde Google Sheets
 */
export class ObtenerKPIsUseCase {
  constructor(sheetsAdapter) {
    this.sheetsAdapter = sheetsAdapter;
  }

  async execute() {
    try {
      return await this.sheetsAdapter.obtenerKPIs();
    } catch (error) {
      console.error("Error al obtener KPIs:", error);
      throw new Error(`Error al obtener KPIs: ${error.message}`);
    }
  }
}