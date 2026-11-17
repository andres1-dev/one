// ============================================================
// js/v2/search-engine-v2.js
// Motor de búsqueda on-demand — cubre TODOS los criterios
// de la interfaz actual y llama a la EF delivery-search.
//
// NO modifica app.js, aplicarFiltros(), ni cargarDatos().
// Se activa en delivery.html reemplazando solo los listeners
// cuando esté listo para integración.
//
// Criterios soportados:
//   • Rango de fechas (modo documento y modo entrega)
//   • Texto libre (q)
//   • Por Nro documento (Spotlight "Por Factura")
//   • Por OP (Spotlight "Por Orden de Producción")
//   • Por Referencia (Spotlight "Por Referencia")
//   • Cliente exacto (select)
//   • Proveedor exacto (select)
//   • Estados multi-select
//   • Tipos multi-select
//   • Confirmación (ENTREGADO / PENDIENTE)
//   • Paginación automática
// ============================================================

const SearchEngineV2 = (() => {

  // ── Configuración ─────────────────────────────────────────
  const SEARCH_ENDPOINT = `${SiesaConfig.FUNCTIONS_URL}/delivery-search`
  const DEBOUNCE_MS     = 350   // ms de espera tras última tecla
  const DEFAULT_LIMIT   = 50    // registros por página

  // ── Estado interno ─────────────────────────────────────────
  let _buscando        = false
  let _debounceTimer   = null
  let _ultimaConsulta  = null   // params de la última búsqueda exitosa
  let _paginaActual    = 1
  let _totalRegistros  = 0
  let _totalPaginas    = 1

  // ── Leer filtros activos del DOM ───────────────────────────
  // Mapea exactamente los mismos controles que app.js usa
  function _leerFiltrosDOM() {
    // ── Fechas: detectar si está en modo entrega o documento
    const modoEntrega = typeof glassCalState !== 'undefined' &&
                        glassCalState.dateFilterMode === 'entrega'

    const fechaInicio = typeof glassCalState !== 'undefined' && glassCalState.startDate
      ? formatearFecha(glassCalState.startDate) : null
    const fechaFin    = typeof glassCalState !== 'undefined' && glassCalState.endDate
      ? formatearFecha(glassCalState.endDate)   : null

    // ── Texto: Spotlight general vs búsqueda por columna
    const columnSearch  = window.activeColumnSearch  // { column: 'Nro documento' | 'op' | 'Referencia', text: '...' }
    const spotlightQ    = window._spotlightQuery || ''

    let documento   = null
    let op          = null
    let referencia  = null
    let textoLibre  = null

    if (columnSearch && columnSearch.text) {
      // Spotlight "Por Factura / Por OP / Por Referencia"
      const col = columnSearch.column
      if (col === 'Nro documento') documento  = columnSearch.text
      else if (col === 'op')       op         = columnSearch.text
      else if (col === 'Referencia') referencia = columnSearch.text
      else textoLibre = columnSearch.text  // columna no mapeada → texto libre
    } else if (spotlightQ) {
      textoLibre = spotlightQ
    }

    // ── Selects y multi-selects
    const cliente      = document.getElementById('filtroCliente')?.value     || null
    const proveedor    = document.getElementById('filtroProveedor')?.value   || null
    const confirmacion = document.getElementById('filtroConfirmacion')?.value || null

    const estados = Array.from(
      document.querySelectorAll('#filtroEstadoDropdown input[type=checkbox]:checked')
    ).map(cb => cb.value)

    const tipos = Array.from(
      document.querySelectorAll('#filtroTipoDropdown input[type=checkbox]:checked')
    ).map(cb => cb.value)

    return {
      // Fechas
      fechaInicio        : modoEntrega ? null    : fechaInicio,
      fechaFin           : modoEntrega ? null    : fechaFin,
      fechaEntregaInicio : modoEntrega ? fechaInicio : null,
      fechaEntregaFin    : modoEntrega ? fechaFin    : null,
      // Texto
      documento,
      op,
      referencia,
      q: textoLibre,
      // Selects
      cliente    : cliente    || null,
      proveedor  : proveedor  || null,
      confirmacion: confirmacion || null,
      // Multi-selects (vacío = todos)
      estados : estados.length  > 0 ? estados  : null,
      tipos   : tipos.length    > 0 ? tipos    : null,
    }
  }

  // ── Construir query string para la EF ─────────────────────
  function _buildQueryString(filtros, page = 1, limit = DEFAULT_LIMIT) {
    const params = { page, limit }

    if (filtros.fechaInicio)        params.fechaInicio        = filtros.fechaInicio
    if (filtros.fechaFin)           params.fechaFin           = filtros.fechaFin
    if (filtros.fechaEntregaInicio) params.fechaEntregaInicio = filtros.fechaEntregaInicio
    if (filtros.fechaEntregaFin)    params.fechaEntregaFin    = filtros.fechaEntregaFin
    if (filtros.documento)          params.documento          = filtros.documento
    if (filtros.op)                 params.op                 = filtros.op
    if (filtros.referencia)         params.referencia         = filtros.referencia
    if (filtros.q)                  params.q                  = filtros.q
    if (filtros.cliente)            params.cliente            = filtros.cliente
    if (filtros.proveedor)          params.proveedor          = filtros.proveedor
    if (filtros.confirmacion)       params.confirmacion       = filtros.confirmacion
    if (filtros.estados?.length)    params.estados            = filtros.estados.join(',')
    if (filtros.tipos?.length)      params.tipos              = filtros.tipos.join(',')

    return params
  }

  // ── Renderizar estado de carga en tabla ───────────────────
  function _mostrarCargandoTabla() {
    const pEl = document.getElementById('paginacionV2');
    if (pEl) pEl.innerHTML = `
      <div class="text-center py-2 text-muted small">
        <div class="spinner-border spinner-border-sm me-2 text-primary" role="status"></div>
        Buscando registros...
      </div>`;
  }

  // ── Renderizar controles de paginación ────────────────────
  function _renderizarPaginacion(pagina, paginas, total) {
    const container = document.getElementById('paginacionV2')
    if (!container) return

    if (!total || total === 0 || paginas <= 1) { 
      container.innerHTML = total > 0 ? `<div class="text-center text-muted small mt-2">Mostrando ${total} resultado(s)</div>` : ''; 
      return 
    }

    const prevDisabled = pagina <= 1      ? 'disabled' : ''
    const nextDisabled = pagina >= paginas ? 'disabled' : ''

    container.innerHTML = `
      <div class="d-flex align-items-center gap-2 justify-content-center mt-3">
        <button class="btn btn-sm btn-outline-secondary ${prevDisabled}"
                onclick="SearchEngineV2.irAPagina(${pagina - 1})" ${prevDisabled}>
          ‹ Anterior
        </button>
        <span class="text-muted small">
          Página <strong>${pagina}</strong> de <strong>${paginas}</strong>
          &nbsp;·&nbsp; ${total.toLocaleString('es-CO')} registros
        </span>
        <button class="btn btn-sm btn-outline-secondary ${nextDisabled}"
                onclick="SearchEngineV2.irAPagina(${pagina + 1})" ${nextDisabled}>
          Siguiente ›
        </button>
      </div>`
  }

  // ── Actualizar KPIs en las tarjetas ───────────────────────
  function _actualizarKpisDesdeResultado(kpis) {
    if (!kpis) return

    const fmt  = n => Math.round(n).toLocaleString('es-CO')
    const fmtV = n => '$' + fmt(n)
    const total = (kpis.entregados || 0) + (kpis.pendientes || 0)
    const pctE  = total > 0 ? Math.round((kpis.entregados  / total) * 100) : 0
    const pctP  = total > 0 ? Math.round((kpis.pendientes  / total) * 100) : 0

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val }

    set('countEntregadas',   fmt(kpis.entregados          || 0))
    set('valEntregadas',     fmtV(kpis.valor_entregados   || 0))
    set('unitsEntregadas',   fmt(kpis.unidades_entregadas  || 0))
    set('percentEntregadas', pctE + '%')

    set('countPendientes',   fmt(kpis.pendientes          || 0))
    set('valPendientes',     fmtV(kpis.valor_pendientes   || 0))
    set('unitsPendientes',   fmt(kpis.unidades_pendientes  || 0))
    set('percentPendientes', pctP + '%')
  }

  // ── Búsqueda principal ────────────────────────────────────
  async function _ejecutarBusqueda(pagina = 1) {
    if (_buscando) return
    _buscando = true

    try {
      _mostrarCargandoTabla()

      const filtros = _leerFiltrosDOM()
      const params  = _buildQueryString(filtros, pagina, DEFAULT_LIMIT)

      _ultimaConsulta = { filtros, pagina }

      // Obtener token
      if (!window.supabase) throw new Error('Supabase no inicializado')
      const { data: { session } } = await window.supabase.auth.getSession()
      if (!session) throw new Error('Sesión expirada')

      const qs = Object.entries(params)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&')

      const response = await fetch(`${SEARCH_ENDPOINT}?${qs}`, {
        headers: {
          'apikey'       : SiesaConfig.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) throw new Error(result.error || 'Error desconocido')

      // Actualizar estado
      _paginaActual   = result.pagina   || 1
      _totalRegistros = result.total    || 0
      _totalPaginas   = result.paginas  || 1

      // Renderizar datos en Grid.js y tarjetas mediante setDatos
      if (typeof window.setDatos === 'function') {
        window.setDatos(result.data || []);
      }

      // KPIs desde la misma respuesta (sin segundo fetch)
      if (result.kpis) {
        _actualizarKpisDesdeResultado(result.kpis)
      }

      // Paginación
      _renderizarPaginacion(_paginaActual, _totalPaginas, _totalRegistros)

      console.log(`✅ SearchEngineV2: ${result.total} resultados, ${result.data?.length || 0} en página ${_paginaActual}`)

    } catch (err) {
      console.error('❌ SearchEngineV2:', err.message)
    } finally {
      _buscando = false
      if (typeof $ !== 'undefined') $('#loading').hide()
    }
  }

  // ── API pública ────────────────────────────────────────────
  return {

    /**
     * Disparar búsqueda inmediata (sin debounce).
     * Usar para cambios en selects, checkboxes, tarjetas KPI.
     */
    buscar(pagina = 1) {
      clearTimeout(_debounceTimer)
      _ejecutarBusqueda(pagina)
    },

    /**
     * Disparar búsqueda con debounce (para inputs de texto).
     */
    buscarDebounced() {
      clearTimeout(_debounceTimer)
      _debounceTimer = setTimeout(() => _ejecutarBusqueda(1), DEBOUNCE_MS)
    },

    /**
     * Ir a una página específica de los resultados actuales.
     */
    irAPagina(pagina) {
      if (pagina < 1 || pagina > _totalPaginas) return
      _ejecutarBusqueda(pagina)
    },

    /**
     * Buscar con nuevas fechas (llamado desde el calendario).
     * Recibe fechas como objetos Date.
     */
    buscarConFechas(inicio, fin, modo = 'documento') {
      if (typeof glassCalState !== 'undefined') {
        glassCalState.startDate      = inicio
        glassCalState.endDate        = fin
        glassCalState.dateFilterMode = modo
      }
      this.buscar(1)
    },

    /**
     * Estado actual para uso externo.
     */
    getEstado() {
      return {
        pagina  : _paginaActual,
        total   : _totalRegistros,
        paginas : _totalPaginas,
        buscando: _buscando,
      }
    },
  }

})()

window.SearchEngineV2 = SearchEngineV2
