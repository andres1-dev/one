/**
 * Utility Functions: Formatting, Dates, Escaping and Notifications
 */
import { DOM } from './dom.js';
import { MONTHS_MAP } from './config.js';

export function formatNumber(val) {
    if (val === null || val === undefined || isNaN(val)) return '0';
    return Number(val).toLocaleString('es-CO');
}

export function parseNumber(val) {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    let clean = String(val).replace(/[$]/g, '').trim();
    if (clean.includes(',') && clean.includes('.')) {
        if (clean.lastIndexOf('.') > clean.lastIndexOf(',')) {
            clean = clean.replace(/,/g, '');
        } else {
            clean = clean.replace(/\./g, '').replace(',', '.');
        }
    } else if (clean.includes(',')) {
        clean = clean.replace(',', '.');
    }
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
}

export function parseDateString(str) {
    if (!str) return null;
    const s = String(str).trim().toLowerCase();

    // 1. Formato ISO: YYYY-MM-DD o YYYY/MM/DD
    const isoMatch = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (isoMatch) {
        const y = parseInt(isoMatch[1], 10);
        const m = parseInt(isoMatch[2], 10) - 1;
        const d = parseInt(isoMatch[3], 10);
        return new Date(y, m, d);
    }

    // 2. Formato numérico: DD/MM/YYYY o DD-MM-YYYY
    const dmyMatch = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/);
    if (dmyMatch) {
        const d = parseInt(dmyMatch[1], 10);
        const m = parseInt(dmyMatch[2], 10) - 1;
        let y = parseInt(dmyMatch[3], 10);
        if (y < 100) y += 2000;
        return new Date(y, m, d);
    }

    // 3. Formato texto con mes en español: "15-sep-2025", "15-sept-25", "15/ene/25", "15 de septiembre de 2025"
    const textMatch = s.match(/^(\d{1,2})[\/\-\s]+([a-záéíóúñ]+)[\/\-\s]+(\d{2,4})/);
    if (textMatch) {
        const day = parseInt(textMatch[1], 10);
        const rawMes = textMatch[2].replace(/[^a-záéíóúñ]/g, '');
        let year = parseInt(textMatch[3], 10);
        if (year < 100) year += 2000;

        let m = MONTHS_MAP[rawMes];
        if (m === undefined && rawMes.length >= 3) {
            m = MONTHS_MAP[rawMes.substring(0, 4)] !== undefined
                ? MONTHS_MAP[rawMes.substring(0, 4)]
                : MONTHS_MAP[rawMes.substring(0, 3)];
        }

        if (m !== undefined) {
            return new Date(year, m, day);
        }
    }

    // 4. Fallback seguro para strings de fecha estándar
    const fallback = new Date(str);
    if (!isNaN(fallback.getTime())) {
        return new Date(
            fallback.getUTCFullYear(),
            fallback.getUTCMonth(),
            fallback.getUTCDate()
        );
    }

    return null;
}

export function getISOWeekNumber(d) {
    if (!d || !(d instanceof Date) || isNaN(d.getTime())) return 1;
    const target = new Date(d.valueOf());
    const dayNr = (d.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
        target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    return 1 + Math.ceil((firstThursday - target) / 604800000);
}

export function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function normalizeIntegracion(rawVal) {
    const v = String(rawVal || '').trim().toLowerCase();
    if (v === 'ok' || v === 'si' || v === '1' || v === 'integrado') {
        return 'INTEGRADO';
    }
    if (v === 'no' || v === '0' || v === 'pendiente') {
        return 'PENDIENTE';
    }
    return rawVal ? String(rawVal).trim().toUpperCase() : 'PENDIENTE';
}

export function showToast(message, type = 'info', duration = 3500) {
    if (!DOM.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(message)}</span>`;
    DOM.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 250);
    }, duration);
}

export function updateStatus(type) {
    if (!DOM.statusDot) return;
    DOM.statusDot.className = 'dot-indicator';
    if (type === 'online') {
        DOM.statusDot.classList.add('online');
        DOM.statusDot.title = 'Conectado con Google Sheets';
    } else if (type === 'loading') {
        DOM.statusDot.classList.add('loading');
        DOM.statusDot.title = 'Sincronizando...';
    } else {
        DOM.statusDot.classList.add('error');
        DOM.statusDot.title = 'Error de conexión';
    }
}

export function setLoadingState(isLoading) {
    if (DOM.loadingContainer) DOM.loadingContainer.classList.toggle('hidden', !isLoading);
    if (DOM.errorContainer) DOM.errorContainer.classList.add('hidden');
}

export function showError(msg) {
    if (DOM.loadingContainer) DOM.loadingContainer.classList.add('hidden');
    if (DOM.errorContainer) {
        DOM.errorContainer.classList.remove('hidden');
        if (DOM.errorMessage) DOM.errorMessage.textContent = msg;
    }
}
