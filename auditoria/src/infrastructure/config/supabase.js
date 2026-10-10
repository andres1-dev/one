/**
 * Configuración e inicialización del cliente de Supabase
 */
export const SUPABASE_CONFIG = {
  url: "https://ymaojqjdnrpfkrtuezcw.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltYW9qcWpkbnJwZmtydHVlemN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NTIwMTAsImV4cCI6MjEwMTQyODAxMH0.3Zzsw_sriPPjNM8emcOslLNSnadPs8cSguNUCA2MNu8"
};

export function getSupabaseClient() {
  if (!window.supabase || !window.supabase.createClient) {
    throw new Error("El SDK de Supabase no está cargado globalmente.");
  }
  return window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
}
