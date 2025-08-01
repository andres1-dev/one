// Función para convertir Blob a Base64
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Funciones para sonidos de feedback
function playSuccessSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)(); 
    const osc = ctx.createOscillator(); 
    const gainNode = ctx.createGain(); 
    osc.type = "sine"; 
    osc.frequency.value = 800; 
    gainNode.gain.value = 1; 
    osc.connect(gainNode); 
    gainNode.connect(ctx.destination); 
    osc.start(); 
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) {
    console.log("Error al reproducir sonido de éxito:", e);
  }
}

function playErrorSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)(); 
    const osc = ctx.createOscillator(); 
    const gainNode = ctx.createGain(); 
    osc.type = "sawtooth"; 
    osc.frequency.setValueAtTime(300, ctx.currentTime); 
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.5); 
    gainNode.gain.value = 0.8; 
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5); 
    osc.connect(gainNode); 
    gainNode.connect(ctx.destination); 
    osc.start(); 
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    console.log("Error al reproducir sonido de error:", e);
  }
}

// Funciones de formato
function formatKey(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .replace('columna', '')
    .trim();
}

function formatValue(value, key = '') {
  if (value === null || value === undefined) {
    return '<span class="no-data">N/A</span>';
  }
  
  if (typeof value === 'object') {
    return '<span class="no-data">[Datos complejos]</span>';
  }
  
  if (typeof value === 'number') {
    if (key.toLowerCase().includes('valor') || key.toLowerCase().includes('suma')) {
      return `<span class="numeric-value">${value.toLocaleString('es-CO')}</span>`;
    }
    return value.toString();
  }
  
  if (typeof value === 'boolean') {
    return value ? 'Sí' : 'No';
  }
  
  return value.toString();
}
