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

export function renderSkeletons() {
    // 1. Skeletons en métricas del Header
    if (DOM.statTotalRows) DOM.statTotalRows.innerHTML = '<span class="skeleton" style="width: 32px; height: 14px; display: inline-block;"></span>';
    if (DOM.statTotalCort) DOM.statTotalCort.innerHTML = '<span class="skeleton" style="width: 52px; height: 14px; display: inline-block;"></span>';
    if (DOM.statTotalBodega) DOM.statTotalBodega.innerHTML = '<span class="skeleton" style="width: 52px; height: 14px; display: inline-block;"></span>';

    // 2. Skeletons en KPI Banner (Números y subtextos)
    const bannerItems = [
        DOM.kpiTotalInventario, DOM.kpiMediaPonderada, DOM.kpiPendienteDespacho,
        DOM.kpiMediaMensual, DOM.kpiMediaSemanal, DOM.kpiMediaDiaria
    ];
    bannerItems.forEach(el => {
        if (el) el.innerHTML = '<span class="skeleton skeleton-num"></span>';
    });

    if (DOM.kpiLotesPendientes) {
        DOM.kpiLotesPendientes.innerHTML = '<span class="skeleton" style="width: 80px; height: 10px; display: inline-block;"></span>';
    }

    if (DOM.badgeDiarioPendiente) {
        DOM.badgeDiarioPendiente.innerHTML = '<span class="skeleton" style="width: 90px; height: 16px; display: inline-block; border-radius: 4px;"></span>';
    }

    if (DOM.badgeTotalCriticos) {
        DOM.badgeTotalCriticos.innerHTML = '<span class="skeleton" style="width: 60px; height: 16px; display: inline-block; border-radius: 4px;"></span>';
    }

    // 3. Skeletons en mini-tablas de KPIs (4 filas con barras)
    const kpiTables = [
        DOM.tblClase, DOM.tblTejido, DOM.tblGenero, DOM.tblCuento,
        DOM.tblAntiguedad, DOM.tblCriticos, DOM.tblMensual, DOM.tblSemanal, DOM.tblDiario
    ];
    kpiTables.forEach(tbody => {
        if (tbody) {
            tbody.innerHTML = Array(4).fill(0).map(() => `
                <tr class="skeleton-row">
                    <td><div class="skeleton skeleton-text" style="width: 75%;"></div></td>
                    <td class="text-right"><div class="skeleton skeleton-text" style="width: 55px; margin-left: auto;"></div></td>
                    <td class="text-right"><div class="skeleton skeleton-text" style="width: 40px; margin-left: auto;"></div></td>
                    <td class="text-right"><div class="skeleton skeleton-text" style="width: 45px; margin-left: auto;"></div></td>
                </tr>
            `).join('');
        }
    });

    // 4. Skeletons en Tabla FILTER
    if (DOM.tableBody) {
        DOM.tableBody.innerHTML = Array(8).fill(0).map(() => `
            <tr class="skeleton-row">
                <td><div class="skeleton skeleton-text" style="width: 60px;"></div></td>
                <td><div class="skeleton skeleton-text" style="width: 80px;"></div></td>
                <td class="text-right"><div class="skeleton skeleton-text" style="width: 45px; margin-left: auto;"></div></td>
                <td><div class="skeleton skeleton-text" style="width: 70px;"></div></td>
                <td class="text-center"><div class="skeleton skeleton-badge" style="margin: 0 auto;"></div></td>
                <td class="text-right"><div class="skeleton skeleton-text" style="width: 45px; margin-left: auto;"></div></td>
                <td><div class="skeleton skeleton-text" style="width: 150px;"></div></td>
                <td><div class="skeleton skeleton-text" style="width: 70px;"></div></td>
                <td><div class="skeleton skeleton-text" style="width: 55px;"></div></td>
                <td><div class="skeleton skeleton-text" style="width: 65px;"></div></td>
                <td class="text-right"><div class="skeleton skeleton-text" style="width: 50px; margin-left: auto;"></div></td>
                <td class="text-center"><div class="skeleton skeleton-badge" style="margin: 0 auto;"></div></td>
            </tr>
        `).join('');
    }

    // 5. Skeletons en Tabla DESPACHOS
    if (DOM.tableDespachosBody) {
        DOM.tableDespachosBody.innerHTML = Array(8).fill(0).map(() => `
            <tr class="skeleton-row">
                <td class="text-center"><div class="skeleton skeleton-text" style="width: 25px; margin: 0 auto;"></div></td>
                <td class="text-center"><div class="skeleton skeleton-badge" style="width: 75px; margin: 0 auto;"></div></td>
                <td><div class="skeleton skeleton-text" style="width: 70px;"></div></td>
                <td><div class="skeleton skeleton-text" style="width: 60px;"></div></td>
                <td><div class="skeleton skeleton-text" style="width: 80px;"></div></td>
                <td class="text-right"><div class="skeleton skeleton-text" style="width: 50px; margin-left: auto;"></div></td>
                <td><div class="skeleton skeleton-text" style="width: 90px;"></div></td>
                <td><div class="skeleton skeleton-text" style="width: 70px;"></div></td>
                <td><div class="skeleton skeleton-text" style="width: 130px;"></div></td>
            </tr>
        `).join('');
    }
}

export function setLoadingState(isLoading) {
    document.body.classList.toggle('app-loading', isLoading);
    if (isLoading) {
        renderSkeletons();
        if (DOM.errorContainer) DOM.errorContainer.classList.add('hidden');
    }
}

export function showError(msg) {
    document.body.classList.remove('app-loading');
    if (DOM.errorContainer) {
        DOM.errorContainer.classList.remove('hidden');
        if (DOM.errorMessage) DOM.errorMessage.textContent = msg;
    }
}
