import { TiemposPort } from "../../domain/ports/TiemposPort.js";
import { RegistroTiempo } from "../../domain/entities/RegistroTiempo.js";

/**
 * Adaptador de Sincronización - Coordina la escritura en Supabase y Google Sheets
 * Implementa el patrón de puertos para mantener consistencia entre ambos sistemas
 * GAS es completamente async y no bloqueante
 */
export class SyncTiemposAdapter extends TiemposPort {
  constructor(supabaseAdapter, sheetsAdapter) {
    super();
    this.supabaseAdapter = supabaseAdapter;
    this.sheetsAdapter = sheetsAdapter;
  }

  /**
   * Inserta tiempo en Supabase inmediatamente, Sheets en background async
   */
  async insertarTiempo(registroTiempo) {
    try {
      console.log("🔄 SyncTiemposAdapter: Iniciando inserción en Supabase");
      
      // Insertar en Supabase inmediatamente (fuente de verdad principal)
      const supabaseResult = await this.supabaseAdapter.insertarTiempo(registroTiempo);
      console.log("✅ Inserción en Supabase exitosa");
      
      // Sincronizar con Google Sheets en background (fire and forget) - SIN ESPERAR
      setTimeout(() => {
        this.sheetsAdapter.insertarTiempo(supabaseResult.registro)
          .catch(error => {
            console.error("Error en sincronización background con Google Sheets:", error);
          });
      }, 0);

      return supabaseResult;
    } catch (error) {
      console.error("❌ Error en SyncTiemposAdapter.insertarTiempo:", error);
      throw error;
    }
  }

  /**
   * Actualiza retención en Supabase inmediatamente, Sheets en background async
   */
  async actualizarRetencion(id_master, { retenido, motivo }) {
    try {
      // Actualizar en Supabase inmediatamente
      const supabaseResult = await this.supabaseAdapter.actualizarRetencion(id_master, { retenido, motivo });
      
      // Sincronizar con Google Sheets en background (fire and forget) - SIN ESPERAR
      setTimeout(() => {
        this.sheetsAdapter.actualizarRetencion(id_master, { 
          retenido, 
          motivo: supabaseResult?.motivo || motivo,
          liberado_por: supabaseResult?.liberado_por,
          fecha_liberacion: supabaseResult?.fecha_liberacion
        }).catch(error => {
          console.error("Error en sincronización background con Google Sheets:", error);
        });
      }, 0);

      return supabaseResult;
    } catch (error) {
      console.error("Error en SyncTiemposAdapter.actualizarRetencion:", error);
      throw error;
    }
  }

  /**
   * Finaliza tiempo en Supabase inmediatamente, Sheets en background async
   */
  async finalizarTiempo(id_master) {
    try {
      // Finalizar en Supabase inmediatamente
      const supabaseResult = await this.supabaseAdapter.finalizarTiempo(id_master);
      
      // Sincronizar con Google Sheets en background (fire and forget) - SIN ESPERAR
      setTimeout(() => {
        this.sheetsAdapter.finalizarTiempo(id_master, supabaseResult)
          .catch(error => {
            console.error("Error en sincronización background con Google Sheets:", error);
          });
      }, 0);

      return supabaseResult;
    } catch (error) {
      console.error("Error en SyncTiemposAdapter.finalizarTiempo:", error);
      throw error;
    }
  }

  /**
   * Consulta activo desde Supabase (fuente principal para activos)
   */
  async consultarActivo(id_master) {
    return await this.supabaseAdapter.consultarActivo(id_master);
  }

  /**
   * Lista recientes desde Supabase (solo activos)
   */
  async listarRecientes(limit = 30) {
    return await this.supabaseAdapter.listarRecientes(limit);
  }

  /**
   * Lista todos los registros desde Google Sheets (históricos)
   */
  async listarHistoricos(limit = 100) {
    return await this.sheetsAdapter.listarRecientes(limit);
  }

  /**
   * Obtiene KPIs desde Google Sheets
   */
  async obtenerKPIs() {
    return await this.sheetsAdapter.obtenerKPIs();
  }

  /**
   * Sincroniza datos desde Google Sheets a Supabase
   */
  async sincronizarDesdeSheets() {
    try {
      const sheetsData = await this.sheetsAdapter.sincronizarDesdeSheets();
      return sheetsData;
    } catch (error) {
      console.error("Error en SyncTiemposAdapter.sincronizarDesdeSheets:", error);
      throw error;
    }
  }
}