// app.js - Sistema completo PandaDash con Sheets API v4
class PandaDashApp {
    constructor() {
        this.config = {
            VERSION: "5.0.0",
            CACHE_TTL: 5 * 60 * 1000, // 5 minutos
            MAX_IMAGE_SIZE: 800,
            API_KEY: 'AIzaSyC7hjbRc0TGLgImv8gVZg8tsOeYWgXlPcM', // Reemplaza con tu API Key
            SPREADSHEET_ID_SIESA: '1FcQhVIKtWy4O-aGTNfA6l4C5Q4_u1LZErpj3CMglfQM',
            SPREADSHEET_ID_SOPORTES: '1VaPBwgRu1QWhmsV_Qgf7cgraSxiAWRX6-wBEyUlGoJw',
            API_URL_POST: 'https://script.google.com/macros/s/AKfycbwgnkjVCMWlWuXnVaxSBD18CGN3rXGZtQZIvX9QlBXSgbQndWC4uqQ2sc00DuNH6yrb/exec',
            API_URL_ASENTAR_FACTURA: 'https://script.google.com/macros/s/AKfycbz0cNRHuZYIeouAOZKsVZZSavN325HCr-6BN_7-bfFCQg5PoCybMYvQmLRRjcSSsXQR/exec'
        };

        this.database = [];
        this.currentQRParts = null;
        this.dataLoaded = false;
        this.currentDocumentData = null;
        this.photoBlob = null;

        this.initElements();
        this.setupEventListeners();
        this.loadDataFromServer();
    }

    initElements() {
        this.loadingScreen = document.getElementById('loadingScreen');
        this.scanner = document.getElementById('scanner');
        this.barcodeInput = document.getElementById('barcode');
        this.statusDiv = document.getElementById('status');
        this.resultsDiv = document.getElementById('results');
        this.dataStats = document.getElementById('data-stats');
        this.offlineBanner = document.getElementById('offline-banner');
        this.installBtn = document.getElementById('installBtn');
    }

    setupEventListeners() {
        // Foco persistente
        this.enforceFocus();
        
        // Evento de input para barcode
        this.barcodeInput.addEventListener('input', (e) => this.handleBarcodeInput(e));
        
        // Eventos de conexión
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
        
        // PWA Install
        this.setupPWAInstall();
        
        // Prevención de zoom
        this.setupZoomPrevention();
        
        // Pull-to-refresh
        this.setupPullToRefresh();
    }

    // ========== GESTIÓN DE DATOS ==========

    async loadDataFromServer() {
        this.updateStatus('loading', '<i class="fas fa-sync fa-spin"></i> CARGANDO DATOS...');
        this.dataStats.innerHTML = '<i class="fas fa-server"></i> Conectando con el servidor...';

        try {
            const data = await this.fetchDataFromSheets();
            this.handleDataLoadSuccess(data);
        } catch (error) {
            this.handleDataLoadError(error);
        }
    }

    async fetchDataFromSheets() {
        const cacheKey = 'pandadash_data';
        const cached = this.getCachedData(cacheKey);
        if (cached) return cached;

        console.log('📡 Obteniendo datos desde Sheets API...');

        // Obtener datos de ambas hojas en paralelo
        const [siesaData, soportesData] = await Promise.all([
            this.fetchSiesaData(),
            this.fetchSoportesData()
        ]);

        const processedData = this.processCompleteData(siesaData, soportesData);
        this.setCachedData(cacheKey, processedData);
        
        return processedData;
    }

    async fetchSiesaData() {
        const ranges = [
            `${encodeURIComponent('SIESA')}!A:G`,
            `${encodeURIComponent('SIESA_V2')}!A:D`
        ];

        const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.config.SPREADSHEET_ID_SIESA}/values:batchGet?ranges=${ranges.join('&ranges=')}&key=${this.config.API_KEY}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        
        const data = await response.json();
        
        return {
            siesa: data.valueRanges[0]?.values || [],
            siesaV2: data.valueRanges[1]?.values || []
        };
    }

    async fetchSoportesData() {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.config.SPREADSHEET_ID_SOPORTES}/values/${encodeURIComponent('SOPORTES')}!A:I?key=${this.config.API_KEY}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        
        const data = await response.json();
        return data.values || [];
    }

    processCompleteData(siesaData, soportesData) {
        const { siesa, siesaV2 } = siesaData;
        
        // Procesar soportes
        const soportesPorFactura = this.processSoportes(soportesData);
        
        // Procesar datos complementarios
        const datosComplementarios = this.processComplementaryData(siesaV2);
        
        // Procesar datos principales
        return this.processMainData(siesa, soportesPorFactura, datosComplementarios);
    }

    processSoportes(datosSoportes) {
        const soportesPorFactura = {};
        
        if (!datosSoportes || datosSoportes.length <= 1) return soportesPorFactura;

        const headers = datosSoportes[0];
        const facturaIndex = headers.indexOf("Factura");
        const registroIndex = headers.indexOf("Registro");
        const urlIndex = headers.indexOf("Url_Ih3");

        for (let i = 1; i < datosSoportes.length; i++) {
            const row = datosSoportes[i];
            if (row && row.length > Math.max(facturaIndex, registroIndex, urlIndex)) {
                const factura = row[facturaIndex];
                const registro = row[registroIndex];
                const url = row[urlIndex];

                if (factura && registro) {
                    if (!soportesPorFactura[factura]) {
                        soportesPorFactura[factura] = [];
                    }
                    soportesPorFactura[factura].push({
                        registro: registro.trim(),
                        url: url || '',
                        confirmado: true // Marcar como confirmado
                    });
                }
            }
        }

        return soportesPorFactura;
    }

    processComplementaryData(siesaV2) {
        const complementData = {};

        for (let i = 1; i < siesaV2.length; i++) {
            const row = siesaV2[i];
            if (row && row.length >= 3) {
                const key = row[0];
                if (key) {
                    if (!complementData[key]) {
                        complementData[key] = {
                            sumValue1: parseFloat(row[1]) || 0,
                            value2Items: [row[2] || ''],
                            sumValue3: parseFloat(row[3]) || 0,
                            count: 1
                        };
                    } else {
                        complementData[key].sumValue1 += parseFloat(row[1]) || 0;
                        complementData[key].value2Items.push(row[2] || '');
                        complementData[key].sumValue3 += parseFloat(row[3]) || 0;
                        complementData[key].count += 1;
                    }
                }
            }
        }

        return complementData;
    }

    processMainData(siesa, soportesPorFactura, datosComplementarios) {
        const resultados = [];
        
        const clientesEspecificos = [
            { nombre: "INVERSIONES URBANA SAS", nit: "901920844" },
            { nombre: "EL TEMPLO DE LA MODA FRESCA SAS", nit: "900047252" },
            { nombre: "EL TEMPLO DE LA MODA SAS", nit: "805027653" },
            { nombre: "ARISTIZABAL LOPEZ JESUS MARIA", nit: "70825517" },
            { nombre: "ZULUAGA GOMEZ RUBEN ESTEBAN", nit: "1007348825" },
            { nombre: "QUINTERO ORTIZ JOSE ALEXANDER", nit: "14838951" },
            { nombre: "QUINTERO ORTIZ PATRICIA YAMILET", nit: "67006141" }
        ];

        const estadosExcluir = ["Anuladas", "En elaboración"];
        const prefijosValidos = ["017", "FEV", "029", "FVE"];

        // Funciones de ayuda
        const normalizarCliente = nombre => (nombre || '').replace(/S\.A\.S\.?/g, 'SAS').replace(/\s+/g, ' ').trim();

        const esClienteValido = (nombreCliente, listaClientes) => {
            const clienteNormalizado = normalizarCliente(nombreCliente);
            
            const coincidenciaExacta = listaClientes.find(c => 
                normalizarCliente(c.nombre) === clienteNormalizado
            );
            
            if (coincidenciaExacta) return true;
            
            return listaClientes.some(c => {
                const clienteListaNormalizado = normalizarCliente(c.nombre);
                const palabrasCliente = clienteNormalizado.split(' ');
                const palabrasLista = clienteListaNormalizado.split(' ');
                
                if (palabrasCliente.length > 2 && palabrasLista.length > 2) {
                    const primerosDosCliente = palabrasCliente.slice(0, 2).join(' ');
                    const primerosDosLista = palabrasLista.slice(0, 2).join(' ');
                    return primerosDosCliente === primerosDosLista;
                }
                
                return false;
            });
        };

        const tienePrefijoValido = valor => prefijosValidos.some(p => (valor || '').toUpperCase().startsWith(p));

        const obtenerNitCliente = nombre => {
            const clienteNormalizado = normalizarCliente(nombre);
            const cliente = clientesEspecificos.find(c => normalizarCliente(c.nombre) === clienteNormalizado);
            return cliente ? cliente.nit : '';
        };

        // Procesar filas de SIESA
        for (let i = 1; i < siesa.length; i++) {
            const row = siesa[i];
            if (!row || row.length < 7) continue;

            const estado = row[0] || '';
            const factura = row[1] || '';
            const nombreClienteOriginal = row[3] || '';

            // Aplicar filtros
            if (estadosExcluir.includes(estado)) continue;
            if (!tienePrefijoValido(factura)) continue;
            if (!esClienteValido(nombreClienteOriginal, clientesEspecificos)) continue;

            const col6Value = row[6] || '';
            let selectedValue = '';

            if (col6Value == "5" && row.length > 4) selectedValue = row[4] || '';
            if (col6Value == "3" && row.length > 5) selectedValue = row[5] || '';

            const complementData = datosComplementarios[factura] || { 
                sumValue1: 0, value2Items: [], sumValue3: 0, count: 0 
            };

            let referencia = '';
            if (complementData.count === 1) {
                referencia = complementData.value2Items[0];
            } else if (complementData.count > 1) {
                referencia = "RefVar";
            }

            // Obtener soportes y determinar estado de entrega
            const soportes = soportesPorFactura[factura] || [];
            const entregado = soportes.length > 0;
            
            // Determinar estado de confirmación
            let confirmacion = '';
            if (entregado) {
                confirmacion = "ENTREGADO";
            } else if (factura && !factura.includes('FEV') && !factura.includes('FVE')) {
                confirmacion = "PENDIENTE FACTURA";
            }

            // Determinar proveedor
            let proveedor = '';
            if (col6Value == "5") proveedor = "TEXTILES Y CREACIONES EL UNIVERSO SAS";
            if (col6Value == "3") proveedor = "TEXTILES Y CREACIONES LOS ANGELES SAS";

            // Agregar resultado
            resultados.push({
                estado: estado,
                factura: factura,
                fecha: row[2] || '',
                lote: selectedValue,
                codProveedor: col6Value,
                proveedor: proveedor,
                cliente: normalizarCliente(nombreClienteOriginal),
                valorBruto: complementData.sumValue1,
                referencia: referencia,
                cantidad: complementData.sumValue3,
                nit: obtenerNitCliente(nombreClienteOriginal),
                soportes: soportes,
                confirmacion: confirmacion,
                documento: `REC${selectedValue}`,
                entregado: entregado // Campo crítico para verificación
            });
        }

        return resultados;
    }

    handleDataLoadSuccess(data) {
        this.database = data;
        this.dataLoaded = true;
        
        this.updateStatus('ready', '<i class="fas fa-check-circle"></i> SISTEMA LISTO');
        this.dataStats.innerHTML = `<i class="fas fa-database"></i> ${data.length} registros | ${new Date().toLocaleTimeString()}`;
        
        this.showWelcomeScreen();
        this.hideLoadingScreen();
        this.playSuccessSound();
    }

    handleDataLoadError(error) {
        console.error("Error al cargar datos:", error);
        
        const cachedData = this.getCachedData('pandadash_data');
        if (cachedData) {
            this.database = cachedData;
            this.dataLoaded = true;
            
            this.updateStatus('ready', '<i class="fas fa-database"></i> SISTEMA LISTO (DATOS CACHEADOS)');
            this.dataStats.innerHTML = `${cachedData.length} registros | Última actualización: ${new Date().toLocaleString()}`;
            this.offlineBanner.style.display = 'block';
            this.hideLoadingScreen();
        } else {
            this.updateStatus('error', '<span style="color: var(--danger)">ERROR AL CARGAR DATOS</span>');
            this.dataStats.textContent = error.message || 'Error desconocido';
            this.resultsDiv.innerHTML = `<div class="error"><i class="fas fa-exclamation-circle"></i> No se pudo cargar la base de datos: ${error.message || 'Error desconocido'}</div>`;
            
            const loadingName = document.querySelector('#loadingScreen .name');
            if (loadingName) {
                loadingName.innerHTML = 'Error al cargar datos. <br>Comprueba tu conexión.';
                loadingName.style.color = '#f72585';
            }
            
            this.playErrorSound();
        }
    }

    // ========== GESTIÓN DE QR Y ESCANEOS ==========

    handleBarcodeInput(event) {
        const code = event.target.value.trim();
        if (code.length < 5) return;

        const parts = this.parseQRCode(code);
        
        if (parts) {
            this.currentQRParts = parts;
            const startTime = Date.now();
            this.processQRCodeParts(parts);
            const searchTime = Date.now() - startTime;
            
            this.updateStatus('processed', `REGISTRO PROCESADO (${searchTime}ms)`);
        } else {
            this.showError(code, "Formato de código QR no válido. Use formato: DOCUMENTO-NIT");
            this.playErrorSound();
            this.updateStatus('error', 'FORMATO INVÁLIDO');
        }
        
        setTimeout(() => {
            event.target.value = '';
            event.target.focus();
        }, 50);
    }

    parseQRCode(code) {
        const regex = /^([A-Za-z0-9-]+)-([0-9]+)$/;
        const match = code.match(regex);
        
        if (match) {
            return {
                documento: match[1],
                nit: match[2]
            };
        }
        
        return null;
    }

    processQRCodeParts(parts) {
        const { documento, nit } = parts;
        
        const result = this.database.find(item => 
            item.documento && item.documento.toString() === documento
        );
        
        if (result) {
            const filteredItem = JSON.parse(JSON.stringify(result));
            
            if (filteredItem.datosSiesa && Array.isArray(filteredItem.datosSiesa)) {
                filteredItem.datosSiesa = filteredItem.datosSiesa.filter(siesa => {
                    const siesaNitDigits = siesa.nit ? siesa.nit.toString().replace(/\D/g, '') : '';
                    const scanNitDigits = nit.replace(/\D/g, '');
                    
                    return siesaNitDigits.includes(scanNitDigits) || scanNitDigits.includes(siesaNitDigits);
                });
                
                this.displayFullResult(filteredItem, parts);
                this.playSuccessSound();
            } else {
                this.displayFullResult(filteredItem, parts);
                this.playSuccessSound();
            }
        } else {
            this.showError(`${documento}-${nit}`, "Documento no encontrado en la base de datos");
            this.playErrorSound();
        }
    }

    // ========== GESTIÓN DE ENTREGAS ==========

    async procesarEntrega(documento, lote, referencia, cantidad, factura, nit, btnElement) {
        // Verificar si ya está entregado
        const facturaData = this.database.find(item => item.factura === factura);
        if (facturaData && facturaData.entregado) {
            this.mostrarNotificacion('warning', `La factura ${factura} ya fue entregada`);
            return;
        }

        // Verificar si está en cola
        if (window.uploadQueue && window.uploadQueue.isFacturaInQueue(factura)) {
            this.mostrarNotificacion('warning', `La factura ${factura} está siendo procesada`);
            return;
        }

        const esSinFactura = !factura || factura.trim() === "";
        
        this.currentDocumentData = {
            documento: documento,
            lote: lote || '',
            referencia: referencia || '',
            cantidad: parseFloat(cantidad) || 0,
            factura: factura || '',
            nit: nit || '',
            btnElement: btnElement,
            esSinFactura: esSinFactura
        };
        
        this.openCameraForCapture();
    }

    openCameraForCapture() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.capture = 'environment';
        
        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                this.procesarImagenCapturada(e.target.files[0]);
            }
        });
        
        fileInput.click();
    }

    procesarImagenCapturada(archivo) {
        if (!archivo) {
            console.error("No se seleccionó ninguna imagen");
            return;
        }
        
        this.updateStatus('loading', '<i class="fas fa-image"></i> Procesando imagen...');
        
        const lector = new FileReader();
        lector.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                let width = img.width;
                let height = img.height;
                
                const maxDimension = this.config.MAX_IMAGE_SIZE || 1200;
                if (width > height && width > maxDimension) {
                    height = (height / width) * maxDimension;
                    width = maxDimension;
                } else if (height > width && height > maxDimension) {
                    width = (width / height) * maxDimension;
                    height = maxDimension;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                ctx.drawImage(img, 0, 0, width, height);
                this.aplicarMarcaDeAgua(ctx, width, height);
                
                canvas.toBlob((blob) => {
                    this.photoBlob = blob;
                    this.subirFotoCapturada(blob);
                }, 'image/jpeg', 0.85);
            };
            img.src = e.target.result;
        };
        lector.readAsDataURL(archivo);
    }

    async subirFotoCapturada(blob) {
        if (!this.currentDocumentData || !blob) {
            this.mostrarError("No hay datos disponibles para subir");
            return;
        }
        
        const { documento, lote, referencia, cantidad, factura, nit, btnElement, esSinFactura } = this.currentDocumentData;
        
        try {
            const base64Data = await this.blobToBase64(blob);
            const nombreArchivo = `${factura}_${Date.now()}.jpg`.replace(/[^a-zA-Z0-9\-]/g, '');
            
            const jobData = {
                documento: documento,
                lote: lote,
                referencia: referencia,
                cantidad: cantidad,
                factura: factura,
                nit: nit,
                fotoBase64: base64Data,
                fotoNombre: nombreArchivo,
                fotoTipo: 'image/jpeg',
                timestamp: new Date().toISOString(),
                esSinFactura: esSinFactura
            };
            
            // Agregar a la cola de subida
            if (window.uploadQueue) {
                const success = await window.uploadQueue.addJob({
                    type: 'photo',
                    data: jobData,
                    factura: factura,
                    btnElementId: btnElement ? btnElement.getAttribute('data-factura') : null,
                    esSinFactura: esSinFactura
                });

                if (success) {
                    if (btnElement) {
                        btnElement.innerHTML = '<i class="fas fa-hourglass-half"></i> PROCESANDO...';
                        btnElement.style.backgroundColor = '#4cc9f0';
                    }
                    
                    this.playSuccessSound();
                }
            }
            
        } catch (error) {
            console.error("Error al preparar foto:", error);
            this.updateStatus('error', '<span style="color: var(--danger)">Error al procesar la imagen</span>');
            this.playErrorSound();
        }
    }

    // ========== FUNCIONES DE UTILIDAD ==========

    aplicarMarcaDeAgua(ctx, width, height) {
        const marcaHeight = Math.floor(height / 6);
        const gradient = ctx.createLinearGradient(0, height - marcaHeight, 0, height);
        gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
        gradient.addColorStop(0.2, "rgba(0, 0, 0, 0.6)");
        gradient.addColorStop(1, "rgba(0, 0, 0, 0.8)");

        ctx.fillStyle = gradient;
        ctx.fillRect(0, height - marcaHeight, width, marcaHeight);

        const fontFamily = "Inter, sans-serif";
        const fontSize = Math.max(10, Math.floor(width / 70));
        const fontSizeTitle = fontSize * 2;
        ctx.fillStyle = "white";
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";

        const marginLeft = Math.floor(width / 20);
        const lineSpacing = Math.floor(fontSize * 1.6);
        let posY = height - Math.floor(marcaHeight * 0.2);

        // Fecha y hora
        ctx.font = `500 ${fontSize}px ${fontFamily}`;
        const fecha = new Date().toLocaleString();
        ctx.fillText(fecha, marginLeft, posY);
        posY -= lineSpacing;

        // Datos técnicos
        const datos = [];
        if (this.currentDocumentData) {
            if (this.currentDocumentData.factura) datos.push(this.currentDocumentData.factura);
            if (this.currentDocumentData.lote) datos.push(this.currentDocumentData.lote);
            if (this.currentDocumentData.referencia) datos.push(this.currentDocumentData.referencia);
            if (this.currentDocumentData.cantidad) datos.push(this.currentDocumentData.cantidad);
        }

        if (datos.length > 0) {
            ctx.fillText(datos.join(" | "), marginLeft, posY);
            posY -= lineSpacing;
        }

        // Título
        ctx.font = `700 ${fontSizeTitle}px ${fontFamily}`;
        ctx.fillText("PandaDash", marginLeft, posY);
    }

    async blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    // ========== GESTIÓN DE UI ==========

    displayFullResult(item, qrParts) {
        const totalRegistros = item.datosSiesa ? item.datosSiesa.length : 0;
        const filtradosRegistros = item.datosSiesa ? item.datosSiesa.length : 0;
        
        this.resultsDiv.innerHTML = `
            <div class="result-item">
                ${filtradosRegistros < totalRegistros ? `
                    <div class="filter-info">
                        <i class="fas fa-info-circle"></i> Mostrando ${filtradosRegistros} de ${totalRegistros} registros (filtrado por NIT ${qrParts.nit})
                    </div>
                ` : ''}
                ${this.displayItemData(item, 'Datos del Documento', qrParts)}
            </div>
        `;
    }

    displayItemData(data, title = 'Datos', qrParts) {
        let html = `<div class="siesa-header">${title} <span class="timestamp">${new Date().toLocaleString()}</span></div>`;
        
        const ordenPropiedades = ['documento', 'lote', 'referencia'];
        
        ordenPropiedades.forEach(propKey => {
            if (propKey in data && propKey !== 'datosSiesa') {
                html += `
                    <div class="result-row">
                        <div class="col-header">${this.formatKey(propKey)}:</div>
                        <div class="json-value">${this.formatValue(data[propKey], propKey)}</div>
                    </div>
                `;
            }
        });
        
        for (const key in data) {
            if (key === 'datosSiesa' || ordenPropiedades.includes(key)) continue;
            
            html += `
                <div class="result-row">
                    <div class="col-header">${this.formatKey(key)}:</div>
                    <div class="json-value">${this.formatValue(data[key], key)}</div>
                </div>
            `;
        }
        
        if (data.datosSiesa && Array.isArray(data.datosSiesa)) {
            if (data.datosSiesa.length === 0) {
                html += `<div class="no-data" style="padding: 15px; text-align: center;"><i class="fas fa-search"></i> No hay registros que coincidan con el NIT escaneado</div>`;
            } else {
                html += `<div class="siesa-header">Documentos Relacionados <span class="badge badge-success">${data.datosSiesa.length} registros</span></div>`;
                
                data.datosSiesa.forEach((siesa, index) => {
                    const estadoBadge = siesa.estado === 'Aprobadas' ? 'badge-success' : 'badge-warning';
                    
                    html += `<div class="siesa-item">`;
                    html += `<div class="siesa-header">Factura #${index + 1} <span class="badge ${estadoBadge}">${siesa.estado || 'Sin estado'}</span></div>`;
                    
                    const ordenSiesaPropiedades = ['factura', 'nit', 'lote', 'referencia', 'cantidad', 'estado', 'cliente', 'valorBruto', 'fecha', 'proovedor'];
                    
                    ordenSiesaPropiedades.forEach(propKey => {
                        if (propKey in siesa) {
                            html += `
                                <div class="result-row">
                                    <div class="col-header">${this.formatKey(propKey)}:</div>
                                    <div class="json-value">${this.formatValue(siesa[propKey], propKey)}</div>
                                </div>
                            `;
                        }
                    });
                    
                    for (const key in siesa) {
                        if (ordenSiesaPropiedades.includes(key)) continue;
                        
                        html += `
                            <div class="result-row">
                                <div class="col-header">${this.formatKey(key)}:</div>
                                <div class="json-value">${this.formatValue(siesa[key], key)}</div>
                            </div>
                        `;
                    }
                    
                    // Botones de acción
                    if (siesa.confirmacion && siesa.confirmacion.trim() === "ENTREGADO") { 
                        html += `
                            <div class="action-buttons">
                                <div style="background-color: #28a745; color: white; text-align: center; padding: 12px 20px; border-radius: 8px; font-weight: 500; height: 48px; display: inline-flex; align-items: center; justify-content: center; gap: 8px;">
                                    <i class="fas fa-check-circle"></i> ENTREGA CONFIRMADA
                                </div>
                            </div>
                        `;
                    } else if (siesa.confirmacion && siesa.confirmacion.includes("PENDIENTE FACTURA")) {
                        const tieneFactura = siesa.factura && siesa.factura.trim() !== "";
                        
                        if (tieneFactura) {
                            html += `
                                <div class="action-buttons">
                                    <button class="delivery-btn" 
                                        data-factura="${siesa.factura}"
                                        style="background-color: #f8961e; height: 48px; padding: 12px 20px; border-radius: 8px; font-weight: 500; display: inline-flex; align-items: center; justify-content: center; gap: 8px;"
                                        onclick="asentarFactura(
                                            '${data.documento}', 
                                            '${siesa.lote || data.lote}', 
                                            '${siesa.referencia}', 
                                            '${siesa.cantidad}', 
                                            '${siesa.factura}', 
                                            '${siesa.nit || qrParts.nit}', 
                                            this
                                        )">
                                        <i class="fas fa-file-invoice"></i> ASENTAR FACTURA
                                    </button>
                                </div>
                            `;
                        } else {
                            html += `
                                <div class="action-buttons">
                                    <div style="background-color: #6c757d; color: white; text-align: center; padding: 12px 20px; border-radius: 8px; font-weight: 500; height: 48px; display: inline-flex; align-items: center; justify-content: center; gap: 8px;">
                                        <i class="fas fa-clock"></i> PENDIENTE FACTURA
                                    </div>
                                </div>
                            `;
                        }
                    } else {
                        html += `
                            <div class="action-buttons">
                                <button class="delivery-btn" 
                                    data-factura="${siesa.factura}"
                                    style="height: 48px; padding: 12px 20px; border-radius: 8px; font-weight: 500; display: inline-flex; align-items: center; justify-content: center; gap: 8px;"
                                    onclick="app.procesarEntrega(
                                        '${data.documento}', 
                                        '${siesa.lote || data.lote}', 
                                        '${siesa.referencia}', 
                                        '${siesa.cantidad}', 
                                        '${siesa.factura}', 
                                        '${siesa.nit || qrParts.nit}', 
                                        this
                                    )">
                                    <i class="fas fa-truck"></i> CONFIRMAR ENTREGA
                                </button>
                            </div>
                        `;
                    }
                    
                    html += `</div>`;
                });
            }
        }
        
        return html;
    }

    formatKey(key) {
        return key
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .replace('columna', '')
            .trim();
    }

    formatValue(value, key = '') {
        if (value === null || value === undefined) {
            return '<span class="no-data">N/A</span>';
        }
        
        if (typeof value === 'object') {
            return '<span class="no-data">[Datos complejos]</span>';
        }
        
        if (typeof value === 'number') {
            if (key.toLowerCase().includes('valor') || key.toLowerCase().includes('suma')) {
                return `<span class="numeric-value">${value.toLocaleString('es-CO')}</span>`;
            }
            return value.toString();
        }
        
        if (typeof value === 'boolean') {
            return value ? 'Sí' : 'No';
        }
        
        return value.toString();
    }

    showWelcomeScreen() {
        this.resultsDiv.innerHTML = `
            <div class="result-item" style="text-align: center; color: var(--gray);">
                <div style="text-align: center;">
                    <i class="fas fa-qrcode fa-4x logo" aria-label="PandaDash QR Icon"></i>
                </div>
                <h1 style="margin: 0;">PandaDash</h1>
                <div style="margin-top: 6px; font-size: 13px; line-height: 1.3;">
                    <p style="margin: 2px 0;">Developed by Andrés Mendoza © 2025</p>
                    <p style="margin: 2px 0;">
                        Supported by 
                        <a href="https://www.eltemplodelamoda.com/" target="_blank" style="color: var(--primary); text-decoration: none; font-weight: 500;">
                            GrupoTDM
                        </a>
                    </p>
                    <div style="display: flex; justify-content: center; gap: 8px; margin-top: 6px;">
                        <a href="https://www.facebook.com/templodelamoda/" target="_blank" style="color: var(--primary);"><i class="fab fa-facebook"></i></a>
                        <a href="https://www.instagram.com/eltemplodelamoda/" target="_blank" style="color: var(--primary);"><i class="fab fa-instagram"></i></a>
                        <a href="https://wa.me/573176418529" target="_blank" style="color: var(--primary);"><i class="fab fa-whatsapp"></i></a>
                    </div>
                </div>
            </div>
        `;
    }

    showError(barcode, message = "Código no encontrado") {
        this.resultsDiv.innerHTML = `
            <div class="error">
                <i class="fas fa-times-circle"></i> ${message}: <strong>${barcode}</strong>
            </div>
        `;
    }

    updateStatus(className, html) {
        if (!this.statusDiv) return;
        this.statusDiv.className = className;
        this.statusDiv.innerHTML = html;
    }

    hideLoadingScreen() {
        this.scanner.style.display = 'flex';
        this.loadingScreen.style.opacity = '0';
        
        setTimeout(() => {
            this.loadingScreen.style.display = 'none';
            if (this.barcodeInput) {
                this.barcodeInput.focus();
            }
        }, 500);
    }

    // ========== CACHE Y ALMACENAMIENTO ==========

    getCachedData(key) {
        const cache = localStorage.getItem('pandadash_cache');
        if (!cache) return null;
        
        try {
            const parsed = JSON.parse(cache);
            if (Date.now() - parsed.timestamp > this.config.CACHE_TTL) return null;
            return parsed.data[key];
        } catch (e) {
            console.error("Error al parsear cache:", e);
            return null;
        }
    }

    setCachedData(key, data) {
        try {
            const existingCache = localStorage.getItem('pandadash_cache');
            const cache = existingCache ? JSON.parse(existingCache) : { data: {}, timestamp: Date.now() };
            
            cache.data[key] = data;
            cache.timestamp = Date.now();
            
            localStorage.setItem('pandadash_cache', JSON.stringify(cache));
        } catch (e) {
            console.error("Error al guardar en cache:", e);
        }
    }

    // ========== EVENTOS Y LISTENERS ==========

    enforceFocus() {
        const enforce = () => {
            if (document.activeElement !== this.barcodeInput && 
                document.getElementById('cameraModal').style.display !== 'flex') {
                this.barcodeInput.focus();
            }
            setTimeout(enforce, 100);
        };
        enforce();
    }

    handleOnline() {
        this.offlineBanner.style.display = 'none';
        this.updateStatus('reconnected', '<i class="fas fa-wifi"></i> CONEXIÓN RESTABLECIDA');
        
        if (!this.dataLoaded) {
            setTimeout(() => this.loadDataFromServer(), 1000);
        }
    }

    handleOffline() {
        this.offlineBanner.style.display = 'block';
        this.updateStatus('offline', `
            <div style="display: flex; align-items: center; justify-content: center; gap: 10px; text-align: center;">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-wifi-off" viewBox="0 0 16 16">
                    <path d="M10.706 3.294A12.6 12.6 0 0 0 8 3C5.259 3 2.723 3.882.663 5.379a.485.485 0 0 0-.048.736.52.52 0 0 0 .668.05A11.45 11.45 0 0 1 8 4q.946 0 1.852.148zM8 6c-1.905 0-3.68.56-5.166 1.526a.48.48 0 0 0-.063.745.525.525 0 0 0 .652.065 8.45 8.45 0 0 1 3.51-1.27zm2.596 1.404.785-.785q.947.362 1.785.907a.482.482 0 0 1 .063.745.525.525 0 0 1-.652.065 8.5 8.5 0 0 0-1.98-.932zM8 10l.933-.933a6.5 6.5 0 0 1 2.013.637c.285.145.326.524.1.75l-.015.015a.53.53 0 0 1-.611.09A5.5 5.5 0 0 0 8 10m4.905-4.905.747-.747q.886.451 1.685 1.03a.485.485 0 0 1 .047.737.52.52 0 0 1-.668.05 11.5 11.5 0 0 0-1.811-1.07M9.02 11.78c.238.14.236.464.04.66l-.707.706a.5.5 0 0 1-.707 0l-.707-.707c-.195-.195-.197-.518.04-.66A2 2 0 0 1 8 11.5c.374 0 .723.102 1.021.28zm4.355-9.905a.53.53 0 0 1 .75.75l-10.75 10.75a.53.53 0 0 1-.75-.75z"/>
                </svg>
                <span>MODO OFFLINE ACTIVO</span>
            </div>
        `);
    }

    setupPWAInstall() {
        let deferredPrompt;
        
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            this.installBtn.style.display = 'block';
        });
        
        this.installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const choiceResult = await deferredPrompt.userChoice;
                if (choiceResult.outcome === 'accepted') {
                    console.log('App instalada');
                }
                deferredPrompt = null;
                this.installBtn.style.display = 'none';
            }
        });
    }

    setupZoomPrevention() {
        document.addEventListener('gesturestart', (e) => e.preventDefault());
        
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) e.preventDefault();
            lastTouchEnd = now;
        }, { passive: false });
        
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && (e.key === '+' || e.key === '-' || e.key === '0')) {
                e.preventDefault();
            }
        });
    }

    setupPullToRefresh() {
        let startY = 0;
        let isPulling = false;
        
        document.addEventListener('touchstart', (e) => {
            if (e.touches.length >= 2 && window.scrollY < 10) {
                startY = e.touches[0].clientY;
                isPulling = true;
                e.preventDefault();
            }
        }, { passive: false });
        
        document.addEventListener('touchmove', (e) => {
            if (!isPulling || e.touches.length < 2) return;
            
            const currentY = e.touches[0].clientY;
            const pullDistance = currentY - startY;
            
            if (pullDistance > 20) {
                isPulling = false;
                this.refreshData();
                e.preventDefault();
            }
        }, { passive: false });
        
        document.addEventListener('touchend', () => {
            isPulling = false;
        });
    }

    async refreshData() {
        this.updateStatus('loading', '<i class="fas fa-sync fa-spin"></i> ACTUALIZANDO...');
        this.dataStats.innerHTML = '<i class="fas fa-server"></i> Conectando...';
        
        try {
            const newData = await this.fetchDataFromSheets();
            this.database = newData;
            this.dataLoaded = true;
            
            this.updateStatus('ready', '<i class="fas fa-check-circle"></i> DATOS ACTUALIZADOS');
            this.dataStats.innerHTML = `<i class="fas fa-database"></i> ${newData.length} registros | ${new Date().toLocaleTimeString()}`;
            
            if (this.currentQRParts) {
                this.processQRCodeParts(this.currentQRParts);
            } else {
                this.showWelcomeScreen();
            }
            
            this.playSuccessSound();
        } catch (error) {
            console.error("Error:", error);
            this.updateStatus('error', '<i class="fas fa-exclamation-circle"></i> ERROR');
            this.playErrorSound();
        }
    }

    // ========== NOTIFICACIONES Y SONIDOS ==========

    mostrarNotificacion(tipo, mensaje) {
        const notificacion = document.createElement('div');
        notificacion.className = `notificacion-${tipo}`;
        notificacion.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            ${tipo === 'success' ? 'background: #28a745;' : ''}
            ${tipo === 'warning' ? 'background: #ffc107; color: #000;' : ''}
            ${tipo === 'error' ? 'background: #dc3545;' : ''}
        `;
        notificacion.textContent = mensaje;

        document.body.appendChild(notificacion);

        setTimeout(() => {
            if (notificacion.parentNode) {
                notificacion.parentNode.removeChild(notificacion);
            }
        }, 5000);
    }

    mostrarError(mensaje) {
        console.error(mensaje);
        this.mostrarNotificacion('error', mensaje);
    }

    playSuccessSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)(); 
            const osc = ctx.createOscillator(); 
            const gainNode = ctx.createGain(); 
            osc.type = "sine"; 
            osc.frequency.value = 800; 
            gainNode.gain.value = 1; 
            osc.connect(gainNode); 
            gainNode.connect(ctx.destination); 
            osc.start(); 
            osc.stop(ctx.currentTime + 0.25);
        } catch (e) {
            console.log("Error al reproducir sonido de éxito:", e);
        }
    }

    playErrorSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)(); 
            const osc = ctx.createOscillator(); 
            const gainNode = ctx.createGain(); 
            osc.type = "sawtooth"; 
            osc.frequency.setValueAtTime(300, ctx.currentTime); 
            osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.5); 
            gainNode.gain.value = 0.8; 
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5); 
            osc.connect(gainNode); 
            gainNode.connect(ctx.destination); 
            osc.start(); 
            osc.stop(ctx.currentTime + 0.5);
        } catch (e) {
            console.log("Error al reproducir sonido de error:", e);
        }
    }
}

// ========== FUNCIONES GLOBALES ==========

// Función global para asentar facturas
async function asentarFactura(documento, lote, referencia, cantidad, factura, nit, btnElement) {
    if (!documento || !lote || !referencia || !cantidad || !factura || !nit) {
        mostrarErrorGlobal("Faltan datos obligatorios para asentar la factura");
        return;
    }
  
    if (btnElement) {
        btnElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ASENTANDO...';
        btnElement.style.backgroundColor = '#4cc9f0';
        btnElement.disabled = true;
    }
  
    actualizarEstadoGlobal('loading', '<i class="fas fa-sync fa-spin"></i> ASENTANDO FACTURA...');
  
    const formData = new FormData();
    formData.append('documento', documento);
    formData.append('lote', lote);
    formData.append('referencia', referencia);
    formData.append('cantidad', cantidad);
    formData.append('factura', factura);
    formData.append('nit', nit);
  
    try {
        const response = await fetch(app.config.API_URL_ASENTAR_FACTURA, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            if (btnElement) {
                btnElement.innerHTML = '<i class="fas fa-check-circle"></i> FACTURA ASENTADA';
                btnElement.style.backgroundColor = '#28a745';
                btnElement.disabled = true;
            }
            
            actualizarEstadoGlobal('processed', '<i class="fas fa-check-circle"></i> FACTURA ASENTADA CORRECTAMENTE');
            app.playSuccessSound();
        } else {
            if (btnElement) {
                btnElement.innerHTML = '<i class="fas fa-exclamation-triangle"></i> NO ENCONTRADO';
                btnElement.style.backgroundColor = '#f8961e';
                btnElement.disabled = false;
            }
            
            actualizarEstadoGlobal('warning', '<i class="fas fa-exclamation-triangle"></i> NO SE PUDO ASENTAR LA FACTURA');
            app.playErrorSound();
        }
    } catch (error) {
        console.error("Error al asentar factura:", error);
        
        if (btnElement) {
            btnElement.innerHTML = '<i class="fas fa-exclamation-circle"></i> ERROR';
            btnElement.style.backgroundColor = '#f72585';
            btnElement.disabled = false;
        }
        
        actualizarEstadoGlobal('error', `<i class="fas fa-exclamation-circle"></i> ERROR: ${error.message}`);
        app.playErrorSound();
    }
}

function mostrarErrorGlobal(mensaje) {
    console.error(mensaje);
    actualizarEstadoGlobal('error', `<span style="color: var(--danger)">${mensaje}</span>`);
}

function actualizarEstadoGlobal(className, html) {
    const statusDiv = document.getElementById('status');
    if (!statusDiv) return;
    statusDiv.className = className;
    statusDiv.innerHTML = html;
}

// ========== INICIALIZACIÓN ==========

// Crear instancia global
const app = new PandaDashApp();

// Hacer disponible globalmente
window.app = app;
window.procesarEntrega = (documento, lote, referencia, cantidad, factura, nit, btnElement) => {
    app.procesarEntrega(documento, lote, referencia, cantidad, factura, nit, btnElement);
};
window.asentarFactura = asentarFactura;

// Registrar Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js');
    });
}
