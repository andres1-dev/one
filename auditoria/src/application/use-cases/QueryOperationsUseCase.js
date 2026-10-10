/**
 * Caso de Uso: QueryOperationsUseCase
 */
import { Record } from "../../domain/models/Record.js";

export class QueryOperationsUseCase {
  constructor(operationsPort) {
    this.operationsPort = operationsPort;
    this._lastRange = null;
  }

  async execute(id = null) {
    const rawData = await this.operationsPort.fetchOperations(id);
    const rawRows = Array.isArray(rawData) ? rawData : (rawData?.data ?? []);
    const rows = rawRows.map(item => new Record(item));
    const range = rawData?.rango || null;
    this._lastRange = range;
    return { rows, range };
  }

  get lastRange() {
    return this._lastRange;
  }

  /** Devuelve { fecha_desde, fecha_hasta } con el rango real o null si no disponible */
  async fetchRange() {
    if (this._lastRange) {
      return { ...this._lastRange };
    }
    if (typeof this.operationsPort.fetchOperationalRange === "function") {
      return await this.operationsPort.fetchOperationalRange();
    }
    return null;
  }
}
