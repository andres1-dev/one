// ============================================
// js/impresion-supabase.js
// Cliente Supabase mínimo para el módulo de
// impresión independiente.
// Solo incluye las funciones que utiliza el
// módulo de impresión (request, selectAll).
// ============================================

class SupabaseClient {
    constructor(url, key) {
        this.url = url;
        this.key = key;
        this.accessToken = null;
    }

    /**
     * Construye headers para las peticiones.
     * Usa el token de sesión si está disponible.
     */
    getHeaders() {
        const token = sessionStorage.getItem('supabase_token') || this.accessToken;
        return {
            'apikey':        this.key,
            'Content-Type':  'application/json',
            'Prefer':        'return=representation',
            'Authorization': `Bearer ${token || this.key}`
        };
    }

    /**
     * Petición genérica a la REST API de Supabase.
     * @param {string} endpoint  - Ej: "ingresos?id_ingreso=in.(1,2)"
     * @param {Object} options   - fetch options (method, headers, body, …)
     */
    async request(endpoint, options = {}) {
        const url = `${this.url}/rest/v1/${endpoint}`;
        const config = {
            ...options,
            headers: { ...this.getHeaders(), ...(options.headers || {}) }
        };

        try {
            const response = await fetch(url, config);

            // Token expirado
            if (response.status === 401) {
                Logger.error('supabase', 'Sesión expirada');
                sessionStorage.clear();
                alert('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
                window.location.href = 'login.html';
                throw new Error('JWT expired');
            }

            if (!response.ok) {
                let msg = `HTTP ${response.status}`;
                try { const err = await response.json(); msg = err.message || err.error || msg; } catch (_) {}
                throw new Error(msg);
            }

            if (response.status === 204 || options.method === 'DELETE') return { success: true };

            const text = await response.text();
            if (!text) return options.method === 'GET' ? [] : { success: true };

            try { return JSON.parse(text); } catch (_) { return { success: true }; }

        } catch (error) {
            Logger.error('supabase', `Error en request: ${endpoint}`, error);
            throw error;
        }
    }

    /**
     * SELECT con filtros, orden y límite.
     */
    async select(table, options = {}) {
        const { columns = '*', filters = {}, order = null, limit = null, offset = null } = options;
        let qs = `select=${columns}`;

        const fs = Object.entries(filters).map(([k, v]) => `${k}=eq.${v}`).join('&');
        if (fs)     qs += `&${fs}`;
        if (order)  qs += `&order=${order}`;
        if (limit)  qs += `&limit=${limit}`;
        if (offset !== null && offset !== undefined) qs += `&offset=${offset}`;

        return await this.request(`${table}?${qs}`, { method: 'GET' });
    }

    /**
     * Trae TODOS los registros paginando en paralelo.
     */
    async selectAll(table, options = {}, pageSize = 1000) {
        const firstPage = await this.select(table, { ...options, limit: pageSize, offset: 0 });
        if (!Array.isArray(firstPage) || firstPage.length === 0) return [];
        if (firstPage.length < pageSize) return firstPage;

        // Obtener total para calcular páginas restantes
        const { columns = '*', filters = {}, order = null } = options;
        let total = null;
        try {
            let qs = `select=${columns}&limit=1`;
            const fs = Object.entries(filters).map(([k, v]) => `${k}=eq.${v}`).join('&');
            if (fs) qs += `&${fs}`;
            const headRes = await fetch(`${this.url}/rest/v1/${table}?${qs}`, {
                headers: { ...this.getHeaders(), 'Prefer': 'count=exact' }
            });
            const cr = headRes.headers.get('content-range');
            if (cr) total = parseInt(cr.split('/')[1]);
        } catch (_) {}

        if (!total || total <= pageSize) return firstPage;

        const pageCount  = Math.ceil(total / pageSize);
        const promises   = [];
        for (let p = 1; p < pageCount; p++) {
            promises.push(this.select(table, { ...options, limit: pageSize, offset: p * pageSize }));
        }
        const rest = await Promise.all(promises);
        return [firstPage, ...rest].flat();
    }
}

// -----------------------------------------------
// Instancia global — usa las constantes de config
// -----------------------------------------------
const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
