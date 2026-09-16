import { MOTIVOS_RETENCION } from "../../domain/entities/RegistroTiempo.js";

/**
 * Vista de control de cronómetro y retenciones.
 * Identifica siempre por id_master — nunca por idx.
 */
export class TimerControlView {
  constructor({ iniciarTiempoUseCase, cambiarRetencionUseCase, finalizarTiempoUseCase, getCurrentUser, onRecordUpdated }) {
    this.iniciarTiempoUseCase    = iniciarTiempoUseCase;
    this.cambiarRetencionUseCase = cambiarRetencionUseCase;
    this.finalizarTiempoUseCase  = finalizarTiempoUseCase;
    this.getCurrentUser          = getCurrentUser;
    this.onRecordUpdated         = onRecordUpdated;
    this.container               = document.getElementById("timer-control-view");
    this.currentMaster           = null;
    this.activeRegistro          = null;
    this.timerInterval           = null;
    this.startTime               = null;
  }

  setMaster(masterItem) {
    this.currentMaster = masterItem;
    this.activeRegistro = null;
    this.stopStopwatch();
    this.render();
  }

  render() {
    if (!this.currentMaster) {
      this.container.innerHTML = `
        <div class="card" style="opacity:0.7;">
          <div class="card-header">
            <span class="card-title">
              <i class="codicon codicon-watch"></i> 2. Control de Tiempos
            </span>
          </div>
          <div style="text-align:center;padding:32px;color:var(--text-dim);">
            <i class="codicon codicon-barcode" style="font-size:32px;margin-bottom:8px;display:block;"></i>
            Escanee un <strong>ID Master</strong> para habilitar el cronómetro.
          </div>
        </div>`;
      return;
    }

    const reg        = this.activeRegistro;
    const isActive   = Boolean(reg && !reg.fecha_finalizacion);
    const isRetained = Boolean(reg?.retenido);
    const isFinished = Boolean(reg?.fecha_finalizacion);

    this.container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <span class="card-title">
            <i class="codicon codicon-watch"></i> 2. Control &rarr; ID Master: <strong>#${this.currentMaster.id_master}</strong>
          </span>
          <span class="badge ${isRetained ? 'badge-retained' : isActive ? 'badge-active' : isFinished ? 'badge-finished' : ''}">
            ${isRetained 
              ? '<i class="codicon codicon-warning"></i> RETENIDO' 
              : isActive 
                ? '<i class="codicon codicon-play"></i> EN PROCESO' 
                : isFinished 
                  ? '<i class="codicon codicon-pass-filled"></i> FINALIZADO' 
                  : '<i class="codicon codicon-circle-outline"></i> LISTO'
            }
          </span>
        </div>

        <!-- Cronómetro -->
        <div class="timer-box ${isRetained ? 'retained' : isActive ? 'running' : ''}" id="timer-box">
          <div class="timer-digits" id="timer-digits">00:00:00.000</div>
          <div class="timer-label">${isActive ? 'Tiempo transcurrido desde ingreso' : isFinished ? 'Proceso finalizado' : 'Esperando inicio'}</div>
        </div>

        <!-- Panel Retención -->
        ${isActive || isRetained ? `
        <div class="retention-panel ${isRetained ? 'is-active' : ''}" id="retention-panel">
          <label class="switch-label">
            <span>
              <i class="codicon codicon-warning" style="color:${isRetained ? 'var(--warning)' : 'var(--text-muted)'};"></i>
              Retenido: <strong style="color:${isRetained ? 'var(--warning)' : 'var(--text-muted)'};">
                ${isRetained ? 'SÍ — ' + (reg.motivo || '') : 'NO'}
              </strong>
            </span>
            ${isRetained ? `
            <button class="btn btn-outline btn-sm btn-liberar" id="btn-liberar-panel" style="color: #b45309; border-color: #d97706;">
              <i class="codicon codicon-unlock"></i> Liberar
            </button>
            ` : ''}
          </label>

          ${isRetained ? `
          <div style="margin-top:12px;">
            <label style="color:var(--warning);">Motivo de Retención</label>
            <div style="font-family:var(--font-mono); font-weight:700; color:var(--text);">
              ${reg.motivo || '-'}
            </div>
          </div>
          ` : ''}
        </div>
        ` : ''}

        <!-- Marcas de tiempo -->
        <div class="data-grid" style="margin-bottom:16px;">
          <div class="data-item">
            <div class="label">Ingreso</div>
            <div class="value">${this._fmt(reg?.fecha_ingreso)}</div>
          </div>
          <div class="data-item">
            <div class="label">Escaneado por</div>
            <div class="value">${reg?.escaneado_por || '-'}</div>
          </div>
          <div class="data-item">
            <div class="label">Liberación</div>
            <div class="value">${this._fmt(reg?.fecha_liberacion)}</div>
          </div>
          <div class="data-item">
            <div class="label">Liberado por</div>
            <div class="value">${reg?.liberado_por || '-'}</div>
          </div>
          <div class="data-item">
            <div class="label">Finalización</div>
            <div class="value">${this._fmt(reg?.fecha_finalizacion)}</div>
          </div>
          <div class="data-item">
            <div class="label">Motivo retención</div>
            <div class="value">${reg?.motivo || '-'}</div>
          </div>
        </div>

        <!-- Botón principal -->
        <div>
          ${!reg ? `
            <button class="btn btn-success btn-block" id="btn-iniciar" style="padding:14px;font-size:15px;">
              <i class="codicon codicon-play"></i> Iniciar Conteo
            </button>
          ` : isActive ? `
            <button class="btn btn-danger btn-block" id="btn-finalizar" style="padding:14px;font-size:15px;">
              <i class="codicon codicon-debug-stop"></i> Finalizar Proceso
            </button>
          ` : `
            <div class="alert alert-success">
              <i class="codicon codicon-check"></i> Proceso finalizado. Duración: <strong>${this._duracion(reg)}</strong>
            </div>
          `}
        </div>

        <div id="timer-feedback" style="margin-top:12px;"></div>
      </div>
    `;

    // Reanudar cronómetro si hay proceso activo
    if (isActive && reg?.fecha_ingreso) {
      this.startTime = new Date(reg.fecha_ingreso).getTime();
      this.startStopwatch();
    }

    this._bindEvents();
  }

  _bindEvents() {
    const feedback = () => document.getElementById("timer-feedback");
    const setFeedback = (html) => { const f = feedback(); if (f) f.innerHTML = html; };

    // Iniciar
    const btnIniciar = document.getElementById("btn-iniciar");
    if (btnIniciar) {
      btnIniciar.onclick = async () => {
        btnIniciar.disabled = true;
        btnIniciar.innerHTML = `<i class="codicon codicon-loading codicon-modifier-spin"></i> Registrando...`;
        try {
          const usuario = this.getCurrentUser();
          const { registro, yaExistia } = await this.iniciarTiempoUseCase.execute({
            masterItem:   this.currentMaster,
            escaneadoPor: usuario?.displayName || "Operario"
          });
          this.activeRegistro = registro;
          this.startTime = new Date(registro.fecha_ingreso).getTime();
          this.render();
          if (yaExistia) setFeedback(`<div class="alert alert-warning"><i class="codicon codicon-info"></i> Ya existía un proceso activo para este ID Master. Reanudando.</div>`);
          if (this.onRecordUpdated) this.onRecordUpdated();
        } catch (err) {
          setFeedback(`<div class="alert alert-danger"><i class="codicon codicon-error"></i> ${err.message}</div>`);
          btnIniciar.disabled = false;
          btnIniciar.innerHTML = `<i class="codicon codicon-play"></i> Iniciar Conteo`;
        }
      };
    }

    // Finalizar
    const btnFinalizar = document.getElementById("btn-finalizar");
    if (btnFinalizar) {
      btnFinalizar.onclick = async () => {
        btnFinalizar.disabled = true;
        btnFinalizar.innerHTML = `<i class="codicon codicon-loading codicon-modifier-spin"></i> Finalizando...`;
        try {
          // Finalizar el tiempo
          const registro = await this.finalizarTiempoUseCase.execute({
            id_master: this.currentMaster.id_master
          });
          
          this.stopStopwatch();
          this.activeRegistro = registro;
          
          // Mostrar modal de retención
          this._showRetainModalOnFinish();
          
        } catch (err) {
          setFeedback(`<div class="alert alert-danger"><i class="codicon codicon-error"></i> ${err.message}</div>`);
          btnFinalizar.disabled = false;
          btnFinalizar.innerHTML = `<i class="codicon codicon-debug-stop"></i> Finalizar Proceso`;
        }
      };
    }

    // Botón liberar del panel
    const btnLiberarPanel = document.getElementById("btn-liberar-panel");
    if (btnLiberarPanel) {
      btnLiberarPanel.onclick = async () => {
        await this._cambiarRetencion(false, null);
        // Cuando se libera, puede desaparecer de la interfaz
        if (!this.activeRegistro?.retenido && this.activeRegistro?.fecha_finalizacion) {
          this.activeRegistro = null;
          this.currentMaster = null;
        }
        this.render();
      };
    }
  }

  async _cambiarRetencion(nuevoEstado, motivo) {
    const feedback = document.getElementById("timer-feedback");
    const setFeedback = (html) => { if (feedback) feedback.innerHTML = html; };
    try {
      const registro = await this.cambiarRetencionUseCase.execute({
        id_master:          this.currentMaster.id_master,
        nuevoEstadoRetenido: nuevoEstado,
        motivo
      });
      this.activeRegistro = registro;
      this.render();
      setFeedback(`
        <div class="alert ${nuevoEstado ? 'alert-warning' : 'alert-success'}">
          ${nuevoEstado 
            ? `<i class="codicon codicon-warning"></i> RETENIDO — Motivo: ${motivo}` 
            : `<i class="codicon codicon-check"></i> LIBERADO por ${registro.liberado_por || 'Operario'}`
          }
        </div>
      `);
      if (this.onRecordUpdated) this.onRecordUpdated();
    } catch (err) {
      setFeedback(`<div class="alert alert-danger"><i class="codicon codicon-error"></i> ${err.message}</div>`);
    }
  }

  _showRetainModalOnFinish() {
    const modalContainer = document.getElementById("modal-container");
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content">
          <div class="card-header">
            <span class="card-title">Finalizar Lote - ¿Quedó Retenido?</span>
            <button class="btn btn-outline btn-sm" id="btn-close-modal">
              <i class="codicon codicon-close"></i>
            </button>
          </div>
          
          <div style="margin-bottom: 16px;">
            <p style="margin-bottom: 12px;">El lote ha sido finalizado. ¿Quedó retenido?</p>
            
            <div style="display: flex; gap: 12px; margin-bottom: 16px;">
              <button class="btn btn-outline" id="btn-no-retenido" style="flex: 1;">
                <i class="codicon codicon-check"></i> No, terminó correctamente
              </button>
              <button class="btn btn-danger" id="btn-si-retenido" style="flex: 1;">
                <i class="codicon codicon-warning"></i> Sí, quedó retenido
              </button>
            </div>

            <div id="motivo-selection" style="display: none;">
              <label for="select-motivo-retencion">Motivo de Retención</label>
              <select id="select-motivo-retencion">
                <option value="">-- Seleccionar Motivo --</option>
                ${MOTIVOS_RETENCION.map(m => `<option value="${m}">${m}</option>`).join('')}
              </select>
            </div>
          </div>

          <div style="display: flex; gap: 8px; justify-content: flex-end;">
            <button class="btn btn-outline" id="btn-cancel-retain">Cancelar</button>
            <button class="btn btn-primary" id="btn-confirm-retain" disabled>
              Confirmar
            </button>
          </div>
        </div>
      </div>
    `;

    // Cerrar modal
    const closeModal = () => modalContainer.innerHTML = '';
    document.getElementById("btn-close-modal").onclick = closeModal;
    document.getElementById("btn-cancel-retain").onclick = closeModal;

    const motivoSelection = document.getElementById("motivo-selection");
    const btnNoRetenido = document.getElementById("btn-no-retenido");
    const btnSiRetenido = document.getElementById("btn-si-retenido");
    const btnConfirm = document.getElementById("btn-confirm-retain");
    const motivoSelect = document.getElementById("select-motivo-retencion");
    
    let isRetained = false;

    // Botón "No quedó retenido"
    btnNoRetenido.onclick = () => {
      isRetained = false;
      motivoSelection.style.display = "none";
      btnConfirm.disabled = false;
      btnConfirm.textContent = "Confirmar (No Retenido)";
    };

    // Botón "Sí quedó retenido"
    btnSiRetenido.onclick = () => {
      isRetained = true;
      motivoSelection.style.display = "block";
      btnConfirm.disabled = true;
      btnConfirm.textContent = "Confirmar (Retenido)";
    };

    // Habilitar botón cuando se selecciona motivo
    motivoSelect.onchange = () => {
      btnConfirm.disabled = !motivoSelect.value;
    };

    // Confirmar
    btnConfirm.onclick = async () => {
      try {
        if (isRetained) {
          const motivo = motivoSelect.value;
          if (!motivo) return;
          
          await this._cambiarRetencion(true, motivo);
          // Si está retenido, NO desaparece de la interfaz
        } else {
          // Si no está retenido, asegurarse de que no esté marcado como retenido
          if (this.activeRegistro?.retenido) {
            await this._cambiarRetencion(false, null);
          }
          // Si no está retenido, desaparece de la interfaz
          this.activeRegistro = null;
          this.currentMaster = null;
        }
        
        closeModal();
        this.render();
        if (this.onRecordUpdated) this.onRecordUpdated();
      } catch (err) {
        alert("Error al procesar retención: " + err.message);
      }
    };
  }

  startStopwatch() {
    this.stopStopwatch();
    this._tick();
    // Actualización cada 40ms para suavidad en milésimas
    this.timerInterval = setInterval(() => this._tick(), 40);
  }

  stopStopwatch() {
    if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
  }

  _tick() {
    const el = document.getElementById("timer-digits");
    if (!el || !this.startTime) return;
    const diffMs = Math.max(0, Date.now() - this.startTime);
    const diffSeconds = diffMs / 1000;
    
    const hours = Math.floor(diffSeconds / 3600);
    const minutes = Math.floor((diffSeconds % 3600) / 60);
    const seconds = Math.floor(diffSeconds % 60);
    const milliseconds = Math.round((diffSeconds % 1) * 1000);
    
    const hoursStr = hours.toString().padStart(2, '0');
    const minutesStr = minutes.toString().padStart(2, '0');
    const secondsStr = seconds.toString().padStart(2, '0');
    const msStr = milliseconds.toString().padStart(3, '0');
    
    el.textContent = `${hoursStr}:${minutesStr}:${secondsStr}.${msStr}`;
  }

  _fmt(iso) {
    if (!iso) return "-";
    const d = new Date(iso);
    return isNaN(d) ? iso : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  _duracion(reg) {
    if (!reg?.fecha_ingreso || !reg?.fecha_finalizacion) return "-";
    const ms = Math.max(0, new Date(reg.fecha_finalizacion).getTime() - new Date(reg.fecha_ingreso).getTime());
    const totalSecs = (ms / 1000).toFixed(3);
    const m = Math.floor(ms / 60000);
    const s = ((ms % 60000) / 1000).toFixed(3);
    const cant = Math.max(1, Number(reg.cantidad) || 1);
    const secPorPrenda = (ms / 1000 / cant).toFixed(3);
    return `${m}m ${s}s (${totalSecs}s) &bull; ${secPorPrenda}s / ${reg.prenda || 'und'}`;
  }
}
