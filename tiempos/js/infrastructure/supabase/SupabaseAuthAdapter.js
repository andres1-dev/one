import { getSupabaseClient } from "./config.js";
import { AuthPort } from "../../domain/ports/AuthPort.js";
import { resolverEmailOperario, resolverNombreOperario } from "../../domain/services/LoginEmailResolver.js";

/**
 * Adaptador de Autenticación usando el SDK de Supabase Auth.
 * Admite autenticación directa por nombre (kevin, yamileth, paula, tatiana, nicol) o correo.
 */
function extraerRol(user) {
  if (!user) return "USER-I";
  return String(
    user.app_metadata?.role ||
    user.user_metadata?.role ||
    user.raw_app_meta_data?.role ||
    user.raw_user_meta_data?.role ||
    "USER-I"
  ).toUpperCase();
}

function estructurarSesion(user, session) {
  if (!user) return null;
  return {
    user,
    session,
    role: extraerRol(user),
    email: user.email || "",
    fullName: user.user_metadata?.full_name || "",
    cedula: user.user_metadata?.cedula || user.user_metadata?.id_usuario || "",
    displayName: resolverNombreOperario(user.email, user.user_metadata?.full_name)
  };
}

export class SupabaseAuthAdapter extends AuthPort {
  client() {
    return getSupabaseClient();
  }

  async login(identificador, password) {
    const email = await resolverEmailOperario(identificador);
    const { data, error } = await this.client().auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return estructurarSesion(data.user, data.session);
  }

  async logout() {
    await this.client().auth.signOut();
    return true;
  }

  async getSession() {
    const { data, error } = await this.client().auth.getSession();
    if (error || !data.session) return null;
    return estructurarSesion(data.session.user, data.session);
  }

  onAuthStateChange(callback) {
    const { data } = this.client().auth.onAuthStateChange((event, session) => {
      const user = session?.user;
      callback(event, user ? estructurarSesion(user, session) : null);
    });
    return () => data?.subscription?.unsubscribe();
  }
}

