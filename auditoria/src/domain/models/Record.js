/**
 * Entidad de Dominio: Record (Registro Operativo)
 * Define la estructura, campos admitidos y reglas de formato para trazabilidad logística.
 */

export const RECORD_FIELDS = [
  "id_ingreso",
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
  "alerta_cantidad"
];

export const RECORD_HEADERS = [
  "ID ingreso",
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
  "Alerta cantidad"
];

export class Record {
  constructor(data = {}) {
    this.id_ingreso = data.id_ingreso ?? null;
    this.fecha_ingreso = data.fecha_ingreso ?? null;
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
    return this.alerta_cantidad != null && this.alerta_cantidad !== "";
  }
}
