// ============================================
// js/impresion-logger.js
// Logger mínimo autocontenido para el módulo
// independiente de impresión.
// ============================================

(function () {
    let logContainer = null;
    let logEntries   = [];
    const MAX_ENTRIES = 500;

    function initLogger() {
        if (logContainer) return;
        logContainer = document.createElement('div');
        logContainer.id = 'impLogContainer';
        Object.assign(logContainer.style, {
            position: 'fixed', bottom: '22px', right: '0',
            width: '360px', maxHeight: '260px',
            background: '#1e1e1e', border: '1px solid #444',
            borderRadius: '4px 0 0 0', overflowY: 'auto',
            fontFamily: 'Consolas, monospace', fontSize: '11px',
            zIndex: '9999', display: 'none'
        });
        document.body.appendChild(logContainer);
    }

    function colorOf(level) {
        return { info: '#3794ff', warn: '#ff8c00', error: '#f44747', success: '#0dbc79' }[level] || '#d4d4d4';
    }

    function write(level, module, message, extra) {
        initLogger();
        const ts  = new Date().toLocaleTimeString('es-CO', { hour12: false, fractionalSecondDigits: 2 });
        const text = `[${ts}] [${level.toUpperCase()}] [${module}] ${message}` + (extra ? ' ' + JSON.stringify(extra) : '');

        logEntries.push({ ts, level, module, message });
        if (logEntries.length > MAX_ENTRIES) logEntries.shift();

        const line = document.createElement('div');
        line.style.cssText = `padding:3px 8px;border-bottom:1px solid #333;color:${colorOf(level)};`;
        line.textContent   = text;
        logContainer.appendChild(line);
        logContainer.scrollTop = logContainer.scrollHeight;

        if (level === 'error') console.error(`[${module}]`, message, extra || '');
    }

    window.Logger = {
        info:    (m, msg, x) => write('info',    m, msg, x),
        warn:    (m, msg, x) => write('warn',    m, msg, x),
        error:   (m, msg, x) => write('error',   m, msg, x),
        success: (m, msg, x) => write('success', m, msg, x),
        toggle: () => {
            initLogger();
            logContainer.style.display = logContainer.style.display === 'none' ? 'block' : 'none';
        },
        clear: () => {
            logEntries = [];
            if (logContainer) logContainer.innerHTML = '';
        }
    };

    // Ctrl+Shift+L → toggle panel
    document.addEventListener('keydown', e => {
        if (e.ctrlKey && e.shiftKey && e.key === 'L') Logger.toggle();
    });
})();
