/**
 * Servicio de Dominio: ProductoraNormalizer
 * Mapea los IDs numéricos de productoras a sus nombres de empresa correspondientes.
 */
export const PRODUCTORAS_MAP = Object.freeze({
  1: "UNIVERSO",
  "1": "UNIVERSO",
  2: "ANGELES",
  "2": "ANGELES",
  3: "HACEMOS MODA",
  "3": "HACEMOS MODA",
  4: "INVERSIONES URBANA",
  "4": "INVERSIONES URBANA"
});

export function normalizarProductora(valor) {
  if (valor === null || valor === undefined || valor === "") return "";
  const str = String(valor).trim().toUpperCase();
  if (PRODUCTORAS_MAP[str]) {
    return PRODUCTORAS_MAP[str];
  }
  const num = parseInt(str, 10);
  if (!isNaN(num) && PRODUCTORAS_MAP[num]) {
    return PRODUCTORAS_MAP[num];
  }
  return str;
}
