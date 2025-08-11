// sheets-api.js
const API_KEY = 'AIzaSyCrTSddJcCaJCqQ_Cr_PC2zt-eVZAihC38';
const SPREADSHEET_IDS = {
    REC: "1Gzwybsv6KjGBDc6UeAo57AV5W0gK-bjWTA-AcKLJOlY"
};

// ===== FUNCIONES AUXILIARES =====

// Normaliza nombre de línea
const normalizeLinea = (linea) => {
    let normalized = linea.replace(/^LINEA\s*/i, '');
    return normalized.replace(/\s+/g, '').toUpperCase();
};

// Quita símbolos y separadores de miles del PVP
const normalizePVP = (pvp) => pvp.replace(/\$\s*/g, '').replace(/\./g, '').trim();

// Determina clase según PVP
const getClaseByPVP = (pvp) => {
    const valor = parseFloat(pvp);
    if (isNaN(valor)) return 'NO DEFINIDO';

    if (valor <= 39900) return 'LINEA';
    if (valor <= 59900) return 'MODA';
    if (valor > 59900) return 'PRONTAMODA';

    return 'NO DEFINIDO';
};

// Convierte fecha DD/MM/YYYY → YYYY-MM-DD
const normalizeDate = (date) => {
    if (!date) return null;
    const [day, month, year] = date.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

// Quita prefijo "REC" del documento
const normalizeDocumento = (documento) => documento.replace(/^REC/i, '');

// Asigna gestor según línea
const getGestorByLinea = (linea) => {
    const normalizedLinea = normalizeLinea(linea);
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
        if (normalizedLinea.includes(key)) return value;
    }
    return 'GESTOR NO ASIGNADO';
};

// Asigna proveedor según línea
const getProveedorByLinea = (linea) => {
    return normalizeLinea(linea).includes('ANGELES') 
        ? 'TEXTILES Y CREACIONES LOS ANGELES SAS' 
        : 'TEXTILES Y CREACIONES EL UNIVERSO SAS';
};

// Verifica si un registro está anulado
const isAnulado = (item) => {
    const camposRequeridos = [
        'TALLER', 'LINEA', 'AUDITOR', 'ESCANER', 'LOTE', 
        'REFPROV', 'DESCRIPCIÓN', 'CANTIDAD', 'REFERENCIA',
        'TIPO', 'PVP', 'PRENDA', 'GENERO'
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
};

// ===== OBTENER DATOS DE REC =====
export const getREC = async () => {
    try {
        const range = "DataBase!A2:AF";
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_IDS.REC}/values/${range}?key=${API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.values || data.values.length === 0) {
            throw new Error("No se encontraron datos en la hoja DataBase");
        }

        return data.values
            .map(row => {
                if (!row[0] && !row[1]) return null;
                const linea = row[3] || '';

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
                    PVP: normalizePVP(row[31] || ''),
                    PRENDA: row[29] || '',
                    GENERO: row[30] || '',
                    GESTOR: getGestorByLinea(linea), 
                    PROVEEDOR: getProveedorByLinea(linea),
                    CLASE: getClaseByPVP(normalizePVP(row[31] || '')),
                    FUENTE: 'BUSINT'
                };
            })
            .filter(item => item !== null && item.DOCUMENTO !== '' && !isAnulado(item));
    } catch (error) {
        console.error("Error en getREC:", error);
        throw error;
    }
};
