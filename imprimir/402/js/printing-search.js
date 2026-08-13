// ============================================
// HELPERS INTERNOS
// ============================================

function print_showResult(html) {
    const el = document.getElementById('printResultContainer');
    if (el) el.innerHTML = html;
}

function print_showLoading(msg = 'Buscando...') {
    print_showResult(`<div class='loading-spinner-large'></div><p style='text-align:center'>${msg}</p>`);
}

function print_getInputIds() {
    const raw = (document.getElementById('printRecInput')?.value || '').trim();
    return raw.split(',').map(s => s.trim()).filter(Boolean);
}

// ============================================
// BUSCAR UN SOLO REC (principal)
// ============================================

async function print_buscarPorREC() {
    const ids = print_getInputIds();
    if (!ids.length) { print_showResult('<p>Ingrese un documento para buscar.</p>'); return; }

    // Si hay comas → lote
    if (ids.length > 1) { print_buscarLoteRECs(); return; }

    print_showLoading(`Buscando REC ${ids[0]}...`);

    try {
        const datos = await print_fetchByIds(ids);
        const resultado = datos.find(item => item.REC == ids[0]);

        if (resultado) {
            print_abrirPlantillaImpresion(resultado, { modo: 'completo', soloImpresionPrincipal: true });
            print_showResult(`
                <div style="color:var(--success);padding:1rem;border-radius:6px;border:1px solid var(--success);">
                    <p>Documento ${ids[0]} encontrado. Se abrió la plantilla de impresión.</p>
                    <p>Colaborador asignado: <strong>${resultado.COLABORADOR || 'Sin asignar'}</strong></p>
                </div>`);
        } else {
            print_showResult(`<div style="color:var(--warning);padding:1rem;"><p>No se encontró el documento ${ids[0]}.</p></div>`);
        }
    } catch (e) {
        print_showResult(`<div style="color:var(--error);padding:1rem;"><p>Error: ${e.message}</p></div>`);
    }
}

// ============================================
// OPCIONES DE IMPRESIÓN (un solo REC, selectivo)
// ============================================

async function print_mostrarOpcionesImpresion() {
    const ids = print_getInputIds();
    if (!ids.length) { print_showResult('<p>Ingrese un documento para buscar.</p>'); return; }

    if (ids.length > 1) {
        print_showResult(`<div style="color:var(--error);padding:1rem;border-radius:6px;">
            <p>Esta función solo funciona con un documento a la vez.</p></div>`);
        return;
    }

    print_showLoading(`Cargando REC ${ids[0]}...`);

    try {
        const datos    = await print_fetchByIds(ids);
        const resultado = datos.find(item => item.REC == ids[0]);

        if (!resultado) {
            print_showResult('<p>No se encontró el documento especificado.</p>'); return;
        }

        if (!resultado.COLABORADOR?.trim()) {
            print_showResult(`<div style="color:var(--error);padding:1rem;border-radius:6px;">
                <p><strong>No se puede imprimir:</strong> El documento ${ids[0]} no tiene colaborador asignado.</p></div>`);
            return;
        }

        let html = `
            <div class="editor-section" style="border:1px solid var(--border);border-radius:6px;padding:1rem;margin-top:1rem;">
                <div class="section-header" style="margin-bottom:1rem;padding-bottom:0.5rem;">
                    <h4 style="margin:0;">Opciones de impresión para REC${ids[0]}</h4>
                </div>
                <div class="section-content">
                    <div style="margin-bottom:1rem;">
                        <div class="btn-group" style="margin-bottom:1rem;display:flex;gap:0.5rem;">
                            <button onclick="print_seleccionarTodasOpciones(true)" class="btn-primary" style="padding:0.25rem 0.5rem;font-size:0.85rem;">
                                <i class="codicon codicon-check-all"></i> Seleccionar todo
                            </button>
                            <button onclick="print_seleccionarTodasOpciones(false)" class="btn-secondary" style="padding:0.25rem 0.5rem;font-size:0.85rem;">
                                <i class="codicon codicon-clear-all"></i> Deseleccionar todo
                            </button>
                        </div>
                        <label style="display:block;margin-bottom:0.5rem;font-weight:500;">Seleccione qué imprimir:</label>
                        <div style="display:flex;flex-direction:column;gap:0.5rem;">
                            <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;">
                                <input type="checkbox" id="impPrincipal" class="opcion-impresion"> Plantilla Principal
                            </label>`;

        if (resultado.DISTRIBUCION?.Clientes) {
            Object.keys(resultado.DISTRIBUCION.Clientes).forEach(cliente => {
                html += `
                            <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;">
                                <input type="checkbox" id="impCliente_${cliente.replace(/\s+/g,'_')}" class="opcion-impresion">
                                Cliente: ${cliente}
                            </label>`;
            });
        }

        html += `
                        </div>
                    </div>
                    <div class="btn-group" style="display:flex;gap:0.5rem;">
                        <button onclick="print_confirmarImpresionSelectiva('${ids[0]}')" class="btn-primary">
                            <i class="codicon codicon-print"></i> Imprimir Selección
                        </button>
                        <button onclick="document.getElementById('printResultContainer').innerHTML=''" class="btn-secondary">
                            <i class="codicon codicon-close"></i> Cancelar
                        </button>
                    </div>
                </div>
            </div>`;

        print_showResult(html);
    } catch (e) {
        print_showResult(`<div style="color:var(--error);padding:1rem;"><p>Error: ${e.message}</p></div>`);
    }
}

function print_seleccionarTodasOpciones(seleccionar) {
    document.querySelectorAll('.opcion-impresion').forEach(cb => cb.checked = seleccionar);
}

function print_confirmarImpresionSelectiva(recBuscado) {
    const resultado = window.printingDatosGlobales.find(item => item.REC == recBuscado);
    if (!resultado) return;

    const checkboxes = document.querySelectorAll('.opcion-impresion:checked');
    if (!checkboxes.length) { alert('Por favor seleccione al menos una opción para imprimir'); return; }

    const elementsToPrint = [];
    if (document.getElementById('impPrincipal')?.checked) {
        elementsToPrint.push({ datos: resultado, options: { modo: 'completo', soloImpresionPrincipal: true } });
    }

    if (resultado.DISTRIBUCION?.Clientes) {
        Object.keys(resultado.DISTRIBUCION.Clientes).forEach(cliente => {
            const cb = document.getElementById(`impCliente_${cliente.replace(/\s+/g,'_')}`);
            if (cb?.checked) elementsToPrint.push({ datos: resultado, options: { modo: 'cliente', clienteNombre: cliente } });
        });
    }

    if (elementsToPrint.length) print_imprimirLoteDocumentos(elementsToPrint, `Impresión Selectiva REC ${recBuscado}`);

    print_showResult(`<div style="color:var(--success);padding:1rem;border-radius:6px;border:1px solid var(--success);">
        <p>Documento ${recBuscado} - Impresión iniciada.</p></div>`);
}

// ============================================
// MÚLTIPLES RECs (solo principal)
// ============================================

function print_buscarMultiplesRECs() { print_buscarLoteRECs(); }

async function print_buscarLoteRECs() {
    const ids = print_getInputIds();
    if (!ids.length) { print_showResult('<p>Ingrese documentos para buscar.</p>'); return; }

    print_showLoading(`Cargando ${ids.length} documento(s)...`);

    try {
        const datos    = await print_fetchByIds(ids);
        const foundItems = [];
        const notFound   = [];

        ids.forEach(id => {
            const r = datos.find(item => item.REC == id);
            if (r) foundItems.push({ datos: r, options: { modo: 'completo', soloImpresionPrincipal: true } });
            else   notFound.push(id);
        });

        if (foundItems.length) print_imprimirLoteDocumentos(foundItems, 'Impresión Múltiple');

        print_showResult(`
            <div class="results-summary" style="padding:15px;border-left:4px solid var(--success);background:rgba(0,120,212,0.05);">
                <h4 style="margin:0 0 5px 0;">Resumen: Múltiples (Principales)</h4>
                <p style="color:var(--success);margin:0;">✅ ${foundItems.length} REC(s) procesados exitosamente.</p>
                ${notFound.length ? `<p style="color:var(--warning);margin:5px 0 0 0;font-size:11px;">⚠️ No encontrados: ${notFound.join(', ')}</p>` : ''}
            </div>`);
    } catch (e) {
        print_showResult(`<div style="color:var(--error);padding:1rem;"><p>Error: ${e.message}</p></div>`);
    }
}

// ============================================
// SOLO CLIENTES
// ============================================

async function print_imprimirSoloClientes() {
    const ids = print_getInputIds();
    if (!ids.length) { print_showResult('<p>Ingrese documentos para clientes.</p>'); return; }

    if (ids.length > 1) {
        print_showResult(`<div style="color:var(--error);padding:1rem;border-radius:6px;border:1px solid var(--error);">
            <p><strong>Solo Clientes</strong> solo funciona con un documento a la vez.</p></div>`);
        return;
    }

    print_showLoading(`Cargando clientes de REC ${ids[0]}...`);

    try {
        const datos     = await print_fetchByIds(ids);
        const resultado = datos.find(item => item.REC == ids[0]);
        const errores   = [];
        const itemsParaLote = [];

        if (!resultado) {
            errores.push(`❌ REC ${ids[0]}: No encontrado.`);
        } else if (!resultado.COLABORADOR?.trim()) {
            errores.push(`❌ REC ${ids[0]}: Falta Responsable.`);
        } else if (!resultado.DISTRIBUCION?.Clientes || !Object.keys(resultado.DISTRIBUCION.Clientes).length) {
            errores.push(`❌ REC ${ids[0]}: Sin clientes.`);
        } else {
            Object.keys(resultado.DISTRIBUCION.Clientes).forEach(cliente => {
                itemsParaLote.push({ datos: resultado, options: { modo: 'cliente', clienteNombre: cliente } });
            });
        }

        if (itemsParaLote.length) {
            print_imprimirLoteDocumentos(itemsParaLote, `Separación REC${ids[0]} — Clientes (${itemsParaLote.length})`);
            print_showResult(`
                <div class="results-summary" style="padding:15px;border-left:4px solid var(--success);background:rgba(46,204,113,0.05);">
                    <h4 style="margin:0 0 5px 0;">Resumen: Solo Clientes</h4>
                    <p style="color:var(--success);margin:0;">✅ ${itemsParaLote.length} etiquetas listas.</p>
                    ${errores.length ? `<div style="margin-top:5px;color:var(--error);font-size:11px;">${errores.join(' | ')}</div>` : ''}
                </div>`);
        } else {
            print_showResult(`<div style="color:var(--error);padding:1rem;">
                <p>No se pudieron generar plantillas de clientes.</p>
                <div style="font-size:11px;">${errores.join(' | ')}</div></div>`);
        }
    } catch (e) {
        print_showResult(`<div style="color:var(--error);padding:1rem;"><p>Error: ${e.message}</p></div>`);
    }
}

// ============================================
// UTILS
// ============================================

function limpiarInputImpresion() {
    const el = document.getElementById('printRecInput');
    if (el) el.value = '';
}

window.limpiarInputImpresion = limpiarInputImpresion;
