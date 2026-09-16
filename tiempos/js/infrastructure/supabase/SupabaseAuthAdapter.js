import { getSupabaseClient } from "./config.js";
import { AuthPort } from "../../domain/ports/AuthPort.js";
import { resolverEmailOperario, resolverNombreOperario } from "../../domain/services/LoginEmailResolver.js";

/**
 * Adaptador de Autenticación usando el SDK de Supabase Auth.
 * Admite autenticación directa por nombre (kevin, yamileth, paula, tatiana, nicol) o correo.
 */
export class SupabaseAuthAdapter extends AuthPort {
  client() {
    return getSupabaseClient();
  }

  async login(identificador, password) {
    const email = await resolverEmailOperario(identificador);
    const { data, error } = await this.client().auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    const user = data.user;
    return {
      user,
      session: data.session,
      displayName: resolverNombreOperario(user?.email, user?.user_metadata?.full_name)
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
      displayName: resolverNombreOperario(user?.email, user?.user_metadata?.full_name)
    };
  }

  onAuthStateChange(callback) {
    const { data } = this.client().auth.onAuthStateChange((event, session) => {
      const user = session?.user;
      callback(event, user ? {
        user,
        session,
        displayName: resolverNombreOperario(user?.email, user?.user_metadata?.full_name)
      } : null);
    });
    return () => data?.subscription?.unsubscribe();
  }
}
