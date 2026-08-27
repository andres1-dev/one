/**
 * Modal: Confirmar & Asentar Despacho (Solicitud de Fecha + GAS Sync)
 */
import { state } from '../state.js';
import { DOM } from '../dom.js';
import { formatNumber, showToast } from '../utils.js';
import { sendDispatchToGAS } from '../api.js';
import { applyDespachosFilters } from '../views/despachosView.js';
import { computeAndRenderKPIs } from '../views/kpisView.js';

export function openDispatchConfirmationModal(item) {
    state.pendingDispatchItem = item;

    if (DOM.modalDispOp) DOM.modalDispOp.textContent = item.op;
    if (DOM.modalDispRef) DOM.modalDispRef.textContent = item.ref;
    if (DOM.modalDispCantidad) DOM.modalDispCantidad.textContent = `${formatNumber(item.cantidad)} Unds`;
    if (DOM.modalDispTaller) DOM.modalDispTaller.textContent = item.taller || 'Sin taller asignado';

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    if (DOM.inputDispatchDate) DOM.inputDispatchDate.value = todayStr;
    if (DOM.inputDispatchObs) DOM.inputDispatchObs.value = '';

    setChipActive('hoy');

    if (DOM.confirmDispatchModal) {
        DOM.confirmDispatchModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

export function closeDispatchConfirmationModal() {
    if (DOM.confirmDispatchModal) {
        DOM.confirmDispatchModal.classList.add('hidden');
        document.body.style.overflow = '';
    }
    state.pendingDispatchItem = null;
}

export function setChipActive(type) {
    if (DOM.btnChipHoy) DOM.btnChipHoy.classList.toggle('active', type === 'hoy');
    if (DOM.btnChipAyer) DOM.btnChipAyer.classList.toggle('active', type === 'ayer');

    const d = new Date();
    if (type === 'ayer') {
        d.setDate(d.getDate() - 1);
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    if (DOM.inputDispatchDate) DOM.inputDispatchDate.value = `${year}-${month}-${day}`;
}

export async function submitDispatchModal() {
    const item = state.pendingDispatchItem;
    if (!item) return;

    const fechaInput = DOM.inputDispatchDate ? DOM.inputDispatchDate.value : '';
    const obsInput = DOM.inputDispatchObs ? DOM.inputDispatchObs.value.trim() : '';

    if (!fechaInput) {
        showToast('Por favor selecciona la fecha de despacho', 'warning');
        return;
    }

    // Formato de fecha para Google Sheets: DD/MM/YYYY
    const parts = fechaInput.split('-');
    const fechaFormatted = `${parts[2]}/${parts[1]}/${parts[0]}`;

    // Actualización optimista inmediata en UI
    item.isDespachado = true;
    item.fechaDespacho = fechaFormatted;
    if (obsInput) {
        item.observacion = item.observacion ? `${item.observacion} | ${obsInput}` : obsInput;
    }

    const pendingCount = state.despachosRecords.filter(r => !r.isDespachado).length;
    if (DOM.badgeCountPendientes) {
        DOM.badgeCountPendientes.textContent = pendingCount;
    }

    applyDespachosFilters();
    computeAndRenderKPIs();
    closeDispatchConfirmationModal();

    showToast(`Guardando despacho OP ${item.op} en Google Sheets...`, 'info', 2000);

    // Enviar a GAS
    const payload = {
        action: 'despachar',
        rowNumber: item.rowNumber,
        op: item.op,
        ref: item.ref,
        cantidad: item.cantidad,
        taller: item.taller,
        fechaDespacho: fechaFormatted,
        observacion: obsInput
    };

    try {
        await sendDispatchToGAS(payload);
        showToast(`✅ Despacho OP ${item.op} guardado exitosamente en Sheets`, 'success');
    } catch (err) {
        console.error('Error enviando a GAS:', err);
        showToast(`⚠️ Guardado localmente. Error sincronizando con Sheets: ${err.message}`, 'warning', 5000);
    }
}
