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
