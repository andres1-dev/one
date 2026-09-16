/**
 * Caso de Uso: ListarUltimosTiemposUseCase
 */
export class ListarUltimosTiemposUseCase {
  constructor(tiemposPort) {
    this.tiemposPort = tiemposPort;
  }

  async execute(limit = 30) {
    return await this.tiemposPort.listarRecientes(limit);
  }
}
