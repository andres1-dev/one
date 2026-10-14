/**
 * Adaptador de Infraestructura: BrowserCsvExporterAdapter
 * Implementa ExporterPort generando un archivo CSV delimitado por punto y coma con UTF-8 BOM.
 */
import { ExporterPort } from "../../domain/ports/ExporterPort.js";
import { RECORD_FIELDS, RECORD_HEADERS } from "../../domain/models/Record.js";

export class BrowserCsvExporterAdapter extends ExporterPort {
  formatValue(row, field) {
    if (field === "estado_separacion") {
      return row.estado_separacion === "FINALIZADO" ? "TRUE" : "FALSE";
    }
    if (field === "estado_factura") {
      return row.estado_factura === "Aprobadas" ? "TRUE" : "FALSE";
    }
    if (field === "estado_entrega") {
      return row.estado_entrega === "ENTREGADO" ? "TRUE" : "FALSE";
    }
    if (field === "nro_factura") {
      const isNull = !row[field] || row[field] === "—" || row[field] === "NULL";
      return isNull ? "NULL" : String(row[field]);
    }
    if (field === "productora") {
      const isNull = !row[field] || row[field] === "—" || row[field] === "Sin productora" || row[field] === "NULL";
      return isNull ? "NULL" : String(row[field]);
    }
    if (field === "alerta_cantidad" || field === "alerta_op") {
      const isNull = !row[field] || row[field] === "—" || row[field] === "NULL";
      return isNull ? "NULL" : String(row[field]);
    }
    if (field === "fecha_ingreso") {
      const isNull = !row[field] || row[field] === "—" || row[field] === "NULL";
      return isNull ? "NULL" : String(row[field]).slice(0, 10);
    }
    if (field === "op") {
      const isNull = !row[field] || row[field] === "—" || row[field] === "NULL";
      return isNull ? "NULL" : String(row[field]);
    }
    const val = row[field];
    if (val === null || val === undefined || val === "") {
      return "NULL";
    }
    return String(val);
  }

  escapeCsv(val) {
    const s = String(val ?? "");
    if (s.includes(";") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  async export(rows, options = {}) {
    const filename = options.filename || `export_${Date.now()}.csv`;

    const lines = [
      RECORD_HEADERS.map(h => this.escapeCsv(h)).join(";"),
      ...rows.map(r =>
        RECORD_FIELDS.map(f => this.escapeCsv(this.formatValue(r, f))).join(";")
      )
    ];

    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    return true;
  }
}
