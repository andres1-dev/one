/**
 * Caso de Uso: LoginUseCase
 */
export class LoginUseCase {
  constructor(authPort) {
    this.authPort = authPort;
  }

  async execute(identificador, password) {
    if (!identificador || !password) {
      throw new Error("El usuario o correo y la contraseña son requeridos");
    }
    return await this.authPort.login(identificador.trim(), password);
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
