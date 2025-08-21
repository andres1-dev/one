// ================== FUNCIONES DE API ==================

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

// Función para cargar datos iniciales
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

        // 👉 Después de terminar la carga principal, se lanza la carga de la tarjeta
        datosCargarEndpoint();

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
            acc[fecha] = {
                fecha, 
                unidades: 0, 
                count: 0
            };
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
            Cumplimiento: cumplimiento,
            TotalRegistros: item.count
        };
    }).filter(item => item !== null)
    .sort((a, b) => parseDate(b.Fecha) - parseDate(a.Fecha));
}

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
                    FECHA: normalizeDate(jsonData.FECHA || ''),
                    CANTIDAD: Number(jsonData.CANTIDAD) || 0,
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
            return {
                FECHA: normalizeDate(row[1] || ''),
                CANTIDAD: Number(row[18]) || 0,
                ANO: '2025'
            };
        }).filter(item => item !== null);

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
            return {
                FECHA: normalizeDate(row[1] || ''),
                CANTIDAD: Number(row[18]) || 0,
                ANO: '2024'
            };
        }).filter(item => item !== null);

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
