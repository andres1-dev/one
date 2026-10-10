/**
 * Servicio de Dominio: FilterService
 * Lógica pura de filtrado multicriterio, búsqueda de texto libre y paginación.
 */
import { RECORD_FIELDS } from "../models/Record.js";
import { KPI_PREDICATES } from "./KpiCalculator.js";

export class FilterService {
  /**
   * Extrae valores únicos no nulos ordenados alfabéticamente para selects
   */
  static extractUniqueValues(rows, field) {
    return [...new Set(
      rows.map(r => r[field]).filter(v => v != null && v !== "" && v !== "NULL")
    )].sort((a, b) => String(a).localeCompare(String(b), "es"));
  }

  /**
   * Filtra registros por columnas (cliente, productora, genero, prenda, clase)
   */
  static applyColumnFilters(rows, filters = {}) {
    return rows.filter(r => {
      if (filters.cliente && r.cliente !== filters.cliente) return false;
      if (filters.productora && r.productora !== filters.productora) return false;
      if (filters.genero && r.genero !== filters.genero) return false;
      if (filters.prenda && r.prenda !== filters.prenda) return false;
      if (filters.clase && r.clase !== filters.clase) return false;
      return true;
    });
  }

  /**
   * Filtra registros por KPI activo
   */
  static applyKpiFilter(rows, activeKpiKey) {
    if (!activeKpiKey || !KPI_PREDICATES[activeKpiKey]) return rows;
    return rows.filter(KPI_PREDICATES[activeKpiKey]);
  }

  /**
   * Aplica búsqueda por texto libre sobre todos los campos de los registros
   */
  static applySearch(rows, query = "") {
    const q = (query || "").trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      RECORD_FIELDS.some(f => String(r[f] ?? "").toLowerCase().includes(q))
    );
  }

  /**
   * Pagina un conjunto de datos
   */
  static paginate(rows, page = 1, pageSize = 10) {
    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.max(1, Math.min(page, totalPages));
    const start = (safePage - 1) * pageSize;
    const items = rows.slice(start, start + pageSize);

    return {
      items,
      total,
      page: safePage,
      totalPages,
      pageSize
    };
  }
}
