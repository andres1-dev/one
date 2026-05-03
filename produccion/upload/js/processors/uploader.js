// Subidor de datos a Supabase

const Uploader = {
  /**
   * Sube registros consolidados a Supabase
   */
  async upload(records) {
    try {
      // Obtener token de autenticación
      if (!window.supabase) {
        throw new Error('Supabase no está inicializado')
      }
      
      const { data: { session } } = await window.supabase.auth.getSession()
      if (!session) {
        throw new Error('Sesión expirada. Por favor inicia sesión nuevamente.')
      }
      
      const response = await fetch(`${SiesaConfig.FUNCTIONS_URL}/delivery-operations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ records })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        
        try {
          const error = JSON.parse(errorText);
          errorMessage = error.error || `HTTP ${response.status}`;
        } catch (e) {
          errorMessage = `HTTP ${response.status}: ${errorText.substring(0, 200)}`;
        }
        
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      return result;
      
    } catch (error) {
      console.error('❌ Error subiendo a Supabase:', error);
      throw error;
    }
  }
};
