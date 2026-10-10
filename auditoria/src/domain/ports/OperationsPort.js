/**
 * Puerto de Operaciones Logísticas (OperationsPort)
 * Define el contrato abstracto para la consulta de datos operativos.
 */
export class OperationsPort {
  async fetchOperations(id = null) {
    throw new Error("OperationsPort.fetchOperations no ha sido implementado.");
  }

  async fetchOperationalRange() {
    return null;
  }
}
