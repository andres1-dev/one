/**
 * Servicio de Dominio: KpiCalculator
 * Lógica pura para el cálculo de métricas operativas de negocio.
 */

export const KPI_PREDICATES = {
  porSeparar: r => r.estado_separacion !== 'FINALIZADO',
  facturadoPorSeparar: r => r.estado_separacion !== 'FINALIZADO' && r.estado_factura === 'Aprobadas',
  pendienteFactura: r => r.estado_factura !== 'Aprobadas',
  totalFacturado: r => r.estado_factura === 'Aprobadas',
  listoEntregar: r => r.estado_separacion === 'FINALIZADO' && r.estado_factura === 'Aprobadas',
  errorCantidad: r => r.alerta_cantidad != null && r.alerta_cantidad !== '',
  errorOp: r => r.alerta_op != null && r.alerta_op !== '',
};

export class KpiCalculator {
  static sumQuantity(rows) {
    return rows.reduce((sum, r) => sum + (Number(r.cantidad) || 0), 0);
  }

  static calculate(rows = []) {
    const porSepararRows = rows.filter(KPI_PREDICATES.porSeparar);

    return {
      porSeparar: this.sumQuantity(porSepararRows),
      facturadoPorSeparar: this.sumQuantity(porSepararRows.filter(r => r.estado_factura === 'Aprobadas')),
      pendienteFactura: this.sumQuantity(rows.filter(KPI_PREDICATES.pendienteFactura)),
      totalFacturado: this.sumQuantity(rows.filter(KPI_PREDICATES.totalFacturado)),
      listoEntregar: this.sumQuantity(rows.filter(KPI_PREDICATES.listoEntregar)),
      errorCantidad: rows.filter(KPI_PREDICATES.errorCantidad).length,
      errorOp: rows.filter(KPI_PREDICATES.errorOp).length
    };
  }
}
