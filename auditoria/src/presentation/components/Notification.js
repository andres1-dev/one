/**
 * Componente de UI: Notification
 * Muestra alertas visuales flotantes (Toast) y maneja auto-desvanecimiento rápido sin desplazar la UI.
 */
export class Notification {
  constructor(containerId = "message") {
    this.el = document.getElementById(containerId);
    this.timeout = null;
    this.hideTimeout = null;
  }

  show(text, type = "info", duration = null) {
    if (!this.el) return;
    this.clearImmediate();

    // Duración rápida por defecto: 2000ms para info/éxito, 2800ms para errores
    const effectiveDuration = duration ?? (type === "error" ? 2800 : 2000);

    const icon = type === "error"
      ? '<i class="fa-solid fa-circle-exclamation"></i>'
      : type === "success"
        ? '<i class="fa-solid fa-circle-check"></i>'
        : '<i class="fa-solid fa-circle-info"></i>';

    const safeText = String(text ?? "").replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
    );

    this.el.innerHTML = `
      <div class="message-content">
        ${icon}
        <span>${safeText}</span>
      </div>
      <button type="button" class="message-close-btn" id="messageCloseBtn" title="Cerrar notificación">
        <i class="fa-solid fa-xmark"></i>
      </button>
    `;

    this.el.style.display = "flex";
    // Forzar reflow para asegurar animación de entrada
    void this.el.offsetWidth;
    this.el.className = `show ${type}`;

    const closeBtn = document.getElementById("messageCloseBtn");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => this.dismiss());
    }

    if (effectiveDuration > 0) {
      this.timeout = setTimeout(() => this.dismiss(), effectiveDuration);
    }
  }

  dismiss() {
    clearTimeout(this.timeout);
    clearTimeout(this.hideTimeout);
    if (!this.el) return;

    this.el.classList.add("hide");
    this.el.classList.remove("show");

    this.hideTimeout = setTimeout(() => {
      this.clearImmediate();
    }, 200); // Coincide con la duración de la animación CSS
  }

  clearImmediate() {
    clearTimeout(this.timeout);
    clearTimeout(this.hideTimeout);
    if (!this.el) return;
    this.el.className = "";
    this.el.style.display = "none";
    this.el.innerHTML = "";
  }

  clear() {
    this.dismiss();
  }
}
