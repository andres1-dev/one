function buscarPorREC() {
    let recBuscado = document.getElementById("recInput").value;
    if (!recBuscado) {
        document.getElementById("resultado").innerHTML = "<p>Ingrese un documento para buscar.</p>";
        return;
    }

    // Verificar si es una búsqueda múltiple
    if (recBuscado.includes(',')) {
        buscarMultiplesRECs();
        return;
    }

    let resultado = datosGlobales.find(item => item.REC == recBuscado);

    if (resultado) {
        // Verificar si tiene colaborador asignado
        if (!resultado.COLABORADOR || resultado.COLABORADOR.trim() === "") {
            document.getElementById("resultado").innerHTML = `
                <div style="color: var(--danger); padding: 1rem; border-radius: var(--radius);">
                    <p><strong>No se puede imprimir:</strong> El documento ${recBuscado} no tiene colaborador/responsable asignado.</p>
                    <p>Por favor, asigne un colaborador en la hoja DATA antes de imprimir.</p>
                </div>
            `;
            return;
        }

        // Abrir plantilla completa con todas las sub-plantillas
        abrirPlantillaImpresion(resultado);

        // Para cada cliente, abrir su plantilla individual
        if (resultado.DISTRIBUCION && resultado.DISTRIBUCION.Clientes) {
            const clientes = Object.keys(resultado.DISTRIBUCION.Clientes);
            clientes.forEach(cliente => {
                abrirPlantillaImpresion(resultado, { 
                    modo: 'cliente', 
                    clienteNombre: cliente 
                });
            });
        }

        document.getElementById("resultado").innerHTML = `
            <div style="color: var(--secondary-dark); padding: 1rem; border-radius: var(--radius);">
                <p>Documento ${recBuscado} encontrado. Se abrió la plantilla de impresión.</p>
                <p>Colaborador asignado: <strong>${resultado.COLABORADOR}</strong></p>
            </div>
        `;
    } else {
        document.getElementById("resultado").innerHTML = "<p>No se encontró el documento especificado.</p>";
    }
}






function mostrarOpcionesImpresion() {
    let recBuscado = document.getElementById("recInput").value;
    if (!recBuscado) {
        document.getElementById("resultado").innerHTML = "<p>Ingrese un documento para buscar.</p>";
        return;
    }

    if (recBuscado.includes(',')) {
        document.getElementById("resultado").innerHTML = `
            <div style="color: var(--danger); padding: 1rem; border-radius: var(--radius);">
                <p>Esta función solo funciona con un documento a la vez.</p>
            </div>
        `;
        return;
    }

    let resultado = datosGlobales.find(item => item.REC == recBuscado);

    if (!resultado) {
        document.getElementById("resultado").innerHTML = "<p>No se encontró el documento especificado.</p>";
        return;
    }

    if (!resultado.COLABORADOR || resultado.COLABORADOR.trim() === "") {
        document.getElementById("resultado").innerHTML = `
            <div style="color: var(--danger); padding: 1rem; border-radius: var(--radius);">
                <p><strong>No se puede imprimir:</strong> El documento ${recBuscado} no tiene colaborador/responsable asignado.</p>
            </div>
        `;
        return;
    }

    // Crear interfaz de selección mejorada
    let html = `
        <div class="card" style="margin-top: 1rem;">
            <div class="card-header">
                <h3>Opciones de impresión para REC${recBuscado}</h3>
            </div>
            <div class="card-body">
                <div style="margin-bottom: 1rem;">
                    <div class="btn-group" style="margin-bottom: 1rem;">
                        <button onclick="seleccionarTodasOpciones(true)" class="btn btn-primary" style="padding: 0.5rem 1rem; font-size: 0.85rem;">
                            <i class="fas fa-check-circle btn-icon"></i> Seleccionar todo
                        </button>
                        <button onclick="seleccionarTodasOpciones(false)" class="btn btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.85rem;">
                            <i class="fas fa-times-circle btn-icon"></i> Deseleccionar todo
                        </button>
                    </div>
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Seleccione qué imprimir:</label>
                    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                        <label style="display: flex; align-items: center; gap: 0.5rem;">
                            <input type="checkbox" id="impPrincipal" class="opcion-impresion">
                            Plantilla Principal
                        </label>`;

    // Agregar opciones para cada cliente si existen
    if (resultado.DISTRIBUCION && resultado.DISTRIBUCION.Clientes) {
        const clientes = Object.keys(resultado.DISTRIBUCION.Clientes);
        clientes.forEach(cliente => {
            html += `
                        <label style="display: flex; align-items: center; gap: 0.5rem;">
                            <input type="checkbox" id="impCliente_${cliente.replace(/\s+/g, '_')}" class="opcion-impresion">
                            Cliente: ${cliente}
                        </label>`;
        });
    }

    html += `
                    </div>
                </div>
                <div class="btn-group">
                    <button onclick="confirmarImpresionSelectiva('${recBuscado}')" class="btn btn-primary">
                        <i class="fas fa-print btn-icon"></i> Imprimir Selección
                    </button>
                    <button onclick="document.getElementById('resultado').innerHTML = ''" class="btn btn-secondary">
                        <i class="fas fa-times btn-icon"></i> Cancelar
                    </button>
                </div>
            </div>
        </div>`;

    document.getElementById("resultado").innerHTML = html;
}

// Nueva función para seleccionar/deseleccionar todas las opciones
function seleccionarTodasOpciones(seleccionar) {
    const checkboxes = document.querySelectorAll('.opcion-impresion');
    checkboxes.forEach(checkbox => {
        checkbox.checked = seleccionar;
    });
}

function confirmarImpresionSelectiva(recBuscado) {
    const resultado = datosGlobales.find(item => item.REC == recBuscado);
    if (!resultado) return;

    // Verificar si al menos una opción está seleccionada
    const checkboxes = document.querySelectorAll('.opcion-impresion:checked');
    if (checkboxes.length === 0) {
        alert("Por favor seleccione al menos una opción para imprimir");
        return;
    }

    // Obtener opciones seleccionadas
    const impPrincipal = document.getElementById("impPrincipal").checked;
    
    // Imprimir plantilla principal si está seleccionada
    if (impPrincipal) {
        abrirPlantillaImpresion(resultado, { 
            modo: 'completo', 
            soloImpresionPrincipal: true 
        });
    }

    // Imprimir plantillas de clientes seleccionados
    if (resultado.DISTRIBUCION && resultado.DISTRIBUCION.Clientes) {
        const clientes = Object.keys(resultado.DISTRIBUCION.Clientes);
        clientes.forEach(cliente => {
            const checkbox = document.getElementById(`impCliente_${cliente.replace(/\s+/g, '_')}`);
            if (checkbox && checkbox.checked) {
                abrirPlantillaImpresion(resultado, { 
                    modo: 'cliente', 
                    clienteNombre: cliente 
                });
            }
        });
    }

    // Mostrar confirmación
    document.getElementById("resultado").innerHTML = `
        <div style="color: var(--secondary-dark); padding: 1rem; border-radius: var(--radius);">
            <p>Documento ${recBuscado} - Impresión iniciada para las opciones seleccionadas.</p>
            <p>Total de plantillas generadas: ${checkboxes.length}</p>
        </div>
    `;
}





function buscarMultiplesRECs() {
    let recsInput = document.getElementById("recInput").value;
    if (!recsInput) {
        document.getElementById("resultado").innerHTML = "<p>Ingrese uno o más documentos para buscar.</p>";
        return;
    }
    
    // Separar los RECs por comas y limpiar espacios
    let recsArray = recsInput.split(',')
        .map(rec => rec.trim())
        .filter(rec => rec !== '');
    
    if (recsArray.length === 0) {
        document.getElementById("resultado").innerHTML = "<p>No se ingresaron documentos válidos.</p>";
        return;
    }
    
    document.getElementById("resultado").innerHTML = `<p>Buscando ${recsArray.length} documento...</p>`;
    
    // Buscar cada REC y abrir solo la plantilla principal
    recsArray.forEach(rec => {
        let resultado = datosGlobales.find(item => item.REC == rec);
        
        if (resultado) {
            // Usamos modo: 'completo' pero con soloImpresionPrincipal: true para mostrar todas las distribuciones
            abrirPlantillaImpresion(resultado, { 
                modo: 'completo', 
                soloImpresionPrincipal: true 
            });
            document.getElementById("resultado").innerHTML += `<p>REC ${rec} encontrado. Se abrió la plantilla principal.</p>`;
        } else {
            document.getElementById("resultado").innerHTML += `<p>No se encontró el documento ${rec}.</p>`;
        }
    });
}

function imprimirSoloClientes() {
    let recBuscado = document.getElementById("recInput").value;
    if (!recBuscado) {
        document.getElementById("resultado").innerHTML = "<p>Ingrese un documento para buscar.</p>";
        return;
    }

    // Verificar si es una búsqueda múltiple
    if (recBuscado.includes(',')) {
        document.getElementById("resultado").innerHTML = `
            <div style="color: var(--danger); padding: 1rem; border-radius: var(--radius);">
                <p>Esta función solo funciona con un documento a la vez.</p>
            </div>
        `;
        return;
    }

    let resultado = datosGlobales.find(item => item.REC == recBuscado);

    if (resultado) {
        // Verificar si tiene colaborador asignado
        if (!resultado.COLABORADOR || resultado.COLABORADOR.trim() === "") {
            document.getElementById("resultado").innerHTML = `
                <div style="color: var(--danger); padding: 1rem; border-radius: var(--radius);">
                    <p><strong>No se puede imprimir:</strong> El documento ${recBuscado} no tiene colaborador/responsable asignado.</p>
                </div>
            `;
            return;
        }

        // Verificar si tiene clientes asignados
        if (!resultado.DISTRIBUCION || !resultado.DISTRIBUCION.Clientes || Object.keys(resultado.DISTRIBUCION.Clientes).length === 0) {
            document.getElementById("resultado").innerHTML = `
                <div style="color: var(--danger); padding: 1rem; border-radius: var(--radius);">
                    <p><strong>No se puede imprimir:</strong> El documento ${recBuscado} no tiene clientes asignados.</p>
                </div>
            `;
            return;
        }

        // Abrir solo las plantillas de clientes
        const clientes = Object.keys(resultado.DISTRIBUCION.Clientes);
        clientes.forEach(cliente => {
            abrirPlantillaImpresion(resultado, { 
                modo: 'cliente', 
                clienteNombre: cliente 
            });
        });

        document.getElementById("resultado").innerHTML = `
            <div style="color: var(--secondary-dark); padding: 1rem; border-radius: var(--radius);">
                <p>Documento ${recBuscado} - Impresión iniciada para:</p>
                <ul>
                    ${clientes.map(cliente => `<li>${cliente}</li>`).join('')}
                </ul>
                <p>Total clientes: <strong>${clientes.length}</strong></p>
            </div>
        `;
    } else {
        document.getElementById("resultado").innerHTML = "<p>No se encontró el documento especificado.</p>";
    }
}
