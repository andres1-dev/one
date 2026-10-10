/**
 * Adaptador de Infraestructura: SupabaseOperationsAdapter
 * Implementa OperationsPort invocando la Edge Function consulta-clientes-plana.
 */
import { OperationsPort } from "../../domain/ports/OperationsPort.js";

export class SupabaseOperationsAdapter extends OperationsPort {
  constructor(supabaseClient) {
    super();
    this.client = supabaseClient;
  }

  async fetchOperations(id = null) {
    const payload = {
      id: id ? String(id).trim() : undefined
    };

    const { data, error } = await this.client.functions.invoke("consulta-clientes-plana", {
      body: payload
    });

    if (error) {
      let detail = error.message || "Error al conectar con el servidor.";
      if (error.context && typeof error.context.json === "function") {
        try {
          const body = await error.context.json();
          detail += "\n" + JSON.stringify(body, null, 2);
        } catch { }
      }
      throw new Error(detail);
    }

    if (data?.error) {
      throw new Error(data.error + (data.detalle ? "\n" + data.detalle : ""));
    }

    return data;
  }
}
