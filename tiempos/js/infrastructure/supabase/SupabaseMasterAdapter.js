import { MasterPort } from "../../domain/ports/MasterPort.js";
import { MasterItem } from "../../domain/entities/MasterItem.js";
import { SupabaseConfig } from "./SupabaseConfig.js";

/**
 * Adaptador Secundario: SupabaseMasterAdapter
 * Implementa MasterPort consultando la tabla 'master' de Supabase
 */
export class SupabaseMasterAdapter extends MasterPort {
  getClient() {
    const client = SupabaseConfig.getClient();
    if (!client) {
      throw new Error("Supabase no está configurado.");
    }
    return client;
  }

  async findByIdMaster(id_master) {
    const client = this.getClient();
    const cleanId = String(id_master).trim();

    const { data, error } = await client
      .from("master")
      .select("*")
      .eq("id_master", cleanId)
      .maybeSingle();

    if (error) {
      console.error("Error consultando tabla master:", error);
      throw new Error(`Error en base de datos al buscar '${cleanId}': ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return new MasterItem(data);
  }
}
