// Configuración de DataTable para documentos disponibles
let documentosTable = null;
let listaResponsables = [];
let timers = {}; // Almacenar los intervalos de tiempo
let documentosGlobales = []; // Almacenar todos los documentos para los consolidados
let rangoFechasSeleccionado = null; // Almacenar rango de fechas para filtrado

// Configuración de reintentos
let reintentosMaximos = 5;
let tiempoEsperaReintento = 1000; // 1 segundo

// URL de la API de Google Apps Script
const API_URL = 'https://script.google.com/macros/s/AKfycbzeG16VGHb63ePAwm00QveNsdbMEHi9dFbNsmQCreNOXDtwIh22NHxzRpwuzZBZ-oIJWg/exec';

// Estados permitidos para mostrar
let mostrarFinalizados = false;
const ESTADOS_VISIBLES = ['PENDIENTE', 'DIRECTO', 'ELABORACION', 'PAUSADO'];
const ESTADOS_FINALIZADOS = ['FINALIZADO'];

// Función para llamar a la API
async function llamarAPI(params) {
    try {
        const queryString = new URLSearchParams(params).toString();
        const url = `${API_URL}?${queryString}`;
        
        console.log('Llamando a API:', url);
        
        const response = await fetch(url, {
            method: 'POST',
            redirect: 'follow'
        });

        if (response.redirected) {
            const finalUrl = response.url;
            const finalResponse = await fetch(finalUrl);
            const text = await finalResponse.text();
            
            try {
                return JSON.parse(text);
            } catch (e) {
                console.error('Error parseando respuesta:', e);
                return { success: true };
            }
        } else {
            const text = await response.text();
            try {
                return JSON.parse(text);
            } catch (e) {
                console.error('Error parseando respuesta:', e);
                return { success: true };
            }
        }
    } catch (error) {
        console.error('Error llamando a la API:', error);
        return { 
            success: false, 
            error: error.message,
            message: 'Error de conexión con el servidor'
        };
    }
}

// Función para verificar si el responsable fue asignado correctamente
async function verificarResponsableAsignado(rec, responsableEsperado, intento = 1) {
    try {
        console.log(`Verificando asignación de responsable (intento ${intento})...`);
        
        // Obtener datos actualizados
        const documentosActualizados = await obtenerDocumentosCombinados();
        const documento = documentosActualizados.find(doc => doc.rec === rec);
        
        if (documento && documento.colaborador === responsableEsperado) {
            console.log(`✅ Responsable confirmado para REC${rec}`);
            return true;
        }
        
        if (intento < reintentosMaximos) {
            console.log(`Reintentando verificación (${intento + 1}/${reintentosMaximos})...`);
            await new Promise(resolve => setTimeout(resolve, tiempoEsperaReintento));
            return verificarResponsableAsignado(rec, responsableEsperado, intento + 1);
        }
        
        console.warn(`No se pudo confirmar la asignación del responsable después de ${reintentosMaximos} intentos`);
        return false;
        
    } catch (error) {
        console.error('Error verificando responsable:', error);
        return false;
    }
}

// Función para mostrar notificación con SweetAlert
function mostrarNotificacion(titulo, mensaje, tipo = 'success', tiempo = 3000) {
    return Swal.fire({
        title: titulo,
        text: mensaje,
        icon: tipo,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: tiempo,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer);
            toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });
}

// Función para mostrar confirmación con SweetAlert
function mostrarConfirmacion(titulo, mensaje, textoConfirmar = 'Sí', textoCancelar = 'No') {
    return Swal.fire({
        title: titulo,
        text: mensaje,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: textoConfirmar,
        cancelButtonText: textoCancelar,
        reverseButtons: true
    });
}

// Función para mostrar loading
function mostrarLoading(mensaje = 'Procesando...') {
    Swal.fire({
        title: mensaje,
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
}

// Función para cerrar loading
function cerrarLoading() {
    Swal.close();
}

// Función para manejar errores de conexión
function manejarErrorConexion(error, accion) {
    console.error(`Error en ${accion}:`, error);
    
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        mostrarNotificacion(
            '🔌 Error de Conexión',
            'No se pudo conectar con el servidor. Verifique su conexión a internet.',
            'error',
            6000
        );
    } else {
        mostrarNotificacion(
            '❌ Error',
            `Error en ${accion}: ${error.message}`,
            'error',
            5000
        );
    }
}

// Función para actualizar inmediatamente después de un cambio
async function actualizarInmediatamente() {
    try {
        const loader = document.getElementById('loader');
        if (loader) {
            loader.style.display = 'block';
        }

        await cargarTablaDocumentos();
        
        if (loader) {
            setTimeout(() => {
                loader.style.display = 'none';
            }, 500);
        }
    } catch (error) {
        console.error('Error en actualización inmediata:', error);
        manejarErrorConexion(error, 'actualización inmediata');
        const loader = document.getElementById('loader');
        if (loader) {
            loader.style.display = 'none';
        }
    }
}

// Función para formatear fecha a solo fecha (sin hora)
function formatearFechaSolo(fechaHoraStr) {
    if (!fechaHoraStr) return '-';
    
    try {
        if (fechaHoraStr.includes(' ')) {
            return fechaHoraStr.split(' ')[0];
        }
        return fechaHoraStr;
    } catch (e) {
        console.error('Error formateando fecha:', e);
        return fechaHoraStr;
    }
}

// Función CORREGIDA para convertir fecha string a objeto Date
function parsearFecha(fechaStr) {
    if (!fechaStr || fechaStr === '-') return null;
    
    try {
        // Formato esperado: "1/11/2025" (día/mes/año)
        const partes = fechaStr.split('/');
        if (partes.length !== 3) return null;
        
        const dia = parseInt(partes[0], 10);
        const mes = parseInt(partes[1], 10);
        const anio = parseInt(partes[2], 10);
        
        // Validar que sean números válidos
        if (isNaN(dia) || isNaN(mes) || isNaN(anio)) return null;
        
        // Crear fecha (mes - 1 porque en JS los meses van de 0-11)
        const fecha = new Date(anio, mes - 1, dia);
        
        // Verificar que la fecha sea válida
        if (isNaN(fecha.getTime())) return null;
        
        return fecha;
    } catch (e) {
        console.error('Error parseando fecha:', e, 'String:', fechaStr);
        return null;
    }
}

// Función para calcular consolidados
function calcularConsolidados(documentos) {
    const consolidados = {
        pendientes: { count: 0, unidades: 0 },
        proceso: { count: 0, unidades: 0 },
        directos: { count: 0, unidades: 0 },
        total: { count: 0, unidades: 0 }
    };

    documentos.forEach(doc => {
        if (ESTADOS_VISIBLES.includes(doc.estado)) {
            consolidados.total.count++;
            consolidados.total.unidades += doc.cantidad || 0;

            if (doc.estado === 'PENDIENTE') {
                consolidados.pendientes.count++;
                consolidados.pendientes.unidades += doc.cantidad || 0;
            } else if (doc.estado === 'DIRECTO') {
                consolidados.directos.count++;
                consolidados.directos.unidades += doc.cantidad || 0;
            } else if (doc.estado === 'ELABORACION' || doc.estado === 'PAUSADO') {
                consolidados.proceso.count++;
                consolidados.proceso.unidades += doc.cantidad || 0;
            }
        }
    });

    return consolidados;
}

// Función para actualizar las tarjetas de resumen
function actualizarTarjetasResumen(consolidados) {
    const pendientesElement = document.getElementById('contadorPendientes');
    const procesoElement = document.getElementById('contadorProceso');
    const directosElement = document.getElementById('contadorDirectos');
    const totalElement = document.getElementById('contadorTotal');
    
    if (pendientesElement) pendientesElement.textContent = consolidados.pendientes.count;
    if (document.getElementById('unidadesPendientes')) document.getElementById('unidadesPendientes').textContent = `${consolidados.pendientes.unidades} unidades`;
    
    if (procesoElement) procesoElement.textContent = consolidados.proceso.count;
    if (document.getElementById('unidadesProceso')) document.getElementById('unidadesProceso').textContent = `${consolidados.proceso.unidades} unidades`;
    
    if (directosElement) directosElement.textContent = consolidados.directos.count;
    if (document.getElementById('unidadesDirectos')) document.getElementById('unidadesDirectos').textContent = `${consolidados.directos.unidades} unidades`;
    
    if (totalElement) totalElement.textContent = consolidados.total.count;
    if (document.getElementById('unidadesTotal')) document.getElementById('unidadesTotal').textContent = `${consolidados.total.unidades} unidades`;
}

// Función para convertir hh:mm:ss a milisegundos
function tiempoAMilisegundos(tiempo) {
    if (!tiempo) return 0;
    try {
        const partes = tiempo.split(":");
        const horas = parseInt(partes[0]) || 0;
        const minutos = parseInt(partes[1]) || 0;
        const segundos = parseInt(partes[2]) || 0;
        return (horas * 3600 + minutos * 60 + segundos) * 1000;
    } catch (e) {
        console.error("Error convirtiendo tiempo a ms:", e);
        return 0;
    }
}

// Función para convertir milisegundos a hh:mm:ss
function milisegundosATiempo(ms) {
    const totalSec = Math.floor(ms / 1000);
    const horas = Math.floor(totalSec / 3600).toString().padStart(2, '0');
    const minutos = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
    const segundos = (totalSec % 60).toString().padStart(2, '0');
    return `${horas}:${minutos}:${segundos}`;
}

// Función para calcular la duración usando las columnas F-K
function calcularDuracionDesdeSheets(datos) {
    const {
        estado,
        datetime_inicio,
        datetime_fin,
        duracion_guardada,
        datetime_pausas,
        duracion_pausas
    } = datos;

    if (estado === 'PAUSADO') {
        return duracion_guardada || '00:00:00';
    } else if (estado === 'FINALIZADO') {
        return duracion_guardada || '00:00:00';
    } else {
        let msTotal = 0;

        if (duracion_guardada) {
            msTotal += tiempoAMilisegundos(duracion_guardada);
        }

        if (datetime_inicio) {
            const ahora = new Date();
            const ultimoInicio = new Date(datetime_inicio);
            if (!isNaN(ultimoInicio.getTime())) {
                msTotal += ahora - ultimoInicio;
            }
        }

        return milisegundosATiempo(msTotal);
    }
}

// Función para iniciar/actualizar timers
function iniciarTimers(documentos) {
    Object.keys(timers).forEach(rec => {
        clearInterval(timers[rec]);
        delete timers[rec];
    });
    
    documentos.forEach(doc => {
        if (doc.estado !== 'PAUSADO' && doc.estado !== 'FINALIZADO' && doc.datetime_inicio) {
            timers[doc.rec] = setInterval(() => {
                actualizarDuracionEnTabla(doc.rec);
            }, 1000);
        }
    });
}

// Función para actualizar la duración en la tabla
function actualizarDuracionEnTabla(rec) {
    if (documentosTable) {
        const fila = documentosTable.row((idx, data) => data.rec === rec);
        if (fila.any()) {
            const datos = fila.data();
            const nuevaDuracion = calcularDuracionDesdeSheets(datos);
            
            const celdaDuracion = $(fila.node()).find('.duracion-tiempo');
            if (celdaDuracion.length && celdaDuracion.text() !== nuevaDuracion) {
                celdaDuracion.text(nuevaDuracion);
            }
        }
    }
}

// Función CORREGIDA para configurar filtro de fecha
function configurarFiltroFecha() {
    // Remover filtros anteriores
    $.fn.dataTable.ext.search.pop();
    
    // Agregar nuevo filtro
    $.fn.dataTable.ext.search.push(
        function(settings, data, dataIndex) {
            // Si no hay rango seleccionado, mostrar todo
            if (!rangoFechasSeleccionado || rangoFechasSeleccionado.length !== 2) {
                return true;
            }

            try {
                // Obtener la fila completa
                const rowData = documentosTable.row(dataIndex).data();
                
                if (!rowData || !rowData.fecha_objeto) {
                    return false;
                }

                const fechaDocumento = rowData.fecha_objeto;
                
                // Configurar fechas de inicio y fin del rango
                const fechaInicio = new Date(rangoFechasSeleccionado[0]);
                fechaInicio.setHours(0, 0, 0, 0);
                
                const fechaFin = new Date(rangoFechasSeleccionado[1]);
                fechaFin.setHours(23, 59, 59, 999);

                // Comparar fechas
                return fechaDocumento >= fechaInicio && fechaDocumento <= fechaFin;
            } catch (e) {
                console.error('Error en filtro de fecha:', e);
                return false;
            }
        }
    );
}

// Función CORREGIDA para aplicar filtro de fecha
function aplicarFiltroFecha(fechaInicio, fechaFin) {
    console.log('Aplicando filtro de fecha:', fechaInicio, fechaFin);
    
    // Normalizar fechas
    const inicio = new Date(fechaInicio);
    inicio.setHours(0, 0, 0, 0);
    
    const fin = new Date(fechaFin);
    fin.setHours(23, 59, 59, 999);
    
    rangoFechasSeleccionado = [inicio, fin];
    
    console.log('Rango normalizado:', rangoFechasSeleccionado);
    
    if (documentosTable) {
        // Redibujar la tabla con el filtro
        documentosTable.draw();
        
        // Recalcular consolidados con datos filtrados
        const datosFiltrados = documentosTable.rows({ search: 'applied' }).data().toArray();
        console.log('Documentos después del filtro:', datosFiltrados.length);
        
        const consolidados = calcularConsolidados(datosFiltrados);
        actualizarTarjetasResumen(consolidados);
    }
}

// Función para limpiar filtros
function limpiarFiltros() {
    console.log('Limpiando filtros...');
    
    rangoFechasSeleccionado = null;
    
    if (document.getElementById('filtroFecha')) {
        document.getElementById('filtroFecha').value = '';
    }
    if (document.getElementById('recInput')) {
        document.getElementById('recInput').value = '';
    }
    
    // Limpiar flatpickr si existe
    if (window.flatpickrInstance) {
        window.flatpickrInstance.clear();
    }
    
    if (documentosTable) {
        documentosTable.search('').draw();
        
        const consolidados = calcularConsolidados(documentosGlobales);
        actualizarTarjetasResumen(consolidados);
    }
}

// Función para cargar responsables desde Google Sheets
async function cargarResponsables() {
    const SPREADSHEET_ID = "1d5dCCCgiWXfM6vHu3zGGKlvK2EycJtT7Uk4JqUjDOfE";
    const API_KEY = 'AIzaSyC7hjbRc0TGLgImv8gVZg8tsOeYWgXlPcM';
    
    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/RESPONSABLES!A2:B?key=${API_KEY}`;
        const response = await fetch(url);
        
        if (!response.ok) throw new Error('Error al obtener responsables');
        
        const data = await response.json();
        const values = data.values || [];
        
        listaResponsables = values
            .filter(row => row[1] === 'true' || row[1] === 'TRUE')
            .map(row => row[0].trim())
            .filter(nombre => nombre !== '');
            
        console.log('Responsables cargados:', listaResponsables);
        return listaResponsables;
        
    } catch (error) {
        console.error('Error cargando responsables:', error);
        listaResponsables = [
            'NICOLE VALERIA MONCALEANO DIAZ',
            'KELLY TATIANA FERNANDEZ ASTUDILLO',
            'PILAR CRISTINA JARAMILLO SANCHEZ',
            'LESLY CAMILA OCHOA PEDRAZA',
            'ANGIE LIZETH POLO CAPERA',
            'REYES PADILLA DONELLY',
            'NAILEN GABRIELA ZAPATA VIERA',
            'PAULA VANESSA SANCHEZ ERAZO',
            'PAOLA ANDREA ESCOBEDO JUSPIAN'
        ];
        return listaResponsables;
    }
}

// Función para obtener responsables disponibles para un documento específico
function obtenerResponsablesDisponibles(documentos, documentoActual) {
    const responsablesAsignados = documentos
        .filter(doc => doc.rec !== documentoActual.rec)
        .map(doc => doc.colaborador)
        .filter(resp => resp && resp.trim() !== '' && resp !== 'Sin responsable');
    
    return listaResponsables.filter(resp => !responsablesAsignados.includes(resp));
}

// Función para calcular cantidad total de un documento
function calcularCantidadTotal(documento) {
    if (!documento.datosCompletos) return 0;
    
    // Usar solo CANTIDAD principal
    const cantidad = parseInt(documento.datosCompletos.CANTIDAD) || 0;
    
    console.log(`Cantidad para REC${documento.rec}: ${cantidad} (solo principal)`);
    return cantidad;
}

// Función para obtener estados según configuración
function obtenerEstadosParaMostrar() {
    return mostrarFinalizados 
        ? [...ESTADOS_VISIBLES, ...ESTADOS_FINALIZADOS]
        : ESTADOS_VISIBLES;
}

// Función para alternar visibilidad de finalizados
function toggleFinalizados() {
    mostrarFinalizados = !mostrarFinalizados;
    const btn = document.getElementById('btnToggleFinalizados');
    if (btn) {
        btn.innerHTML = mostrarFinalizados 
            ? '<i class="fas fa-eye-slash me-1"></i>Ocultar Finalizados'
            : '<i class="fas fa-eye me-1"></i>Mostrar Finalizados';
    }
    actualizarInmediatamente();
}

// Función para cargar datos globales (similar a cargarDatos pero sin UI)
async function cargarDatosGlobales() {
    try {
        console.log('Recargando datos globales...');
        
        // Reutilizar la función existente de main.js
        if (typeof window.cargarDatos === 'function') {
            await window.cargarDatos();
        } else {
            // Fallback: recargar la página si la función no está disponible
            console.warn('Función cargarDatos no disponible, recargando página...');
            window.location.reload();
        }
        
    } catch (error) {
        console.error('Error recargando datos globales:', error);
        // En caso de error, intentar recargar la página
        window.location.reload();
    }
}

// Función modificada para cambiar responsable con SweetAlert y verificación
async function cambiarResponsable(rec, responsable) {
    try {
        if (!responsable || responsable.trim() === '') {
            await mostrarNotificacion('Error', 'Seleccione un responsable válido', 'error');
            return;
        }

        // Mostrar confirmación
        const confirmacion = await mostrarConfirmacion(
            'Asignar Responsable',
            `¿Está seguro de asignar a <strong>${responsable}</strong> como responsable del documento REC${rec}?`,
            'Sí, asignar',
            'Cancelar'
        );

        if (!confirmacion.isConfirmed) {
            // Si cancela, recargar para actualizar el select
            await actualizarInmediatamente();
            return;
        }

        // Mostrar loading
        mostrarLoading(`Asignando responsable a REC${rec}...`);
        
        console.log(`Asignando responsable ${responsable} a REC${rec}`);
        
        const result = await llamarAPI({
            action: 'asignarResponsable',
            id: rec,
            responsable: responsable
        });
        
        if (result.success) {
            // Verificar que el responsable se asignó correctamente
            const asignacionConfirmada = await verificarResponsableAsignado(rec, responsable);
            
            if (asignacionConfirmada) {
                cerrarLoading();
                await mostrarNotificacion(
                    '✅ Responsable Asignado',
                    `REC${rec} ahora tiene como responsable a ${responsable}`,
                    'success',
                    4000
                );
                
                // Recargar datos globales para que estén disponibles para impresión
                await cargarDatosGlobales();
                
                // Actualizar la tabla
                await actualizarInmediatamente();
                
            } else {
                cerrarLoading();
                await mostrarNotificacion(
                    '⚠️ Advertencia',
                    `El responsable fue asignado pero no se pudo verificar completamente. REC${rec} - ${responsable}`,
                    'warning',
                    4000
                );
                
                // Recargar de todos modos
                await cargarDatosGlobales();
                await actualizarInmediatamente();
            }
        } else {
            cerrarLoading();
            await mostrarNotificacion(
                '❌ Error',
                result.message || 'Error al asignar responsable',
                'error',
                5000
            );
        }
    } catch (error) {
        cerrarLoading();
        console.error('Error cambiando responsable:', error);
        await mostrarNotificacion(
            '❌ Error',
            'Error al asignar responsable: ' + error.message,
            'error',
            5000
        );
    }
}

// Función modificada para cambiar estado con SweetAlert
async function cambiarEstadoDocumento(rec, nuevoEstado) {
    try {
        const estadosTexto = {
            'PAUSADO': 'pausar',
            'ELABORACION': 'reanudar', 
            'FINALIZADO': 'finalizar'
        };
        
        const accionTexto = estadosTexto[nuevoEstado] || nuevoEstado.toLowerCase();
        
        // Mostrar confirmación especial para FINALIZADO
        if (nuevoEstado === 'FINALIZADO') {
            const confirmacion = await mostrarConfirmacion(
                'Finalizar Documento',
                `¿Está seguro de marcar el documento REC${rec} como <strong>FINALIZADO</strong>?<br><br><small>Esta acción no se puede deshacer automáticamente.</small>`,
                'Sí, finalizar',
                'Cancelar'
            );
            
            if (!confirmacion.isConfirmed) {
                return;
            }
        }
        
        mostrarLoading(`${accionTexto.charAt(0).toUpperCase() + accionTexto.slice(1)} documento REC${rec}...`);
        
        console.log(`Cambiando estado del documento REC${rec} a: ${nuevoEstado}`);
        
        let action;
        switch(nuevoEstado) {
            case 'PAUSADO':
                action = 'pausar';
                break;
            case 'ELABORACION':
                action = 'reanudar';
                break;
            case 'FINALIZADO':
                action = 'finalizar';
                break;
            default:
                cerrarLoading();
                await mostrarNotificacion('Error', 'Estado no válido', 'error');
                return;
        }
        
        const result = await llamarAPI({
            action: action,
            id: rec
        });
        
        if (result.success) {
            // Detener timer si es necesario
            if (nuevoEstado === 'PAUSADO' || nuevoEstado === 'FINALIZADO') {
                if (timers[rec]) {
                    clearInterval(timers[rec]);
                    delete timers[rec];
                }
            } else if (nuevoEstado === 'ELABORACION') {
                if (!timers[rec]) {
                    timers[rec] = setInterval(() => {
                        actualizarDuracionEnTabla(rec);
                    }, 1000);
                }
            }
            
            cerrarLoading();
            await mostrarNotificacion(
                '✅ Estado Actualizado',
                `Documento REC${rec} cambiado a ${nuevoEstado}`,
                'success',
                3000
            );
            
            await actualizarInmediatamente();
        } else {
            cerrarLoading();
            await mostrarNotificacion(
                '❌ Error',
                result.message || 'Error al cambiar estado',
                'error'
            );
        }
    } catch (error) {
        cerrarLoading();
        console.error('Error cambiando estado:', error);
        await mostrarNotificacion(
            '❌ Error',
            'Error al cambiar estado: ' + error.message,
            'error'
        );
    }
}

// Función modificada para restablecer con SweetAlert
async function restablecerDocumento(rec) {
    try {
        const { value: password } = await Swal.fire({
            title: 'Restablecer Documento',
            text: `Ingrese la contraseña para restablecer REC${rec}:`,
            input: 'password',
            inputAttributes: {
                autocapitalize: 'off',
                autocorrect: 'off'
            },
            showCancelButton: true,
            confirmButtonText: 'Restablecer',
            cancelButtonText: 'Cancelar',
            reverseButtons: true,
            preConfirm: (password) => {
                if (!password) {
                    Swal.showValidationMessage('La contraseña es requerida');
                }
                return password;
            }
        });

        if (password === 'one') {
            mostrarLoading(`Restableciendo documento REC${rec}...`);
            
            console.log(`Restableciendo documento REC${rec}`);
            
            const result = await llamarAPI({
                action: 'restablecer',
                id: rec,
                password: password
            });
            
            if (result.success) {
                if (timers[rec]) {
                    clearInterval(timers[rec]);
                    delete timers[rec];
                }
                
                cerrarLoading();
                await mostrarNotificacion(
                    '✅ Documento Restablecido',
                    `Documento REC${rec} restablecido correctamente`,
                    'success',
                    3000
                );
                
                await actualizarInmediatamente();
            } else {
                cerrarLoading();
                await mostrarNotificacion(
                    '❌ Error',
                    result.message || 'Error al restablecer',
                    'error'
                );
            }
        } else if (password) {
            await mostrarNotificacion('❌ Error', 'Contraseña incorrecta', 'error');
        }
    } catch (error) {
        cerrarLoading();
        console.error('Error restableciendo documento:', error);
        await mostrarNotificacion(
            '❌ Error',
            'Error al restablecer documento: ' + error.message,
            'error'
        );
    }
}

// Función para cargar la tabla de documentos
async function cargarTablaDocumentos() {
    try {
        const loader = document.getElementById('loader');
        if (loader) {
            loader.style.display = 'block';
        }

        await cargarResponsables();
        
        if (documentosTable) {
            documentosTable.destroy();
        }

        const documentosDisponibles = await obtenerDocumentosCombinados();
        documentosGlobales = documentosDisponibles;
        
        const consolidados = calcularConsolidados(documentosDisponibles);
        actualizarTarjetasResumen(consolidados);
        
        inicializarDataTable(documentosDisponibles);
        
        if (loader) {
            loader.style.display = 'none';
        }
        
    } catch (error) {
        console.error('Error al cargar tabla de documentos:', error);
        manejarErrorConexion(error, 'carga de tabla de documentos');
        
        const loader = document.getElementById('loader');
        if (loader) {
            loader.style.display = 'none';
        }
    }
}

// Función para obtener datos combinados
async function obtenerDocumentosCombinados() {
    const SPREADSHEET_ID = "1d5dCCCgiWXfM6vHu3zGGKlvK2EycJtT7Uk4JqUjDOfE";
    const API_KEY = 'AIzaSyC7hjbRc0TGLgImv8gVZg8tsOeYWgXlPcM';
    
    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/DATA!A2:K?key=${API_KEY}`;
        const response = await fetch(url);
        
        if (!response.ok) throw new Error('Error al obtener datos de la hoja DATA');
        
        const data = await response.json();
        const values = data.values || [];
        
        const datosGlobalesMap = {};
        datosGlobales.forEach(item => {
            if (item.REC) {
                datosGlobalesMap[item.REC] = item;
            }
        });

        const estadosParaMostrar = obtenerEstadosParaMostrar();
        const documentosProcesados = values
            .map((row) => {
                const documento = String(row[0] || '').trim();
                const estado = String(row[3] || '').trim().toUpperCase();
                const colaborador = String(row[4] || '').trim();
                const fechaHora = row[1] || '';
                const fechaSolo = formatearFechaSolo(fechaHora);
                const fechaObjeto = parsearFecha(fechaSolo);
                
                const datetime_inicio = row[5] || '';
                const datetime_fin = row[6] || '';
                const duracion_guardada = row[7] || '';
                const pausas = row[8] || '';
                const datetime_pausas = row[9] || '';
                const duracion_pausas = row[10] || '';
                
                const datosCompletos = datosGlobalesMap[documento];
                const cantidadTotal = datosCompletos ? calcularCantidadTotal({ datosCompletos }) : 0;
                
                return {
                    rec: documento,
                    estado: estado,
                    colaborador: colaborador,
                    fecha: fechaSolo,
                    fecha_completa: fechaHora,
                    fecha_objeto: fechaObjeto,
                    cantidad: cantidadTotal,
                    lote: datosCompletos ? (datosCompletos.LOTE || '') : '',
                    refProv: datosCompletos ? (datosCompletos.REFPROV || '') : '',
                    linea: datosCompletos ? (datosCompletos.LINEA || '') : '',
                    tieneClientes: datosCompletos ? 
                        (datosCompletos.DISTRIBUCION && datosCompletos.DISTRIBUCION.Clientes && 
                         Object.keys(datosCompletos.DISTRIBUCION.Clientes).length > 0) : false,
                    datosCompletos: datosCompletos,
                    datetime_inicio: datetime_inicio,
                    datetime_fin: datetime_fin,
                    duracion_guardada: duracion_guardada,
                    pausas: pausas,
                    datetime_pausas: datetime_pausas,
                    duracion_pausas: duracion_pausas
                };
            })
            .filter(doc => doc.rec && estadosParaMostrar.includes(doc.estado));

        console.log('Documentos procesados:', documentosProcesados.length);
        console.log('Ejemplo de fecha_objeto:', documentosProcesados[0]?.fecha_objeto);

        return documentosProcesados;
            
    } catch (error) {
        console.error('Error obteniendo documentos:', error);
        throw error;
    }
}

function puedeModificarResponsable(documento) {
    return !documento.colaborador || documento.colaborador.trim() === '';
}

function generarSelectResponsables(rec, responsableActual = '', todosDocumentos, documentoActual) {
    const puedeModificar = puedeModificarResponsable(documentoActual);
    const responsablesDisponibles = puedeModificar 
        ? obtenerResponsablesDisponibles(todosDocumentos, documentoActual)
        : [];
    
    let opciones = '';
    
    if (puedeModificar) {
        opciones = `
            <option value="">Sin responsable</option>
            ${responsablesDisponibles.map(resp => 
                `<option value="${resp}" ${resp === responsableActual ? 'selected' : ''}>${resp}</option>`
            ).join('')}
        `;
        
        return `
            <select class="form-select form-select-sm select-responsable" 
                    data-rec="${rec}" 
                    style="min-width: 180px; font-size: 0.8rem;">
                ${opciones}
            </select>
        `;
    } else {
        const tieneResponsable = responsableActual && responsableActual.trim() !== '';
        const texto = tieneResponsable ? responsableActual : 'Sin responsable';
        const clase = tieneResponsable ? 'text-success' : 'text-muted';
        
        return `
            <span class="${clase} small" title="Responsable asignado - No modificable">
                <i class="fas fa-user me-1"></i>${texto}
            </span>
        `;
    }
}

function obtenerBotonesAccion(data) {
    const tieneColaborador = data.colaborador && data.colaborador.trim() !== '';
    const tieneClientes = data.tieneClientes;
    const puedeImprimir = tieneColaborador && tieneClientes;
    
    let botonesEstado = '';
    
    if (data.estado === 'PAUSADO') {
        botonesEstado = `
            <button class="btn btn-success btn-sm" 
                    onclick="cambiarEstadoDocumento('${data.rec}', 'ELABORACION')"
                    title="Reanudar">
                <i class="fas fa-play"></i>
            </button>`;
    } else if (data.estado === 'ELABORACION') {
        botonesEstado = `
            <button class="btn btn-warning btn-sm" 
                    onclick="cambiarEstadoDocumento('${data.rec}', 'PAUSADO')"
                    title="Pausar">
                <i class="fas fa-pause"></i>
            </button>`;
    } else if (data.estado === 'PENDIENTE' || data.estado === 'DIRECTO') {
        botonesEstado = `
            <button class="btn btn-warning btn-sm" 
                    onclick="cambiarEstadoDocumento('${data.rec}', 'PAUSADO')"
                    title="Pausar">
                <i class="fas fa-pause"></i>
            </button>`;
    }
    
    if (data.estado !== 'FINALIZADO') {
        botonesEstado += `
            <button class="btn btn-info btn-sm" 
                    onclick="cambiarEstadoDocumento('${data.rec}', 'FINALIZADO')"
                    title="Finalizar">
                <i class="fas fa-check"></i>
            </button>`;
    }
    
    return `
        <div class="btn-group btn-group-sm">
            <button class="btn ${puedeImprimir ? 'btn-primary' : 'btn-secondary'} btn-sm" 
                    ${puedeImprimir ? '' : 'disabled'}
                    onclick="imprimirSoloClientesDesdeTabla('${data.rec}')"
                    title="${puedeImprimir ? 'Imprimir clientes' : 'No se puede imprimir'}">
                <i class="fas fa-print"></i>
            </button>
            
            ${botonesEstado}
            
            <button class="btn btn-danger btn-sm" 
                    onclick="restablecerDocumento('${data.rec}')"
                    title="Restablecer">
                <i class="fas fa-undo"></i>
            </button>
        </div>
    `;
}

function inicializarDataTable(documentos) {
    const table = $('#documentosTable');
    
    $.fn.dataTable.ext.search = [];
    
    documentosTable = table.DataTable({
        data: documentos,
        columns: [
            { 
                data: 'rec',
                render: function(data) {
                    return `<strong class="text-primary">REC${data}</strong>`;
                }
            },
            { 
                data: 'estado',
                render: function(data) {
                    const clases = {
                        'PENDIENTE': 'badge bg-warning',
                        'DIRECTO': 'badge bg-success',
                        'ELABORACION': 'badge bg-info',
                        'PAUSADO': 'badge bg-secondary',
                        'FINALIZADO': 'badge bg-dark'
                    };
                    return `<span class="${clases[data] || 'badge bg-light text-dark'}">${data}</span>`;
                }
            },
            { 
                data: 'colaborador',
                render: function(data, type, row) {
                    return generarSelectResponsables(row.rec, data, documentos, row);
                }
            },
            { 
                data: 'fecha',
                render: function(data, type, row) {
                    const fechaCompleta = row.fecha_completa || data;
                    return `
                        <span class="small" title="${fechaCompleta}">
                            ${data}
                        </span>
                    `;
                }
            },
            { 
                data: null,
                render: function(data) {
                    const duracion = calcularDuracionDesdeSheets(data);
                    const clase = data.estado === 'PAUSADO' ? 'text-warning' : 
                                 data.estado === 'FINALIZADO' ? 'text-muted' : 'text-info';
                    
                    return `<span class="duracion-tiempo ${clase} small font-monospace">${duracion}</span>`;
                }
            },
            { 
                data: 'cantidad',
                render: function(data) {
                    return `<strong class="text-success">${data}</strong>`;
                }
            },
            { 
                data: 'linea',
                render: function(data) {
                    return data ? `<span class="small">${data}</span>` : '<span class="text-muted small">-</span>';
                }
            },
            { 
                data: 'lote',
                render: function(data) {
                    return data ? `<span class="small">${data}</span>` : '<span class="text-muted small">-</span>';
                }
            },
            { 
                data: 'refProv',
                render: function(data) {
                    return data ? `<span class="small">${data}</span>` : '<span class="text-muted small">-</span>';
                }
            },
            {
                data: null,
                render: obtenerBotonesAccion,
                orderable: false
            }
        ],
        language: {
            url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json'
        },
        pageLength: 50,
        responsive: true,
        dom: '<"row"<"col-sm-12 col-md-6"l><"col-sm-12 col-md-6"f>>rt<"row"<"col-sm-12 col-md-6"i><"col-sm-12 col-md-6"p>>',
        order: [[0, 'desc']],
        columnDefs: [
            { responsivePriority: 1, targets: 0 },
            { responsivePriority: 2, targets: 9 },
            { responsivePriority: 3, targets: 5 },
            { responsivePriority: 4, targets: 4 },
            { responsivePriority: 5, targets: 1 },
            { responsivePriority: 6, targets: 2 }
        ],
        initComplete: function() {
            $('.select-responsable').on('change', function() {
                const rec = $(this).data('rec');
                const responsable = $(this).val();
                if (responsable) {
                    cambiarResponsable(rec, responsable);
                }
            });
            
            configurarFiltroFecha();
            iniciarTimers(documentos);
        },
        drawCallback: function() {
            $('.select-responsable').on('change', function() {
                const rec = $(this).data('rec');
                const responsable = $(this).val();
                if (responsable) {
                    cambiarResponsable(rec, responsable);
                }
            });
        }
    });
}

// Reemplazar las funciones de mensajes existentes
function mostrarMensaje(mensaje, tipo = 'info') {
    const iconMap = {
        'success': 'success',
        'error': 'error', 
        'info': 'info'
    };
    
    mostrarNotificacion(
        tipo.charAt(0).toUpperCase() + tipo.slice(1),
        mensaje,
        iconMap[tipo] || 'info'
    );
}

function mostrarError(mensaje) {
    mostrarNotificacion('Error', mensaje, 'error');
}

document.addEventListener('DOMContentLoaded', function() {
    const checkDataLoaded = setInterval(() => {
        if (datosGlobales && datosGlobales.length > 0) {
            clearInterval(checkDataLoaded);
            cargarTablaDocumentos();
        }
    }, 500);
});

window.addEventListener('beforeunload', function() {
    Object.keys(timers).forEach(rec => {
        clearInterval(timers[rec]);
    });
});

window.aplicarFiltroFecha = aplicarFiltroFecha;
window.limpiarFiltros = limpiarFiltros;
window.cambiarEstadoDocumento = cambiarEstadoDocumento;
window.restablecerDocumento = restablecerDocumento;
window.imprimirSoloClientesDesdeTabla = imprimirSoloClientesDesdeTabla;
window.buscarDocumentoEnTabla = buscarDocumentoEnTabla;
window.toggleFinalizados = toggleFinalizados;
window.cargarTablaDocumentos = cargarTablaDocumentos;
