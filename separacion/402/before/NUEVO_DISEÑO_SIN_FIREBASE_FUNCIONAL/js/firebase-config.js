// Configuración de Firebase
// IMPORTANTE: Reemplaza estos valores con los de tu proyecto Firebase
// Sigue las instrucciones en FIREBASE-SETUP.md

const firebaseConfig = {
  apiKey: "AIzaSyBZOb0bmrro8a9SD8384iC1yaO7nlP1YzU",
  authDomain: "picking-realtime.firebaseapp.com",
  databaseURL: "https://picking-realtime-default-rtdb.firebaseio.com",
  projectId: "picking-realtime",
  storageBucket: "picking-realtime.firebasestorage.app",
  messagingSenderId: "177682017916",
  appId: "1:177682017916:web:419b251b4ed59610f5e3f9"
};

// Inicializar Firebase
let firebaseApp = null;
let database = null;
let isFirebaseInitialized = false;

try {
  // Verificar que la configuración no sea la de ejemplo
  if (firebaseConfig.apiKey === "TU_API_KEY_AQUI") {
    console.warn('[Firebase] ⚠️ Configuración no completada. Lee FIREBASE-SETUP.md');
  } else {
    // Inicializar Firebase
    firebaseApp = firebase.initializeApp(firebaseConfig);
    database = firebase.database();
    isFirebaseInitialized = true;
    console.log('[Firebase] ✅ Conectado a Firebase');
  }
} catch (error) {
  console.error('[Firebase] ❌ Error al inicializar Firebase:', error);
}

// Exportar para uso global
window.firebaseApp = firebaseApp;
window.firebaseDatabase = database;
window.isFirebaseInitialized = isFirebaseInitialized;
