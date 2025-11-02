// Configuración de DataTable para documentos disponibles
let documentosTable = null;
let listaResponsables = [];
let timers = {}; // Almacenar los intervalos de tiempo
let documentosGlobales = []; // Almacenar todos los documentos para los consolidados
let rangoFechasSeleccionado = null; // Almacenar rango de fechas para filtrado
let filtrosActivos = {
    busqueda: '',
    fecha: null,
    estado: null
};
let actualizacionEnProgreso = false; // Flag para evitar múltiples actualizaciones simultáneas
let timeoutActualizacion = null; // Timeout para debounce

// URL de la API de Google Apps Script
const API_URL = 'https://script.google.com/macros/s/AKfycbzeG16VGHb63ePAwm00QveNsdbMEHi9dFbNsmQCreNOXDtwIh22NHxzRpwuzZBZ-oIJWg/exec';

// Estados permitidos para mostrar
let mostrarFinalizados = false;
const ESTADOS_VISIBLES = ['PENDIENTE', 'DIRECTO', 'ELABORACION', 'PAUSADO'];
const ESTADOS_FINALIZADOS = ['FINALIZADO'];

// Función para mostrar notificaciones con SweetAlert2 en el CENTRO
function mostrarNotificacion(titulo, mensaje, tipo = 'success') {
    return Swal.fire({
        title: titulo,
        text: mensaje,
        icon: tipo,
        position: 'center',
        showConfirmButton: false,
        timer: 800,
        timerProgressBar: true
    });
}

// Función para mostrar confirmación con SweetAlert2 en el CENTRO
async function mostrarConfirmacion(titulo, texto, tipo = 'info') {
    const result = await Swal.fire({
        title: titulo,
        text: texto,
        icon: tipo,
        position: 'center',
        showCancelButton: true,
        confirmButtonText: 'Sí, continuar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33'
    });
    return result.isConfirmed;
}

// Función para mostrar input con SweetAlert2 en el CENTRO
async function mostrarInput(titulo, texto, tipo = 'text') {
    const { value } = await Swal.fire({
        title: titulo,
        input: tipo,
        inputLabel: texto,
        position: 'center',
        showCancelButton: true,
        confirmButtonText: 'Aceptar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        inputValidator: (value) => {
            if (!value) {
                return 'Este campo es obligatorio';
            }
        }
    });
    return value;
}

// Función para mostrar loading EN EL CENTRO
function mostrarLoading(titulo = 'Procesando...', texto = '') {
    return Swal.fire({
        title: titulo,
        text: texto,
        position: 'center',
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
}

// Función para guardar estado actual de la tabla
function guardarEstadoTabla() {
    if (!documentosTable) return null;
    
    return {
        search: documentosTable.search(),
        page: documentosTable.page(),
        order: documentosTable.order(),
        estadoFiltros: { ...filtrosActivos }
    };
}

// Función para restaurar estado de la tabla
function restaurarEstadoTabla(estado) {
    if (!documentosTable || !estado) return;
    
    // Restaurar búsqueda
    if (estado.search) {
        documentosTable.search(estado.search);
    }
    
    // Restaurar página
    if (estado.page !== undefined) {
        documentosTable.page(estado.page).draw('page');
    }
    
    // Restaurar orden
    if (estado.order) {
        documentosTable.order(estado.order);
    }
    
    // Restaurar filtros
    if (estado.estadoFiltros) {
        filtrosActivos = { ...estado.estadoFiltros };
        
        // Restaurar búsqueda en input
        if (document.getElementById('recInput')) {
            document.getElementById('recInput').value = filtrosActivos.busqueda || '';
        }
        
        // Restaurar fecha en flatpickr
        if (filtrosActivos.fecha && window.flatpickrInstance) {
            window.flatpickrInstance.setDate(filtrosActivos.fecha, false);
        }
    }
}

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

// Función OPTIMIZADA para actualizar solo una fila específica
// Función MEJORADA para actualizar solo una fila específica
async function actualizarFilaEspecifica(rec) {
    if (!documentosTable) return;
    
    try {
        console.log(`Actualizando solo fila REC${rec}`);
        
        // Obtener datos actualizados solo para este documento
        const SPREADSHEET_ID = "1d5dCCCgiWXfM6vHu3zGGKlvK2EycJtT7Uk4JqUjDOfE";
        const API_KEY = 'AIzaSyC7hjbRc0TGLgImv8gVZg8tsOeYWgXlPcM';
        
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/DATA!A2:K?key=${API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        const values = data.values || [];
        
        // Encontrar el documento específico
        const rowData = values.find(row => String(row[0] || '').trim() === rec);
        
        if (!rowData) {
            console.warn(`No se encontró REC${rec}`);
            return;
        }
        
        // Procesar el documento
        const documento = String(rowData[0] || '').trim();
        const estado = String(rowData[3] || '').trim().toUpperCase();
        const colaborador = String(rowData[4] || '').trim();
        const fechaHora = rowData[1] || '';
        const fechaSolo = formatearFechaSolo(fechaHora);
        const fechaObjeto = parsearFecha(fechaSolo);
        
        // BUSCAR EN DATOS GLOBALES ACTUALIZADOS
        const datosCompletos = datosGlobales.find(d => d.REC === documento);
        const cantidadTotal = datosCompletos ? calcularCantidadTotal({ datosCompletos }) : 0;
        
        const documentoActualizado = {
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
            datosCompletos: datosCompletos, // ESTO ES CLAVE PARA LA IMPRESIÓN
            datetime_inicio: rowData[5] || '',
            datetime_fin: rowData[6] || '',
            duracion_guardada: rowData[7] || '',
            pausas: rowData[8] || '',
            datetime_pausas: rowData[9] || '',
            duracion_pausas: rowData[10] || ''
        };
        
        // Actualizar la fila en DataTable
        const fila = documentosTable.row((idx, data) => data.rec === rec);
        if (fila.any()) {
            fila.data(documentoActualizado).draw(false); // false = no cambiar de página
            console.log(`Fila REC${rec} actualizada exitosamente`);
            
            // ACTUALIZAR INTERFAZ: Forzar redibujado del select de responsables
            const rowNode = fila.node();
            const selectCell = $(rowNode).find('td:eq(2)'); // Columna de responsable
            selectCell.html(generarSelectResponsables(rec, colaborador, documentosGlobales, documentoActualizado));
        }
        
        // Actualizar documentosGlobales
        const index = documentosGlobales.findIndex(d => d.rec === rec);
        if (index !== -1) {
            documentosGlobales[index] = documentoActualizado;
        } else {
            documentosGlobales.push(documentoActualizado);
        }
        
        // Recalcular consolidados
        const consolidados = calcularConsolidados(documentosGlobales);
        actualizarTarjetasResumen(consolidados);
        
    } catch (error) {
        console.error('Error actualizando fila específica:', error);
    }
}

// Función MEJORADA para actualizar inmediatamente después de un cambio
async function actualizarInmediatamente(forzarRecarga = false, recEspecifico = null) {
    // Evitar múltiples actualizaciones simultáneas
    if (actualizacionEnProgreso && !forzarRecarga) {
        console.log('Actualización ya en progreso, ignorando...');
        return;
    }
    
    // Si hay un REC específico y no se fuerza recarga, actualizar solo esa fila
    if (recEspecifico && !forzarRecarga) {
        await actualizarFilaEspecifica(recEspecifico);
        return;
    }
    
    let estadoTabla = null;
    actualizacionEnProgreso = true;
    
    try {
        // Guardar estado actual antes de cualquier cambio
        estadoTabla = guardarEstadoTabla();
        
        // Mostrar loader global solo si es recarga forzada
        const loader = document.getElementById('loader');
        if (loader && forzarRecarga) {
            loader.style.display = 'block';
        }

        console.log('Actualizando tabla...', { forzarRecarga, recEspecifico });

        // Si se fuerza recarga o no hay tabla, cargar completamente
        if (forzarRecarga || !documentosTable) {
            console.log('Recargando tabla completa...');
            await cargarTablaDocumentos();
        } else {
            console.log('Actualizando datos existentes...');
            // Solo actualizar los datos de la tabla existente
            const documentosDisponibles = await obtenerDocumentosCombinados();
            documentosGlobales = documentosDisponibles;
            
            const consolidados = calcularConsolidados(documentosDisponibles);
            actualizarTarjetasResumen(consolidados);
            
            // Actualizar DataTable con nuevos datos
            documentosTable.clear();
            documentosTable.rows.add(documentosDisponibles);
            documentosTable.draw(false); // false = mantener página actual
            
            // Reiniciar timers
            iniciarTimers(documentosDisponibles);
        }
        
        // Restaurar estado después de cargar
        if (estadoTabla) {
            setTimeout(() => {
                restaurarEstadoTabla(estadoTabla);
            }, 50); // Reducido de 100ms a 50ms
        }
        
        // Ocultar loader
        if (loader && forzarRecarga) {
            setTimeout(() => {
                loader.style.display = 'none';
            }, 200); // Reducido de 500ms a 200ms
        }
        
        console.log('Tabla actualizada correctamente');
        
    } catch (error) {
        console.error('Error en actualización inmediata:', error);
        const loader = document.getElementById('loader');
        if (loader) {
            loader.style.display = 'none';
        }
        // Restaurar estado incluso en error
        if (estadoTabla && documentosTable) {
            restaurarEstadoTabla(estadoTabla);
        }
        throw error;
    } finally {
        actualizacionEnProgreso = false;
    }
}

// Función para actualizar datos globales después de cambios
async function actualizarDatosGlobales() {
    try {
        console.log('Actualizando datos globales...');
        
        // Recargar los datos desde la API
        if (typeof cargarDatos === 'function') {
            await cargarDatos();
            console.log('Datos globales actualizados correctamente');
            return true;
        } else {
            console.warn('Función cargarDatos no disponible');
            return false;
        }
    } catch (error) {
        console.error('Error actualizando datos globales:', error);
        return false;
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
        const año = parseInt(partes[2], 10);
        
        // Validar que sean números válidos
        if (isNaN(dia) || isNaN(mes) || isNaN(año)) return null;
        
        // Crear fecha (mes - 1 porque en JS los meses van de 0-11)
        const fecha = new Date(año, mes - 1, dia);
        
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
    filtrosActivos.fecha = [fechaInicio, fechaFin];
    
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
    filtrosActivos = {
        busqueda: '',
        fecha: null,
        estado: null
    };
    
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
    actualizarInmediatamente(true);
}

// Función MEJORADA para cargar la tabla de documentos
async function cargarTablaDocumentos() {
    try {
        console.log('Iniciando carga de tabla de documentos...');
        
        const loader = document.getElementById('loader');
        if (loader) {
            loader.style.display = 'block';
        }

        await cargarResponsables();
        
        // Destruir tabla existente si hay una
        if (documentosTable) {
            documentosTable.destroy();
            documentosTable = null;
        }

        const documentosDisponibles = await obtenerDocumentosCombinados();
        documentosGlobales = documentosDisponibles;
        
        console.log('Documentos disponibles:', documentosDisponibles.length);
        
        const consolidados = calcularConsolidados(documentosDisponibles);
        actualizarTarjetasResumen(consolidados);
        
        // Inicializar DataTable solo si hay datos
        if (documentosDisponibles.length > 0) {
            inicializarDataTable(documentosDisponibles);
        } else {
            // Mostrar mensaje de no hay datos
            $('#documentosTable').html(`
                <thead class="table-light">
                    <tr>
                        <th>Documento</th>
                        <th>Estado</th>
                        <th>Responsable</th>
                        <th>Fecha</th>
                        <th>Duración</th>
                        <th>Cantidad</th>
                        <th>Línea</th>
                        <th>Lote</th>
                        <th>RefProv</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td colspan="10" class="text-center text-muted py-4">
                            No se encontraron documentos
                        </td>
                    </tr>
                </tbody>
            `);
        }
        
        if (loader) {
            loader.style.display = 'none';
        }
        
        console.log('Tabla de documentos cargada correctamente');
        
    } catch (error) {
        console.error('Error al cargar tabla de documentos:', error);
        
        const loader = document.getElementById('loader');
        if (loader) {
            loader.style.display = 'none';
        }
        
        // Mostrar error en la tabla
        $('#documentosTable').html(`
            <thead class="table-light">
                <tr>
                    <th>Documento</th>
                    <th>Estado</th>
                    <th>Responsable</th>
                    <th>Fecha</th>
                    <th>Duración</th>
                    <th>Cantidad</th>
                    <th>Línea</th>
                    <th>Lote</th>
                    <th>RefProv</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td colspan="10" class="text-center text-danger py-4">
                        Error al cargar los documentos: ${error.message}
                    </td>
                </tr>
            </tbody>
        `);
        
        mostrarNotificacion('Error', 'Error al cargar los documentos: ' + error.message, 'error');
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
        if (datosGlobales && datosGlobales.length > 0) {
            datosGlobales.forEach(item => {
                if (item.REC) {
                    datosGlobalesMap[item.REC] = item;
                }
            });
        } else {
            console.warn('datosGlobales está vacío o no disponible');
        }

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
        return documentosProcesados;
            
    } catch (error) {
        console.error('Error obteniendo documentos:', error);
        throw error;
    }
}

// Función OPTIMIZADA para cambiar responsable
// Función OPTIMIZADA para cambiar responsable - VERSIÓN CORREGIDA
async function cambiarResponsable(rec, responsable) {
    // Evitar múltiples llamadas simultáneas
    if (actualizacionEnProgreso) {
        console.log('Actualización en progreso, ignorando cambio de responsable...');
        return;
    }
    
    try {
        console.log(`Asignando responsable ${responsable} a REC${rec}`);
        
        actualizacionEnProgreso = true;
        
        // Mostrar loading compacto
        const loadingToast = Swal.fire({
            title: 'Asignando...',
            text: responsable,
            icon: 'info',
            position: 'center',
            showConfirmButton: false,
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        const result = await llamarAPI({
            action: 'asignarResponsable',
            id: rec,
            responsable: responsable
        });
        
        // Cerrar loading
        Swal.close();
        
        if (result.success) {
            // Mostrar éxito breve
            await mostrarNotificacion('✓ Asignado', responsable, 'success');
            
            // ACTUALIZACIÓN INMEDIATA: Actualizar datos globales primero
            await actualizarDatosGlobales();
            
            // ACTUALIZACIÓN INMEDIATA: Actualizar SOLO la fila específica
            await cargarTablaDocumentos();
            
            console.log(`Responsable ${responsable} asignado a REC${rec} - Tabla actualizada`);
            
        } else {
            await mostrarNotificacion('Error', result.message || 'Error al asignar responsable', 'error');
        }
    } catch (error) {
        console.error('Error cambiando responsable:', error);
        Swal.close();
        await mostrarNotificacion('Error', 'Error al asignar responsable: ' + error.message, 'error');
    } finally {
        actualizacionEnProgreso = false;
    }
}

// Función OPTIMIZADA para cambiar estado del documento
async function cambiarEstadoDocumento(rec, nuevoEstado) {
    // Evitar múltiples llamadas simultáneas
    if (actualizacionEnProgreso) {
        console.log('Actualización en progreso, ignorando cambio de estado...');
        return;
    }
    
    try {
        // Confirmar acción con icono info
        const estadosTexto = {
            'PAUSADO': 'pausar',
            'ELABORACION': 'reanudar',
            'FINALIZADO': 'finalizar'
        };
        
        const confirmar = await mostrarConfirmacion(
            `¿${estadosTexto[nuevoEstado] || 'cambiar'} documento?`,
            `REC${rec} → ${nuevoEstado}`,
            'info'
        );
        
        if (!confirmar) return;
        
        console.log(`Cambiando estado del documento REC${rec} a: ${nuevoEstado}`);
        
        actualizacionEnProgreso = true;
        
        // Mostrar loading compacto
        const loadingToast = Swal.fire({
            title: 'Cambiando estado...',
            text: `REC${rec} → ${nuevoEstado}`,
            icon: 'info',
            position: 'center',
            showConfirmButton: false,
            //timer: 15000,
            //timerProgressBar: true,
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

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
                Swal.close();
                await mostrarNotificacion('Error', 'Estado no válido', 'error');
                actualizacionEnProgreso = false;
                return;
        }
        
        const result = await llamarAPI({
            action: action,
            id: rec
        });
        
        // Cerrar loading
        Swal.close();
        
        if (result.success) {
            // Manejar timers
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
            
            await mostrarNotificacion('✓ Actualizado', `${nuevoEstado}`, 'success');
            
            // Actualizar SOLO la fila específica
            await actualizarFilaEspecifica(rec);
            
        } else {
            await mostrarNotificacion('Error', result.message || 'Error al cambiar estado', 'error');
        }
    } catch (error) {
        console.error('Error cambiando estado:', error);
        Swal.close();
        await mostrarNotificacion('Error', 'Error al cambiar estado: ' + error.message, 'error');
    } finally {
        actualizacionEnProgreso = false;
    }
}

// Función OPTIMIZADA para restablecer documento
async function restablecerDocumento(rec) {
    try {
        const password = await mostrarInput(
            'Restablecer Documento',
            'Ingrese la contraseña para restablecer REC' + rec,
            'password'
        );
        
        if (!password) return;
        
        if (password !== 'one') {
            await mostrarNotificacion('Error', 'Contraseña incorrecta', 'error');
            return;
        }
        
        actualizacionEnProgreso = true;
        
        // Mostrar loading compacto
        const loadingToast = Swal.fire({
            title: 'Restableciendo...',
            text: `REC${rec}`,
            icon: 'info',
            position: 'center',
            showConfirmButton: false,
            //timer: 15000,
            //timerProgressBar: true,
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        const result = await llamarAPI({
            action: 'restablecer',
            id: rec,
            password: password
        });
        
        // Cerrar loading
        Swal.close();
        
        if (result.success) {
            // Detener timer si existe
            if (timers[rec]) {
                clearInterval(timers[rec]);
                delete timers[rec];
            }
            
            await mostrarNotificacion('✓ Restablecido', `REC${rec}`, 'success');
            
            // Actualizar SOLO la fila específica
            await actualizarFilaEspecifica(rec);
            
        } else {
            await mostrarNotificacion('Error', result.message || 'Error al restablecer', 'error');
        }
    } catch (error) {
        console.error('Error restableciendo documento:', error);
        Swal.close();
        await mostrarNotificacion('Error', 'Error al restablecer documento: ' + error.message, 'error');
    } finally {
        actualizacionEnProgreso = false;
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
        const clase = tieneResponsable ? 'text-success fw-bold' : 'text-muted';
        const icono = tieneResponsable ? 'fa-user-check' : 'fa-user';
        
        return `
            <span class="${clase} small" title="Responsable asignado - No modificable">
                <i class="fas ${icono} me-1"></i>${texto}
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
    
    // Limpiar búsquedas anteriores
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
                                 data.estado === 'FINALIZADO' ? 'text-muted' : 'text-primary';
                    return `<span class="duracion-tiempo ${clase} fw-bold">${duracion}</span>`;
                }
            },
            { 
                data: 'cantidad',
                render: function(data) {
                    return data ? `<span class="badge bg-light text-dark">${data}</span>` : '-';
                }
            },
            { 
                data: 'linea',
                render: function(data) {
                    return data ? `<span class="small">${data}</span>` : '-';
                }
            },
            { 
                data: 'lote',
                render: function(data) {
                    return data ? `<span class="small">${data}</span>` : '-';
                }
            },
            { 
                data: 'refProv',
                render: function(data) {
                    return data ? `<span class="small">${data}</span>` : '-';
                }
            },
            { 
                data: null,
                render: function(data) {
                    return obtenerBotonesAccion(data);
                }
            }
        ],
        language: {
            url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json'
        },
        pageLength: 10,
        order: [[2, 'asc']],
        responsive: true,
        autoWidth: false,
        stateSave: true, // Guardar estado de la tabla
        stateDuration: -1, // Guardar permanentemente
        createdRow: function(row, data, dataIndex) {
            if (data.estado !== 'PAUSADO' && data.estado !== 'FINALIZADO' && data.datetime_inicio) {
                if (!timers[data.rec]) {
                    timers[data.rec] = setInterval(() => {
                        actualizarDuracionEnTabla(data.rec);
                    }, 1000);
                }
            }
        },
        drawCallback: function(settings) {
            const api = this.api();
            const pageInfo = api.page.info();
            
            if (pageInfo.recordsTotal === 0) {
                $('#documentosTable tbody').html(
                    '<tr><td colspan="10" class="text-center text-muted py-4">No se encontraron documentos</td></tr>'
                );
            }
            
            // Aplicar búsqueda guardada si existe
            if (filtrosActivos.busqueda) {
                api.search(filtrosActivos.busqueda).draw();
            }
        }
    });
    
    configurarFiltroFecha();
    
    // Evento para cambio de responsable
    $('#documentosTable').on('change', '.select-responsable', function() {
        const rec = $(this).data('rec');
        const nuevoResponsable = $(this).val();
        
        if (nuevoResponsable !== undefined) {
            cambiarResponsable(rec, nuevoResponsable);
        }
    });
    
    // Evento para búsqueda por REC
    $('#recInput').on('input', function() {
        const searchTerm = $(this).val().trim();
        filtrosActivos.busqueda = searchTerm;
        
        if (searchTerm) {
            documentosTable.search(searchTerm).draw();
        } else {
            documentosTable.search('').draw();
        }
    });
}

// Función MEJORADA para imprimir clientes
// Función MEJORADA para imprimir clientes
async function imprimirSoloClientesDesdeTabla(rec) {
    try {
        console.log(`Imprimiendo clientes para REC${rec}`);
        
        // Buscar el documento en datosGlobales ACTUALIZADOS
        const documento = datosGlobales.find(doc => doc.REC === rec);
        
        if (!documento) {
            await mostrarNotificacion('Error', `No se encontró el documento REC${rec} en datos globales`, 'error');
            return;
        }

        // Verificar que tenga clientes
        if (!documento.DISTRIBUCION || !documento.DISTRIBUCION.Clientes || 
            Object.keys(documento.DISTRIBUCION.Clientes).length === 0) {
            await mostrarNotificacion('Error', `No hay clientes asignados para REC${rec}`, 'error');
            return;
        }

        // Verificar que tenga responsable asignado
        const documentoEnTabla = documentosGlobales.find(doc => doc.rec === rec);
        if (!documentoEnTabla || !documentoEnTabla.colaborador || documentoEnTabla.colaborador.trim() === '') {
            await mostrarNotificacion('Error', `No hay responsable asignado para REC${rec}`, 'error');
            return;
        }

        // Preparar datos para impresión
        const datosImpresion = {
            rec: rec,
            fecha: documento.FECHA || '',
            lote: documento.LOTE || '',
            refProv: documento.REFPROV || '',
            linea: documento.LINEA || '',
            cantidad: documento.CANTIDAD || 0,
            clientes: documento.DISTRIBUCION.Clientes,
            responsable: documentoEnTabla.colaborador // Incluir responsable
        };

        // Llamar a la función de impresión
        if (typeof imprimirSoloClientes === 'function') {
            imprimirSoloClientes(datosImpresion);
            await mostrarNotificacion('Éxito', `Imprimiendo REC${rec}`, 'success');
        } else {
            await mostrarNotificacion('Error', 'Función de impresión no disponible', 'error');
        }
        
    } catch (error) {
        console.error('Error al imprimir clientes:', error);
        await mostrarNotificacion('Error', 'Error al preparar la impresión: ' + error.message, 'error');
    }
}

// Inicializar cuando el DOM esté listo
$(document).ready(function() {
    console.log('Inicializando documents-table.js');
    
    // Esperar a que los datos globales estén cargados
    const checkDataLoaded = setInterval(() => {
        if (typeof datosGlobales !== 'undefined') {
            clearInterval(checkDataLoaded);
            console.log('Datos globales disponibles, cargando tabla...');
            
            // Configurar flatpickr para filtro de fecha si existe
            if (document.getElementById('filtroFecha')) {
                window.flatpickrInstance = flatpickr("#filtroFecha", {
                    mode: "range",
                    dateFormat: "Y-m-d",
                    locale: "es",
                    onChange: function(selectedDates, dateStr) {
                        if (selectedDates.length === 2) {
                            aplicarFiltroFecha(selectedDates[0], selectedDates[1]);
                        } else if (selectedDates.length === 0) {
                            // Limpiar filtro de fecha cuando se borra
                            rangoFechasSeleccionado = null;
                            filtrosActivos.fecha = null;
                            if (documentosTable) {
                                documentosTable.draw();
                            }
                        }
                    }
                });
            }
            
            // Cargar tabla inicial
            cargarTablaDocumentos();
        }
    }, 100);
});

// Exportar funciones para uso global
window.cambiarResponsable = cambiarResponsable;
window.cambiarEstadoDocumento = cambiarEstadoDocumento;
window.restablecerDocumento = restablecerDocumento;
window.imprimirSoloClientesDesdeTabla = imprimirSoloClientesDesdeTabla;
window.actualizarInmediatamente = actualizarInmediatamente;
window.limpiarFiltros = limpiarFiltros;
window.toggleFinalizados = toggleFinalizados;
