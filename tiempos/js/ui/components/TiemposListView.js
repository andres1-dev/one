import { CATALOGO_PRENDAS, normalizarPrenda } from "../../domain/services/PrendaNormalizer.js";
import { MOTIVOS_RETENCION } from "../../domain/entities/RegistroTiempo.js";

/**
 * Adaptador UI: TiemposListView
 * Tabla principal con búsqueda integrada en el card-header y modales de confirmación.
 */
export class TiemposListView {
  constructor({
    listarUltimosTiemposUseCase,
    listarHistoricosUseCase,
    cambiarRetencionUseCase,
    finalizarTiempoUseCase,
    buscarMasterUseCase,
    iniciarTiempoUseCase,
    consultarActivoUseCase,
    getCurrentUser
  }) {
    this.listarUltimosTiemposUseCase = listarUltimosTiemposUseCase;
    this.listarHistoricosUseCase     = listarHistoricosUseCase;
    this.cambiarRetencionUseCase     = cambiarRetencionUseCase;
    this.finalizarTiempoUseCase      = finalizarTiempoUseCase;
    this.buscarMasterUseCase         = buscarMasterUseCase;
    this.iniciarTiempoUseCase        = iniciarTiempoUseCase;
    this.consultarActivoUseCase      = consultarActivoUseCase;
    this.getCurrentUser              = getCurrentUser;
    this.container                   = document.getElementById("tiempos-list-view");
    this.records                     = [];
    this.mode                        = 'activos'; // 'activos' o 'historicos'
    this.filtroPrenda                = null;
    this.timerInterval               = null;
  }

  render() {
    this.container.innerHTML = `
      <div class="card">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; gap: 14px; flex-wrap: wrap;">
          
          <!-- Lado Izquierdo: Título y Buscador Integrado -->
          <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
            <span class="card-title">
              <i class="codicon codicon-table"></i> 
              ${this.mode === 'activos' ? 'Registros Activos' : 'Históricos (Google Sheets)'}
            </span>

            <form id="form-header-search" style="display: inline-flex; gap: 6px; align-items: center; margin: 0;">
              <div class="search-input-wrapper">
                <i class="codicon codicon-search search-icon-inside"></i>
                <input 
                  type="text" 
                  id="input-header-id-master" 
                  class="search-input-field" 
                  placeholder="Escanear / Buscar OP..." 
                  autocomplete="off" 
                  required
                  autofocus
                >
              </div>
              <button type="submit" class="btn btn-accent btn-sm" id="btn-header-search">
                <i class="codicon codicon-play"></i> Iniciar OP
              </button>
            </form>
          </div>

          <!-- Lado Derecho: Selector de Modo (Segmented) y Refresco -->
          <div style="display: flex; gap: 10px; align-items: center;">
            <div class="tab-group">
              <button class="tab-btn ${this.mode === 'activos' ? 'active' : ''}" id="btn-mode-activos">
                <i class="codicon codicon-pulse"></i> Activos
              </button>
              <button class="tab-btn ${this.mode === 'historicos' ? 'active' : ''}" id="btn-mode-historicos">
                <i class="codicon codicon-history"></i> Históricos
              </button>
            </div>

            <button class="btn btn-outline btn-sm" id="btn-refresh-list" title="Actualizar lista">
              <i class="codicon codicon-refresh"></i> Refrescar
            </button>
          </div>
        </div>

        <div id="header-search-feedback" style="padding: 0 18px;"></div>

        <!-- Panel de Métricas y Ponderado General (solo en modo histórico) -->
        ${this.mode === 'historicos' ? '<div id="metrics-summary-container" style="padding: 16px 18px 0 18px;"></div>' : ''}

        <!-- Catálogo de Prendas Únicas y Ponderados Específicos (solo en modo histórico) -->
        ${this.mode === 'historicos' ? '<div id="catalog-summary-container" style="padding: 0 18px 16px 18px;"></div>' : ''}

        <div class="table-container" style="margin: ${this.mode === 'historicos' ? '0 18px 18px 18px' : '0'}; border: none; border-radius: 0;">
          <table>
            <thead>
              <tr>
                <th>OP</th>
                <th>Referencia</th>
                <th>Planta</th>
                <th>Prenda</th>
                <th style="text-align: right;">Cantidad</th>
                <th>Ingreso</th>
                <th>Duración</th>
                <th>Tiempo Prenda</th>
                <th>Escaneado Por</th>
                ${this.mode === 'activos' ? '<th style="text-align: center;">Acción</th>' : ''}
              </tr>
            </thead>
            <tbody id="tiempos-table-body">
              <tr>
                <td colspan="${this.mode === 'activos' ? '10' : '9'}" style="text-align: center; color: var(--text-dim); padding: 32px;">
                  <i class="codicon codicon-loading codicon-modifier-spin" style="font-size: 20px;"></i>
                  <div style="margin-top: 8px; font-weight: 500;">Cargando registros...</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.bindEvents();
    this.loadRecords();
    
    if (this.mode === 'activos') {
      this.startTimers();
    } else {
      this.stopTimers();
    }
  }

  bindEvents() {
    // Modo Activos / Históricos
    document.getElementById("btn-mode-activos").onclick = () => {
      this.mode = 'activos';
      this.render();
    };
    
    document.getElementById("btn-mode-historicos").onclick = () => {
      this.mode = 'historicos';
      this.render();
    };

    document.getElementById("btn-refresh-list").onclick = () => this.loadRecords();

    // Búsqueda en Header
    const searchForm = document.getElementById("form-header-search");
    const searchInput = document.getElementById("input-header-id-master");
    const searchBtn = document.getElementById("btn-header-search");
    const feedback = document.getElementById("header-search-feedback");

    if (searchForm) {
      searchForm.onsubmit = async (e) => {
        e.preventDefault();
        const idMaster = searchInput.value.trim();
        if (!idMaster) return;

        searchBtn.disabled = true;
        searchBtn.innerHTML = `<i class="codicon codicon-loading codicon-modifier-spin"></i>`;
        if (feedback) feedback.innerHTML = "";

        try {
          const masterItem = await this.buscarMasterUseCase.execute(idMaster);
          
          let activeRecord = null;
          if (this.consultarActivoUseCase) {
            activeRecord = await this.consultarActivoUseCase.execute(idMaster);
          }

          if (activeRecord) {
            // Ya está activo: abrir modal de estado / finalización
            this.showActiveLotModal(masterItem, activeRecord);
          } else {
            // No está activo: abrir modal de confirmación de inicio de lote
            this.showStartLotModal(masterItem);
          }

          searchInput.value = "";
        } catch (err) {
          if (feedback) {
            feedback.innerHTML = `
              <div class="alert alert-danger" style="margin: 10px 0;">
                <i class="codicon codicon-warning"></i> ${err.message}
              </div>
            `;
            setTimeout(() => { if (feedback) feedback.innerHTML = ""; }, 4000);
          }
        } finally {
          searchBtn.disabled = false;
          searchBtn.innerHTML = `<i class="codicon codicon-play"></i> Iniciar OP`;
          this.focus();
        }
      };
    }
  }

  /**
   * Modal de Inicio de Lote con toda la información del Master y campos de confirmación
   */
  showStartLotModal(masterItem) {
    const modalContainer = document.getElementById("modal-container");
    if (!modalContainer) return;

    const prendaSugerida = masterItem.prenda || normalizarPrenda(masterItem.descripcion) || "";
    const cantidadSugerida = Number(masterItem.cantidad) || 0;

    modalContainer.innerHTML = `
      <div class="modal-overlay" id="modal-start-lot-overlay">
        <div class="modal-content">
          <div class="modal-header-box">
            <span class="modal-header-title">
              <i class="codicon codicon-play" style="color: var(--accent);"></i> Iniciar Conteo — OP #${masterItem.id_master}
            </span>
            <button class="btn btn-outline btn-sm" id="btn-close-start-modal" style="border: none; padding: 4px;">
              <i class="codicon codicon-close" style="font-size: 16px;"></i>
            </button>
          </div>

          <!-- Ficha de Datos del Lote -->
          <div class="modal-info-card">
            <div class="info-grid-2col">
              <div>
                <div class="info-item-label">OP</div>
                <div class="info-item-value" style="font-family: var(--font-mono); font-size: 13.5px;">${masterItem.id_master}</div>
              </div>
              <div>
                <div class="info-item-label">Referencia</div>
                <div class="info-item-value">${masterItem.referencia || '-'}</div>
              </div>
              <div>
                <div class="info-item-label">Línea</div>
                <div class="info-item-value">${masterItem.cuento || masterItem.linea || '-'}</div>
              </div>
              <div>
                <div class="info-item-label">Género</div>
                <div class="info-item-value">${masterItem.genero || '-'}</div>
              </div>
            </div>

            <!-- Planta al final en ancho completo -->
            <div class="info-full-planta">
              <div class="info-item-label">Planta</div>
              <div class="info-item-value" style="color: var(--text);">${masterItem.nombre_planta || masterItem.taller || '-'}</div>
            </div>

            ${masterItem.descripcion ? `
              <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border); font-size: 11.5px; color: var(--text-muted);">
                <span class="info-item-label" style="display:inline;">Descripción ERP:</span> ${masterItem.descripcion}
              </div>
            ` : ''}
          </div>

          <!-- Campos editables antes de iniciar -->
          <div class="form-group">
            <label for="modal-input-prenda">Prenda</label>
            <input 
              type="text" 
              id="modal-input-prenda" 
              list="catalogo-prendas-list"
              value="${prendaSugerida}" 
              style="font-weight: 700; text-transform: uppercase;"
              placeholder="Seleccionar o escribir prenda..."
              required
            >
            <datalist id="catalogo-prendas-list">
              ${CATALOGO_PRENDAS.map(p => `<option value="${p}">`).join("")}
            </datalist>
          </div>

          <div class="form-group">
            <label for="modal-input-cantidad">Cantidad (Unidades)</label>
            <input 
              type="number" 
              id="modal-input-cantidad" 
              value="${cantidadSugerida}" 
              min="1" 
              step="1" 
              style="font-family: var(--font-mono); font-weight: 700;"
              required
            >
          </div>

          <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
            <button class="btn btn-outline" id="btn-cancel-start">Cancelar</button>
            <button class="btn btn-success" id="btn-confirm-start" style="padding: 0 18px;">
              <i class="codicon codicon-play"></i> Confirmar e Iniciar
            </button>
          </div>
        </div>
      </div>
    `;

    const closeModal = () => {
      modalContainer.innerHTML = "";
      this.focus();
    };

    document.getElementById("btn-close-start-modal").onclick = closeModal;
    document.getElementById("btn-cancel-start").onclick = closeModal;

    const inputPrenda = document.getElementById("modal-input-prenda");
    const inputCantidad = document.getElementById("modal-input-cantidad");
    const btnConfirm = document.getElementById("btn-confirm-start");

    inputPrenda.focus();

    const handleKey = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        btnConfirm.click();
      } else if (e.key === "Escape") {
        closeModal();
      }
    };
    inputPrenda.addEventListener("keydown", handleKey);
    inputCantidad.addEventListener("keydown", handleKey);

    btnConfirm.onclick = async () => {
      const prendaFinal = normalizarPrenda(inputPrenda.value.trim()) || inputPrenda.value.trim();
      const cantidadFinal = parseInt(inputCantidad.value, 10) || 0;

      if (!prendaFinal) {
        alert("Debe ingresar un tipo de prenda válido.");
        inputPrenda.focus();
        return;
      }
      if (cantidadFinal <= 0) {
        alert("La cantidad debe ser mayor a cero.");
        inputCantidad.focus();
        return;
      }

      btnConfirm.disabled = true;
      btnConfirm.innerHTML = `<i class="codicon codicon-loading codicon-modifier-spin"></i> Iniciando...`;

      try {
        const usuario = typeof this.getCurrentUser === "function" ? this.getCurrentUser() : null;
        const nombreOperario = usuario?.displayName || "Operario";

        const itemActualizado = {
          ...masterItem,
          prenda: prendaFinal,
          cantidad: cantidadFinal,
          productora: masterItem.productora || ""
        };

        await this.iniciarTiempoUseCase.execute({
          masterItem: itemActualizado,
          escaneadoPor: nombreOperario
        });

        closeModal();
        await this.loadRecords();
        this.focus();
      } catch (err) {
        alert("Error al iniciar conteo: " + err.message);
        btnConfirm.disabled = false;
        btnConfirm.innerHTML = `<i class="codicon codicon-play"></i> Confirmar e Iniciar`;
      }
    };
  }

  /**
   * Modal informativo y de acción rápida para lote que ya está activo
   */
  showActiveLotModal(masterItem, activeRecord) {
    const modalContainer = document.getElementById("modal-container");
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content">
          <div class="modal-header-box">
            <span class="modal-header-title" style="color: var(--accent);">
              <i class="codicon codicon-pulse"></i> Lote en Proceso — OP #${masterItem.id_master}
            </span>
            <button class="btn btn-outline btn-sm" id="btn-close-active-modal" style="border: none; padding: 4px;">
              <i class="codicon codicon-close" style="font-size: 16px;"></i>
            </button>
          </div>

          <div class="alert alert-warning" style="margin-bottom: 14px;">
            <i class="codicon codicon-info"></i> 
            <div>Este lote ya se encuentra en conteo activo desde las <strong>${this.formatTime(activeRecord.fecha_ingreso)}</strong>.</div>
          </div>

          <div class="modal-info-card">
            <div class="info-grid-2col">
              <div>
                <div class="info-item-label">OP</div>
                <div class="info-item-value" style="font-family: var(--font-mono);">${masterItem.id_master}</div>
              </div>
              <div>
                <div class="info-item-label">Referencia</div>
                <div class="info-item-value">${masterItem.referencia || '-'}</div>
              </div>
              <div>
                <div class="info-item-label">Línea</div>
                <div class="info-item-value">${masterItem.cuento || masterItem.linea || '-'}</div>
              </div>
              <div>
                <div class="info-item-label">Prenda</div>
                <div class="info-item-value" style="font-weight: 700;">${activeRecord.prenda || masterItem.descripcion || '-'}</div>
              </div>
              <div>
                <div class="info-item-label">Cantidad</div>
                <div class="info-item-value" style="font-family: var(--font-mono);">${activeRecord.cantidad || masterItem.cantidad || 0} unds</div>
              </div>
              <div>
                <div class="info-item-label">Escaneado Por</div>
                <div class="info-item-value">${activeRecord.escaneado_por || '-'}</div>
              </div>
            </div>

            <!-- Planta al final -->
            <div class="info-full-planta">
              <div class="info-item-label">Planta</div>
              <div class="info-item-value">${masterItem.nombre_planta || masterItem.taller || '-'}</div>
            </div>
          </div>

          <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
            <button class="btn btn-outline" id="btn-cancel-active">Cerrar</button>
            <button class="btn btn-danger" id="btn-finish-active">
              <i class="codicon codicon-debug-stop"></i> Finalizar Proceso
            </button>
          </div>
        </div>
      </div>
    `;

    const closeModal = () => {
      modalContainer.innerHTML = "";
      this.focus();
    };

    document.getElementById("btn-close-active-modal").onclick = closeModal;
    document.getElementById("btn-cancel-active").onclick = closeModal;

    document.getElementById("btn-finish-active").onclick = () => {
      closeModal();
      this.showRetainModalOnFinish(masterItem.id_master);
    };
  }

  async loadRecords() {
    const tbody = document.getElementById("tiempos-table-body");
    if (!tbody) return;

    try {
      if (this.mode === 'activos') {
        this.records = await this.listarUltimosTiemposUseCase.execute(50);
      } else {
        this.records = await this.listarHistoricosUseCase.execute(100);
      }

      if (!this.records || this.records.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="${this.mode === 'activos' ? '10' : '9'}" style="text-align: center; color: var(--text-dim); padding: 36px;">
              <i class="codicon codicon-info" style="font-size: 24px; color: var(--text-dim); margin-bottom: 8px;"></i>
              <div style="font-weight: 500;">
                ${this.mode === 'activos' 
                  ? 'No hay registros activos en este momento.' 
                  : 'No hay registros históricos en Google Sheets.'}
              </div>
            </td>
          </tr>
        `;
        
        if (this.mode === 'historicos') {
          const m = document.getElementById("metrics-summary-container");
          const c = document.getElementById("catalog-summary-container");
          if (m) m.innerHTML = "";
          if (c) c.innerHTML = "";
        }
        return;
      }

      if (this.mode === 'historicos') {
        this.renderMetricsAndCatalog();
      }

      const registrosAMostrar = this.filtroPrenda
        ? this.records.filter(r => (normalizarPrenda(r.prenda) || r.prenda) === this.filtroPrenda)
        : this.records;

      tbody.innerHTML = registrosAMostrar.map((r) => {
        const isRetained = r.retenido;
        const isFinished = Boolean(r.fecha_finalizacion);
        const prendaNorm = normalizarPrenda(r.prenda) || r.prenda || "-";
        const duracionSegundos = r.getDuracionSegundos();
        const duracionFormateada = this.formatDurationExact(duracionSegundos);
        const cantidad = Math.max(1, Number(r.cantidad) || 1);
        const ponderadoUnitario = (duracionSegundos / cantidad).toFixed(3);

        return `
          <tr data-id-master="${r.id_master}">
            <td><span class="op-badge">${r.op}</span></td>
            <td><span style="font-weight: 600;">${r.referencia || "-"}</span></td>
            <td><span style="color: var(--text-muted);">${r.taller || "-"}</span></td>
            <td><span class="prenda-cell">${prendaNorm}</span></td>
            <td style="text-align: right; font-family: var(--font-mono); font-weight: 700;">${r.cantidad}</td>
            <td style="color: var(--text-muted); font-size: 12.5px;">${this.formatTime(r.fecha_ingreso)}</td>
            <td>
              <div class="live-timer" data-id-master="${r.id_master}" data-start-time="${r.fecha_ingreso}" data-retention-time="${isRetained ? r.fecha_inicio_retencion || r.fecha_liberacion || r.fecha_ingreso : ''}" ${isFinished ? 'data-finished="true"' : ''} data-is-retained="${isRetained}">
                ${isFinished ? duracionFormateada : '<span class="timer-loading">--:--:--.---</span>'}
              </div>
            </td>
            <td>
              <span class="tiempo-prenda-badge">
                ${ponderadoUnitario}s
              </span>
            </td>
            <td style="color: var(--text-muted); font-size: 12.5px;">${r.escaneado_por || "-"}</td>
            ${this.mode === 'activos' ? `
            <td style="text-align: center;">
              ${isRetained ? `
                <button class="btn btn-soft-warning btn-sm btn-liberar" data-id-master="${r.id_master}">
                  <i class="codicon codicon-unlock"></i> Liberar
                </button>
              ` : isFinished ? `
                <span style="color: var(--success); font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                  <i class="codicon codicon-check"></i> Listo
                </span>
              ` : `
                <button class="btn btn-soft-danger btn-sm btn-finalizar" data-id-master="${r.id_master}" title="Finalizar operación">
                  <i class="codicon codicon-debug-stop"></i> Finalizar
                </button>
              `}
            </td>
            ` : ''}
          </tr>
        `;
      }).join("");

      if (this.mode === 'activos') {
        document.querySelectorAll(".btn-liberar").forEach(btn => {
          btn.onclick = async (e) => {
            e.stopPropagation();
            const id = btn.getAttribute("data-id-master");
            await this.quickRelease(id);
          };
        });

        document.querySelectorAll(".btn-finalizar").forEach(btn => {
          btn.onclick = (e) => {
            e.stopPropagation();
            const id = btn.getAttribute("data-id-master");
            this.quickFinishWithRetention(id);
          };
        });
      }

    } catch (err) {
      console.error("Error cargando registros:", err);
      tbody.innerHTML = `
        <tr>
          <td colspan="${this.mode === 'activos' ? '10' : '9'}" style="text-align: center; color: var(--danger); padding: 24px;">
            <i class="codicon codicon-error"></i> Error al cargar datos: ${err.message}
          </td>
        </tr>
      `;
    }
  }

  renderMetricsAndCatalog() {
    const metricsContainer = document.getElementById("metrics-summary-container");
    const catalogContainer = document.getElementById("catalog-summary-container");
    if (!metricsContainer || !catalogContainer) return;

    let totalUnidades = 0;
    let totalSegundos = 0;
    const prendasMap = new Map();

    this.records.forEach(r => {
      const cant = Number(r.cantidad) || 0;
      const segs = r.getDuracionSegundos();
      const prendaNorm = normalizarPrenda(r.prenda) || r.prenda || "SIN ESPECIFICAR";

      totalUnidades += cant;
      totalSegundos += segs;

      if (!prendasMap.has(prendaNorm)) {
        prendasMap.set(prendaNorm, { count: 0, unidades: 0, segundos: 0 });
      }
      const p = prendasMap.get(prendaNorm);
      p.count += 1;
      p.unidades += cant;
      p.segundos += segs;
    });

    const ponderadoGeneral = totalUnidades > 0 ? (totalSegundos / totalUnidades).toFixed(3) : "0.000";
    const promedioLote = this.records.length > 0 ? (totalSegundos / this.records.length).toFixed(1) : "0.0";

    metricsContainer.innerHTML = `
      <div class="metrics-summary">
        <div class="metric-card">
          <div class="metric-title"><i class="codicon codicon-package"></i> Total Unidades</div>
          <div class="metric-value">${totalUnidades.toLocaleString()}</div>
        </div>
        <div class="metric-card">
          <div class="metric-title"><i class="codicon codicon-dashboard"></i> Ponderado por Prenda</div>
          <div class="metric-value" style="color: var(--accent);">${ponderadoGeneral}s</div>
        </div>
        <div class="metric-card">
          <div class="metric-title"><i class="codicon codicon-watch"></i> Promedio por Lote</div>
          <div class="metric-value">${promedioLote}s</div>
        </div>
        <div class="metric-card">
          <div class="metric-title"><i class="codicon codicon-symbol-class"></i> Tipos de Prenda</div>
          <div class="metric-value">${prendasMap.size}</div>
        </div>
      </div>
    `;

    const prendasArr = Array.from(prendasMap.entries())
      .map(([prenda, data]) => ({ prenda, ...data }))
      .sort((a, b) => b.unidades - a.unidades);

    catalogContainer.innerHTML = `
      <div class="catalog-summary">
        <div class="catalog-header">
          <span><i class="codicon codicon-tag"></i> Catálogo de Prendas Únicas (${prendasArr.length})</span>
          ${this.filtroPrenda ? `
            <button class="btn btn-outline btn-sm" id="btn-clear-prenda-filter" style="font-size:11px; padding:2px 8px;">
              <i class="codicon codicon-clear-all"></i> Ver Todas
            </button>
          ` : `<span style="font-size:11px; text-transform:none; color:var(--text-dim); font-weight: normal;">Haz clic en una prenda para filtrar</span>`}
        </div>
        <div class="catalog-chips">
          ${prendasArr.map(p => {
            const tiempoPrenda = p.unidades > 0 ? (p.segundos / p.unidades).toFixed(3) : "0.000";
            const isActive = this.filtroPrenda === p.prenda;
            return `
              <div class="prenda-chip ${isActive ? 'active' : ''}" data-prenda="${p.prenda}">
                <strong>${p.prenda}</strong>
                <span class="chip-badge">${p.unidades} unds</span>
                <span class="chip-badge" style="color: var(--accent); font-weight:700;">${tiempoPrenda}s</span>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;

    catalogContainer.querySelectorAll(".prenda-chip").forEach(chip => {
      chip.onclick = () => {
        const prenda = chip.getAttribute("data-prenda");
        this.filtroPrenda = this.filtroPrenda === prenda ? null : prenda;
        this.loadRecords();
      };
    });

    const btnClear = document.getElementById("btn-clear-prenda-filter");
    if (btnClear) {
      btnClear.onclick = () => {
        this.filtroPrenda = null;
        this.loadRecords();
      };
    }
  }

  async quickRelease(id_master) {
    try {
      await this.cambiarRetencionUseCase.execute({
        id_master,
        nuevoEstadoRetenido: false,
        motivo: null
      });
      await this.loadRecords();
    } catch (err) {
      alert("Error al liberar: " + err.message);
    }
  }

  quickFinishWithRetention(id_master) {
    this.showRetainModalOnFinish(id_master);
  }

  showRetainModalOnFinish(id_master) {
    const modalContainer = document.getElementById("modal-container");
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content">
          <div class="modal-header-box">
            <span class="modal-header-title">
              <i class="codicon codicon-check-all" style="color: var(--accent);"></i> Finalizar Lote #${id_master}
            </span>
            <button class="btn btn-outline btn-sm" id="btn-close-modal" style="border: none; padding: 4px;">
              <i class="codicon codicon-close" style="font-size: 16px;"></i>
            </button>
          </div>
          
          <div style="margin-bottom: 16px;">
            <p style="margin-bottom: 14px; font-weight: 500; color: var(--text-muted);">
              Seleccione el estado en el que finaliza el conteo:
            </p>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;">
              <button class="btn btn-outline" id="btn-no-retenido" style="height: 44px; padding: 0 10px;">
                <i class="codicon codicon-check" style="color: var(--success);"></i> No, terminó OK
              </button>
              <button class="btn btn-soft-danger" id="btn-si-retenido" style="height: 44px; padding: 0 10px;">
                <i class="codicon codicon-warning"></i> Sí, quedó retenido
              </button>
            </div>

            <div id="motivo-selection" style="display: none; margin-top: 12px; background: var(--warning-bg); border: 1px solid var(--warning-border); padding: 12px; border-radius: var(--radius-md);">
              <label for="select-motivo-retencion" style="color: var(--warning-text); font-weight: 700;">Motivo de Retención</label>
              <select id="select-motivo-retencion">
                <option value="">-- Seleccionar Motivo --</option>
                ${MOTIVOS_RETENCION.map(m => `<option value="${m}">${m}</option>`).join('')}
              </select>
            </div>
          </div>

          <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
            <button class="btn btn-outline" id="btn-cancel-retain">Cancelar</button>
            <button class="btn btn-primary" id="btn-confirm-retain" disabled>
              Confirmar
            </button>
          </div>
        </div>
      </div>
    `;

    const closeModal = () => modalContainer.innerHTML = '';
    document.getElementById("btn-close-modal").onclick = closeModal;
    document.getElementById("btn-cancel-retain").onclick = closeModal;

    const motivoSelection = document.getElementById("motivo-selection");
    const btnNoRetenido = document.getElementById("btn-no-retenido");
    const btnSiRetenido = document.getElementById("btn-si-retenido");
    const btnConfirm = document.getElementById("btn-confirm-retain");
    const motivoSelect = document.getElementById("select-motivo-retencion");
    
    let isRetained = false;

    btnNoRetenido.onclick = () => {
      isRetained = false;
      motivoSelection.style.display = "none";
      btnNoRetenido.classList.add("btn-primary");
      btnNoRetenido.classList.remove("btn-outline");
      btnSiRetenido.classList.remove("btn-danger");
      btnSiRetenido.classList.add("btn-soft-danger");
      btnConfirm.disabled = false;
      btnConfirm.textContent = "Confirmar (No Retenido)";
    };

    btnSiRetenido.onclick = () => {
      isRetained = true;
      motivoSelection.style.display = "block";
      btnSiRetenido.classList.add("btn-danger");
      btnSiRetenido.classList.remove("btn-soft-danger");
      btnNoRetenido.classList.remove("btn-primary");
      btnNoRetenido.classList.add("btn-outline");
      btnConfirm.disabled = !motivoSelect.value;
      btnConfirm.textContent = "Confirmar (Retenido)";
    };

    motivoSelect.onchange = () => {
      btnConfirm.disabled = !motivoSelect.value;
    };

    btnConfirm.onclick = async () => {
      btnConfirm.disabled = true;
      btnConfirm.innerHTML = `<i class="codicon codicon-loading codicon-modifier-spin"></i> Finalizando...`;
      try {
        const motivo = isRetained ? String(motivoSelect.value).trim() : null;
        await this.finalizarTiempoUseCase.execute({ 
          id_master,
          retenido: isRetained,
          motivo
        });
        
        closeModal();
        await this.loadRecords();
        this.focus();
      } catch (err) {
        alert("Error al procesar finalización: " + err.message);
        btnConfirm.disabled = false;
        btnConfirm.textContent = isRetained ? "Confirmar (Retenido)" : "Confirmar (No Retenido)";
      }
    };
  }

  formatDurationExact(seconds) {
    if (!seconds || seconds <= 0) return "00:00:00.000";
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.round((seconds % 1) * 1000);
    
    const hoursStr = hours.toString().padStart(2, '0');
    const minutesStr = minutes.toString().padStart(2, '0');
    const secondsStr = secs.toString().padStart(2, '0');
    const msStr = milliseconds.toString().padStart(3, '0');
    
    return `${hoursStr}:${minutesStr}:${secondsStr}.${msStr}`;
  }

  formatTime(isoString) {
    if (!isoString) return "-";
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  startTimers() {
    this.stopTimers();
    this.updateTimers();
    this.timerInterval = setInterval(() => this.updateTimers(), 100);
  }

  stopTimers() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  updateTimers() {
    const liveTimers = document.querySelectorAll('.live-timer:not([data-finished="true"])');
    liveTimers.forEach(timer => {
      const startTime = timer.getAttribute('data-start-time');
      const isRetained = timer.getAttribute('data-is-retained') === 'true';
      const retentionTime = timer.getAttribute('data-retention-time');
      
      if (!startTime) return;

      let start = new Date(startTime).getTime();
      if (isRetained && retentionTime) {
        start = new Date(retentionTime).getTime();
      }

      const now = Date.now();
      const diffSeconds = (now - start) / 1000;

      timer.textContent = this.formatDurationExact(diffSeconds);
      timer.classList.add('timer-active');
      
      if (isRetained) {
        timer.classList.add('timer-retained');
      }
    });
  }

  focus() {
    const input = document.getElementById("input-header-id-master");
    if (input) {
      input.focus();
      input.select();
    }
  }

  destroy() {
    this.stopTimers();
  }
}
