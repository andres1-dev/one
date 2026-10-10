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

  render() {
    const now = new Date();
    // Inicio del mes anterior
    const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const monthsFull = [
      "enero", "febrero", "marzo", "abril", "mayo", "junio",
      "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
    ];

    const pad = n => String(n).padStart(2, '0');
    const formatShort = d => `${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}`;
    const formatFull = d => `${d.getDate()} de ${monthsFull[d.getMonth()]} de ${d.getFullYear()}`;

    // Cálculo de días en la ventana operativa
    const diffTime = Math.abs(now.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (this.datesEl) {
      this.datesEl.textContent = `${formatShort(startDate)} — ${formatShort(now)}`;
    }

    if (this.badgeEl) {
      this.badgeEl.textContent = `${diffDays} días`;
    }

    if (this.container) {
      this.container.title = `Ventana operativa: del ${formatFull(startDate)} al ${formatFull(now)} (${diffDays} días auditados)`;
    }
  }
}
