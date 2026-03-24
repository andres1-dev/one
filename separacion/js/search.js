/**
 * SEPARACION/js/search.js
<<<<<<< HEAD
 * Adaptado de js/printing (Original) para el módulo de SEPARACION
=======
 * Lógica de búsqueda e integración con el sistema de impresión LOTE
>>>>>>> 0a0f9de9c414931de46b1d7eef89a5d62738615b
 */

function buscarPorREC() {
    let recInput = document.getElementById("recInput");
    let recBuscado = recInput.value.trim();
    
    if (!recBuscado) {
        document.getElementById("resultado").innerHTML = "<p>Ingrese un documento para buscar.</p>";
        return;
    }

<<<<<<< HEAD
    // Si hay comas, acción predeterminada es lote (Duplex friendly)
    if (recBuscado.includes(',')) {
        buscarLoteRECs();
        return;
    }

    if (typeof datosGlobales === 'undefined') {
        document.getElementById("resultado").innerHTML = "<p>Datos no cargados. Por favor espere o recargue la página.</p>";
=======
    // Lógica Multi-REC (Comas)
    if (recBuscado.includes(',')) {
        buscarMultiplesRECs(recBuscado);
>>>>>>> 0a0f9de9c414931de46b1d7eef89a5d62738615b
        return;
    }

    let resultado = datosGlobales.find(item => item.REC == recBuscado);

    if (resultado) {
<<<<<<< HEAD
        // Abrir lote de 1 (Garantiza consistencia con el diseño de lotes y soporte duplex)
        abrirPlantillaImpresion(resultado, {
            modo: 'completo',
            soloImpresionPrincipal: true
        });
=======
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
>>>>>>> 0a0f9de9c414931de46b1d7eef89a5d62738615b

        // Disparamos la impresión unificada
        imprimirLoteDocumentos(listaLote);

        document.getElementById("resultado").innerHTML = `
<<<<<<< HEAD
            <div style="color: var(--secondary-dark); padding: 1rem; border-radius: var(--radius); border: 1px solid #ddd;">
                <p>Documento ${recBuscado} encontrado. Se abrió la plantilla principal.</p>
                <p>Responsable: <strong>${resultado.COLABORADOR || 'Sin asignar'}</strong></p>
                <button onclick="mostrarOpcionesImpresion()" class="btn-primary" style="margin-top: 10px;">Ver más opciones de impresión</button>
=======
            <div style="color: var(--secondary-dark); padding: 1rem; border-radius: var(--radius);">
                <p>REC ${recBuscado} procesado. Se han generado ${listaLote.length} etiquetas en una sola ventana.</p>
                <p>Responsable: <strong>${resultado.COLABORADOR}</strong></p>
>>>>>>> 0a0f9de9c414931de46b1d7eef89a5d62738615b
            </div>
        `;
    } else {
        document.getElementById("resultado").innerHTML = `<div style="color: var(--danger); padding: 1rem;"><p>No se encontró el documento ${recBuscado}.</p></div>`;
    }
}

<<<<<<< HEAD
function mostrarOpcionesImpresion() {
    let recBuscado = document.getElementById("recInput").value;
=======
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
>>>>>>> 0a0f9de9c414931de46b1d7eef89a5d62738615b
    if (!recBuscado) {
        document.getElementById("resultado").innerHTML = "<p>Ingrese un documento para buscar.</p>";
        return;
    }

<<<<<<< HEAD
    if (recBuscado.includes(',')) {
        document.getElementById("resultado").innerHTML = `<div style="color: var(--danger); padding: 1rem;"><p>Opción no disponible para búsqueda múltiple.</p></div>`;
=======
    // Solo Clientes: solo funciona con UN solo documento
    let recsArray = recBuscado.split(',').map(r => r.trim()).filter(r => r !== '');

    if (recsArray.length > 1) {
        document.getElementById("resultado").innerHTML = `
            <div style="color: var(--danger-color, #ef4444); padding: 1rem; border-radius: 6px; border: 1px solid currentColor;">
                <p><strong>Solo Clientes</strong> solo funciona con un documento a la vez.<br>
                Ingrese un único REC para imprimir sus etiquetas de clientes.</p>
            </div>
        `;
>>>>>>> 0a0f9de9c414931de46b1d7eef89a5d62738615b
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
<<<<<<< HEAD
        document.getElementById("resultado").innerHTML = `
            <div style="color: var(--danger); padding: 1rem; border: 1px solid var(--danger); border-radius: var(--radius);">
                <p><strong>No se puede imprimir:</strong> El documento ${recBuscado} no tiene colaborador/responsable asignado.</p>
            </div>
        `;
=======
        document.getElementById("resultado").innerHTML = `<p style="color: red;">Falta Responsable.</p>`;
>>>>>>> 0a0f9de9c414931de46b1d7eef89a5d62738615b
        return;
    }

    let html = `
<<<<<<< HEAD
        <div class="editor-section" style="border: 1px solid #ddd; border-radius: 6px; padding: 1rem; margin-top: 1rem; background: #fff;">
            <h4 style="margin-top: 0;">Opciones de impresión para REC${recBuscado}</h4>
            <div style="margin-bottom: 1rem; display: flex; flex-direction: column; gap: 8px;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" id="impPrincipal" class="opcion-impresion" checked>
                    Plantilla Principal
                </label>`;
=======
        <div class="card" style="margin-top: 1rem;">
            <div class="card-header"><h3>Opciones REC${recBuscado}</h3></div>
            <div class="card-body">
                <div style="margin-bottom: 1rem;">
                    <label style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                        <input type="checkbox" id="impPrincipal" checked> Plantilla Principal
                    </label>`;
>>>>>>> 0a0f9de9c414931de46b1d7eef89a5d62738615b

    if (resultado.DISTRIBUCION && resultado.DISTRIBUCION.Clientes) {
        const clientes = Object.keys(resultado.DISTRIBUCION.Clientes);
        clientes.forEach(cliente => {
            html += `
<<<<<<< HEAD
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" id="impCliente_${cliente.replace(/\s+/g, '_')}" class="opcion-impresion" checked>
                    Cliente: ${cliente}
=======
                <label style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.3rem;">
                    <input type="checkbox" class="chk-cliente" data-cliente="${cliente}" checked> Cliente: ${cliente}
>>>>>>> 0a0f9de9c414931de46b1d7eef89a5d62738615b
                </label>`;
        });
    }

    html += `
<<<<<<< HEAD
            </div>
            <div style="display: flex; gap: 10px;">
                <button onclick="confirmarImpresionSelectiva('${recBuscado}')" class="btn-primary">Imprimir Selección</button>
                <button onclick="document.getElementById('resultado').innerHTML = ''" class="btn-secondary">Cerrar</button>
=======
                </div>
                <div class="btn-group">
                    <button onclick="confirmarImpresionSelectiva('${recBuscado}')" class="btn btn-primary">Imprimir Selección</button>
                    <button onclick="document.getElementById('resultado').innerHTML = ''" class="btn btn-secondary">Cerrar</button>
                </div>
>>>>>>> 0a0f9de9c414931de46b1d7eef89a5d62738615b
            </div>
        </div>`;

    document.getElementById("resultado").innerHTML = html;
}

function confirmarImpresionSelectiva(recBuscado) {
    const resultado = datosGlobales.find(item => item.REC == recBuscado);
    if (!resultado) return;

<<<<<<< HEAD
    const elementsToPrint = [];
    const impPrincipal = document.getElementById("impPrincipal").checked;
    
    if (impPrincipal) {
        elementsToPrint.push({ datos: resultado, options: { modo: 'completo', soloImpresionPrincipal: true } });
    }

    if (resultado.DISTRIBUCION && resultado.DISTRIBUCION.Clientes) {
        const clientes = Object.keys(resultado.DISTRIBUCION.Clientes);
        clientes.forEach(cliente => {
            const checkbox = document.getElementById(`impCliente_${cliente.replace(/\s+/g, '_')}`);
            if (checkbox && checkbox.checked) {
                elementsToPrint.push({ datos: resultado, options: { modo: 'cliente', clienteNombre: cliente } });
            }
        });
    }

    if (elementsToPrint.length > 0) {
        print_imprimirLoteDocumentos(elementsToPrint, `Selección REC ${recBuscado}`);
        document.getElementById("resultado").innerHTML = `<p style="color: var(--secondary-dark);">Impresión iniciada para ${elementsToPrint.length} etiquetas.</p>`;
    } else {
        alert("Seleccione al menos una opción.");
    }
}

function buscarLoteRECs() {
    let recsInput = document.getElementById("recInput").value;
    let recsArray = recsInput.split(',').map(r => r.trim()).filter(r => r !== '');
    if (recsArray.length === 0) return;

    let itemsParaLote = [];
    let noEncontrados = [];

    recsArray.forEach(rec => {
        let res = datosGlobales.find(item => item.REC == rec);
        if (res) itemsParaLote.push({ datos: res, options: { modo: 'completo', soloImpresionPrincipal: true } });
        else noEncontrados.push(rec);
    });

    if (itemsParaLote.length > 0) {
        print_imprimirLoteDocumentos(itemsParaLote, 'Impresión Múltiple Principales');
    }

    document.getElementById("resultado").innerHTML = `
        <div style="padding: 1rem; background: #f8f9fa; border-left: 4px solid var(--secondary-dark);">
            <p>✅ ${itemsParaLote.length} REC(s) procesados.</p>
            ${noEncontrados.length > 0 ? `<p style="color: var(--danger);">⚠️ No encontrados: ${noEncontrados.join(', ')}</p>` : ''}
        </div>
    `;
}

function imprimirSoloClientes(datosImpresion = null) {
    let resultado = null;
    let recBuscado = "";

    if (datosImpresion) {
        recBuscado = datosImpresion.rec || datosImpresion.REC;
        resultado = datosGlobales.find(item => item.REC == recBuscado);
    } else {
        recBuscado = document.getElementById("recInput").value;
        if (!recBuscado) {
            document.getElementById("resultado").innerHTML = "<p>Ingrese un documento.</p>";
            return;
        }
        resultado = datosGlobales.find(item => item.REC == recBuscado);
    }

    if (resultado) {
        if (!resultado.DISTRIBUCION || !resultado.DISTRIBUCION.Clientes || Object.keys(resultado.DISTRIBUCION.Clientes).length === 0) {
            const msg = `El documento ${recBuscado} no tiene clientes asignados.`;
            if (datosImpresion) alert(msg); else document.getElementById("resultado").innerHTML = `<p style="color: var(--danger);">${msg}</p>`;
            return;
        }

        let itemsParaLote = [];
        const clientes = Object.keys(resultado.DISTRIBUCION.Clientes);
        clientes.forEach(cliente => {
            itemsParaLote.push({ datos: resultado, options: { modo: 'cliente', clienteNombre: cliente } });
        });

        print_imprimirLoteDocumentos(itemsParaLote, `Etiquetas Clientes REC${recBuscado}`);
        if (!datosImpresion) {
            document.getElementById("resultado").innerHTML = `<p style="color: var(--secondary-dark);">Impresión manual para ${clientes.length} clientes iniciada.</p>`;
        }
    } else {
        if (datosImpresion) alert("Documento no encontrado"); else document.getElementById("resultado").innerHTML = "<p>Documento no encontrado.</p>";
    }
}
=======
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
>>>>>>> 0a0f9de9c414931de46b1d7eef89a5d62738615b
