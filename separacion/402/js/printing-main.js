// ─── printing-main.js — Versión Supabase ──────────────────────────────────────
//
//  Reemplaza la carga desde Google Sheets por una llamada a la Edge Function
//  "separacion-datos" que consolida ingresos + distribuciones + clientes
//  y filtra los FINALIZADO de antemano.
//
//  El objeto que devuelve cada ítem es 100% compatible con:
//    - documents-table.js  (usa REC, ESTADO, COLABORADOR, datosCompletos, etc.)
//    - printing-templates.js (usa DISTRIBUCION.Clientes, HR, ANEXOS, etc.)
// ──────────────────────────────────────────────────────────────────────────────

window.printingDatosGlobales    = [];
window.printingModuleInitialized = false;

// Compatibilidad con documents-table.js que referencia datosGlobales como var global
var datosGlobales = [];

// ─── Configuración ────────────────────────────────────────────────────────────

const SUPABASE_URL      = "https://iladaofarozipitwaeti.supabase.co";
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/separacion-datos`;
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlsYWRhb2Zhcm96aXBpdHdhZXRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NjYzMDksImV4cCI6MjA5MzA0MjMwOX0.4fyiibeZS10DCgov62d7tIFVzJHsklsBrbokAJ9ptK8";

// ─── Carga principal ──────────────────────────────────────────────────────────

async function print_cargarDatos() {
  const loader          = document.getElementById("printLoader");
  const resultContainer = document.getElementById("printResultContainer");

  if (loader)          loader.style.display = "block";
  if (resultContainer) resultContainer.innerHTML =
    "<div class='loading-spinner-large'></div>" +
    "<p style='text-align:center'>Cargando datos...</p>";

  try {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method:  "GET",
      headers: {
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "apikey":         SUPABASE_ANON_KEY,
        "Content-Type":  "application/json",
      },
    });

    if (!response.ok) {
      const txt = await response.text();
      throw new Error(`Edge Function error ${response.status}: ${txt}`);
    }

    const json = await response.json();

    if (!json.success) {
      throw new Error(json.message || "Error desconocido en Edge Function");
    }

    // ── Los datos ya vienen procesados y enriquecidos desde la Edge Function ──
    //
    //  Cada ítem tiene la forma:
    //  {
    //    DOCUMENTO, REC, FECHA, TALLER, LINEA, AUDITOR, ESCANER, LOTE,
    //    REFPROV, DESCRIPCIÓN, DESCRIPCION, CANTIDAD, REFERENCIA, TIPO,
    //    PVP, PRENDA, GENERO, MARCA, CLASE, GESTOR, PROVEEDOR, FUENTE,
    //    HR [ [codigo, color, talla, cantidad], ... ],
    //    ANEXOS [ {...} ],
    //    ESTADO, COLABORADOR,
    //    INICIO, FIN, DURACION, DURACION_PAUSAS, DATETIME_ULTIMA_PAUSA,
    //    CLIENTES { NombreCorto: { id, razonSocial, ..., distribucion:[...] } },
    //    DISTRIBUCION { Documento, Clientes, Colaborador }
    //  }

    const resultadoFinal = json.data;

    // ── Exponer para documents-table.js ───────────────────────────────────────
    //
    //  documents-table.js espera:
    //    - window.datosTablaDocumentos : array raw para construir filas de tabla
    //    - datosGlobales               : array completo para cruzar datos
    //
    //  Construimos datosTablaDocumentos como array de filas "planas"
    //  que imitan las columnas A-K de la hoja DATA original:
    //
    //  [0] id_distribucion   (= REC)
    //  [1] fecha_distribucion
    //  [2] datos_distribucion (no usado por documents-table.js directamente)
    //  [3] estado
    //  [4] colaborador
    //  [5] inicio
    //  [6] fin
    //  [7] duracion
    //  [8] pausas
    //  [9] datetime_ultima_pausa
    //  [10] duracion_pausas

    window.datosTablaDocumentos = resultadoFinal.map((item) => [
      item.DOCUMENTO,
      item.FECHA_DISTRIBUCION ?? item.FECHA ?? "",
      null,                          // col C — no necesaria en el nuevo flujo
      item.ESTADO,
      item.COLABORADOR ?? "",
      item.INICIO                   ?? "",
      item.FIN                      ?? "",
      item.DURACION                 ?? "",
      item.PAUSAS                   ?? "",
      item.DATETIME_ULTIMA_PAUSA    ?? "",
      item.DURACION_PAUSAS          ?? "",
    ]);

    // Globales para impresión y cruce de datos
    window.printingDatosGlobales  = resultadoFinal;
    window.datosGlobales          = resultadoFinal;
    datosGlobales                 = resultadoFinal;

    if (loader)          loader.style.display = "none";
    if (resultContainer) resultContainer.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-print empty-icon"></i>
        <h5>Sin datos para mostrar</h5>
        <p>Ingrese un documento para buscar información de impresión.</p>
      </div>`;

    window.printingModuleInitialized = true;
    return resultadoFinal;

  } catch (error) {
    if (loader) loader.style.display = "none";
    if (resultContainer) resultContainer.innerHTML = `
      <div style="color:var(--error);padding:20px;text-align:center;">
        <i class="codicon codicon-error" style="font-size:32px;margin-bottom:15px;"></i>
        <p>Error al cargar datos: ${error.message}</p>
        <button class="btn-primary" onclick="print_cargarDatos()" style="margin-top:15px;">
          <i class="codicon codicon-refresh"></i> Reintentar
        </button>
      </div>`;
    throw error;
  }
}

// ─── Inicialización ───────────────────────────────────────────────────────────

function initPrintingModule() {
  if (window.printingDatosGlobales && window.printingDatosGlobales.length > 0) return;
  if (!window.printingModuleInitialized) print_cargarDatos();
}

// Aliases que espera documents-table.js
window.cargarDatos   = print_cargarDatos;
window.loaderPromise = print_cargarDatos();
