/**
 * View 2: Gestión de Despachos (Pendientes vs Historial Despachados)
 */
import { state } from '../state.js';
import { DOM } from '../dom.js';
import { formatNumber, escapeHtml, showToast } from '../utils.js';
import { sendDispatchToGAS } from '../api.js';
import { openDispatchConfirmationModal } from '../modals/dispatchModal.js';
import { computeAndRenderKPIs } from './kpisView.js';

export async function revertDispatchToPending(item) {
    item.isDespachado = false;
    item.despachadoRaw = '';
    item.fechaDespacho = '';

    const pendingCount = state.despachosRecords.filter(r => !r.isDespachado).length;
    if (DOM.badgeCountPendientes) {
        DOM.badgeCountPendientes.textContent = pendingCount;
    }

    computeAndRenderKPIs();
    applyDespachosFilters();

    showToast(`Revertiendo OP ${item.op} a Pendiente...`, 'info', 2000);

    try {
        await sendDispatchToGAS({
            action: 'revertir',
            rowNumber: item.rowNumber || item.id + 1,
            rowIndex: item.rowNumber || item.id + 1,
            isDespachado: false,
            op: item.op,
            referencia: item.ref,
            fechaDespacho: ''
        });
        showToast(`✅ OP ${item.op} revertida a Pendiente en Google Sheets`, 'warning');
    } catch (err) {
        console.error('Error al revertir en GAS:', err);
        showToast(`⚠️ Revertido localmente. Error Apps Script: ${err.message}`, 'warning');
    }
}

export function populateDespachosFilterOptions() {
    const talleres = new Set();
    state.despachosRecords.forEach(r => {
        if (r.taller) talleres.add(r.taller);
    });

    if (DOM.filterDespachoTaller) {
        DOM.filterDespachoTaller.innerHTML = '<option value="">Taller: Todos</option>';
        [...talleres].sort().forEach(t => {
            DOM.filterDespachoTaller.innerHTML += `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`;
        });
    }
}

export function applyDespachosFilters() {
    const q = state.searchDespachosQuery.toLowerCase().trim();
    const estado = state.filterDespachoEstado;
    const taller = state.filterDespachoTaller;

    state.filteredDespachosRecords = state.despachosRecords.filter(item => {
        if (estado === 'despachado' && !item.isDespachado) return false;
        if (estado === 'pendiente' && item.isDespachado) return false;
        if (taller && item.taller.toLowerCase() !== taller.toLowerCase()) return false;

        if (!q) return true;

        return (
            item.op.toLowerCase().includes(q) ||
            item.ref.toLowerCase().includes(q) ||
            item.taller.toLowerCase().includes(q) ||
            item.fecha.toLowerCase().includes(q) ||
            item.observacion.toLowerCase().includes(q) ||
            String(item.id).includes(q)
        );
    });

    sortDespachosData();
    state.currentDespPage = 1;
    renderDespachosTable();
}

export function sortDespachosData() {
    const col = state.sortDespColumn;
    const isAsc = state.sortDespAsc;

    state.filteredDespachosRecords.sort((a, b) => {
        let valA = a[col];
        let valB = b[col];

        if (col === 'fecha') {
            valA = a.parsedDate ? a.parsedDate.getTime() : 0;
            valB = b.parsedDate ? b.parsedDate.getTime() : 0;
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

export function renderDespachosTable() {
    const total = state.filteredDespachosRecords.length;

    if (total === 0) {
        if (DOM.tableDespachosWrapper) DOM.tableDespachosWrapper.classList.add('hidden');
        if (DOM.noResultsDespachosContainer) {
            DOM.noResultsDespachosContainer.classList.remove('hidden');
            if (DOM.noResultsDespachosText) {
                if (state.filterDespachoEstado === 'pendiente') {
                    DOM.noResultsDespachosText.textContent = '¡Excelente! No hay despachos pendientes en este momento.';
                } else {
                    DOM.noResultsDespachosText.textContent = 'No se encontraron despachos para los filtros seleccionados.';
                }
            }
        }
        updateDespachosPaginationInfo(0, 0, 0);
        return;
    }

    if (DOM.noResultsDespachosContainer) DOM.noResultsDespachosContainer.classList.add('hidden');
    if (DOM.tableDespachosWrapper) DOM.tableDespachosWrapper.classList.remove('hidden');

    const pageSize = state.pageSizeDespachos === 'all' ? total : parseInt(state.pageSizeDespachos, 10);
    const totalPages = Math.ceil(total / pageSize) || 1;

    if (state.currentDespPage > totalPages) state.currentDespPage = totalPages;
    if (state.currentDespPage < 1) state.currentDespPage = 1;

    const startIdx = (state.currentDespPage - 1) * pageSize;
    const endIdx = state.pageSizeDespachos === 'all' ? total : Math.min(startIdx + pageSize, total);
    const paginatedItems = state.filteredDespachosRecords.slice(startIdx, endIdx);

    let html = '';
    for (const r of paginatedItems) {
        let actionCell = '';
        if (r.isDespachado) {
            actionCell = `
                <span class="tag tag-integrated">Listo (X)</span>
                <button class="btn-undo" data-id="${r.id}" title="Revertir estado a pendiente">✕</button>
            `;
        } else {
            actionCell = `
                <button class="btn-clean-dispatch" data-id="${r.id}" title="Confirmar y asentar salida">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    <span>Despachar</span>
                </button>
            `;
        }

        const fechaDespachoText = r.fechaDespacho ? `<strong>${escapeHtml(r.fechaDespacho)}</strong>` : '<span class="cell-muted">-</span>';

        html += `
            <tr data-row-number="${r.rowNumber || r.id + 1}" data-id="${r.id}">
                <td class="text-center cell-muted">${r.id}</td>
                <td class="text-center">${actionCell}</td>
                <td class="cell-muted">${escapeHtml(r.fecha)}</td>
                <td class="cell-op">${escapeHtml(r.op)}</td>
                <td><strong>${escapeHtml(r.ref)}</strong></td>
                <td class="cell-num text-right"><strong style="color: ${r.isDespachado ? 'inherit' : '#d97706'}">${formatNumber(Math.round(r.cantidad))}</strong></td>
                <td>${escapeHtml(r.taller || '-')}</td>
                <td>${fechaDespachoText}</td>
                <td class="cell-muted" style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(r.observacion || '-')}</td>
            </tr>
        `;
    }

    if (DOM.tableDespachosBody) {
        DOM.tableDespachosBody.innerHTML = html;
        DOM.tableDespachosBody.querySelectorAll('.btn-clean-dispatch').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id, 10);
                const item = state.despachosRecords.find(x => x.id === id);
                if (item) openDispatchConfirmationModal(item);
            });
        });

        DOM.tableDespachosBody.querySelectorAll('.btn-undo').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = parseInt(btn.dataset.id, 10);
                const item = state.despachosRecords.find(x => x.id === id);
                if (item) {
                    await revertDispatchToPending(item);
                }
            });
        });
    }

    updateDespachosPaginationInfo(startIdx + 1, endIdx, total);
    renderDespachosPaginationNav(totalPages);
    updateDespachosHeaderSortIndicators();
}

function updateDespachosPaginationInfo(start, end, total) {
    if (DOM.showingDespStart) DOM.showingDespStart.textContent = formatNumber(start);
    if (DOM.showingDespEnd) DOM.showingDespEnd.textContent = formatNumber(end);
    if (DOM.totalDespFiltered) DOM.totalDespFiltered.textContent = formatNumber(total);
}

function renderDespachosPaginationNav(totalPages) {
    if (!DOM.btnPrevDespPage || !DOM.btnNextDespPage) return;

    DOM.btnPrevDespPage.disabled = state.currentDespPage <= 1;
    DOM.btnNextDespPage.disabled = state.currentDespPage >= totalPages;

    let html = '';
    const maxButtons = 5;
    let startPage = Math.max(1, state.currentDespPage - 2);
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);

    if (endPage - startPage < maxButtons - 1) {
        startPage = Math.max(1, endPage - maxButtons + 1);
    }

    if (startPage > 1) {
        html += `<button class="btn-num" data-page="1">1</button>`;
        if (startPage > 2) html += `<span style="padding: 0 2px; color: var(--text-muted);">…</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="btn-num ${i === state.currentDespPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span style="padding: 0 2px; color: var(--text-muted);">…</span>`;
        html += `<button class="btn-num" data-page="${totalPages}">${totalPages}</button>`;
    }

    if (DOM.pageNumbersDespContainer) {
        DOM.pageNumbersDespContainer.innerHTML = html;
        DOM.pageNumbersDespContainer.querySelectorAll('.btn-num').forEach(btn => {
            btn.addEventListener('click', () => {
                state.currentDespPage = parseInt(btn.dataset.page, 10);
                renderDespachosTable();
            });
        });
    }
}

export function updateDespachosHeaderSortIndicators() {
    DOM.tableDespachosHeaders.forEach(th => {
        th.classList.remove('sorted-asc', 'sorted-desc');
        if (th.dataset.dcol === state.sortDespColumn) {
            th.classList.add(state.sortDespAsc ? 'sorted-asc' : 'sorted-desc');
        }
    });
}

export function exportDespachosToCSV() {
    const data = state.filteredDespachosRecords;
    if (!data.length) return;

    const headers = ['#', 'FechaCorte', 'OP', 'Referencia', 'Cantidad', 'Taller', 'Despachado', 'FechaDespacho', 'Observacion'];
    const csvRows = [headers.join(',')];

    data.forEach(r => {
        const row = [
            r.id,
            `"${r.fecha}"`,
            `"${r.op}"`,
            `"${r.ref}"`,
            r.cantidad,
            `"${r.taller}"`,
            `"${r.isDespachado ? 'X' : ''}"`,
            `"${r.fechaDespacho}"`,
            `"${r.observacion}"`
        ];
        csvRows.push(row.join(','));
    });

    const blob = new Blob(['\uFEFF' + csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `despachos_gestion_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
