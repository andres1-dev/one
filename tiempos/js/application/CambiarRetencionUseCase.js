/**
 * Caso de Uso: CambiarRetencionUseCase
 * Opera por id_master — la EF resuelve el registro activo.
 */
export class CambiarRetencionUseCase {
  constructor(tiemposPort) {
    this.tiemposPort = tiemposPort;
  }

  async execute({ id_master, nuevoEstadoRetenido, motivo }) {
    if (!id_master) throw new Error("id_master requerido para cambiar retención");

    if (nuevoEstadoRetenido && !motivo) {
      throw new Error("Debe seleccionar un motivo de retención");
    }

    return await this.tiemposPort.actualizarRetencion(id_master, {
      retenido: Boolean(nuevoEstadoRetenido),
      motivo: motivo || null
    });
  }
}
