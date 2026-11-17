// ============================================================
// js/v2/kpi-loader-v2.js
// Carga y renderiza los KPIs de las tarjetas del dashboard
// usando la nueva EF delivery-kpis (PCR en Postgres).
//
// NO modifica actualizarStats() ni ninguna función existente.
// Convive con el código actual; en delivery.html se activa
// reemplazando la llamada a actualizarStats() por
// KpiLoaderV2.cargar(...) en el momento de integración.
//
// Tarjetas objetivo en el HTML:
//   #countEntregadas  #valEntregadas  #unitsEntregadas  #percentEntregadas
//   #countPendientes  #valPendientes  #unitsPendientes  #percentPendientes
// ============================================================

const KpiLoaderV2 = (() => {

  // ── Estado interno ────────────────────────────────────────
  let _ultimoResultado = null
  let _cargando        = false

  // ── Formateo de números estilo colombiano ─────────────────
  function _fmt(n)   { return Math.round(n).toLocaleString('es-CO') }
  function _fmtV(n)  { return '$' + _fmt(n) }
  function _fmtPct(n){ return n + '%' }

  // ── Renderizar tarjetas en el DOM ─────────────────────────
  function _renderizar(kpis) {
    const { entregadas, pendientes } = kpis

    // --- Tarjeta Entregadas ---
    const cE = document.getElementById('countEntregadas')
    const vE = document.getElementById('valEntregadas')
    const uE = document.getElementById('unitsEntregadas')
    const pE = document.getElementById('percentEntregadas')

    if (cE) cE.textContent = _fmt(entregadas.count)
    if (vE) vE.textContent = _fmtV(entregadas.valor)
    if (uE) uE.textContent = _fmt(entregadas.unidades)
    if (pE) pE.textContent = _fmtPct(entregadas.pct)

    // --- Tarjeta Pendientes ---
    const cP = document.getElementById('countPendientes')
    const vP = document.getElementById('valPendientes')
    const uP = document.getElementById('unitsPendientes')
    const pP = document.getElementById('percentPendientes')

    if (cP) cP.textContent = _fmt(pendientes.count)
    if (vP) vP.textContent = _fmtV(pendientes.valor)
    if (uP) uP.textContent = _fmt(pendientes.unidades)
    if (pP) pP.textContent = _fmtPct(pendientes.pct)
  }

  // ── Estado de carga visual ────────────────────────────────
  function _mostrarCargando() {
    const ids = [
      'countEntregadas','valEntregadas','unitsEntregadas','percentEntregadas',
      'countPendientes','valPendientes','unitsPendientes','percentPendientes'
    ];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '…';
    });
  }

  function _mostrarError(msg) {
    console.error('❌ KpiLoaderV2:', msg);
    const ids = [
      'countEntregadas','valEntregadas','unitsEntregadas','percentEntregadas',
      'countPendientes','valPendientes','unitsPendientes','percentPendientes'
    ];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el && el.textContent === '…') el.textContent = '-';
    });
  }

  // ── API pública ───────────────────────────────────────────
  return {

    /**
     * Carga KPIs desde la EF delivery-kpis y actualiza las tarjetas.
     * Acepta los mismos filtros que la EF.
     *
     * @param {Object} opciones
     * @param {string} opciones.fechaInicio  - YYYY-MM-DD
     * @param {string} opciones.fechaFin     - YYYY-MM-DD
     * @param {string[]} [opciones.estados]  - Array de estados
     * @param {string[]} [opciones.tipos]    - Array de tipos
     * @param {string}  [opciones.compania]  - ID compañía
     * @param {string}  [opciones.proveedor] - Nombre proveedor
     */
    async cargar({ fechaInicio, fechaFin, estados = null, tipos = null, compania = null, proveedor = null } = {}) {
      if (_cargando) return   // evitar llamadas concurrentes

      _cargando = true
      _mostrarCargando()

      try {
        // Convertir arrays a CSV para la EF (el api-client los convierte)
        const estadosStr   = Array.isArray(estados)   ? estados.join(',')   : (estados   || null)
        const tiposStr     = Array.isArray(tipos)     ? tipos.join(',')     : (tipos     || null)

        const result = await ApiClientV2.fetchKpis({
          fechaInicio,
          fechaFin,
          estados  : estadosStr,
          tipos    : tiposStr,
          compania,
          proveedor,
        })

        if (!result.success || !result.kpis) {
          throw new Error(result.error || 'Respuesta inválida de la EF')
        }

        _ultimoResultado = result
        _renderizar(result.kpis)

        console.log(`✅ KPIs cargados desde PCR — ${result.meta?.tiempo_ms}ms`)

      } catch (err) {
        _mostrarError(err.message)
      } finally {
        _cargando = false
      }
    },

    /**
     * Retorna el último resultado cargado (sin hacer fetch).
     * Útil para leer los KPIs en otras partes sin nuevo egreso.
     */
    getUltimoResultado() {
      return _ultimoResultado
    },

    /**
     * Atajo: cargar KPIs usando las fechas del calendario activo
     * (glassCalState) y los filtros actualmente seleccionados en el DOM.
     * Llama internamente a this.cargar(...).
     *
     * Debe llamarse DESPUÉS de que el DOM y glassCalState existan.
     */
    async cargarConFiltrosActivos() {
      // Leer rango de fechas del estado del calendario
      const inicio = typeof glassCalState !== 'undefined' && glassCalState.startDate
        ? glassCalState.startDate
        : getPrimerDiaMes()

      const fin = typeof glassCalState !== 'undefined' && glassCalState.endDate
        ? glassCalState.endDate
        : getHoy()

      const fechaInicio = formatearFecha(inicio)
      const fechaFin    = formatearFecha(fin)

      // Leer filtros activos del DOM (multi-select de estado y tipo)
      const estadosActivos = Array.from(
        document.querySelectorAll('#filtroEstadoDropdown input[type=checkbox]:checked')
      ).map(cb => cb.value)

      const tiposActivos = Array.from(
        document.querySelectorAll('#filtroTipoDropdown input[type=checkbox]:checked')
      ).map(cb => cb.value)

      const proveedorActivo = document.getElementById('filtroProveedor')?.value || null

      await this.cargar({
        fechaInicio,
        fechaFin,
        estados  : estadosActivos.length  > 0 ? estadosActivos  : null,
        tipos    : tiposActivos.length    > 0 ? tiposActivos    : null,
        proveedor: proveedorActivo || null,
      })
    },
  }

})()

// Exponer globalmente
window.KpiLoaderV2 = KpiLoaderV2
