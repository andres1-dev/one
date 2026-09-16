import { normalizarPrenda } from "../services/PrendaNormalizer.js";
import { normalizarProductora } from "../services/ProductoraNormalizer.js";

/**
 * Dominio: Entidad RegistroTiempo
 * Modela la recopilación de tiempos, retenciones y finalizaciones.
 * Soporta cálculo con milésimas de segundo y ponderados por prenda.
 */
export const MOTIVOS_RETENCION = Object.freeze([
  "PROMOCIONES",
  "LAVADO",
  "CORREO",
  "ARREGLO",
  "PENDIENTES"
]);

export class RegistroTiempo {
  constructor({
    idx = null,
    id_master = "",
    op = null,
    referencia = "",
    taller = "",
    linea = "",
    prenda = "",
    genero = "",
    cantidad = 0,
    productora = "",
    motivo = null,
    retenido = false,
    fecha_ingreso = null,
    fecha_finalizacion = null,
    escaneado_por = "",
    liberado_por = null,
    fecha_liberacion = null,
    fecha_inicio_retencion = null,
    duracion_conteo = null,
    duracion_liberacion = null,
    tiempo_prenda = null,
    created_at = null,
    updated_at = null
  } = {}) {
    this.idx = idx;
    this.id_master = String(id_master || "").trim();
    this.op = op !== null && op !== undefined ? Number(op) : (parseInt(this.id_master, 10) || 0);
    this.referencia = String(referencia || "").trim();
    this.taller = String(taller || "").trim();
    this.linea = String(linea || "").trim();
    this.prenda = normalizarPrenda(prenda);
    this.genero = String(genero || "").trim();
    this.cantidad = Number(cantidad || 0);
    this.productora = normalizarProductora(productora);
    this.motivo = motivo;
    this.retenido = Boolean(retenido);
    this.fecha_ingreso = fecha_ingreso;
    this.fecha_finalizacion = fecha_finalizacion;
    this.escaneado_por = String(escaneado_por || "").trim();
    this.liberado_por = liberado_por;
    this.fecha_liberacion = fecha_liberacion;
    this.fecha_inicio_retencion = fecha_inicio_retencion;
    this.duracion_conteo = duracion_conteo;
    this.duracion_liberacion = duracion_liberacion;
    this.tiempo_prenda = tiempo_prenda !== null && tiempo_prenda !== undefined ? Number(tiempo_prenda) : null;
    this.created_at = created_at;
    this.updated_at = updated_at;
  }

  /**
   * Cambia el estado de retención aplicando las reglas de negocio
   */
  cambiarRetencion(nuevoEstadoRetenido, motivoSeleccionado, usuarioResponsable) {
    const estadoAnterior = this.retenido;
    this.retenido = Boolean(nuevoEstadoRetenido);

    if (this.retenido) {
      if (!motivoSeleccionado || !MOTIVOS_RETENCION.includes(motivoSeleccionado)) {
        throw new Error(`Debe especificar un motivo válido: ${MOTIVOS_RETENCION.join(", ")}`);
      }
      this.motivo = motivoSeleccionado;
      this.fecha_inicio_retencion = new Date().toISOString();
      this.fecha_liberacion = null;
      this.liberado_por = null;
      this.duracion_liberacion = null;
    } else if (estadoAnterior === true && !this.retenido) {
      this.fecha_liberacion = new Date().toISOString();
      this.liberado_por = usuarioResponsable;
      this.fecha_inicio_retencion = null;
      if (this.fecha_ingreso) {
        const ms = new Date(this.fecha_liberacion).getTime() - new Date(this.fecha_ingreso).getTime();
        this.duracion_liberacion = Math.max(0, ms / 1000);
      }
    }
  }

  finalizar() {
    this.fecha_finalizacion = new Date().toISOString();
    if (this.fecha_ingreso) {
      const ms = new Date(this.fecha_finalizacion).getTime() - new Date(this.fecha_ingreso).getTime();
      const segundos = Math.max(0, ms / 1000);
      this.duracion_conteo = segundos;
      const cant = Math.max(1, Number(this.cantidad) || 1);
      this.tiempo_prenda = parseFloat((segundos / cant).toFixed(4));
    }
  }

  /**
   * Duración en milisegundos
   */
  getDuracionMs() {
    if (!this.fecha_ingreso) return 0;
    const inicio = new Date(this.fecha_ingreso).getTime();
    const fin = this.fecha_finalizacion ? new Date(this.fecha_finalizacion).getTime() : Date.now();
    return Math.max(0, fin - inicio);
  }

  /**
   * Duración exacta en segundos con decimales (incluye milésimas)
   */
  getDuracionSegundos() {
    return this.getDuracionMs() / 1000;
  }

  /**
   * Formato de duración en segundos y milésimas (ej: "123.456s")
   */
  getDuracionSegundosFormat() {
    return `${this.getDuracionSegundos().toFixed(3)}s`;
  }

  /**
   * Duración ponderada por unidad de prenda en segundos y milésimas
   */
  getSegundosPorPrenda() {
    const cant = Math.max(1, Number(this.cantidad) || 1);
    return this.getDuracionSegundos() / cant;
  }

  estaFinalizado() {
    return Boolean(this.fecha_finalizacion);
  }

  estaActivo() {
    return Boolean(this.fecha_ingreso) && !this.fecha_finalizacion;
  }
}
