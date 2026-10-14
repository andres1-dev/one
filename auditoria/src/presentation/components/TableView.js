/**
 * Componente de UI: TableView
 * Renderiza la tabla de datos, indicadores de estado, estados vacíos y paginación.
 */
import { RECORD_FIELDS } from "../../domain/models/Record.js";

export class TableView {
  constructor({
    tbodyId = "results",
    summaryId = "summary",
    pageInfoId = "pageInfo",
    prevBtnId = "pagePrev",
    nextBtnId = "pageNext",
    searchInputId = "tableSearch",
    csvBtnId = "csvButton",
    onPageChange,
    onSearchChange,
    onExportCsv
  }) {
    this.tbody = document.getElementById(tbodyId);
    this.summaryEl = document.getElementById(summaryId);
    this.pageInfoEl = document.getElementById(pageInfoId);
    this.prevBtn = document.getElementById(prevBtnId);
    this.nextBtn = document.getElementById(nextBtnId);
    this.searchInput = document.getElementById(searchInputId);
    this.csvBtn = document.getElementById(csvBtnId);

    this.onPageChange = onPageChange;
    this.onSearchChange = onSearchChange;
    this.onExportCsv = onExportCsv;

    this.initEvents();
  }

  initEvents() {
    if (this.prevBtn) {
      this.prevBtn.addEventListener("click", () => {
        if (this.onPageChange) this.onPageChange(-1);
      });
    }

    if (this.nextBtn) {
      this.nextBtn.addEventListener("click", () => {
        if (this.onPageChange) this.onPageChange(1);
      });
    }

    if (this.searchInput) {
      this.searchInput.addEventListener("input", () => {
        if (this.onSearchChange) this.onSearchChange(this.searchInput.value);
      });
    }

    if (this.csvBtn) {
      this.csvBtn.addEventListener("click", () => {
        if (this.onExportCsv) this.onExportCsv();
      });
    }
  }

  escapeHtml(val) {
    return String(val ?? "").replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
    );
  }

  renderRows(rows = []) {
    if (!this.tbody) return;

    if (!Array.isArray(rows) || rows.length === 0) {
      this.tbody.innerHTML = `
        <tr>
          <td colspan="${RECORD_FIELDS.length}" style="text-align:center;padding:36px;color:var(--text-muted);">
            No se encontraron resultados.
          </td>
        </tr>
      `;
      return;
    }

    this.tbody.innerHTML = rows.map(row => {
      const cells = RECORD_FIELDS.map(f => {
        const rawVal = row[f];
        const val = this.escapeHtml(rawVal);

        if (f === "alerta_cantidad") {
          return rawVal
            ? `<td><span class="badge badge-warning" title="${val}"><i class="fa-solid fa-triangle-exclamation"></i> ${val}</span></td>`
            : `<td><span class="null-val">NULL</span></td>`;
        }

        if (f === "alerta_op") {
          return rawVal
            ? `<td><span class="badge badge-warning" style="background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;" title="${val}"><i class="fa-solid fa-file-circle-exclamation"></i> ${val}</span></td>`
            : `<td><span class="null-val">NULL</span></td>`;
        }

        if (f === "fecha_ingreso") {
          const isNull = !rawVal || rawVal === '—' || rawVal === 'NULL';
          const formatted = !isNull ? String(rawVal).slice(0, 10) : '';
          return isNull ? `<td><span class="null-val">NULL</span></td>` : `<td><span style="font-variant-numeric:tabular-nums;color:var(--text-muted);font-size:12px;">${formatted}</span></td>`;
        }

        if (f === "op") {
          const isNull = !rawVal || rawVal === '—' || rawVal === 'NULL';
          return isNull ? `<td><span class="null-val">NULL</span></td>` : `<td><span style="font-weight:600;font-variant-numeric:tabular-nums;">${val}</span></td>`;
        }

        if (f === "nro_factura") {
          const isNull = !rawVal || rawVal === '—' || rawVal === 'NULL';
          return isNull ? `<td><span class="null-val">NULL</span></td>` : `<td>${val}</td>`;
        }

        if (f === "productora") {
          const isNull = !rawVal || rawVal === '—' || rawVal === 'Sin productora' || rawVal === 'NULL';
          return isNull ? `<td><span class="null-val">NULL</span></td>` : `<td>${val}</td>`;
        }

        if (f === "estado_separacion") {
          const isOk = row.isSeparacionFinalizada ? row.isSeparacionFinalizada() : (rawVal === 'FINALIZADO');
          return `
            <td style="text-align:center;">
              <span class="status-indicator ${isOk ? 'is-ok' : 'is-pending'}" title="Separación: ${val}">
                <i class="fa-solid ${isOk ? 'fa-check' : 'fa-xmark'}"></i>
              </span>
            </td>
          `;
        }

        if (f === "estado_factura") {
          const isOk = row.isFacturaAprobada ? row.isFacturaAprobada() : (rawVal === 'Aprobadas');
          return `
            <td style="text-align:center;">
              <span class="status-indicator ${isOk ? 'is-ok' : 'is-pending'}" title="Factura: ${val}">
                <i class="fa-solid ${isOk ? 'fa-check' : 'fa-xmark'}"></i>
              </span>
            </td>
          `;
        }

        if (f === "estado_entrega") {
          const isOk = row.isEntregaRealizada ? row.isEntregaRealizada() : (rawVal === 'ENTREGADO');
          return `
            <td style="text-align:center;">
              <span class="status-indicator ${isOk ? 'is-ok' : 'is-pending'}" title="Entrega: ${val}">
                <i class="fa-solid ${isOk ? 'fa-check' : 'fa-xmark'}"></i>
              </span>
            </td>
          `;
        }

        return `<td>${val}</td>`;
      }).join("");

      return `<tr>${cells}</tr>`;
    }).join("");
  }

  renderPagination({ total, page, totalPages }) {
    if (this.pageInfoEl) {
      this.pageInfoEl.textContent = total === 0
        ? "0 registros"
        : `Página ${page} de ${totalPages} (${total} registro${total !== 1 ? "s" : ""})`;
    }

    if (this.prevBtn) this.prevBtn.disabled = page <= 1;
    if (this.nextBtn) this.nextBtn.disabled = page >= totalPages;
  }

  renderSummary({ total, baseTotal, activeKpi, hasColumnFilters }) {
    if (!this.summaryEl) return;
    const filterDesc = hasColumnFilters ? " (con filtros activos)" : "";
    const KPI_LABELS = {
      porSeparar: "Por separar",
      facturadoPorSeparar: "Facturado por separar",
      pendienteFactura: "Pendiente factura",
      totalFacturado: "Total facturado",
      listoEntregar: "Listo para entregar",
      errorCantidad: "Discrepancias de cantidad",
      errorOp: "Discrepancias de OP"
    };
    const kpiName = KPI_LABELS[activeKpi] || activeKpi;
    this.summaryEl.textContent = activeKpi
      ? `Filtrando por "${kpiName}"${filterDesc}: ${total} de ${baseTotal} registros`
      : `Total${filterDesc}: ${baseTotal} registro${baseTotal !== 1 ? "s" : ""}`;
  }

  setCsvEnabled(enabled) {
    if (this.csvBtn) this.csvBtn.disabled = !enabled;
  }

  setEmptyMessage(message) {
    if (!this.tbody) return;
    this.tbody.innerHTML = `
      <tr>
        <td colspan="${RECORD_FIELDS.length}" style="text-align:center;padding:36px;color:var(--text-muted);">
          ${this.escapeHtml(message)}
        </td>
      </tr>
    `;
  }
}
