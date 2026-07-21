
const SPREADSHEET_ID = '1d5dCCCgiWXfM6vHu3zGGKlvK2EycJtT7Uk4JqUjDOfE';
const SHEET_NAME = 'DATA';

function doPost(e) {
  try {
    // Verificar si se recibieron los parámetros
    if (!e || !e.parameter) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'No se recibieron datos'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const action = e.parameter.action;
    const id = e.parameter.id;
    
    if (!action || !id) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'Faltan parámetros requeridos: action e id'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    let result;
    
    switch(action) {
      case 'asignarResponsable':
        const responsable = e.parameter.responsable;
        if (!responsable) {
          return ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: 'Falta el parámetro: responsable'
          })).setMimeType(ContentService.MimeType.JSON);
        }
        result = actualizarResponsable(id, responsable);
        break;
        
      case 'pausar':
        result = pausarTarea(id);
        break;
        
      case 'reanudar':
        result = reanudarTarea(id);
        break;
        
      case 'finalizar':
        result = finalizarTarea(id);
        break;
        
      case 'restablecer':
        const password = e.parameter.password;
        if (!password) {
          return ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: 'Falta el parámetro: password'
          })).setMimeType(ContentService.MimeType.JSON);
        }
        result = restablecerTarea(id, password);
        break;
        
      default:
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          message: 'Acción no válida: ' + action
        })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: result.message || 'Acción completada exitosamente',
      data: result.data || null
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('Error en doPost: ' + error.message);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Error: ' + error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Función para convertir hh:mm:ss a milisegundos
function convertirDuracionAHorasMs(str) {
  try {
    const [hh, mm, ss] = str.split(":").map(Number);
    return ((hh * 3600 + mm * 60 + ss) * 1000);
  } catch (e) {
    Logger.log("Error convirtiendo duración: " + e);
    return 0;
  }
}

// Función para convertir milisegundos a hh:mm:ss
function formatearDuracion(ms) {
  const totalSec = Math.floor(ms / 1000);
  const hh = Math.floor(totalSec / 3600).toString().padStart(2, '0');
  const mm = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
  const ss = (totalSec % 60).toString().padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function actualizarResponsable(id, nuevoNombre) {
  const range = `${SHEET_NAME}!A:K`;
  const response = Sheets.Spreadsheets.Values.get(SPREADSHEET_ID, range);
  const values = response.values;

  if (!values || values.length === 0) {
    throw new Error('No se encontraron datos en la hoja');
  }

  // Buscar fila (ignorando encabezado)
  const rowIndex = values.findIndex((row, i) => i > 0 && row[0] === id);

  if (rowIndex === -1) {
    throw new Error('ID no encontrado: ' + id);
  }

  // Verificar si el estado es DIRECTO - asignar sin cambiar estado
  const estado = (values[rowIndex][3] || "").toUpperCase();
  const now = new Date();
  const formattedDate = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

  let updateData;

  if (estado === "DIRECTO") {
    // Solo guardar responsable, no cambiar estado ni fecha inicio
    updateData = [
      {
        range: `${SHEET_NAME}!E${rowIndex + 1}`,
        values: [[nuevoNombre]]
      }
    ];
  } else {
    updateData = [
      {
        range: `${SHEET_NAME}!D${rowIndex + 1}`,
        values: [["ELABORACION"]]
      },
      {
        range: `${SHEET_NAME}!E${rowIndex + 1}`,
        values: [[nuevoNombre]]
      },
      {
        range: `${SHEET_NAME}!F${rowIndex + 1}`,
        values: [[formattedDate]]
      }
    ];
  }

  const updates = {
    valueInputOption: "USER_ENTERED",
    data: updateData
  };

  Sheets.Spreadsheets.Values.batchUpdate(updates, SPREADSHEET_ID);
  return {
    message: 'Responsable asignado correctamente',
    data: {
      estado: estado === "DIRECTO" ? "DIRECTO" : "ELABORACION",
      responsable: nuevoNombre,
      fechaInicio: estado === "DIRECTO" ? null : formattedDate
    }
  };
}

function pausarTarea(id) {
  const range = `${SHEET_NAME}!A:K`;
  const response = Sheets.Spreadsheets.Values.get(SPREADSHEET_ID, range);
  const data = response.values;
  
  if (!data || data.length === 0) {
    throw new Error('No se encontraron datos en la hoja');
  }
  
  const index = data.findIndex((row, i) => i > 0 && row[0] === id);
  if (index === -1) {
    throw new Error('ID no encontrado: ' + id);
  }

  const row = data[index];
  const now = new Date();
  const formattedDate = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  
  // Calcular tiempo trabajado desde última reanudación
  const ultimaReanudacion = new Date(row[5] || now); // F (fecha inicio)
  const msTrabajados = now - ultimaReanudacion;
  const msPrevioTrabajo = convertirDuracionAHorasMs(row[7] || "00:00:00"); // H (duración)
  const msNuevoTrabajo = msPrevioTrabajo + msTrabajados;
  const duracionTotal = formatearDuracion(msNuevoTrabajo);

  const updates = {
    valueInputOption: "USER_ENTERED",
    data: [
      { range: `${SHEET_NAME}!D${index + 1}`, values: [["PAUSADO"]] },      // Estado
      { range: `${SHEET_NAME}!H${index + 1}`, values: [[duracionTotal]] },  // Duración acumulada
      { range: `${SHEET_NAME}!J${index + 1}`, values: [[formattedDate]] }    // Fecha/hora de pausa (col J)
    ]
  };

  Sheets.Spreadsheets.Values.batchUpdate(updates, SPREADSHEET_ID);
  
  return {
    message: 'Tarea pausada correctamente',
    data: {
      estado: 'PAUSADO',
      duracion: duracionTotal,
      fechaPausa: formattedDate
    }
  };
}

function reanudarTarea(id) {
  const range = `${SHEET_NAME}!A:K`;
  const response = Sheets.Spreadsheets.Values.get(SPREADSHEET_ID, range);
  const data = response.values;
  
  if (!data || data.length === 0) {
    throw new Error('No se encontraron datos en la hoja');
  }
  
  const index = data.findIndex((row, i) => i > 0 && row[0] === id);
  if (index === -1) {
    throw new Error('ID no encontrado: ' + id);
  }

  const row = data[index];
  const now = new Date();
  const formattedDate = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  
  // Calcular duración de esta pausa
  const fechaPausa = new Date(row[9] || now); // J (fecha pausa)
  const duracionPausaMs = now - fechaPausa;
  
  // Sumar a tiempo total de pausas
  const tiempoPausasAcumuladoMs = convertirDuracionAHorasMs(row[10] || "00:00:00") + duracionPausaMs; // K (tiempo pausas)
  const nuevoTiempoPausas = formatearDuracion(tiempoPausasAcumuladoMs);

  const updates = {
    valueInputOption: "USER_ENTERED",
    data: [
      { range: `${SHEET_NAME}!D${index + 1}`, values: [["ELABORACION"]] }, // Estado
      { range: `${SHEET_NAME}!F${index + 1}`, values: [[formattedDate]] },  // Fecha reanudación
      { range: `${SHEET_NAME}!K${index + 1}`, values: [[nuevoTiempoPausas]] } // Tiempo pausas acumulado (col K)
    ]
  };

  Sheets.Spreadsheets.Values.batchUpdate(updates, SPREADSHEET_ID);
  
  return {
    message: 'Tarea reanudada correctamente',
    data: {
      estado: 'ELABORACION',
      fechaReanudacion: formattedDate,
      tiempoPausas: nuevoTiempoPausas
    }
  };
}

function finalizarTarea(id) {
  const range = `${SHEET_NAME}!A:K`;
  const response = Sheets.Spreadsheets.Values.get(SPREADSHEET_ID, range);
  const data = response.values;
  
  if (!data || data.length === 0) {
    throw new Error('No se encontraron datos en la hoja');
  }
  
  const index = data.findIndex((row, i) => i > 0 && row[0] === id);
  if (index === -1) {
    throw new Error('ID no encontrado: ' + id);
  }

  const row = data[index];
  if (row[3] === "PAUSADO") {
    throw new Error("No puedes finalizar mientras está pausado.");
  }

  const now = new Date();
  const ultimaReanudacion = new Date(row[5] || now); // F
  const fechaFinal = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  
  // Calcular tiempo trabajado desde última reanudación
  const msTrabajados = now - ultimaReanudacion;
  const msPrevioTrabajo = convertirDuracionAHorasMs(row[7] || "00:00:00"); // H
  const msNuevoTrabajo = msPrevioTrabajo + msTrabajados;
  const duracionFinal = formatearDuracion(msNuevoTrabajo);

  const updates = {
    valueInputOption: "USER_ENTERED",
    data: [
      { range: `${SHEET_NAME}!D${index + 1}`, values: [["FINALIZADO"]] },  // Estado
      { range: `${SHEET_NAME}!G${index + 1}`, values: [[fechaFinal]] },    // Fecha final (col G)
      { range: `${SHEET_NAME}!H${index + 1}`, values: [[duracionFinal]] }  // Duración final (col H)
    ]
  };

  Sheets.Spreadsheets.Values.batchUpdate(updates, SPREADSHEET_ID);
  
  return {
    message: 'Tarea finalizada correctamente',
    data: {
      estado: 'FINALIZADO',
      duracion: duracionFinal,
      tiempoPausas: row[10] || "00:00:00", // K (tiempo pausas)
      fechaFinal: fechaFinal
    }
  };
}

function restablecerTarea(id, password) {
  // Verificar contraseña
  if (password !== "one") {
    throw new Error("Contraseña incorrecta");
  }

  const range = `${SHEET_NAME}!A:K`;
  const response = Sheets.Spreadsheets.Values.get(SPREADSHEET_ID, range);
  const data = response.values;
  
  if (!data || data.length === 0) {
    throw new Error('No se encontraron datos en la hoja');
  }
  
  const index = data.findIndex((row, i) => i > 0 && row[0] === id);
  if (index === -1) {
    throw new Error('ID no encontrado: ' + id);
  }

  const updates = {
    valueInputOption: "USER_ENTERED",
    data: [
      { range: `${SHEET_NAME}!D${index + 1}`, values: [["PENDIENTE"]] },    // Estado
      { range: `${SHEET_NAME}!E${index + 1}`, values: [[""]] },             // Responsable (vacío)
      { range: `${SHEET_NAME}!F${index + 1}`, values: [[""]] },             // Fecha inicio (vacío)
      { range: `${SHEET_NAME}!G${index + 1}`, values: [[""]] },             // Fecha final (vacío)
      { range: `${SHEET_NAME}!H${index + 1}`, values: [[""]] },             // Duración (vacío)
      { range: `${SHEET_NAME}!J${index + 1}`, values: [[""]] },             // Fecha pausa (vacío)
      { range: `${SHEET_NAME}!K${index + 1}`, values: [[""]] }              // Tiempo pausas (vacío)
    ]
  };

  Sheets.Spreadsheets.Values.batchUpdate(updates, SPREADSHEET_ID);
  
  return {
    message: 'Tarea restablecida correctamente',
    data: {
      estado: 'PENDIENTE',
      responsable: '',
      duracion: '00:00:00',
      tiempoPausas: '00:00:00'
    }
  };
}

// Función doGet para probar el servicio (opcional)
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: 'Servicio funcionando correctamente',
    endpoints: [
      'POST / - asignarResponsable, pausar, reanudar, finalizar, restablecer'
    ]
  })).setMimeType(ContentService.MimeType.JSON);
}

