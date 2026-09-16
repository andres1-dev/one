/**
 * Caso de Uso: FinalizarTiempoUseCase
 * Opera por id_master — la EF busca el registro activo y lo cierra.
 * Solo finaliza el tiempo, NO modifica el estado de retención.
 */
export class FinalizarTiempoUseCase {
  constructor(tiemposPort) {
    this.tiemposPort = tiemposPort;
  }

  async execute({ id_master }) {
    if (!id_master) throw new Error("id_master requerido para finalizar");
    return await this.tiemposPort.finalizarTiempo(id_master);
  }
}
