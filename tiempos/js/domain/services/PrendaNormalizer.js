/**
 * Servicio de Dominio: PrendaNormalizer
 * Normaliza nombres de prendas eliminando plurales (BLUSA no BLUSAS, PANTALON no PANTALONES, JEAN no JEANS),
 * corrigiendo ortografía, disgrafías y errores tipográficos para consolidar un catálogo de prendas únicas.
 */

// Catálogo canónico de prendas únicas
export const CATALOGO_PRENDAS = Object.freeze([
  "BATOLA",
  "BERMUDA",
  "BIKINI",
  "BLAZER",
  "BLUSA",
  "BODY",
  "BOXER",
  "BRASSIER",
  "BUSO",
  "CACHETERO",
  "CAMISA",
  "CAMISETA",
  "CAMISILLA",
  "CAMISERA",
  "CAPRI",
  "CARGO",
  "CHALECO",
  "CHAQUETA",
  "COBIJA",
  "CONJUNTO",
  "CORSET",
  "CROPTOP",
  "ENTERIZO",
  "FALDA",
  "JARDINERA",
  "JEAN",
  "JOGGER",
  "JORT",
  "LEVANTADORA",
  "LYCRA",
  "PANTALON",
  "PANTALONETA",
  "PIJAMA",
  "POLO",
  "SALIDA DE BAÑO",
  "SHORT",
  "SOBRETODO",
  "SUDADERA",
  "TANGA",
  "TOP",
  "TORERO",
  "VESTIDO",
  "PRENDAS"
]);

// Diccionario de correcciones ortográficas y disgrafías frecuentes
const CORRECCIONES = Object.freeze({
  // Blusa / Blazer
  "BUSA":        "BLUSA",
  "BLUSAS":      "BLUSA",
  "BLUSON":      "BLUSA",
  "BLUSONES":    "BLUSA",
  "BLUDA":       "BLUSA",
  "BLUSADE":     "BLUSA",
  "BLUSAM/SISA": "BLUSA",
  "BLUSAMAN/CTA":"BLUSA",
  "BLEIZER":     "BLAZER",
  "BLAZERS":     "BLAZER",

  // Body
  "BOBY":        "BODY",
  "BODYS":       "BODY",
  "BODIES":      "BODY",

  // Buso / Buzo
  "BUZO":        "BUSO",
  "BUZOS":       "BUSO",
  "BUSOS":       "BUSO",

  // Chaleco
  "CALECO":      "CHALECO",
  "CHALECOS":    "CHALECO",
  "SOBRETOD":    "SOBRETODO",
  "SOBRETODOS":  "SOBRETODO",

  // Camiseta / Camisa
  "CAMISETA,":   "CAMISETA",
  "CAMISTEA":    "CAMISETA",
  "CAMISETAS":   "CAMISETA",
  "CAMISA,":     "CAMISA",
  "CAMISAS":     "CAMISA",
  "CAMICETA":    "CAMISETA",
  "CAMISIYA":    "CAMISILLA",
  "CAMISILLAS":  "CAMISILLA",

  // Capri
  "CAPRY":       "CAPRI",
  "CAPRIS":      "CAPRI",

  // Conjunto
  "CONJUTO":     "CONJUNTO",
  "COJUNTO":     "CONJUNTO",
  "CONJ":        "CONJUNTO",
  "CONJUN":      "CONJUNTO",
  "CONJUNTOS":   "CONJUNTO",

  // CropTop
  "CRO":         "CROPTOP",
  "CROP":        "CROPTOP",
  "CROT":        "CROPTOP",
  "CROTOPS":     "CROPTOP",
  "CROPTINC":    "CROPTOP",

  // Enterizo
  "ENTERICO":    "ENTERIZO",
  "ENTERRIZO":   "ENTERIZO",
  "ENTRERIZO":   "ENTERIZO",
  "ENERIZO":     "ENTERIZO",
  "ENTERIZA":    "ENTERIZO",
  "ENTERIZOS":   "ENTERIZO",
  "ENTERIZAS":   "ENTERIZO",

  // Falda / Jardinera
  "FALDAS":      "FALDA",
  "OVEROL":      "JARDINERA",
  "OVEROLES":    "JARDINERA",
  "BRAGA":       "JARDINERA",
  "BRAGAS":      "JARDINERA",
  "FALDASHORT":  "FALDA",
  "JARDINERAS":  "JARDINERA",

  // Jean / Jort
  "EAN":         "JEAN",
  "JEANS":       "JEAN",
  "YIN":         "JEAN",
  "YINS":        "JEAN",
  "JIN":         "JEAN",
  "JINS":        "JEAN",
  "MOCHO":       "JORT",
  "MOCHOS":      "JORT",
  "JORTS":       "JORT",

  // Lycra / Leggins
  "LEGGUIS":     "LYCRA",
  "LEGGINS":     "LYCRA",
  "LEGGING":     "LYCRA",
  "LEGGI":       "LYCRA",
  "LEGGIS":      "LYCRA",
  "LICRA":       "LYCRA",
  "LICRAS":      "LYCRA",
  "LYCRAS":      "LYCRA",

  // Pantalon
  "PANTALO":          "PANTALON",
  "PANTALON,":        "PANTALON",
  "PANTALONE":        "PANTALON",
  "PANTALONES":       "PANTALON",
  "PANTALONELASTICO": "PANTALON",
  "PATALON":          "PANTALON",
  "PATALONES":        "PANTALON",
  "PANTALONCITO":     "PANTALON",
  "PANTALOM":         "PANTALON",

  // Pantaloneta
  "PAATALONETA":  "PANTALONETA",
  "PANTALONETA,": "PANTALONETA",
  "PANTALONETAS": "PANTALONETA",

  // Short / Bermuda
  "SHORTH":      "SHORT",
  "SHOR":        "SHORT",
  "SHOTR":       "SHORT",
  "SHORTS":      "SHORT",
  "CHORT":       "SHORT",
  "CHORTS":      "SHORT",
  "BERMUDAS":    "BERMUDA",

  // Sudadera / Jogger
  "SURARERA":    "SUDADERA",
  "SUDARERA":    "SUDADERA",
  "SUDADERAS":   "SUDADERA",
  "JOGGERS":     "JOGGER",

  // Chaqueta
  "CHAQUETAS":   "CHAQUETA",
  "CHAQUETON":   "CHAQUETA",

  // Torero
  "TORRERO":     "TORERO",
  "TOREROS":     "TORERO",

  // Tropelera
  "TROPELERA":   "CAMISILLA",

  // Vestido
  "VESTIDIO":    "VESTIDO",
  "VESRTIDO":    "VESTIDO",
  "VESTIDOS":    "VESTIDO",

  // Pijamas / Ropa interior
  "PIJAMAS":     "PIJAMA",
  "BOXERS":      "BOXER",
  "BOXSER":      "BOXER",
  "BOXER PROMOCION": "BOXER",
  "BOXERPROMOCION": "BOXER",
  "TANGAS":      "TANGA",
  "CACHETEROS":  "CACHETERO",
  "BRASSIERS":   "BRASSIER",
  "BRASIER":     "BRASSIER",
  "BRASIERS":    "BRASSIER",
  "BATOLAS":     "BATOLA",
  "BATOLITA":    "BATOLA",
  "BATOLITAS":   "BATOLA",
  "BIKINIS":     "BIKINI"
});

/**
 * Despluraliza una palabra individual con reglas gramaticales específicas del español de confección.
 */
export function normalizarSingular(palabra) {
  if (!palabra) return "";
  let p = palabra.toUpperCase().trim();

  // Excepciones donde la terminación en S no es plural o ya es canónica
  if (["LYCRA", "CROPTOP", "BATOLA"].includes(p)) return p;

  if (CORRECCIONES[p]) {
    return CORRECCIONES[p];
  }

  // Plurales terminados en -ES (ej: PANTALONES -> PANTALON, SOBRETODOS -> SOBRETODO)
  if (p.endsWith("ES")) {
    if (p === "PANTALONES") return "PANTALON";
    if (p === "OVEROLES")   return "JARDINERA";
    if (p === "BODIES")     return "BODY";
    if (p === "BLUSONES")   return "BLUSA";
    return p.slice(0, -2);
  }

  // Plurales terminados en -S
  if (p.endsWith("S") && p.length > 3) {
    if (p === "JEANS") return "JEAN";
    if (p === "SHORTS") return "SHORT";
    if (p === "JORTS") return "JORT";
    return p.slice(0, -1);
  }

  return p;
}

/**
 * Normaliza cualquier texto de prenda o descripción de orden a una prenda canónica singular y limpia.
 * @param {string} textoEntrada - Descripción larga, nombre de prenda o texto libre del ERP.
 * @returns {string} - Nombre de la prenda canónica única en singular.
 */
export function normalizarPrenda(textoEntrada) {
  if (!textoEntrada) return "";

  // 1. Limpieza inicial: mayúsculas, quitar caracteres no alfabéticos iniciales y tildes
  let texto = String(textoEntrada)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remover tildes para uniformidad
    .trim()
    .replace(/^[^A-Z0-9]+/, "");

  if (!texto) return "";

  const palabras = texto.split(/\s+/).filter(Boolean);
  if (!palabras.length) return "";

  // 2. Regla especial: paquetes y promocionales
  const esPromocionOVarias = /\b(?:PRENDAS?|PROMO(?:CION)?)\b/.test(texto) && 
                            (/\bVARIAS\b/.test(texto) || /\bPROMO(?:CION)?\b/.test(texto));
  
  // Si es promocional, primero extraer la prenda real antes de decidir
  if (esPromocionOVarias) {
    // Primero intentamos encontrar la prenda específica
    let prendaEncontrada = null;
    for (let i = 0; i < Math.min(palabras.length, 3); i++) {
      const palabraNormalizada = normalizarSingular(palabras[i].replace(/[^A-Z0-9]/g, ""));
      if (CATALOGO_PRENDAS.includes(palabraNormalizada)) {
        prendaEncontrada = palabraNormalizada;
        break;
      }
    }
    
    // Si encontramos una prenda específica, usamos esa en lugar de "PRENDAS"
    if (prendaEncontrada) {
      return prendaEncontrada;
    }
    
    // Solo si no encontramos prenda específica, usamos "PRENDAS"
    return "PRENDAS";
  }

  // 3. Aplicar diccionario de corrección directa a palabras
  const palabrasCorr = palabras.map(p => {
    const limpia = p.replace(/[^A-Z0-9/]/g, "");
    return CORRECCIONES[limpia] || limpia;
  });

  // 3.5. Caso especial para combinaciones como "BOXER PROMOCION"
  // Unir palabras para buscar combinaciones específicas
  const combinaciones = [];
  for (let i = 0; i < palabrasCorr.length - 1; i++) {
    combinaciones.push(palabrasCorr[i] + " " + palabrasCorr[i + 1]);
  }
  
  // Verificar si alguna combinación está en el diccionario
  for (const combo of combinaciones) {
    if (CORRECCIONES[combo]) {
      // Si encontramos una combinación, reemplazar las palabras relevantes
      const palabrasCombo = combo.split(" ");
      const idx = palabrasCorr.indexOf(palabrasCombo[0]);
      if (idx !== -1) {
        palabrasCorr[idx] = CORRECCIONES[combo];
        palabrasCorr.splice(idx + 1, 1); // Eliminar la segunda palabra
        break;
      }
    }
  }

  // 4. Casos compuestos prioritarios
  // SALIDA DE BAÑO
  if (palabrasCorr[0] === "SALIDA" && 
      (palabrasCorr[1] === "DE" && (palabrasCorr[2] === "BANO" || palabrasCorr[2] === "BAÑO") || 
       palabrasCorr[1] === "BANO" || palabrasCorr[1] === "BAÑO")) {
    return "SALIDA DE BAÑO";
  }

  // CROP TOP -> CROPTOP
  if (palabrasCorr[0] === "CROP" && palabrasCorr[1] === "TOP") {
    return "CROPTOP";
  }

  // PACK
  if (palabrasCorr[0] === "PACK") {
    if (palabrasCorr[1] === "X" && palabrasCorr[2]) {
      return `PACK X ${palabrasCorr[2]}`;
    }
    if (/^X\d+$/i.test(palabrasCorr[1] || "")) {
      return `PACK ${palabrasCorr[1].toUpperCase()}`;
    }
    return "PACK";
  }

  // DUO <PRENDA>
  if (palabrasCorr[0] === "DUO") {
    const p2idx = palabrasCorr[1] === "DE" ? 2 : 1;
    const p2 = palabrasCorr[p2idx] ? normalizarSingular(palabrasCorr[p2idx]) : "";
    return p2 ? `DUO ${p2}` : "DUO";
  }
  if (palabrasCorr.indexOf("DUO") === 1) {
    const p1 = normalizarSingular(palabrasCorr[0]);
    return `DUO ${p1}`;
  }

  // TRIO <PRENDA>
  if (palabrasCorr[0] === "TRIO") {
    const p2idx = palabrasCorr[1] === "DE" ? 2 : 1;
    const p2 = palabrasCorr[p2idx] ? normalizarSingular(palabrasCorr[p2idx]) : "";
    return p2 ? `TRIO ${p2}` : "TRIO";
  }
  if (palabrasCorr.indexOf("TRIO") === 1) {
    const p1 = normalizarSingular(palabrasCorr[0]);
    return `TRIO ${p1}`;
  }

  // 5. Normalizar la primera palabra relevante
  let prenda = normalizarSingular(palabrasCorr[0]);

  // Caso especial: si la primera palabra no es reconocida pero hay "PROMOCION" después
  // buscar la prenda antes de PROMOCION
  if (!CATALOGO_PRENDAS.includes(prenda)) {
    const promoIndex = palabrasCorr.indexOf("PROMOCION");
    if (promoIndex > 0) {
      // Verificar si hay una prenda antes de PROMOCION
      for (let i = 0; i < promoIndex; i++) {
        const candidata = normalizarSingular(palabrasCorr[i]);
        if (CATALOGO_PRENDAS.includes(candidata)) {
          prenda = candidata;
          break;
        }
      }
    }
  }

  // Si aún no encontramos prenda, buscar en las primeras 3 palabras
  if (!CATALOGO_PRENDAS.includes(prenda)) {
    for (let i = 1; i < Math.min(palabrasCorr.length, 3); i++) {
      const candidata = normalizarSingular(palabrasCorr[i]);
      if (CATALOGO_PRENDAS.includes(candidata)) {
        prenda = candidata;
        break;
      }
    }
  }

  return prenda;
}
