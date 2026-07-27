/**
 * Exportador de Ingresos MP — Módulo Independiente Minimalista
 * Carga de datos, vista previa interactiva, buscador ultrarrápido y exportación Excel.
 */

const SUPABASE_URL = 'https://iladaofarozipitwaeti.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlsYWRhb2Zhcm96aXBpdHdhZXRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NjYzMDksImV4cCI6MjA5MzA0MjMwOX0.4fyiibeZS10DCgov62d7tIFVzJHsklsBrbokAJ9ptK8';

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
    updateAuthUI();
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

// ── Auth Token ───────────────────────────────────────────────────────────────
function getToken() {
    const saved = localStorage.getItem('exportador_sb_token');
    if (saved) return saved;
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
                const s = JSON.parse(localStorage.getItem(k));
                if (s?.access_token) return s.access_token;
            }
        }
    } catch (_) {}
    return SUPABASE_ANON;
}

function updateAuthUI() {
    const el = document.getElementById('auth-label');
    const btn = document.getElementById('btn-auth');
    if (!el) return;
    const isAuth = getToken() !== SUPABASE_ANON;
    el.textContent = isAuth ? 'Conectado' : 'Autenticar';
    if (btn) btn.classList.toggle('active', isAuth);
}

// ── Load Data ────────────────────────────────────────────────────────────────
async function loadData() {
    const dot = document.getElementById('dot');
    const statusText = document.getElementById('status-text');
    const progressCount = document.getElementById('progress-count');
    const progressFill = document.getElementById('progress-fill');
    const rlsBanner = document.getElementById('rls-banner');

    dot.className = 'dot loading';
    statusText.textContent = 'Descargando...';
    rlsBanner.classList.remove('show');
    allRows = [];

    const token = getToken();
    const PAGE = 1000;
    let offset = 0, total = 0;

    try {
        while (true) {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/ingresos?select=*`, {
                headers: {
                    'apikey': SUPABASE_ANON,
                    'Authorization': `Bearer ${token}`,
                    'Range': `${offset}-${offset + PAGE - 1}`,
                    'Range-Unit': 'items'
                }
            });
            if (!res.ok) break;
            const rows = await res.json();
            if (!Array.isArray(rows)) break;
            allRows = allRows.concat(rows);
            total += rows.length;
            progressCount.textContent = `${total.toLocaleString('es-CO')} registros`;
            progressFill.style.width = `${Math.min(Math.round(total / 35000 * 100), 95)}%`;
            if (rows.length < PAGE) break;
            offset += PAGE;
        }

        if (total === 0 && token === SUPABASE_ANON) {
            dot.className = 'dot loading';
            statusText.textContent = 'Requiere autenticación';
            rlsBanner.classList.add('show');
            renderTable();
            return;
        }

        dot.className = 'dot ok';
        statusText.textContent = 'Listo';
        progressFill.style.width = '100%';
        document.getElementById('btn-filtered').disabled = false;
        document.getElementById('btn-full').disabled = false;

        renderTable();
        toast('Cargados', `${total.toLocaleString('es-CO')} registros disponibles.`, 'success');

    } catch (e) {
        console.error(e);
        dot.className = 'dot error';
        statusText.textContent = 'Error de conexión';
        toast('Error', 'No se pudo conectar a Supabase.', 'warning');
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

// ── Date Presets ─────────────────────────────────────────────────────────────
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
            from.value = fmt(f); to.value = fmt(now);
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
            from.value = fmt(f); to.value = fmt(l);
            document.getElementById('chip-last')?.classList.add('active');
            break;
        }
        case 'year':
            from.value = fmt(new Date(now.getFullYear(), 0, 1));
            to.value = fmt(now);
            document.getElementById('chip-year')?.classList.add('active');
            break;
        case 'all':
            from.value = ''; to.value = '';
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
        const pvp = r.pvp != null && r.pvp !== '' ? `$ ${Number(r.pvp).toLocaleString('es-CO')}` : '-';

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

    toast('Generando', `${data.length.toLocaleString('es-CO')} registros...`, 'info');

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
                const lote = r.lote != null && r.lote !== '' ? Number(r.lote) : '';
                const pvp = r.pvp != null && r.pvp !== '' ? Number(r.pvp) : '';

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

// ── Auth Modal ───────────────────────────────────────────────────────────────
function openAuthModal() { document.getElementById('auth-modal')?.classList.add('show'); }
function closeAuthModal() { document.getElementById('auth-modal')?.classList.remove('show'); }

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const pass = document.getElementById('auth-pass').value;
    const btn = document.getElementById('btn-submit-login');
    if (!email || !pass) return;

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Conectando...';

    try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_ANON, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: pass })
        });
        const d = await res.json();
        if (!res.ok || !d.access_token) throw new Error(d.msg || d.error_description || 'Credenciales inválidas');

        localStorage.setItem('exportador_sb_token', d.access_token);
        updateAuthUI();
        closeAuthModal();
        toast('Autenticado', 'Sesión iniciada correctamente.', 'success');
        loadData();
    } catch (err) {
        toast('Error', err.message, 'warning');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Entrar';
    }
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
