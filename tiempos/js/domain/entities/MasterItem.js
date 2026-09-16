import { normalizarPrenda } from "../services/PrendaNormalizer.js";
import { normalizarProductora } from "../services/ProductoraNormalizer.js";

/**
 * Dominio: Entidad MasterItem
 * Representa la orden / lote de la tabla 'master'
 */
export class MasterItem {
  constructor({
    idx = 0,
    id_master = "",
    referencia = "",
    cantidad = 0,
    nombre_planta = "",
    fecha_salida = "",
    fecha_entrega = "",
    proceso = "",
    descripcion = "",
    cuento = "",
    genero = "",
    costo = 0,
    observaciones = "",
    productora = ""
  } = {}) {
    this.idx = Number(idx);
    this.id_master = String(id_master || "").trim();
    this.referencia = String(referencia || "").trim();
    this.cantidad = Number(cantidad || 0);
    this.nombre_planta = String(nombre_planta || "").trim();
    this.fecha_salida = fecha_salida;
    this.fecha_entrega = fecha_entrega;
    this.proceso = String(proceso || "").trim();
    this.descripcion = String(descripcion || "").trim();
    this.prenda = normalizarPrenda(this.descripcion);
    this.cuento = String(cuento || "").trim();
    this.genero = String(genero || "").trim();
    this.costo = Number(costo || 0);
    this.observaciones = String(observaciones || "").trim();
    this.productora = normalizarProductora(productora);
  }

  /**
   * Mapeo limpio hacia la estructura que requiere 'tiempos' con prenda y productora normalizadas
   */
  toTiemposPayload(escaneadoPor = "") {
    return {
      id_master: this.id_master,
      op: parseInt(this.id_master, 10) || 0,
      referencia: this.referencia,
      taller: this.nombre_planta,
      linea: this.cuento,
      prenda: this.prenda || normalizarPrenda(this.descripcion),
      genero: this.genero,
      cantidad: this.cantidad,
      productora: this.productora,
      motivo: null,
      retenido: false,
      fecha_ingreso: new Date().toISOString(),
      fecha_finalizacion: null,
      escaneado_por: escaneadoPor,
      liberado_por: null,
      fecha_liberacion: null
    };
  }
}
