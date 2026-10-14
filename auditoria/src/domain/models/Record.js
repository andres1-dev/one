/**
 * Entidad de Dominio: Record (Registro Operativo)
 * Define la estructura, campos admitidos y reglas de formato para trazabilidad logística.
 */

export const RECORD_FIELDS = [
  "id_ingreso",
  "fecha_ingreso",
  "op",
  "referencia",
  "refprov",
  "cantidad",
  "prenda",
  "genero",
  "clase",
  "estado_separacion",
  "estado_factura",
  "estado_entrega",
  "nro_factura",
  "cliente",
  "productora",
  "alerta_cantidad",
  "alerta_op"
];

export const RECORD_HEADERS = [
  "ID ingreso",
  "Fecha ingreso",
  "OP",
  "Referencia",
  "Ref. proveedor",
  "Cantidad",
  "Prenda",
  "Género",
  "Clase",
  "Separación",
  "Factura",
  "Entrega",
  "Nro. Factura",
  "Cliente",
  "Productora",
  "Alerta cantidad",
  "Alerta OP"
];

export class Record {
  constructor(data = {}) {
    this.id_ingreso = data.id_ingreso ?? null;
    this.fecha_ingreso = data.fecha_ingreso ? String(data.fecha_ingreso).slice(0, 10) : null;
    this.op = data.op ?? null;
    this.op_factura = data.op_factura ?? null;
    this.referencia = data.referencia ?? "";
    this.refprov = data.refprov ?? "";
    this.cantidad = Number(data.cantidad) || 0;
    this.prenda = data.prenda ?? "";
    this.genero = data.genero ?? "";
    this.clase = data.clase ?? "";
    this.estado_separacion = data.estado_separacion ?? "";
    this.estado_factura = data.estado_factura ?? "";
    this.estado_entrega = data.estado_entrega ?? "";
    this.nro_factura = data.nro_factura ?? null;
    this.cliente = data.cliente ?? "";

    const rawProd = String(data.productora ?? "").trim();
    const cleanDigits = rawProd.replace(/\D/g, "");
    if (cleanDigits === "900616124" || /UNIVERSO/i.test(rawProd)) {
      this.productora = "TEXTILES Y CREACIONES EL UNIVERSO SAS";
    } else if (cleanDigits === "900692469" || /ANGELES/i.test(rawProd)) {
      this.productora = "TEXTILES Y CREACIONES LOS ANGELES SAS";
    } else {
      this.productora = rawProd || "Sin productora";
    }

    this.alerta_cantidad = data.alerta_cantidad ?? null;

    // Discrepancia de OP: si viene calculada del backend se respeta; fallback inteligente si hay datos locales
    if (data.alerta_op !== undefined) {
      this.alerta_op = data.alerta_op;
    } else if (this.nro_factura && (this.op || this.op_factura)) {
      const opFact = String(this.op_factura ?? "").trim();
      const opIng = String(this.op ?? "").trim();
      if (opFact && opIng && opFact !== opIng) {
        this.alerta_op = `Factura: ${opFact} / Ingreso: ${opIng}`;
      } else {
        this.alerta_op = null;
      }
    } else {
      this.alerta_op = null;
    }
  }

  isSeparacionFinalizada() {
    return this.estado_separacion === "FINALIZADO";
  }

  isFacturaAprobada() {
    return this.estado_factura === "Aprobadas";
  }

  isEntregaRealizada() {
    return this.estado_entrega === "ENTREGADO";
  }

  hasDiscrepancia() {
    return this.hasDiscrepanciaCantidad() || this.hasDiscrepanciaOp();
  }

  hasDiscrepanciaCantidad() {
    return this.alerta_cantidad != null && this.alerta_cantidad !== "";
  }

  hasDiscrepanciaOp() {
    return this.alerta_op != null && this.alerta_op !== "";
  }
}
