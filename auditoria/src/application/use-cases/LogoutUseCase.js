/**
 * Caso de Uso: LogoutUseCase
 */
export class LogoutUseCase {
  constructor(authPort) {
    this.authPort = authPort;
  }

  async execute() {
    return await this.authPort.signOut();
  }
}
