import { SupabaseConfig } from "../../infrastructure/supabase/SupabaseConfig.js";

/**
 * Adaptador UI: Modal de Configuración Supabase
 */
export class ConfigModalView {
  constructor({ onConfigSaved }) {
    this.onConfigSaved = onConfigSaved;
    this.container = document.getElementById("modal-container");
  }

  show() {
    const currentUrl = SupabaseConfig.getUrl();
    const currentKey = SupabaseConfig.getAnonKey();

    this.container.innerHTML = `
      <div class="modal-overlay" id="config-overlay">
        <div class="modal-content">
          <div class="card-header">
            <h3 class="card-title">Configuración Supabase</h3>
            <button class="btn btn-outline btn-sm" id="btn-close-modal"><i class="codicon codicon-close"></i></button>
          </div>

          <p style="color: var(--text-muted); font-size: 12px; margin-bottom: 14px;">
            Ingresa la <strong>Anon Public Key</strong> para conectar el cliente con Supabase Auth y RLS.
          </p>

          <form id="config-form">
            <div class="form-group">
              <label>Supabase URL</label>
              <input type="text" id="config-url" value="${currentUrl}" required>
            </div>

            <div class="form-group">
              <label>Supabase Anon Key</label>
              <input type="password" id="config-anon" value="${currentKey}" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." required>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px;">
              <button type="button" class="btn btn-outline" id="btn-cancel-config">Cancelar</button>
              <button type="submit" class="btn btn-primary">Guardar y Conectar</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.getElementById("btn-close-modal").onclick = () => this.hide();
    document.getElementById("btn-cancel-config").onclick = () => this.hide();
    document.getElementById("config-form").onsubmit = (e) => {
      e.preventDefault();
      const url = document.getElementById("config-url").value.trim();
      const key = document.getElementById("config-anon").value.trim();
      SupabaseConfig.setUrl(url);
      SupabaseConfig.setAnonKey(key);
      SupabaseConfig.resetClient();
      this.hide();
      if (this.onConfigSaved) this.onConfigSaved();
    };
  }

  hide() {
    this.container.innerHTML = "";
  }
}
