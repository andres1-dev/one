// ================== FUNCIONES DE CARGA DE DATOS EN UI ==================

function cargarDatosDia() {
    if (!currentReportData) return;
    
    const data = currentReportData.dia;
    const actual = data.actual;
    const anterior = data.anterior;
    
    document.getElementById("dia-fecha").textContent = `${actual.fecha}`;
    document.getElementById("dia-meta").textContent = formatoCantidad(actual.meta);
    document.getElementById("dia-ingreso").textContent = formatoCantidad(actual.ingreso);
    
    // Diferencia
    const diffEl = document.getElementById("dia-diferencia");
    diffEl.textContent = formatoCantidad(actual.diferencia);
    diffEl.className = "data-value " + (actual.diferencia >= 0 ? "positive" : "negative");
    
    // Porcentaje
    document.getElementById("dia-porcentaje").textContent = actual.porcentaje;
    
    // Barra de progreso
    const progressBar = document.getElementById("dia-progressBar");
    const progressPercent = document.getElementById("dia-progressPercent");
    let progreso = extraerPorcentaje(actual.porcentaje);
    let colorBarra;
    
    if (progreso < 30) {
        colorBarra = "linear-gradient(90deg, #e74c3c, #f39c12)";
    } else if (progreso < 70) {
        colorBarra = "linear-gradient(90deg, #f39c12, #f1c40f)";
    } else if (progreso < 100) {
        colorBarra = "linear-gradient(90deg, #2ecc71, #27ae60)";
    } else {
        colorBarra = "linear-gradient(90deg, #27ae60, #219653)";
    }
    
    progressBar.style.background = colorBarra;
    progressPercent.textContent = "0%";
    
    setTimeout(() => {
        progressBar.style.width = progreso + "%";
        progressPercent.textContent = actual.porcentaje;
    }, 300);
    
    // Mostrar restante
    document.getElementById("dia-restante").textContent = 
        `Faltan ${formatoCantidad(actual.meta - actual.ingreso)} para alcanzar la meta`;
    
    // Gestión - CORRECCIÓN COMPLETA AQUÍ
    const gestEl = document.getElementById("dia-gestion");
    const trendIcon = document.getElementById("dia-trendIcon");
    
    if (actual.gestion) {
        // CORRECCIÓN: Extraer el valor numérico completo (incluyendo signo negativo)
        const gestionValue = parseFloat(actual.gestion);
        
        gestEl.textContent = actual.gestion;
        
        // CORRECCIÓN: Usar el valor completo con signo
        if (gestionValue > 5) {
            gestEl.className = "positive";
            trendIcon.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
            trendIcon.style.color = "var(--success-color)";
        } else if (gestionValue < -5) {
            gestEl.className = "negative";  // Ahora usa clase negative
            trendIcon.innerHTML = '<i class="fa-solid fa-arrow-down"></i>';  // Flecha hacia abajo
            trendIcon.style.color = "var(--danger-color)";  // Color rojo
        } else {
            gestEl.className = "neutral";
            trendIcon.innerHTML = '<i class="fa-solid fa-equals"></i>';
            trendIcon.style.color = "var(--warning-color)";
        }
    } else {
        gestEl.textContent = "N/A";
        gestEl.className = "";
        trendIcon.innerHTML = '';
    }
    
    // Estadísticas adicionales
    document.getElementById("dia-average").textContent = formatoCantidad(actual.promedio);
    document.getElementById("dia-weighted").textContent = formatoCantidad(actual.ponderado);
    document.getElementById("dia-desvest").textContent = formatoCantidad(actual.desvest);
    document.getElementById("dia-max").textContent = formatoCantidad(actual.max);
    
    // Comparativo extendido
    if (anterior) {
        document.getElementById("dia-metaAnterior").textContent = formatoCantidad(anterior.meta);
        document.getElementById("dia-ingresoAnterior").textContent = formatoCantidad(anterior.ingreso);
        document.getElementById("dia-porcentajeAnterior").textContent = anterior.porcentaje;
        document.getElementById("dia-diaAnterior").textContent = anterior.dia_letras;
        document.getElementById("dia-averageAnterior").textContent = formatoCantidad(anterior.promedio);
        document.getElementById("dia-weightedAnterior").textContent = formatoCantidad(anterior.ponderado);
        document.getElementById("dia-desvestAnterior").textContent = formatoCantidad(anterior.desvest);
        document.getElementById("dia-maxAnterior").textContent = formatoCantidad(anterior.max);
    }
}

function cargarDatosMes() {
    if (!currentReportData) return;
    
    const data = currentReportData.mes;
    const actual = data.actual;
    const anterior = data.anterior;
    
    document.getElementById("mes-mes").textContent = `${actual.mes}`;
    document.getElementById("mes-meta").textContent = formatoCantidad(actual.meta);
    document.getElementById("mes-ingreso").textContent = formatoCantidad(actual.ingreso);
    
    // Diferencia
    const diffEl = document.getElementById("mes-diferencia");
    diffEl.textContent = formatoCantidad(actual.diferencia);
    diffEl.className = "data-value " + (actual.diferencia >= 0 ? "positive" : "negative");
    
    // Porcentaje
    document.getElementById("mes-porcentaje").textContent = actual.porcentaje;
    
    // Barra de progreso
    const progressBar = document.getElementById("mes-progressBar");
    const progressPercent = document.getElementById("mes-progressPercent");
    let progreso = extraerPorcentaje(actual.porcentaje);
    let colorBarra;
    
    if (progreso < 30) {
        colorBarra = "linear-gradient(90deg, #e74c3c, #f39c12)";
    } else if (progreso < 70) {
        colorBarra = "linear-gradient(90deg, #f39c12, #f1c40f)";
    } else if (progreso < 100) {
        colorBarra = "linear-gradient(90deg, #2ecc71, #27ae60)";
    } else {
        colorBarra = "linear-gradient(90deg, #27ae60, #219653)";
    }
    
    progressBar.style.background = colorBarra;
    progressPercent.textContent = "0%";
    
    setTimeout(() => {
        progressBar.style.width = progreso + "%";
        progressPercent.textContent = actual.porcentaje;
    }, 500);
    
    // Mostrar restante
    document.getElementById("mes-restante").textContent = 
        `Faltan ${formatoCantidad(actual.meta - actual.ingreso)} para alcanzar la meta`;
    
    // Gestión - CORRECCIÓN COMPLETA AQUÍ
    const gestEl = document.getElementById("mes-gestion");
    const trendIcon = document.getElementById("mes-trendIcon");
    
    if (actual.gestion) {
        // CORRECCIÓN: Extraer el valor numérico completo (incluyendo signo negativo)
        const gestionValue = parseFloat(actual.gestion);
        
        gestEl.textContent = actual.gestion;
        
        // CORRECCIÓN: Usar el valor completo con signo
        if (gestionValue > 5) {
            gestEl.className = "positive";
            trendIcon.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
            trendIcon.style.color = "var(--success-color)";
        } else if (gestionValue < -5) {
            gestEl.className = "negative";  // Ahora usa clase negative
            trendIcon.innerHTML = '<i class="fa-solid fa-arrow-down"></i>';  // Flecha hacia abajo
            trendIcon.style.color = "var(--danger-color)";  // Color rojo
        } else {
            gestEl.className = "neutral";
            trendIcon.innerHTML = '<i class="fa-solid fa-equals"></i>';
            trendIcon.style.color = "var(--warning-color)";
        }
    } else {
        gestEl.textContent = "N/A";
        gestEl.className = "";
        trendIcon.innerHTML = '';
    }
    
    // Estadísticas adicionales
    document.getElementById("mes-average").textContent = formatoCantidad(actual.promedio);
    document.getElementById("mes-weighted").textContent = formatoCantidad(actual.ponderado);
    document.getElementById("mes-desvest").textContent = formatoCantidad(actual.desvest);
    document.getElementById("mes-max").textContent = formatoCantidad(actual.max);
    
    // Comparativo extendido
    if (anterior) {
        document.getElementById("mes-metaAnterior").textContent = formatoCantidad(anterior.meta);
        document.getElementById("mes-ingresoAnterior").textContent = formatoCantidad(anterior.ingreso);
        document.getElementById("mes-porcentajeAnterior").textContent = anterior.porcentaje;
        document.getElementById("mes-habilAnterior").textContent = anterior.registros + " días";
        document.getElementById("mes-averageAnterior").textContent = formatoCantidad(anterior.promedio);
        document.getElementById("mes-weightedAnterior").textContent = formatoCantidad(anterior.ponderado);
        document.getElementById("mes-desvestAnterior").textContent = formatoCantidad(anterior.desvest);
        document.getElementById("mes-maxAnterior").textContent = formatoCantidad(anterior.max);
    }
}

function cargarDatosAño() {
    if (!currentReportData) return;
    
    const data = currentReportData.año;
    const actual = data.actual;
    const anterior = data.anterior;
    
    document.getElementById("año-año").textContent = actual.año;
    document.getElementById("año-meta").textContent = formatoCantidad(actual.meta);
    document.getElementById("año-ingreso").textContent = formatoCantidad(actual.ingreso);
    
    // Diferencia
    const diffEl = document.getElementById("año-diferencia");
    diffEl.textContent = formatoCantidad(actual.diferencia);
    diffEl.className = "data-value " + (actual.diferencia >= 0 ? "positive" : "negative");
    
    // Porcentaje
    document.getElementById("año-porcentaje").textContent = actual.porcentaje;
    
    // Barra de progreso
    const progressBar = document.getElementById("año-progressBar");
    const progressPercent = document.getElementById("año-progressPercent");
    let progreso = extraerPorcentaje(actual.porcentaje);
    let colorBarra;
    
    if (progreso < 30) {
        colorBarra = "linear-gradient(90deg, #e74c3c, #f39c12)";
    } else if (progreso < 70) {
        colorBarra = "linear-gradient(90deg, #f39c12, 'f1c40f')";
    } else if (progreso < 100) {
        colorBarra = "linear-gradient(90deg, #2ecc71, #27ae60)";
    } else {
        colorBarra = "linear-gradient(90deg, #27ae60, #219653)";
    }
    
    progressBar.style.background = colorBarra;
    progressPercent.textContent = "0%";
    
    setTimeout(() => {
        progressBar.style.width = progreso + "%";
        progressPercent.textContent = actual.porcentaje;
    }, 700);
    
    // Mostrar restante
    document.getElementById("año-restante").textContent = 
        `Faltan ${formatoCantidad(actual.meta - actual.ingreso)} para alcanzar la meta`;
    
    // Gestión - CORRECCIÓN COMPLETA AQUÍ
    const gestEl = document.getElementById("año-gestion");
    const trendIcon = document.getElementById("año-trendIcon");
    
    if (actual.gestion) {
        // CORRECCIÓN: Extraer el valor numérico completo (incluyendo signo negativo)
        const gestionValue = parseFloat(actual.gestion);
        
        gestEl.textContent = actual.gestion;
        
        // CORRECCIÓN: Usar el valor completo con signo
        if (gestionValue > 5) {
            gestEl.className = "positive";
            trendIcon.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
            trendIcon.style.color = "var(--success-color)";
        } else if (gestionValue < -5) {
            gestEl.className = "negative";  // Ahora usa clase negative
            trendIcon.innerHTML = '<i class="fa-solid fa-arrow-down"></i>';  // Flecha hacia abajo
            trendIcon.style.color = "var(--danger-color)";  // Color rojo
        } else {
            gestEl.className = "neutral";
            trendIcon.innerHTML = '<i class="fa-solid fa-equals"></i>';
            trendIcon.style.color = "var(--warning-color)";
        }
    } else {
        gestEl.textContent = "N/A";
        gestEl.className = "";
        trendIcon.innerHTML = '';
    }
    
    // Estadísticas adicionales
    document.getElementById("año-average").textContent = formatoCantidad(actual.promedio);
    document.getElementById("año-weighted").textContent = formatoCantidad(actual.ponderado);
    document.getElementById("año-desvest").textContent = formatoCantidad(actual.desvest);
    document.getElementById("año-max").textContent = formatoCantidad(actual.max);
    
    // Comparativo extendido
    if (anterior) {
        document.getElementById("año-metaAnterior").textContent = formatoCantidad(anterior.meta);
        document.getElementById("año-ingresoAnterior").textContent = formatoCantidad(anterior.ingreso);
        document.getElementById("año-porcentajeAnterior").textContent = anterior.porcentaje;
        document.getElementById("año-diferenciaAnterior").textContent = formatoCantidad(anterior.diferencia);
        document.getElementById("año-averageAnterior").textContent = formatoCantidad(anterior.promedio);
        document.getElementById("año-weightedAnterior").textContent = formatoCantidad(anterior.ponderado);
        document.getElementById("año-desvestAnterior").textContent = formatoCantidad(anterior.desvest);
        document.getElementById("año-maxAnterior").textContent = formatoCantidad(anterior.max);
    }
}
