/**
 * Caso de Uso: BuscarMasterUseCase
 */
export class BuscarMasterUseCase {
  constructor(masterPort) {
    this.masterPort = masterPort;
  }

  async execute(id_master) {
    if (!id_master || !String(id_master).trim()) {
      throw new Error("Debe ingresar un ID Master para buscar");
    }
    const cleanId = String(id_master).trim();
    const item = await this.masterPort.findByIdMaster(cleanId);
    if (!item) {
      throw new Error(`No se encontró ningún registro en 'master' con id_master: ${cleanId}`);
    }
    return item;
  }
}
