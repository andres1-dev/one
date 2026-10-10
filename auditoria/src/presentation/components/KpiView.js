/**
 * Componente de UI: KpiView
 * Renderiza métricas operativas y maneja interacción de filtros por KPI.
 */
import { KpiCalculator } from "../../domain/services/KpiCalculator.js";

export class KpiView {
  constructor({ containerId = "kpiSection", badgeId = "kpiFilterBadge", onKpiSelect, onKpiClear }) {
    this.container = document.getElementById(containerId);
    this.badge = document.getElementById(badgeId);
    this.onKpiSelect = onKpiSelect;
    this.onKpiClear = onKpiClear;

    this.elements = {
      porSeparar: document.getElementById("kpiPorSeparar"),
      facturadoPorSeparar: document.getElementById("kpiFacturadoPorSeparar"),
      pendienteFactura: document.getElementById("kpiPendienteFactura"),
      totalFacturado: document.getElementById("kpiTotalFacturado"),
      listoEntregar: document.getElementById("kpiListoEntregar"),
      errorCantidad: document.getElementById("kpiErrorCantidad")
    };

    this.cards = document.querySelectorAll(".kpi-card[data-kpi]");
    this.clearBtn = document.getElementById("kpiClear");

    this.initEvents();
  }

  initEvents() {
    this.cards.forEach(card => {
      card.addEventListener("click", () => {
        const kpiKey = card.dataset.kpi;
        if (this.onKpiSelect) this.onKpiSelect(kpiKey);
      });
    });

    if (this.clearBtn) {
      this.clearBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (this.onKpiClear) this.onKpiClear();
      });
    }
  }

  setMetric(el, value) {
    if (!el) return;
    const next = String(value);
    if (el.textContent !== next) {
      el.classList.remove("updating");
      void el.offsetWidth; // Trigger reflow for CSS pulse
      el.classList.add("updating");
      el.textContent = next;
    }
  }

  render(rows = [], activeKpi = null) {
    if (!rows || rows.length === 0) {
      if (this.container) this.container.hidden = true;
      return;
    }

    const fmt = n => Number(n).toLocaleString("es-CO");
    const metrics = KpiCalculator.calculate(rows);

    this.setMetric(this.elements.porSeparar, fmt(metrics.porSeparar));
    this.setMetric(this.elements.facturadoPorSeparar, fmt(metrics.facturadoPorSeparar));
    this.setMetric(this.elements.pendienteFactura, fmt(metrics.pendienteFactura));
    this.setMetric(this.elements.totalFacturado, fmt(metrics.totalFacturado));
    this.setMetric(this.elements.listoEntregar, fmt(metrics.listoEntregar));
    this.setMetric(this.elements.errorCantidad, String(metrics.errorCantidad));

    if (this.container) this.container.hidden = false;

    // Actualizar estados visuales de selección
    this.cards.forEach(card => {
      card.classList.toggle("active", card.dataset.kpi === activeKpi);
    });

    if (this.badge) {
      this.badge.style.display = activeKpi ? "inline" : "none";
    }
  }
}
