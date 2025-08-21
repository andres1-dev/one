// ================== FUNCIONES DE UTILIDAD ==================

// Formato con separador de miles
const formatoCantidad = num => {
    if (typeof num === 'string') {
        const numValue = parseFloat(num.replace(/\./g, '').replace(',', '.'));
        return !isNaN(numValue) ? numValue.toLocaleString("es-ES") : num;
    }
    return num.toLocaleString("es-ES");
};

// Función para extraer el valor numérico de un porcentaje
const extraerPorcentaje = porcentajeStr => {
    if (!porcentajeStr) return 0;
    const match = porcentajeStr.match(/(\d+\.?\d*)/);
    return match ? parseFloat(match[0]) : 0;
};

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

// Validación de datos
function isAnulado(item) {
    const camposRequeridos = [
        'CANTIDAD'
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

// Función para encontrar la fecha más cercana con datos
function findClosestDateWithData(targetDate, year, data) {
    const targetTime = parseDate(targetDate).getTime();
    const yearData = data.filter(d => d.Año === year);
    
    if (yearData.length === 0) return null;
    
    // Buscar coincidencia exacta
    const exactMatch = yearData.find(d => {
        const dDate = parseDate(d.Fecha);
        return dDate && dDate.getTime() === targetTime;
    });
    if (exactMatch) return { date: parseDate(exactMatch.Fecha), isExact: true, data: exactMatch };
    
    // Encontrar la fecha más cercana (anterior o posterior)
    let closestBefore = null;
    let closestAfter = null;
    
    yearData.forEach(item => {
        const itemDate = parseDate(item.Fecha);
        if (!itemDate) return;
        
        const itemTime = itemDate.getTime();
        const diff = itemTime - targetTime;
        
        if (diff < 0) { // Fecha anterior
            if (!closestBefore || itemTime > parseDate(closestBefore.Fecha).getTime()) {
                closestBefore = item;
            }
        } else { // Fecha posterior
            if (!closestAfter || itemTime < parseDate(closestAfter.Fecha).getTime()) {
                closestAfter = item;
            }
        }
    });
    
    // Determinar la más cercana
    if (closestBefore && closestAfter) {
        const beforeDiff = targetTime - parseDate(closestBefore.Fecha).getTime();
        const afterDiff = parseDate(closestAfter.Fecha).getTime() - targetTime;
        
        if (beforeDiff < afterDiff) {
            return { date: parseDate(closestBefore.Fecha), isExact: false, data: closestBefore };
        } else if (afterDiff < beforeDiff) {
            return { date: parseDate(closestAfter.Fecha), isExact: false, data: closestAfter };
        } else {
            // Empate - elegir el con más unidades
            return closestBefore.Ingreso >= closestAfter.Ingreso 
                ? { date: parseDate(closestBefore.Fecha), isExact: false, data: closestBefore }
                : { date: parseDate(closestAfter.Fecha), isExact: false, data: closestAfter };
        }
    } else if (closestBefore) {
        return { date: parseDate(closestBefore.Fecha), isExact: false, data: closestBefore };
    } else if (closestAfter) {
        return { date: parseDate(closestAfter.Fecha), isExact: false, data: closestAfter };
    }
    
    return null;
}

function getEquivalentPreviousYearDate(currentDate, data) {
    const currentYear = currentDate.getFullYear();
    const previousYear = currentYear - 1;
    
    const sameDateLastYear = new Date(currentDate);
    sameDateLastYear.setFullYear(previousYear);
    
    const sameDateLastYearStr = formatDate(sameDateLastYear);
    const exactMatch = data.find(d => d.Fecha === sameDateLastYearStr && d.Año === previousYear);
    if (exactMatch) return parseDate(exactMatch.Fecha);
    
    const closest = findClosestDateWithData(sameDateLastYear, previousYear, data);
    return closest ? closest.date : null;
}
