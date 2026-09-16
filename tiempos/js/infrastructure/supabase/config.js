/**
 * CONSTANTES DE SUPABASE - Solo ANON KEY (pública y segura en el cliente)
 * Toda la lógica sensible y de RLS vive en la Edge Function del servidor.
 *
 * 👉 REEMPLAZA "TU_ANON_KEY_AQUI" con tu clave pública de Supabase:
 *    Project: zpikjjcbievfpzegupmw
 *    Dashboard -> Settings -> API -> Project API Keys -> anon public
 */
export const SUPABASE_URL = "https://zpikjjcbievfpzegupmw.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwaWtqamNiaWV2ZnB6ZWd1cG13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NzU1NDEsImV4cCI6MjA5MjQ1MTU0MX0.HJxSSIcUSVrf5IAsjwnkf3eq0xZobchtlg1k_iFjW_g";

// URL base de las Edge Functions
export const EF_BASE_URL = `${SUPABASE_URL}/functions/v1`;
export const EF_TIEMPOS_URL = `${EF_BASE_URL}/tiempos-handler`;

/**
 * Retorna el cliente Supabase singleton (solo para Auth + login)
 * El cliente usa la anon key, el JWT viaja a la EF para operaciones RLS.
 */
let _client = null;
export function getSupabaseClient() {
  if (_client) return _client;
  if (!window.supabase?.createClient) {
    throw new Error("SDK de Supabase no disponible. Revisa el script en index.html.");
  }
  _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
  return _client;
}
