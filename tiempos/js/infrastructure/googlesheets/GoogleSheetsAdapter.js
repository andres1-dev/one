import { TiemposPort } from "../../domain/ports/TiemposPort.js";
import { RegistroTiempo } from "../../domain/entities/RegistroTiempo.js";
import { GoogleSheetsConfig } from "./GoogleSheetsConfig.js";
import { getSupabaseClient } from "../supabase/config.js";

/**
 * Formatea segundos a string de intervalo (HH:mm:ss o HH:mm:ss.ms)
 */
function formatInterval(segundosTotales) {
  if (segundosTotales === null || segundosTotales === undefined || isNaN(segundosTotales) || segundosTotales < 0) {
    return "";
  }
  const horas = Math.floor(segundosTotales / 3600);
  const minutos = Math.floor((segundosTotales % 3600) / 60);
  const segundos = Math.floor(segundosTotales % 60);
  const milisegundos = Math.round((segundosTotales % 1) * 1000);
  
  const pad = (n) => String(n).padStart(2, "0");
  const padMs = (n) => String(n).padStart(3, "0");
  
  if (milisegundos > 0) {
    return `${pad(horas)}:${pad(minutos)}:${pad(segundos)}.${padMs(milisegundos)}`;
  }
  return `${pad(horas)}:${pad(minutos)}:${pad(segundos)}`;
}

/**
 * Adaptador de Google Sheets - Implementa TiemposPort para sincronización
 * Sincroniza datos con Google Sheets usando la API v4 y Google Apps Script
 */
export class GoogleSheetsAdapter extends TiemposPort {
  constructor() {
    super();
  }

  get apiKey() {
    return GoogleSheetsConfig.getApiKey();
  }

  get spreadsheetId() {
    return GoogleSheetsConfig.getSpreadsheetId();
  }

  get sheetName() {
    return GoogleSheetsConfig.getSheetName();
  }

  get gasUrl() {
    return GoogleSheetsConfig.getGasUrl();
  }

  /**
   * Construye la URL base para la API de Google Sheets v4
   */
  _getSheetsApiUrl() {
    return `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}`;
  }

  /**
   * Convierte un RegistroTiempo a formato para Google Sheets (21 columnas)
   * SIN idx (es interno de Supabase)
   */
  _registroToSheetRow(registro) {
    let duracionConteoStr = "";
    let tiempoPrendaNum = "";
    if (registro.fecha_ingreso && registro.fecha_finalizacion) {
      const seg = Math.max(0, (new Date(registro.fecha_finalizacion).getTime() - new Date(registro.fecha_ingreso).getTime()) / 1000);
      duracionConteoStr = formatInterval(seg);
      const cant = Number(registro.cantidad) || 0;
      if (cant > 0) {
        tiempoPrendaNum = parseFloat((seg / cant).toFixed(4));
      }
    }

    let duracionLibStr = "";
    if (registro.fecha_ingreso && registro.fecha_liberacion) {
      const segLib = Math.max(0, (new Date(registro.fecha_liberacion).getTime() - new Date(registro.fecha_ingreso).getTime()) / 1000);
      duracionLibStr = formatInterval(segLib);
    }

    return [
      registro.id_master || "",
      registro.op || "",
      registro.referencia || "",
      registro.taller || "",
      registro.linea || "",
      registro.prenda || "",
      registro.genero || "",
      registro.cantidad || 0,
      registro.productora || "",
      registro.motivo || "",
      Boolean(registro.retenido), // Booleano puro: true / false (Sheets lo muestra como VERDADERO / FALSO)
      registro.fecha_ingreso || "",
      registro.fecha_finalizacion || "",
      registro.escaneado_por || "",
      registro.liberado_por || "",
      registro.fecha_liberacion || "",
      duracionConteoStr,
      duracionLibStr,
      tiempoPrendaNum,
      registro.created_at || "",
      registro.updated_at || ""
    ];
  }

  /**
   * Convierte una fila de Google Sheets a RegistroTiempo
   * SIN idx (es interno de Supabase)
   */
  _sheetRowToRegistro(row) {
    const valRetenido = row[10];
    const isRetenido = (valRetenido === true || valRetenido === "true" || valRetenido === "VERDADERO" || valRetenido === "TRUE" || valRetenido === "SI");
    return new RegistroTiempo({
      idx: null, // No viene de Sheets
      id_master: row[0] || "",
      op: row[1] ? parseInt(row[1], 10) : null,
      referencia: row[2] || "",
      taller: row[3] || "",
      linea: row[4] || "",
      prenda: row[5] || "",
      genero: row[6] || "",
      cantidad: row[7] ? parseInt(row[7], 10) : 0,
      productora: row[8] || "",
      motivo: row[9] || null,
      retenido: isRetenido,
      fecha_ingreso: row[11] || null,
      fecha_finalizacion: row[12] || null,
      escaneado_por: row[13] || "",
      liberado_por: row[14] || null,
      fecha_liberacion: row[15] || null,
      duracion_conteo: row[16] || null,
      duracion_liberacion: row[17] || null,
      tiempo_prenda: row[18] !== undefined && row[18] !== "" ? Number(row[18]) : null,
      created_at: row[19] || null,
      updated_at: row[20] || null
    });
  }

  /**
   * Inserta un registro en Google Sheets usando Google Apps Script
   * Completamente fire-and-forget, no espera respuesta
   */
  async insertarTiempo(registroTiempo) {
    try {
      console.log("📊 Iniciando inserción en Google Sheets (background):", registroTiempo);
      const row = this._registroToSheetRow(registroTiempo);
      
      const payload = {
        action: "appendRow",
        row: row
      };
      
      // Usar mode: 'no-cors' y NO esperar respuesta
      fetch(this.gasUrl, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }).catch(error => {
        console.error("❌ Error en sincronización background con Google Sheets:", error);
      });
      
      console.log("✅ Inserción en Google Sheets enviada (fire-and-forget)");
      
      return {
        registro: registroTiempo,
        yaExistia: false
      };
    } catch (error) {
      console.error("❌ Error en GoogleSheetsAdapter.insertarTiempo:", error);
      console.warn("La sincronización con Google Sheets falló, pero la operación principal continúa");
    }
  }

  /**
   * Actualiza el estado de retención en Google Sheets
   * Completamente fire-and-forget, no espera respuesta
   */
  async actualizarRetencion(id_master, { retenido, motivo, liberado_por, fecha_liberacion }) {
    try {
      console.log("📊 Actualizando retención en Google Sheets (background):", id_master);
      
      const isRetenido = Boolean(retenido);
      const usuario = liberado_por || await this._getCurrentUser();
      
      const payload = {
        action: "updateRetencion",
        id_master: id_master,
        retenido: isRetenido, // Booleano: true / false
        fecha_liberacion: !isRetenido ? (fecha_liberacion || new Date().toISOString()) : "",
        liberado_por: !isRetenido ? (usuario || "Operario") : ""
      };

      if (motivo !== undefined && motivo !== null && String(motivo).trim() !== "") {
        payload.motivo = String(motivo).trim();
      }
      
      // Usar mode: 'no-cors' y NO esperar respuesta
      fetch(this.gasUrl, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }).catch(error => {
        console.error("❌ Error en sincronización background con Google Sheets:", error);
      });
      
      console.log("✅ Actualización de retención enviada (fire-and-forget)");
      
      return new RegistroTiempo({
        id_master: id_master,
        retenido: isRetenido,
        motivo: motivo,
        liberado_por: payload.liberado_por,
        fecha_liberacion: payload.fecha_liberacion
      });
    } catch (error) {
      console.error("❌ Error en GoogleSheetsAdapter.actualizarRetencion:", error);
      console.warn("La sincronización con Google Sheets falló, pero la operación principal continúa");
    }
  }

  async _getCurrentUser() {
    try {
      const client = getSupabaseClient();
      const { data } = await client.auth.getSession();
      if (data?.session?.user) {
        return data.session.user.user_metadata?.full_name || data.session.user.email || "Operario";
      }
    } catch (error) {
      console.error("Error obteniendo usuario actual:", error);
    }
    return "Operario";
  }

  /**
   * Finaliza un tiempo en Google Sheets
   * Completamente fire-and-forget, no espera respuesta
   */
  async finalizarTiempo(id_master, supabaseResult = null) {
    try {
      console.log("📊 Finalizando tiempo en Google Sheets (background):", id_master);
      
      const payload = {
        action: "finalizarTiempo",
        id_master: id_master,
        fecha_finalizacion: supabaseResult?.fecha_finalizacion || new Date().toISOString()
      };

      if (supabaseResult) {
        if (supabaseResult.retenido !== undefined) {
          payload.retenido = Boolean(supabaseResult.retenido);
        }
        if (supabaseResult.fecha_liberacion) {
          payload.fecha_liberacion = supabaseResult.fecha_liberacion;
        }
        if (supabaseResult.liberado_por) {
          payload.liberado_por = supabaseResult.liberado_por;
        }
      }
      
      // Usar mode: 'no-cors' y NO esperar respuesta
      fetch(this.gasUrl, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }).catch(error => {
        console.error("❌ Error en sincronización background con Google Sheets:", error);
      });
      
      console.log("✅ Finalización de tiempo enviada (fire-and-forget)");
      
      return new RegistroTiempo({
        id_master: id_master,
        fecha_finalizacion: payload.fecha_finalizacion
      });
    } catch (error) {
      console.error("❌ Error en GoogleSheetsAdapter.finalizarTiempo:", error);
      console.warn("La sincronización con Google Sheets falló, pero la operación principal continúa");
    }
  }

  /**
   * Consulta el registro activo de un id_master en Google Sheets
   */
  async consultarActivo(id_master) {
    try {
      const response = await fetch(this.gasUrl, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "consultarActivo",
          id_master: id_master
        })
      });

      console.log("📊 Consulta de activo enviada (modo no-cors)");
      return null;
    } catch (error) {
      console.error("Error en GoogleSheetsAdapter.consultarActivo:", error);
      throw new Error(`Error al consultar activo en Google Sheets: ${error.message}`);
    }
  }

  /**
   * Lista los últimos registros de Google Sheets
   */
  async listarRecientes(limit = 30) {
    try {
      const url = `${this._getSheetsApiUrl()}/values/${this.sheetName}!A2:U${limit + 1}?key=${this.apiKey}`;
      
      const response = await fetch(url);
      const result = await response.json();
      
      if (!response.ok || result.error) {
        throw new Error(result.error?.message || "Error al obtener datos de Google Sheets");
      }

      if (!result.values || result.values.length === 0) {
        return [];
      }

      return result.values.map(row => this._sheetRowToRegistro(row));
    } catch (error) {
      console.error("Error en GoogleSheetsAdapter.listarRecientes:", error);
      throw new Error(`Error al listar registros en Google Sheets: ${error.message}`);
    }
  }

  /**
   * Obtiene KPIs calculados desde Google Sheets
   */
  async obtenerKPIs() {
    try {
      console.log("📊 Obteniendo KPIs desde Google Sheets API...");
      
      const url = `${this._getSheetsApiUrl()}/values/${this.sheetName}!A2:U?key=${this.apiKey}`;
      
      const response = await fetch(url);
      const result = await response.json();
      
      if (!response.ok || result.error) {
        throw new Error(result.error?.message || "Error al obtener datos de Google Sheets");
      }

      if (!result.values || result.values.length === 0) {
        return {
          totalRegistros: 0,
          registrosActivos: 0,
          registrosFinalizados: 0,
          totalCantidad: 0,
          totalRetenidos: 0,
          porcentajeRetencion: 0,
          promedioTiempoSegundos: 0,
          tiempoMinimoSegundos: 0,
          tiempoMaximoSegundos: 0,
          fechaCalculo: new Date().toISOString()
        };
      }

      // Calcular KPIs localmente
      const values = result.values;
      let totalRegistros = values.length;
      let registrosActivos = 0;
      let registrosFinalizados = 0;
      let totalCantidad = 0;
      let totalRetenidos = 0;
      let tiemposSegundos = [];
      
      for (let i = 0; i < values.length; i++) {
        const row = values[i];
        
        // Contar activos vs finalizados (columna M, índice 12)
        if (row[12]) {
          registrosFinalizados++;
        } else {
          registrosActivos++;
        }
        
        // Sumar cantidades (columna H, índice 7)
        totalCantidad += Number(row[7]) || 0;
        
        // Contar retenidos (columna K, índice 10)
        const valRetenido = row[10];
        if (valRetenido === true || valRetenido === "true" || valRetenido === "VERDADERO" || valRetenido === "TRUE" || valRetenido === "SI") {
          totalRetenidos++;
        }
        
        // Calcular tiempos si hay fecha_finalizacion (L: 11, M: 12)
        if (row[11] && row[12]) {
          const inicio = new Date(row[11]).getTime();
          const fin = new Date(row[12]).getTime();
          if (!isNaN(inicio) && !isNaN(fin) && fin >= inicio) {
            const duracionSegundos = (fin - inicio) / 1000;
            tiemposSegundos.push(duracionSegundos);
          }
        }
      }
      
      let promedioTiempo = 0;
      let tiempoMinimo = 0;
      let tiempoMaximo = 0;
      
      if (tiemposSegundos.length > 0) {
        const suma = tiemposSegundos.reduce((a, b) => a + b, 0);
        promedioTiempo = suma / tiemposSegundos.length;
        tiempoMinimo = Math.min(...tiemposSegundos);
        tiempoMaximo = Math.max(...tiemposSegundos);
      }
      
      const porcentajeRetencion = totalRegistros > 0 ? (totalRetenidos / totalRegistros) * 100 : 0;
      
      console.log("✅ KPIs calculados exitosamente");
      
      return {
        totalRegistros: totalRegistros,
        registrosActivos: registrosActivos,
        registrosFinalizados: registrosFinalizados,
        totalCantidad: totalCantidad,
        totalRetenidos: totalRetenidos,
        porcentajeRetencion: porcentajeRetencion,
        promedioTiempoSegundos: promedioTiempo,
        tiempoMinimoSegundos: tiempoMinimo,
        tiempoMaximoSegundos: tiempoMaximo,
        fechaCalculo: new Date().toISOString()
      };
    } catch (error) {
      console.error("Error en GoogleSheetsAdapter.obtenerKPIs:", error);
      throw new Error(`Error al obtener KPIs de Google Sheets: ${error.message}`);
    }
  }

  /**
   * Sincroniza todos los datos desde Google Sheets
   */
  async sincronizarDesdeSheets() {
    try {
      const url = `${this._getSheetsApiUrl()}/values/${this.sheetName}!A2:U?key=${this.apiKey}`;
      
      const response = await fetch(url);
      const result = await response.json();
      
      if (!response.ok || result.error) {
        throw new Error(result.error?.message || "Error al sincronizar desde Google Sheets");
      }

      if (!result.values || result.values.length === 0) {
        return [];
      }

      return result.values.map(row => this._sheetRowToRegistro(row));
    } catch (error) {
      console.error("Error en GoogleSheetsAdapter.sincronizarDesdeSheets:", error);
      throw new Error(`Error al sincronizar desde Google Sheets: ${error.message}`);
    }
  }
}