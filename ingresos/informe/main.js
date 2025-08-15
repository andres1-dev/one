// Configuración de APIs
const API_KEY = 'AIzaSyCrTSddJcCaJCqQ_Cr_PC2zt-eVZAihC38';
const SPREADSHEET_IDS = {
    DATA2: "133NiyjNApZGkEFs4jUvpJ9So-cSEzRVeW2FblwOCrjI",
    REC: "1esc5REq0c03nHLpGcLwZRW29yq2gZnrpbz75gCCjrqc",
    REC2024: "1Gzwybsv6KjGBDc6UeAo57AV5W0gK-bjWTA-AcKLJOlY",
    BUDGETID: "10P1BtnwjUrSuM4ZajAdUiHXNEzpi4H2zsJvQVYp5jtQ"
};

// Variables globales
let consolidatedData = [];
let budgetData = [];

/**
 * Función principal que genera el reporte completo
 * @param {Date|string} [targetDate] - Fecha objetivo (opcional, por defecto fecha actual)
 * @returns {Promise<Object>} Objeto JSON con el reporte completo
 */
async function generarReporteCompleto(targetDate = new Date()) {
    try {
        // 1. Cargar datos si no están en memoria
        if (consolidatedData.length === 0 || budgetData.length === 0) {
            await cargarDatosIniciales();
        }

        // 2. Validar y formatear fecha
        const fechaObj = parseDate(targetDate);
        if (!fechaObj) {
            throw new Error("Fecha no válida");
        }

        // 3. Generar reporte comparativo
        const reporte = await generateComparativeReport(fechaObj);

        return reporte;

    } catch (error) {
        console.error("Error en generarReporteCompleto:", error);
        throw error;
    }
}

// ================== FUNCIONES DE CARGA DE DATOS ==================

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

        // Procesar datos consolidados
        consolidatedData = procesarDatosConsolidados(validIncomeData, budget);
        budgetData = budget;

    } catch (error) {
        console.error("Error al cargar datos iniciales:", error);
        throw error;
    }
}

function procesarDatosConsolidados(incomeData, budget) {
    const groupedByDate = incomeData.reduce((acc, item) => {
        const fecha = item.FECHA;
        if (!fecha) return acc;
        if (!acc[fecha]) {
            acc[fecha] = { fecha, unidades: 0, count: 0 };
        }
        acc[fecha].unidades += item.CANTIDAD || 0;
        acc[fecha].count++;
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

        return {
            Fecha: formatDate(dateObj),
            Dia: diaSemana,
            Semana: semana,
            Mes: mes.toUpperCase(),
            Año: año,
            Ingreso: Math.round(item.unidades),
            Meta: Math.round(metaDiaria),
            Diferencia: Math.round(diferencia),
            Cumplimiento: cumplimiento
        };
    }).filter(item => item !== null)
    .sort((a, b) => parseDate(b.Fecha) - parseDate(a.Fecha));
}

// ================== FUNCIONES DE GENERACIÓN DE REPORTE ==================

async function generateComparativeReport(currentDate) {
    const currentYear = currentDate.getFullYear();
    const currentDateStr = formatDate(currentDate);

    // Buscar datos exactos o más cercanos
    let currentDayData = consolidatedData.find(d => 
        d.Fecha === currentDateStr && d.Año === currentYear
    );
    let closestDate = currentDate;

    if (!currentDayData) {
        closestDate = findClosestDateWithData(currentDate, currentYear, consolidatedData);
        if (!closestDate) {
            throw new Error(`No hay datos disponibles para fechas cercanas a ${currentDateStr}`);
        }
        const closestDateStr = formatDate(closestDate);
        currentDayData = consolidatedData.find(d => d.Fecha === closestDateStr && d.Año === currentYear);
    }

    // Obtener fecha equivalente en el año anterior
    const previousDate = getEquivalentPreviousYearDate(closestDate, consolidatedData);
    if (!previousDate) {
        throw new Error("No se encontraron datos para el año anterior");
    }

    const previousYear = previousDate.getFullYear();
    const previousDateStr = formatDate(previousDate);
    const previousDayData = consolidatedData.find(d => 
        d.Fecha === previousDateStr && d.Año === previousYear
    );

    // Filtrar datos por año
    const currentYearData = consolidatedData.filter(d => d.Año === currentYear);
    const previousYearData = consolidatedData.filter(d => d.Año === previousYear);

    // Generar reporte
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

    // Calcular gestiones
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
}

// ================== FUNCIONES AUXILIARES ==================

// Normalización de datos
function normalizeLinea(linea) {
    let normalized = linea.replace(/^LINEA\s*/i, '');
    return normalized.replace(/\s+/g, '').toUpperCase();
}

function normalizePVP(pvp) {
    return pvp.replace(/\$\s*/g, '').replace(/\./g, '').trim();
}

function normalizeDocumento(documento) {
    return documento.replace(/^REC/i, '');
}

// Manejo de fechas
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

function formatDate(date) {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    const offset = d.getTimezoneOffset() + 300;
    const colombiaTime = new Date(d.getTime() + offset * 60000);
    const day = String(colombiaTime.getDate()).padStart(2, '0');
    const month = String(colombiaTime.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${colombiaTime.getFullYear()}`;
}

function parseDate(dateStr) {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;
    if (dateStr.includes('/')) {
        const [day, month, year] = dateStr.split('/');
        return new Date(`${year}-${month}-${day}T00:00:00-05:00`);
    }
    if (dateStr.includes('-')) {
        return new Date(`${dateStr}T00:00:00-05:00`);
    }
    console.error(`Formato de fecha no reconocido: ${dateStr}`);
    return null;
}

// Validación de datos
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

// Funciones de clasificación
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

function getProveedorByLinea(linea) {
    return normalizeLinea(linea).includes('ANGELES') ? 
        'TEXTILES Y CREACIONES LOS ANGELES SAS' : 
        'TEXTILES Y CREACIONES EL UNIVERSO SAS';
}

function getClaseByPVP(pvp) {
    const valor = parseFloat(pvp);
    if (isNaN(valor)) return 'NO DEFINIDO';
    if (valor <= 39900) return 'LINEA';
    if (valor > 39900 && valor <= 59900) return 'MODA';
    if (valor > 59900) return 'PRONTAMODA';
    return 'NO DEFINIDO';
}

// Funciones de fecha avanzadas
function getNombreMes(fecha) {
    const meses = [
        'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
        'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
    ];
    try {
        const d = parseDate(fecha);
        return meses[d.getMonth()];
    } catch (e) {
        console.error(`Error al obtener mes de fecha: ${fecha}`, e);
        return 'ENERO';
    }
}

function getDiaSemana(fecha) {
    if (!fecha) return 'SIN FECHA';
    const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const d = parseDate(fecha);
    const offset = d.getTimezoneOffset() + 300;
    const colombiaTime = new Date(d.getTime() + offset * 60000);
    return dias[colombiaTime.getDay()] || 'SIN DÍA';
}

function getWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

function findClosestDateWithData(targetDate, year, data) {
    const targetDateStr = formatDate(targetDate);
    const targetTime = parseDate(targetDateStr).getTime();
    
    const exactMatch = data.find(d => {
        const dDate = parseDate(d.Fecha);
        return dDate && dDate.getTime() === targetTime && d.Año === year;
    });
    if (exactMatch) return parseDate(exactMatch.Fecha);

    let closestDate = null;
    let minDiff = Infinity;
    for (const item of data) {
        if (item.Año !== year) continue;
        const itemDate = parseDate(item.Fecha);
        if (!itemDate) continue;
        const diff = Math.abs(itemDate.getTime() - targetTime);
        if (diff < minDiff && diff <= 3 * 24 * 60 * 60 * 1000) {
            minDiff = diff;
            closestDate = itemDate;
        }
    }
    return closestDate;
}

function getEquivalentPreviousYearDate(currentDate, data) {
    const currentYear = currentDate.getFullYear();
    const previousYear = currentYear - 1;
    
    const sameDateLastYear = new Date(currentDate);
    sameDateLastYear.setFullYear(previousYear);
    
    const sameDateLastYearStr = formatDate(sameDateLastYear);
    const exactMatch = data.find(d => d.Fecha === sameDateLastYearStr && d.Año === previousYear);
    if (exactMatch) return parseDate(exactMatch.Fecha);
    
    return findClosestDateWithData(sameDateLastYear, previousYear, data);
}

// Funciones estadísticas
function calculateAverage(data) {
    if (data.length === 0) return 0;
    const sum = data.reduce((acc, d) => acc + d.Ingreso, 0);
    return Math.round(sum / data.length);
}

function calculateWeightedAvg(data) {
    if (data.length === 0) return 0;
    const weights = data.map(d => {
        const percent = parseFloat(d.Cumplimiento);
        return isNaN(percent) ? 0 : percent;
    });
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    if (totalWeight === 0) return 0;
    const weightedSum = data.reduce((sum, d, i) => {
        return sum + (d.Ingreso * (weights[i] / totalWeight));
    }, 0);
    return Math.round(weightedSum);
}

function calculateStdDev(data) {
    if (data.length === 0) return 0;
    const avg = calculateAverage(data);
    const squareDiffs = data.map(d => Math.pow(d.Ingreso - avg, 2));
    const divisor = data.length - 1;
    const variance = squareDiffs.reduce((sum, val) => sum + val, 0) / divisor;
    return Math.round(Math.sqrt(variance));
}

function findMax(data) {
    if (data.length === 0) return 0;
    return Math.max(...data.map(d => d.Ingreso));
}

function calculateGrowth(currentPercent, previousPercent) {
    if (!previousPercent || previousPercent === '0%') return null;
    const current = parseFloat(currentPercent);
    const previous = parseFloat(previousPercent);
    if (previous === 0) return null;
    const growth = ((current / previous) - 1) * 100;
    return growth.toFixed(2) + '%';
}

// ================== FUNCIONES DE API ==================

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

// ================== FUNCIONES DE MÉTRICAS ==================

function generateDayMetrics(dayData, date, fullYearData, isFromPreviousYear = false, currentAnalysisDate = null) {
    let weekData, previousWeekData;
    
    if (isFromPreviousYear && currentAnalysisDate) {
        const limitDate = new Date(currentAnalysisDate);
        limitDate.setFullYear(date.getFullYear());
        weekData = getWeekData(date, fullYearData, formatDate(limitDate));
        previousWeekData = getPreviousWeekData(date, fullYearData, formatDate(limitDate));
    } else {
        weekData = getWeekData(date, fullYearData);
        previousWeekData = getPreviousWeekData(date, fullYearData);
    }
    
    return {
        medicion: "dia",
        fecha: dayData.Fecha,
        registros: 1,
        meta: dayData.Meta,
        ingreso: dayData.Ingreso,
        diferencia: dayData.Diferencia,
        porcentaje: dayData.Cumplimiento,
        gestion: null,
        n_semana: dayData.Semana,
        dia_letras: dayData.Dia,
        mes: dayData.Mes,
        año: dayData.Año,
        promedio: calculateAverage([...weekData, ...previousWeekData]),
        ponderado: calculateWeightedAvg([...weekData, ...previousWeekData]),
        desvest: calculateStdDev([...weekData, ...previousWeekData]),
        max: findMax([...weekData, ...previousWeekData])
    };
}

function generatePeriodMetrics(type, date, fullYearData, isFromPreviousYear = false, currentAnalysisDate = null) {
    const monthName = getNombreMes(formatDate(date));
    const year = date.getFullYear();
    
    let periodData = type === 'mes' 
        ? fullYearData.filter(d => d.Mes === monthName && d.Año === year)
        : fullYearData.filter(d => d.Año === year);

    if (isFromPreviousYear && currentAnalysisDate) {
        const limitDate = new Date(currentAnalysisDate);
        limitDate.setFullYear(year);
        const limitDateStr = formatDate(limitDate);
        
        periodData = periodData.filter(d => {
            const dDate = parseDate(d.Fecha);
            return dDate && dDate <= parseDate(limitDateStr);
        });
    }

    const totalMeta = periodData.reduce((sum, d) => sum + d.Meta, 0);
    const totalIngreso = periodData.reduce((sum, d) => sum + d.Ingreso, 0);
    const diferencia = totalIngreso - totalMeta;
    const porcentaje = totalMeta > 0 ? ((totalIngreso / totalMeta) * 100).toFixed(2) + '%' : '0%';

    return {
        medicion: type,
        fecha: formatDate(date),
        registros: periodData.length,
        meta: Math.round(totalMeta),
        ingreso: Math.round(totalIngreso),
        diferencia: Math.round(diferencia),
        porcentaje: porcentaje,
        gestion: null,
        mes: monthName,
        año: year,
        promedio: calculateAverage(periodData),
        ponderado: calculateWeightedAvg(periodData),
        desvest: calculateStdDev(periodData),
        max: findMax(periodData)
    };
}

function getWeekData(date, data, limitDate = null) {
    const targetWeek = getWeekNumber(date);
    const targetYear = date.getFullYear();
    
    let weekData = data.filter(d => {
        const dDate = parseDate(d.Fecha);
        return dDate && getWeekNumber(dDate) === targetWeek && d.Año === targetYear;
    });
    
    if (limitDate) {
        const limitTime = parseDate(limitDate).getTime();
        weekData = weekData.filter(d => {
            const dDate = parseDate(d.Fecha);
            return dDate && dDate.getTime() <= limitTime;
        });
    }
    
    return weekData;
}

function getPreviousWeekData(date, data, limitDate = null) {
    const targetWeek = getWeekNumber(date) - 1;
    const targetYear = date.getFullYear();
    
    let weekData;
    
    if (targetWeek < 1) {
        weekData = data.filter(d => {
            const dDate = parseDate(d.Fecha);
            return dDate && getWeekNumber(dDate) === 52 && d.Año === targetYear - 1;
        });
    } else {
        weekData = data.filter(d => {
            const dDate = parseDate(d.Fecha);
            return dDate && getWeekNumber(dDate) === targetWeek && d.Año === targetYear;
        });
    }
    
    if (limitDate) {
        const limitTime = parseDate(limitDate).getTime();
        weekData = weekData.filter(d => {
            const dDate = parseDate(d.Fecha);
            return dDate && dDate.getTime() <= limitTime;
        });
    }
    
    return weekData;
}

// Exportar la función principal
export default generarReporteCompleto;

// Para usar en entorno no modular (ej. HTML directo)
if (typeof window !== 'undefined') {
    window.generarReporteCompleto = generarReporteCompleto;
}
