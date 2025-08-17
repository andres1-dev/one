// ================== CONSTANTES ==================
const API_KEY = 'AIzaSyCrTSddJcCaJCqQ_Cr_PC2zt-eVZAihC38';
const SPREADSHEET_IDS = {
    DATA2: "133NiyjNApZGkEFs4jUvpJ9So-cSEzRVeW2FblwOCrjI",
    REC: "1esc5REq0c03nHLpGcLwZRW29yq2gZnrpbz75gCCjrqc",
    REC2024: "1Gzwybsv6KjGBDc6UeAo57AV5W0gK-bjWTA-AcKLJOlY",
    BUDGETID: "10P1BtnwjUrSuM4ZajAdUiHXNEzpi4H2zsJvQVYp5jtQ"
};

// ================== FUNCIONES PRINCIPALES ==================

/**
 * Carga todos los datos iniciales necesarios
 * @returns {Promise<void>}
 */
async function cargarDatosIniciales() {
    try {
        const [mainData, recData, rec2024Data, budget] = await Promise.all([
            getParsedMainData(),
            getREC(),
            getREC2024(),
            getBudgetData()
        ]);

        const allIncomeData = [...mainData, ...recData, ...rec2024Data];
        const validIncomeData = allIncomeData.filter(item => !isAnulado(item));

        consolidatedData = procesarDatosConsolidados(validIncomeData, budget);
        budgetData = budget;
        
        initDetailedDataTable();
        initDateRangePicker();

    } catch (error) {
        console.error("Error al cargar datos iniciales:", error);
        throw error;
    }
}

/**
 * Genera un reporte completo para una fecha específica
 * @param {Date|string} targetDate - Fecha objetivo
 * @returns {Promise<Object>} Reporte completo
 */
async function generarReporteCompleto(targetDate = new Date()) {
    try {
        // 1. Validar y formatear fecha
        const fechaObj = parseDate(targetDate);
        if (!fechaObj) {
            throw new Error("Fecha no válida");
        }

        // 2. Buscar datos exactos o más cercanos
        let currentDayData = consolidatedData.find(d => 
            d.Fecha === formatDate(fechaObj) && d.Año === fechaObj.getFullYear()
        );
        let closestDate = fechaObj;

        if (!currentDayData) {
            closestDate = findClosestDateWithData(fechaObj, fechaObj.getFullYear(), consolidatedData);
            if (!closestDate) {
                throw new Error(`No hay datos disponibles para fechas cercanas a ${formatDate(fechaObj)}`);
            }
            const closestDateStr = formatDate(closestDate);
            currentDayData = consolidatedData.find(d => d.Fecha === closestDateStr && d.Año === fechaObj.getFullYear());
        }

        // 3. Obtener fecha equivalente en el año anterior
        const previousDate = getEquivalentPreviousYearDate(closestDate, consolidatedData);
        if (!previousDate) {
            throw new Error("No se encontraron datos para el año anterior");
        }

        const previousYear = previousDate.getFullYear();
        const previousDateStr = formatDate(previousDate);
        const previousDayData = consolidatedData.find(d => 
            d.Fecha === previousDateStr && d.Año === previousYear
        );

        // 4. Filtrar datos por año
        const currentYearData = consolidatedData.filter(d => d.Año === fechaObj.getFullYear());
        const previousYearData = consolidatedData.filter(d => d.Año === previousYear);

        // 5. Generar reporte
        const report = {
            filtros: {
                actual: formatDate(closestDate),
                anterior: previousDateStr
            },
            dia: {
                actual: generateDayMetrics(currentDayData, closestDate, currentYearData, false),
                anterior: previousDayData ? generateDayMetrics(
                    previousDayData, 
                    previousDate, 
                    previousYearData, 
                    true,
                    closestDate
                ) : null
            },
            mes: {
                actual: generatePeriodMetrics('mes', closestDate, currentYearData, false),
                anterior: generatePeriodMetrics('mes', previousDate, previousYearData, true, closestDate)
            },
            año: {
                actual: generatePeriodMetrics('año', closestDate, currentYearData, false),
                anterior: generatePeriodMetrics('año', previousDate, previousYearData, true, closestDate)
            }
        };

        // 6. Calcular gestiones comparativas
        if (report.dia.anterior) {
            report.dia.actual.gestion = calculateGrowth(
                report.dia.actual.porcentaje,
                report.dia.anterior.porcentaje
            );
        }
        if (report.mes.anterior) {
            report.mes.actual.gestion = calculateGrowth(
                report.mes.actual.porcentaje,
                report.mes.anterior.porcentaje
            );
        }
        if (report.año.anterior) {
            report.año.actual.gestion = calculateGrowth(
                report.año.actual.porcentaje,
                report.año.anterior.porcentaje
            );
        }

        return report;

    } catch (error) {
        console.error("Error en generarReporteCompleto:", error);
        throw error;
    }
}

// ================== FUNCIONES DE DATOS ==================

/**
 * Procesa los datos consolidados desde las hojas de cálculo
 * @param {Array} incomeData - Datos de ingresos
 * @param {Array} budget - Datos de presupuesto
 * @returns {Array} Datos consolidados procesados
 */
function procesarDatosConsolidados(incomeData, budget) {
    const groupedByDate = incomeData.reduce((acc, item) => {
        const fecha = item.FECHA;
        if (!fecha) return acc;
        
        if (!acc[fecha]) {
            acc[fecha] = {
                fecha, 
                unidades: 0, 
                count: 0,
                detalles: [],
                lineas: {},
                talleres: {},
                gestores: {},
                proveedores: {},
                clases: {},
                generos: {},
                prendas: {}
            };
        }
        
        acc[fecha].unidades += item.CANTIDAD || 0;
        acc[fecha].count++;
        
        // Agregar detalles completos
        acc[fecha].detalles.push({
            documento: item.DOCUMENTO,
            taller: item.TALLER,
            linea: item.LINEA,
            auditor: item.AUDITOR,
            escaner: item.ESCANER,
            refProv: item.REFPROV,
            cantidad: item.CANTIDAD,
            referencia: item.REFERENCIA,
            tipo: item.TIPO,
            pvp: item.PVP,
            prenda: item.PRENDA,
            genero: item.GENERO,
            gestor: item.GESTOR,
            proveedor: item.PROVEEDOR,
            clase: item.CLASE,
            fuente: item.FUENTE
        });
        
        // Agrupar por diferentes categorías
        ['LINEA', 'TALLER', 'GESTOR', 'PROVEEDOR', 'CLASE', 'GENERO', 'PRENDA'].forEach(campo => {
            const valor = item[campo];
            if (valor) {
                const key = campo.toLowerCase() + 's';
                if (!acc[fecha][key][valor]) {
                    acc[fecha][key][valor] = { unidades: 0, count: 0 };
                }
                acc[fecha][key][valor].unidades += item.CANTIDAD || 0;
                acc[fecha][key][valor].count++;
            }
        });
        
        return acc;
    }, {});

    return Object.values(groupedByDate).map(item => {
        const dateObj = parseDate(item.fecha);
        if (!dateObj) return null;

        const mes = getNombreMes(item.fecha);
        const diaSemana = getDiaSemana(item.fecha);
        const año = dateObj.getFullYear();
        const semana = getWeekNumber(dateObj);

        const budgetForMonth = budget.find(b => 
            b.MES.toUpperCase() === mes.toUpperCase() && 
            b.ANO === String(año)
        );

        const metaDiaria = budgetForMonth ? (budgetForMonth.TOTAL / budgetForMonth.HABILES) : 0;
        const diferencia = item.unidades - metaDiaria;
        const cumplimiento = metaDiaria > 0 ? (item.unidades / metaDiaria * 100).toFixed(2) + '%' : '0%';

        // Convertir objetos de agrupación a arrays
        const categorias = ['lineas', 'talleres', 'gestores', 'proveedores', 'clases', 'generos', 'prendas'];
        const resultado = {
            Fecha: formatDate(dateObj),
            Dia: diaSemana,
            Semana: semana,
            Mes: mes.toUpperCase(),
            Año: año,
            Ingreso: Math.round(item.unidades),
            Meta: Math.round(metaDiaria),
            Diferencia: Math.round(diferencia),
            Cumplimiento: cumplimiento,
            Detalles: item.detalles,
            TotalRegistros: item.count
        };

        categorias.forEach(cat => {
            resultado[cat.charAt(0).toUpperCase() + cat.slice(1)] = Object.entries(item[cat]).map(([nombre, datos]) => ({
                nombre,
                unidades: datos.unidades,
                registros: datos.count
            }));
        });

        return resultado;
    }).filter(item => item !== null)
    .sort((a, b) => parseDate(b.Fecha) - parseDate(a.Fecha));
}

// ================== FUNCIONES DE API ==================

/**
 * Obtiene los datos principales de la hoja DATA2
 * @returns {Promise<Array>} Datos parseados
 */
async function getParsedMainData() {
    try {
        const range = "DATA2!S2:S";
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_IDS.DATA2}/values/${range}?key=${API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data.values || data.values.length === 0) {
            throw new Error("No se encontraron datos en la hoja DATA2");
        }

        return data.values.map(row => {
            try {
                const jsonData = JSON.parse(row[0]);
                return {
                    DOCUMENTO: String(jsonData.A || ''),
                    FECHA: normalizeDate(jsonData.FECHA || ''),
                    TALLER: jsonData.TALLER || '',
                    LINEA: normalizeLinea(jsonData.LINEA || ''),
                    AUDITOR: jsonData.AUDITOR || '',
                    ESCANER: jsonData.ESCANER || '',
                    LOTE: Number(jsonData.LOTE) || 0,
                    REFPROV: String(jsonData.REFPROV || ''),
                    DESCRIPCIÓN: jsonData.DESCRIPCIÓN || '',
                    CANTIDAD: Number(jsonData.CANTIDAD) || 0,
                    REFERENCIA: jsonData.REFERENCIA || '',
                    TIPO: jsonData.TIPO || '',
                    PVP: normalizePVP(jsonData.PVP || ''),
                    PRENDA: jsonData.PRENDA || '',
                    GENERO: jsonData.GENERO || '',
                    GESTOR: jsonData.GESTOR || '',
                    PROVEEDOR: jsonData.PROVEEDOR || getProveedorByLinea(jsonData.LINEA || ''),
                    CLASE: getClaseByPVP(normalizePVP(jsonData.PVP || '')),
                    FUENTE: 'SISPRO',
                    ANO: '2025'
                };
            } catch (e) {
                console.error("Error al parsear JSON:", e);
                return null;
            }
        }).filter(item => item !== null);

    } catch (error) {
        console.error("Error en getParsedMainData:", error);
        throw error;
    }
}

/**
 * Obtiene datos de REC (2025)
 * @returns {Promise<Array>} Datos de REC
 */
async function getREC() {
    try {
        const range = "DataBase!A2:AF";
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_IDS.REC}/values/${range}?key=${API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data.values || data.values.length === 0) {
            throw new Error("No se encontraron datos en la hoja DataBase");
        }

        return data.values.map(row => {
            if (!row[0] && !row[1]) return null;
            const documento = String(row[0] || '');
            const linea = row[3] || '';
            return {
                DOCUMENTO: normalizeDocumento(documento),
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
                PVP: normalizePVP(row[31] || ''),
                PRENDA: row[29] || '',
                GENERO: row[30] || '',
                GESTOR: getGestorByLinea(linea),
                PROVEEDOR: getProveedorByLinea(linea),
                CLASE: getClaseByPVP(normalizePVP(row[31] || '')),
                FUENTE: 'BUSINT',
                ANO: '2025'
            };
        }).filter(item => item !== null && item.DOCUMENTO !== '');

    } catch (error) {
        console.error("Error en getREC:", error);
        throw error;
    }
}

/**
 * Obtiene datos de REC (2024)
 * @returns {Promise<Array>} Datos de REC 2024
 */
async function getREC2024() {
    try {
        const range = "DataBase!A2:AF";
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_IDS.REC2024}/values/${range}?key=${API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data.values || data.values.length === 0) {
            throw new Error("No se encontraron datos en la hoja DataBase de REC2024");
        }

        return data.values.map(row => {
            if (!row[0] && !row[1]) return null;
            const documento = String(row[0] || '');
            const linea = row[3] || '';
            return {
                DOCUMENTO: normalizeDocumento(documento),
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
                PVP: normalizePVP(row[31] || ''),
                PRENDA: row[29] || '',
                GENERO: row[30] || '',
                GESTOR: getGestorByLinea(linea),
                PROVEEDOR: getProveedorByLinea(linea),
                CLASE: getClaseByPVP(normalizePVP(row[31] || '')),
                FUENTE: 'BUSINT',
                ANO: '2024'
            };
        }).filter(item => item !== null && item.DOCUMENTO !== '');

    } catch (error) {
        console.error("Error en getREC2024:", error);
        throw error;
    }
}

/**
 * Obtiene datos de presupuesto
 * @returns {Promise<Array>} Datos de presupuesto
 */
async function getBudgetData() {
    try {
        const range2025 = "BUDGET2025!A1:L14";
        const range2024 = "BUDGET2024!A1:M14";
        
        const [response2025, response2024] = await Promise.all([
            fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_IDS.BUDGETID}/values/${range2025}?key=${API_KEY}`),
            fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_IDS.BUDGETID}/values/${range2024}?key=${API_KEY}`)
        ]);

        const [data2025, data2024] = await Promise.all([
            response2025.json(),
            response2024.json()
        ]);

        const lineas2025 = data2025.values[0].slice(1, -2);
        const budgets2025 = data2025.values.slice(1).map(row => {
            return {
                MES: row[0],
                ANO: '2025',
                TOTAL: Number(row[row.length - 2]) || 0,
                HABILES: Number(row[row.length - 1]) || 0,
                LINEAS: lineas2025.reduce((acc, linea, idx) => {
                    acc[linea] = Number(row[idx + 1]) || 0;
                    return acc;
                }, {})
            };
        });

        const lineas2024 = data2024.values[0].slice(1, -2);
        const budgets2024 = data2024.values.slice(1).map(row => {
            return {
                MES: row[0],
                ANO: '2024',
                TOTAL: Number(row[row.length - 2]) || 0,
                HABILES: Number(row[row.length - 1]) || 0,
                LINEAS: lineas2024.reduce((acc, linea, idx) => {
                    acc[linea] = Number(row[idx + 1]) || 0;
                    return acc;
                }, {})
            };
        });

        return [...budgets2025, ...budgets2024];
    } catch (error) {
        console.error("Error en getBudgetData:", error);
        throw error;
    }
}

// ================== FUNCIONES AUXILIARES ==================

/**
 * Normaliza el nombre de línea
 * @param {string} linea - Nombre de línea
 * @returns {string} Línea normalizada
 */
function normalizeLinea(linea) {
    let normalized = linea.replace(/^LINEA\s*/i, '');
    return normalized.replace(/\s+/g, '').toUpperCase();
}

/**
 * Normaliza valores PVP
 * @param {string} pvp - Valor PVP
 * @returns {string} PVP normalizado
 */
function normalizePVP(pvp) {
    return pvp.replace(/\$\s*/g, '').replace(/\./g, '').trim();
}

/**
 * Normaliza números de documento
 * @param {string} documento - Número de documento
 * @returns {string} Documento normalizado
 */
function normalizeDocumento(documento) {
    return documento.replace(/^REC/i, '');
}

/**
 * Normaliza fechas a formato ISO
 * @param {string} date - Fecha a normalizar
 * @returns {string|null} Fecha normalizada o null
 */
function normalizeDate(date) {
    if (!date) return null;
    if (date.includes('/')) {
        const [day, month, year] = date.split('/');
        const dd = day.padStart(2, '0');
        const mm = month.padStart(2, '0');
        return new Date(`${year}-${mm}-${dd}T00:00:00-05:00`).toISOString().split('T')[0];
    }
    if (date.includes('-')) {
        return new Date(`${date}T00:00:00-05:00`).toISOString().split('T')[0];
    }
    return null;
}

/**
 * Determina si un registro está anulado
 * @param {Object} item - Registro a evaluar
 * @returns {boolean} True si está anulado
 */
function isAnulado(item) {
    const camposRequeridos = [
        'TALLER', 'LINEA', 'AUDITOR', 'ESCANER', 'LOTE', 'REFPROV', 'DESCRIPCIÓN',
        'CANTIDAD', 'REFERENCIA', 'TIPO', 'PVP', 'PRENDA', 'GENERO'
    ];
    let camposVacios = 0;
    for (const campo of camposRequeridos) {
        if (!item[campo] || 
            (typeof item[campo] === 'number' && item[campo] === 0) ||
            (typeof item[campo] === 'string' && item[campo].trim() === '')) {
            camposVacios++;
            if (camposVacios > 4) return true;
        }
    }
    return camposVacios > 4;
}

/**
 * Obtiene el gestor según la línea
 * @param {string} linea - Línea de producto
 * @returns {string} Nombre del gestor
 */
function getGestorByLinea(linea) {
    const normalizedLinea = normalizeLinea(linea);
    const gestores = {
        'ANGELES': 'VILLAMIZAR GOMEZ LUIS',
        'MODAFRESCA': 'FABIAN MARIN FLOREST',
        'BASICO': 'CESAR AUGUSTO LOPEZ GIRALDO',
        'INTIMA': 'KELLY GIOVANA ZULUAGA HOYOS',
        'URBANO': 'MARYI ANDREA GONZALEZ SILVA',
        'DEPORTIVO': 'JOHAN STEPHANIE ESPINOSA RAMIREZ',
        'PRONTAMODA': 'SANCHEZ LOPEZ YULIETH',
        'ESPECIALES': 'JUAN ESTEBAN ZULUAGA HOYOS',
        'BOGOTA': 'JUAN ESTEBAN ZULUAGA HOYOS',
        'DENIM': 'JUAN ESTEBAN ZULUAGA HOYOS',
        'NEBRASK': 'SANCHEZ LOPEZ YULIETH'
    };
    for (const [key, value] of Object.entries(gestores)) {
        if (normalizedLinea.includes(key)) return value;
    }
    return 'GESTOR NO ASIGNADO';
}

/**
 * Obtiene el proveedor según la línea
 * @param {string} linea - Línea de producto
 * @returns {string} Nombre del proveedor
 */
function getProveedorByLinea(linea) {
    return normalizeLinea(linea).includes('ANGELES') ? 
        'TEXTILES Y CREACIONES LOS ANGELES SAS' : 
        'TEXTILES Y CREACIONES EL UNIVERSO SAS';
}

/**
 * Determina la clase según el PVP
 * @param {string} pvp - Valor PVP
 * @returns {string} Clase del producto
 */
function getClaseByPVP(pvp) {
    const valor = parseFloat(pvp);
    if (isNaN(valor)) return 'NO DEFINIDO';
    if (valor <= 39900) return 'LINEA';
    if (valor > 39900 && valor <= 59900) return 'MODA';
    if (valor > 59900) return 'PRONTAMODA';
    return 'NO DEFINIDO';
}
