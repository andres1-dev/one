function abrirPlantillaImpresion(datos, options = {}) {
    const {
        modo = 'completo', // 'completo' | 'principal' | 'cliente'
        clienteNombre = null,
        soloPrincipal = false,
        soloImpresionPrincipal = false // Nuevo parámetro para impresión múltiple
    } = options;

    const isModoCliente = modo === 'cliente';
    const isModoPrincipal = modo === 'principal' || soloPrincipal;
    
    // Configuración común
    const currentSearchKey = datos.REC || '';
    
    // Configuración específica para cliente
    const clienteData = isModoCliente ? datos.DISTRIBUCION.Clientes[clienteNombre] : null;
    const clienteId = isModoCliente ? (clienteData.id || '') : '';

    // Determinar el ID del proveedor si no hay cliente
    let proveedorId = '';
    if (!isModoCliente && datos.PROVEEDOR) {
        if (datos.PROVEEDOR.includes("TEXTILES Y CREACIONES EL UNIVERSO S.A.S.")) {
            proveedorId = "900616124";
        } else if (datos.PROVEEDOR.includes("TEXTILES Y CREACIONES LOS ANGELES S.A.S.")) {
            proveedorId = "900692469";
        }
    }

        // Construir los códigos QR y de barras
    const qrData = isModoCliente 
        ? `REC${currentSearchKey}-${clienteId}`
        : proveedorId 
            ? `REC${currentSearchKey}-${proveedorId}`
            : `REC${currentSearchKey}`;
            
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${qrData}`;
    const barcodeUrl = `https://barcode.tec-it.com/barcode.ashx?data=${qrData}&code=Code128&dpi=300&dataseparator=`;
    
    //const qrData = isModoCliente ? `REC${currentSearchKey}-${clienteId}` : `REC${currentSearchKey}`;
    //const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${qrData}`;
    
    //const barcodeUrl = `https://barcode.tec-it.com/barcode.ashx?data=${qrData}&code=Code128&dpi=300&dataseparator=`;

    const barcodeElement = document.querySelector('.barcode');

    if (barcodeElement) {
      barcodeElement.style.height = isModoCliente ? '35px' : '60px';
      barcodeElement.style.maxHeight = '60px'; // para prevenir que se pase
      barcodeElement.style.width = 'auto';     // mantener proporción
    }
    
    // Abrir ventana
    const ventana = window.open('', '_blank');
    const titulo = isModoCliente 
        ? `Separación REC${datos.REC} - ${clienteNombre}`
        : `Separación REC${datos.REC}`;
    
    // Generar HTML
    ventana.document.write(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>${titulo}</title>
            <style>
                @page {
                    size: letter;
                    margin: 0.5cm;
                }

                tr:nth-child(even):not(:last-child) {
                    background-color: #f8fafc;
                }

                tr:last-child {
                    background-color: white !important;
                }

                @media screen {
                    tr:hover {
                        background-color: #e3f2fd;
                    }
                }

                @media print {
                    tr:nth-child(even):not(:last-child) {
                        background-color: #f8fafc !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    
                    tr:last-child {
                        background-color: white !important;
                    }

                    td, th {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    
                    table {
                        page-break-inside: auto !important;
                    }
                    
                    thead {
                        display: table-header-group !important;
                    }
                    
                    tbody {
                        display: table-row-group !important;
                    }
                    
                    tr {
                        page-break-inside: avoid !important;
                        page-break-after: auto !important;
                    }
                    
                    th {
                        position: relative !important;
                        top: auto !important;
                    }
                }

                .info-grid .info-item:nth-child(1) .info-value,
                .info-grid .info-item:nth-child(2) .info-value,
                .info-grid .info-item:nth-child(3) .info-value {
                    font-weight: bold;
                    font-size: 11pt;
                }

                .info-grid .info-item:nth-child(4) .info-value,
                .info-grid .info-item:nth-child(5) .info-value {
                    border-left: 4px solid #3498db;
                    padding-left: 8px;
                }

                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    width: 7.5in;
                    margin: 0 auto;
                    padding: 10px;
                    font-size: 10pt;
                    line-height: 1.4;
                    color: #333;
                }
                .header-container {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 10px;
                    page-break-after: avoid;
                    border-bottom: 2px solid #eee;
                    padding-bottom: 10px;
                }
                .info-container {
                    flex: 1;
                    min-width: 0;
                }
                .codes-container {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    margin-left: 15px;
                }
                .qr-container {
                    text-align: center;
                    margin-bottom: 10px;
                }
                .qr-code {
                    width: 120px;
                    height: 120px;
                    padding: 5px;
                    background: white;
                }
                .barcode {
                  display: block;
                  margin-top: 0px;
                  max-height: 35px;
                  height: auto;
                  width: auto;
                }

                .title-section {
                    text-align: center;
                    margin-bottom: 10px;
                }
                .main-title {
                    font-size: 12pt;
                    margin: 5px 0;
                    color: #555;
                    font-weight: normal;
                }
                .provider-name {
                    font-weight: bold;
                    font-size: 16pt;
                    margin: 5px 0;
                    color: #2c3e50;
                    text-transform: uppercase;
                }
                .subtitle {
                    font-size: 11pt;
                    margin: 5px 0;
                    color: #7f8c8d;
                    font-style: italic;
                }
                .info-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 8px;
                    margin: 10px 0;
                    font-size: 9pt;
                }
                .info-grid2 {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 8px;
                    margin: 10px 0;
                    font-size: 9pt;
                }
                .info-item {
                    display: flex;
                    align-items: center;
                }
                .info-label {
                    font-weight: 600;
                    min-width: 70px;
                    color: #34495e;
                }
                .info-value {
                    flex: 1;
                    padding-left: 5px;
                    border-left: 1px solid #eee;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 10px 0;
                    font-size: 9pt;
                    page-break-inside: avoid;
                }
                th, td {
                    border: 1px solid #ddd;
                    padding: 5px;
                    text-align: left;
                }
                th {
                    background-color: #f8f9fa;
                    font-weight: 600;
                    color: #2c3e50;
                    position: sticky;
                    top: 0;
                }
                .section-title {
                    font-weight: bold;
                    font-size: 11pt;
                    margin: 10px 0 5px 0;
                    color: #2c3e50;
                    padding: 5px 10px;
                    background-color: #f8f9fa;
                    border-left: 4px solid #3498db;
                }
                .total-row {
                    font-weight: bold;
                    background-color: #f8f9fa;
                }
                .code-display {
                    font-weight: bold;
                    text-align: center;
                    margin-top: 3px;
                }
                .percentage-label {
                    font-size: 8pt;
                    color: #7f8c8d;
                    font-weight: normal;
                    display: block;
                }
                @media print {
                    body {
                        padding: 0;
                    }
                    .no-print {
                        display: none;
                    }
                    .header-container {
                        border-bottom-color: #ccc;
                    }
                }
                .footer {
                    margin-top: 15px;
                    font-size: 8pt;
                    color: #777;
                    text-align: right;
                }
                tr.total td {
                    font-weight: bold !important;
                    color: #2c3e50;
                }
                tr.total td:nth-child(4) {
                    font-weight: bold !important;
                    color: #2c3e50;
                }
                th.total-header {
                    font-weight: bold !important;
                    color: #2c3e50;
                }
            </style>
        </head>
        <body>
            <div class="header-container">
                <div class="info-container">
                    <div class="title-section">
                        <div class="main-title">Separación de terceros para:</div>
                        <div class="provider-name">${
                            isModoCliente 
                                ? clienteData.razonSocial || clienteNombre 
                                : datos.PROVEEDOR || 'Proveedor no especificado'
                        }</div>
                        <div class="subtitle">${datos.DESCRIPCION || 'Sin descripción'}</div>
                    </div>
                    
                    <div class="info-grid">
                        <div class="info-item">
                            <div class="info-label">Referencia:</div>
                            <div class="info-value">${datos.REFERENCIA || ''}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">RefProv:</div>
                            <div class="info-value">${datos.REFPROV || ''}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Lote:</div>
                            <div class="info-value">${datos.LOTE || ''}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Género:</div>
                            <div class="info-value">${datos.GENERO || ''}</div>
                        </div>
                        <div class="info-item"> 
                            <div class="info-label">PVP:</div>
                            <div class="info-value">
                                ${(() => {
                                    let pvpStr = datos.PVP || '';
                                    let pvpNum = parseInt(pvpStr.replace('$', '').replace(/\./g, '').trim());
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
                                    ? (clienteData.tipoCliente === "Empresa" 
                                        ? clienteData.tipoCliente + " " + (clienteData.tipoEmpresa || '') 
                                        : clienteData.tipoCliente || '')
                                    : datos.TIPO || ''}
                            </div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Fecha:</div>
                            <div class="info-value">${datos.FECHA}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Prenda:</div>
                            <div class="info-value">${datos.PRENDA || ''}</div>
                        </div>
                        ${isModoCliente ? `
                        <div class="info-item">
                            <div class="info-label">Porcentaje:</div>
                            <div class="info-value">${clienteData.porcentaje || ''}</div>
                        </div>` : ''}
                    </div>

                    <div class="info-grid2">
                        <div class="info-item">
                            <div class="info-label">Línea:</div>
                            <div class="info-value">${datos.LINEA || ''}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Auditor:</div>
                            <div class="info-value">${datos.AUDITOR || ''}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Escáner:</div>
                            <div class="info-value">${datos.ESCANER || ''}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Taller:</div>
                            <div class="info-value">${datos.TALLER || ''}</div>
                        </div>
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
                ${isModoCliente 
                    ? `Responsable: <span class="info-value">${datos.COLABORADOR || ''}</span> &nbsp;|&nbsp; ` 
                    : ''}
                Impreso: ${new Date().toLocaleString('es-ES', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric', 
                    hour: '2-digit', 
                    minute: '2-digit', 
                    second: '2-digit' 
                })}
            </div>
    `);

    // Sección de anexos
    if (datos.ANEXOS && Array.isArray(datos.ANEXOS) && datos.ANEXOS.length > 0) {
        const mostrarAnexosCompletos = !isModoCliente || 
                                      (isModoCliente && clienteData.tipoEmpresa && 
                                       clienteData.tipoEmpresa.includes("Principal"));
        
        if (mostrarAnexosCompletos) {
            const anexosFiltrados = datos.ANEXOS.filter(anexo => 
                anexo.TIPO === "PENDIENTES" || anexo.TIPO === "PROMO");
            
            const otrosAnexos = datos.ANEXOS.filter(anexo => 
                anexo.TIPO !== "PENDIENTES" && anexo.TIPO !== "PROMO");

            if (anexosFiltrados.length > 0) {
                let totalAnexos = 0;
                ventana.document.write(`
                    <div class="section">
                        <div class="section-title">ANEXOS (${anexosFiltrados.length})</div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Referencia</th>
                                    <th>Talla</th>
                                    <th>Color</th>
                                    <th>Tipo</th>
                                    <th>Cantidad</th>
                                </tr>
                            </thead>
                            <tbody>`);
                
                anexosFiltrados.forEach(anexo => {
                    totalAnexos += parseInt(anexo.CANTIDAD) || 0;
                    ventana.document.write(`
                                <tr>
                                    <td>${anexo.DOCUMENTO || '-'}</td>
                                    <td>${anexo.TALLA || '-'}</td>
                                    <td>${anexo.COLOR || '-'}</td>
                                    <td>${anexo.TIPO || '-'}</td>
                                    <td>${anexo.CANTIDAD || '0'}</td>
                                </tr>`);
                });
                
                ventana.document.write(`
                                <tr class="total">
                                    <td colspan="3">TOTAL ANEXOS</td>
                                    <td>${anexosFiltrados.length}</td>
                                    <td>${totalAnexos}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>`);
            }
            
            if (otrosAnexos.length > 0) {
                ventana.document.write(`
                    <div style="padding: 8px 15px 15px 15px; background-color: #ffffff; border-radius: 4px; border-left: 4px solid #3498db; text-align: left;">
                        <p style="margin: 0; line-height: 1.3; text-transform: uppercase;">
                            <strong>OBSERVACIONES:</strong> `);

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

                ventana.document.write(textosAnexos.join('; ') + '.');

                ventana.document.write(`</p>
                    </div>`);
            }
        }
    }

    // Sección de distribución
    if (datos.DISTRIBUCION && datos.DISTRIBUCION.Clientes) {
        if (isModoCliente) {
            // Distribución para cliente específico
            let totalUnidadesCliente = 0;
            
            if (clienteData.distribucion) {
                totalUnidadesCliente = clienteData.distribucion.reduce((total, item) => total + (parseInt(item.cantidad) || 0), 0);
                
                const distribucionOrdenada = [...clienteData.distribucion].sort((a, b) => {
                    const sizeA = parseSize(a.talla);
                    const sizeB = parseSize(b.talla);
                    if (sizeA.rank !== sizeB.rank) return sizeA.rank - sizeB.rank;
                    if (sizeA.numPart !== null && sizeB.numPart !== null) {
                        if (sizeA.numPart !== sizeB.numPart) return sizeA.numPart - sizeB.numPart;
                    }
                    return a.color.localeCompare(b.color, "es", { sensitivity: "base" });
                });

                ventana.document.write(`
                    <div class="section">
                        <div class="section-title">DISTRIBUCIÓN (${totalUnidadesCliente}) ${clienteNombre} </div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Código</th>
                                    <th>Color</th>
                                    <th>Talla</th>
                                    <th>Cantidad</th>
                                </tr>
                            </thead>
                            <tbody>`);
                
                distribucionOrdenada.forEach(item => {
                    ventana.document.write(`
                                <tr>
                                    <td>${item.codigo}</td>
                                    <td>${item.color}</td>
                                    <td>${item.talla}</td>
                                    <td>${item.cantidad}</td>
                                </tr>`);
                });
                
                ventana.document.write(`
                                <tr class="total">
                                    <td colspan="3">TOTAL</td>
                                    <td>${totalUnidadesCliente}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>`);
            }
        } else {
            // Distribución completa
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

            // Cambio clave: si es soloImpresionPrincipal, mostramos todos los clientes
            let clientesOrdenados = (isModoPrincipal && !soloImpresionPrincipal) 
                ? principales 
                : [...principales, ...secundarias, ...mayoristas];

            // Procesar distribución
            clientesOrdenados.forEach(cliente => {
                datos.DISTRIBUCION.Clientes[cliente].distribucion.forEach(({ codigo, color, talla, cantidad }) => {
                    let key = `${codigo}-${talla}`;
                    if (!distribucionFinal[key]) {
                        distribucionFinal[key] = { codigo, color, talla, cantidadTotal: 0 };
                        clientesOrdenados.forEach(c => distribucionFinal[key][c] = 0);
                    }
                    distribucionFinal[key].cantidadTotal += cantidad;
                    distribucionFinal[key][cliente] += cantidad;
                });
            });

            const todasLasFilas = Object.values(distribucionFinal).sort((a, b) => {
                const sizeA = parseSize(a.talla);
                const sizeB = parseSize(b.talla);
                if (sizeA.rank !== sizeB.rank) return sizeA.rank - sizeB.rank;
                if (sizeA.numPart !== null && sizeB.numPart !== null) {
                    if (sizeA.numPart !== sizeB.numPart) return sizeA.numPart - sizeB.numPart;
                }
                return a.color.localeCompare(b.color, "es", { sensitivity: "base" });
            });

            ventana.document.write(`
                <div class="section">
                    <div class="section-title">DISTRIBUCIÓN (${clientesOrdenados.length})</div>
                    <table>
                        <thead>
                            <tr>
                                <th>Código</th>
                                <th>Color</th>
                                <th>Talla</th>
                                <th>Total</th>`);
            
            clientesOrdenados.forEach(cliente => {
                ventana.document.write(`<th>${cliente}${porcentajes[cliente] ? '<br>' + porcentajes[cliente] : ''}</th>`);
            });
            
            ventana.document.write(`</tr>
                        </thead>
                        <tbody>`);

            let totalPorCliente = {};
            todasLasFilas.forEach(row => {
                ventana.document.write(`<tr>
                            <td>${row.codigo}</td>
                            <td>${row.color}</td>
                            <td>${row.talla}</td>
                            <td>${row.cantidadTotal}</td>`);
                
                clientesOrdenados.forEach(cliente => {
                    ventana.document.write(`<td>${row[cliente]}</td>`);
                    totalPorCliente[cliente] = (totalPorCliente[cliente] || 0) + row[cliente];
                });
                
                ventana.document.write(`</tr>`);
            });

            let totalGeneral = Object.values(totalPorCliente).reduce((sum, val) => sum + val, 0);
            ventana.document.write(`<tr class="total">
                        <td colspan="3">TOTALES</td>
                        <td>${totalGeneral}</td>`);
            
            clientesOrdenados.forEach(cliente => {
                ventana.document.write(`<td>${totalPorCliente[cliente]}</td>`);
            });
            
            ventana.document.write(`</tr>
                        </tbody>
                    </table>
                </div>`);
        }
    }

    // Cierre del documento
    ventana.document.write(`
        <div class="no-print" style="text-align: center; margin-top: 15px;">
            <button onclick="window.print()" style="padding: 8px 15px; font-size: 10pt; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">Imprimir</button>
            <button onclick="window.close()" style="padding: 8px 15px; font-size: 10pt; margin-left: 10px; background: #95a5a6; color: white; border: none; border-radius: 4px; cursor: pointer;">Cerrar</button>
        </div>
        </body>
        </html>
    `);

    ventana.document.close();
}

function parseSize(size) {
    const sizeOrder = { 
        "XXXS": 1, "XXS": 2, "XS": 3, "S": 4, 
        "M": 5, "L": 6, "XL": 7, "XXL": 8, "XXXL": 9 
    };

    // Expresión regular para capturar tallas como "3XL", "XXS", "M", etc.
    const match = size ? size.match(/^(\d+)?(XXXS|XXS|XS|S|M|L|XL|XXL|XXXL)?$/) : [null, null, null];

    // Si es tipo clásico como "XS", "XXL"
    if (match && !match[1] && match[2]) {
        return {
            numPart: null,
            rank: sizeOrder[match[2]] || 99,
            textPart: match[2]
        };
    }

    // Si es tipo nuevo como "2XL", "3XS", también considera tallas numéricas
    if (match && match[1] && match[2]) {
        const num = parseInt(match[1]);
        const text = match[2];

        let rank = 99;

        if (text === "XS") {
            rank = 4 - num; // 1XS = XS (3), 2XS = XXS (2), 3XS = XXXS (1)
        } else if (text === "XL") {
            rank = 6 + num; // 1XL = XL (7), 2XL = XXL (8), etc.
        } else {
            rank = sizeOrder[text] || 99;
        }

        return {
            numPart: num,
            rank,
            textPart: text
        };
    }

    // Si solo es un número, asigna un rango basado en el número
    if (match && match[1] && !match[2]) {
        const num = parseInt(match[1]);

        return {
            numPart: num,
            rank: num,
            textPart: ""
        };
    }

    // Si no coincide con nada, devuelve un valor por defecto
    return {
        numPart: null,
        rank: 99,
        textPart: ""
    };
}
