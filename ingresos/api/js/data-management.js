// ================== FUNCIONES DE GESTIÓN DE DATOS ==================

let datosRegistros = null;
let datosCargando = false;

// ================= FUNCIONES TARJETA =================
function datosToggleCard(element) {
    const content = element.nextElementSibling;
    const indicador = element.querySelector('.collapse-indicator');
    const contador = document.getElementById('datos-contador');

    // 👉 Expande o contrae siempre
    if (content.classList.contains('expanded')) {
        content.classList.remove('expanded');
        indicador.classList.remove('fa-chevron-up');
        indicador.classList.add('fa-chevron-down');
    } else {
        content.classList.add('expanded');
        indicador.classList.remove('fa-chevron-down');
        indicador.classList.add('fa-chevron-up');
        
        // 👉 Cargar datos en segundo plano solo la primera vez
        if (!datosRegistros && !datosCargando) {
            datosCargando = true;
            contador.textContent = 'Cargando...';
            datosCargarEndpoint().then(success => {
                datosCargando = false;
                if (!success) {
                    contador.textContent = 'Error al cargar';
                    // Ocultar la tarjeta si hay error
                    content.classList.remove('expanded');
                    indicador.classList.remove('fa-chevron-up');
                    indicador.classList.add('fa-chevron-down');
                }
            });
        }
    }
}

// ================= FUNCIONES DATOS =================
async function datosCargarEndpoint() {
    try {
        const response = await fetch('https://script.google.com/macros/s/AKfycbwmNpKpXLf6yRSdCxEl-sM5q2eSS797_MMiQsg72l5AAe9pD9RO19EQIu6khG8wF-QwRw/exec');
        const data = await response.json();

        if (data.status === "success") {
            datosRegistros = data.data;
            document.getElementById('datos-contador').textContent = `${data.registros} registros`;
            return true;
        } else {
            throw new Error('Respuesta inválida');
        }
    } catch (error) {
        console.error('Error al cargar datos:', error);
        alert('Error al cargar los datos. Intente nuevamente.');
        return false;
    }
}

// ================= DESCARGAS =================
function datosDescargar(formato) {
    if (!datosRegistros || datosRegistros.length === 0) {
        alert('No hay datos cargados.');
        return;
    }

    switch (formato) {
        case 'csv': datosDescargarCSV(datosRegistros); break;
        case 'json': datosDescargarJSON(datosRegistros); break;
        case 'excel': datosDescargarExcel(datosRegistros); break;
    }
}

function datosDescargarCSV(data) {
    const headers = Object.keys(data[0]).join(';');
    const csvContent = data.map(row =>
        Object.values(row).map(v => (typeof v === 'string' && v.includes(',')) ? `"${v}"` : v).join(';')
    ).join('\n');

    const blob = new Blob([headers + '\n' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'datos.csv';
    link.click();
}

function datosDescargarJSON(data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'datos.json';
    link.click();
}

function datosDescargarExcel(data) {
    // Verificar si SheetJS está disponible
    if (typeof XLSX === 'undefined') {
        // Si no está disponible, cargar dinámicamente la biblioteca
        const script = document.createElement('script');
        script.src = 'https://cdn.sheetjs.com/xlsx-0.19.3/package/dist/xlsx.full.min.js';
        script.onload = function() {
            generarYDescargarExcel(data);
        };
        document.head.appendChild(script);
    } else {
        // Si ya está disponible, generar directamente
        generarYDescargarExcel(data);
    }
}

function generarYDescargarExcel(data) {
    try {
        // Crear un libro de trabajo
        const wb = XLSX.utils.book_new();
        
        // Convertir los datos a una hoja de trabajo
        const ws = XLSX.utils.json_to_sheet(data);
        
        // Añadir la hoja de trabajo al libro
        XLSX.utils.book_append_sheet(wb, ws, "Datos");
        
        // Generar el archivo Excel y descargarlo
        XLSX.writeFile(wb, 'datos.xlsx');
        
    } catch (error) {
        console.error('Error al generar el archivo Excel:', error);
        alert('Error al generar el archivo Excel. Verifica la consola para más detalles.');
    }
}
