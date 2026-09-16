import { EF_TIEMPOS_URL, SUPABASE_ANON_KEY } from "../../infrastructure/supabase/config.js";

/**
 * Servicio de Dominio: LoginEmailResolver
 * Resuelve dinámicamente el correo del operario consultando la Edge Function.
 * NO contiene datos hardcodeados.
 * Admite cualquier variación de mayúsculas, minúsculas, tipo oración ("Kevin", "KEVIN", "kevin", "Nicole", etc.).
 */

let memoryOperariosMap = {};
let memoryNamesMap = {};

/**
 * Normaliza cualquier texto quitando acentos, espacios y convirtiendo a minúsculas.
 */
export function normalizarTexto(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Consulta el mapa de operarios centralizado en la Edge Function
 */
export async function cargarOperariosDesdeEF() {
  try {
    const res = await fetch(EF_TIEMPOS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "apikey": SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ action: "obtener_operarios" })
    });
    const json = await res.json();
    if (json.success && json.data) {
      memoryOperariosMap = json.data.operariosMap || {};
      memoryNamesMap = json.data.namesMap || {};
      try {
        localStorage.setItem("tiempos_operarios_map", JSON.stringify(memoryOperariosMap));
        localStorage.setItem("tiempos_operarios_names", JSON.stringify(memoryNamesMap));
      } catch {}
      return true;
    }
  } catch (err) {
    console.warn("⚠️ No se pudo consultar mapa de operarios desde EF:", err.message);
  }
  return false;
}

/**
 * Resuelve el correo a partir del nombre ingresado (tipo oración, mayúsculas, minúsculas)
 * o retorna el correo tal cual si el usuario ya escribió un email directo.
 * @param {string} identificador Nombre de operario o correo electrónico
 * @returns {Promise<string>} Correo electrónico para autenticación
 */
export async function resolverEmailOperario(identificador) {
  if (!identificador) return "";
  const key = normalizarTexto(identificador);

  // Si ya es un correo directo, retornar directamente
  if (identificador.includes("@")) {
    return String(identificador).trim();
  }

  // 1. Verificar si ya está en memoria
  if (Object.keys(memoryOperariosMap).length === 0) {
    try {
      const stored = localStorage.getItem("tiempos_operarios_map");
      if (stored) memoryOperariosMap = JSON.parse(stored);
    } catch {}
  }

  // 2. Si no se encuentra en memoria/storage o está vacío, consultar a la Edge Function
  if (!memoryOperariosMap[key]) {
    await cargarOperariosDesdeEF();
  }

  // 3. Buscar en el mapa obtenido de la EF
  if (memoryOperariosMap[key]) {
    return memoryOperariosMap[key];
  }

  // Fallback: retornar lo que el usuario escribió
  return String(identificador).trim();
}

/**
 * Resuelve el nombre del operario para la interfaz (Kevin, Yamileth, Paula, Tatiana, Nicole).
 * @param {string} email Correo del usuario autenticado
 * @param {string} [metadataName] Nombre proveniente de user_metadata
 * @returns {string} Nombre para mostrar en pantalla
 */
export function resolverNombreOperario(email, metadataName) {
  if (metadataName && metadataName !== "Operario" && !metadataName.includes("@")) {
    return metadataName;
  }
  const emailNorm = String(email || "").trim().toLowerCase();
  
  if (Object.keys(memoryNamesMap).length === 0) {
    try {
      const stored = localStorage.getItem("tiempos_operarios_names");
      if (stored) memoryNamesMap = JSON.parse(stored);
    } catch {}
  }

  if (memoryNamesMap[emailNorm]) {
    return memoryNamesMap[emailNorm];
  }
  return metadataName || email || "Operario";
}
