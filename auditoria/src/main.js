/**
 * Punto de Entrada Principal (Main Bootstrap)
 * Inyección de dependencias y composición de la Arquitectura Hexagonal.
 */

// 1. Infraestructura
import { getSupabaseClient } from "./infrastructure/config/supabase.js";
import { SupabaseAuthAdapter } from "./infrastructure/adapters/SupabaseAuthAdapter.js";
import { SupabaseOperationsAdapter } from "./infrastructure/adapters/SupabaseOperationsAdapter.js";
import { BrowserCsvExporterAdapter } from "./infrastructure/adapters/BrowserCsvExporterAdapter.js";

// 2. Aplicación (Casos de Uso)
import { LoginUseCase } from "./application/use-cases/LoginUseCase.js";
import { LogoutUseCase } from "./application/use-cases/LogoutUseCase.js";
import { CheckSessionUseCase } from "./application/use-cases/CheckSessionUseCase.js";
import { QueryOperationsUseCase } from "./application/use-cases/QueryOperationsUseCase.js";
import { ExportCsvUseCase } from "./application/use-cases/ExportCsvUseCase.js";

// 3. Presentación (Estado y Componentes)
import { Store } from "./presentation/state/Store.js";
import { Notification } from "./presentation/components/Notification.js";
import { KpiView } from "./presentation/components/KpiView.js";
import { FilterPanel } from "./presentation/components/FilterPanel.js";
import { TableView } from "./presentation/components/TableView.js";
import { ScopeView } from "./presentation/components/ScopeView.js";
import { GeometricParticles } from "./presentation/components/GeometricParticles.js";
import { DecompositionTreeView } from "./presentation/components/DecompositionTreeView.js";
import { AppController } from "./presentation/controllers/AppController.js";

function bootstrap() {
  // Inicialización de Adaptadores de Infraestructura (Driven Adapters)
  const supabaseClient = getSupabaseClient();
  const authAdapter = new SupabaseAuthAdapter(supabaseClient);
  const operationsAdapter = new SupabaseOperationsAdapter(supabaseClient);
  const exporterAdapter = new BrowserCsvExporterAdapter();

  // Inicialización de Casos de Uso (Application Layer)
  const loginUseCase = new LoginUseCase(authAdapter);
  const logoutUseCase = new LogoutUseCase(authAdapter);
  const checkSessionUseCase = new CheckSessionUseCase(authAdapter);
  const queryOperationsUseCase = new QueryOperationsUseCase(operationsAdapter);
  const exportCsvUseCase = new ExportCsvUseCase(exporterAdapter);

  // Inicialización de Estado y Componentes de Presentación
  const store = new Store();
  const notification = new Notification("message");
  const scopeView = new ScopeView();

  // Motor de partículas geométricas responsivo para login
  const particles = new GeometricParticles("loginParticlesCanvas", "loginPageWrapper");
  particles.init();

  let appController;

  const kpiView = new KpiView({
    containerId: "kpiSection",
    badgeId: "kpiFilterBadge",
    onKpiSelect: (key) => appController.handleKpiSelect(key),
    onKpiClear: () => appController.handleKpiClear()
  });

  const filterPanel = new FilterPanel({
    panelId: "filterPanel",
    toggleBtnId: "filterToggleBtn",
    clearBtnId: "clearFiltersBtn",
    onFilterChange: (col, val) => appController.handleColumnFilterChange(col, val),
    onFilterClear: () => appController.handleColumnFilterClear()
  });

  const tableView = new TableView({
    tbodyId: "results",
    summaryId: "summary",
    pageInfoId: "pageInfo",
    prevBtnId: "pagePrev",
    nextBtnId: "pageNext",
    searchInputId: "tableSearch",
    csvBtnId: "csvButton",
    onPageChange: (delta) => appController.handlePageChange(delta),
    onSearchChange: (q) => appController.handleSearchChange(q),
    onExportCsv: () => appController.handleExportCsv()
  });

  // Árbol de descomposición estilo PowerBI
  const decompositionTree = new DecompositionTreeView({
    containerId: "decompTree",
    sectionId: "decompSection"
  });

  // Inicialización del Controlador Primario (Driving Adapter)
  appController = new AppController({
    store,
    loginUseCase,
    logoutUseCase,
    checkSessionUseCase,
    queryOperationsUseCase,
    exportCsvUseCase,
    notification,
    kpiView,
    filterPanel,
    tableView,
    scopeView,
    decompositionTree,
    particles
  });

  appController.init();

  // ── Toggle vista tabla / árbol ────────────────────────────────────────
  const viewToggleGroup = document.getElementById("viewToggleGroup");
  const viewTableBtn = document.getElementById("viewTableBtn");
  const viewTreeBtn  = document.getElementById("viewTreeBtn");

  const tableSection = document.querySelector(".table-container");
  const paginationBar = document.querySelector(".pagination-bar");
  const tableControls = document.querySelector(".table-controls");
  const filterPanel2  = document.getElementById("filterPanel");
  const decompSection = document.getElementById("decompSection");

  const resultsPanelTitle = document.getElementById("resultsPanelTitle");

  function setView(view) {
    const showTable = view === "table";
    if (tableSection)   tableSection.style.display  = showTable ? "" : "none";
    if (paginationBar)  paginationBar.style.display  = showTable ? "" : "none";
    if (tableControls)  tableControls.style.display  = showTable ? "" : "none";
    if (filterPanel2)   filterPanel2.style.display   = showTable ? "" : "none";
    // decompSection: oculto cuando mostramos tabla, visible cuando mostramos árbol
    if (decompSection)  decompSection.hidden         = showTable;
    if (viewTableBtn) viewTableBtn.classList.toggle("active", showTable);
    if (viewTreeBtn)  viewTreeBtn.classList.toggle("active", !showTable);

    if (resultsPanelTitle) {
      resultsPanelTitle.innerHTML = showTable
        ? '<i class="fa-solid fa-table-list"></i> Registros Obtenidos'
        : '<i class="fa-solid fa-sitemap"></i> Árbol de Descomposición';
    }

    if (showTable && decompositionTree) {
      decompositionTree.exitFullscreen();
    }

    if (!showTable && decompositionTree) {
      requestAnimationFrame(() => {
        decompositionTree.onResize();
      });
    }
  }

  if (viewTableBtn) {
    viewTableBtn.addEventListener("click", () => setView("table"));
  }
  if (viewTreeBtn) {
    viewTreeBtn.addEventListener("click", () => setView("tree"));
  }

  // Mostrar el toggle cuando haya datos
  store.subscribe(state => {
    if (viewToggleGroup && state.allRows && state.allRows.length > 0) {
      viewToggleGroup.style.display = "flex";
    }
  });
}

// Inicializar al cargar el DOM
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}

// Registro de Service Worker para PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        console.log('[PWA] Service Worker registrado:', reg.scope);
      })
      .catch(err => {
        console.warn('[PWA] No se pudo registrar el Service Worker:', err);
      });
  });
}
