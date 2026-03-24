/**
 * SEPARACION/js/search.js
 * Adaptado de js/printing (Original) para el módulo de SEPARACION
 */

function buscarPorREC() {
    let recBuscado = document.getElementById("recInput").value;
    if (!recBuscado) {
        document.getElementById("resultado").innerHTML = "<p>Ingrese un documento para buscar.</p>";
        return;
    }

    // Si hay comas, acción predeterminada es lote (Duplex friendly)
    if (recBuscado.includes(',')) {
        buscarLoteRECs();
        return;
    }

    if (typeof datosGlobales === 'undefined') {
        document.getElementById("resultado").innerHTML = "<p>Datos no cargados. Por favor espere o recargue la página.</p>";
        return;
    }

    let resultado = datosGlobales.find(item => item.REC == recBuscado);

    if (resultado) {
        // Abrir lote de 1 (Garantiza consistencia con el diseño de lotes y soporte duplex)
        abrirPlantillaImpresion(resultado, {
            modo: 'completo',
            soloImpresionPrincipal: true
        });

        document.getElementById("resultado").innerHTML = `
            <div style="color: var(--secondary-dark); padding: 1rem; border-radius: var(--radius); border: 1px solid #ddd;">
                <p>Documento ${recBuscado} encontrado. Se abrió la plantilla principal.</p>
                <p>Responsable: <strong>${resultado.COLABORADOR || 'Sin asignar'}</strong></p>
                <button onclick="mostrarOpcionesImpresion()" class="btn-primary" style="margin-top: 10px;">Ver más opciones de impresión</button>
            </div>
        `;
    } else {
        document.getElementById("resultado").innerHTML = `<div style="color: var(--danger); padding: 1rem;"><p>No se encontró el documento ${recBuscado}.</p></div>`;
    }
}

function mostrarOpcionesImpresion() {
    let recBuscado = document.getElementById("recInput").value;
    if (!recBuscado) {
        document.getElementById("resultado").innerHTML = "<p>Ingrese un documento para buscar.</p>";
        return;
    }

    if (recBuscado.includes(',')) {
        document.getElementById("resultado").innerHTML = `<div style="color: var(--danger); padding: 1rem;"><p>Opción no disponible para búsqueda múltiple.</p></div>`;
        return;
    }

    let resultado = datosGlobales.find(item => item.REC == recBuscado);
    if (!resultado) return;

    if (!resultado.COLABORADOR || resultado.COLABORADOR.trim() === "") {
        document.getElementById("resultado").innerHTML = `
            <div style="color: var(--danger); padding: 1rem; border: 1px solid var(--danger); border-radius: var(--radius);">
                <p><strong>No se puede imprimir:</strong> El documento ${recBuscado} no tiene colaborador/responsable asignado.</p>
            </div>
        `;
        return;
    }

    let html = `
        <div class="editor-section" style="border: 1px solid #ddd; border-radius: 6px; padding: 1rem; margin-top: 1rem; background: #fff;">
            <h4 style="margin-top: 0;">Opciones de impresión para REC${recBuscado}</h4>
            <div style="margin-bottom: 1rem; display: flex; flex-direction: column; gap: 8px;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" id="impPrincipal" class="opcion-impresion" checked>
                    Plantilla Principal
                </label>`;

    if (resultado.DISTRIBUCION && resultado.DISTRIBUCION.Clientes) {
        const clientes = Object.keys(resultado.DISTRIBUCION.Clientes);
        clientes.forEach(cliente => {
            html += `
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" id="impCliente_${cliente.replace(/\s+/g, '_')}" class="opcion-impresion" checked>
                    Cliente: ${cliente}
                </label>`;
        });
    }

    html += `
            </div>
            <div style="display: flex; gap: 10px;">
                <button onclick="confirmarImpresionSelectiva('${recBuscado}')" class="btn-primary">Imprimir Selección</button>
                <button onclick="document.getElementById('resultado').innerHTML = ''" class="btn-secondary">Cerrar</button>
            </div>
        </div>`;

    document.getElementById("resultado").innerHTML = html;
}

function confirmarImpresionSelectiva(recBuscado) {
    const resultado = datosGlobales.find(item => item.REC == recBuscado);
    if (!resultado) return;

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
