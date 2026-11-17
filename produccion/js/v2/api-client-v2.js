// ============================================================
// js/v2/api-client-v2.js
// Cliente HTTP centralizado para la arquitectura v2 (on-demand).
// NO reemplaza ni modifica ningún archivo existente.
//
// Responsabilidades:
//   - Adjuntar el token JWT a cada petición automáticamente
//   - Apuntar a la NUEVA EF delivery-kpis (y futuras EFs v2)
//   - Manejar errores de auth de forma consistente
// ============================================================

const ApiClientV2 = (() => {

  // ── Configuración ─────────────────────────────────────────
  // Reutiliza SiesaConfig existente para la URL base.
  // Nuevas EFs v2:
  const KPI_ENDPOINT    = `${SiesaConfig.FUNCTIONS_URL}/delivery-kpis`
  const SEARCH_ENDPOINT = `${SiesaConfig.FUNCTIONS_URL}/delivery-search`

  // ── Obtener token de la sesión activa ─────────────────────
  async function _getToken() {
    if (!window.supabase) {
      throw new Error('Supabase SDK no inicializado')
    }
    let { data: { session }, error } = await window.supabase.auth.getSession()
    if (error || !session) {
      throw new Error('Sesión expirada. Por favor inicia sesión nuevamente.')
    }

    // Refrescar token automáticamente si ya expiró
    if (session.expires_at && (session.expires_at * 1000) < (Date.now() + 60000)) {
      try {
        const refreshed = await window.supabase.auth.refreshSession()
        if (refreshed.data?.session) {
          session = refreshed.data.session
        }
      } catch (_) {}
    }

    return session.access_token
  }

  // ── GET genérico con auth ──────────────────────────────────
  async function get(url, params = {}) {
    const token = await _getToken()

    // Construir query string limpio (omite nulls y vacíos)
    const qs = Object.entries(params)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&')

    const fullUrl = qs ? `${url}?${qs}` : url

    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'apikey'       : SiesaConfig.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type' : 'application/json',
      },
    })

    if (!response.ok) {
      let msg = `HTTP ${response.status}`
      try {
        const body = await response.json()
        msg = body.error || body.message || msg
      } catch (_) {
        const text = await response.text().catch(() => '')
        if (text) msg += `: ${text}`
      }
      throw new Error(msg)
    }

    return response.json()
  }

  // ── API pública ────────────────────────────────────────────
  return {
    /**
     * Llama a la nueva EF delivery-kpis
     * @param {Object} params
     * @param {string} params.fechaInicio  - YYYY-MM-DD
     * @param {string} params.fechaFin     - YYYY-MM-DD
     * @param {string} [params.estados]    - CSV "Aprobadas,En elaboración"
     * @param {string} [params.tipos]      - CSV "REMISION,OFICIAL"
     * @param {string} [params.compania]   - "3" | "5"
     * @param {string} [params.proveedor]  - nombre del proveedor
     * @returns {Promise<Object>} { success, kpis, meta }
     */
    async fetchKpis({ fechaInicio, fechaFin, estados = null, tipos = null, compania = null, proveedor = null } = {}) {
      return get(SEARCH_ENDPOINT, {
        action: 'kpis',
        fechaInicio,
        fechaFin,
        ...(estados   ? { estados  } : {}),
        ...(tipos     ? { tipos    } : {}),
        ...(compania  ? { compania } : {}),
        ...(proveedor ? { proveedor} : {}),
      })
    },

    /**
     * Obtiene los valores únicos para poblar los filtros.
     * Acepta fechaInicio/fechaFin para retornar solo opciones del rango activo.
     * @param {Object} [opts]
     * @param {string} [opts.fechaInicio] - YYYY-MM-DD
     * @param {string} [opts.fechaFin]    - YYYY-MM-DD
     * @returns {Promise<Object>} { success, data: { clientes, proveedores, estados, tipos } }
     */
    async fetchFilterOptions({ fechaInicio = null, fechaFin = null } = {}) {
      return get(SEARCH_ENDPOINT, {
        action: 'filters',
        ...(fechaInicio ? { fechaInicio } : {}),
        ...(fechaFin    ? { fechaFin    } : {}),
      })
    },

    /**
     * Búsqueda on-demand de documentos
     * @param {Object} params
     * @returns {Promise<Object>}
     */
    async search(params = {}) {
      return get(SEARCH_ENDPOINT, params)
    },
  }

})()

// Exponer globalmente para uso en kpi-loader-v2.js
window.ApiClientV2 = ApiClientV2
