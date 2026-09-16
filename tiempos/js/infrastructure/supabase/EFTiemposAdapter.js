import { EF_TIEMPOS_URL, getSupabaseClient } from "./config.js";
import { TiemposPort } from "../../domain/ports/TiemposPort.js";
import { RegistroTiempo } from "../../domain/entities/RegistroTiempo.js";

/**
 * Adaptador que llama a la Edge Function para todas las operaciones de 'tiempos'.
 * El cliente NUNCA maneja idx — siempre identifica por id_master.
 * El idx interno lo resuelve la Edge Function en el servidor.
 */
export class EFTiemposAdapter extends TiemposPort {
  async _getToken() {
    const { data } = await getSupabaseClient().auth.getSession();
    if (!data?.session?.access_token) throw new Error("Sin sesión activa.");
    return data.session.access_token;
  }

  async _call(action, payload) {
    const token = await this._getToken();
    const res = await fetch(EF_TIEMPOS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ action, payload })
    });
    
    const json = await res.json();
    
    if (!res.ok) {
      const errorMessage = json.error || json.message || `Error EF (${action}) - Status: ${res.status}`;
      throw new Error(errorMessage);
    }
    
    if (json.error) {
      throw new Error(json.error);
    }
    
    // Manejar diferentes formatos de respuesta
    if (json.data !== undefined) {
      return json.data;
    } else if (json.registro !== undefined) {
      return json.registro;
    } else if (Array.isArray(json)) {
      return json;
    } else {
      return json;
    }
  }

  /**
   * Crea el registro en tiempos — identifica por id_master
   * Retorna { registro, yaExistia }
   */
  async insertarTiempo(registroTiempo) {
    const data = await this._call("iniciar_tiempo", {
      id_master:   registroTiempo.id_master,
      op:          registroTiempo.op,
      referencia:  registroTiempo.referencia,
      taller:      registroTiempo.taller,
      linea:       registroTiempo.linea,
      prenda:      registroTiempo.prenda,
      genero:      registroTiempo.genero,
      cantidad:    registroTiempo.cantidad,
      productora:  registroTiempo.productora,
      escaneado_por: registroTiempo.escaneado_por
    });
    return {
      registro: new RegistroTiempo(data.registro),
      yaExistia: Boolean(data.yaExistia)
    };
  }

  /**
   * Cambia retención — identifica por id_master
   */
  async actualizarRetencion(id_master, { retenido, motivo }) {
    try {
      const data = await this._call("cambiar_retencion", {
        id_master,
        retenido: Boolean(retenido),
        motivo: motivo || null
      });
      
      // Manejar diferentes formatos de respuesta
      if (data === null || data === undefined) {
        // Si no retorna datos, intentar consultar el registro actualizado
        const actualizado = await this.consultarActivo(id_master);
        return actualizado || new RegistroTiempo({ id_master, retenido, motivo });
      }
      
      return new RegistroTiempo(data);
    } catch (error) {
      console.error("Error en actualizarRetención:", error);
      // Si falla, intentar al menos retornar un objeto básico
      return new RegistroTiempo({ id_master, retenido, motivo });
    }
  }

  /**
   * Finaliza el tiempo — identifica por id_master
   */
  async finalizarTiempo(id_master) {
    const data = await this._call("finalizar_tiempo", { id_master });
    return new RegistroTiempo(data);
  }

  /**
   * Consulta el registro activo de un id_master (sin fecha_finalizacion)
   */
  async consultarActivo(id_master) {
    const data = await this._call("consultar_activo", { id_master });
    return data ? new RegistroTiempo(data) : null;
  }

  async listarRecientes(limit = 30) {
    const data = await this._call("listar_recientes", { limit });
    return (data || []).map(r => new RegistroTiempo(r));
  }

  /**
   * Obtiene la configuración de Google Sheets centralizada en la EF
   */
  async obtenerConfigSheets() {
    return await this._call("obtener_config", {});
  }
}
