// ============================================
// js/impresion-init.js
// Inicialización de la página — compatible con
// el diseño 2026 (nuevas clases CSS).
// ============================================

(function () {
    'use strict';

    // ─── REFS ────────────────────────────────
    const dotEl       = () => document.getElementById('statusDot');
    const msgEl       = () => document.getElementById('statusMsg');
    const loaderEl    = () => document.getElementById('printLoader');
    const loaderMsgEl = () => document.getElementById('loaderMsg');
    const cacheEl     = () => document.getElementById('cacheStatus');
    const cacheLabelEl= () => document.getElementById('cacheLabel');

    // ─── STATUS ──────────────────────────────
    function setStatus(msg, state = 'idle') {
        // state: 'idle' | 'loading' | 'success' | 'error'
        const dot = dotEl();
        const txt = msgEl();
        if (txt) txt.textContent = msg;
        if (dot) {
            dot.className = 'status-dot';
            if (state === 'loading') dot.classList.add('loading');
            if (state === 'error')   dot.classList.add('error');
            // 'idle' e 'success' quedan verde (default)
        }
    }

    // Exponer globalmente
    window.impSetStatus = setStatus;

    // ─── LOADER ──────────────────────────────
    function showLoader(msg = 'Cargando…') {
        const el = loaderEl();
        const lm = loaderMsgEl();
        if (el) el.classList.add('visible');
        if (lm) lm.textContent = msg;
        setStatus(msg, 'loading');
    }

    function hideLoader() {
        const el = loaderEl();
        if (el) el.classList.remove('visible');
        setStatus('Listo', 'idle');
    }

    window.impShowLoader = showLoader;
    window.impHideLoader = hideLoader;

    // ─── DESLOGUEO (LOGOUT) ──────────────────
    function doLogout() {
        if (confirm('¿Desea cerrar la sesión del módulo de impresión?')) {
            sessionStorage.clear();
            window.location.replace('login.html');
        }
    }
    window.doLogout = doLogout;

    // ─── USUARIO ─────────────────────────────
    function mostrarUsuario() {
        try {
            const raw  = sessionStorage.getItem('supabase_user');
            const user = raw ? JSON.parse(raw) : null;
            const label = document.getElementById('userLabel');
            if (!label || !user) return;
            const nombre = user.user_metadata?.nombre
                || user.email?.split('@')[0]
                || user.email
                || 'Usuario';
            // Capitalizar primera letra
            label.textContent = nombre.charAt(0).toUpperCase() + nombre.slice(1);
        } catch (_) {}
    }

// ─── CACHE STATUS ────────────────────────
    function watchCache() {
        const id = setInterval(() => {
            if (window.printingClientesCache) {
                const n = Object.keys(window.printingClientesCache).length;
                const el = cacheEl();
                const lb = cacheLabelEl();
                if (el)  el.style.display = 'flex';
                if (lb)  lb.textContent   = `${n} clientes en caché`;
                setStatus('Módulo listo', 'idle');
                clearInterval(id);
            }
        }, 400);
    }

    // ─── DESHABILITAR BOTONES DURANTE BÚSQUEDA ──
    function lockUI(lock) {
        ['btnBuscar', 'btnMultiples', 'btnClientes', 'btnSeleccionar'].forEach(id => {
            const b = document.getElementById(id);
            if (b) {
                b.disabled = lock;
                b.style.opacity = lock ? '0.5' : '';
                b.style.pointerEvents = lock ? 'none' : '';
            }
        });
        const input = document.getElementById('printRecInput');
        if (input) input.disabled = lock;
    }

    // ─── WRAPPERS CON FEEDBACK VISUAL ────────
    const _orig_buscar  = window.print_buscarPorREC;
    const _orig_lote    = window.print_buscarLoteRECs;
    const _orig_cli     = window.print_imprimirSoloClientes;
    const _orig_opts    = window.print_mostrarOpcionesImpresion;

    async function withFeedback(fn, label) {
        lockUI(true);
        showLoader(label);
        try { 
            await fn(); 
        } catch (e) {
            console.error(e);
        } finally { 
            lockUI(false); 
            hideLoader(); 
        }
    }

    if (typeof _orig_buscar === 'function') {
        window.print_buscarPorREC = () => withFeedback(_orig_buscar, 'Buscando REC…');
    }
    if (typeof _orig_lote === 'function') {
        window.print_buscarLoteRECs = () => withFeedback(_orig_lote, 'Procesando lote…');
    }
    if (typeof _orig_cli === 'function') {
        window.print_imprimirSoloClientes = () => withFeedback(_orig_cli, 'Cargando clientes…');
    }
    if (typeof _orig_opts === 'function') {
        window.print_mostrarOpcionesImpresion = () => withFeedback(_orig_opts, 'Cargando opciones…');
    }

    // ─── PATCH: inyectar clases nuevas en resultados ──
    const _orig_showResult = window.print_showResult;
    if (typeof _orig_showResult === 'function') {
        window.print_showResult = function(html) {
            html = html
                .replace(/style="color:var\(--success\)[^"]*"/g,
                    'class="result-success"><span class="result-icon"><i class="fa-solid fa-circle-check"></i></span><div')
                .replace(/style="color:var\(--error\)[^"]*"/g,
                    'class="result-error"><span class="result-icon"><i class="fa-solid fa-circle-xmark"></i></span><div')
                .replace(/style="color:var\(--warning\)[^"]*"/g,
                    'class="result-warning"><span class="result-icon"><i class="fa-solid fa-triangle-exclamation"></i></span><div');
            _orig_showResult(html);
            setStatus('Listo', 'idle');
        };
    }

    // ─── EFECTO DE PARTÍCULAS DINÁMICAS ──────
    function initParticles() {
        const canvas = document.getElementById('particlesCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let width = (canvas.width = window.innerWidth);
        let height = (canvas.height = window.innerHeight);

        window.addEventListener('resize', () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        });

        const particles = [];
        const count = 55;

        for (let i = 0; i < count; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                radius: Math.random() * 2.2 + 0.8,
                vx: (Math.random() - 0.5) * 0.35,
                vy: (Math.random() - 0.5) * 0.35,
                alpha: Math.random() * 0.45 + 0.15
            });
        }

        function animate() {
            ctx.clearRect(0, 0, width, height);
            const particleColor = '37, 99, 235';

            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;

                if (p.x < 0) p.x = width;
                if (p.x > width) p.x = 0;
                if (p.y < 0) p.y = height;
                if (p.y > height) p.y = 0;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${particleColor}, ${p.alpha})`;
                ctx.fill();
            });

            requestAnimationFrame(animate);
        }

        animate();
    }

    // ─── ARRANQUE ────────────────────────────
    mostrarUsuario();
    initParticles();
    setStatus('Iniciando módulo…', 'loading');

    if (typeof initPrintingModule === 'function') {
        initPrintingModule();
    } else {
        setStatus('Error al cargar el módulo', 'error');
        Logger.error('impresion-init', 'initPrintingModule no disponible');
    }

    watchCache();

    Logger.success('impresion-init', 'Módulo de impresión (2026) listo');
})();
