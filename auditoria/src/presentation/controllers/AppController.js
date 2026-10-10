/**
 * Controlador Primario: AppController
 * Orquesta la interacción del usuario, casos de uso, estado del store y renderizado de componentes.
 */
import { FilterService } from "../../domain/services/FilterService.js";

export class AppController {
  constructor({
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
  }) {
    this.store = store;
    this.loginUseCase = loginUseCase;
    this.logoutUseCase = logoutUseCase;
    this.checkSessionUseCase = checkSessionUseCase;
    this.queryOperationsUseCase = queryOperationsUseCase;
    this.exportCsvUseCase = exportCsvUseCase;

    this.notification = notification;
    this.kpiView = kpiView;
    this.filterPanel = filterPanel;
    this.tableView = tableView;
    this.scopeView = scopeView;
    this.decompositionTree = decompositionTree ?? null;
    this.particles = particles;

    this.elements = {
      loginPageWrapper: document.getElementById("loginPageWrapper"),
      appContainer: document.getElementById("appContainer"),
      loginForm: document.getElementById("loginForm"),
      emailInput: document.getElementById("email"),
      passwordInput: document.getElementById("password"),
      loginButton: document.getElementById("loginButton"),
      queryForm: document.getElementById("queryForm"),
      recordIdInput: document.getElementById("recordId"),
      searchButton: document.getElementById("searchButton"),
      userInfo: document.getElementById("userInfo"),
      headerLogoutBtn: document.getElementById("headerLogoutBtn")
    };
  }

  init() {
    this.scopeView.render();
    this.bindEvents();

    // Suscripción al store para renderizar cambios
    this.store.subscribe(state => this.onStateChange(state));

    // Suscripción al estado de sesión de Auth
    this.checkSessionUseCase.subscribe((event, session) => {
      this.handleSessionChange(session);
    });

    // Verificación inicial de sesión
    this.checkSessionUseCase.execute()
      .then(session => this.handleSessionChange(session))
      .catch(err => {
        console.error("Error al verificar sesión inicial:", err);
      });
  }

  bindEvents() {
    if (this.elements.loginForm) {
      this.elements.loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        await this.handleLogin();
      });
    }

    if (this.elements.queryForm) {
      this.elements.queryForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        await this.handleQuery();
      });
    }

    if (this.elements.headerLogoutBtn) {
      this.elements.headerLogoutBtn.addEventListener("click", async () => {
        await this.handleLogout();
      });
    }
  }

  handleSessionChange(session) {
    const isAuth = Boolean(session);
    this.store.setState({ session });

    if (this.elements.loginPageWrapper) {
      this.elements.loginPageWrapper.hidden = isAuth;
    }
    if (this.elements.appContainer) {
      this.elements.appContainer.hidden = !isAuth;
    }

    if (this.particles) {
      if (isAuth) {
        this.particles.stop();
      } else {
        this.particles.start();
      }
    }

    if (this.elements.userInfo) {
      const email = session?.user?.email || "Usuario";
      this.elements.userInfo.title = isAuth ? email : "";
      this.elements.userInfo.innerHTML = isAuth
        ? `<i class="fa-solid fa-user"></i> <span class="user-email-text">${email}</span>`
        : "";
    }
  }

  async handleLogin() {
    this.notification.clear();
    const email = this.elements.emailInput?.value || "";
    const password = this.elements.passwordInput?.value || "";

    if (this.elements.loginButton) {
      this.elements.loginButton.disabled = true;
      this.elements.loginButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Validando credenciales...';
    }

    try {
      const session = await this.loginUseCase.execute(email, password);
      this.handleSessionChange(session);
      if (this.elements.passwordInput) this.elements.passwordInput.value = "";
      this.notification.show("Acceso concedido.", "success");
    } catch (err) {
      this.notification.show(`Credenciales incorrectas: ${err.message || err}`, "error");
    } finally {
      if (this.elements.loginButton) {
        this.elements.loginButton.disabled = false;
        this.elements.loginButton.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Iniciar sesión';
      }
    }
  }

  async handleLogout() {
    try {
      await this.logoutUseCase.execute();
      this.store.reset();
      this.handleSessionChange(null);
      this.filterPanel.reset();
      this.kpiView.render([], null);
      this.tableView.setEmptyMessage("Inicia sesión para consultar.");
      this.tableView.setCsvEnabled(false);
      this.notification.show("Sesión finalizada.", "info");
    } catch (err) {
      this.notification.show(`Error al cerrar sesión: ${err.message || err}`, "error");
    }
  }

  async handleQuery() {
    this.notification.clear();
    const session = this.store.getState().session;
    if (!session) {
      this.handleSessionChange(null);
      this.notification.show("Sesión expirada. Inicia sesión nuevamente.", "error");
      return;
    }

    const id = this.elements.recordIdInput?.value || "";
    this.setBusy(true);

    try {
      // Ejecutar consulta principal (retorna registros y la ventana real usada por la RPC)
      const { rows, range } = await this.queryOperationsUseCase.execute(id);

      this.store.setState({
        allRows: rows,
        filteredRows: rows,
        activeKpi: null,
        searchQuery: "",
        currentPage: 1,
        columnFilters: {
          cliente: "",
          productora: "",
          genero: "",
          prenda: "",
          clase: ""
        }
      });

      this.filterPanel.populateOptions(rows);
      this.filterPanel.updateState(this.store.getState().columnFilters);

      // Actualizar ScopeView con la ventana operativa real usada por la RPC
      if (!id) {
        if (range && range.fecha_desde) {
          this.scopeView.render({
            fecha_desde: range.fecha_desde,
            fecha_hasta: range.fecha_hasta || new Date().toISOString().slice(0, 10)
          });
        } else {
          this.scopeView.render();
        }
      }

      // Renderizar árbol de descomposición si existe
      if (this.decompositionTree) {
        this.decompositionTree.render(rows);
      }

      this.notification.show(
        rows.length
          ? "Consulta completada con éxito. Puedes filtrar haciendo clic en los indicadores."
          : "No se encontraron registros pendientes dentro del rango operativo.",
        "success"
      );
    } catch (err) {
      this.tableView.setEmptyMessage("No se pudieron cargar los datos.");
      this.notification.show(String(err?.message || err), "error");
    } finally {
      this.setBusy(false);
    }
  }

  setBusy(busy) {
    this.store.setState({ isBusy: busy });
    if (this.elements.searchButton) {
      this.elements.searchButton.disabled = busy;
      this.elements.searchButton.innerHTML = busy
        ? '<i class="fa-solid fa-spinner fa-spin"></i> Consultando...'
        : '<i class="fa-solid fa-magnifying-glass"></i> Consultar';
    }
  }

  handleKpiSelect(key) {
    const { activeKpi, allRows } = this.store.getState();
    const newKpi = activeKpi === key ? null : key;
    const filteredRows = newKpi ? FilterService.applyKpiFilter(allRows, newKpi) : allRows;

    this.store.setState({
      activeKpi: newKpi,
      filteredRows,
      currentPage: 1
    });
  }

  handleKpiClear() {
    const { allRows } = this.store.getState();
    this.store.setState({
      activeKpi: null,
      filteredRows: allRows,
      currentPage: 1
    });
  }

  handleColumnFilterChange(column, value) {
    const columnFilters = {
      ...this.store.getState().columnFilters,
      [column]: value
    };

    this.store.setState({
      columnFilters,
      currentPage: 1
    });
    this.filterPanel.updateState(columnFilters);
  }

  handleColumnFilterClear() {
    const cleared = { cliente: "", productora: "", genero: "", prenda: "", clase: "" };
    this.store.setState({
      columnFilters: cleared,
      currentPage: 1
    });
    this.filterPanel.updateState(cleared);
  }

  handleSearchChange(query) {
    this.store.setState({
      searchQuery: query,
      currentPage: 1
    });
  }

  handlePageChange(delta) {
    const { currentPage } = this.store.getState();
    this.store.setState({
      currentPage: Math.max(1, currentPage + delta)
    });
  }

  async handleExportCsv() {
    const { allRows, activeKpi, columnFilters, searchQuery } = this.store.getState();
    // Obtener los datos con filtros aplicados
    let rows = activeKpi ? FilterService.applyKpiFilter(allRows, activeKpi) : allRows;
    rows = FilterService.applyColumnFilters(rows, columnFilters);
    rows = FilterService.applySearch(rows, searchQuery);

    try {
      await this.exportCsvUseCase.execute(rows);
      this.notification.show("Reporte CSV exportado exitosamente.", "success");
    } catch (err) {
      this.notification.show(err.message || "Error al exportar CSV.", "error");
    }
  }

  onStateChange(state) {
    const { allRows, filteredRows, columnFilters, searchQuery, currentPage, pageSize, activeKpi } = state;

    // Base para KPIs: columnas filtradas sobre allRows
    const colBase = FilterService.applyColumnFilters(allRows, columnFilters);

    // Datos para la tabla: KPI aplicado + Columnas filtradas + Búsqueda
    const colFiltered = FilterService.applyColumnFilters(filteredRows, columnFilters);
    const searched = FilterService.applySearch(colFiltered, searchQuery);

    // Paginación
    const pagination = FilterService.paginate(searched, currentPage, pageSize);

    // Renderizar componentes
    this.kpiView.render(colBase, activeKpi);
    this.tableView.renderRows(pagination.items);
    this.tableView.renderPagination(pagination);

    const hasColFilters = Object.values(columnFilters).some(v => v !== "");
    this.tableView.renderSummary({
      total: searched.length,
      baseTotal: colBase.length,
      activeKpi,
      hasColumnFilters: hasColFilters
    });

    this.tableView.setCsvEnabled(searched.length > 0);
  }
}
