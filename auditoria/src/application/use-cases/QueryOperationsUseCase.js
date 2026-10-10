/**
 * Caso de Uso: QueryOperationsUseCase
 */
import { Record } from "../../domain/models/Record.js";

export class QueryOperationsUseCase {
  constructor(operationsPort) {
    this.operationsPort = operationsPort;
  }

  async execute(id = null) {
    const rawData = await this.operationsPort.fetchOperations(id);
    const rows = Array.isArray(rawData) ? rawData : (rawData?.data ?? []);
    return rows.map(item => new Record(item));
  }
}
