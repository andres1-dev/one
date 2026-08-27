/**
 * API Module: Google Sheets V4 API Consumer & Google Apps Script Integrator
 */
import { CONFIG, COLUMN_INDICES, COL_DESP } from './config.js';
import { state } from './state.js';
import { DOM } from './dom.js';
import {
    parseNumber, parseDateString, normalizeIntegracion,
    setLoadingState, updateStatus, showError, showToast
} from './utils.js';
import { computeAndRenderKPIs } from './views/kpisView.js';
import { applyFilters, populateFilterOptions } from './views/registrosView.js';
import { applyDespachosFilters, populateDespachosFilterOptions } from './views/despachosView.js';

/**
 * Obtiene la configuración (API Key y Spreadsheet ID) desde GAS
 * si no están ya en memoria o en caché.
 */
export async function ensureConfig() {
    if (CONFIG.API_KEY && CONFIG.SPREADSHEET_ID) {
        return;
    }

    // Intentar desde sessionStorage primero (ultra rápido)
    const cachedKey = sessionStorage.getItem('cached_gas_key');
    const cachedId  = sessionStorage.getItem('cached_gas_id');
    if (cachedKey && cachedId) {
        CONFIG.API_KEY = cachedKey;
        CONFIG.SPREADSHEET_ID = cachedId;
        return;
    }

    const gasUrl = state.gasWebAppUrl || CONFIG.DEFAULT_GAS_URL;
    try {
        const res = await fetch(`${gasUrl}?action=getConfig`);
        const data = await res.json();
        if (data && data.apiKey) {
            CONFIG.API_KEY = data.apiKey;
            if (data.spreadsheetId) CONFIG.SPREADSHEET_ID = data.spreadsheetId;
            sessionStorage.setItem('cached_gas_key', data.apiKey);
            sessionStorage.setItem('cached_gas_id', data.spreadsheetId || CONFIG.SPREADSHEET_ID);
        }
    } catch (err) {
        console.warn('No se pudo obtener config remota desde GAS, usando fallback local:', err);
    }
}

export async function fetchAllData() {
    if (state.isLoading) return;
    
    setLoadingState(true);
    updateStatus('loading');

    // Garantizar que tenemos la API Key y Spreadsheet ID antes de consultar
    await ensureConfig();

    if (!CONFIG.API_KEY) {
        setLoadingState(false);
        updateStatus('error');
        showError('No se pudo obtener la API Key de Google Sheets desde GAS. Verifica la conexión.');
        return;
    }

    const urlFilter = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(CONFIG.SHEET_FILTER)}!${CONFIG.RANGE_FILTER}?key=${CONFIG.API_KEY}`;
    const urlDespachos = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(CONFIG.SHEET_DESPACHOS)}!${CONFIG.RANGE_DESPACHOS}?key=${CONFIG.API_KEY}`;

    try {
        const [resFilter, resDespachos] = await Promise.all([
            fetch(urlFilter).then(r => r.json()),
            fetch(urlDespachos).then(r => r.json()).catch(() => ({ values: [] }))
        ]);

        if (!resFilter.values || resFilter.values.length <= 1) {
            throw new Error('La hoja FILTER está vacía o no tiene registros.');
        }

        processRawFilter(resFilter.values);
        processRawDespachos(resDespachos.values || []);

        computeAndRenderKPIs();
        populateFilterOptions();
        populateDespachosFilterOptions();

        if (state.activeTab === 'table') {
            applyFilters();
        } else if (state.activeTab === 'despachos') {
            applyDespachosFilters();
        }

        updateStatus('online');
        setLoadingState(false);
    } catch (error) {
        console.error('Error Google Sheets:', error);
        updateStatus('error');
        showError(error.message);
    }
}

export function processRawFilter(rows) {
    const dataRows = rows.slice(1);
    
    state.records = dataRows.map((row, index) => {
        const rawEstado = row[COLUMN_INDICES.estadoIntegracion];
        const rawFecha = (row[COLUMN_INDICES.fechaCorte] || '').trim();
        return {
            id: index + 1,
            op: (row[COLUMN_INDICES.op] || '').trim(),
            ref: (row[COLUMN_INDICES.ref] || '').trim(),
            undCort: parseNumber(row[COLUMN_INDICES.undCort]),
            fechaCorte: rawFecha,
            parsedFechaCorte: parseDateString(rawFecha),
            estadoIntegracion: normalizeIntegracion(rawEstado),
            bodegaDespacho: parseNumber(row[COLUMN_INDICES.bodegaDespacho]),
            descripcion: (row[COLUMN_INDICES.descripcion] || '').trim(),
            cuento: (row[COLUMN_INDICES.cuento] || '').trim(),
            genero: (row[COLUMN_INDICES.genero] || '').trim(),
            tipoTejido: (row[COLUMN_INDICES.tipoTejido] || '').trim(),
            pvp: (row[COLUMN_INDICES.pvp] || '').trim(),
            clase: (row[COLUMN_INDICES.clase] || '').trim()
        };
    }).filter(r => r.op || r.ref || r.undCort > 0);

    // Actualizar métricas del header
    const totalCort = state.records.reduce((acc, r) => acc + (r.undCort || 0), 0);
    const totalBodega = state.records.reduce((acc, r) => acc + (r.bodegaDespacho || 0), 0);

    if (DOM.statTotalRows) DOM.statTotalRows.textContent = state.records.length;
    if (DOM.statTotalCort) DOM.statTotalCort.textContent = totalCort.toLocaleString('es-CO');
    if (DOM.statTotalBodega) DOM.statTotalBodega.textContent = totalBodega.toLocaleString('es-CO');
}

export function processRawDespachos(rows) {
    if (!rows || rows.length <= 1) {
        state.despachosRecords = [];
        return;
    }

    const dataRows = rows.slice(1);
    state.despachosRecords = dataRows.map((row, i) => {
        const rawId = (row[COL_DESP.id] || (i + 1)).trim();
        const rawFecha = (row[COL_DESP.fecha] || '').trim();
        return {
            id: parseInt(rawId, 10) || (i + 1),
            rowNumber: i + 2,
            fecha: rawFecha,
            parsedDate: parseDateString(rawFecha),
            op: (row[COL_DESP.op] || '').trim(),
            ref: (row[COL_DESP.ref] || '').trim(),
            cantidad: parseNumber(row[COL_DESP.cantidad]),
            taller: (row[COL_DESP.taller] || '').trim(),
            isDespachado: String(row[COL_DESP.despachado] || '').trim().toUpperCase() === 'X',
            observacion: (row[COL_DESP.observacion] || '').trim(),
            fechaDespacho: (row[COL_DESP.fechaDespacho] || '').trim()
        };
    }).filter(r => r.op || r.ref || r.cantidad > 0);

    const pendingCount = state.despachosRecords.filter(r => !r.isDespachado).length;
    if (DOM.badgeCountPendientes) {
        DOM.badgeCountPendientes.textContent = pendingCount;
    }
}

export async function sendDispatchToGAS(payload) {
    const url = state.gasWebAppUrl || CONFIG.DEFAULT_GAS_URL;
    return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        mode: 'no-cors'
    });
}

export async function uploadDataToGAS(rows) {
    const url = state.gasWebAppUrl || CONFIG.DEFAULT_GAS_URL;
    return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
            action: 'uploadData',
            rows: rows
        }),
        mode: 'no-cors'
    });
}
