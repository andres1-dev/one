import { EF_TIEMPOS_URL, getSupabaseClient } from "./config.js";
import { MasterPort } from "../../domain/ports/MasterPort.js";
import { MasterItem } from "../../domain/entities/MasterItem.js";

/**
 * Adaptador que llama a la Edge Function para consultar 'master'.
 * El JWT del usuario autenticado se envía en el header — la EF valida RLS.
 */
export class EFMasterAdapter extends MasterPort {
  async _getToken() {
    const { data } = await getSupabaseClient().auth.getSession();
    if (!data?.session?.access_token) throw new Error("Sin sesión activa. Inicia sesión primero.");
    return data.session.access_token;
  }

  async findByIdMaster(id_master) {
    const token = await this._getToken();

    const res = await fetch(EF_TIEMPOS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ action: "consultar_master", payload: { id_master } })
    });

    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error || "Error en Edge Function");
    if (!json.data) return null;
    return new MasterItem(json.data);
  }
}
