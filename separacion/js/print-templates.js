/**
 * SEPARACION/js/print-templates.js
 * Generador de plantillas de impresión (Versión Modular con Soporte LOTE/Duplex)
 */

function abrirPlantillaImpresion(datos, options = {}) {
    const html = print_generarDocumentoCompleto(datos, options);
    const ventana = window.open('', '_blank');
    ventana.document.write(html);
    ventana.document.close();
}

/**
 * Función que genera un LOTE de impresión (Mismas reglas que el proyecto principal)
 */
function imprimirLoteDocumentos(listaProcesada) {
    if (!listaProcesada || listaProcesada.length === 0) return;

    const ventana = window.open('', '_blank');
    
    let htmlLote = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <title>Impresión de Lote (${listaProcesada.length})</title>
        ${print_getEstilosOriginales(true)}
    </head>
    <body class="lote-body">
        <div class="pill-bar no-print">
            <button onclick="window.print()" class="btn-pill-primary">Imprimir</button>
            <button onclick="downloadHTML()" class="btn-pill-success">Descargar</button>
            <button onclick="window.close()" class="btn-pill-secondary">Cerrar</button>
        </div>
    `;

    listaProcesada.forEach((item) => {
        const { datos, options } = item;
        htmlLote += `<div class="print-unit lote-separator">
            ${print_generarContenidoInterno(datos, options)}
        </div>`;
    });

    htmlLote += `
        ${print_getScriptsOriginales()}
    </body>
    </html>`;

    ventana.document.write(htmlLote);
    ventana.document.close();
}

function print_generarDocumentoCompleto(datos, options = {}) {
    const titulo = options.modo === 'cliente' 
        ? `Separación REC${datos.REC} - ${options.clienteNombre}`
        : `Separación REC${datos.REC}`;

    return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <title>${titulo}</title>
        ${print_getEstilosOriginales(false)}
    </head>
    <body class="individual-body">
        <div class="pill-bar no-print">
            <button onclick="window.print()" class="btn-pill-primary">Imprimir</button>
            <button onclick="downloadHTML()" class="btn-pill-success">Descargar</button>
            <button onclick="window.close()" class="btn-pill-secondary">Cerrar</button>
        </div>

        <div class="print-unit">
            ${print_generarContenidoInterno(datos, options)}
        </div>
        ${print_getScriptsOriginales()}
    </body>
    </html>`;
}

function print_generarContenidoInterno(datos, options = {}) {
    const {
        modo = 'completo', 
        clienteNombre = null,
        soloPrincipal = false,
        soloImpresionPrincipal = false
    } = options;

    const isModoCliente = modo === 'cliente';
    const isModoPrincipal = modo === 'principal' || soloPrincipal;
    const currentSearchKey = datos.REC || '';
    const recForCode = String(currentSearchKey).split('.')[0];
    const clienteData = isModoCliente ? datos.DISTRIBUCION.Clientes[clienteNombre] : null;
    const clienteId = isModoCliente ? (clienteData.id || '') : '';

    let proveedorId = '';
    const proveedorNombre = datos.PROVEEDOR || '';
    if (!isModoCliente) {
        if (proveedorNombre.includes("TEXTILES Y CREACIONES EL UNIVERSO")) proveedorId = "900616124";
        else if (proveedorNombre.includes("TEXTILES Y CREACIONES LOS ANGELES")) proveedorId = "900692469";
    }

    let qrData;
    if (isModoCliente) qrData = `REC${recForCode}-${clienteId}`;
    else if (proveedorId) qrData = `REC${recForCode}-${proveedorId}`;
    else qrData = `REC${recForCode}`;

    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(qrData)}`;
    const barcodeUrl = `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(qrData)}&code=Code128&dpi=300&dataseparator=`;

    let html = `
        <div class="header-container">
            <div class="info-container">
                <div class="title-section">
                    <div class="main-title">Separación de terceros para:</div>
                    <div class="provider-name">${isModoCliente ? (clienteData.razonSocial || clienteNombre) : (datos.PROVEEDOR || 'Proveedor no especificado')}</div>
                    <div class="subtitle">${datos.DESCRIPCION || 'Sin descripción'}</div>
                </div>
                
                <div class="info-grid">
                    <div class="info-item"><div class="info-label">Referencia:</div><div class="info-value">${datos.REFERENCIA || ''}</div></div>
                    <div class="info-item"><div class="info-label">RefProv:</div><div class="info-value">${datos.REFPROV || ''}</div></div>
                    <div class="info-item"><div class="info-label">Lote:</div><div class="info-value">${datos.LOTE || ''}</div></div>
                    <div class="info-item"><div class="info-label">Género:</div><div class="info-value">${datos.GENERO || ''}</div></div>
                    <div class="info-item"> 
                        <div class="info-label">PVP:</div>
                        <div class="info-value">
                            ${(() => {
                                let pvpStr = datos.PVP || '';
                                let pvpNum = parseInt(String(pvpStr).replace('$', '').replace(/\./g, '').trim());
                                if (pvpNum <= 39900) return `${pvpStr} Linea`;
                                if (pvpNum >= 40000 && pvpNum <= 59900) return `${pvpStr} Moda`;
                                if (pvpNum >= 60000) return `${pvpStr} Pronta`;
                                return `${pvpStr}`;
                            })()}
                        </div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Tipo:</div>
                        <div class="info-value">
                            ${isModoCliente 
                                ? (clienteData.tipoCliente === "Empresa" ? `${clienteData.tipoCliente} ${clienteData.tipoEmpresa?.replace(/^Empresa\s*/, '') || ''} ${clienteData.porcentaje || ''}` : `${clienteData.tipoCliente || ''} ${clienteData.porcentaje || ''}`)
                                : (datos.TIPO || '')}
                        </div>
                    </div>
                    <div class="info-item"><div class="info-label">Fecha:</div><div class="info-value">${datos.FECHA || ''}</div></div>
                    <div class="info-item"><div class="info-label">Prenda:</div><div class="info-value">${datos.PRENDA || ''}</div></div>
                    <div class="info-item"><div class="info-label">Línea:</div><div class="info-value">${datos.LINEA || ''}</div></div>
                </div>

                <div class="info-grid2">
                    <div class="info-item"><div class="info-label">Gestor:</div><div class="info-value">${datos.GESTOR || ''}</div></div>
                    <div class="info-item"><div class="info-label">Auditor:</div><div class="info-value">${datos.AUDITOR || ''}</div></div>
                    <div class="info-item"><div class="info-label">Escáner:</div><div class="info-value">${datos.ESCANER || ''}</div></div>
                    <div class="info-item"><div class="info-label">Taller:</div><div class="info-value">${datos.TALLER || ''}</div></div>
                </div>
            </div>
            
            <div class="codes-container">
                <div class="qr-container">
                    <img src="${qrCodeUrl}" class="qr-code" alt="Código QR">
                    <div class="code-display">${qrData}</div>
                </div>
                <div class="barcode-container">
                    <img src="${barcodeUrl}" class="barcode" alt="Código de barras">
                </div>
            </div>
        </div>
        
        <div class="footer">
            ${isModoCliente ? `Cantidad: <span class="info-value"><strong>${clienteData.distribucion ? clienteData.distribucion.reduce((acc, item) => acc + (parseInt(item.cantidad) || 0), 0) : 0}</strong></span> &nbsp;|&nbsp; Responsable: <span class="info-value">${datos.COLABORADOR || ''}</span> &nbsp;|&nbsp; ` : ''}
            Impreso: ${new Date().toLocaleString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
    `;

    // Sección de anexos
    if (datos.ANEXOS && Array.isArray(datos.ANEXOS) && datos.ANEXOS.length > 0) {
        const mostrarAnexosCompletos = !isModoCliente || (isModoCliente && clienteData.tipoEmpresa && clienteData.tipoEmpresa.includes("Principal"));
        if (mostrarAnexosCompletos) {
            const anexosFiltrados = datos.ANEXOS.filter(anexo => anexo.TIPO === "PENDIENTES" || anexo.TIPO === "PROMO");
            const otrosAnexos = datos.ANEXOS.filter(anexo => anexo.TIPO !== "PENDIENTES" && anexo.TIPO !== "PROMO");

            if (anexosFiltrados.length > 0) {
                let totalAnexos = 0;
                html += `<div class="section"><div class="section-title">ANEXOS (${anexosFiltrados.length})</div><table><thead><tr><th>Referencia</th><th>Talla</th><th>Color</th><th>Tipo</th><th>Cantidad</th></tr></thead><tbody>`;
                anexosFiltrados.forEach(anexo => {
                    totalAnexos += parseInt(anexo.CANTIDAD) || 0;
                    html += `<tr><td>${anexo.DOCUMENTO || '-'}</td><td>${anexo.TALLA || '-'}</td><td>${anexo.COLOR || '-'}</td><td>${anexo.TIPO || '-'}</td><td>${anexo.CANTIDAD || '0'}</td></tr>`;
                });
                html += `<tr class="total"> <td colspan="3">TOTAL ANEXOS</td><td>${anexosFiltrados.length}</td><td>${totalAnexos}</td></tr></tbody></table></div>`;
            }

            if (otrosAnexos.length > 0) {
                html += `<div style="padding: 8px 15px 15px 15px; background-color: #ffffff; border-radius: 4px; border-left: 4px solid #3498db; text-align: left;"><p style="margin: 0; line-height: 1.3; text-transform: uppercase;"><strong>OBSERVACIONES:</strong> `;
                const textosAnexos = otrosAnexos.map(anexo => {
                    const cantidad = parseInt(anexo.CANTIDAD) || 1;
                    const plural = cantidad > 1 ? 'ES' : '';
                    const tipo = anexo.TIPO ? anexo.TIPO.toUpperCase() : '';
                    const talla = anexo.TALLA ? `TALLA ${anexo.TALLA.toUpperCase()}` : '';
                    const color = anexo.COLOR ? `COLOR ${anexo.COLOR.toUpperCase()}` : '';
                    let partes = [`<strong>${cantidad}</strong> UNIDAD${plural}`];
                    if (tipo) partes.push(tipo);
                    if (talla) partes.push(talla);
                    if (color) partes.push(color);
                    return partes.join(', ');
                });
                html += textosAnexos.join('; ') + '.';
                html += `</p></div>`;
            }
        }
    }

    if (datos.DISTRIBUCION && datos.DISTRIBUCION.Clientes) {
        if (isModoCliente && clienteData.distribucion) {
            let totalUnidadesCliente = clienteData.distribucion.reduce((total, item) => total + (parseInt(item.cantidad) || 0), 0);
            const distribucionOrdenada = [...clienteData.distribucion].sort((a, b) => {
                const sizeA = print_parseSize(a.talla);
                const sizeB = print_parseSize(b.talla);
                if (sizeA.rank !== sizeB.rank) return sizeA.rank - sizeB.rank;
                return a.color.localeCompare(b.color, "es", { sensitivity: "base" });
            });
            html += `<div class="section"><div class="section-title">DISTRIBUCIÓN (${totalUnidadesCliente}) ${clienteNombre} </div><table><thead><tr><th>Código</th><th>Color</th><th>Talla</th><th>Cantidad</th></tr></thead><tbody>`;
            distribucionOrdenada.forEach(item => {
                html += `<tr><td>${item.codigo}</td><td>${item.color}</td><td>${item.talla}</td><td>${item.cantidad}</td></tr>`;
            });
            html += `<tr class="total"><td colspan="3">TOTAL</td><td>${totalUnidadesCliente}</td></tr></tbody></table></div>`;
        } else if (!isModoCliente) {
            let clientes = Object.keys(datos.DISTRIBUCION.Clientes);
            let principales = [], secundarias = [], mayoristas = [];
            let distribucionFinal = {};
            let porcentajes = {};

            clientes.forEach(cliente => {
                porcentajes[cliente] = datos.DISTRIBUCION.Clientes[cliente].porcentaje || '';
                let tipo = datos.DISTRIBUCION.Clientes[cliente].tipoEmpresa || "";
                if (tipo.includes("Principal")) principales.push(cliente);
                else if (tipo.includes("Secundaria")) secundarias.push(cliente);
                else mayoristas.push(cliente);
            });

            let clientesOrdenados = (isModoPrincipal && !soloImpresionPrincipal) ? principales : [...principales, ...secundarias, ...mayoristas];

            clientesOrdenados.forEach(cliente => {
                datos.DISTRIBUCION.Clientes[cliente].distribucion.forEach(({ codigo, color, talla, cantidad }) => {
                    let key = `${codigo}-${talla}-${color}`;
                    if (!distribucionFinal[key]) {
                        distribucionFinal[key] = { codigo, color, talla, cantidadTotal: 0 };
                        clientesOrdenados.forEach(c => distribucionFinal[key][c] = 0);
                    }
                    distribucionFinal[key].cantidadTotal += cantidad;
                    distribucionFinal[key][cliente] += cantidad;
                });
            });

            const todasLasFilas = Object.values(distribucionFinal).sort((a, b) => {
                const sizeA = print_parseSize(a.talla);
                const sizeB = print_parseSize(b.talla);
                if (sizeA.rank !== sizeB.rank) return sizeA.rank - sizeB.rank;
                return a.color.localeCompare(b.color, "es", { sensitivity: "base" });
            });

            html += `<div class="section"><div class="section-title">DISTRIBUCIÓN (${clientesOrdenados.length})</div><table><thead><tr><th>Código</th><th>Color</th><th>Talla</th><th>Total</th>`;
            clientesOrdenados.forEach(cliente => {
                html += `<th>${cliente}${porcentajes[cliente] ? '<br>' + porcentajes[cliente] : ''}</th>`;
            });
            html += `</tr></thead><tbody>`;

            let totalPorCliente = {};
            todasLasFilas.forEach(row => {
                html += `<tr><td>${row.codigo}</td><td>${row.color}</td><td>${row.talla}</td><td>${row.cantidadTotal}</td>`;
                clientesOrdenados.forEach(cliente => {
                    html += `<td>${row[cliente]}</td>`;
                    totalPorCliente[cliente] = (totalPorCliente[cliente] || 0) + row[cliente];
                });
                html += `</tr>`;
            });

            let totalGeneral = Object.values(totalPorCliente).reduce((sum, val) => sum + val, 0);
            html += `<tr class="total"><td colspan="3">TOTALES</td><td>${totalGeneral}</td>`;
            clientesOrdenados.forEach(cliente => html += `<td>${totalPorCliente[cliente]}</td>`);
            html += `</tr></tbody></table></div>`;
        }
    }

    return html;
}

function print_getEstilosOriginales(esLote = false) {
    return `
    <style>
        @page { size: letter; margin: 0.5cm; }
        tr:nth-child(even):not(:last-child) { background-color: #f8fafc; }
        tr:last-child { background-color: white !important; }
        @media screen { tr:hover { background-color: #e3f2fd; } }
        @media print {
            tr:nth-child(even):not(:last-child) { background-color: #f8fafc !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            tr:last-child { background-color: white !important; }
            td, th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            table { page-break-inside: auto !important; }
            thead { display: table-header-group !important; }
            tbody { display: table-row-group !important; }
            tr { page-break-inside: avoid !important; page-break-after: auto !important; }
            th { position: relative !important; top: auto !important; }
            .no-print { display: none !important; }
            .lote-separator { break-before: right !important; page-break-before: right !important; }
            .print-unit { page-break-after: always; }
        }
        .info-grid .info-item:nth-child(1) .info-value, .info-grid .info-item:nth-child(2) .info-value, .info-grid .info-item:nth-child(3) .info-value { font-weight: bold; font-size: 11pt; }
        .info-grid .info-item:nth-child(4) .info-value, .info-grid .info-item:nth-child(5) .info-value { border-left: 4px solid #3498db; padding-left: 8px; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; width: 7.5in; margin: 0 auto; padding: 10px; font-size: 10pt; line-height: 1.4; color: #333; }
        .header-container { display: flex; justify-content: space-between; margin-bottom: 10px; page-break-after: avoid; border-bottom: 2px solid #eee; padding-bottom: 10px; }
        .info-container { flex: 1; min-width: 0; }
        .codes-container { display: flex; flex-direction: column; align-items: flex-end; margin-left: 15px; }
        .qr-container { text-align: center; margin-bottom: 10px; }
        .qr-code { width: 120px; height: 120px; padding: 5px; background: white; }
        .barcode { display: block; margin-top: 0px; max-height: 35px; height: auto; width: auto; }
        .title-section { text-align: center; margin-bottom: 10px; }
        .provider-name { font-weight: bold; font-size: 16pt; margin: 5px 0; color: #2c3e50; text-transform: uppercase; }
        .subtitle { font-size: 11pt; margin: 5px 0; color: #7f8c8d; font-style: italic; }
        .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 10px 0; font-size: 9pt; }
        .info-grid2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin: 10px 0; font-size: 9pt; }
        .info-item { display: flex; align-items: center; }
        .info-label { font-weight: 600; min-width: 70px; color: #34495e; }
        .info-value { flex: 1; padding-left: 5px; border-left: 1px solid #eee; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 9pt; page-break-inside: avoid; }
        th, td { border: 1px solid #ddd; padding: 5px; text-align: left; }
        th { background-color: #f8f9fa; font-weight: 600; color: #2c3e50; position: sticky; top: 0; }
        .section-title { font-weight: bold; font-size: 11pt; margin: 10px 0 5px 0; color: #2c3e50; padding: 5px 10px; background-color: #f8f9fa; border-left: 4px solid #3498db; }
        .footer { margin-top: 15px; font-size: 8pt; color: #777; text-align: right; }
        tr.total td { font-weight: bold !important; color: #2c3e50; }
        .code-display { font-weight: bold; text-align: center; margin-top: 3px; }
        .pill-bar { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: white; padding: 10px 25px; border-radius: 50px; box-shadow: 0 5px 25px rgba(0,0,0,0.2); display: flex; gap: 15px; z-index: 10000; border: 1px solid #ddd; align-items: center; }
        .btn-pill-primary { background: #3498db; color: white; border: none; padding: 10px 25px; border-radius: 25px; font-weight: bold; cursor: pointer; }
        .btn-pill-success { background: #2ecc71; color: white; border: none; padding: 10px 25px; border-radius: 25px; font-weight: bold; cursor: pointer; }
        .btn-pill-secondary { background: #f8f9fa; color: #333; border: 1px solid #ddd; padding: 10px 25px; border-radius: 25px; cursor: pointer; font-weight: bold; }
    </style>`;
}

function print_getScriptsOriginales() {
    return `
    <script>
        function downloadHTML() {
            const docClone = document.documentElement.cloneNode(true);
            const noPrintDivs = docClone.querySelectorAll('.no-print');
            noPrintDivs.forEach(div => div.remove());
            const scripts = docClone.querySelectorAll('script');
            scripts.forEach(script => script.remove());
            const content = "<!DOCTYPE html>" + docClone.outerHTML;
            const blob = new Blob([content], {type: 'text/html'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = document.title + '.html';
            a.click();
            URL.revokeObjectURL(url);
        }
    </script>`;
}

function print_parseSize(size) {
    const sizeOrder = { "XXXS": 1, "XXS": 2, "XS": 3, "S": 4, "M": 5, "L": 6, "XL": 7, "XXL": 8, "XXXL": 9 };
    const match = String(size || '').match(/^(\d+)?(XXXS|XXS|XS|S|M|L|XL|XXB|XXL|XXXL)?$/);
    if (!match) return { numPart: null, rank: 99 };
    if (!match[1] && match[2]) return { numPart: null, rank: sizeOrder[match[2]] || 99 };
    if (match[1] && match[2]) {
        const num = parseInt(match[1]);
        const text = match[2];
        let rank = 99;
        if (text === "XS") rank = 4 - num;
        else if (text === "XL") rank = 6 + num;
        else rank = sizeOrder[text] || 99;
        return { numPart: num, rank };
    }
    if (match[1] && !match[2]) return { numPart: parseInt(match[1]), rank: parseInt(match[1]) };
    return { numPart: null, rank: 99 };
}
