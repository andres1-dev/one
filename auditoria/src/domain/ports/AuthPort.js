/**
 * Puerto de Autenticación (AuthPort)
 * Define el contrato abstracto para la gestión de autenticación y sesiones.
 */
export class AuthPort {
  async signIn(email, password) {
    throw new Error("AuthPort.signIn no ha sido implementado.");
  }

  async signOut() {
    throw new Error("AuthPort.signOut no ha sido implementado.");
  }

  async getSession() {
    throw new Error("AuthPort.getSession no ha sido implementado.");
  }

  onAuthStateChange(callback) {
    throw new Error("AuthPort.onAuthStateChange no ha sido implementado.");
  }
}
