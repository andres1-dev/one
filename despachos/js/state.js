/**
 * Centralized Application State
 */
import { CONFIG } from './config.js';

export const state = {
    activeTab: 'kpis',
    records: [],
    filteredRecords: [],
    despachosRecords: [],
    filteredDespachosRecords: [],
    
    // Paginación FILTER
    currentPage: 1,
    pageSize: 10,
    sortColumn: 'fechaCorte',
    sortAsc: false,
    filterIntegracion: '',
    filterCuento: '',
    filterTejido: '',
    filterGenero: '',
    filterClase: '',
    searchQuery: '',

    // Paginación DESPACHOS (Default = 'pendiente')
    currentDespPage: 1,
    pageSizeDespachos: 30,
    sortDespColumn: 'fecha',
    sortDespAsc: false,
    filterDespachoEstado: 'pendiente',
    filterDespachoTaller: '',
    searchDespachosQuery: '',

    // Item actual en modal de confirmación
    pendingDispatchItem: null,

    // GAS Web App URL
    gasWebAppUrl: localStorage.getItem('gas_webapp_url') || CONFIG.DEFAULT_GAS_URL,

    // Modal State
    modalData: [],
    filteredModalData: [],
    modalType: 'inventory',
    modalTitleText: '',
    modalCategoryText: '',
    modalSearchQuery: '',
    isLoading: false
};
