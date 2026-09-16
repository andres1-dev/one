import { getSupabaseClient } from "./config.js";
import { AuthPort } from "../../domain/ports/AuthPort.js";

/**
 * Adaptador de Autenticación usando SOLO el SDK de Supabase Auth.
 * No pide configuración al usuario - usa las constantes de config.js.
 */
export class SupabaseAuthAdapter extends AuthPort {
  client() {
    return getSupabaseClient();
  }

  async login(email, password) {
    const { data, error } = await this.client().auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    const user = data.user;
    return {
      user,
      session: data.session,
      displayName: user?.user_metadata?.full_name || user?.email || "Operario"
    };
  }

  async logout() {
    await this.client().auth.signOut();
    return true;
  }

  async getSession() {
    const { data, error } = await this.client().auth.getSession();
    if (error || !data.session) return null;
    const user = data.session.user;
    return {
      user,
      session: data.session,
      displayName: user?.user_metadata?.full_name || user?.email || "Operario"
    };
  }

  onAuthStateChange(callback) {
    const { data } = this.client().auth.onAuthStateChange((event, session) => {
      const user = session?.user;
      callback(event, user ? {
        user,
        session,
        displayName: user?.user_metadata?.full_name || user?.email || "Operario"
      } : null);
    });
    return () => data?.subscription?.unsubscribe();
  }
}
