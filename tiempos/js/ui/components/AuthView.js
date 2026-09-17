/**
 * Adaptador UI: AuthView
 * Pantalla de login y barra de usuario.
 * Mientras no esté autenticado, el workspace VS Code permanece completamente oculto.
 */
export class AuthView {
  constructor({ loginUseCase, onLoginSuccess }) {
    this.loginUseCase = loginUseCase;
    this.onLoginSuccess = onLoginSuccess;
    this.authContainer = document.getElementById("auth-view");
    this.userBar = document.getElementById("header-user-bar");
    this.vscodeWorkspace = document.getElementById("vscode-workspace");
    this.activityUser = document.getElementById("activity-user");
    this.activityLogout = document.getElementById("activity-logout");
  }

  renderLogin(errorMessage = "") {
    // Ocultar workspace VS Code; solo mostrar login
    if (this.vscodeWorkspace) this.vscodeWorkspace.style.display = "none";
    document.body.classList.remove("vscode-mode");
    this.authContainer.style.display = "flex";

    this.authContainer.innerHTML = `
      <div class="card login-card">
        <div class="card-header" style="justify-content: center; text-align: center; padding-bottom: 14px;">
          <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 15px;">
            <i class="codicon codicon-history" style="font-size: 18px;"></i>
            <span>Control de Tiempos</span>
          </div>
        </div>

          <div style="margin: 12px 0 16px 0; text-align: center; color: var(--text-muted); font-size: 13px;">
            Ingresa con tus credenciales de operario
          </div>

          ${errorMessage ? `<div class="alert alert-danger" style="margin-bottom:14px;"><i class="codicon codicon-error"></i> ${errorMessage}</div>` : ""}

          <form id="login-form">
            <div class="form-group">
              <label for="login-email">Usuario o Correo</label>
              <div class="input-with-icon">
                <i class="codicon codicon-account input-icon-left"></i>
                <input 
                  type="text" 
                  id="login-email" 
                  placeholder="Ej: kevin, yamileth, paula o correo..." 
                  required 
                  autocomplete="username"
                  autocapitalize="none"
                  autocorrect="off"
                  spellcheck="false"
                >
              </div>
            </div>
            <div class="form-group">
              <label for="login-password">Contraseña</label>
              <div class="input-with-icon">
                <i class="codicon codicon-lock input-icon-left"></i>
                <input type="password" id="login-password" placeholder="••••••••" required autocomplete="current-password">
                <button type="button" class="btn-toggle-password" id="btn-toggle-password" title="Mostrar/Ocultar contraseña" tabindex="-1">
                  <i class="codicon codicon-eye" id="icon-toggle-password"></i>
                </button>
              </div>
            </div>
            <button type="submit" class="btn btn-primary btn-block" id="btn-login" style="margin-top:16px; padding:12px;">
              <i class="codicon codicon-sign-in"></i> Ingresar al Sistema
            </button>
          </form>
        </div>
    `;

    // Toggle de visibilidad de contraseña
    const btnToggle = document.getElementById("btn-toggle-password");
    const pwdInput = document.getElementById("login-password");
    const pwdIcon = document.getElementById("icon-toggle-password");

    if (btnToggle && pwdInput && pwdIcon) {
      btnToggle.onclick = () => {
        const isPassword = pwdInput.type === "password";
        pwdInput.type = isPassword ? "text" : "password";
        pwdInput.setAttribute("data-has-toggle", "true");
        pwdIcon.className = isPassword ? "codicon codicon-eye-closed" : "codicon codicon-eye";
        btnToggle.title = isPassword ? "Ocultar contraseña" : "Mostrar contraseña";
      };
    }

    document.getElementById("login-form").onsubmit = async (e) => {
      e.preventDefault();
      const btn = document.getElementById("btn-login");
      btn.innerHTML = `<i class="codicon codicon-loading codicon-modifier-spin"></i> Verificando...`;
      btn.disabled = true;

      try {
        const session = await this.loginUseCase.execute(
          document.getElementById("login-email").value.trim(),
          document.getElementById("login-password").value
        );
        this.renderAuthenticated(session);
        if (this.onLoginSuccess) this.onLoginSuccess(session);
      } catch (err) {
        this.renderLogin(err.message);
      }
    };
  }

  renderAuthenticated(sessionData) {
    this.authContainer.style.display = "none";
    if (this.vscodeWorkspace) this.vscodeWorkspace.style.display = "flex";
    document.body.classList.add("vscode-mode");

    // Update user bar in editor header
    this.userBar.innerHTML = `
      <div class="header-user-badge">
        <i class="codicon codicon-account" style="color: var(--accent);"></i>
        <span>${sessionData.displayName || "Operario"}</span>
      </div>
      <button class="btn btn-outline btn-sm" id="btn-logout" title="Cerrar sesión">
        <i class="codicon codicon-sign-out"></i> Salir
      </button>
    `;

    // Update activity bar user icon
    if (this.activityUser) {
      this.activityUser.title = `${sessionData.displayName || 'Usuario'} - Clic para más opciones`;
      this.activityUser.style.cursor = 'pointer';
      
      // Añadir funcionalidad de clic en usuario
      this.activityUser.onclick = () => {
        // Mostrar información del usuario o menú
        const userInfo = document.createElement('div');
        userInfo.className = 'user-popup';
        userInfo.innerHTML = `
          <div class="user-popup-content">
            <div class="user-popup-header">
              <i class="codicon codicon-account" style="color: var(--accent);"></i>
              <span>${sessionData.displayName || 'Operario'}</span>
            </div>
            <div class="user-popup-email">${sessionData.email || ''}</div>
            ${sessionData.fullName && sessionData.fullName !== sessionData.displayName ? `<div style="font-size: 11px; color: var(--text-dim); margin-bottom: 8px;">${sessionData.fullName}</div>` : ''}
            <button class="btn btn-outline btn-sm btn-block" id="popup-logout">
              <i class="codicon codicon-sign-out"></i> Cerrar Sesión
            </button>
          </div>
        `;
        
        // Posicionar el popup
        const rect = this.activityUser.getBoundingClientRect();
        userInfo.style.position = 'fixed';
        userInfo.style.left = (rect.right + 8) + 'px';
        userInfo.style.bottom = (rect.top + 16) + 'px';
        userInfo.style.zIndex = '1000';
        
        document.body.appendChild(userInfo);
        
        // Cerrar al hacer clic fuera
        const closePopup = (e) => {
          if (!userInfo.contains(e.target) && e.target !== this.activityUser) {
            userInfo.remove();
            document.removeEventListener('click', closePopup);
          }
        };
        
        setTimeout(() => {
          document.addEventListener('click', closePopup);
        }, 0);
        
        // Logout desde el popup
        document.getElementById('popup-logout').onclick = async () => {
          await this.loginUseCase.logout();
          location.reload();
        };
      };
    }

    // Setup logout from activity bar
    if (this.activityLogout) {
      this.activityLogout.onclick = async () => {
        await this.loginUseCase.logout();
        location.reload();
      };
    }

    // Setup logout from header button
    document.getElementById("btn-logout").onclick = async () => {
      await this.loginUseCase.logout();
      location.reload();
    };
  }
}
