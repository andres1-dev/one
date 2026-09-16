import { RegistroTiempo } from "../domain/entities/RegistroTiempo.js";

/**
 * Caso de Uso: IniciarTiempoUseCase
 * Crea el registro inicial en tiempos usando id_master como clave de negocio.
 * Si ya existe un proceso activo para ese id_master, retorna el existente.
 */
export class IniciarTiempoUseCase {
  constructor(tiemposPort) {
    this.tiemposPort = tiemposPort;
  }

  async execute({ masterItem, escaneadoPor }) {
    if (!masterItem) throw new Error("Datos de la orden master requeridos");
    if (!masterItem.id_master) throw new Error("id_master requerido");

    const payload = new RegistroTiempo({
      id_master:     String(masterItem.id_master).trim(),
      op:            parseInt(masterItem.id_master, 10) || 0,
      referencia:    masterItem.referencia || "",
      taller:        masterItem.taller || masterItem.nombre_planta || "",
      linea:         masterItem.linea || masterItem.cuento || "",
      prenda:        masterItem.prenda || masterItem.descripcion || "",
      genero:        masterItem.genero || "",
      cantidad:      Number(masterItem.cantidad) || 0,
      productora:    masterItem.productora || "",
      escaneado_por: escaneadoPor || "Operario",
      fecha_ingreso: new Date().toISOString()
    });

    // El adaptador retorna { registro: RegistroTiempo, yaExistia: boolean }
    return await this.tiemposPort.insertarTiempo(payload);
  }
}
