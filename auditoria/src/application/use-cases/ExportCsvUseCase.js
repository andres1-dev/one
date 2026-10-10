/**
 * Caso de Uso: ExportCsvUseCase
 */
export class ExportCsvUseCase {
  constructor(exporterPort) {
    this.exporterPort = exporterPort;
  }

  async execute(rows, filenamePrefix = "clientes_operaciones") {
    if (!rows || rows.length === 0) {
      throw new Error("No hay registros para exportar.");
    }
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `${filenamePrefix}_${timestamp}.csv`;
    return await this.exporterPort.export(rows, { filename });
  }
}
