/**
 * DOM Element References
 */

export const DOM = {
    // Navigation
    navTabs: document.querySelectorAll('.nav-tab'),
    viewTable: document.getElementById('viewTable'),
    viewDespachos: document.getElementById('viewDespachos'),
    viewKPIs: document.getElementById('viewKPIs'),
    
    // Status & Actions
    loadingContainer: document.getElementById('loadingContainer'),
    errorContainer: document.getElementById('errorContainer'),
    errorMessage: document.getElementById('errorMessage'),
    statusDot: document.getElementById('statusDot'),
    btnRefresh: document.getElementById('btnRefresh'),
    btnRetry: document.getElementById('btnRetry'),
    statTotalRows: document.getElementById('statTotalRows'),
    statTotalCort: document.getElementById('statTotalCort'),
    statTotalBodega: document.getElementById('statTotalBodega'),

    // Vista FILTER
    tableBody: document.getElementById('tableBody'),
    tableWrapper: document.getElementById('tableWrapper'),
    noResultsContainer: document.getElementById('noResultsContainer'),
    searchInput: document.getElementById('searchInput'),
    filterIntegracion: document.getElementById('filterIntegracion'),
    filterCuento: document.getElementById('filterCuento'),
    filterTejido: document.getElementById('filterTejido'),
    filterGenero: document.getElementById('filterGenero'),
    filterClase: document.getElementById('filterClase'),
    pageSize: document.getElementById('pageSize'),
    btnExportCSV: document.getElementById('btnExportCSV'),
    showingStart: document.getElementById('showingStart'),
    showingEnd: document.getElementById('showingEnd'),
    totalFiltered: document.getElementById('totalFiltered'),
    btnPrevPage: document.getElementById('btnPrevPage'),
    btnNextPage: document.getElementById('btnNextPage'),
    pageNumbersContainer: document.getElementById('pageNumbersContainer'),
    tableHeaders: document.querySelectorAll('#dataTable thead th.sortable'),

    // Vista DESPACHOS
    tableDespachosBody: document.getElementById('tableDespachosBody'),
    tableDespachosWrapper: document.getElementById('tableDespachosWrapper'),
    noResultsDespachosContainer: document.getElementById('noResultsDespachosContainer'),
    noResultsDespachosText: document.getElementById('noResultsDespachosText'),
    searchDespachosInput: document.getElementById('searchDespachosInput'),
    filterDespachoTaller: document.getElementById('filterDespachoTaller'),
    pageSizeDespachos: document.getElementById('pageSizeDespachos'),
    btnExportDespachosCSV: document.getElementById('btnExportDespachosCSV'),
    showingDespStart: document.getElementById('showingDespStart'),
    showingDespEnd: document.getElementById('showingDespEnd'),
    totalDespFiltered: document.getElementById('totalDespFiltered'),
    btnPrevDespPage: document.getElementById('btnPrevDespPage'),
    btnNextDespPage: document.getElementById('btnNextDespPage'),
    pageNumbersDespContainer: document.getElementById('pageNumbersDespContainer'),
    tableDespachosHeaders: document.querySelectorAll('#dataDespachosTable thead th.sortable'),
    
    // Segmented Buttons
    btnSegPendientes: document.getElementById('btnSegPendientes'),
    btnSegDespachados: document.getElementById('btnSegDespachados'),
    btnSegTodos: document.getElementById('btnSegTodos'),
    badgeCountPendientes: document.getElementById('badgeCountPendientes'),

    // Modal de Confirmación de Despacho
    confirmDispatchModal: document.getElementById('confirmDispatchModal'),
    btnCloseDispatchModal: document.getElementById('btnCloseDispatchModal'),
    btnCancelDispatchModal: document.getElementById('btnCancelDispatchModal'),
    btnSubmitDispatchModal: document.getElementById('btnSubmitDispatchModal'),
    modalDispOp: document.getElementById('modalDispOp'),
    modalDispRef: document.getElementById('modalDispRef'),
    modalDispCantidad: document.getElementById('modalDispCantidad'),
    modalDispTaller: document.getElementById('modalDispTaller'),
    inputDispatchDate: document.getElementById('inputDispatchDate'),
    inputDispatchObs: document.getElementById('inputDispatchObs'),
    btnChipHoy: document.getElementById('btnChipHoy'),
    btnChipAyer: document.getElementById('btnChipAyer'),

    // Vista KPIs
    kpiTotalInventario: document.getElementById('kpiTotalInventario'),
    kpiMediaPonderada: document.getElementById('kpiMediaPonderada'),
    kpiPendienteDespacho: document.getElementById('kpiPendienteDespacho'),
    kpiLotesPendientes: document.getElementById('kpiLotesPendientes'),
    kpiMediaMensual: document.getElementById('kpiMediaMensual'),
    kpiMediaSemanal: document.getElementById('kpiMediaSemanal'),
    kpiMediaDiaria: document.getElementById('kpiMediaDiaria'),
    tblClase: document.querySelector('#tblClase tbody'),
    tblTejido: document.querySelector('#tblTejido tbody'),
    tblGenero: document.querySelector('#tblGenero tbody'),
    tblCuento: document.querySelector('#tblCuento tbody'),
    tblAntiguedad: document.querySelector('#tblAntiguedad tbody'),
    tblCriticos: document.querySelector('#tblCriticos tbody'),
    badgeTotalCriticos: document.getElementById('badgeTotalCriticos'),
    tblMensual: document.querySelector('#tblMensual tbody'),
    tblSemanal: document.querySelector('#tblSemanal tbody'),
    tblDiario: document.querySelector('#tblDiario tbody'),
    badgeDiarioPendiente: document.getElementById('badgeDiarioPendiente'),

    // Modal Drilldown
    drilldownModal: document.getElementById('drilldownModal'),
    modalTitle: document.getElementById('modalTitle'),
    modalSubtitle: document.getElementById('modalSubtitle'),
    modalCategoryTag: document.getElementById('modalCategoryTag'),
    modalTotalUnits: document.getElementById('modalTotalUnits'),
    modalTotalLotes: document.getElementById('modalTotalLotes'),
    modalSearchInput: document.getElementById('modalSearchInput'),
    tblModalHead: document.getElementById('tblModalHead'),
    tblModalBody: document.getElementById('tblModalBody'),
    modalFooterInfo: document.getElementById('modalFooterInfo'),
    btnModalClose: document.getElementById('btnModalClose'),
    btnModalCloseFooter: document.getElementById('btnModalCloseFooter'),
    btnExportModalCSV: document.getElementById('btnExportModalCSV'),

    // Modal Carga Masiva CSV a hoja DATA
    btnOpenUploadCsv: document.getElementById('btnOpenUploadCsv'),
    uploadCsvModal: document.getElementById('uploadCsvModal'),
    btnCloseUploadModal: document.getElementById('btnCloseUploadModal'),
    btnCancelUploadModal: document.getElementById('btnCancelUploadModal'),
    btnConfirmUploadCsv: document.getElementById('btnConfirmUploadCsv'),
    csvFileInput: document.getElementById('csvFileInput'),
    csvDropzone: document.getElementById('csvDropzone'),
    csvPreviewContainer: document.getElementById('csvPreviewContainer'),
    csvFileName: document.getElementById('csvFileName'),
    csvRowCount: document.getElementById('csvRowCount'),
    csvColCount: document.getElementById('csvColCount'),
    csvValidationBadge: document.getElementById('csvValidationBadge'),
    csvPreviewTableHead: document.getElementById('csvPreviewTableHead'),
    csvPreviewTableBody: document.getElementById('csvPreviewTableBody'),
    btnChangeCsvFile: document.getElementById('btnChangeCsvFile'),

    // Toast Container
    toastContainer: document.getElementById('toastContainer')
};
