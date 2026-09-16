import { TiemposPort } from "../../domain/ports/TiemposPort.js";
import { RegistroTiempo } from "../../domain/entities/RegistroTiempo.js";
import { SupabaseConfig } from "./SupabaseConfig.js";

/**
 * Adaptador Secundario: SupabaseTiemposAdapter
 * Persiste y consulta datos en la tabla 'tiempos' de Supabase
 */
export class SupabaseTiemposAdapter extends TiemposPort {
  getClient() {
    const client = SupabaseConfig.getClient();
    if (!client) {
      throw new Error("Supabase no está configurado.");
    }
    return client;
  }

  async insertarTiempo(registroTiempo) {
    const client = this.getClient();

    const insertPayload = {
      id_master: registroTiempo.id_master,
      op: registroTiempo.op,
      referencia: registroTiempo.referencia,
      taller: registroTiempo.taller,
      linea: registroTiempo.linea,
      prenda: registroTiempo.prenda,
      genero: registroTiempo.genero,
      cantidad: registroTiempo.cantidad,
      productora: registroTiempo.productora,
      motivo: registroTiempo.motivo || null,
      retenido: Boolean(registroTiempo.retenido),
      fecha_ingreso: registroTiempo.fecha_ingreso || new Date().toISOString(),
      fecha_finalizacion: registroTiempo.fecha_finalizacion || null,
      escaneado_por: registroTiempo.escaneado_por,
      liberado_por: registroTiempo.liberado_por || null,
      fecha_liberacion: registroTiempo.fecha_liberacion || null
    };

    const { data, error } = await client
      .from("tiempos")
      .insert([insertPayload])
      .select()
      .single();

    if (error) {
      console.error("Error insertando en tiempos:", error);
      throw new Error(`Error al registrar en tiempos: ${error.message}`);
    }

    return new RegistroTiempo(data);
  }

  async actualizarRetencion(idx, { retenido, motivo, fecha_liberacion, liberado_por }) {
    const client = this.getClient();

    const updatePayload = {
      retenido: Boolean(retenido),
      motivo: motivo || null,
      fecha_liberacion: fecha_liberacion || null,
      updated_at: new Date().toISOString()
    };

    if (liberado_por !== undefined) {
      updatePayload.liberado_por = liberado_por;
    }

    const { data, error } = await client
      .from("tiempos")
      .update(updatePayload)
      .eq("idx", idx)
      .select()
      .single();

    if (error) {
      console.error("Error actualizando retención:", error);
      throw new Error(`Error al actualizar retención: ${error.message}`);
    }

    return new RegistroTiempo(data);
  }

  async finalizarTiempo(idx, fecha_finalizacion) {
    const client = this.getClient();

    const updatePayload = {
      fecha_finalizacion: fecha_finalizacion || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await client
      .from("tiempos")
      .update(updatePayload)
      .eq("idx", idx)
      .select()
      .single();

    if (error) {
      console.error("Error al finalizar tiempo:", error);
      throw new Error(`Error al finalizar tiempo: ${error.message}`);
    }

    return new RegistroTiempo(data);
  }

  async listarRecientes(limit = 30) {
    const client = this.getClient();

    const { data, error } = await client
      .from("tiempos")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error al listar registros recientes:", error);
      throw new Error(`Error al obtener registros: ${error.message}`);
    }

    return (data || []).map((row) => new RegistroTiempo(row));
  }
}
