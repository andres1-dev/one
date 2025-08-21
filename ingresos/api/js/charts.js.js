// ================== FUNCIONES DE GRÁFICOS ==================

// Variables para el gráfico
let tendenciaChart = null;
let globalTrend = null;
let tendenciaValues = [];

// Función para actualizar el indicador visual de tendencia
function updateTrendIndicator() {
    const indicator = document.getElementById("global-trend-indicator");
    if (!indicator) return;
    
    const dot = indicator.querySelector('.indicator-dot');
    const value = indicator.querySelector('.indicator-value');
    
    if (dot && value) {
        dot.style.background = globalTrend === 'positive' ? 'var(--success-color)' : 
                              globalTrend === 'negative' ? 'var(--danger-color)' : 'var(--warning-color)';
        
        value.textContent = globalTrend === 'positive' ? 'Alza' : 
                           globalTrend === 'negative' ? 'Baja' : 'Estable';
        value.className = 'indicator-value ' + globalTrend;
    }
}

// Función para calcular el valor de crecimiento
function calculateGrowthValue(current, previous) {
    if (!previous || previous === 0) return { value: "N/A", tendencia: "neutral" };
    
    const growth = ((current / previous) - 1) * 100;
    const absGrowth = Math.abs(growth);
    let tendencia;
    
    if (absGrowth < 5) {
        tendencia = "neutral";
    } else if (growth > 0) {
        tendencia = "positive";
    } else {
        tendencia = "negative";
    }
    
    return {
        value: growth.toFixed(1) + "%",
        tendencia: tendencia
    };
}

// Función para exportar el gráfico como imagen
function exportChartAsImage(chartId, filename) {
    const chartCanvas = document.getElementById(chartId);
    if (!chartCanvas) return;
    
    const link = document.createElement('a');
    link.download = `${filename}-${new Date().toISOString().slice(0,10)}.png`;
    link.href = chartCanvas.toDataURL('image/png');
    link.click();
}

// Función para obtener la tendencia global (para usar en otras partes del código)
function getGlobalTrend() {
    return globalTrend || 'neutral';
}