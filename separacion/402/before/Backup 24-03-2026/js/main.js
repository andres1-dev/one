let datosGlobales = [];

// Función para cargar los datos desde la API
async function cargarDatos() {
    document.getElementById("loader").style.display = "block";
    document.getElementById("resultado").innerHTML = "<p>Cargando datos...</p>";

    try {
        // Configuración
        const SPREADSHEET_IDS = {
            main: "133NiyjNApZGkEFs4jUvpJ9So-cSEzRVeW2FblwOCrjI",
            rec: "1esc5REq0c03nHLpGcLwZRW29yq2gZnrpbz75gCCjrqc",
            clientes: "1d5dCCCgiWXfM6vHu3zGGKlvK2EycJtT7Uk4JqUjDOfE"
        };
        const API_KEY = 'AIzaSyC7hjbRc0TGLgImv8gVZg8tsOeYWgXlPcM';

        // Función para obtener datos de la hoja
        async function fetchSheetData(spreadsheetId, range) {
            const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${API_KEY}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Error al obtener ${range}`);
            const data = await response.json();
            return data.values || [];
        }

        // Funciones de normalización
        function normalizeDocumento(documento) {
            return documento.replace(/^REC/i, '').trim();
        }

        function normalizeLinea(linea) {
            return linea.replace(/^LINEA\s*/i, '').replace(/\s+/g, '').toUpperCase();
        }

        function normalizePVP(pvp) {
            return pvp.replace(/\$\s*/g, '').replace(/\./g, '').trim();
        }

        function normalizeDate(dateStr) {
            if (!dateStr || !dateStr.includes('/')) return null;
            const [dd, mm, yyyy] = dateStr.split('/');
            return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
        }

        function getClaseByPVP(pvp) {
            const valor = parseFloat(pvp);
            if (isNaN(valor)) return 'NO DEFINIDO';
            if (valor <= 39900) return 'LINEA';
            if (valor <= 59900) return 'MODA';
            if (valor > 59900) return 'PRONTAMODA';
            return 'NO DEFINIDO';
        }

        function getGestorByLinea(linea) {
            const normalized = normalizeLinea(linea);
            const gestores = {
                'ANGELES': 'VILLAMIZAR GOMEZ LUIS',
                'MODAFRESCA': 'FABIAN MARIN FLOREZ',
                'BASICO': 'CESAR AUGUSTO LOPEZ GIRALDO',
                'INTIMA': 'KELLY GIOVANA ZULUAGA HOYOS',
                'URBANO': 'MARYI ANDREA GONZALEZ SILVA',
                'DEPORTIVO': 'JOHAN STEPHANIE ESPÍNOSA RAMIREZ',
                'PRONTAMODA': 'SANCHEZ LOPEZ YULIETH',
                'ESPECIALES': 'JUAN ESTEBAN ZULUAGA HOYOS',
                'BOGOTA': 'JUAN ESTEBAN ZULUAGA HOYOS'
            };

            for (const [key, value] of Object.entries(gestores)) {
                if (normalized.includes(key)) return value;
            }
            return 'GESTOR NO ASIGNADO';
        }

        function getProveedorByLinea(linea) {
            return normalizeLinea(linea).includes('ANGELES')
                ? 'TEXTILES Y CREACIONES LOS ANGELES SAS'
                : 'TEXTILES Y CREACIONES EL UNIVERSO SAS';
        }

        function parseHRStringOptimized(hrString) {
            if (!hrString) return [];
            const result = [];
            const entries = hrString.split('☬');

            for (const entry of entries) {
                const parts = entry.split('∞');
                if (parts.length !== 4) continue;

                const cantidad = Number(parts[3]);
                if (isNaN(cantidad)) continue;

                result.push([
                    String(parts[0] || '').trim(),
                    String(parts[1] || '').trim(),
                    String(parts[2] || '').trim(),
                    cantidad
                ]);
            }

            return result;
        }

        function isAnuladoOptimized(item) {
            const camposRequeridos = [
                'TALLER', 'LINEA', 'AUDITOR', 'ESCANER', 'LOTE',
                'REFPROV', 'DESCRIPCIÓN', 'CANTIDAD', 'REFERENCIA',
                'TIPO', 'PVP', 'PRENDA', 'GENERO'
            ];
            let vacios = 0;

            for (const campo of camposRequeridos) {
                const valor = item[campo];
                if (!valor || (typeof valor === 'string' && valor.trim() === '') || (typeof valor === 'number' && valor === 0)) {
                    vacios++;
                    if (vacios > 4) return true;
                }
            }
            return false;
        }

        // Procesamiento de datos
        async function getAllSpreadsheetData() {
            const [data2Values, recValues, clientesValues, dataValues] = await Promise.all([
                fetchSheetData(SPREADSHEET_IDS.main, "DATA2!S2:S"),
                fetchSheetData(SPREADSHEET_IDS.rec, "DataBase!A2:AG"),
                fetchSheetData(SPREADSHEET_IDS.clientes, "CLIENTES!A2:I"),
                fetchSheetData(SPREADSHEET_IDS.clientes, "DATA!A2:K") // Updated to A2:K for unified access
            ]);

            // Expose the raw data for documents-table3.js
            window.datosTablaDocumentos = dataValues;
            console.log("Datos brutos de DATA cargados globalmente (cols A-K):", dataValues ? dataValues.length : 0);

            return { data2Values, recValues, clientesValues, dataValues };
        }

        function processDistribucionAndColaboradorData(values) {
            const clienteDistribucionMap = {};
            const colaboradorMap = {};

            for (const row of values) {
                const documento = String(row[0] || '').trim();

                if (documento && row[4]) {
                    colaboradorMap[documento] = row[4];
                }

                if (documento && row[2]) {
                    try {
                        const parsed = JSON.parse(row[2]);
                        if (parsed.Clientes) {
                            clienteDistribucionMap[documento] = parsed.Clientes;
                        }
                    } catch (e) {
                        console.error("Error parseando JSON de distribución:", e.message, "Documento:", documento);
                    }
                }
            }

            return { clienteDistribucionMap, colaboradorMap };
        }

        function processClientesData(values) {
            const clientesMap = {};

            for (const row of values) {
                const id = String(row[0] || '').trim();
                if (id) {
                    clientesMap[id] = {
                        id: id,
                        razonSocial: row[1] || '',
                        nombreCorto: row[2] || '',
                        tipoCliente: row[3] || '',
                        estado: row[4] || '',
                        direccion: row[5] || '',
                        telefono: row[6] || '',
                        email: row[7] || '',
                        tipoEmpresa: row[8] || ''
                    };
                }
            }

            return clientesMap;
        }

        function processMainDataOptimized(values) {
            return values.map(row => {
                try {
                    const jsonData = JSON.parse(row[0]);
                    const rawPVP = normalizePVP(jsonData.PVP || '');

                    return {
                        DOCUMENTO: String(jsonData.A || ''),
                        FECHA: normalizeDate(jsonData.FECHA || ''),
                        TALLER: jsonData.TALLER || '',
                        LINEA: normalizeLinea(jsonData.LINEA || ''),
                        AUDITOR: jsonData.AUDITOR || '',
                        ESCANER: jsonData.ESCANER || '',
                        LOTE: Number(jsonData.LOTE) || 0,
                        REFPROV: String(jsonData.REFPROV || ''),
                        DESCRIPCIÓN: jsonData.DESCRIPCIÓN_LARGA || '',
                        CANTIDAD: Number(jsonData.CANTIDAD) || 0,
                        REFERENCIA: jsonData.REFERENCIA || '',
                        TIPO: jsonData.TIPO || '',
                        PVP: rawPVP,
                        PRENDA: jsonData.PRENDA || '',
                        GENERO: jsonData.GENERO || '',
                        GESTOR: jsonData.GESTOR || '',
                        PROVEEDOR: jsonData.PROVEEDOR || getProveedorByLinea(jsonData.LINEA || ''),
                        CLASE: getClaseByPVP(rawPVP),
                        HR: jsonData.HR,
                        ANEXOS: jsonData.ANEXOS,
                        REC: jsonData.A // Mantener compatibilidad con tu código original
                    };
                } catch (e) {
                    console.error("Error al parsear JSON:", e.message, row[0]);
                    return null;
                }
            }).filter(item => item !== null);
        }

        function processRecDataOptimized(values) {
            return values.map(row => {
                if (!row[0] && !row[1]) return null;

                const linea = row[3] || '';
                const rawPVP = normalizePVP(row[31] || '');

                return {
                    DOCUMENTO: normalizeDocumento(String(row[0] || '')),
                    FECHA: normalizeDate(row[1] || ''),
                    TALLER: row[2] || '',
                    LINEA: normalizeLinea(linea),
                    AUDITOR: row[4] || '',
                    ESCANER: row[5] || '',
                    LOTE: Number(row[8]) || 0,
                    REFPROV: String(row[6] || ''),
                    DESCRIPCIÓN: row[9] || '',
                    CANTIDAD: Number(row[18]) || 0,
                    REFERENCIA: row[26] || '',
                    TIPO: row[27] || '',
                    PVP: rawPVP,
                    PRENDA: row[29] || '',
                    GENERO: row[30] || '',
                    GESTOR: getGestorByLinea(linea),
                    PROVEEDOR: getProveedorByLinea(linea),
                    CLASE: getClaseByPVP(rawPVP),
                    FUENTE: "BUSINT",
                    HR: parseHRStringOptimized(row[32] || ''),
                    REC: Number(normalizeDocumento(String(row[0] || ''))) || 0 // Mantener compatibilidad
                };
            }).filter(item => item !== null && item.DOCUMENTO !== '');
        }

        function enrichSingleClient(clienteData, clientesDataMap) {
            const clienteId = clienteData.id;

            if (clientesDataMap[clienteId]) {
                return {
                    ...clientesDataMap[clienteId],
                    distribucion: clienteData.distribucion || []
                };
            }

            return {
                id: clienteId,
                nombre: clienteData.nombre || '',
                razonSocial: clienteData.nombre || '',
                distribucion: clienteData.distribucion || []
            };
        }

        function enrichClientesData(clientesDistribucion, clientesData) {
            const enriched = {};

            for (const [nombreCliente, datosCliente] of Object.entries(clientesDistribucion)) {
                const clienteId = datosCliente.id;

                if (clientesData[clienteId]) {
                    enriched[nombreCliente] = {
                        ...clientesData[clienteId],
                        distribucion: datosCliente.distribucion || []
                    };

                    if (datosCliente.porcentaje) {
                        enriched[nombreCliente].porcentaje = datosCliente.porcentaje;
                    }
                } else {
                    enriched[nombreCliente] = {
                        id: clienteId,
                        nombre: nombreCliente,
                        razonSocial: datosCliente.nombre || nombreCliente,
                        distribucion: datosCliente.distribucion || [],
                        ...datosCliente
                    };
                }
            }

            return enriched;
        }

        function enrichItem(item, clienteDistribucionMap, clientesDataMap, colaboradorMap, fuente) {
            const docKey = String(item.DOCUMENTO).trim();

            if (clienteDistribucionMap[docKey]) {
                item.CLIENTES = enrichClientesData(clienteDistribucionMap[docKey], clientesDataMap);
            }

            if (colaboradorMap[docKey]) {
                item.COLABORADOR = colaboradorMap[docKey];
            }

            item.FUENTE = fuente;
            item.GESTOR = item.GESTOR || getGestorByLinea(item.LINEA);
            item.PROVEEDOR = item.PROVEEDOR || getProveedorByLinea(item.LINEA);

            return item;
        }

        function processBusintData(busintData, clienteDistribucionMap, clientesDataMap, colaboradorMap) {
            const busintMap = new Map();
            const busintFinal = [];
            const clientesEspeciales = {
                "ESTEBAN": { nombre: "Esteban", nit: "1007348825" },
                "JESUS": { nombre: "Jesús", nit: "70825517" },
                "ALEX": { nombre: "Alex", nit: "14838951" },
                "RUBEN": { nombre: "Ruben", nit: "901920844" }
            };

            // Agrupar por LOTE
            for (const item of busintData) {
                const lote = item.LOTE;
                if (!busintMap.has(lote)) busintMap.set(lote, []);
                busintMap.get(lote).push(item);
            }

            // Procesar cada grupo
            for (const [lote, registros] of busintMap.entries()) {
                const fulls = registros.filter(r => r.TIPO === 'FULL');
                const anexos = registros.filter(r => r.TIPO !== 'FULL');

                for (const full of fulls) {
                    const docKey = String(full.DOCUMENTO).trim();
                    const principal = {
                        ...full,
                        FUENTE: "BUSINT",
                        GESTOR: getGestorByLinea(full.LINEA),
                        PROVEEDOR: getProveedorByLinea(full.LINEA),
                    };

                    if (colaboradorMap[docKey]) {
                        principal.COLABORADOR = colaboradorMap[docKey];
                    }

                    let totalCantidad = 0;
                    if (principal.HR && principal.HR.length > 0) {
                        totalCantidad += principal.HR.reduce((sum, item) => sum + (item[3] || 0), 0);
                    }

                    const anexosNormales = [];
                    const pendientesMap = new Map();
                    const clientesEspecialesData = {};

                    for (const anexo of anexos) {
                        const nombreAnexo = (anexo.TIPO || '').toUpperCase();

                        // Procesar clientes especiales
                        if (clientesEspeciales[nombreAnexo]) {
                            const clienteInfo = clientesEspeciales[nombreAnexo];

                            if (Array.isArray(anexo.HR) && anexo.HR.length > 0) {
                                const distribucion = anexo.HR.map(([codigo, color, talla, cantidad]) => {
                                    const cant = Number(cantidad) || 0;
                                    totalCantidad += cant;
                                    return {
                                        codigo: String(codigo || '').trim(),
                                        color: String(color || '').trim(),
                                        talla: String(talla || '').trim(),
                                        cantidad: cant
                                    };
                                });

                                clientesEspecialesData[nombreAnexo] = enrichSingleClient({
                                    id: clienteInfo.nit,
                                    nombre: clienteInfo.nombre,
                                    distribucion: distribucion
                                }, clientesDataMap);
                            }
                            continue;
                        }

                        if (nombreAnexo === 'PENDIENTES') {
                            if (Array.isArray(anexo.HR) && anexo.HR.length > 0) {
                                for (const [codigo, color, talla, cantidad] of anexo.HR) {
                                    const key = `${codigo}-${color}-${talla}`;
                                    const current = pendientesMap.get(key) || 0;
                                    const cant = Number(cantidad) || 0;
                                    pendientesMap.set(key, current + cant);
                                }
                            }
                            continue;
                        }

                        if (Array.isArray(anexo.HR) && anexo.HR.length > 0) {
                            anexosNormales.push(...anexo.HR.map(([codigo, color, talla, cantidad]) => {
                                const cant = Number(cantidad) || 0;
                                totalCantidad += cant;
                                return {
                                    DOCUMENTO: anexo.REFPROV || '',
                                    CODIGO: codigo,
                                    COLOR: color,
                                    TALLA: talla,
                                    TIPO: anexo.TIPO || '',
                                    CANTIDAD: cant,
                                    REC: Number(anexo.DOCUMENTO) || ''
                                };
                            }));
                        }
                    }

                    // Agregar clientes especiales enriquecidos a CLIENTES
                    if (Object.keys(clientesEspecialesData).length > 0) {
                        if (!principal.CLIENTES) principal.CLIENTES = {};

                        for (const [nombre, data] of Object.entries(clientesEspecialesData)) {
                            const nombreFormateado = nombre.charAt(0) + nombre.slice(1).toLowerCase();
                            principal.CLIENTES[nombreFormateado] = data;
                        }
                    }

                    // Consolidar PENDIENTES con HR existente
                    if (pendientesMap.size > 0) {
                        const hrMap = new Map();

                        if (principal.HR && principal.HR.length > 0) {
                            for (const [codigo, color, talla, cantidad] of principal.HR) {
                                const key = `${codigo}-${color}-${talla}`;
                                hrMap.set(key, { codigo, color, talla, cantidad });
                            }
                        }

                        for (const [key, cantidadPendiente] of pendientesMap.entries()) {
                            const [codigo, color, talla] = key.split('-');
                            const itemKey = `${codigo}-${color}-${talla}`;

                            if (hrMap.has(itemKey)) {
                                const item = hrMap.get(itemKey);
                                item.cantidad += cantidadPendiente;
                            } else {
                                hrMap.set(itemKey, {
                                    codigo: String(codigo || '').trim(),
                                    color: String(color || '').trim(),
                                    talla: String(talla || '').trim(),
                                    cantidad: Number(cantidadPendiente)
                                });
                            }

                            totalCantidad += cantidadPendiente;
                        }

                        principal.HR = Array.from(hrMap.values()).map(item => [
                            item.codigo,
                            item.color,
                            item.talla,
                            item.cantidad
                        ]);
                    }

                    // Actualizar la cantidad total
                    principal.CANTIDAD = totalCantidad;

                    // Agregar anexos normales
                    if (anexosNormales.length > 0) {
                        principal.ANEXOS = anexosNormales;
                    }

                    // Mantener clientes de distribución original si existen
                    if (clienteDistribucionMap[docKey]) {
                        principal.CLIENTES = {
                            ...principal.CLIENTES,
                            ...enrichClientesData(clienteDistribucionMap[docKey], clientesDataMap)
                        };
                    }

                    busintFinal.push(principal);
                }
            }

            return busintFinal;
        }

        // Proceso principal
        const { data2Values, recValues, clientesValues, dataValues } = await getAllSpreadsheetData();
        const { clienteDistribucionMap, colaboradorMap } = processDistribucionAndColaboradorData(dataValues);
        const clientesDataMap = processClientesData(clientesValues);

        // Procesar datos SISPRO
        const sisproData = processMainDataOptimized(data2Values)
            .filter(item => !isAnuladoOptimized(item))
            .map(item => enrichItem(item, clienteDistribucionMap, clientesDataMap, colaboradorMap, "SISPRO"));

        // Procesar datos BUSINT
        const busintData = processRecDataOptimized(recValues)
            .filter(item => !isAnuladoOptimized(item));

        const busintFinal = processBusintData(
            busintData,
            clienteDistribucionMap,
            clientesDataMap,
            colaboradorMap
        );

        // Combinar resultados
        const resultadoFinal = [...sisproData, ...busintFinal].map(item => {
            // Mantener estructura compatible con tu código original
            return {
                ...item,
                REC: item.DOCUMENTO, // Para mantener compatibilidad
                COLABORADOR: item.COLABORADOR || '', // Asegurar que existe
                DESCRIPCION: item.DESCRIPCIÓN, // Mantener ambos nombres
                DISTRIBUCION: {
                    Documento: item.DOCUMENTO,
                    Clientes: item.CLIENTES || {},
                    Colaborador: item.COLABORADOR || ''
                }
            };
        });

        // Almacenar datos globalmente y actualizar UI
        datosGlobales = resultadoFinal;
        document.getElementById("loader").style.display = "none";
        document.getElementById("resultado").innerHTML = "<p>Datos cargados correctamente. Ingrese un documento para buscar.</p>";

        return resultadoFinal;
    } catch (error) {
        document.getElementById("loader").style.display = "none";
        document.getElementById("resultado").innerHTML = `<p>Error al cargar datos: ${error.message}</p>`;
        throw error;
    }
}

// Cargar los datos al iniciar la página y exponer la promesa
window.loaderPromise = cargarDatos();
