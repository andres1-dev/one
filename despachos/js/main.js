/**
 * Despachos 2.0 - Main Application Orchestrator & Event Router
 */
import { state } from './state.js';
import { DOM } from './dom.js';
import { fetchAllData } from './api.js';
import { applyFilters, exportToCSV } from './views/registrosView.js';
import { applyDespachosFilters, exportDespachosToCSV } from './views/despachosView.js';
import { computeAndRenderKPIs } from './views/kpisView.js';
import {
    closeDispatchConfirmationModal,
    submitDispatchModal,
    setChipActive
} from './modals/dispatchModal.js';
import {
    closeDrilldownModal,
    filterModalData,
    exportModalToCSV
} from './modals/drilldownModal.js';
import {
    openUploadModal,
    closeUploadModal,
    handleFileSelect,
    submitCsvUpload
} from './modals/uploadModal.js';
import { initProgramacionView, closeAsentarModal } from './views/programacionView.js';

export function switchTab(tabName) {
    state.activeTab = tabName;
    DOM.navTabs.forEach(tab => {
        // El tab de programación nunca se marca ni se muestra en la barra de navegación
        if (tab.id === 'tabProgramacion') return;
        tab.classList.toggle('active', tab.dataset.view === tabName);
    });

    if (DOM.viewTable)        DOM.viewTable.classList.toggle('hidden', tabName !== 'table');
    if (DOM.viewDespachos)    DOM.viewDespachos.classList.toggle('hidden', tabName !== 'despachos');
    if (DOM.viewKPIs)         DOM.viewKPIs.classList.toggle('hidden', tabName !== 'kpis');
    if (DOM.viewProgramacion) DOM.viewProgramacion.classList.toggle('hidden', tabName !== 'programacion');

    if (tabName === 'kpis') {
        computeAndRenderKPIs();
    } else if (tabName === 'despachos') {
        applyDespachosFilters();
    } else if (tabName === 'table') {
        applyFilters();
    }
}

function setupEventListeners() {
    // 1. Navegación por pestañas
    DOM.navTabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.view));
    });

    // 2. Acciones Globales
    if (DOM.btnOpenProgramar) {
        DOM.btnOpenProgramar.addEventListener('click', () => {
            // Guarda la vista actual antes de ir a programación
            state.previousTab = state.activeTab !== 'programacion' ? state.activeTab : (state.previousTab || 'kpis');
            // Abre la vista directamente sin mostrar la pestaña en el nav
            switchTab('programacion');
        });
    }

    if (DOM.btnProgBack) {
        DOM.btnProgBack.addEventListener('click', () => {
            switchTab(state.previousTab || 'kpis');
        });
    }

    if (DOM.btnRefresh) DOM.btnRefresh.addEventListener('click', fetchAllData);
    if (DOM.btnRetry) DOM.btnRetry.addEventListener('click', fetchAllData);

    // 3. Vista REGISTROS (FILTER)
    if (DOM.searchInput) {
        DOM.searchInput.addEventListener('input', (e) => {
            state.searchQuery = e.target.value;
            applyFilters();
        });
    }

    if (DOM.filterIntegracion) {
        DOM.filterIntegracion.addEventListener('change', (e) => {
            state.filterIntegracion = e.target.value;
            applyFilters();
        });
    }

    if (DOM.filterCuento) {
        DOM.filterCuento.addEventListener('change', (e) => {
            state.filterCuento = e.target.value;
            applyFilters();
        });
    }

    if (DOM.filterTejido) {
        DOM.filterTejido.addEventListener('change', (e) => {
            state.filterTejido = e.target.value;
            applyFilters();
        });
    }

    if (DOM.filterGenero) {
        DOM.filterGenero.addEventListener('change', (e) => {
            state.filterGenero = e.target.value;
            applyFilters();
        });
    }

    if (DOM.filterClase) {
        DOM.filterClase.addEventListener('change', (e) => {
            state.filterClase = e.target.value;
            applyFilters();
        });
    }

    if (DOM.pageSize) {
        DOM.pageSize.addEventListener('change', (e) => {
            state.pageSize = e.target.value;
            state.currentPage = 1;
            applyFilters();
        });
    }

    if (DOM.btnPrevPage) {
        DOM.btnPrevPage.addEventListener('click', () => {
            if (state.currentPage > 1) {
                state.currentPage--;
                applyFilters();
            }
        });
    }

    if (DOM.btnNextPage) {
        DOM.btnNextPage.addEventListener('click', () => {
            state.currentPage++;
            applyFilters();
        });
    }

    if (DOM.btnExportCSV) DOM.btnExportCSV.addEventListener('click', exportToCSV);

    // Ordenamiento en tabla FILTER
    DOM.tableHeaders.forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.col;
            if (state.sortColumn === col) {
                state.sortAsc = !state.sortAsc;
            } else {
                state.sortColumn = col;
                state.sortAsc = true;
            }
            applyFilters();
        });
    });

    // 4. Vista DESPACHOS
    if (DOM.searchDespachosInput) {
        DOM.searchDespachosInput.addEventListener('input', (e) => {
            state.searchDespachosQuery = e.target.value;
            applyDespachosFilters();
        });
    }

    if (DOM.filterDespachoTaller) {
        DOM.filterDespachoTaller.addEventListener('change', (e) => {
            state.filterDespachoTaller = e.target.value;
            applyDespachosFilters();
        });
    }

    if (DOM.pageSizeDespachos) {
        DOM.pageSizeDespachos.addEventListener('change', (e) => {
            state.pageSizeDespachos = e.target.value;
            state.currentDespPage = 1;
            applyDespachosFilters();
        });
    }

    if (DOM.btnPrevDespPage) {
        DOM.btnPrevDespPage.addEventListener('click', () => {
            if (state.currentDespPage > 1) {
                state.currentDespPage--;
                applyDespachosFilters();
            }
        });
    }

    if (DOM.btnNextDespPage) {
        DOM.btnNextDespPage.addEventListener('click', () => {
            state.currentDespPage++;
            applyDespachosFilters();
        });
    }

    // Segmented Buttons (Pendientes / Despachados / Todos)
    const segButtons = [DOM.btnSegPendientes, DOM.btnSegDespachados, DOM.btnSegTodos];
    segButtons.forEach(btn => {
        if (btn) {
            btn.addEventListener('click', () => {
                segButtons.forEach(b => b && b.classList.remove('active'));
                btn.classList.add('active');
                state.filterDespachoEstado = btn.dataset.filter;
                applyDespachosFilters();
            });
        }
    });

    // Ordenamiento en tabla DESPACHOS
    DOM.tableDespachosHeaders.forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.dcol;
            if (!col) return;
            if (state.sortDespColumn === col) {
                state.sortDespAsc = !state.sortDespAsc;
            } else {
                state.sortDespColumn = col;
                state.sortDespAsc = true;
            }
            applyDespachosFilters();
        });
    });

    // 5. Modal Confirmación de Despacho
    if (DOM.btnCloseDispatchModal) DOM.btnCloseDispatchModal.addEventListener('click', closeDispatchConfirmationModal);
    if (DOM.btnCancelDispatchModal) DOM.btnCancelDispatchModal.addEventListener('click', closeDispatchConfirmationModal);
    if (DOM.btnSubmitDispatchModal) DOM.btnSubmitDispatchModal.addEventListener('click', submitDispatchModal);
    if (DOM.btnChipHoy) DOM.btnChipHoy.addEventListener('click', () => setChipActive('hoy'));
    if (DOM.btnChipAyer) DOM.btnChipAyer.addEventListener('click', () => setChipActive('ayer'));

    // 6. Modal Drilldown
    if (DOM.btnModalClose) DOM.btnModalClose.addEventListener('click', closeDrilldownModal);
    if (DOM.btnModalCloseFooter) DOM.btnModalCloseFooter.addEventListener('click', closeDrilldownModal);
    if (DOM.btnExportModalCSV) DOM.btnExportModalCSV.addEventListener('click', exportModalToCSV);
    if (DOM.modalSearchInput) {
        DOM.modalSearchInput.addEventListener('input', (e) => {
            state.modalSearchQuery = e.target.value;
            filterModalData();
        });
    }

    // 7. Modal Carga Masiva CSV a hoja DATA
    if (DOM.btnOpenUploadCsv) DOM.btnOpenUploadCsv.addEventListener('click', openUploadModal);
    if (DOM.btnCloseUploadModal) DOM.btnCloseUploadModal.addEventListener('click', closeUploadModal);
    if (DOM.btnCancelUploadModal) DOM.btnCancelUploadModal.addEventListener('click', closeUploadModal);
    if (DOM.btnConfirmUploadCsv) DOM.btnConfirmUploadCsv.addEventListener('click', submitCsvUpload);

    if (DOM.csvFileInput) {
        DOM.csvFileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                handleFileSelect(e.target.files[0]);
            }
        });
    }

    if (DOM.btnChangeCsvFile) {
        DOM.btnChangeCsvFile.addEventListener('click', () => {
            if (DOM.csvFileInput) DOM.csvFileInput.click();
        });
    }

    if (DOM.csvDropzone) {
        DOM.csvDropzone.addEventListener('click', () => {
            if (DOM.csvFileInput) DOM.csvFileInput.click();
        });

        DOM.csvDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            DOM.csvDropzone.classList.add('drag-over');
        });

        DOM.csvDropzone.addEventListener('dragleave', () => {
            DOM.csvDropzone.classList.remove('drag-over');
        });

        DOM.csvDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            DOM.csvDropzone.classList.remove('drag-over');
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileSelect(e.dataTransfer.files[0]);
            }
        });
    }

    // Cerrar modales con tecla Escape y clic en backdrop
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeDispatchConfirmationModal();
            closeDrilldownModal();
            closeUploadModal();
            closeAsentarModal();
        }
    });

    [DOM.confirmDispatchModal, DOM.drilldownModal, DOM.uploadCsvModal, DOM.asentarProgModal].forEach(modal => {
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeDispatchConfirmationModal();
                    closeDrilldownModal();
                    closeUploadModal();
                    closeAsentarModal();
                }
            });
        }
    });
}

import { renderSkeletons } from './utils.js';

function init() {
    renderSkeletons();
    setupEventListeners();
    initProgramacionView();
    fetchAllData();
}

// Iniciar aplicación cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
