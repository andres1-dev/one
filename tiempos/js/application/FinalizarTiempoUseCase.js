/**
 * Caso de Uso: FinalizarTiempoUseCase
 * Opera por id_master — finaliza el proceso activo y actualiza el estado de retención y motivo.
 */
export class FinalizarTiempoUseCase {
  constructor(tiemposPort) {
    this.tiemposPort = tiemposPort;
  }

  async execute({ id_master, retenido = false, motivo = null }) {
    if (!id_master) throw new Error("id_master requerido para finalizar");
    return await this.tiemposPort.finalizarTiempo(id_master, { retenido, motivo });
  }
}
