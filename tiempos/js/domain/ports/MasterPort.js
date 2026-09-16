/**
 * Puerto: MasterPort
 * Define el contrato para la consulta de información de la tabla 'master'.
 */
export class MasterPort {
  /**
   * @param {string} id_master
   * @returns {Promise<import('../entities/MasterItem.js').MasterItem | null>}
   */
  async findByIdMaster(id_master) {
    throw new Error("Método 'findByIdMaster' no implementado");
  }
}
