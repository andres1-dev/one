/**
 * Puerto: TiemposPort
 * El cliente siempre opera por id_master — el idx es interno del servidor (EF).
 */
export class TiemposPort {
  /** Crea el registro inicial en tiempos. Retorna { registro, yaExistia } */
  async insertarTiempo(registroTiempo) {
    throw new Error("No implementado");
  }

  /** Cambia el estado de retención del proceso activo de un id_master */
  async actualizarRetencion(id_master, { retenido, motivo }) {
    throw new Error("No implementado");
  }

  /** Finaliza el proceso activo de un id_master */
  async finalizarTiempo(id_master) {
    throw new Error("No implementado");
  }

  /** Consulta el registro activo (sin fecha_finalizacion) de un id_master */
  async consultarActivo(id_master) {
    throw new Error("No implementado");
  }

  /** Lista los últimos N registros de tiempos */
  async listarRecientes(limit = 30) {
    throw new Error("No implementado");
  }
}
