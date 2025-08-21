// ================== FUNCIONES PRINCIPALES ==================

// Variables globales
let currentReportData = null;
let isLoading = false;
let retryCount = 0;
const MAX_RETRIES = 3;

// Función para inicializar la aplicación
function initApp() {
    initDatePicker();
    initCaptureButton();
    initWhatsAppButton();
    
    // Cargar reporte inicial con fecha actual
    const today = new Date();
    updateReportWithDate(today, true);
    
    // Colapsar todos los comparativos al inicio
    document.querySelectorAll('.comparison-content').forEach(content => {
        content.classList.remove('expanded');
    });
}

// Función para actualizar el reporte con una nueva fecha
async function updateReportWithDate(newDate, forceReload = false) {
    if (isLoading) return;
    
    isLoading = true;
    retryCount = 0;
    const updateBtn = document.getElementById('updateReportBtn');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    const loadingProgress = document.getElementById('loadingProgress');
    
    try {
        // Mostrar overlay de carga
        loadingOverlay.classList.add('active');
        loadingText.textContent = "Actualizando datos...";
        loadingProgress.style.width = '10%';
        
        // Estado de carga - deshabilitar botón
        updateBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
        updateBtn.style.pointerEvents = 'none';
        
        // Solo recargar datos si es forzado o no hay datos cargados
        if (forceReload || consolidatedData.length === 0 || budgetData.length === 0) {
            loadingText.textContent = "Cargando datos iniciales...";
            loadingProgress.style.width = '30%';
            
            // Forzar recarga de datos
            consolidatedData = [];
            budgetData = [];
            await cargarDatosIniciales();
            
            loadingProgress.style.width = '50%';
        }
        
        // Generar nuevo reporte con la fecha seleccionada
        loadingText.textContent = "Generando reporte...";
        loadingProgress.style.width = '70%';
        
        const reporte = await generarReporteCompleto(newDate);
        currentReportData = reporte;
        
        // Actualizar la UI con los nuevos datos
        loadingText.textContent = "Actualizando interfaz...";
        loadingProgress.style.width = '90%';
        
        cargarDatosDia();
        cargarDatosMes();
        cargarDatosAño();
        cargarDatosTendencia();
        
        // Finalizar carga
        loadingProgress.style.width = '100%';
        await new Promise(resolve => setTimeout(resolve, 300));
        
    } catch (error) {
        console.error("Error:", error);
        loadingText.textContent = "Error al cargar datos";
        loadingProgress.style.backgroundColor = "#e74c3c";
        
        // Esperar un momento antes de ocultar para que el usuario vea el error
        await new Promise(resolve => setTimeout(resolve, 1500));
        
    } finally {
        // Ocultar overlay de carga
        loadingOverlay.classList.remove('active');
        loadingProgress.style.width = '0%';
        loadingProgress.style.backgroundColor = "";
        
        isLoading = false;
        if (updateBtn) {
            updateBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
            updateBtn.style.pointerEvents = 'auto';
        }
        
        // Resetear progreso después de la animación
        setTimeout(() => {
            loadingProgress.style.width = '0%';
        }, 300);
    }
}

// Función con lógica de reintentos
async function loadDataWithRetry(date) {
    try {
        retryCount++;
        
        // Forzar recarga de datos
        consolidatedData = [];
        budgetData = [];
        await cargarDatosIniciales();
        
        // Generar nuevo reporte
        const reporte = await generarReporteCompleto(date);
        currentReportData = reporte;
        
        // Actualizar la UI con los nuevos datos
        cargarDatosDia();
        cargarDatosMes();
        cargarDatosAño();
        
        // Reiniciar contador de reintentos si tuvo éxito
        retryCount = 0;
        
    } catch (error) {
        console.error(`Error en intento ${retryCount}:`, error);
        
        if (retryCount < MAX_RETRIES) {
            // Esperar progresivamente más entre reintentos
            const delay = Math.min(1000 * retryCount, 3000);
            console.log(`Reintentando en ${delay}ms...`);
            
            await new Promise(resolve => setTimeout(resolve, delay));
            return loadDataWithRetry(date);
        } else {
            throw error; // Propagar el error después de máximos reintentos
        }
    }
}

// Función para inicializar el selector de fecha
function initDatePicker() {
    const datePicker = document.getElementById('datePicker');
    const updateBtn = document.getElementById('updateReportBtn');
    
    const today = new Date();
    datePicker.valueAsDate = today;
    
    // Actualizar solo la vista cuando cambie la fecha, sin recargar datos
    datePicker.addEventListener('change', () => {
        const selectedDate = datePicker.valueAsDate;
        if (selectedDate && currentReportData) {
            // Usar los datos ya cargados para la nueva fecha
            generarReporteCompleto(selectedDate)
                .then(reporte => {
                    currentReportData = reporte;
                    cargarDatosDia();
                    cargarDatosMes();
                    cargarDatosAño();
                })
                .catch(error => console.error("Error al generar reporte:", error));
        }
    });
    
    // Botón manual de actualización - aquí sí forzamos recarga de datos
    updateBtn.addEventListener('click', () => {
        const selectedDate = datePicker.valueAsDate || new Date();
        updateReportWithDate(selectedDate, true); // forceReload = true
    });
}

// Función para colapsar/expandir tarjetas
function toggleCard(header) {
    const cardContent = header.nextElementSibling;
    const indicator = header.querySelector('.collapse-indicator');
    
    cardContent.classList.toggle('expanded');
    indicator.classList.toggle('expanded');
}

// Función para colapsar/expandir comparativos
function toggleComparison(header) {
    const content = header.nextElementSibling;
    const indicator = header.querySelector('.comparison-collapse-icon');
    
    content.classList.toggle('expanded');
    indicator.classList.toggle('expanded');
}

// Función para abrir todas las tarjetas
function openAllCards() {
    const cardHeaders = document.querySelectorAll('.card-header');
    cardHeaders.forEach(header => {
        const cardContent = header.nextElementSibling;
        const indicator = header.querySelector('.collapse-indicator');
        
        if (!cardContent.classList.contains('expanded')) {
            cardContent.classList.add('expanded');
            indicator.classList.add('expanded');
        }
    });
}

// Función para verificar la contraseña
function checkPassword() {
    const password = prompt("Ingrese la contraseña para enviar el informe:");
    if (password === "One") {
        return true;
    } else {
        alert("Contraseña incorrecta");
        return false;
    }
}

// Función para inicializar el botón de captura
function initCaptureButton() {
    const captureBtn = document.getElementById('captureBtn');
    if (captureBtn) {
        captureBtn.addEventListener('click', function(e) {
            if (!checkPassword()) {
                e.preventDefault();
                return false;
            }
            captureAndDownloadCards();
        });
    }
}

// Función para inicializar el botón de WhatsApp
function initWhatsAppButton() {
    const whatsappBtn = document.getElementById('whatsappBtn');
    if (whatsappBtn) {
        whatsappBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Verificar contraseña
            if (!checkPassword()) {
                return false;
            }
            
            // Cambiar ícono a spinner mientras se procesa
            const icon = whatsappBtn.querySelector('i');
            const originalIconClass = icon.className;
            icon.className = 'fas fa-spinner fa-spin';
            
            // Ejecutar la misma función que el botón de captura
            captureAndDownloadCards().finally(() => {
                // Restaurar ícono original
                icon.className = originalIconClass;
            });
        });
    }
}

// Variables para rastrear gestos
let touchStartY = 0;
let touchCount = 0;

document.addEventListener('touchstart', function(e) {
    if (e.touches.length >= 3) { // Tres o más dedos
        touchStartY = e.touches[0].clientY;
        touchCount = e.touches.length;
    }
});

document.addEventListener('touchmove', function(e) {
    if (touchCount >= 3 && e.touches.length >= 3) {
        const touchEndY = e.touches[0].clientY;
        const distanceY = touchEndY - touchStartY;
        
        // Umbral para considerar que es un deslizamiento hacia abajo
        if (distanceY > 100) { // Ajusta este valor según necesites
            handleThreeFingerSwipeDown();
            touchCount = 0; // Resetear para evitar múltiples activaciones
        }
    }
});

document.addEventListener('touchend', function() {
    touchCount = 0; // Resetear al levantar los dedos
});

function handleThreeFingerSwipeDown() {
    // Evitar múltiples activaciones
    if (document.querySelector('.swipe-refresh-indicator')) return;
    
    // Crear elemento de feedback
    const feedback = document.createElement('div');
    feedback.className = 'swipe-refresh-indicator';
    feedback.innerHTML = '<i class="fas fa-sync-alt"></i> Actualizando datos...';
    document.body.appendChild(feedback);
    
    // Obtener fecha actual seleccionada
    const datePicker = document.getElementById('datePicker');
    const selectedDate = datePicker.valueAsDate || new Date();
    
    // Actualizar datos
    updateReportWithDate(selectedDate, true).finally(() => {
        // Ocultar feedback después de 1 segundo
        setTimeout(() => {
            feedback.style.opacity = '0';
            feedback.style.transform = 'translateX(-50%) translateY(-20px)';
            feedback.style.transition = 'all 0.3s ease';
            
            // Eliminar después de la animación
            setTimeout(() => {
                feedback.remove();
            }, 300);
        }, 1000);
    });
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initApp);