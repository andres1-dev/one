/**
 * SEPARACION/js/search.js
 * Lógica de búsqueda e integración con el sistema de impresión LOTE
 */

function buscarPorREC() {
    let recInput = document.getElementById("recInput");
    let recBuscado = recInput.value.trim();
    
    if (!recBuscado) {
        document.getElementById("resultado").innerHTML = "<p>Ingrese un documento para buscar.</p>";
        return;
    }

    // Lógica Multi-REC (Comas)
    if (recBuscado.includes(',')) {
        buscarMultiplesRECs(recBuscado);
        return;
    }

    let resultado = datosGlobales.find(item => item.REC == recBuscado);

    if (resultado) {
        // Validación de Responsable (Colaborador)
        if (!resultado.COLABORADOR || resultado.COLABORADOR.trim() === "") {
            document.getElementById("resultado").innerHTML = `
                <div style="color: var(--danger); padding: 1rem; border-radius: var(--radius);">
                    <p><strong>No se puede imprimir:</strong> El documento ${recBuscado} no tiene colaborador/responsable asignado.</p>
                </div>
            `;
            return;
        }

        // UNIFICADO: Preparamos la lista para LOTE (Main + Clientes)
        const listaLote = [];
        
        // 1. Plantilla Principal
        listaLote.push({ datos: resultado, options: { modo: 'completo' } });

        // 2. Plantillas de Clientes
        if (resultado.DISTRIBUCION && resultado.DISTRIBUCION.Clientes) {
            const clientes = Object.keys(resultado.DISTRIBUCION.Clientes);
            clientes.forEach(cliente => {
                listaLote.push({ 
                    datos: resultado, 
                    options: { modo: 'cliente', clienteNombre: cliente } 
                });
            });
        }

        // Disparamos la impresión unificada
        imprimirLoteDocumentos(listaLote);

        document.getElementById("resultado").innerHTML = `
            <div style="color: var(--secondary-dark); padding: 1rem; border-radius: var(--radius);">
                <p>REC ${recBuscado} procesado. Se han generado ${listaLote.length} etiquetas en una sola ventana.</p>
                <p>Responsable: <strong>${resultado.COLABORADOR}</strong></p>
            </div>
        `;
    } else {
        document.getElementById("resultado").innerHTML = "<p>No se encontró el documento especificado.</p>";
    }
}

function buscarMultiplesRECs(recsInput) {
    let recsArray = recsInput.split(',')
        .map(rec => rec.trim())
        .filter(rec => rec !== '');
    
    if (recsArray.length === 0) return;
    
    const listaLote = [];
    let encontrados = 0;
    let desaparecidos = [];

    recsArray.forEach(rec => {
        let resultado = datosGlobales.find(item => item.REC == rec);
        if (resultado) {
            // Para múltiples, imprimimos solo la principal (regla del proyecto principal)
            listaLote.push({ datos: resultado, options: { modo: 'completo', soloImpresionPrincipal: true } });
            encontrados++;
        } else {
            desaparecidos.push(rec);
        }
    });

    if (listaLote.length > 0) {
        imprimirLoteDocumentos(listaLote, 'Impresión Múltiple');
        
        let msg = `<div style="padding: 1rem;">
            <p>Se procesaron ${encontrados} documentos exitosamente.</p>`;
        if (desaparecidos.length > 0) {
            msg += `<p style="color: var(--danger);">No se encontraron: ${desaparecidos.join(', ')}</p>`;
        }
        msg += `</div>`;
        document.getElementById("resultado").innerHTML = msg;
    }
}

function imprimirSoloClientes() {
    let recBuscado = document.getElementById("recInput").value.trim();
    if (!recBuscado) {
        document.getElementById("resultado").innerHTML = "<p>Ingrese un documento para buscar.</p>";
        return;
    }

    // Solo Clientes: solo funciona con UN solo documento
    let recsArray = recBuscado.split(',').map(r => r.trim()).filter(r => r !== '');

    if (recsArray.length > 1) {
        document.getElementById("resultado").innerHTML = `
            <div style="color: var(--danger-color, #ef4444); padding: 1rem; border-radius: 6px; border: 1px solid currentColor;">
                <p><strong>Solo Clientes</strong> solo funciona con un documento a la vez.<br>
                Ingrese un único REC para imprimir sus etiquetas de clientes.</p>
            </div>
        `;
        return;
    }

    const recUnico = recsArray[0];

    const listaLote = [];
    let faltaResponsable = false;

    let resultado = datosGlobales.find(item => item.REC == recUnico);
    if (resultado) {
        if (!resultado.COLABORADOR || resultado.COLABORADOR.trim() === "") {
            faltaResponsable = true;
        } else if (resultado.DISTRIBUCION && resultado.DISTRIBUCION.Clientes) {
            const clientes = Object.keys(resultado.DISTRIBUCION.Clientes);
            clientes.forEach(cliente => {
                listaLote.push({ 
                    datos: resultado, 
                    options: { modo: 'cliente', clienteNombre: cliente } 
                });
            });
        }
    }

    if (faltaResponsable) {
        document.getElementById("resultado").innerHTML = `
            <div style="color: var(--danger); padding: 1rem;">
                <p>Error: Uno o más documentos no tienen Responsable asignado.</p>
            </div>
        `;
        return;
    }

    if (listaLote.length > 0) {
        imprimirLoteDocumentos(listaLote, `Separación REC${recUnico}`);
        document.getElementById("resultado").innerHTML = `
            <div style="color: var(--secondary-dark); padding: 1rem;">
                <p>Generadas ${listaLote.length} etiquetas de clientes en una sola ventana.</p>
            </div>
        `;
    } else {
        document.getElementById("resultado").innerHTML = "<p>No se encontraron clientes para procesar.</p>";
    }
}

// Mantenemos esta función para compatibilidad con la tabla si se requiere, pero ahora usa la lógica LOTE
function mostrarOpcionesImpresion() {
    let recBuscado = document.getElementById("recInput").value.trim();
    if (!recBuscado) return;

    let resultado = datosGlobales.find(item => item.REC == recBuscado);
    if (!resultado) return;

    if (!resultado.COLABORADOR || resultado.COLABORADOR.trim() === "") {
        document.getElementById("resultado").innerHTML = `<p style="color: red;">Falta Responsable.</p>`;
        return;
    }

    let html = `
        <div class="card" style="margin-top: 1rem;">
            <div class="card-header"><h3>Opciones REC${recBuscado}</h3></div>
            <div class="card-body">
                <div style="margin-bottom: 1rem;">
                    <label style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                        <input type="checkbox" id="impPrincipal" checked> Plantilla Principal
                    </label>`;

    if (resultado.DISTRIBUCION && resultado.DISTRIBUCION.Clientes) {
        const clientes = Object.keys(resultado.DISTRIBUCION.Clientes);
        clientes.forEach(cliente => {
            html += `
                <label style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.3rem;">
                    <input type="checkbox" class="chk-cliente" data-cliente="${cliente}" checked> Cliente: ${cliente}
                </label>`;
        });
    }

    html += `
                </div>
                <div class="btn-group">
                    <button onclick="confirmarImpresionSelectiva('${recBuscado}')" class="btn btn-primary">Imprimir Selección</button>
                    <button onclick="document.getElementById('resultado').innerHTML = ''" class="btn btn-secondary">Cerrar</button>
                </div>
            </div>
        </div>`;

    document.getElementById("resultado").innerHTML = html;
}

function confirmarImpresionSelectiva(recBuscado) {
    const resultado = datosGlobales.find(item => item.REC == recBuscado);
    if (!resultado) return;

    const listaLote = [];
    if (document.getElementById("impPrincipal").checked) {
        listaLote.push({ datos: resultado, options: { modo: 'completo' } });
    }

    const checks = document.querySelectorAll(".chk-cliente:checked");
    checks.forEach(chk => {
        listaLote.push({ 
            datos: resultado, 
            options: { modo: 'cliente', clienteNombre: chk.getAttribute('data-cliente') } 
        });
    });

    if (listaLote.length > 0) {
        imprimirLoteDocumentos(listaLote);
    }
}

// Listener para el Enter en el input de búsqueda
document.addEventListener('DOMContentLoaded', () => {
    const recInput = document.getElementById("recInput");
    if (recInput) {
        recInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                buscarPorREC();
            }
        });
    }
});
