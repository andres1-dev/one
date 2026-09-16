// Composition Root: Arquitectura Hexagonal — 100% JS Puro, sin Node
// Toda operación de datos va por Edge Function (EF). Solo Auth usa el SDK de Supabase.
// Sincronización a Google Sheets 100% en background (async y no bloqueante)
import { SupabaseAuthAdapter } from "../infrastructure/supabase/SupabaseAuthAdapter.js";
import { EFMasterAdapter }     from "../infrastructure/supabase/EFMasterAdapter.js";
import { EFTiemposAdapter }    from "../infrastructure/supabase/EFTiemposAdapter.js";
import { GoogleSheetsAdapter } from "../infrastructure/googlesheets/GoogleSheetsAdapter.js";
import { SyncTiemposAdapter }  from "../infrastructure/sync/SyncTiemposAdapter.js";

import { LoginUseCase }                from "../application/LoginUseCase.js";
import { BuscarMasterUseCase }         from "../application/BuscarMasterUseCase.js";
import { IniciarTiempoUseCase }        from "../application/IniciarTiempoUseCase.js";
import { CambiarRetencionUseCase }     from "../application/CambiarRetencionUseCase.js";
import { FinalizarTiempoUseCase }      from "../application/FinalizarTiempoUseCase.js";
import { ListarUltimosTiemposUseCase } from "../application/ListarUltimosTiemposUseCase.js";
import { ListarHistoricosUseCase }     from "../application/ListarHistoricosUseCase.js";
import { ObtenerKPIsUseCase }          from "../application/ObtenerKPIsUseCase.js";
import { ConsultarActivoUseCase }      from "../application/ConsultarActivoUseCase.js";

import { AuthView }        from "./components/AuthView.js";
import { TiemposListView }  from "./components/TiemposListView.js";
import { KPIsView }         from "./components/KPIsView.js";

import { GoogleSheetsConfig } from "../infrastructure/googlesheets/GoogleSheetsConfig.js";

class Application {
  constructor() {
    this.currentUser = null;
    this._initAdapters();
    this._initUseCases();
    this._initUI();
  }

  _initAdapters() {
    this.authAdapter    = new SupabaseAuthAdapter();
    this.masterAdapter  = new EFMasterAdapter();
    
    // Adaptadores individuales
    const supabaseTiemposAdapter = new EFTiemposAdapter();
    const googleSheetsAdapter = new GoogleSheetsAdapter();
    
    this.supabaseTiemposAdapter = supabaseTiemposAdapter;
    this.googleSheetsAdapter = googleSheetsAdapter;

    // Adaptador de sincronización coordinado (Supabase síncrono + GAS en background)
    this.tiemposAdapter = new SyncTiemposAdapter(supabaseTiemposAdapter, googleSheetsAdapter);
    this.sheetsAdapter = googleSheetsAdapter;
  }

  _initUseCases() {
    this.loginUseCase                = new LoginUseCase(this.authAdapter);
    this.buscarMasterUseCase         = new BuscarMasterUseCase(this.masterAdapter);
    this.iniciarTiempoUseCase        = new IniciarTiempoUseCase(this.tiemposAdapter);
    this.cambiarRetencionUseCase     = new CambiarRetencionUseCase(this.tiemposAdapter);
    this.finalizarTiempoUseCase      = new FinalizarTiempoUseCase(this.tiemposAdapter);
    this.listarUltimosTiemposUseCase = new ListarUltimosTiemposUseCase(this.tiemposAdapter);
    this.listarHistoricosUseCase     = new ListarHistoricosUseCase(this.tiemposAdapter);
    this.obtenerKPIsUseCase          = new ObtenerKPIsUseCase(this.sheetsAdapter);
    this.consultarActivoUseCase      = new ConsultarActivoUseCase(this.tiemposAdapter);
  }

  _initUI() {
    this.authView = new AuthView({
      loginUseCase: this.loginUseCase,
      onLoginSuccess: async (sessionData) => {
        this.currentUser = sessionData;
        await this._cargarConfigSheets();
        this._showApp();
      }
    });

    this.tiemposListView = new TiemposListView({
      listarUltimosTiemposUseCase: this.listarUltimosTiemposUseCase,
      listarHistoricosUseCase:     this.listarHistoricosUseCase,
      cambiarRetencionUseCase:     this.cambiarRetencionUseCase,
      finalizarTiempoUseCase:      this.finalizarTiempoUseCase,
      buscarMasterUseCase:         this.buscarMasterUseCase,
      iniciarTiempoUseCase:        this.iniciarTiempoUseCase,
      consultarActivoUseCase:      this.consultarActivoUseCase,
      getCurrentUser:              () => this.currentUser
    });

    this.kpisView = new KPIsView({
      obtenerKPIsUseCase: this.obtenerKPIsUseCase
    });

    this.views = [this.tiemposListView, this.kpisView];
  }

  async _cargarConfigSheets() {
    try {
      if (this.supabaseTiemposAdapter && typeof this.supabaseTiemposAdapter.obtenerConfigSheets === "function") {
        const config = await this.supabaseTiemposAdapter.obtenerConfigSheets();
        if (config) {
          GoogleSheetsConfig.setConfig(config);
          console.log("✅ Configuración de Google Sheets cargada exitosamente desde EF");
        }
      }
    } catch (err) {
      console.warn("⚠️ No se pudo obtener la configuración de Sheets desde EF:", err.message);
    }
  }

  async start() {
    try {
      const session = await this.loginUseCase.getSession();
      if (session) {
        this.currentUser = session;
        this.authView.renderAuthenticated(session);
        await this._cargarConfigSheets();
        this._showApp();
      } else {
        this.authView.renderLogin();
      }
    } catch {
      this.authView.renderLogin();
    }
  }

  _showApp() {
    document.getElementById("vscode-workspace").style.display = "flex";
    document.body.classList.add("vscode-mode");
    this.tiemposListView.render();
    this.kpisView.render();
    this.tiemposListView.focus();
    this._initVSCodeInteractions();
  }

  destroy() {
    if (this.tiemposListView && this.tiemposListView.destroy) {
      this.tiemposListView.destroy();
    }
  }

  _initVSCodeInteractions() {
    const activityItems = document.querySelectorAll('.activity-item');

    activityItems.forEach(item => {
      item.addEventListener('click', () => {
        activityItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
      });
    });

    const panelTabs = document.querySelectorAll('.panel-tab');
    const statusContent = document.getElementById('panel-status-content');
    const kpisContent = document.getElementById('panel-kpis-content');

    panelTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        panelTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const tabName = tab.dataset.tab;
        if (tabName === 'status') {
          statusContent.style.display = 'block';
          kpisContent.style.display = 'none';
        } else if (tabName === 'kpis') {
          statusContent.style.display = 'none';
          kpisContent.style.display = 'block';
          if (this.kpisView) {
            this.kpisView._loadKPIs();
          }
        }
      });
    });

    const panelClose = document.querySelector('.panel-action-btn');
    const bottomPanel = document.getElementById('bottom-panel');
    const panelExpandBtn = document.getElementById('panel-expand-btn');
    
    if (panelClose && bottomPanel) {
      panelClose.addEventListener('click', () => {
        bottomPanel.classList.toggle('collapsed');
        const icon = panelClose.querySelector('.codicon');
        if (icon) {
          if (bottomPanel.classList.contains('collapsed')) {
            icon.className = 'codicon codicon-chevron-up';
            panelClose.title = 'Expandir panel';
            panelExpandBtn.classList.add('visible');
          } else {
            icon.className = 'codicon codicon-close';
            panelClose.title = 'Cerrar panel';
            panelExpandBtn.classList.remove('visible');
          }
        }
      });
    }
    
    if (panelExpandBtn && bottomPanel) {
      panelExpandBtn.addEventListener('click', () => {
        bottomPanel.classList.remove('collapsed');
        panelExpandBtn.classList.remove('visible');
        
        const panelClose = document.querySelector('.panel-action-btn');
        if (panelClose) {
          const icon = panelClose.querySelector('.codicon');
          if (icon) {
            icon.className = 'codicon codicon-close';
            panelClose.title = 'Cerrar panel';
          }
        }
      });
    }
  }
}

document.addEventListener("DOMContentLoaded", () => new Application().start());
