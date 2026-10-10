/**
 * Componente de UI: FilterPanel
 * Maneja los selectores de filtro por columna, estado de botón de filtro y limpieza.
 */
import { FilterService } from "../../domain/services/FilterService.js";

export class FilterPanel {
  constructor({ panelId = "filterPanel", toggleBtnId = "filterToggleBtn", clearBtnId = "clearFiltersBtn", onFilterChange, onFilterClear }) {
    this.panel = document.getElementById(panelId);
    this.toggleBtn = document.getElementById(toggleBtnId);
    this.clearBtn = document.getElementById(clearBtnId);
    this.onFilterChange = onFilterChange;
    this.onFilterClear = onFilterClear;

    this.selects = {
      cliente: document.getElementById("fCliente"),
      productora: document.getElementById("fProductora"),
      genero: document.getElementById("fGenero"),
      prenda: document.getElementById("fPrenda"),
      clase: document.getElementById("fClase")
    };

    this.initEvents();
  }

  initEvents() {
    if (this.toggleBtn) {
      this.toggleBtn.addEventListener("click", () => {
        if (this.panel) this.panel.classList.toggle("visible");
      });
    }

    if (this.clearBtn) {
      this.clearBtn.addEventListener("click", () => {
        if (this.onFilterClear) this.onFilterClear();
      });
    }

    Object.entries(this.selects).forEach(([key, el]) => {
      if (el) {
        el.addEventListener("change", () => {
          if (this.onFilterChange) {
            this.onFilterChange(key, el.value);
          }
        });
      }
    });
  }

  populateOptions(rows) {
    const escapeHtml = v => String(v ?? "").replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
    );

    const fill = (el, values, placeholder) => {
      if (!el) return;
      const prev = el.value;
      el.innerHTML = `<option value="">${placeholder}</option>` +
        values.map(v => `<option value="${escapeHtml(String(v))}">${escapeHtml(String(v))}</option>`).join("");
      if (values.includes(prev)) el.value = prev;
    };

    fill(this.selects.cliente,   FilterService.extractUniqueValues(rows, "cliente"),   "Clientes");
    fill(this.selects.productora, FilterService.extractUniqueValues(rows, "productora"), "Productoras");
    fill(this.selects.genero,    FilterService.extractUniqueValues(rows, "genero"),    "Géneros");
    fill(this.selects.prenda,    FilterService.extractUniqueValues(rows, "prenda"),    "Prendas");
    fill(this.selects.clase,     FilterService.extractUniqueValues(rows, "clase"),     "Clases");

    if (this.toggleBtn) this.toggleBtn.disabled = rows.length === 0;
  }

  updateState(columnFilters = {}) {
    const hasActive = Object.values(columnFilters).some(v => v !== "");
    if (this.toggleBtn) {
      this.toggleBtn.classList.toggle("has-filters", hasActive);
    }

    Object.entries(this.selects).forEach(([key, el]) => {
      if (el) {
        const val = columnFilters[key] || "";
        el.value = val;
        const isActive = Boolean(val);
        el.classList.toggle("active", isActive);
        el.classList.toggle("is-placeholder", !isActive);
      }
    });
  }

  reset() {
    Object.values(this.selects).forEach(el => {
      if (el) {
        el.value = "";
        el.classList.remove("active");
        el.classList.add("is-placeholder");
      }
    });
    if (this.panel) this.panel.classList.remove("visible");
    if (this.toggleBtn) {
      this.toggleBtn.classList.remove("has-filters");
      this.toggleBtn.disabled = true;
    }
  }
}
