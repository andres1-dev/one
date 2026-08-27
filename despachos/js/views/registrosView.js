/**
 * View 1: Registros / Tabla FILTER
 */
import { state } from '../state.js';
import { DOM } from '../dom.js';
import { formatNumber, escapeHtml } from '../utils.js';

export function populateFilterOptions() {
    const integraciones = new Set();
    const cuentos = new Set();
    const tejidos = new Set();
    const generos = new Set();
    const clases = new Set();

    state.records.forEach(r => {
        if (r.estadoIntegracion) integraciones.add(r.estadoIntegracion);
        if (r.cuento) cuentos.add(r.cuento);
        if (r.tipoTejido) tejidos.add(r.tipoTejido);
        if (r.genero) generos.add(r.genero);
        if (r.clase) clases.add(r.clase);
    });

    if (DOM.filterIntegracion) {
        DOM.filterIntegracion.innerHTML = '<option value="">Integración: Todas</option>';
        [...integraciones].sort().forEach(item => {
            DOM.filterIntegracion.innerHTML += `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`;
        });
    }

    if (DOM.filterCuento) {
        DOM.filterCuento.innerHTML = '<option value="">Cuento: Todos</option>';
        [...cuentos].sort().forEach(item => {
            DOM.filterCuento.innerHTML += `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`;
        });
    }

    if (DOM.filterTejido) {
        DOM.filterTejido.innerHTML = '<option value="">Tejido: Todos</option>';
        [...tejidos].sort().forEach(item => {
            DOM.filterTejido.innerHTML += `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`;
        });
    }

    if (DOM.filterGenero) {
        DOM.filterGenero.innerHTML = '<option value="">Género: Todos</option>';
        [...generos].sort().forEach(item => {
            DOM.filterGenero.innerHTML += `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`;
        });
    }

    if (DOM.filterClase) {
        DOM.filterClase.innerHTML = '<option value="">Clase: Todas</option>';
        [...clases].sort().forEach(item => {
            DOM.filterClase.innerHTML += `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`;
        });
    }
}

export function applyFilters() {
    const query = state.searchQuery.toLowerCase().trim();

    state.filteredRecords = state.records.filter(item => {
        if (state.filterIntegracion && item.estadoIntegracion !== state.filterIntegracion) return false;
        if (state.filterCuento && item.cuento !== state.filterCuento) return false;
        if (state.filterTejido && item.tipoTejido !== state.filterTejido) return false;
        if (state.filterGenero && item.genero !== state.filterGenero) return false;
        if (state.filterClase && item.clase !== state.filterClase) return false;

        if (!query) return true;

        return (
            item.op.toLowerCase().includes(query) ||
            item.ref.toLowerCase().includes(query) ||
            item.descripcion.toLowerCase().includes(query) ||
            item.cuento.toLowerCase().includes(query) ||
            item.genero.toLowerCase().includes(query) ||
            item.tipoTejido.toLowerCase().includes(query) ||
            item.fechaCorte.toLowerCase().includes(query) ||
            item.clase.toLowerCase().includes(query) ||
            item.estadoIntegracion.toLowerCase().includes(query)
        );
    });

    sortData();
    updateMetrics();
    state.currentPage = 1;
    renderTable();
}

export function sortData() {
    const col = state.sortColumn;
    const isAsc = state.sortAsc;

    state.filteredRecords.sort((a, b) => {
        let valA = a[col];
        let valB = b[col];

        if (col === 'fechaCorte') {
            valA = a.parsedFechaCorte ? a.parsedFechaCorte.getTime() : 0;
            valB = b.parsedFechaCorte ? b.parsedFechaCorte.getTime() : 0;
            return isAsc ? valA - valB : valB - valA;
        }

        if (typeof valA === 'number' && typeof valB === 'number') {
            return isAsc ? valA - valB : valB - valA;
        }

        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();

        if (valA < valB) return isAsc ? -1 : 1;
        if (valA > valB) return isAsc ? 1 : -1;
        return 0;
    });
}

export function updateMetrics() {
    let totalCort = 0;
    let totalBodega = 0;

    for (const r of state.filteredRecords) {
        totalCort += (r.undCort || 0);
        totalBodega += (r.bodegaDespacho || 0);
    }

    if (DOM.statTotalRows) DOM.statTotalRows.textContent = formatNumber(state.filteredRecords.length);
    if (DOM.statTotalCort) DOM.statTotalCort.textContent = formatNumber(totalCort);
    if (DOM.statTotalBodega) DOM.statTotalBodega.textContent = formatNumber(totalBodega);
}

export function renderTable() {
    const total = state.filteredRecords.length;

    if (total === 0) {
        if (DOM.tableWrapper) DOM.tableWrapper.classList.add('hidden');
        if (DOM.noResultsContainer) DOM.noResultsContainer.classList.remove('hidden');
        updatePaginationInfo(0, 0, 0);
        return;
    }

    if (DOM.noResultsContainer) DOM.noResultsContainer.classList.add('hidden');
    if (DOM.tableWrapper) DOM.tableWrapper.classList.remove('hidden');

    const pageSize = state.pageSize === 'all' ? total : parseInt(state.pageSize, 10);
    const totalPages = Math.ceil(total / pageSize) || 1;
    
    if (state.currentPage > totalPages) state.currentPage = totalPages;
    if (state.currentPage < 1) state.currentPage = 1;

    const startIdx = (state.currentPage - 1) * pageSize;
    const endIdx = state.pageSize === 'all' ? total : Math.min(startIdx + pageSize, total);
    const paginatedItems = state.filteredRecords.slice(startIdx, endIdx);

    let html = '';
    for (const r of paginatedItems) {
        const estadoClass = r.estadoIntegracion === 'INTEGRADO' ? 'tag-integrated' : 'tag-pending';
        html += `
            <tr>
                <td class="cell-op">${escapeHtml(r.op)}</td>
                <td>${escapeHtml(r.ref)}</td>
                <td class="cell-num text-right">${formatNumber(r.undCort)}</td>
                <td class="cell-muted">${escapeHtml(r.fechaCorte)}</td>
                <td class="text-center"><span class="tag ${estadoClass}">${escapeHtml(r.estadoIntegracion)}</span></td>
                <td class="cell-num text-right">${formatNumber(r.bodegaDespacho)}</td>
                <td>${escapeHtml(r.descripcion)}</td>
                <td class="cell-muted">${escapeHtml(r.cuento)}</td>
                <td>${escapeHtml(r.genero)}</td>
                <td class="cell-muted">${escapeHtml(r.tipoTejido)}</td>
                <td class="cell-num text-right">${escapeHtml(r.pvp)}</td>
                <td class="text-center"><span class="tag">${escapeHtml(r.clase)}</span></td>
            </tr>
        `;
    }

    if (DOM.tableBody) DOM.tableBody.innerHTML = html;
    updatePaginationInfo(startIdx + 1, endIdx, total);
    renderPaginationNav(totalPages);
    updateHeaderSortIndicators();
}

function updatePaginationInfo(start, end, total) {
    if (DOM.showingStart) DOM.showingStart.textContent = formatNumber(start);
    if (DOM.showingEnd) DOM.showingEnd.textContent = formatNumber(end);
    if (DOM.totalFiltered) DOM.totalFiltered.textContent = formatNumber(total);
}

function renderPaginationNav(totalPages) {
    if (!DOM.btnPrevPage || !DOM.btnNextPage) return;

    DOM.btnPrevPage.disabled = state.currentPage <= 1;
    DOM.btnNextPage.disabled = state.currentPage >= totalPages;

    let html = '';
    const maxButtons = 5;
    let startPage = Math.max(1, state.currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);

    if (endPage - startPage < maxButtons - 1) {
        startPage = Math.max(1, endPage - maxButtons + 1);
    }

    if (startPage > 1) {
        html += `<button class="btn-num" data-page="1">1</button>`;
        if (startPage > 2) html += `<span style="padding: 0 2px; color: var(--text-muted);">…</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="btn-num ${i === state.currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span style="padding: 0 2px; color: var(--text-muted);">…</span>`;
        html += `<button class="btn-num" data-page="${totalPages}">${totalPages}</button>`;
    }

    if (DOM.pageNumbersContainer) {
        DOM.pageNumbersContainer.innerHTML = html;
        DOM.pageNumbersContainer.querySelectorAll('.btn-num').forEach(btn => {
            btn.addEventListener('click', () => {
                state.currentPage = parseInt(btn.dataset.page, 10);
                renderTable();
            });
        });
    }
}

export function updateHeaderSortIndicators() {
    DOM.tableHeaders.forEach(th => {
        th.classList.remove('sorted-asc', 'sorted-desc');
        if (th.dataset.col === state.sortColumn) {
            th.classList.add(state.sortAsc ? 'sorted-asc' : 'sorted-desc');
        }
    });
}

export function exportToCSV() {
    const data = state.filteredRecords;
    if (!data.length) return;

    const headers = ['OP', 'Ref', 'UndCort', 'FechaCorte', 'EstadoIntegracion', 'BodegaDespacho', 'Descripcion', 'Cuento', 'Genero', 'TipoTejido', 'PVP', 'Clase'];
    const csvRows = [headers.join(',')];

    data.forEach(r => {
        const row = [
            `"${r.op}"`,
            `"${r.ref}"`,
            r.undCort,
            `"${r.fechaCorte}"`,
            `"${r.estadoIntegracion}"`,
            r.bodegaDespacho,
            `"${r.descripcion}"`,
            `"${r.cuento}"`,
            `"${r.genero}"`,
            `"${r.tipoTejido}"`,
            `"${r.pvp}"`,
            `"${r.clase}"`
        ];
        csvRows.push(row.join(','));
    });

    const blob = new Blob(['\uFEFF' + csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `despachos_filter_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
