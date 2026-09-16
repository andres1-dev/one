/**
 * Caso de Uso: ListarHistoricosUseCase
 * Obtiene registros históricos desde Google Sheets
 */
export class ListarHistoricosUseCase {
  constructor(syncAdapter) {
    this.syncAdapter = syncAdapter;
  }

  async execute(limit = 100) {
    try {
      return await this.syncAdapter.listarHistoricos(limit);
    } catch (error) {
      console.error("Error al listar históricos:", error);
      throw new Error(`Error al obtener registros históricos: ${error.message}`);
    }
  }
}