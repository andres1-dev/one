/**
 * Caso de Uso: LoginUseCase
 */
export class LoginUseCase {
  constructor(authPort) {
    this.authPort = authPort;
  }

  async execute(email, password) {
    if (!email || !password) {
      throw new Error("El correo y la contraseña son obligatorios.");
    }
    return await this.authPort.signIn(email.trim(), password);
  }
}
