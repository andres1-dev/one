/**
 * Modal: Drill-down Detalle de Lotes (Separación estricta de Pendientes vs Despachados)
 */
import { state } from '../state.js';
import { DOM } from '../dom.js';
import { formatNumber, escapeHtml } from '../utils.js';

export function openInventoryDrilldown(key, val, titleLabel) {
    const matched = state.records.filter(r => {
        if (key === 'fechaCorte') return r.fechaCorte === val;
        return (r[key] || '').toLowerCase() === String(val).toLowerCase();
    });

    state.modalType = 'inventory';
    state.modalData = matched;
    state.modalTitleText = titleLabel;
    state.modalCategoryText = 'Inventario & Producción';
    state.modalSearchQuery = '';
    if (DOM.modalSearchInput) DOM.modalSearchInput.value = '';

    renderModalContent();
    if (DOM.drilldownModal) {
        DOM.drilldownModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

export function openDespachosDrilldown(filterFn, titleLabel) {
    const matched = state.despachosRecords.filter(filterFn);

    state.modalType = 'despachos';
    state.modalData = matched;
    state.modalTitleText = titleLabel;
    state.modalCategoryText = 'Movimientos de Despacho';
    state.modalSearchQuery = '';
    if (DOM.modalSearchInput) DOM.modalSearchInput.value = '';

    renderModalContent();
    if (DOM.drilldownModal) {
        DOM.drilldownModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

export function closeDrilldownModal() {
    if (DOM.drilldownModal) {
        DOM.drilldownModal.classList.add('hidden');
        document.body.style.overflow = '';
    }
}

export function filterModalData() {
    const q = state.modalSearchQuery.toLowerCase().trim();
    if (!q) {
        state.filteredModalData = [...state.modalData];
    } else {
        state.filteredModalData = state.modalData.filter(item => {
            if (state.modalType === 'inventory') {
                return (
                    item.op.toLowerCase().includes(q) ||
                    item.ref.toLowerCase().includes(q) ||
                    item.descripcion.toLowerCase().includes(q) ||
                    item.cuento.toLowerCase().includes(q) ||
                    item.genero.toLowerCase().includes(q) ||
                    item.tipoTejido.toLowerCase().includes(q) ||
                    item.clase.toLowerCase().includes(q)
                );
            } else {
                return (
                    item.op.toLowerCase().includes(q) ||
                    item.ref.toLowerCase().includes(q) ||
                    item.taller.toLowerCase().includes(q) ||
                    item.fecha.toLowerCase().includes(q)
                );
            }
        });
    }
    renderModalTable();
}

export function renderModalContent() {
    if (DOM.modalTitle) DOM.modalTitle.textContent = state.modalTitleText;
    if (DOM.modalCategoryTag) DOM.modalCategoryTag.textContent = state.modalCategoryText;

    state.filteredModalData = [...state.modalData];
    renderModalTable();
}

export function renderModalTable() {
    const data = state.filteredModalData;
    let totalUnits = 0;
    data.forEach(d => {
        totalUnits += (state.modalType === 'inventory' ? (d.undCort || 0) : (d.cantidad || 0));
    });

    if (DOM.modalTotalUnits) DOM.modalTotalUnits.textContent = `${formatNumber(Math.round(totalUnits))} Unds`;
    if (DOM.modalTotalLotes) DOM.modalTotalLotes.textContent = `${formatNumber(data.length)} Lotes`;
    if (DOM.modalFooterInfo) DOM.modalFooterInfo.textContent = `Mostrando ${data.length} de ${state.modalData.length} registros`;

    if (state.modalType === 'inventory') {
        if (DOM.tblModalHead) {
            DOM.tblModalHead.innerHTML = `
                <tr>
                    <th>OP</th>
                    <th>Referencia</th>
                    <th class="text-right">Und Cort</th>
                    <th class="text-right">Bodega</th>
                    <th>Fecha Corte</th>
                    <th>Descripción</th>
                    <th>Cuento</th>
                    <th>Género</th>
                    <th>Tejido</th>
                    <th class="text-center">Integración</th>
                    <th class="text-right">PVP</th>
                    <th class="text-center">Clase</th>
                </tr>
            `;
        }

        let bodyHtml = '';
        if (data.length === 0) {
            bodyHtml = `<tr><td colspan="12" class="text-center" style="padding: 2rem; color: var(--text-muted);">No hay registros coincidentes.</td></tr>`;
        } else {
            data.forEach(r => {
                const estadoClass = r.estadoIntegracion === 'INTEGRADO' ? 'tag-integrated' : 'tag-pending';
                bodyHtml += `
                    <tr>
                        <td class="cell-op">${escapeHtml(r.op)}</td>
                        <td><strong>${escapeHtml(r.ref)}</strong></td>
                        <td class="cell-num text-right">${formatNumber(r.undCort)}</td>
                        <td class="cell-num text-right">${formatNumber(r.bodegaDespacho)}</td>
                        <td class="cell-muted">${escapeHtml(r.fechaCorte)}</td>
                        <td>${escapeHtml(r.descripcion)}</td>
                        <td class="cell-muted">${escapeHtml(r.cuento)}</td>
                        <td>${escapeHtml(r.genero)}</td>
                        <td class="cell-muted">${escapeHtml(r.tipoTejido)}</td>
                        <td class="text-center"><span class="tag ${estadoClass}">${escapeHtml(r.estadoIntegracion)}</span></td>
                        <td class="cell-num text-right">${escapeHtml(r.pvp)}</td>
                        <td class="text-center"><span class="tag">${escapeHtml(r.clase)}</span></td>
                    </tr>
                `;
            });
        }
        if (DOM.tblModalBody) DOM.tblModalBody.innerHTML = bodyHtml;

    } else {
        if (DOM.tblModalHead) {
            DOM.tblModalHead.innerHTML = `
                <tr>
                    <th>Fecha</th>
                    <th>OP</th>
                    <th>Referencia</th>
                    <th class="text-right">Cantidad</th>
                    <th>Taller / Destino</th>
                    <th class="text-center">Estado (Col G)</th>
                    <th>Observación</th>
                </tr>
            `;
        }

        let bodyHtml = '';
        if (data.length === 0) {
            bodyHtml = `<tr><td colspan="7" class="text-center" style="padding: 2rem; color: var(--text-muted);">No hay registros coincidentes.</td></tr>`;
        } else {
            const pendientes = data.filter(r => !r.isDespachado);
            const despachados = data.filter(r => r.isDespachado);

            const pendUnits = pendientes.reduce((acc, r) => acc + (r.cantidad || 0), 0);
            const despUnits = despachados.reduce((acc, r) => acc + (r.cantidad || 0), 0);

            // 1. SECCIÓN: PENDIENTES POR DESPACHAR
            bodyHtml += `
                <tr class="modal-section-header pending-header">
                    <td colspan="7">
                        <div class="modal-section-content">
                            <span>⏳ Pendientes por Despachar (${pendientes.length} lotes)</span>
                            <strong>${formatNumber(Math.round(pendUnits))} Unds</strong>
                        </div>
                    </td>
                </tr>
            `;

            if (pendientes.length === 0) {
                bodyHtml += `<tr class="modal-empty-row"><td colspan="7" class="text-center">No hay despachos pendientes en esta selección.</td></tr>`;
            } else {
                pendientes.forEach(r => {
                    bodyHtml += `
                        <tr>
                            <td><strong>${escapeHtml(r.fecha)}</strong></td>
                            <td class="cell-op">${escapeHtml(r.op)}</td>
                            <td><strong>${escapeHtml(r.ref)}</strong></td>
                            <td class="cell-num text-right"><strong style="color: #f59e0b;">${formatNumber(Math.round(r.cantidad))}</strong></td>
                            <td>${escapeHtml(r.taller || '-')}</td>
                            <td class="text-center"><span class="tag tag-pending">PENDIENTE</span></td>
                            <td class="cell-muted">${escapeHtml(r.observacion || '-')}</td>
                        </tr>
                    `;
                });
            }

            // 2. SECCIÓN: YA DESPACHADOS
            bodyHtml += `
                <tr class="modal-section-header done-header">
                    <td colspan="7">
                        <div class="modal-section-content">
                            <span>✅ Ya Despachados — Columna G = 'X' (${despachados.length} lotes)</span>
                            <strong>${formatNumber(Math.round(despUnits))} Unds</strong>
                        </div>
                    </td>
                </tr>
            `;

            if (despachados.length === 0) {
                bodyHtml += `<tr class="modal-empty-row"><td colspan="7" class="text-center">No hay registros despachados en esta selección.</td></tr>`;
            } else {
                despachados.forEach(r => {
                    bodyHtml += `
                        <tr>
                            <td><strong>${escapeHtml(r.fecha)}</strong></td>
                            <td class="cell-op">${escapeHtml(r.op)}</td>
                            <td><strong>${escapeHtml(r.ref)}</strong></td>
                            <td class="cell-num text-right"><strong style="color: #10b981;">${formatNumber(Math.round(r.cantidad))}</strong></td>
                            <td>${escapeHtml(r.taller || '-')}</td>
                            <td class="text-center"><span class="tag tag-integrated">DESPACHADO (X)</span></td>
                            <td class="cell-muted">${escapeHtml(r.observacion || '-')}</td>
                        </tr>
                    `;
                });
            }
        }
        if (DOM.tblModalBody) DOM.tblModalBody.innerHTML = bodyHtml;
    }
}

export function exportModalToCSV() {
    const data = state.filteredModalData;
    if (!data.length) return;

    let headers = [];
    let rows = [];

    if (state.modalType === 'inventory') {
        headers = ['OP', 'Ref', 'UndCort', 'BodegaDespacho', 'FechaCorte', 'Descripcion', 'Cuento', 'Genero', 'Tejido', 'Integracion', 'PVP', 'Clase'];
        rows = data.map(r => [
            `"${r.op}"`, `"${r.ref}"`, r.undCort, r.bodegaDespacho, `"${r.fechaCorte}"`,
            `"${r.descripcion}"`, `"${r.cuento}"`, `"${r.genero}"`, `"${r.tipoTejido}"`,
            `"${r.estadoIntegracion}"`, `"${r.pvp}"`, `"${r.clase}"`
        ].join(','));
    } else {
        headers = ['Fecha', 'OP', 'Referencia', 'Cantidad', 'Taller', 'Despachado_ColG', 'Observacion'];
        rows = data.map(r => [
            `"${r.fecha}"`, `"${r.op}"`, `"${r.ref}"`, r.cantidad, `"${r.taller}"`, `"${r.isDespachado ? 'X' : ''}"`, `"${r.observacion}"`
        ].join(','));
    }

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `detalle_${state.modalType}_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
