/**
 * Capa de Presentación: Store
 * Manejador reactivo de estado para la aplicación frontend.
 */
export class Store {
  constructor() {
    this.state = {
      session: null,
      allRows: [],
      filteredRows: [],
      activeKpi: null,
      columnFilters: {
        cliente: "",
        productora: "",
        genero: "",
        prenda: "",
        clase: ""
      },
      searchQuery: "",
      currentPage: 1,
      pageSize: 10,
      isBusy: false
    };

    this.listeners = new Set();
  }

  getState() {
    return this.state;
  }

  setState(partialState) {
    this.state = { ...this.state, ...partialState };
    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  reset() {
    this.setState({
      allRows: [],
      filteredRows: [],
      activeKpi: null,
      columnFilters: {
        cliente: "",
        productora: "",
        genero: "",
        prenda: "",
        clase: ""
      },
      searchQuery: "",
      currentPage: 1,
      isBusy: false
    });
  }
}
