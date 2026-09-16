/**
 * Caso de Uso: ConsultarActivoUseCase
 * Consulta si existe un registro activo de tiempos para un id_master.
 */
export class ConsultarActivoUseCase {
  constructor(tiemposPort) {
    this.tiemposPort = tiemposPort;
  }

  async execute(id_master) {
    if (!id_master || !String(id_master).trim()) return null;
    return await this.tiemposPort.consultarActivo(String(id_master).trim());
  }
}
