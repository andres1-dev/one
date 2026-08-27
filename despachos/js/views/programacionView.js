/**
 * View: Captura de Programación de Taller — Interfaz tipo Hoja de Cálculo Excel
 *
 * Mapeo Oficial de Columnas (Letras e Índices):
 *   A (0)  → OP
 *   B (1)  → REFERENCIA
 *   C (2)  → CANTIDAD
 *   E (4)  → SESGO
 *   G (6)  → MUESTRA
 *   H (7)  → TALLER
 *   M (12) → PRECIO
 *   V (21) → FACTURACION
 *   W (22) → LINEA
 */

import { DOM } from '../dom.js';
import { showToast } from '../utils.js';
import { asentarProgramacionToGAS } from '../api.js';

export const MAPPED_COLUMNS = [
    { key: 'op',          letter: 'A', defaultIdx: 0,  label: 'OP',          required: true,  color: '#4f46e5' },
    { key: 'ref',         letter: 'B', defaultIdx: 1,  label: 'REFERENCIA',  required: true,  color: '#0284c7' },
    { key: 'cantidad',    letter: 'C', defaultIdx: 2,  label: 'CANTIDAD',    required: false, color: '#059669' },
    { key: 'sesgo',       letter: 'E', defaultIdx: 4,  label: 'SESGO',       required: false, color: '#7c3aed' },
    { key: 'muestra',     letter: 'G', defaultIdx: 6,  label: 'MUESTRA',     required: false, color: '#db2777' },
    { key: 'taller',      letter: 'H', defaultIdx: 7,  label: 'TALLER',      required: false, color: '#ea580c' },
    { key: 'precio',      letter: 'M', defaultIdx: 12, label: 'PRECIO',      required: false, color: '#0d9488' },
    { key: 'facturacion', letter: 'V', defaultIdx: 21, label: 'FACTURACION', required: false, color: '#d97706' },
    { key: 'linea',       letter: 'W', defaultIdx: 22, label: 'LINEA',       required: false, color: '#9333ea' },
];

let rawHeaders = [];       // string[]
let rawGrid    = [];       // string[][] (filas x columnas)
let colMapping = {};       // columnIndex (int) -> key ('op', 'ref', etc.)

/* ─── 1. PARSERS INTELIGENTES (FILTRADO ESTRICTO DE FILAS) ───────────────── */

/**
 * Filtra filas candidatas asegurando que solo entren registros con OP válido
 * y descartando títulos superiores, encabezados repetidos y totales inferiores.
 */
function filterValidDataRows(rows) {
    return rows.filter(row => {
        if (!row || !row.length) return false;
        
        // 1. Debe tener al menos algún dato
        const nonBlank = row.filter(c => String(c).trim() !== '');
        if (nonBlank.length < 2) return false;

        // 2. Descartar filas de títulos superiores o de totales
        const fullText = row.join(' ').toLowerCase();
        if (fullText.includes('informaci') || fullText.includes('calculo de capacidad') || fullText.includes('cálculo')) {
            return false;
        }

        // 3. Verificar si contiene un OP numérico (3 a 6 dígitos) en las primeras columnas
        const col0 = String(row[0] || '').trim();
        const col1 = String(row[1] || '').trim();
        const col2 = String(row[2] || '').trim();

        const isOpInCol0 = /^\d{3,6}$/.test(col0);
        const isOpInCol1 = /^\d{3,6}$/.test(col1);
        const isOpInCol2 = /^\d{3,6}$/.test(col2);

        if (!isOpInCol0 && !isOpInCol1 && !isOpInCol2) {
            return false;
        }

        // 4. Descartar encabezados repetidos
        if (/^(n[ºo]|op|referen|cant|precio|total)/i.test(col0) && !isOpInCol0) {
            return false;
        }

        return true;
    });
}

/**
 * Parsea contenido HTML del portapapeles (Outlook, Gmail, Excel)
 */
function parseFromHTML(htmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const tables = doc.querySelectorAll('table');
    if (!tables.length) return null;

    let bestMatrix = [];
    tables.forEach(t => {
        const trs = Array.from(t.querySelectorAll('tr'));
        const matrix = trs.map(tr => {
            const cells = Array.from(tr.querySelectorAll('th, td'));
            return cells.map(c => (c.innerText || c.textContent || '').trim());
        }).filter(r => r.some(c => c !== ''));

        if (matrix.length > bestMatrix.length) {
            bestMatrix = matrix;
        }
    });

    if (bestMatrix.length < 2) return null;

    // Buscar la fila real de encabezados
    let headerIdx = -1;
    for (let i = 0; i < bestMatrix.length; i++) {
        const r = bestMatrix[i];
        if (r.some(c => /^(n[ºo]|op|referen|cant|erp|sesgo|muestra)/i.test(c))) {
            headerIdx = i;
            break;
        }
    }

    if (headerIdx >= 0) {
        rawHeaders = bestMatrix[headerIdx];
    } else {
        rawHeaders = bestMatrix[0].map((_, i) => `Columna ${i + 1}`);
    }

    const candidateRows = headerIdx >= 0 ? bestMatrix.slice(headerIdx + 1) : bestMatrix;
    rawGrid = filterValidDataRows(candidateRows);

    if (!rawGrid.length) return false;

    autoDetectMapping();
    return true;
}

/**
 * Parsea formato tabular TSV / CSV (tabs o punto y coma)
 */
function parseTabular(lines) {
    const splitLine = l => l.split(/\t|;/).map(c => c.trim());
    const matrix = lines.map(splitLine).filter(r => r.some(c => c !== ''));
    if (!matrix.length) return false;

    // Buscar la fila real de encabezados (ignorando títulos previos)
    let headerIdx = -1;
    for (let i = 0; i < matrix.length; i++) {
        const r = matrix[i];
        if (r.some(c => /^(n[ºo]\s*(de)?\s*op|referen|cant|precio\s*conf)/i.test(c))) {
            headerIdx = i;
            break;
        }
    }

    if (headerIdx >= 0) {
        rawHeaders = matrix[headerIdx];
    } else if (matrix[0].some(c => /^(n[ºo]|op|ref|cant|sesgo|muestra|taller)/i.test(c))) {
        rawHeaders = matrix[0];
        headerIdx = 0;
    } else {
        rawHeaders = matrix[0].map((_, i) => `Columna ${i + 1}`);
    }

    const candidateRows = headerIdx >= 0 ? matrix.slice(headerIdx + 1) : matrix;
    rawGrid = filterValidDataRows(candidateRows);

    if (!rawGrid.length) return false;

    autoDetectMapping();
    return true;
}

/**
 * Parsea formato vertical (un valor por línea copiado de correo sin formato)
 */
function parseVerticalSmart(lines) {
    const cleanLines = lines.map(l => l.trim()).filter(l => l !== '');
    if (!cleanLines.length) return false;

    // 1. Encontrar inicio de datos buscando primer OP numérico válido
    let firstOpIndex = -1;
    for (let i = 0; i < cleanLines.length; i++) {
        const val = cleanLines[i];
        if (/^\d{4,5}$/.test(val)) {
            const nextVal = cleanLines[i + 1] || '';
            if (/^[A-Z0-9]{5,8}$/i.test(nextVal) || /^\d{1,4}$/.test(cleanLines[i + 2] || '')) {
                firstOpIndex = i;
                break;
            }
        }
    }

    let dataStream = [];
    if (firstOpIndex >= 0) {
        dataStream = cleanLines.slice(firstOpIndex);
    } else {
        return false;
    }

    // 2. Agrupar registros por cada número de OP detectado
    const records = [];
    let currentRecord = [];

    for (let i = 0; i < dataStream.length; i++) {
        const item = dataStream[i];
        const nextItem = dataStream[i + 1] || '';
        const isOpStart = /^\d{4,5}$/.test(item) && (
            i === 0 || 
            /^[A-Z0-9]{5,8}$/i.test(nextItem) || 
            currentRecord.length >= 8
        );

        if (isOpStart && currentRecord.length > 0) {
            records.push(currentRecord);
            currentRecord = [];
        }
        currentRecord.push(item);
    }
    if (currentRecord.length > 0) records.push(currentRecord);

    if (!records.length) return false;

    // 3. Crear matriz con las 9 columnas exactas
    rawHeaders = ['OP', 'REFERENCIA', 'CANTIDAD', 'SESGO', 'MUESTRA', 'TALLER', 'PRECIO', 'FACTURACION', 'LINEA'];

    const mappedRecords = records.map(rec => {
        let op = '', ref = '', cant = '', sesgo = '', muestra = '', taller = '', precio = '', facturacion = '', linea = '';

        if (rec[0] && /^\d{4,5}$/.test(rec[0])) op = rec[0];
        if (rec[1]) ref = rec[1];
        if (rec[2] && /^\d+$/.test(rec[2])) cant = rec[2];

        // Buscar valores restantes por heurística
        for (let j = 3; j < rec.length; j++) {
            const val = rec[j];
            if (!sesgo && /sesgo/i.test(val)) {
                sesgo = val;
            } else if (!muestra && /^(SI|NO)$/i.test(val)) {
                muestra = val;
            } else if (!taller && /^[A-ZÁÉÍÓÚÑ\s]{10,}$/i.test(val) && !/^(MODA|DEPORTIVO|INTIMA|URBANO|BASICO)/i.test(val)) {
                taller = val;
            } else if (!precio && /^\d{3,5}$/.test(val) && parseInt(val, 10) >= 1000) {
                precio = val;
            } else if (!facturacion && (/^\d{1,2}-[a-z]{3}/i.test(val) || /^(PRUEBA|OFICIAL)$/i.test(val))) {
                facturacion = val;
            } else if (!linea && /^(MODA FRESCA|DEPORTIVO|INTIMA|URBANO|BASICO|MODA|EXTERIOR|INTERIOR|JUNIOR)/i.test(val)) {
                linea = val;
            }
        }

        return [op, ref, cant, sesgo, muestra, taller, precio, facturacion, linea];
    });

    rawGrid = filterValidDataRows(mappedRecords);

    // Mapeo 1:1 para este formato generado
    colMapping = {
        0: 'op',
        1: 'ref',
        2: 'cantidad',
        3: 'sesgo',
        4: 'muestra',
        5: 'taller',
        6: 'precio',
        7: 'facturacion',
        8: 'linea'
    };
    return true;
}

/* ─── 2. DETECCIÓN AUTOMÁTICA DE MAPEO DE COLUMNAS ───────────────────────── */

function autoDetectMapping() {
    colMapping = {};
    const usedKeys = new Set();

    // 1. Si la tabla viene con 15 o más columnas (estándar A..W), aplicar el mapa exacto por letra/índice
    if (rawHeaders.length >= 15 || rawGrid.some(r => r.length >= 15)) {
        MAPPED_COLUMNS.forEach(col => {
            colMapping[col.defaultIdx] = col.key;
            usedKeys.add(col.key);
        });
        return;
    }

    // 2. Coincidencia inteligente por texto de encabezado
    rawHeaders.forEach((hdr, colIdx) => {
        const h = String(hdr).toLowerCase().trim();
        for (const col of MAPPED_COLUMNS) {
            if (usedKeys.has(col.key)) continue;

            let match = false;
            if (col.key === 'op' && (h === 'op' || h.includes('op') || h.includes('nº'))) match = true;
            else if (col.key === 'ref' && (h.includes('ref') || h.includes('estilo'))) match = true;
            else if (col.key === 'cantidad' && (h.includes('cant') || h.includes('und'))) match = true;
            else if (col.key === 'sesgo' && h.includes('sesgo')) match = true;
            else if (col.key === 'muestra' && h.includes('muestra')) match = true;
            else if (col.key === 'taller' && (h.includes('taller') || h.includes('actual') || h.includes('resp') || h.includes('responsable'))) match = true;
            else if (col.key === 'precio' && (h.includes('precio') || h.includes('conf') || h.includes('vlr'))) match = true;
            else if (col.key === 'facturacion' && (h.includes('factur') || h.includes('compromiso') || h.includes('entrega') || h.includes('oficial') || h.includes('prueba'))) match = true;
            else if (col.key === 'linea' && (h.includes('linea') || h.includes('línea') || h.includes('clase'))) match = true;

            if (match) {
                colMapping[colIdx] = col.key;
                usedKeys.add(col.key);
                break;
            }
        }
    });

    // 3. Fallback por posición
    MAPPED_COLUMNS.forEach(col => {
        if (!usedKeys.has(col.key) && col.defaultIdx < rawHeaders.length) {
            colMapping[col.defaultIdx] = col.key;
            usedKeys.add(col.key);
        }
    });
}

/* ─── 3. RENDERIZADO DE LA HOJA EXCEL ───────────────────────────────────── */

export function renderExcelGrid() {
    const zone = document.getElementById('progExcelZone');
    if (!zone) return;

    if (!rawGrid.length) {
        zone.innerHTML = buildEmptyStateHtml();
        updateUIState(0);
        return;
    }

    const colLetter = i => {
        let s = '', n = i + 1;
        while (n > 0) { s = String.fromCharCode(64 + (n % 26 || 26)) + s; n = Math.floor((n - 1) / 26); }
        return s;
    };

    const maxCols = Math.max(rawHeaders.length, ...rawGrid.map(r => r.length));

    // Generar Selector de mapeo en cada encabezado
    let theadCells = `<th class="xls-corner-cell" title="Eliminar / Fila"></th>`;
    for (let c = 0; c < maxCols; c++) {
        const letter = colLetter(c);
        const headerName = rawHeaders[c] || `Columna ${c + 1}`;
        const mappedKey = colMapping[c] || '';

        const optionsHtml = [
            `<option value="">(Sin mapear)</option>`,
            ...MAPPED_COLUMNS.map(m =>
                `<option value="${m.key}" ${m.key === mappedKey ? 'selected' : ''}>[${m.letter}] ${m.label}${m.required ? ' *' : ''}</option>`
            )
        ].join('');

        theadCells += `
            <th class="xls-col-header ${mappedKey ? 'is-mapped' : ''}" data-col="${c}">
                <div class="xls-hdr-top">
                    <span class="xls-hdr-letter">${letter}</span>
                    <span class="xls-hdr-name" title="${headerName}">${headerName}</span>
                </div>
                <div class="xls-hdr-mapping">
                    <select class="xls-map-select" data-col="${c}" title="Asignar campo de destino">
                        ${optionsHtml}
                    </select>
                </div>
            </th>`;
    }

    // Generar Filas y Celdas Editables con Botón de Eliminar en el índice
    let tbodyRows = '';
    rawGrid.forEach((row, rIdx) => {
        let rowCells = `
            <td class="xls-row-num" title="Fila ${rIdx + 1}">
                <span class="xls-rn-text">${rIdx + 1}</span>
                <button class="btn-del-row" data-row="${rIdx}" title="Eliminar fila ${rIdx + 1}" aria-label="Eliminar fila">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </td>`;

        for (let c = 0; c < maxCols; c++) {
            const val = row[c] !== undefined ? String(row[c]) : '';
            const mappedKey = colMapping[c];
            const isMappedClass = mappedKey ? 'is-mapped-cell' : '';

            rowCells += `
                <td class="xls-cell ${isMappedClass}" 
                    contenteditable="true" 
                    data-row="${rIdx}" 
                    data-col="${c}" 
                    spellcheck="false">${escapeHtml(val)}</td>`;
        }
        tbodyRows += `<tr data-row="${rIdx}">${rowCells}</tr>`;
    });

    zone.innerHTML = `
        <div class="xls-sheet-container">
            <div class="xls-toolbar">
                <span class="xls-stat-badge">${rawGrid.length} filas</span>
                <span class="xls-stat-badge">${maxCols} columnas</span>
                <span class="xls-stat-mapped">${Object.keys(colMapping).length} de 9 mapeadas</span>
                <button id="btnProgAddRow" class="btn-ghost xls-tool-btn" title="Agregar fila al final">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    + Fila
                </button>
            </div>
            <div class="xls-grid-scroll">
                <table class="xls-table">
                    <thead><tr>${theadCells}</tr></thead>
                    <tbody>${tbodyRows}</tbody>
                </table>
            </div>
        </div>`;

    setupGridEvents(zone);
    updateUIState(rawGrid.length);
}

function buildEmptyStateHtml() {
    return `
        <div class="prog-paste-hint" id="progPasteZonePrompt">
            <!-- Marca de agua decorativa de fondo (100% visible) -->
            <div class="prog-watermark-bg" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                    <rect x="8" y="2" width="8" height="4" rx="1.5" ry="1.5"/>
                    <line x1="8" y1="11" x2="16" y2="11"/>
                    <line x1="8" y1="15" x2="16" y2="15"/>
                    <line x1="8" y1="19" x2="13" y2="19"/>
                </svg>
            </div>

            <!-- Contenido flotante transparente -->
            <div class="prog-hub-card">
                <div class="prog-hub-icon-wrap">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                        <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                        <path d="M12 11v6M9 14l3-3 3 3"/>
                    </svg>
                </div>
                
                <h3 class="prog-hub-title">Importar Programación de Taller</h3>
                <p class="prog-hub-subtitle">Copia la tabla desde tu correo o archivo y pégala aquí</p>

                <div class="prog-hub-actions">
                    <button id="btnTriggerPaste" class="btn-modal-primary prog-hub-paste-btn">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
                        Pegar del portapapeles
                    </button>
                    <span class="prog-hub-divider">o</span>
                    <kbd class="prog-hub-kbd">Ctrl + V</kbd>
                </div>

                <div class="prog-hub-cols-preview">
                    <span class="prog-hub-col-pill">OP</span>
                    <span class="prog-hub-col-pill">REFERENCIA</span>
                    <span class="prog-hub-col-pill">CANTIDAD</span>
                    <span class="prog-hub-col-pill">SESGO</span>
                    <span class="prog-hub-col-pill">MUESTRA</span>
                    <span class="prog-hub-col-pill">TALLER</span>
                    <span class="prog-hub-col-pill">PRECIO</span>
                    <span class="prog-hub-col-pill">FACTURACION</span>
                    <span class="prog-hub-col-pill">LINEA</span>
                </div>
            </div>
        </div>`;
}

function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ─── 4. EVENTOS Y EDICIÓN EN LA CUADRÍCULA ──────────────────────────────── */

function setupGridEvents(zone) {
    // Cambio en selector de mapeo de columnas
    zone.querySelectorAll('.xls-map-select').forEach(select => {
        select.addEventListener('change', e => {
            const colIdx = parseInt(e.target.dataset.col, 10);
            const val = e.target.value;
            if (val) {
                for (const [k, v] of Object.entries(colMapping)) {
                    if (v === val && parseInt(k, 10) !== colIdx) delete colMapping[k];
                }
                colMapping[colIdx] = val;
            } else {
                delete colMapping[colIdx];
            }
            renderExcelGrid();
        });
    });

    // Eliminar fila individual
    zone.querySelectorAll('.btn-del-row').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const r = parseInt(e.currentTarget.dataset.row, 10);
            if (!isNaN(r) && r >= 0 && r < rawGrid.length) {
                rawGrid.splice(r, 1);
                renderExcelGrid();
            }
        });
    });

    // Edición en vivo de celdas
    zone.querySelectorAll('.xls-cell').forEach(cell => {
        cell.addEventListener('input', e => {
            const r = parseInt(e.target.dataset.row, 10);
            const c = parseInt(e.target.dataset.col, 10);
            if (rawGrid[r]) {
                rawGrid[r][c] = e.target.innerText.trim();
            }
        });
    });

    // Agregar fila
    const btnAddRow = document.getElementById('btnProgAddRow');
    if (btnAddRow) {
        btnAddRow.addEventListener('click', () => {
            const numCols = Math.max(rawHeaders.length, 1);
            rawGrid.push(new Array(numCols).fill(''));
            renderExcelGrid();
        });
    }
}

function updateUIState(count) {
    const counter = document.getElementById('progRowCount');
    if (counter) counter.textContent = `${count} fila${count !== 1 ? 's' : ''}`;

    const hasData = count > 0;
    const btnSave = document.getElementById('btnProgSave');
    const btnJSON = document.getElementById('btnProgCopyJSON');
    const btnClear = document.getElementById('btnProgClear');
    const btnAsentar = document.getElementById('btnProgAsentar');

    if (btnSave) btnSave.disabled = !hasData;
    if (btnJSON) btnJSON.disabled = !hasData;
    if (btnClear) btnClear.disabled = !hasData;
    if (btnAsentar) btnAsentar.disabled = !hasData;
}

/* ─── 5. PROCESADOR DE ENTRADA CLIPBOARD ─────────────────────────────────── */

export function handleIncomingPaste(clipboardData) {
    if (!clipboardData) return;

    // 1. Intentar HTML primero (Gmail, Outlook, Excel Web)
    const html = clipboardData.getData('text/html');
    if (html && parseFromHTML(html)) {
        renderExcelGrid();
        return;
    }

    // 2. Intentar Texto plano
    const text = clipboardData.getData('text/plain') || '';
    if (!text.trim()) return;

    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;

    const isTabular = lines.some(l => l.includes('\t') || (l.match(/;/g) || []).length >= 2);
    if (isTabular) {
        if (parseTabular(lines)) {
            renderExcelGrid();
            return;
        }
    }

    if (parseVerticalSmart(lines)) {
        renderExcelGrid();
        return;
    }

    parseTabular(lines);
    renderExcelGrid();
}

/* ─── 6. EXPORTACIÓN Y ASENTAMIENTO ──────────────────────────────────────── */

function exportMappedRows() {
    const exportMap = [];
    MAPPED_COLUMNS.forEach(col => {
        const colIdx = Object.keys(colMapping).find(idx => colMapping[idx] === col.key);
        if (colIdx !== undefined) {
            exportMap.push({ key: col.key, label: col.label, colIdx: parseInt(colIdx, 10) });
        }
    });

    return rawGrid.map(row => {
        const obj = {};
        exportMap.forEach(m => {
            obj[m.label] = row[m.colIdx] !== undefined ? row[m.colIdx] : '';
        });
        return obj;
    });
}

function downloadCSV() {
    const data = exportMappedRows();
    if (!data.length) return;

    const headers = Object.keys(data[0]);
    const rows = data.map(r => headers.map(h => `"${String(r[h] || '').replace(/"/g, '""')}"`).join(';'));
    const csvContent = `\uFEFF${headers.join(';')}\n${rows.join('\n')}`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `programacion_taller_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function copyJSON() {
    const data = exportMappedRows();
    if (!data.length) return;

    navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(() => {
        const btn = document.getElementById('btnProgCopyJSON');
        if (btn) {
            const prev = btn.innerHTML;
            btn.innerHTML = 'Copiado';
            setTimeout(() => { btn.innerHTML = prev; }, 2000);
        }
    });
}

function clearData() {
    rawHeaders = [];
    rawGrid = [];
    colMapping = {};
    renderExcelGrid();
}

/* ─── MODAL ASENTAR PROGRAMACIÓN (CALENDARIO COMPACTO) ──────────── */

let calCurrentYear = new Date().getFullYear();
let calCurrentMonth = new Date().getMonth();
let selectedDateStr = new Date().toISOString().slice(0, 10);

const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function renderCalendar() {
    const label = document.getElementById('calCurrentMonthLabel');
    const grid = document.getElementById('calDaysGrid');
    const inputHidden = document.getElementById('inputAsentarProgDate');
    if (!grid) return;

    if (label) {
        label.textContent = `${MONTH_NAMES[calCurrentMonth]} ${calCurrentYear}`;
    }

    if (inputHidden) {
        inputHidden.value = selectedDateStr;
    }

    // Calcular días y posición de inicio
    const firstDayIndex = new Date(calCurrentYear, calCurrentMonth, 1).getDay();
    const startCol = (firstDayIndex + 6) % 7; // Lunes = 0 .. Domingo = 6
    const daysInMonth = new Date(calCurrentYear, calCurrentMonth + 1, 0).getDate();
    const todayStr = new Date().toISOString().slice(0, 10);

    let html = '';
    for (let i = 0; i < startCol; i++) {
        html += `<div class="cal-day-cell is-empty"></div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const dStr = `${calCurrentYear}-${String(calCurrentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isToday = dStr === todayStr;
        const isSelected = dStr === selectedDateStr;

        let classes = 'cal-day-cell';
        if (isToday) classes += ' is-today';
        if (isSelected) classes += ' is-selected';

        html += `<div class="${classes}" data-date="${dStr}">${d}</div>`;
    }

    grid.innerHTML = html;

    grid.querySelectorAll('.cal-day-cell:not(.is-empty)').forEach(cell => {
        cell.addEventListener('click', () => {
            selectedDateStr = cell.dataset.date;
            renderCalendar();
        });
    });
}

export function openAsentarModal() {
    if (!rawGrid.length) {
        showToast('Primero pega o ingresa datos para asentar.', 'error');
        return;
    }

    const today = new Date();
    selectedDateStr = today.toISOString().slice(0, 10);
    calCurrentYear = today.getFullYear();
    calCurrentMonth = today.getMonth();

    renderCalendar();

    if (DOM.asentarProgModal) {
        DOM.asentarProgModal.classList.remove('hidden');
    }
}

export function closeAsentarModal() {
    if (DOM.asentarProgModal) {
        DOM.asentarProgModal.classList.add('hidden');
    }
}

export async function submitAsentarModal() {
    const fechaProg = selectedDateStr || document.getElementById('inputAsentarProgDate')?.value;
    if (!fechaProg) {
        showToast('Por favor selecciona la fecha de programación.', 'error');
        return;
    }

    const rows = exportMappedRows();
    if (!rows.length) {
        showToast('No hay datos válidos para asentar.', 'error');
        return;
    }

    const btnSubmit = document.getElementById('btnSubmitAsentarProgModal');
    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<span>Asentando...</span>`;
    }

    try {
        await asentarProgramacionToGAS(rows, fechaProg, '');
        showToast(`Se asentaron ${rows.length} registros exitosamente en DESPACHOS_N.`, 'success');
        clearData();
        closeAsentarModal();
    } catch (err) {
        console.error('Error al asentar:', err);
        showToast('Error al conectar con Google Sheets.', 'error');
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = `<span>Asentar</span>`;
        }
    }
}

/* ─── 7. INICIALIZACIÓN ──────────────────────────────────────────────────── */

export function initProgramacionView() {
    const zone = document.getElementById('progExcelZone');
    if (!zone) return;

    document.addEventListener('paste', e => {
        const activeTab = document.querySelector('.nav-tab.active')?.dataset?.view;
        if (activeTab === 'programacion') {
            if (e.target.classList.contains('xls-cell')) return;
            e.preventDefault();
            handleIncomingPaste(e.clipboardData);
        }
    });

    zone.addEventListener('paste', e => {
        if (e.target.classList.contains('xls-cell')) return;
        e.preventDefault();
        handleIncomingPaste(e.clipboardData);
    });

    document.addEventListener('click', e => {
        if (e.target.closest('#btnTriggerPaste')) {
            navigator.clipboard.read().then(items => {
                for (const item of items) {
                    if (item.types.includes('text/html')) {
                        item.getType('text/html').then(blob => blob.text()).then(html => {
                            parseFromHTML(html);
                            renderExcelGrid();
                        });
                        return;
                    } else if (item.types.includes('text/plain')) {
                        item.getType('text/plain').then(blob => blob.text()).then(text => {
                            const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                            if (!parseTabular(lines)) parseVerticalSmart(lines);
                            renderExcelGrid();
                        });
                        return;
                    }
                }
            }).catch(() => {
                alert('Presiona Ctrl + V directamente en el recuadro para pegar.');
            });
        }
    });

    // Botones de acción
    document.getElementById('btnProgSave')?.addEventListener('click', downloadCSV);
    document.getElementById('btnProgCopyJSON')?.addEventListener('click', copyJSON);
    document.getElementById('btnProgClear')?.addEventListener('click', clearData);
    document.getElementById('btnProgAsentar')?.addEventListener('click', openAsentarModal);

    // Eventos del Modal Asentar (Calendario)
    DOM.btnCloseAsentarProgModal?.addEventListener('click', closeAsentarModal);
    document.getElementById('btnSubmitAsentarProgModal')?.addEventListener('click', submitAsentarModal);

    // Navegación de meses del calendario
    document.getElementById('btnCalPrevMonth')?.addEventListener('click', () => {
        calCurrentMonth--;
        if (calCurrentMonth < 0) {
            calCurrentMonth = 11;
            calCurrentYear--;
        }
        renderCalendar();
    });

    document.getElementById('btnCalNextMonth')?.addEventListener('click', () => {
        calCurrentMonth++;
        if (calCurrentMonth > 11) {
            calCurrentMonth = 0;
            calCurrentYear++;
        }
        renderCalendar();
    });

    renderExcelGrid();
}

