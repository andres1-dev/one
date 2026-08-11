/**
 * Exportador de Ingresos MP — Módulo Google Sheets v4 API
 * Carga de datos directa desde Google Sheets, vista previa interactiva,
 * buscador ultrarrápido y exportación a Excel sin restricciones de rango.
 */

const SHEETS_API_KEY = 'AIzaSyC9aOd5MicrxG2Bh_fDVKDaqfSA3_H0tmo';

// ID del Spreadsheet por defecto e ID/Nombre personalizable
let SPREADSHEET_ID = localStorage.getItem('exportador_sheet_id') || '1O67ydfwQCnW-J-xDwzkghTFUMX9KF4tqizKLCJrz9LM';
let SHEET_NAME = localStorage.getItem('exportador_sheet_name') || 'Ingresos';

const HEADERS = [
    "Documento","Fecha","Taller","Línea","Auditor","Escáner","Lote",
    "Ref. Prov.","Descripción","Cantidad","Referencia","Tipo","PVP",
    "Prenda","Género","Gestor","Proveedor","Clase","Fuente"
];

let allRows = [];
let currentPage = 1;
let pageSize = 30;

// ── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setPreset('month');
    setupEvents();
    loadData();
});

// ── Theme Toggle ─────────────────────────────────────────────────────────────
function initTheme() {
    const saved = localStorage.getItem('exportador_theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('exportador_theme', next);
    updateThemeIcon(next);
}

function updateThemeIcon(theme) {
    const icon = document.getElementById('theme-icon');
    if (!icon) return;
    icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}

// ── Sheet Config Modal ───────────────────────────────────────────────────────
function openSheetModal() {
    const modal = document.getElementById('sheet-modal');
    const inputId = document.getElementById('cfg-sheet-id');
    const inputName = document.getElementById('cfg-sheet-name');
    if (inputId) inputId.value = SPREADSHEET_ID;
    if (inputName) inputName.value = SHEET_NAME;
    if (modal) modal.classList.add('show');
}

function closeSheetModal() {
    document.getElementById('sheet-modal')?.classList.remove('show');
}

function saveSheetConfig(e) {
    e.preventDefault();
    const id = document.getElementById('cfg-sheet-id')?.value.trim();
    const name = document.getElementById('cfg-sheet-name')?.value.trim();
    if (!id || !name) return;

    SPREADSHEET_ID = id;
    SHEET_NAME = name;
    localStorage.setItem('exportador_sheet_id', id);
    localStorage.setItem('exportador_sheet_name', name);

    closeSheetModal();
    toast('Configuración guardada', `Spreadsheet: ${id.substring(0, 10)}... | Hoja: ${name}`, 'success');
    loadData();
}

// ── Load Data desde Google Sheets API v4 ─────────────────────────────────────
async function loadData() {
    const dot = document.getElementById('dot');
    const statusText = document.getElementById('status-text');
    const progressCount = document.getElementById('progress-count');
    const progressFill = document.getElementById('progress-fill');

    if (dot) dot.className = 'dot loading';
    if (statusText) statusText.textContent = 'Cargando registros desde Google Sheets...';
    if (progressCount) progressCount.textContent = 'Consultando...';
    if (progressFill) progressFill.style.width = '30%';

    allRows = [];

    const rangeParam = encodeURIComponent(SHEET_NAME) + '!A1:ZZ';
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${rangeParam}?key=${SHEETS_API_KEY}`;

    try {
        const res = await fetch(url);
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            if (res.status === 403) {
                throw new Error('Acceso denegado (403). Verifique que el documento de Google Sheets esté compartido como "Cualquier persona con el enlace puede ver".');
            } else if (res.status === 404) {
                throw new Error(`Hoja "${SHEET_NAME}" o Spreadsheet ID no encontrado (404).`);
            } else {
                throw new Error(errData.error?.message || `Error HTTP ${res.status}`);
            }
        }

        const data = await res.json();
        const values = data.values || [];

        if (values.length < 2) {
            if (dot) dot.className = 'dot ok';
            if (statusText) statusText.textContent = 'Hoja vacía o sin registros';
            if (progressCount) progressCount.textContent = '0 registros';
            if (progressFill) progressFill.style.width = '100%';
            renderTable();
            return;
        }

        // Fila 1 es la cabecera
        const headers = values[0].map(h => String(h || '').trim().toLowerCase());

        // Mapear filas a objetos JavaScript
        for (let i = 1; i < values.length; i++) {
            const rowValues = values[i];
            if (!rowValues || rowValues.length === 0) continue;

            const rowObj = {};
            headers.forEach((h, idx) => {
                rowObj[h] = rowValues[idx] !== undefined ? rowValues[idx] : '';
            });

            // Normalización de números y tipos
            if (rowObj.total !== undefined && rowObj.total !== '') rowObj.total = Number(rowObj.total) || rowObj.total;
            if (rowObj.cantidad !== undefined && rowObj.cantidad !== '') rowObj.cantidad = Number(rowObj.cantidad) || rowObj.cantidad;
            if (rowObj.pvp !== undefined && rowObj.pvp !== '') {
                const cleanedPvp = String(rowObj.pvp).replace(/[^0-9.-]+/g, '');
                if (cleanedPvp) rowObj.pvp = Number(cleanedPvp);
            }

            allRows.push(rowObj);
        }

        if (dot) dot.className = 'dot ok';
        if (statusText) statusText.textContent = `Listo (${allRows.length.toLocaleString('es-CO')} registros)`;
        if (progressCount) progressCount.textContent = `${allRows.length.toLocaleString('es-CO')} registros`;
        if (progressFill) progressFill.style.width = '100%';

        document.getElementById('btn-filtered').disabled = false;
        document.getElementById('btn-full').disabled = false;

        renderTable();
        toast('Datos cargados', `${allRows.length.toLocaleString('es-CO')} registros listos para filtrar o exportar.`, 'success');

    } catch (e) {
        console.error('[Google Sheets API]', e);
        if (dot) dot.className = 'dot error';
        if (statusText) statusText.textContent = 'Error de conexión a Sheets';
        if (progressFill) progressFill.style.width = '0%';
        toast('Error de Carga', e.message, 'warning');
        renderTable();
    }
}

// ── Event Listeners ──────────────────────────────────────────────────────────
function setupEvents() {
    const input = document.getElementById('search-input');
    const clearBtn = document.getElementById('search-clear');

    if (input && clearBtn) {
        input.addEventListener('input', () => {
            clearBtn.style.display = input.value.length > 0 ? 'flex' : 'none';
            currentPage = 1;
            renderTable();
        });
    }

    document.getElementById('date-from')?.addEventListener('change', () => {
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        currentPage = 1;
        renderTable();
    });

    document.getElementById('date-to')?.addEventListener('change', () => {
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        currentPage = 1;
        renderTable();
    });
}

function clearSearch() {
    const input = document.getElementById('search-input');
    if (input) input.value = '';
    const clearBtn = document.getElementById('search-clear');
    if (clearBtn) clearBtn.style.display = 'none';
    currentPage = 1;
    renderTable();
}

// ── Date Presets (Sin restricciones) ─────────────────────────────────────────
function setPreset(preset, evt) {
    const from = document.getElementById('date-from');
    const to = document.getElementById('date-to');
    if (!from || !to) return;

    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));

    const now = new Date();
    const fmt = d => {
        const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), dd = String(d.getDate()).padStart(2,'0');
        return `${y}-${m}-${dd}`;
    };

    switch (preset) {
        case 'today':
            from.value = to.value = fmt(now);
            document.getElementById('chip-today')?.classList.add('active');
            break;
        case 'week': {
            const f = new Date(now);
            f.setDate(now.getDate() - (now.getDay() || 7) + 1);
            from.value = fmt(f);
            to.value = fmt(now);
            document.getElementById('chip-week')?.classList.add('active');
            break;
        }
        case 'month':
            from.value = fmt(new Date(now.getFullYear(), now.getMonth(), 1));
            to.value = fmt(now);
            document.getElementById('chip-month')?.classList.add('active');
            break;
        case 'last': {
            const f = new Date(now.getFullYear(), now.getMonth()-1, 1);
            const l = new Date(now.getFullYear(), now.getMonth(), 0);
            from.value = fmt(f);
            to.value = fmt(l);
            document.getElementById('chip-last')?.classList.add('active');
            break;
        }
        case 'two-months': {
            const f = new Date(now.getFullYear(), now.getMonth()-1, 1);
            from.value = fmt(f);
            to.value = fmt(now);
            document.getElementById('chip-two-months')?.classList.add('active');
            break;
        }
        case 'all':
        default:
            from.value = '';
            to.value = '';
            document.getElementById('chip-all')?.classList.add('active');
            break;
    }

    currentPage = 1;
    renderTable();
}

// ── Filter Data ──────────────────────────────────────────────────────────────
function getFilteredRows() {
    let rows = allRows;

    // Date filter
    const from = document.getElementById('date-from')?.value;
    const to = document.getElementById('date-to')?.value;
    if (from || to) {
        rows = rows.filter(r => {
            const raw = r.fecha_traslado || r.created_at || r.fecha_ingreso || '';
            const f = typeof raw === 'string' ? raw.substring(0, 10) : '';
            if (from && f && f < from) return false;
            if (to && f && f > to) return false;
            return true;
        });
    }

    // Search filter (OP, Lote, Referencia, Ref Prov, Descripción, Taller)
    const q = (document.getElementById('search-input')?.value || '').trim().toLowerCase();
    if (q) {
        rows = rows.filter(r => {
            const doc = String(r.id_ingreso || r.documento || r.id || '').toLowerCase();
            const lote = String(r.lote || '').toLowerCase();
            const ref = String(r.referencia || '').toLowerCase();
            const refprov = String(r.refprov || r.ref_prov || '').toLowerCase();
            const desc = String(r.descripcion || '').toLowerCase();
            const taller = String(r.taller || '').toLowerCase();
            return doc.includes(q) || lote.includes(q) || ref.includes(q) || refprov.includes(q) || desc.includes(q) || taller.includes(q);
        });
    }

    return rows;
}

// ── Table Rendering & Pagination ─────────────────────────────────────────────
function renderTable() {
    const tbody = document.getElementById('table-body');
    const badge = document.getElementById('table-count-badge');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const pgInfo = document.getElementById('pg-info');
    if (!tbody) return;

    const filtered = getFilteredRows();
    const total = filtered.length;

    if (badge) {
        badge.textContent = `${total.toLocaleString('es-CO')} resultados`;
    }

    if (total === 0) {
        tbody.innerHTML = `<tr><td colspan="11" class="empty-cell">No se encontraron registros que coincidan con la búsqueda o fechas.</td></tr>`;
        if (pgInfo) pgInfo.textContent = `Pág 0 de 0`;
        if (btnPrev) btnPrev.disabled = true;
        if (btnNext) btnNext.disabled = true;
        return;
    }

    const totalPages = Math.ceil(total / pageSize) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, total);
    const slice = filtered.slice(start, end);

    let html = '';
    slice.forEach(r => {
        const doc = String(r.id_ingreso || r.documento || r.id || '-');
        const raw = r.fecha_traslado || r.created_at || r.fecha_ingreso || '';
        const fs = typeof raw === 'string' ? raw.substring(0,10) : '';
        let fd = fs;
        if (fs.includes('-')) { const p = fs.split('-'); if (p.length===3) fd = `${p[2]}/${p[1]}/${p[0]}`; }
        const qty = Number(r.total ?? r.cantidad) || 0;
        const lote = r.lote != null && r.lote !== '' ? r.lote : '-';

        html += `<tr>
            <td><strong>${escapeHtml(doc)}</strong></td>
            <td>${escapeHtml(fd || '-')}</td>
            <td>${escapeHtml(r.taller || '-')}</td>
            <td>${escapeHtml(r.linea || '-')}</td>
            <td>${escapeHtml(String(lote))}</td>
            <td>${escapeHtml(r.refprov || r.ref_prov || '-')}</td>
            <td>${escapeHtml(r.descripcion || '-')}</td>
            <td><strong>${qty.toLocaleString('es-CO')}</strong></td>
            <td>${escapeHtml(r.referencia || '-')}</td>
            <td>${escapeHtml(r.tipo || '-')}</td>
            <td>${escapeHtml(r.prenda || '-')}</td>
        </tr>`;
    });

    tbody.innerHTML = html;

    if (pgInfo) pgInfo.textContent = `Pág ${currentPage} de ${totalPages}`;
    if (btnPrev) btnPrev.disabled = currentPage <= 1;
    if (btnNext) btnNext.disabled = currentPage >= totalPages;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function changePage(delta) {
    currentPage += delta;
    renderTable();
}

function changePageSize(size) {
    pageSize = parseInt(size, 10) || 30;
    currentPage = 1;
    renderTable();
}

// ── Export Excel ─────────────────────────────────────────────────────────────
function exportExcel(filtered) {
    const data = filtered ? getFilteredRows() : allRows;
    if (!data.length) { toast('Sin datos', 'No hay registros para exportar.', 'warning'); return; }
    if (typeof XLSX === 'undefined') { toast('Error', 'SheetJS no cargado aún.', 'warning'); return; }

    toast('Generando Excel', `${data.length.toLocaleString('es-CO')} registros...`, 'info');

    setTimeout(() => {
        try {
            const matrix = [HEADERS];
            data.forEach(r => {
                const doc = String(r.id_ingreso || r.documento || r.id || '');
                const raw = r.fecha_traslado || r.created_at || r.fecha_ingreso || '';
                const fs = typeof raw === 'string' ? raw.substring(0,10) : '';
                let fd = fs;
                if (fs.includes('-')) { const p = fs.split('-'); if (p.length===3) fd = `${p[2]}/${p[1]}/${p[0]}`; }
                const qty = Number(r.total ?? r.cantidad) || 0;
                const lote = r.lote != null && r.lote !== '' ? (Number(r.lote) || r.lote) : '';
                const pvp = r.pvp != null && r.pvp !== '' ? (Number(r.pvp) || r.pvp) : '';

                matrix.push([
                    doc, fd, r.taller||'', r.linea||'', r.auditor||'', r.escaner||'',
                    lote, r.refprov||r.ref_prov||'', r.descripcion||'', qty,
                    r.referencia||'', r.tipo||'', pvp, r.prenda||'', r.genero||'',
                    r.gestor||'', r.proveedor||'', r.clase||'', r.fuente||'SISPRO'
                ]);
            });

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(matrix);
            ws['!cols'] = HEADERS.map((h,i) => {
                let mx = h.length;
                for (let r=1; r<Math.min(matrix.length,80); r++) {
                    const v = matrix[r][i];
                    if (v != null) mx = Math.max(mx, String(v).length);
                }
                return { wch: Math.min(mx+3, 50) };
            });
            XLSX.utils.book_append_sheet(wb, ws, 'Ingresos');

            const d = new Date().toISOString().substring(0,10);
            const name = `Ingresos_${filtered?'Filtrado':'Completo'}_${d}.xlsx`;
            XLSX.writeFile(wb, name);
            toast('Descargado', name, 'success');
        } catch (e) {
            console.error(e);
            toast('Error', 'Problema al generar el Excel.', 'warning');
        }
    }, 50);
}

// ── Toast ────────────────────────────────────────────────────────────────────
function toast(title, msg, type='info') {
    const c = document.getElementById('toast-container');
    if (!c) return;
    const icon = type==='success' ? 'fa-circle-check' : type==='warning' ? 'fa-triangle-exclamation' : 'fa-circle-info';
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<i class="fa-solid ${icon}"></i><span><strong>${title}</strong> ${msg}</span>`;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity='0'; t.style.transform='translateX(100%)'; t.style.transition='all .25s'; setTimeout(()=>t.remove(),250); }, 3000);
}
