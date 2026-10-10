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
    particles
  });

  appController.init();
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
