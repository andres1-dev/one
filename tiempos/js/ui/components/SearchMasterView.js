import { CATALOGO_PRENDAS, normalizarPrenda } from "../../domain/services/PrendaNormalizer.js";
import { MOTIVOS_RETENCION } from "../../domain/entities/RegistroTiempo.js";

/**
 * Adaptador UI: SearchMasterView
 * Búsqueda, escáner e inicio/finalización inmediata de lotes.
 * Integra modal de confirmación rápida de prenda y cantidades.
 */
export class SearchMasterView {
  constructor({
    buscarMasterUseCase,
    iniciarTiempoUseCase,
    finalizarTiempoUseCase,
    cambiarRetencionUseCase,
    consultarActivoUseCase,
    getCurrentUser,
    onRecordUpdated
  }) {
    this.buscarMasterUseCase     = buscarMasterUseCase;
    this.iniciarTiempoUseCase    = iniciarTiempoUseCase;
    this.finalizarTiempoUseCase  = finalizarTiempoUseCase;
    this.cambiarRetencionUseCase = cambiarRetencionUseCase;
    this.consultarActivoUseCase  = consultarActivoUseCase;
    this.getCurrentUser          = getCurrentUser;
    this.onRecordUpdated         = onRecordUpdated;
    this.container               = document.getElementById("search-master-view");
    this.currentMaster           = null;
    this.activeRegistro          = null;
  }

  render() {
    this.container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <span class="card-title">
            <i class="codicon codicon-search"></i> Escanear / Buscar ID Master
          </span>
          <span class="badge" id="master-status-badge" style="background: var(--surface-2); color: var(--text-dim); border: 1px solid var(--border);">
            Esperando
          </span>
        </div>

        <form id="form-search-master">
          <div class="form-group">
            <label for="input-id-master">ID Master (Código de Barras / OP)</label>
            <div style="display: flex; gap: 8px;">
              <input 
                type="text" 
                id="input-id-master" 
                class="input-scanner" 
                placeholder="Escanee o digite ID..." 
                autocomplete="off" 
                required
                autofocus
              >
              <button type="submit" class="btn btn-primary" id="btn-search-master">
                <i class="codicon codicon-search"></i> Buscar
              </button>
            </div>
          </div>
        </form>

        <div id="master-info-container" style="display: none; margin-top: 14px;">
          <div class="data-grid">
            <div class="data-item">
              <div class="label">ID Master / OP</div>
              <div class="value" id="val-master-id">-</div>
            </div>
            <div class="data-item">
              <div class="label">Referencia</div>
              <div class="value" id="val-referencia">-</div>
            </div>
            <div class="data-item">
              <div class="label">Taller / Planta</div>
              <div class="value" id="val-taller">-</div>
            </div>
            <div class="data-item">
              <div class="label">Línea / Cuento</div>
              <div class="value" id="val-linea">-</div>
            </div>
            <div class="data-item">
              <div class="label">Prenda</div>
              <div class="value" id="val-prenda">-</div>
            </div>
            <div class="data-item">
              <div class="label">Género</div>
              <div class="value" id="val-genero">-</div>
            </div>
            <div class="data-item">
              <div class="label">Cantidad</div>
              <div class="value" id="val-cantidad">-</div>
            </div>
            <div class="data-item">
              <div class="label">Productora</div>
              <div class="value" id="val-productora">-</div>
            </div>
          </div>

          <!-- Botones de Acción Inmediata -->
          <div id="master-actions-container" style="margin-top: 14px; display: flex; flex-direction: column; gap: 8px;">
            <button class="btn btn-success btn-block" id="btn-iniciar-lote" style="padding: 12px; font-size: 14px; font-weight: 600;">
              <i class="codicon codicon-play"></i> Iniciar Conteo
            </button>
            <button class="btn btn-danger btn-block" id="btn-finalizar-lote" style="display: none; padding: 12px; font-size: 14px; font-weight: 600;">
              <i class="codicon codicon-debug-stop"></i> Finalizar Proceso
            </button>
          </div>
        </div>

        <div id="search-feedback" style="margin-top: 10px;"></div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const form = document.getElementById("form-search-master");
    const input = document.getElementById("input-id-master");
    const feedback = document.getElementById("search-feedback");
    const statusBadge = document.getElementById("master-status-badge");

    form.onsubmit = async (e) => {
      e.preventDefault();
      const idMaster = input.value.trim();
      if (!idMaster) return;

      feedback.innerHTML = `<div class="alert alert-warning"><i class="codicon codicon-loading codicon-modifier-spin"></i> Consultando #${idMaster}...</div>`;
      statusBadge.innerHTML = `<i class="codicon codicon-loading codicon-modifier-spin"></i> Buscando`;
      statusBadge.className = "badge";

      try {
        const item = await this.buscarMasterUseCase.execute(idMaster);
        this.currentMaster = item;
        
        // Consultar de forma ultrarrápida si ya está en proceso activo
        if (this.consultarActivoUseCase) {
          this.activeRegistro = await this.consultarActivoUseCase.execute(item.id_master);
        } else {
          this.activeRegistro = null;
        }

        this.displayMasterData(item);
        feedback.innerHTML = "";
        
        if (this.activeRegistro) {
          statusBadge.innerHTML = `<i class="codicon codicon-play"></i> En Proceso`;
          statusBadge.className = "badge badge-active";
        } else {
          statusBadge.innerHTML = `<i class="codicon codicon-check"></i> Listo`;
          statusBadge.className = "badge badge-active";
        }

      } catch (err) {
        this.currentMaster = null;
        this.activeRegistro = null;
        document.getElementById("master-info-container").style.display = "none";
        statusBadge.innerHTML = `<i class="codicon codicon-error"></i> No Encontrado`;
        statusBadge.className = "badge badge-retained";
        feedback.innerHTML = `<div class="alert alert-danger"><i class="codicon codicon-warning"></i> ${err.message}</div>`;
      }
    };

    // Botón Iniciar Lote
    const btnIniciar = document.getElementById("btn-iniciar-lote");
    if (btnIniciar) {
      btnIniciar.onclick = () => {
        if (!this.currentMaster) return;
        this.showConfirmStartModal(this.currentMaster);
      };
    }

    // Botón Finalizar Lote
    const btnFinalizar = document.getElementById("btn-finalizar-lote");
    if (btnFinalizar) {
      btnFinalizar.onclick = () => {
        if (!this.currentMaster) return;
        this.showRetainModalOnFinish(this.currentMaster.id_master);
      };
    }
  }

  displayMasterData(item) {
    document.getElementById("master-info-container").style.display = "block";
    document.getElementById("val-master-id").textContent = `${item.id_master} (OP: ${item.id_master})`;
    document.getElementById("val-referencia").textContent = item.referencia || "-";
    document.getElementById("val-taller").textContent = item.nombre_planta || item.taller || "-";
    document.getElementById("val-linea").textContent = item.cuento || item.linea || "-";
    
    const prendaTexto = item.prenda || normalizarPrenda(item.descripcion);
    document.getElementById("val-prenda").innerHTML = prendaTexto 
      ? `<strong>${prendaTexto}</strong> <span style="font-size:10px;color:var(--text-dim);">(${item.descripcion || ''})</span>` 
      : (item.descripcion || "-");
      
    document.getElementById("val-genero").textContent = item.genero || "-";
    document.getElementById("val-cantidad").textContent = item.cantidad || 0;
    document.getElementById("val-productora").textContent = item.productora || 0;

    const btnIniciar = document.getElementById("btn-iniciar-lote");
    const btnFinalizar = document.getElementById("btn-finalizar-lote");

    if (this.activeRegistro) {
      if (btnIniciar) btnIniciar.style.display = "none";
      if (btnFinalizar) btnFinalizar.style.display = "block";
    } else {
      if (btnIniciar) btnIniciar.style.display = "block";
      if (btnFinalizar) btnFinalizar.style.display = "none";
    }
  }

  /**
   * Modal para confirmar Prenda y Cantidades antes de Iniciar
   */
  showConfirmStartModal(masterItem) {
    const modalContainer = document.getElementById("modal-container");
    if (!modalContainer) return;

    const prendaSugerida = masterItem.prenda || normalizarPrenda(masterItem.descripcion) || "";
    const cantidadSugerida = Number(masterItem.cantidad) || 0;
    const productoraSugerida = Number(masterItem.productora) || 0;

    modalContainer.innerHTML = `
      <div class="modal-overlay" id="modal-confirm-overlay">
        <div class="modal-content" style="max-width: 480px;">
          <div class="card-header">
            <span class="card-title">
              <i class="codicon codicon-pass"></i> Confirmar Inicio de Lote #${masterItem.id_master}
            </span>
            <button class="btn btn-outline btn-sm" id="btn-close-confirm-modal">
              <i class="codicon codicon-close"></i>
            </button>
          </div>

          <div style="margin: 14px 0;">
            <p style="margin-bottom: 12px; color: var(--text-dim); font-size: 13px;">
              Verifique y ajuste el tipo de prenda y las cantidades antes de registrar el inicio del conteo:
            </p>

            <div class="form-group" style="margin-bottom: 12px;">
              <label for="modal-input-prenda">Tipo de Prenda</label>
              <input 
                type="text" 
                id="modal-input-prenda" 
                list="catalogo-prendas-list"
                class="form-control" 
                value="${prendaSugerida}" 
                style="font-weight: 600; text-transform: uppercase;"
                required
              >
              <datalist id="catalogo-prendas-list">
                ${CATALOGO_PRENDAS.map(p => `<option value="${p}">`).join("")}
              </datalist>
            </div>

            <div class="form-group" style="margin-bottom: 12px;">
              <label for="modal-input-cantidad">Cantidad (Unidades)</label>
              <input 
                type="number" 
                id="modal-input-cantidad" 
                class="form-control" 
                value="${cantidadSugerida}" 
                min="1" 
                step="1"
                required
              >
            </div>

            <div style="background: var(--surface-2); padding: 8px 12px; border-radius: 4px; font-size: 12px; color: var(--text-muted);">
              <strong>Referencia:</strong> ${masterItem.referencia || '-'} &bull; 
              <strong>Taller:</strong> ${masterItem.nombre_planta || masterItem.taller || '-'}
            </div>
          </div>

          <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px;">
            <button class="btn btn-outline" id="btn-cancel-confirm">Cancelar</button>
            <button class="btn btn-success" id="btn-submit-confirm" style="font-weight: 600;">
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

    document.getElementById("btn-close-confirm-modal").onclick = closeModal;
    document.getElementById("btn-cancel-confirm").onclick = closeModal;

    const inputPrenda = document.getElementById("modal-input-prenda");
    const inputCantidad = document.getElementById("modal-input-cantidad");
    const btnSubmit = document.getElementById("btn-submit-confirm");

    // Auto-focus en prenda
    inputPrenda.focus();

    // Atajo Enter para confirmar
    const handleKeyEnter = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        btnSubmit.click();
      } else if (e.key === "Escape") {
        closeModal();
      }
    };
    inputPrenda.addEventListener("keydown", handleKeyEnter);
    inputCantidad.addEventListener("keydown", handleKeyEnter);

    btnSubmit.onclick = async () => {
      const prendaFinal = normalizarPrenda(inputPrenda.value.trim()) || inputPrenda.value.trim();
      const cantidadFinal = parseInt(inputCantidad.value, 10) || 0;
      const productoraFinal = Number(masterItem.productora) || 0;

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

      btnSubmit.disabled = true;
      btnSubmit.innerHTML = `<i class="codicon codicon-loading codicon-modifier-spin"></i> Iniciando...`;

      try {
        const usuario = typeof this.getCurrentUser === "function" ? this.getCurrentUser() : null;
        const nombreOperario = usuario?.displayName || "Operario";

        const itemActualizado = {
          ...masterItem,
          prenda: prendaFinal,
          cantidad: cantidadFinal,
          productora: productoraFinal
        };

        const { registro, yaExistia } = await this.iniciarTiempoUseCase.execute({
          masterItem: itemActualizado,
          escaneadoPor: nombreOperario
        });

        this.activeRegistro = registro;
        this.currentMaster = itemActualizado;

        closeModal();

        const feedback = document.getElementById("search-feedback");
        if (feedback) {
          feedback.innerHTML = `
            <div class="alert alert-success">
              <i class="codicon codicon-check"></i> ${yaExistia ? 'Proceso reanudado' : 'Conteo iniciado'} para #${masterItem.id_master} (${prendaFinal}, ${cantidadFinal} unds).
            </div>
          `;
        }

        const statusBadge = document.getElementById("master-status-badge");
        if (statusBadge) {
          statusBadge.innerHTML = `<i class="codicon codicon-play"></i> En Proceso`;
          statusBadge.className = "badge badge-active";
        }

        const btnIniciar = document.getElementById("btn-iniciar-lote");
        const btnFinalizar = document.getElementById("btn-finalizar-lote");
        if (btnIniciar) btnIniciar.style.display = "none";
        if (btnFinalizar) btnFinalizar.style.display = "block";

        if (this.onRecordUpdated) this.onRecordUpdated();
        this.focus();

      } catch (err) {
        alert("Error al iniciar conteo: " + err.message);
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = `<i class="codicon codicon-play"></i> Confirmar e Iniciar`;
      }
    };
  }

  /**
   * Modal de Finalización de Lote con verificación de Retención
   */
  showRetainModalOnFinish(id_master) {
    const modalContainer = document.getElementById("modal-container");
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content" style="max-width: 450px;">
          <div class="card-header">
            <span class="card-title">Finalizar Lote #${id_master}</span>
            <button class="btn btn-outline btn-sm" id="btn-close-finish-modal">
              <i class="codicon codicon-close"></i>
            </button>
          </div>
          
          <div style="margin: 14px 0;">
            <p style="margin-bottom: 12px; font-weight: 500;">¿El lote finalizado quedó retenido?</p>
            
            <div style="display: flex; gap: 10px; margin-bottom: 14px;">
              <button class="btn btn-outline" id="btn-finish-no-retenido" style="flex: 1; padding: 10px;">
                <i class="codicon codicon-check"></i> No, terminó OK
              </button>
              <button class="btn btn-danger" id="btn-finish-si-retenido" style="flex: 1; padding: 10px;">
                <i class="codicon codicon-warning"></i> Sí, quedó retenido
              </button>
            </div>

            <div id="finish-motivo-container" style="display: none;">
              <label for="select-finish-motivo" style="color: var(--warning);">Motivo de Retención</label>
              <select id="select-finish-motivo" class="form-control">
                <option value="">-- Seleccionar Motivo --</option>
                ${MOTIVOS_RETENCION.map(m => `<option value="${m}">${m}</option>`).join("")}
              </select>
            </div>
          </div>

          <div style="display: flex; gap: 8px; justify-content: flex-end;">
            <button class="btn btn-outline" id="btn-cancel-finish">Cancelar</button>
            <button class="btn btn-primary" id="btn-confirm-finish" disabled>
              Confirmar Finalización
            </button>
          </div>
        </div>
      </div>
    `;

    const closeModal = () => {
      modalContainer.innerHTML = "";
      this.focus();
    };

    document.getElementById("btn-close-finish-modal").onclick = closeModal;
    document.getElementById("btn-cancel-finish").onclick = closeModal;

    const motivoContainer = document.getElementById("finish-motivo-container");
    const btnNoRet = document.getElementById("btn-finish-no-retenido");
    const btnSiRet = document.getElementById("btn-finish-si-retenido");
    const btnConfirm = document.getElementById("btn-confirm-finish");
    const motivoSelect = document.getElementById("select-finish-motivo");

    let isRetained = false;

    btnNoRet.onclick = () => {
      isRetained = false;
      motivoContainer.style.display = "none";
      btnConfirm.disabled = false;
      btnConfirm.textContent = "Confirmar (No Retenido)";
    };

    btnSiRet.onclick = () => {
      isRetained = true;
      motivoContainer.style.display = "block";
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
        await this.finalizarTiempoUseCase.execute({ id_master });

        if (isRetained) {
          const motivo = motivoSelect.value;
          if (motivo) {
            await this.cambiarRetencionUseCase.execute({
              id_master,
              nuevoEstadoRetenido: true,
              motivo
            });
          }
        }

        closeModal();

        const feedback = document.getElementById("search-feedback");
        if (feedback) {
          feedback.innerHTML = `
            <div class="alert alert-success">
              <i class="codicon codicon-pass-filled"></i> Lote #${id_master} finalizado correctamente.
            </div>
          `;
        }

        const statusBadge = document.getElementById("master-status-badge");
        if (statusBadge) {
          statusBadge.innerHTML = `<i class="codicon codicon-pass-filled"></i> Finalizado`;
          statusBadge.className = "badge badge-finished";
        }

        const btnIniciar = document.getElementById("btn-iniciar-lote");
        const btnFinalizar = document.getElementById("btn-finalizar-lote");
        if (btnIniciar) btnIniciar.style.display = "block";
        if (btnFinalizar) btnFinalizar.style.display = "none";

        this.activeRegistro = null;
        if (this.onRecordUpdated) this.onRecordUpdated();
        this.focus();

      } catch (err) {
        alert("Error al finalizar lote: " + err.message);
        btnConfirm.disabled = false;
        btnConfirm.innerHTML = `Confirmar Finalización`;
      }
    };
  }

  focus() {
    const input = document.getElementById("input-id-master");
    if (input) {
      input.focus();
      input.select();
    }
  }
}
