/**
 * =========================================================================
 * GOOGLE APPS SCRIPT (GAS) — BACKEND DE DESPACHOS 2.0
 * =========================================================================
 *
 * IMPORTANTE: Este script debe pegarse DENTRO del editor de Apps Script
 * de tu hoja de cálculo de Google Sheets:
 *   Extensiones → Apps Script → pegar aquí → Guardar → Implementar
 *
 * Cuando el script está vinculado a la hoja, getSpreadsheet() lo encuentra
 * automáticamente por su ID. Si el ID falla, usa el spreadsheet activo.
 *
 * ID del Libro: 11kcA7CYcaAHAreSGt9uFOTciSFfXLYTumFiWJvkRRcU
 * Endpoint publicado:
 *   https://script.google.com/macros/s/AKfycbzzox2Ki2k0oQEK8cpdo87Ryd4NEtF0JlK96rRY1bb1hrrAlkeQcFgzVN7NY6kEYHnQ/exec
 *
 * ESTRUCTURA HOJA "DESPACHOS" (columnas A→I):
 *   A = ID    B = FechaProg    C = OP    D = Ref    E = Cantidad
 *   F = Taller    G = X (despachado)    H = Observacion    I = FechaDespacho
 *
 * ACCIONES:
 *   despachar  → Escribe X en Col G y fecha en Col I (solo si no tiene X)
 *   revertir   → Borra X y fecha (solo si tiene X)
 *   uploadData → Reemplaza todo en hoja DATA con filas del CSV
 *   (sin acción / GET) → Test de conexión, retorna {status:'online'}
 * =========================================================================
 */

// ── ID del libro de Google Sheets ────────────────────────────────────────
var SPREADSHEET_ID = '11kcA7CYcaAHAreSGt9uFOTciSFfXLYTumFiWJvkRRcU';

// ── Google Sheets API v4 Key (para lecturas de alta velocidad) ───────────
var SHEETS_API_KEY = 'AIzaSyA_kb-IRMSJAK0C-jGraYcHNQcMO8PoUYI';

// ── Nombres de las pestañas ───────────────────────────────────────────────
var SHEET_DESPACHOS = 'DESPACHOS';
var SHEET_DATA      = 'DATA';

// ── Índices de columnas en DESPACHOS (0-based) ───────────────────────────
var COL_ID             = 0;  // A
var COL_FECHA_PROG     = 1;  // B ← Fecha de programación
var COL_OP             = 2;  // C ← OP
var COL_REF            = 3;  // D ← Referencia
var COL_CANTIDAD       = 4;  // E
var COL_TALLER         = 5;  // F
var COL_DESPACHADO     = 6;  // G ← 'X' o vacío  (columna 7 en Sheets)
var COL_OBSERVACION    = 7;  // H                 (columna 8 en Sheets)
var COL_FECHA_DESPACHO = 8;  // I                 (columna 9 en Sheets)


// =========================================================================
// ENTRY POINTS (Google Apps Script los llama automáticamente)
// =========================================================================
function doPost(e) { return handleRequest(e); }
function doGet(e)  { return handleRequest(e); }


// =========================================================================
// ORQUESTADOR
// =========================================================================
function handleRequest(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);

    var payload = parsePayload(e);
    var action  = String(payload.action || '').trim().toLowerCase();

    if (action === 'getconfig')  return accionGetConfig();
    if (action === 'despachar')  return accionDespachar(payload);
    if (action === 'revertir')   return accionRevertir(payload);
    if (action === 'uploaddata') return accionUploadData(payload);

    // Test / ping de conexión
    return jsonOk({
      status:    'online',
      service:   'Despachos 2.0 — Apps Script Backend',
      spreadsheetId: SPREADSHEET_ID,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    return jsonError('ERROR: ' + err.toString());
  } finally {
    lock.releaseLock();
  }
}


// =========================================================================
// FUNCIÓN DE PRUEBA — Ejecutar directamente en el editor GAS para verificar
// =========================================================================
function testConexion() {
  var ss = getSpreadsheet();
  var sheetD = ss.getSheetByName(SHEET_DESPACHOS);
  var sheetDt = ss.getSheetByName(SHEET_DATA);

  Logger.log('=== TEST DE CONEXIÓN ===');
  Logger.log('Libro: ' + ss.getName() + ' (' + ss.getId() + ')');
  Logger.log('Hoja DESPACHOS: ' + (sheetD ? 'OK — ' + sheetD.getLastRow() + ' filas' : 'NO ENCONTRADA'));
  Logger.log('Hoja DATA:      ' + (sheetDt ? 'OK — ' + sheetDt.getLastRow() + ' filas' : 'NO ENCONTRADA'));
  Logger.log('========================');
}


// =========================================================================
// ACCIÓN 0: OBTENER CONFIGURACIÓN PÚBLICA (API KEY & SPREADSHEET ID)
//   Permite que el frontend web obtenga la clave de lectura dinámica
//   sin tener que quemar la API Key en el código fuente de GitHub.
// =========================================================================
function accionGetConfig() {
  return jsonOk({
    status:        'success',
    apiKey:        SHEETS_API_KEY,
    spreadsheetId: SPREADSHEET_ID,
    sheetFilter:   'FILTER',
    sheetDespachos: SHEET_DESPACHOS
  });
}


// =========================================================================
// ACCIÓN 1: DESPACHAR
//   Estrategia de 3 niveles para identificar el registro correcto
//   en la hoja DESPACHOS. SOLO toca filas sin X para no sobrescribir
//   registros de reprogramaciones que ya fueron despachadas.
//
//   Nivel 1 (más preciso): OP + Ref + FechaProg sin X
//   Nivel 2 (intermedio):  OP + Ref sin X
//   Nivel 3 (fallback):    solo OP sin X
//   Nivel 4 (último):      rowNumber enviado por el frontend sin X
// =========================================================================
function accionDespachar(payload) {
  var op            = norm(payload.op);
  var ref           = norm(payload.ref);
  var fechaProg     = norm(payload.fecha);      // Fecha de programación del registro
  var fechaDespacho = norm(payload.fechaDespacho)
                      || Utilities.formatDate(new Date(), 'GMT-5', 'dd/MM/yyyy');
  var observacion   = norm(payload.observacion);

  if (!op) return jsonError('El campo "op" es obligatorio para despachar.');

  var sheet  = getSheet(SHEET_DESPACHOS);
  var data   = sheet.getDataRange().getValues();
  var target = -1;

  // ── Nivel 1: OP + Ref + FechaProg + sin X ────────────────────────────
  if (fechaProg && target === -1) {
    for (var i = 1; i < data.length; i++) {
      if (
        norm(data[i][COL_OP])         === op   &&
        norm(data[i][COL_REF])        === ref  &&
        norm(String(data[i][COL_FECHA_PROG])) === fechaProg &&
        norm(data[i][COL_DESPACHADO]) !== 'x'
      ) { target = i + 1; break; }
    }
  }

  // ── Nivel 2: OP + Ref + sin X ─────────────────────────────────────────
  if (target === -1) {
    for (var i = 1; i < data.length; i++) {
      if (
        norm(data[i][COL_OP])         === op  &&
        norm(data[i][COL_REF])        === ref &&
        norm(data[i][COL_DESPACHADO]) !== 'x'
      ) { target = i + 1; break; }
    }
  }

  // ── Nivel 3: solo OP + sin X ──────────────────────────────────────────
  if (target === -1) {
    for (var i = 1; i < data.length; i++) {
      if (
        norm(data[i][COL_OP])         === op &&
        norm(data[i][COL_DESPACHADO]) !== 'x'
      ) { target = i + 1; break; }
    }
  }

  // ── Nivel 4: rowNumber + sin X ────────────────────────────────────────
  if (target === -1 && payload.rowNumber) {
    var rn = parseInt(payload.rowNumber, 10);
    if (rn >= 2 && rn <= sheet.getLastRow()) {
      var xVal = norm(sheet.getRange(rn, COL_DESPACHADO + 1).getValue());
      if (xVal !== 'x') target = rn;
    }
  }

  if (target === -1) {
    return jsonError(
      'No se encontro registro pendiente (sin X) para OP="' + op +
      '" Ref="' + ref + '" Fecha="' + fechaProg + '"'
    );
  }

  // ── Escritura ──────────────────────────────────────────────────────────
  sheet.getRange(target, COL_DESPACHADO + 1).setValue('X');
  sheet.getRange(target, COL_FECHA_DESPACHO + 1).setValue(fechaDespacho);

  if (observacion) {
    var obsActual = norm(sheet.getRange(target, COL_OBSERVACION + 1).getValue());
    sheet.getRange(target, COL_OBSERVACION + 1)
         .setValue(obsActual ? obsActual + ' | ' + observacion : observacion);
  }

  SpreadsheetApp.flush();

  return jsonOk({
    status:        'success',
    message:       'OP "' + op + '" / Ref "' + ref + '" → DESPACHADA (fila ' + target + ')',
    targetRow:     target,
    op:            op,
    ref:           ref,
    fechaDespacho: fechaDespacho
  });
}


// =========================================================================
// ACCIÓN 2: REVERTIR
//   Quita la X de Col G y borra la fecha de Col I.
//   Solo toca filas QUE SÍ TIENEN X.
// =========================================================================
function accionRevertir(payload) {
  var op  = norm(payload.op);
  var ref = norm(payload.ref);

  if (!op) return jsonError('El campo "op" es obligatorio para revertir.');

  var sheet  = getSheet(SHEET_DESPACHOS);
  var data   = sheet.getDataRange().getValues();
  var target = -1;

  // Buscar por OP + Ref CON X
  for (var i = 1; i < data.length; i++) {
    if (
      norm(data[i][COL_OP])         === op  &&
      norm(data[i][COL_REF])        === ref &&
      norm(data[i][COL_DESPACHADO]) === 'x'
    ) { target = i + 1; break; }
  }

  // Fallback: solo OP CON X
  if (target === -1) {
    for (var i = 1; i < data.length; i++) {
      if (
        norm(data[i][COL_OP])         === op &&
        norm(data[i][COL_DESPACHADO]) === 'x'
      ) { target = i + 1; break; }
    }
  }

  // Fallback: rowNumber enviado
  if (target === -1 && payload.rowNumber) {
    var rn = parseInt(payload.rowNumber, 10);
    if (rn >= 2 && rn <= sheet.getLastRow()) target = rn;
  }

  if (target === -1) {
    return jsonError(
      'No se encontro registro despachado (con X) para OP="' + op + '" Ref="' + ref + '"'
    );
  }

  sheet.getRange(target, COL_DESPACHADO + 1).clearContent();
  sheet.getRange(target, COL_FECHA_DESPACHO + 1).clearContent();
  SpreadsheetApp.flush();

  return jsonOk({
    status:    'success',
    message:   'OP "' + op + '" / Ref "' + ref + '" → REVERTIDA a Pendiente (fila ' + target + ')',
    targetRow: target,
    op:        op,
    ref:       ref
  });
}


// =========================================================================
// ACCIÓN 3: CARGA MASIVA CSV → HOJA DATA
//   Elimina todo en DATA y escribe las filas del CSV en bloque.
//   No toca FILTER ni DESPACHOS.
// =========================================================================
function accionUploadData(payload) {
  var rows = payload.rows;
  if (typeof rows === 'string') {
    try { rows = JSON.parse(rows); } catch(e) { rows = null; }
  }

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return jsonError('No se recibieron filas validas para la hoja DATA.');
  }

  var ss        = getSpreadsheet();
  var dataSheet = ss.getSheetByName(SHEET_DATA);
  if (!dataSheet) dataSheet = ss.insertSheet(SHEET_DATA);

  dataSheet.clearContents();

  // Normalizar fechas en todas las filas (excepto cabecera)
  rows = normalizarFechasEnFilas(rows);

  var numRows = rows.length;
  var numCols = rows[0].length;

  if (dataSheet.getMaxRows() < numRows) {
    dataSheet.insertRowsAfter(dataSheet.getMaxRows(), numRows - dataSheet.getMaxRows());
  }
  if (dataSheet.getMaxColumns() < numCols) {
    dataSheet.insertColumnsAfter(dataSheet.getMaxColumns(), numCols - dataSheet.getMaxColumns());
  }

  dataSheet.getRange(1, 1, numRows, numCols).setValues(rows);
  SpreadsheetApp.flush();

  return jsonOk({
    status:       'success',
    message:      'Hoja DATA cargada con ' + (numRows - 1) + ' registros.',
    totalRows:    numRows,
    totalColumns: numCols
  });
}


// =========================================================================
// NORMALIZACIÓN DE FECHAS
// =========================================================================

/**
 * Recorre todas las filas (saltando la cabecera, fila 0) y normaliza
 * cualquier celda cuyo valor parezca una fecha de texto.
 * Correcciones aplicadas:
 *   - "sep" → "sept"   (septiembre, abreviatura corta)
 *   - "ene" → "ene", "feb" → "feb", etc. (no cambia, solo normaliza casing)
 *   - Convierte a minúsculas para consistencia con el parser del frontend
 */
function normalizarFechasEnFilas(rows) {
  var normalized = [];
  for (var r = 0; r < rows.length; r++) {
    var row = rows[r].slice(); // copia para no mutar el original
    if (r > 0) { // saltar cabecera
      for (var c = 0; c < row.length; c++) {
        var val = row[c];
        if (typeof val === 'string' && val.trim() !== '') {
          row[c] = normalizarFecha(val);
        }
      }
    }
    normalized.push(row);
  }
  return normalized;
}

/**
 * Normaliza una cadena de texto que podría ser una fecha.
 * Solo modifica si detecta un patrón de fecha con mes abreviado.
 *
 * Formatos detectados (case insensitive):
 *   DD-MMM-YY, DD/MMM/YY, DD-MMM-YYYY, DD/MMM/YYYY
 *   Ej: "15-sep-25" → "15-sept-25"
 *       "03/Sep/2025" → "03/sept/2025"
 *
 * Correcciones de mes:
 *   sep  → sept   (sin romper "sept" que ya está correcto)
 *   ene, feb, mar, abr, may, jun, jul, ago, sept, oct, nov, dic  (sin cambio)
 */
function normalizarFecha(val) {
  // Regex: DD[/-]MMM[/-]YY(YY) — acepta separadores - o /
  var reDate = /^(\d{1,2})([-\/])([a-záéíóúñ]{2,4})([-\/])(\d{2,4})$/i;
  var match  = val.trim().match(reDate);

  if (!match) return val; // No parece fecha → devolver sin cambio

  var day  = match[1];
  var sep1 = match[2];
  var mes  = match[3].toLowerCase();
  var sep2 = match[4];
  var year = match[5];

  // Tabla de correcciones de abreviatura de mes
  var CORRECCIONES = {
    'sep':  'sept',   // ← corrección principal solicitada
    'ene':  'ene',
    'feb':  'feb',
    'mar':  'mar',
    'abr':  'abr',
    'may':  'may',
    'jun':  'jun',
    'jul':  'jul',
    'ago':  'ago',
    'sept': 'sept',
    'oct':  'oct',
    'nov':  'nov',
    'dic':  'dic'
  };

  var mesCorregido = CORRECCIONES.hasOwnProperty(mes) ? CORRECCIONES[mes] : mes;

  // Año de 2 dígitos: añadir prefijo 20xx si < 100
  var yearNum = parseInt(year, 10);
  var yearStr = (yearNum < 100) ? (2000 + yearNum).toString() : year;

  return day + sep1 + mesCorregido + sep2 + yearStr;
}


// =========================================================================
// UTILIDADES
// =========================================================================

/** Obtiene el libro por ID, con fallback al activo (cuando es script vinculado) */
function getSpreadsheet() {
  try {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch(e) {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
}

/** Obtiene una pestaña por nombre, lanza error si no existe */
function getSheet(name) {
  var ss    = getSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Pestana "' + name + '" no encontrada en el libro.');
  return sheet;
}

/** Normaliza un valor: string + trim + lowercase */
function norm(val) {
  return String(val === null || val === undefined ? '' : val).trim().toLowerCase();
}

/** Parsea el body del POST o los parametros GET */
function parsePayload(e) {
  if (e && e.postData && e.postData.contents) {
    try { return JSON.parse(e.postData.contents); } catch(err) {}
  }
  return (e && e.parameter) ? e.parameter : {};
}

/** Respuesta JSON exitosa */
function jsonOk(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Respuesta JSON de error */
function jsonError(msg) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'error', message: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}
