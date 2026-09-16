/**
 * Infraestructura: Configuración y Singleton del Cliente Supabase
 */
const DEFAULT_URL = "https://zpikjjcbievfpzegupmw.supabase.co";
const STORAGE_KEY_ANON = "tiempos_supabase_anon_key";
const STORAGE_KEY_URL = "tiempos_supabase_url";

export class SupabaseConfig {
  static getUrl() {
    return localStorage.getItem(STORAGE_KEY_URL) || DEFAULT_URL;
  }

  static setUrl(url) {
    if (url) localStorage.setItem(STORAGE_KEY_URL, url.trim());
  }

  static getAnonKey() {
    return localStorage.getItem(STORAGE_KEY_ANON) || "";
  }

  static setAnonKey(key) {
    if (key) localStorage.setItem(STORAGE_KEY_ANON, key.trim());
  }

  static hasKeys() {
    return Boolean(this.getAnonKey());
  }

  static getClient() {
    if (window._supabaseClientInstance) {
      return window._supabaseClientInstance;
    }

    const url = this.getUrl();
    const anonKey = this.getAnonKey();

    if (!window.supabase || !window.supabase.createClient) {
      throw new Error("La librería Supabase JS no está cargada en el navegador");
    }

    if (!anonKey) {
      return null;
    }

    window._supabaseClientInstance = window.supabase.createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });

    return window._supabaseClientInstance;
  }

  static resetClient() {
    window._supabaseClientInstance = null;
  }
}
