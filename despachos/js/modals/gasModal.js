/**
 * Modal: Configuración de Google Apps Script (GAS)
 */
import { state } from '../state.js';
import { DOM } from '../dom.js';
import { showToast } from '../utils.js';

export function openGasSettingsModal() {
    if (DOM.inputGasUrl) {
        DOM.inputGasUrl.value = state.gasWebAppUrl;
    }
    if (DOM.gasSettingsModal) {
        DOM.gasSettingsModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

export function closeGasSettingsModal() {
    if (DOM.gasSettingsModal) {
        DOM.gasSettingsModal.classList.add('hidden');
        document.body.style.overflow = '';
    }
}

export function saveGasUrl() {
    const url = DOM.inputGasUrl ? DOM.inputGasUrl.value.trim() : '';
    if (!url) {
        showToast('Por favor introduce una URL válida', 'warning');
        return;
    }
    state.gasWebAppUrl = url;
    localStorage.setItem('gas_webapp_url', url);
    showToast('URL de Google Apps Script guardada correctamente', 'success');
    closeGasSettingsModal();
}

export async function testGasConnection() {
    const url = DOM.inputGasUrl ? DOM.inputGasUrl.value.trim() : state.gasWebAppUrl;
    if (!url) {
        showToast('Introduce una URL antes de probar', 'warning');
        return;
    }

    showToast('Probando conexión con GAS...', 'info', 2000);
    try {
        await fetch(`${url}?action=test`, { mode: 'no-cors' });
        showToast('✅ Solicitud enviada correctamente a Google Apps Script', 'success');
    } catch (err) {
        showToast(`❌ Error al conectar con GAS: ${err.message}`, 'error');
    }
}
