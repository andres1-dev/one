/**
 * Adaptador de Infraestructura: SupabaseAuthAdapter
 * Implementa AuthPort utilizando la API de Supabase Auth.
 */
import { AuthPort } from "../../domain/ports/AuthPort.js";

export class SupabaseAuthAdapter extends AuthPort {
  constructor(supabaseClient) {
    super();
    this.client = supabaseClient;
  }

  async signIn(email, password) {
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password
    });
    if (error) {
      throw new Error(error.message || "Error al iniciar sesión.");
    }
    return data.session;
  }

  async signOut() {
    const { error } = await this.client.auth.signOut();
    if (error) {
      throw new Error(error.message || "Error al cerrar sesión.");
    }
  }

  async getSession() {
    const { data, error } = await this.client.auth.getSession();
    if (error) {
      throw new Error(error.message || "Error al obtener la sesión.");
    }
    return data.session;
  }

  onAuthStateChange(callback) {
    const { data } = this.client.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
    return () => data.subscription.unsubscribe();
  }
}
