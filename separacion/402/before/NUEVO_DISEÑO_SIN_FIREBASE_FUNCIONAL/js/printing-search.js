function print_buscarPorREC() {
    let recBuscado = document.getElementById("printRecInput").value;
    if (!recBuscado) {
        document.getElementById("printResultContainer").innerHTML = "<p>Ingrese un documento para buscar.</p>";
        return;
    }

    // SI HAY COMAS, AHORA LA ACCIÓN PREDETERMINADA ES LOTE (DUPLEX)
    if (recBuscado.includes(',')) {
        print_buscarLoteRECs();
        return;
    }

    if (!window.printingDatosGlobales) {
        document.getElementById("printResultContainer").innerHTML = "<p>Datos no cargados. Por favor espere o recargue la página.</p>";
        return;
    }

    let resultado = window.printingDatosGlobales.find(item => item.REC == recBuscado);

    if (resultado) {
        // Abrir plantilla principal solamente (petición usuario)
        print_abrirPlantillaImpresion(resultado, {
            modo: 'completo',
            soloImpresionPrincipal: true
        });

        document.getElementById("printResultContainer").innerHTML = `
            <div style="color: var(--success); padding: 1rem; border-radius: 6px; border: 1px solid var(--success);">
                <p>Documento ${recBuscado} encontrado. Se abrió la plantilla de impresión.</p>
                <p>Colaborador asignado: <strong>${resultado.COLABORADOR || 'Sin asignar'}</strong></p>
            </div>
        `;
    } else {
        document.getElementById("printResultContainer").innerHTML = `<div style="color: var(--warning); padding: 1rem;"><p>No se encontró el documento ${recBuscado}.</p></div>`;
    }
}

function print_mostrarOpcionesImpresion() {
    let recBuscado = document.getElementById("printRecInput").value;
    if (!recBuscado) {
        document.getElementById("printResultContainer").innerHTML = "<p>Ingrese un documento para buscar.</p>";
        return;
    }

    if (recBuscado.includes(',')) {
        document.getElementById("printResultContainer").innerHTML = `
            <div style="color: var(--error); padding: 1rem; border-radius: 6px;">
                <p>Esta función solo funciona con un documento a la vez para selección manual.</p>
            </div>
        `;
        return;
    }

    if (!window.printingDatosGlobales) return;
    let resultado = window.printingDatosGlobales.find(item => item.REC == recBuscado);

    if (!resultado) {
        document.getElementById("printResultContainer").innerHTML = "<p>No se encontró el documento especificado.</p>";
        return;
    }

    if (!resultado.COLABORADOR || resultado.COLABORADOR.trim() === "") {
        document.getElementById("printResultContainer").innerHTML = `
            <div style="color: var(--error); padding: 1rem; border-radius: 6px;">
                <p><strong>No se puede imprimir:</strong> El documento ${recBuscado} no tiene colaborador/responsable asignado.</p>
            </div>
        `;
        return;
    }

    let html = `
        <div class="editor-section" style="border: 1px solid var(--border); border-radius: 6px; padding: 1rem; margin-top: 1rem;">
            <div class="section-header" style="margin-bottom: 1rem; padding-bottom: 0.5rem;">
                <h4 style="margin: 0;">Opciones de impresión para REC${recBuscado}</h4>
            </div>
            <div class="section-content">
                <div style="margin-bottom: 1rem;">
                    <div class="btn-group" style="margin-bottom: 1rem; display: flex; gap: 0.5rem;">
                        <button onclick="print_seleccionarTodasOpciones(true)" class="btn-primary" style="padding: 0.25rem 0.5rem; font-size: 0.85rem;">
                            <i class="codicon codicon-check-all"></i> Seleccionar todo
                        </button>
                        <button onclick="print_seleccionarTodasOpciones(false)" class="btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.85rem;">
                            <i class="codicon codicon-clear-all"></i> Deseleccionar todo
                        </button>
                    </div>
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Seleccione qué imprimir:</label>
                    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="checkbox" id="impPrincipal" class="opcion-impresion">
                            Plantilla Principal
                        </label>`;

    if (resultado.DISTRIBUCION && resultado.DISTRIBUCION.Clientes) {
        const clientes = Object.keys(resultado.DISTRIBUCION.Clientes);
        clientes.forEach(cliente => {
            html += `
                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="checkbox" id="impCliente_${cliente.replace(/\s+/g, '_')}" class="opcion-impresion">
                            Cliente: ${cliente}
                        </label>`;
        });
    }

    html += `
                    </div>
                </div>
                <div class="btn-group" style="display: flex; gap: 0.5rem;">
                    <button onclick="print_confirmarImpresionSelectiva('${recBuscado}')" class="btn-primary">
                        <i class="codicon codicon-print"></i> Imprimir Selección
                    </button>
                    <button onclick="document.getElementById('printResultContainer').innerHTML = ''" class="btn-secondary">
                        <i class="codicon codicon-close"></i> Cancelar
                    </button>
                </div>
            </div>
        </div>`;

    document.getElementById("printResultContainer").innerHTML = html;
}

function print_seleccionarTodasOpciones(seleccionar) {
    const checkboxes = document.querySelectorAll('.opcion-impresion');
    checkboxes.forEach(checkbox => {
        checkbox.checked = seleccionar;
    });
}

function print_confirmarImpresionSelectiva(recBuscado) {
    if (!window.printingDatosGlobales) return;
    const resultado = window.printingDatosGlobales.find(item => item.REC == recBuscado);
    if (!resultado) return;

    const checkboxes = document.querySelectorAll('.opcion-impresion:checked');
    if (checkboxes.length === 0) {
        alert("Por favor seleccione al menos una opción para imprimir");
        return;
    }

    const elementsToPrint = [];

    const impPrincipal = document.getElementById("impPrincipal").checked;
    if (impPrincipal) {
        elementsToPrint.push({
            datos: resultado,
            options: {
                modo: 'completo',
                soloImpresionPrincipal: true
            }
        });
    }

    if (resultado.DISTRIBUCION && resultado.DISTRIBUCION.Clientes) {
        const clientes = Object.keys(resultado.DISTRIBUCION.Clientes);
        clientes.forEach(cliente => {
            const checkbox = document.getElementById(`impCliente_${cliente.replace(/\s+/g, '_')}`);
            if (checkbox && checkbox.checked) {
                elementsToPrint.push({
                    datos: resultado,
                    options: { modo: 'cliente', clienteNombre: cliente }
                });
            }
        });
    }

    if (elementsToPrint.length > 0) {
        print_imprimirLoteDocumentos(elementsToPrint, `Impresión Selectiva REC ${recBuscado}`);
    }

    document.getElementById("printResultContainer").innerHTML = `
        <div style="color: var(--success); padding: 1rem; border-radius: 6px; border: 1px solid var(--success);">
            <p>Documento ${recBuscado} - Impresión iniciada.</p>
        </div>
    `;
}

function print_buscarMultiplesRECs() {
    print_buscarLoteRECs();
}

/**
 * Múltiples (Solo Principal) - Utiliza ahora la ventana unificada
 */
function print_buscarLoteRECs() {
    let recsInput = document.getElementById("printRecInput").value;
    if (!recsInput) {
        document.getElementById("printResultContainer").innerHTML = "<p>Ingrese documentos para buscar.</p>";
        return;
    }

    let recsArray = recsInput.split(',').map(rec => rec.trim()).filter(rec => rec !== '');
    if (recsArray.length === 0) return;
    if (!window.printingDatosGlobales) return;

    let foundItems = [];
    let notFound = [];

    recsArray.forEach(rec => {
        let resultado = window.printingDatosGlobales.find(item => item.REC == rec);
        if (resultado) {
            foundItems.push({ datos: resultado, options: { modo: 'completo', soloImpresionPrincipal: true } });
        } else {
            notFound.push(rec);
        }
    });

    if (foundItems.length > 0) {
        print_imprimirLoteDocumentos(foundItems, 'Impresión Múltiple');
    }

    let html = `
        <div class="results-summary" style="padding: 15px; border-left: 4px solid var(--success); background: rgba(0, 120, 212, 0.05);">
            <h4 style="margin: 0 0 5px 0;">Resumen: Múltiples (Principales)</h4>
            <p style="color: var(--success); margin: 0;">✅ ${foundItems.length} REC(s) procesados exitosamente.</p>
            ${notFound.length > 0 ? `<p style="color: var(--warning); margin: 5px 0 0 0; font-size: 11px;">⚠️ No encontrados: ${notFound.join(', ')}</p>` : ''}
        </div>
    `;
    document.getElementById("printResultContainer").innerHTML = html;
}

/**
 * Solo Clientes - Utiliza ahora la ventana unificada
 */
function print_imprimirSoloClientes() {
    let recsInput = document.getElementById("printRecInput").value;
    if (!recsInput) {
        document.getElementById("printResultContainer").innerHTML = "<p>Ingrese documentos para clientes.</p>";
        return;
    }

    if (!window.printingDatosGlobales) return;

    let recsArray = recsInput.split(',').map(rec => rec.trim()).filter(rec => rec !== '');
    if (recsArray.length === 0) return;

    // Solo Clientes solo funciona con UN solo documento
    if (recsArray.length > 1) {
        document.getElementById("printResultContainer").innerHTML = `
            <div style="color: var(--error); padding: 1rem; border-radius: 6px; border: 1px solid var(--error);">
                <p><strong>Solo Clientes</strong> solo funciona con un documento a la vez.<br>
                Ingrese un único REC para imprimir sus etiquetas de clientes.</p>
            </div>
        `;
        return;
    }

    let itemsParaLote = [];
    let errores = [];
    let clientesCount = 0;

    recsArray.forEach(rec => {
        let resultado = window.printingDatosGlobales.find(item => item.REC == rec);
        if (!resultado) {
            errores.push(`❌ REC ${rec}: No encontrado.`);
            return;
        }

        if (!resultado.COLABORADOR || resultado.COLABORADOR.trim() === "") {
            errores.push(`❌ REC ${rec}: Falta Responsable.`);
            return;
        }

        if (!resultado.DISTRIBUCION || !resultado.DISTRIBUCION.Clientes || Object.keys(resultado.DISTRIBUCION.Clientes).length === 0) {
            errores.push(`❌ REC ${rec}: Sin clientes.`);
            return;
        }

        const clientes = Object.keys(resultado.DISTRIBUCION.Clientes);
        clientes.forEach(cliente => {
            itemsParaLote.push({
                datos: resultado,
                options: { modo: 'cliente', clienteNombre: cliente }
            });
            clientesCount++;
        });
    });

    if (itemsParaLote.length > 0) {
        const tituloClientes = `Separación REC${recsArray[0]}`;
        print_imprimirLoteDocumentos(itemsParaLote, tituloClientes);
        
        let html = `
            <div class="results-summary" style="padding: 15px; border-left: 4px solid var(--success); background: rgba(46, 204, 113, 0.05);">
                <h4 style="margin: 0 0 5px 0;">Resumen: Solo Clientes</h4>
                <p style="color: var(--success); margin: 0;">✅ ${clientesCount} etiquetas generadas para ${recsArray.length - errores.length} documentos.</p>
                ${errores.length > 0 ? `<div style="margin-top: 5px; color: var(--error); font-size: 11px;">${errores.join(' | ')}</div>` : ''}
            </div>
        `;
        document.getElementById("printResultContainer").innerHTML = html;
    } else {
        document.getElementById("printResultContainer").innerHTML = `
            <div style="color: var(--error); padding: 1rem;">
                <p>No se pudieron generar plantillas de clientes.</p>
                <div style="font-size: 11px;">${errores.join(' | ')}</div>
            </div>
        `;
    }
}

/**
 * Puente de compatibilidad para documents-table.js
 * Recibe el objeto datosImpresion con { rec, clientes, responsable, ... }
 * y genera las plantillas de cliente usando el nuevo sistema.
 */
function imprimirSoloClientes(datosImpresion) {
    const rec = datosImpresion.rec;

    const pool = window.printingDatosGlobales && window.printingDatosGlobales.length > 0
        ? window.printingDatosGlobales
        : (window.datosGlobales && window.datosGlobales.length > 0 ? window.datosGlobales : []);

    const datos = pool.find(item => String(item.REC) === String(rec));

    if (!datos) {
        alert(`No se encontró el documento REC${rec} para imprimir.`);
        return;
    }

    const clientesObj = (datos.DISTRIBUCION && datos.DISTRIBUCION.Clientes &&
        Object.keys(datos.DISTRIBUCION.Clientes).length > 0)
        ? datos.DISTRIBUCION.Clientes
        : (datos.CLIENTES || {});

    const clientes = Object.keys(clientesObj);

    if (clientes.length === 0) {
        alert(`El documento REC${rec} no tiene clientes asignados.`);
        return;
    }

    const items = clientes.map(cliente => ({
        datos: datos,
        options: { modo: 'cliente', clienteNombre: cliente }
    }));

    print_imprimirLoteDocumentos(items, `Separación REC${rec}`);
}

window.imprimirSoloClientes = imprimirSoloClientes;

// Aliases para los botones del panel de filtros en index.html
window.buscarPorREC = print_buscarPorREC;
window.mostrarOpcionesImpresion = print_mostrarOpcionesImpresion;

/**
 * Sobreescribir imprimirSoloClientesDesdeTabla para evitar el bloqueo de popup
 * causado por llamadas async antes de window.open.
 * Esta versión es síncrona y llama directamente a print_imprimirLoteDocumentos.
 * 
 * IMPORTANTE: Se ejecuta en DOMContentLoaded para sobreescribir DESPUÉS de que
 * documents-table.js registre su versión.
 */
document.addEventListener('DOMContentLoaded', function() {
    window.imprimirSoloClientesDesdeTabla = function(rec) {
        const pool = window.printingDatosGlobales && window.printingDatosGlobales.length > 0
            ? window.printingDatosGlobales
            : (window.datosGlobales && window.datosGlobales.length > 0 ? window.datosGlobales : []);

        const datos = pool.find(item => String(item.REC) === String(rec));

        if (!datos) {
            Swal.fire({ icon: 'error', title: 'Error', text: `No se encontró REC${rec}`, timer: 2000, showConfirmButton: false });
            return;
        }

        const clientesObj = (datos.DISTRIBUCION && datos.DISTRIBUCION.Clientes &&
            Object.keys(datos.DISTRIBUCION.Clientes).length > 0)
            ? datos.DISTRIBUCION.Clientes
            : (datos.CLIENTES || {});

        const clientes = Object.keys(clientesObj);

        if (clientes.length === 0) {
            Swal.fire({ icon: 'warning', title: 'Sin clientes', text: `REC${rec} no tiene clientes asignados`, timer: 2000, showConfirmButton: false });
            return;
        }

        const items = clientes.map(cliente => ({
            datos: datos,
            options: { modo: 'cliente', clienteNombre: cliente }
        }));

        if (typeof print_imprimirLoteDocumentos !== 'function') {
            alert('Error: Función de impresión no disponible');
            return;
        }

        print_imprimirLoteDocumentos(items, `Separación REC${rec}`);
    };
});
