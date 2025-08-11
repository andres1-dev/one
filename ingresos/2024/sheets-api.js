// sheets-api.js
const API_KEY = 'AIzaSyCrTSddJcCaJCqQ_Cr_PC2zt-eVZAihC38';
const SPREADSHEET_IDS = {
    REC: "1Gzwybsv6KjGBDc6UeAo57AV5W0gK-bjWTA-AcKLJOlY"
};

// Normaliza línea
const normalizeLinea = (linea = '') =>
    linea.replace(/^LINEA\s*/i, '').replace(/\s+/g, '').toUpperCase();

// Normaliza PVP
const normalizePVP = (pvp = '') =>
    String(pvp).replace(/\$\s*/g, '').replace(/\./g, '').trim();

// Clase por PVP
const getClaseByPVP = (pvp) => {
    const valor = parseFloat(pvp);
    if (isNaN(valor)) return 'NO DEFINIDO';
    if (valor <= 39900) return 'LINEA';
    if (valor <= 59900) return 'MODA';
    return 'PRONTAMODA';
};

// Fecha segura
const normalizeDate = (date) => {
    if (!date) return null;
    if (typeof date === 'string' && date.includes('/')) {
        const [day, month, year] = date.split('/');
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return date; // Si ya viene como YYYY-MM-DD o número
};

// Quita "REC" del documento
const normalizeDocumento = (documento = '') => String(documento).replace(/^REC/i, '');

// Gestor
const getGestorByLinea = (linea) => {
    const gestores = {
        'ANGELES': 'VILLAMIZAR GOMEZ LUIS',
        'MODAFRESCA': 'FABIAN MARIN FLOREZ',
        'BASICO': 'CESAR AUGUSTO LOPEZ GIRALDO',
        'INTIMA': 'KELLY GIOVANA ZULUAGA HOYOS',
        'URBANO': 'MARYI ANDREA GONZALEZ SILVA',
        'DEPORTIVO': 'JOHAN STEPHANIE ESPÍNOSA RAMIREZ',
        'PRONTAMODA': 'SANCHEZ LOPEZ YULIETH',
        'ESPECIALES': 'JUAN ESTEBAN ZULUAGA HOYOS',
        'BOGOTA': 'JUAN ESTEBAN ZULUAGA HOYOS',
        'DENIM': 'JUAN ESTEBAN ZULUAGA HOYOS',
        'NEBRASK': 'SANCHEZ LOPEZ YULIETH'

    };
    const normal = normalizeLinea(linea);
    for (const key in gestores) {
        if (normal.includes(key)) return gestores[key];
    }
    return 'GESTOR NO ASIGNADO';
};

// Proveedor
const getProveedorByLinea = (linea) =>
    normalizeLinea(linea).includes('ANGELES')
        ? 'TEXTILES Y CREACIONES LOS ANGELES SAS'
        : 'TEXTILES Y CREACIONES EL UNIVERSO SAS';

// Anulado
const isAnulado = (item) => {
    const campos = ['TALLER', 'LINEA', 'AUDITOR', 'ESCANER', 'LOTE', 'REFPROV', 'DESCRIPCIÓN', 'CANTIDAD', 'REFERENCIA', 'TIPO', 'PVP', 'PRENDA', 'GENERO'];
    let vacios = campos.filter(c => !item[c] || (typeof item[c] === 'string' && !item[c].trim())).length;
    return vacios > 4;
};

// Solo REC
export const getREC = async () => {
    try {
        const range = "DataBase!A2:AF";
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_IDS.REC}/values/${range}?key=${API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data.values || data.values.length === 0) {
            throw new Error("No se encontraron datos en la hoja DataBase");
        }

        console.log("Primer registro crudo:", data.values[0]); // 🔍 Debug

        return data.values
            .map(row => {
                if (!row[0] && !row[1]) return null;
                const linea = row[3] || '';
                return {
                    DOCUMENTO: normalizeDocumento(row[0]),
                    FECHA: normalizeDate(row[1]),
                    TALLER: row[2] || '',
                    LINEA: normalizeLinea(linea),
                    AUDITOR: row[4] || '',
                    ESCANER: row[5] || '',
                    LOTE: Number(row[8]) || 0,
                    REFPROV: row[6] || '',
                    DESCRIPCIÓN: row[9] || '',
                    CANTIDAD: Number(row[18]) || 0,
                    REFERENCIA: row[26] || '',
                    TIPO: row[27] || '',
                    PVP: normalizePVP(row[31]),
                    PRENDA: row[29] || '',
                    GENERO: row[30] || '',
                    GESTOR: getGestorByLinea(linea),
                    PROVEEDOR: getProveedorByLinea(linea),
                    CLASE: getClaseByPVP(normalizePVP(row[31])),
                    FUENTE: 'BUSINT'
                };
            })
            .filter(item => item && item.DOCUMENTO && !isAnulado(item));
    } catch (error) {
        console.error("Error en getREC:", error);
        throw error;
    }
};
