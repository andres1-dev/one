/**
 * Puerto: AuthPort
 * Define el contrato de autenticación que debe implementar cualquier adaptador.
 */
export class AuthPort {
  async login(email, password) {
    throw new Error("Método 'login' no implementado");
  }

  async logout() {
    throw new Error("Método 'logout' no implementado");
  }

  async getSession() {
    throw new Error("Método 'getSession' no implementado");
  }

  onAuthStateChange(callback) {
    throw new Error("Método 'onAuthStateChange' no implementado");
  }
}
