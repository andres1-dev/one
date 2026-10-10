/**
 * Componente de UI: ScopeView
 * Calcula y renderiza el rango operativo interactivo con nombres de mes y total de días.
 */
export class ScopeView {
  constructor({ containerId = "scopePill", datesId = "scopeRangeDates", badgeId = "scopeDaysBadge" } = {}) {
    this.container = document.getElementById(containerId);
    this.datesEl = document.getElementById(datesId);
    this.badgeEl = document.getElementById(badgeId);
  }

  render(range = null) {
    let startDate;
    let endDate = new Date();
    let isRealRange = false;

    if (range && range.fecha_desde) {
      if (typeof range.fecha_desde === "string") {
        const parts = range.fecha_desde.split("T")[0].split("-").map(Number);
        startDate = new Date(parts[0], parts[1] - 1, parts[2]);
      } else {
        startDate = new Date(range.fecha_desde);
      }

      if (range.fecha_hasta) {
        if (typeof range.fecha_hasta === "string") {
          const parts = range.fecha_hasta.split("T")[0].split("-").map(Number);
          endDate = new Date(parts[0], parts[1] - 1, parts[2]);
        } else {
          endDate = new Date(range.fecha_hasta);
        }
      }
      isRealRange = true;
    } else {
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    }

    const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const monthsFull = [
      "enero", "febrero", "marzo", "abril", "mayo", "junio",
      "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
    ];

    const pad = n => String(n).padStart(2, '0');
    const formatShort = d => `${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}`;
    const formatFull = d => `${d.getDate()} de ${monthsFull[d.getMonth()]} de ${d.getFullYear()}`;

    // Cálculo de días en la ventana operativa (inclusivo)
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);

    if (this.datesEl) {
      this.datesEl.textContent = `${formatShort(startDate)} — ${formatShort(endDate)}`;
    }

    if (this.badgeEl) {
      this.badgeEl.textContent = `${diffDays} días`;
    }

    if (this.container) {
      const labelPrefix = isRealRange ? "Ventana operativa real" : "Ventana operativa";
      this.container.title = `${labelPrefix}: del ${formatFull(startDate)} al ${formatFull(endDate)} (${diffDays} días auditados)`;
    }
  }
}
