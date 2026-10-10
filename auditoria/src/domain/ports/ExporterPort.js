/**
 * Puerto de Exportación de Datos (ExporterPort)
 * Define el contrato abstracto para la generación y descarga de reportes.
 */
export class ExporterPort {
  async export(rows, options = {}) {
    throw new Error("ExporterPort.export no ha sido implementado.");
  }
}
