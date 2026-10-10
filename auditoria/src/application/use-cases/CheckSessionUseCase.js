/**
 * Caso de Uso: CheckSessionUseCase
 */
export class CheckSessionUseCase {
  constructor(authPort) {
    this.authPort = authPort;
  }

  async execute() {
    return await this.authPort.getSession();
  }

  subscribe(callback) {
    return this.authPort.onAuthStateChange(callback);
  }
}
