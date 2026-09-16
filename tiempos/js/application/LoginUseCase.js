/**
 * Caso de Uso: LoginUseCase
 */
export class LoginUseCase {
  constructor(authPort) {
    this.authPort = authPort;
  }

  async execute(email, password) {
    if (!email || !password) {
      throw new Error("El correo y la contraseña son requeridos");
    }
    return await this.authPort.login(email.trim(), password);
  }

  async logout() {
    return await this.authPort.logout();
  }

  async getSession() {
    return await this.authPort.getSession();
  }

  onAuthStateChange(cb) {
    return this.authPort.onAuthStateChange(cb);
  }
}
