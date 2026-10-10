/**
 * Adaptador de Infraestructura: SupabaseOperationsAdapter
 * Implementa OperationsPort invocando la Edge Function consulta-clientes-plana.
 */
import { OperationsPort } from "../../domain/ports/OperationsPort.js";

export class SupabaseOperationsAdapter extends OperationsPort {
  constructor(supabaseClient) {
    super();
    this.client = supabaseClient;
    this._lastRange = null; // caché del rango devuelto por el edge function
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

    // Cachear el rango si lo devuelve el edge function
    this._lastRange = data?.rango?.fecha_desde ? data.rango : null;

    return data;
  }

  /**
   * Devuelve { fecha_desde, fecha_hasta } con el rango real.
   * Usa el rango que vino gratis en la ultima respuesta del edge function.
   * Si no hay, hace fallback consultando directamente la tabla ingresos.
   */
  async fetchOperationalRange() {
    if (this._lastRange && this._lastRange.fecha_desde) {
      return { ...this._lastRange };
    }

    try {
      const now = new Date();
      const limiteMin = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        .toISOString().slice(0, 10);

      const { data, error } = await this.client
        .from("ingresos")
        .select("fecha_ingreso")
        .gte("fecha_ingreso", limiteMin)
        .order("fecha_ingreso", { ascending: true })
        .limit(1);

      if (!error && data && data.length > 0 && data[0].fecha_ingreso) {
        return {
          fecha_desde: String(data[0].fecha_ingreso).slice(0, 10),
          fecha_hasta: now.toISOString().slice(0, 10)
        };
      }
    } catch {
      // No disponible
    }

    return null;
  }
}
