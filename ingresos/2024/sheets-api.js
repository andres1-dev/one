// sheets-api.js
const API_KEY = 'AIzaSyCrTSddJcCaJCqQ_Cr_PC2zt-eVZAihC38';
const SPREADSHEET_IDS = {
    DATA2: "",
    REC: "1Gzwybsv6KjGBDc6UeAo57AV5W0gK-bjWTA-AcKLJOlY"
};

// Función para normalizar datos
const normalizeLinea = (linea) => {
    let normalized = linea.replace(/^LINEA\s*/i, '');
    return normalized.replace(/\s+/g, '').toUpperCase();
};

// Modificada para quitar separadores de miles
const normalizePVP = (pvp) => pvp.replace(/\$\s*/g, '').replace(/\./g, '').trim();

const getClaseByPVP = (pvp) => {
    const valor = parseFloat(pvp);
    if (isNaN(valor)) return 'NO DEFINIDO';

    if (valor <= 39900) return 'LINEA';
    if (valor > 39900 && valor <= 59900) return 'MODA';
    if (valor > 59900) return 'PRONTAMODA';

    return 'NO DEFINIDO';
};

const normalizeDate = (date) => {
    if (!date) return null;

    const [day, month, year] = date.split('/');

    // Asegura que los valores estén en formato de 2 dígitos
    const dd = day.padStart(2, '0');
    const mm = month.padStart(2, '0');

    return `${year}-${mm}-${dd}`;
    //return `${dd}/${mm}/${year}`;
}; 

const normalizeDocumento = (documento) => documento.replace(/^REC/i, '');

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

const getProveedorByLinea = (linea) => {
    return normalizeLinea(linea).includes('ANGELES') 
        ? 'TEXTILES Y CREACIONES LOS ANGELES SAS' 
        : 'TEXTILES Y CREACIONES EL UNIVERSO SAS';
};

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

// Función para obtener datos de DATA2
export const getParsedMainData = async () => {
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
                    FECHA: normalizeDate(jsonData.FECHA || ''), // Aplicar normalización de fecha
                    //FECHA: jsonData.FECHA || '',
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
                    PVP: normalizePVP(jsonData.PVP || ''), // Ya incluye la eliminación de separadores de miles
                    PRENDA: jsonData.PRENDA || '',
                    GENERO: jsonData.GENERO || '',
                    GESTOR: jsonData.GESTOR || '',
                    PROVEEDOR: jsonData.PROVEEDOR || getProveedorByLinea(jsonData.LINEA || ''),
                    CLASE: getClaseByPVP(normalizePVP(jsonData.PVP || '')),
                    FUENTE: 'SISPRO'
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
};

// Función para obtener datos de REC
export const getREC = async () => {
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
                FECHA: normalizeDate(row[1] || ''), // Aplicar normalización de fecha
                //FECHA: row[1] || '',
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
                PVP: normalizePVP(row[31] || ''), // Ya incluye la eliminación de separadores de miles
                PRENDA: row[29] || '',
                GENERO: row[30] || '',
                GESTOR: getGestorByLinea(linea), 
                PROVEEDOR: getProveedorByLinea(linea),
                CLASE: getClaseByPVP(normalizePVP(row[31] || '')),
                FUENTE: 'BUSINT'
            };
        }).filter(item => item !== null && item.DOCUMENTO !== '');
    } catch (error) {
        console.error("Error en getREC:", error);
        throw error;
    }
};

// Función principal para obtener todos los datos combinados
export const getCombinedData = async () => {
    try {
        const [dataFromFirstSheet, dataFromSecondSheet] = await Promise.all([
            getParsedMainData(),
            getREC()
        ]);
        
        return [...dataFromFirstSheet, ...dataFromSecondSheet].filter(item => !isAnulado(item));
    } catch (error) {
        console.error("Error al combinar datos:", error);
        throw error;
    }
};
