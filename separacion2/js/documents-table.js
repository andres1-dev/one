// Configuración de DataTable para documentos disponibles - ERROR SOLUCIONADO
let documentosTable = null;
let listaResponsables = [];
let timers = {};
let documentosGlobales = [];
let rangoFechasSeleccionado = null;
let filtrosActivos = {
    busqueda: '',
    fecha: null,
    estado: null
};
let actualizacionEnProgreso = false;
let timeoutActualizacion = null;
let filtroTarjetaActivo = null;

const API_URL = 'https://script.google.com/macros/s/AKfycbzeG16VGHb63ePAwm00QveNsdbMEHi9dFbNsmQCreNOXDtwIh22NHxzRpwuzZBZ-oIJWg/exec';

let mostrarFinalizados = false;
const ESTADOS_VISIBLES = ['PENDIENTE', 'DIRECTO', 'ELABORACION', 'PAUSADO'];
const ESTADOS_FINALIZADOS = ['FINALIZADO'];

// VERIFICAR SI DATATABLES ESTÁ CARGADO
function isDataTableLoaded() {
    return typeof $.fn.DataTable !== 'undefined';
}

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

function guardarEstadoTabla() {
    if (!documentosTable) return null;

    return {
        search: documentosTable.search(),
        page: documentosTable.page(),
        order: documentosTable.order(),
        estadoFiltros: { ...filtrosActivos }
    };
}

function restaurarEstadoTabla(estado) {
    if (!documentosTable || !estado) return;

    if (estado.search) {
        documentosTable.search(estado.search);
    }

    if (estado.page !== undefined) {
        documentosTable.page(estado.page).draw('page');
    }

    if (estado.order) {
        documentosTable.order(estado.order);
    }

    if (estado.estadoFiltros) {
        filtrosActivos = { ...estado.estadoFiltros };

        if (document.getElementById('recInput')) {
            document.getElementById('recInput').value = filtrosActivos.busqueda || '';
        }

        if (filtrosActivos.fecha && window.flatpickrInstance) {
            window.flatpickrInstance.setDate(filtrosActivos.fecha, false);
        }
    }
}

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

async function actualizarFilaEspecifica(rec) {
    if (!documentosTable) {
        console.warn('DataTable no inicializada, recargando completamente...');
        await actualizarInmediatamente(true);
        return;
    }

    try {
        console.log(`Actualizando solo fila REC${rec}`);

        const SPREADSHEET_ID = "1d5dCCCgiWXfM6vHu3zGGKlvK2EycJtT7Uk4JqUjDOfE";
        const API_KEY = 'AIzaSyC7hjbRc0TGLgImv8gVZg8tsOeYWgXlPcM';

        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/DATA!A2:K?key=${API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        const values = data.values || [];

        const rowData = values.find(row => String(row[0] || '').trim() === rec);

        if (!rowData) {
            console.warn(`No se encontró REC${rec}, forzando recarga completa`);
            await actualizarInmediatamente(true);
            return;
        }

        const documento = String(rowData[0] || '').trim();
        const estado = String(rowData[3] || '').trim().toUpperCase();
        const colaborador = String(rowData[4] || '').trim();
        const fechaHora = rowData[1] || '';
        const fechaSolo = formatearFechaSolo(fechaHora);
        const fechaObjeto = parsearFecha(fechaSolo);

        // Buscar en datos globales actualizados
        const datosCompletos = window.datosGlobales ? 
            window.datosGlobales.find(d => d.REC === documento) : 
            datosGlobales.find(d => d.REC === documento);
        
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
            prenda: datosCompletos ? (datosCompletos.PRENDA || '') : '',
            tieneClientes: datosCompletos ?
                (datosCompletos.DISTRIBUCION && datosCompletos.DISTRIBUCION.Clientes &&
                    Object.keys(datosCompletos.DISTRIBUCION.Clientes).length > 0) : false,
            datosCompletos: datosCompletos,
            datetime_inicio: rowData[5] || '',
            datetime_fin: rowData[6] || '',
            duracion_guardada: rowData[7] || '',
            pausas: rowData[8] || '',
            datetime_pausas: rowData[9] || '',
            duracion_pausas: rowData[10] || ''
        };

        // Encontrar y actualizar la fila en DataTable
        const filaIndex = documentosTable.rows().indexes().toArray().find(idx => {
            const rowData = documentosTable.row(idx).data();
            return rowData && rowData.rec === rec;
        });

        if (filaIndex !== undefined && filaIndex !== -1) {
            const fila = documentosTable.row(filaIndex);
            fila.data(documentoActualizado);
            
            // Redibujar solo esa fila
            const rowNode = fila.node();
            if (rowNode) {
                // Actualizar solo las celdas necesarias
                const estadoCell = $(rowNode).find('td:eq(1)');
                const responsableCell = $(rowNode).find('td:eq(2)');
                const duracionCell = $(rowNode).find('td:eq(4) .duracion-tiempo');
                const accionesCell = $(rowNode).find('td:eq(9)');

                // Actualizar estado
                const clases = {
                    'PENDIENTE': 'badge bg-warning',
                    'DIRECTO': 'badge bg-success',
                    'ELABORACION': 'badge bg-info',
                    'PAUSADO': 'badge bg-secondary',
                    'FINALIZADO': 'badge bg-dark'
                };
                estadoCell.html(`<span class="${clases[estado] || 'badge bg-light text-dark'}">${estado}</span>`);

                // Actualizar responsable
                responsableCell.html(generarSelectResponsables(rec, colaborador, documentosGlobales, documentoActualizado));

                // Actualizar duración
                const nuevaDuracion = calcularDuracionDesdeSheets(documentoActualizado);
                const claseDuracion = estado === 'PAUSADO' ? 'text-warning' :
                    estado === 'FINALIZADO' ? 'text-muted' : 'text-primary';
                duracionCell.text(nuevaDuracion).removeClass('text-warning text-muted text-primary').addClass(claseDuracion);

                // Actualizar acciones
                accionesCell.html(obtenerBotonesAccion(documentoActualizado));

                console.log(`Fila REC${rec} actualizada exitosamente`);
            }
        }

        // Actualizar en array global
        const index = documentosGlobales.findIndex(d => d.rec === rec);
        if (index !== -1) {
            documentosGlobales[index] = documentoActualizado;
        } else {
            documentosGlobales.push(documentoActualizado);
        }

        // Actualizar timers
        if (timers[rec]) {
            clearInterval(timers[rec]);
            delete timers[rec];
        }

        if (estado !== 'PAUSADO' && estado !== 'FINALIZADO' && documentoActualizado.datetime_inicio) {
            timers[rec] = setInterval(() => {
                actualizarDuracionEnTabla(rec);
            }, 1000);
        }

        // Actualizar tarjetas de resumen
        const consolidados = calcularConsolidados(documentosGlobales);
        actualizarTarjetasResumen(consolidados);

    } catch (error) {
        console.error('Error actualizando fila específica:', error);
        // En caso de error, forzar recarga completa
        await actualizarInmediatamente(true);
    }
}

async function actualizarInmediatamente(forzarRecarga = false, recEspecifico = null, accion = null) {
    if (actualizacionEnProgreso && !forzarRecarga) {
        console.log('Actualización ya en progreso, ignorando...');
        return;
    }

    let estadoTabla = null;
    actualizacionEnProgreso = true;

    try {
        if (!forzarRecarga) {
            estadoTabla = guardarEstadoTabla();
        }

        console.log('Actualizando tabla...', { forzarRecarga, recEspecifico, accion });

        // CASO 1: Si tenemos un REC específico, solo actualizamos esa fila
        if (recEspecifico && !forzarRecarga) {
            console.log(`Actualizando fila específica REC${recEspecifico}`);
            await actualizarFilaEspecifica(recEspecifico);
            
            // También actualizar datos globales para mantener consistencia
            await actualizarDatosGlobales();
        }
        // CASO 2: Recarga forzada completa
        else if (forzarRecarga || !documentosTable) {
            console.log('Recargando tabla completa...');

            // Si es forzado, recargar datos globales primero
            if (forzarRecarga && typeof window.cargarDatos === 'function') {
                await window.cargarDatos();
            }

            await cargarTablaDocumentos(); // Esta función ya inicializa las tarjetas
        }
        // CASO 3: Actualización general sin recarga completa
        else {
            console.log('Actualizando datos existentes...');
            const documentosDisponibles = await obtenerDocumentosCombinados();
            documentosGlobales = documentosDisponibles;

            const consolidados = calcularConsolidados(documentosDisponibles);
            actualizarTarjetasResumen(consolidados);

            documentosTable.clear();
            documentosTable.rows.add(documentosDisponibles);
            documentosTable.draw(false);

            iniciarTimers(documentosDisponibles);

            // REINICIALIZAR TARJETAS DESPUÉS DE ACTUALIZAR DATOS
            setTimeout(() => {
                inicializarTarjetasInteractivas();
            }, 100);
        }

        if (estadoTabla && documentosTable) {
            setTimeout(() => {
                restaurarEstadoTabla(estadoTabla);
            }, 50);
        }

        console.log('Tabla actualizada correctamente');

    } catch (error) {
        console.error('Error en actualización inmediata:', error);
        if (estadoTabla && documentosTable) {
            restaurarEstadoTabla(estadoTabla);
        }
        throw error;
    } finally {
        actualizacionEnProgreso = false;
    }
}

async function actualizarDatosGlobales() {
    try {
        console.log('Actualizando datos globales...');

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

function parsearFecha(fechaStr) {
    if (!fechaStr || fechaStr === '-') return null;

    try {
        const partes = fechaStr.split('/');
        if (partes.length !== 3) return null;

        const dia = parseInt(partes[0], 10);
        const mes = parseInt(partes[1], 10);
        const año = parseInt(partes[2], 10);

        if (isNaN(dia) || isNaN(mes) || isNaN(año)) return null;

        const fecha = new Date(año, mes - 1, dia);

        if (isNaN(fecha.getTime())) return null;

        return fecha;
    } catch (e) {
        console.error('Error parseando fecha:', e, 'String:', fechaStr);
        return null;
    }
}

function calcularConsolidados(documentos) {
    const consolidados = {
        pendientes: { count: 0, unidades: 0 },
        proceso: { count: 0, unidades: 0 },
        directos: { count: 0, unidades: 0 },
        total: { count: 0, unidades: 0 }
    };

    documentos.forEach(doc => {
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
    });

    return consolidados;
}

function actualizarTarjetasResumen(consolidados, mantenerEstado = false) {
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

    if (!mantenerEstado && filtroTarjetaActivo) {
        limpiarFiltroTarjetas();
    }
}

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

function milisegundosATiempo(ms) {
    const totalSec = Math.floor(ms / 1000);
    const horas = Math.floor(totalSec / 3600).toString().padStart(2, '0');
    const minutos = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
    const segundos = (totalSec % 60).toString().padStart(2, '0');
    return `${horas}:${minutos}:${segundos}`;
}

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

function configurarFiltroFecha() {
    // VERIFICAR QUE DATATABLES ESTÉ CARGADO ANTES DE USAR EXT
    if (!isDataTableLoaded()) {
        console.error('DataTables no está cargado');
        return;
    }

    $.fn.dataTable.ext.search.pop();

    $.fn.dataTable.ext.search.push(
        function (settings, data, dataIndex) {
            if (!rangoFechasSeleccionado || rangoFechasSeleccionado.length !== 2) {
                return true;
            }

            try {
                const rowData = documentosTable.row(dataIndex).data();

                if (!rowData || !rowData.fecha_objeto) {
                    return false;
                }

                const fechaDocumento = rowData.fecha_objeto;

                const fechaInicio = new Date(rangoFechasSeleccionado[0]);
                fechaInicio.setHours(0, 0, 0, 0);

                const fechaFin = new Date(rangoFechasSeleccionado[1]);
                fechaFin.setHours(23, 59, 59, 999);

                return fechaDocumento >= fechaInicio && fechaDocumento <= fechaFin;
            } catch (e) {
                console.error('Error en filtro de fecha:', e);
                return false;
            }
        }
    );
}

function aplicarFiltroFecha(fechaInicio, fechaFin) {
    console.log('Aplicando filtro de fecha:', fechaInicio, fechaFin);

    const inicio = new Date(fechaInicio);
    inicio.setHours(0, 0, 0, 0);

    const fin = new Date(fechaFin);
    fin.setHours(23, 59, 59, 999);

    rangoFechasSeleccionado = [inicio, fin];
    filtrosActivos.fecha = [fechaInicio, fechaFin];

    console.log('Rango normalizado:', rangoFechasSeleccionado);

    if (documentosTable) {
        documentosTable.draw();

        const datosFiltrados = documentosTable.rows({ search: 'applied' }).data().toArray();
        console.log('Documentos después del filtro:', datosFiltrados.length);

        const consolidados = calcularConsolidados(datosFiltrados);
        actualizarTarjetasResumen(consolidados);
    }
}

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

    if (window.flatpickrInstance) {
        window.flatpickrInstance.clear();
    }

    if (documentosTable) {
        documentosTable.search('').draw();

        const consolidados = calcularConsolidados(documentosGlobales);
        actualizarTarjetasResumen(consolidados);
    }
}

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

function obtenerResponsablesDisponibles(documentos, documentoActual) {
    const responsablesAsignados = documentos
        .filter(doc => doc.rec !== documentoActual.rec)
        .map(doc => doc.colaborador)
        .filter(resp => resp && resp.trim() !== '' && resp !== 'Sin responsable');

    return listaResponsables.filter(resp => !responsablesAsignados.includes(resp));
}

function calcularCantidadTotal(documento) {
    if (!documento.datosCompletos) return 0;

    const cantidad = parseInt(documento.datosCompletos.CANTIDAD) || 0;

    console.log(`Cantidad para REC${documento.rec}: ${cantidad} (solo principal)`);
    return cantidad;
}

function obtenerEstadosParaMostrar() {
    return mostrarFinalizados
        ? [...ESTADOS_VISIBLES, ...ESTADOS_FINALIZADOS]
        : ESTADOS_VISIBLES;
}

function toggleFinalizados() {
    mostrarFinalizados = !mostrarFinalizados;
    const btn = document.getElementById('btnToggleFinalizados');
    if (btn) {
        if (mostrarFinalizados) {
            btn.innerHTML = '<i class="fas fa-eye-slash"></i><span class="hide-xs"> Ocultar Finalizados</span>';
        } else {
            btn.innerHTML = '<i class="fas fa-eye"></i><span class="hide-xs"> Mostrar Finalizados</span>';
        }
    }
    actualizarInmediatamente(true);
}

async function cargarTablaDocumentos() {
    try {
        console.log('Iniciando carga de tabla de documentos...');

        vaciarTablaCompletamente();

        const loader = document.getElementById('loader');
        if (loader) {
            loader.style.display = 'block';
        }

        await cargarResponsables();

        if (documentosTable) {
            documentosTable.destroy();
            documentosTable = null;
        }

        const documentosDisponibles = await obtenerDocumentosCombinados();
        documentosGlobales = documentosDisponibles;

        console.log('Documentos disponibles:', documentosDisponibles.length);

        const consolidados = calcularConsolidados(documentosDisponibles);
        actualizarTarjetasResumen(consolidados);

        if (documentosDisponibles.length > 0) {
            inicializarDataTable(documentosDisponibles);

            // INICIALIZAR TARJETAS DESPUÉS DE CREAR LA TABLA
            setTimeout(() => {
                inicializarTarjetasInteractivas();
            }, 100);
        } else {
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
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Error al cargar los documentos: ${error.message}
                    </td>
                </tr>
            </tbody>
        `);

        mostrarNotificacion('Error', 'Error al cargar los documentos: ' + error.message, 'error');
    }
}

async function obtenerDocumentosCombinados() {
    try {
        // Esperar a que main.js termine de cargar si es necesario
        if (window.loaderPromise) {
            console.log("Esperando a que main.js cargue los datos...");
            await window.loaderPromise;
        }

        // Forzar actualización de datos globales si están vacíos
        if (!window.datosGlobales || window.datosGlobales.length === 0) {
            console.log("Datos globales vacíos, forzando recarga...");
            if (typeof window.cargarDatos === 'function') {
                await window.cargarDatos();
            }
        }

        // Usar los datos globales cargados por main.js
        let values = window.datosTablaDocumentos || [];

        // Si por alguna razón no hay datos, intentar cargarlos (fallback)
        if (!values || values.length === 0) {
            console.warn("Datos globales no encontrados, intentando cargar nuevamente...");
            if (typeof window.cargarDatos === 'function') {
                await window.cargarDatos();
                values = window.datosTablaDocumentos || [];
            }
        }

        if (!values || values.length === 0) {
            console.error("No se pudieron obtener datos de la hoja DATA");
            return [];
        }

        // Asegurarse de que datosGlobales esté disponible
        if (!window.datosGlobales && typeof cargarDatos === 'function') {
            console.log("Cargando datos globales...");
            await window.cargarDatos();
        }

        const datosGlobalesMap = {};
        if (window.datosGlobales && window.datosGlobales.length > 0) {
            window.datosGlobales.forEach(item => {
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
                // Validación básica de fila
                if (!row || row.length === 0) return null;

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
                    prenda: datosCompletos ? (datosCompletos.PRENDA || '') : '',
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

async function cambiarResponsable(rec, responsable) {
    if (actualizacionEnProgreso) {
        console.log('Actualización en progreso, ignorando cambio de responsable...');
        return;
    }

    try {
        console.log(`Asignando responsable ${responsable} a REC${rec}`);

        actualizacionEnProgreso = true;

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

        Swal.close();

        if (result.success) {
            await mostrarNotificacion('✓ Asignado', responsable, 'success');

            // Actualizar datos globales y luego actualizar la fila específica
            await actualizarDatosGlobales();
            await actualizarInmediatamente(false, rec, 'responsable');

        } else {
            await mostrarNotificacion('Error', result.message || 'Error al asignar responsable', 'error');
            await actualizarInmediatamente(true); // Forzar recarga en caso de error
        }
    } catch (error) {
        console.error('Error cambiando responsable:', error);
        Swal.close();
        await mostrarNotificacion('Error', 'Error al asignar responsable: ' + error.message, 'error');
        await actualizarInmediatamente(true); // Forzar recarga en caso de error
    } finally {
        actualizacionEnProgreso = false;
    }
}

function vaciarTablaCompletamente() {
    console.log('Vaciando tabla completamente...');

    // En lugar de destruir la DataTable, solo limpiar los datos
    if (documentosTable) {
        // Limpiar datos pero mantener la estructura
        documentosTable.clear();
        
        // Mostrar mensaje de carga
        const tbody = document.querySelector('#documentosTable tbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="text-center text-muted py-4">
                        <div class="spinner-border spinner-border-sm me-2" role="status">
                            <span class="visually-hidden">Cargando...</span>
                        </div>
                        Actualizando...
                    </td>
                </tr>
            `;
        }
        
        documentosTable.draw();
    } else {
        // Solo si no hay DataTable, recrear la estructura básica
        const tableContainer = document.getElementById('documentosTable');
        if (tableContainer) {
            tableContainer.innerHTML = `
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
                            <div class="spinner-border spinner-border-sm me-2" role="status">
                                <span class="visually-hidden">Cargando...</span>
                            </div>
                            Actualizando...
                        </td>
                    </tr>
                </tbody>
            `;
        }
    }
}

async function refrescarUI(rec = null) {
    console.log('Refrescando UI', rec ? `para REC${rec}` : 'completamente');
    
    try {
        if (rec) {
            // Actualización específica
            await actualizarInmediatamente(false, rec);
        } else {
            // Actualización general
            await actualizarInmediatamente(true);
        }
        
        // Actualizar indicador de estado
        if (window.updateStatusIndicator) {
            window.updateStatusIndicator('success');
        }
        
        return true;
    } catch (error) {
        console.error('Error refrescando UI:', error);
        
        if (window.updateStatusIndicator) {
            window.updateStatusIndicator('error');
        }
        
        // Intentar recarga completa como último recurso
        await actualizarInmediatamente(true);
        return false;
    }
}

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

        const loadingToast = Swal.fire({
            title: 'Restableciendo...',
            text: `REC${rec}`,
            icon: 'info',
            position: 'center',
            showConfirmButton: false,
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

        Swal.close();

        if (result.success) {
            if (timers[rec]) {
                clearInterval(timers[rec]);
                delete timers[rec];
            }

            await mostrarNotificacion('✓ Restablecido', `REC${rec}`, 'success');

            await actualizarInmediatamente(false, rec, 'restablecido');

        } else {
            await mostrarNotificacion('Error', result.message || 'Error al restablecer', 'error');
            await actualizarInmediatamente(true);
        }
    } catch (error) {
        console.error('Error restableciendo documento:', error);
        Swal.close();
        await mostrarNotificacion('Error', 'Error al restablecer documento: ' + error.message, 'error');
        await actualizarInmediatamente(true);
    } finally {
        actualizacionEnProgreso = false;
    }
}

async function cambiarEstadoDocumento(rec, nuevoEstado) {
    if (actualizacionEnProgreso) {
        console.log('Actualización en progreso, ignorando cambio de estado...');
        return;
    }

    try {
        const documentoActual = documentosGlobales.find(doc => doc.rec === rec);
        const estadoActual = documentoActual ? documentoActual.estado : '';

        if (nuevoEstado === 'FINALIZADO' && estadoActual === 'PAUSADO') {
            const confirmar = await mostrarConfirmacion(
                '¿Finalizar documento desde estado PAUSADO?',
                `REC${rec} se encuentra actualmente PAUSADO. Para garantizar el registro correcto de tiempos, el sistema reanudará y finalizará automáticamente. ¿Continuar?`,
                'warning'
            );

            if (!confirmar) return;

            actualizacionEnProgreso = true;

            const loadingToast = Swal.fire({
                title: 'Procesando...',
                html: `REC${rec}<br>Reanudando → Finalizando`,
                icon: 'info',
                position: 'center',
                showConfirmButton: false,
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            const resultReanudar = await llamarAPI({
                action: 'reanudar',
                id: rec
            });

            if (!resultReanudar.success) {
                Swal.close();
                await mostrarNotificacion('Error', 'Error al reanudar: ' + (resultReanudar.message || 'Error desconocido'), 'error');
                await actualizarInmediatamente(false, rec, 'reanudar-error');
                actualizacionEnProgreso = false;
                return;
            }

            await new Promise(resolve => setTimeout(resolve, 500));

            const resultFinalizar = await llamarAPI({
                action: 'finalizar',
                id: rec
            });

            Swal.close();

            if (resultFinalizar.success) {
                if (timers[rec]) {
                    clearInterval(timers[rec]);
                    delete timers[rec];
                }

                await mostrarNotificacion('✓ Finalizado', `REC${rec} completado`, 'success');

                await actualizarInmediatamente(false, rec, 'finalizado');

            } else {
                await mostrarNotificacion('Error', 'Error al finalizar: ' + (resultFinalizar.message || 'Error desconocido'), 'error');
                await actualizarInmediatamente(false, rec, 'finalizar-error');
            }

            actualizacionEnProgreso = false;
            return;
        }

        else if (nuevoEstado === 'FINALIZADO') {
            const confirmar = await mostrarConfirmacion(
                '¿Finalizar documento?',
                `REC${rec} → ${nuevoEstado}`,
                'info'
            );

            if (!confirmar) return;
        }

        console.log(`Cambiando estado del documento REC${rec} de ${estadoActual} a: ${nuevoEstado}`);

        actualizacionEnProgreso = true;

        const loadingToast = Swal.fire({
            title: 'Cambiando estado...',
            text: `REC${rec} → ${nuevoEstado}`,
            icon: 'info',
            position: 'center',
            showConfirmButton: false,
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        let action;
        switch (nuevoEstado) {
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
                await actualizarInmediatamente(true);
                actualizacionEnProgreso = false;
                return;
        }

        const result = await llamarAPI({
            action: action,
            id: rec
        });

        Swal.close();

        if (result.success) {
            if (nuevoEstado === 'PAUSADO' || nuevoEstado === 'FINALIZADO') {
                if (timers[rec]) {
                    clearInterval(timers[rec]);
                    delete timers[rec];
                }
            }

            await mostrarNotificacion('✓ Actualizado', `${nuevoEstado}`, 'success');

            await actualizarInmediatamente(false, rec, nuevoEstado);

        } else {
            await mostrarNotificacion('Error', result.message || 'Error al cambiar estado', 'error');
            await actualizarInmediatamente(true);
        }
    } catch (error) {
        console.error('Error cambiando estado:', error);
        Swal.close();
        await mostrarNotificacion('Error', 'Error al cambiar estado: ' + error.message, 'error');
        await actualizarInmediatamente(true);
    } finally {
        actualizacionEnProgreso = false;
    }
}

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

        vaciarTablaCompletamente();

        actualizacionEnProgreso = true;

        const loadingToast = Swal.fire({
            title: 'Restableciendo...',
            text: `REC${rec}`,
            icon: 'info',
            position: 'center',
            showConfirmButton: false,
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

        Swal.close();

        if (result.success) {
            if (timers[rec]) {
                clearInterval(timers[rec]);
                delete timers[rec];
            }

            await mostrarNotificacion('✓ Restablecido', `REC${rec}`, 'success');

            await cargarTablaDocumentos();

        } else {
            await mostrarNotificacion('Error', result.message || 'Error al restablecer', 'error');
            await cargarTablaDocumentos();
        }
    } catch (error) {
        console.error('Error restableciendo documento:', error);
        Swal.close();
        await mostrarNotificacion('Error', 'Error al restablecer documento: ' + error.message, 'error');
        await cargarTablaDocumentos();
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
        const clase = tieneResponsable ? 'text-success' : 'text-muted';
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

    const puedePausar = data.estado !== 'DIRECTO';

    const botonImprimir = `
        <button class="btn ${puedeImprimir ? 'btn-primary' : 'btn-secondary'}" 
                ${puedeImprimir ? '' : 'disabled'}
                onclick="imprimirSoloClientesDesdeTabla('${data.rec}')"
                title="${puedeImprimir ? 'Imprimir clientes' : 'No se puede imprimir'}">
            <i class="fas fa-print"></i>
        </button>`;

    if (data.estado === 'PAUSADO') {
        botonesEstado = `
            <button class="btn btn-success" 
                    onclick="cambiarEstadoDocumento('${data.rec}', 'ELABORACION')"
                    title="Reanudar documento">
                <i class="fas fa-play"></i>
            </button>`;
    } else if (data.estado === 'ELABORACION') {
        botonesEstado = `
            <button class="btn btn-warning" 
                    onclick="cambiarEstadoDocumento('${data.rec}', 'PAUSADO')"
                    title="Pausar documento">
                <i class="fas fa-pause"></i>
            </button>`;
    } else if (data.estado === 'PENDIENTE' || data.estado === 'DIRECTO') {
        botonesEstado = `
            <button class="btn btn-warning" 
                    ${!puedePausar ? 'disabled' : ''}
                    onclick="${puedePausar ? `cambiarEstadoDocumento('${data.rec}', 'PAUSADO')` : ''}"
                    title="${puedePausar ? 'Pausar documento' : 'No se puede pausar en estado DIRECTO'}">
                <i class="fas fa-pause"></i>
            </button>`;
    }

    const botonFinalizar = data.estado !== 'FINALIZADO' ? `
        <button class="btn btn-info" 
                onclick="cambiarEstadoDocumento('${data.rec}', 'FINALIZADO')"
                title="Finalizar documento">
            <i class="fas fa-check"></i>
        </button>` : '';

    const botonRestablecer = `
        <button class="btn btn-danger" 
                onclick="restablecerDocumento('${data.rec}')"
                title="Restablecer documento">
            <i class="fas fa-undo"></i>
        </button>`;

    return `
        <div class="acciones-panel">
            ${botonImprimir}
            ${botonesEstado}
            ${botonFinalizar}
            ${botonRestablecer}
        </div>
    `;
}

function inicializarDataTable(documentos) {
    // VERIFICAR QUE DATATABLES ESTÉ CARGADO ANTES DE INICIALIZAR
    if (!isDataTableLoaded()) {
        console.error('DataTables no está disponible. Reintentando en 500ms...');
        setTimeout(() => {
            if (isDataTableLoaded()) {
                inicializarDataTable(documentos);
            } else {
                console.error('DataTables no se cargó después del reintento');
            }
        }, 500);
        return;
    }

    const table = $('#documentosTable');

    // LIMPIAR FILTROS EXISTENTES
    $.fn.dataTable.ext.search = [];

    documentosTable = table.DataTable({
        data: documentos,
        columns: [
            {
                data: 'rec',
                render: function (data) {
                    return `REC${data}`;
                }
            },
            {
                data: 'estado',
                render: function (data) {
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
                render: function (data, type, row) {
                    return generarSelectResponsables(row.rec, data, documentos, row);
                }
            },
            {
                data: 'fecha',
                render: function (data, type, row) {
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
                render: function (data) {
                    const duracion = calcularDuracionDesdeSheets(data);
                    const clase = data.estado === 'PAUSADO' ? 'text-warning' :
                        data.estado === 'FINALIZADO' ? 'text-muted' : 'text-primary';
                    return `<span class="duracion-tiempo ${clase} fw-bold">${duracion}</span>`;
                }
            },
            {
                data: 'cantidad',
                render: function (data) {
                    return data ? `<span class="badge bg-light text-dark">${data}</span>` : '-';
                }
            },
            {
                data: 'prenda',
                render: function (data) {
                    return data ? `<span class="small">${data}</span>` : '-';
                }
            },
            {
                data: 'lote',
                render: function (data) {
                    return data ? `<span class="small">${data}</span>` : '-';
                }
            },
            {
                data: 'refProv',
                render: function (data) {
                    return data ? `<span class="small">${data}</span>` : '-';
                }
            },
            {
                data: null,
                render: function (data) {
                    return obtenerBotonesAccion(data);
                }
            }
        ],
        language: {
            url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json'
        },
        lengthMenu: [
            [5, 10, 25, 50, 100, -1],
            [5, 10, 25, 50, 100, 'Todos']
        ],
        pageLength: 5,
        order: [[2, 'asc']],
        responsive: true,
        autoWidth: false,
        stateSave: true,
        stateDuration: -1,
        createdRow: function (row, data, dataIndex) {
            $(row).attr('data-rec', data.rec); // Agregar atributo data-rec para fácil identificación
            if (data.estado !== 'PAUSADO' && data.estado !== 'FINALIZADO' && data.datetime_inicio) {
                if (!timers[data.rec]) {
                    timers[data.rec] = setInterval(() => {
                        actualizarDuracionEnTabla(data.rec);
                    }, 1000);
                }
            }
        },
        drawCallback: function (settings) {
            const api = this.api();
            const pageInfo = api.page.info();

            if (pageInfo.recordsTotal === 0) {
                $('#documentosTable tbody').html(
                    '<tr><td colspan="10" class="text-center text-muted py-4">No se encontraron documentos</td></tr>'
                );
            }

            if (filtrosActivos.busqueda) {
                api.search(filtrosActivos.busqueda).draw();
            }
        },
        rowCallback: function (row, data, index) {
            // Agregar clases específicas por estado para mejor visualización
            if (data.estado === 'PENDIENTE') {
                $(row).addClass('table-warning-light');
            } else if (data.estado === 'ELABORACION') {
                $(row).addClass('table-info-light');
            } else if (data.estado === 'PAUSADO') {
                $(row).addClass('table-secondary-light');
            } else if (data.estado === 'FINALIZADO') {
                $(row).addClass('table-dark-light');
            }
        }
    });

    configurarFiltroFecha();

    // Event listeners iniciales
    $('#documentosTable').on('change', '.select-responsable', function () {
        const rec = $(this).data('rec');
        const nuevoResponsable = $(this).val();

        if (nuevoResponsable !== undefined) {
            cambiarResponsable(rec, nuevoResponsable);
        }
    });

    $('#recInput').on('input', function () {
        const searchTerm = $(this).val().trim();
        filtrosActivos.busqueda = searchTerm;

        if (searchTerm) {
            documentosTable.search(searchTerm).draw();
        } else {
            documentosTable.search('').draw();
        }
    });

    // NUEVO: Reconectar event listeners después de cada draw
    documentosTable.on('draw', function() {
        console.log('DataTable redibujado, reconectando event listeners...');
        
        // Reconectar select de responsables
        $('#documentosTable').off('change', '.select-responsable').on('change', '.select-responsable', function () {
            const rec = $(this).data('rec');
            const nuevoResponsable = $(this).val();

            if (nuevoResponsable !== undefined) {
                cambiarResponsable(rec, nuevoResponsable);
            }
        });

        // Reconectar botones de acción
        $('#documentosTable').off('click', '.btn').on('click', '.btn', function (e) {
            e.stopPropagation(); // Prevenir propagación
            const btn = $(this);
            
            // Verificar si es un botón de acción
            if (btn.hasClass('btn-success') || btn.hasClass('btn-warning') || 
                btn.hasClass('btn-info') || btn.hasClass('btn-danger') || 
                btn.hasClass('btn-primary')) {
                
                // Obtener el REC de la fila padre
                const row = btn.closest('tr');
                const rec = row.data('rec') || row.attr('data-rec');
                
                if (rec) {
                    console.log(`Botón clickeado en REC${rec}`);
                    
                    // Determinar la acción basada en las clases del botón
                    if (btn.hasClass('btn-success') && btn.find('.fa-play').length) {
                        // Botón de reanudar
                        cambiarEstadoDocumento(rec, 'ELABORACION');
                    } else if (btn.hasClass('btn-warning') && btn.find('.fa-pause').length) {
                        // Botón de pausar
                        cambiarEstadoDocumento(rec, 'PAUSADO');
                    } else if (btn.hasClass('btn-info') && btn.find('.fa-check').length) {
                        // Botón de finalizar
                        cambiarEstadoDocumento(rec, 'FINALIZADO');
                    } else if (btn.hasClass('btn-danger') && btn.find('.fa-undo').length) {
                        // Botón de restablecer
                        restablecerDocumento(rec);
                    } else if (btn.hasClass('btn-primary') && btn.find('.fa-print').length) {
                        // Botón de imprimir
                        imprimirSoloClientesDesdeTabla(rec);
                    }
                }
            }
        });

        // Reconectar inputs de búsqueda
        $('#recInput').off('input').on('input', function () {
            const searchTerm = $(this).val().trim();
            filtrosActivos.busqueda = searchTerm;

            if (searchTerm) {
                documentosTable.search(searchTerm).draw();
            } else {
                documentosTable.search('').draw();
            }
        });

        // Reconectar tarjetas interactivas
        setTimeout(() => {
            inicializarTarjetasInteractivas();
        }, 100);
    });

    // NUEVO: Event listener para mantener el foco en los selects
    documentosTable.on('draw.dt', function () {
        // Re-aplicar el foco si había un select abierto
        const activeSelect = $('.select-responsable:focus');
        if (activeSelect.length > 0) {
            const rec = activeSelect.data('rec');
            const valor = activeSelect.val();
            
            setTimeout(() => {
                const nuevoSelect = $(`select[data-rec="${rec}"]`);
                if (nuevoSelect.length > 0) {
                    nuevoSelect.val(valor);
                }
            }, 50);
        }
    });

    // NUEVO: Inicializar timers inmediatamente
    iniciarTimers(documentos);

    console.log('DataTable inicializada correctamente con', documentos.length, 'documentos');
}

async function imprimirSoloClientesDesdeTabla(rec) {
    try {
        console.log(`Imprimiendo clientes para REC${rec}`);

        const documento = datosGlobales.find(doc => doc.REC === rec);

        if (!documento) {
            await mostrarNotificacion('Error', `No se encontró el documento REC${rec} en datos globales`, 'error');
            return;
        }

        if (!documento.DISTRIBUCION || !documento.DISTRIBUCION.Clientes ||
            Object.keys(documento.DISTRIBUCION.Clientes).length === 0) {
            await mostrarNotificacion('Error', `No hay clientes asignados para REC${rec}`, 'error');
            return;
        }

        const documentoEnTabla = documentosGlobales.find(doc => doc.rec === rec);
        if (!documentoEnTabla || !documentoEnTabla.colaborador || documentoEnTabla.colaborador.trim() === '') {
            await mostrarNotificacion('Error', `No hay responsable asignado para REC${rec}`, 'error');
            return;
        }

        const datosImpresion = {
            rec: rec,
            fecha: documento.FECHA || '',
            lote: documento.LOTE || '',
            refProv: documento.REFPROV || '',
            linea: documento.LINEA || '',
            cantidad: documento.CANTIDAD || 0,
            clientes: documento.DISTRIBUCION.Clientes,
            responsable: documentoEnTabla.colaborador
        };

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

function aplicarFiltroPorEstado(tipoFiltro) {
    console.log('Aplicando filtro por estado:', tipoFiltro);

    document.querySelectorAll('.resumen-card').forEach(card => {
        card.classList.remove('active');
    });

    if (filtroTarjetaActivo === tipoFiltro) {
        filtroTarjetaActivo = null;
        limpiarFiltroTarjetas();
        return;
    }

    const tarjeta = document.querySelector(`.resumen-card.${tipoFiltro}`);
    if (tarjeta) {
        tarjeta.classList.add('active');
    }

    filtroTarjetaActivo = tipoFiltro;

    if (!documentosTable) {
        console.warn('DataTable no inicializada');
        return;
    }

    let estadosFiltro = [];

    switch (tipoFiltro) {
        case 'pendientes':
            estadosFiltro = ['PENDIENTE'];
            break;
        case 'proceso':
            estadosFiltro = ['ELABORACION', 'PAUSADO'];
            break;
        case 'directos':
            estadosFiltro = ['DIRECTO'];
            break;
        case 'total':
            estadosFiltro = obtenerEstadosParaMostrar();
            break;
    }

    console.log('Estados del filtro:', estadosFiltro);

    // VERIFICAR QUE DATATABLES ESTÉ CARGADO ANTES DE USAR EXT
    if (!isDataTableLoaded()) {
        console.error('DataTables no está cargado para aplicar filtros');
        return;
    }

    // Aplicar filtro
    $.fn.dataTable.ext.search.push(
        function (settings, data, dataIndex) {
            const rowData = documentosTable.row(dataIndex).data();
            if (!rowData) return false;

            return estadosFiltro.includes(rowData.estado);
        }
    );

    // OBTENER NÚMERO DE DOCUMENTOS QUE COINCIDEN CON EL FILTRO
    const documentosFiltrados = documentosGlobales.filter(doc =>
        estadosFiltro.includes(doc.estado)
    );

    console.log(`Documentos que coinciden con el filtro: ${documentosFiltrados.length}`);

    // SOLO PARA EL FILTRO "EN PROCESO": SI HAY MÁS DE 5 DOCUMENTOS, MOSTRAR TODOS
    if (tipoFiltro === 'proceso' && documentosFiltrados.length > 5) {
        documentosTable.page.len(-1); // -1 muestra todos los registros
        console.log('Mostrando todos los documentos del filtro EN PROCESO');
    } else {
        // Para otros filtros o si son 5 o menos, usar la configuración por defecto
        documentosTable.page.len(5);
    }

    documentosTable.draw();

    const datosFiltrados = documentosTable.rows({ search: 'applied' }).data().toArray();
    const consolidadosFiltrados = calcularConsolidados(datosFiltrados);
    actualizarTarjetasResumen(consolidadosFiltrados, true);

    // Actualizar icono del filtro activo EN LAS TARJETAS
    actualizarIconoFiltroActivo();

    mostrarNotificacion(
        'Filtro aplicado',
        `Mostrando: ${obtenerNombreFiltro(tipoFiltro)} (${documentosFiltrados.length} documentos)`,
        'info'
    );
}

function limpiarFiltroTarjetas() {
    console.log('Limpiando filtro de tarjetas');

    filtroTarjetaActivo = null;

    document.querySelectorAll('.resumen-card').forEach(card => {
        card.classList.remove('active');
    });

    if (!documentosTable) return;

    // VERIFICAR QUE DATATABLES ESTÉ CARGADO ANTES DE USAR EXT
    if (!isDataTableLoaded()) {
        console.error('DataTables no está cargado para limpiar filtros');
        return;
    }

    // Remover filtros de estado
    $.fn.dataTable.ext.search = $.fn.dataTable.ext.search.filter(filter => {
        return filter.toString().includes('fecha_objeto') || filter.toString().includes('rangoFechasSeleccionado');
    });

    // RESTAURAR PAGINACIÓN POR DEFECTO (5 registros)
    documentosTable.page.len(5);
    documentosTable.draw();

    const consolidados = calcularConsolidados(documentosGlobales);
    actualizarTarjetasResumen(consolidados);

    // Limpiar icono del filtro activo EN LAS TARJETAS
    actualizarIconoFiltroActivo();

    mostrarNotificacion('Filtro limpiado', 'Mostrando todos los documentos', 'info');
}

// Función para actualizar el indicador de filtro activo en las tarjetas
function actualizarIconoFiltroActivo() {
    // Remover indicadores de todas las tarjetas primero
    document.querySelectorAll('.resumen-card').forEach(card => {
        const existingBadge = card.querySelector('.filtro-badge');
        if (existingBadge) {
            existingBadge.remove();
        }
        card.classList.remove('filtro-activo');
    });

    // Si hay filtro activo, agregar badge a la tarjeta correspondiente
    if (filtroTarjetaActivo) {
        const tarjetaActiva = document.querySelector(`.resumen-card.${filtroTarjetaActivo}`);
        if (tarjetaActiva) {
            tarjetaActiva.classList.add('filtro-activo');

            // Crear y agregar badge profesional
            const badge = document.createElement('div');
            badge.className = 'filtro-badge';
            badge.innerHTML = `
                <i class="fas fa-filter"></i>
                <span>Filtro activo</span>
            `;
            tarjetaActiva.querySelector('.resumen-text').appendChild(badge);
        }
    }
}

function obtenerNombreFiltro(tipoFiltro) {
    const nombres = {
        'pendientes': 'Pendientes',
        'proceso': 'En Proceso',
        'directos': 'Directos',
        'total': 'Total Activos'
    };
    return nombres[tipoFiltro] || tipoFiltro;
}

function inicializarTarjetasInteractivas() {
    console.log('Inicializando tarjetas interactivas...');

    // Remover event listeners anteriores para evitar duplicados
    document.querySelectorAll('.resumen-card').forEach(card => {
        card.replaceWith(card.cloneNode(true));
    });

    // Agregar nuevos event listeners
    document.querySelectorAll('.resumen-card').forEach(card => {
        card.addEventListener('click', function () {
            const tipo = Array.from(this.classList).find(cls =>
                ['pendientes', 'proceso', 'directos', 'total'].includes(cls)
            );

            if (tipo) {
                aplicarFiltroPorEstado(tipo);
            }
        });
    });

    console.log('Tarjetas interactivas inicializadas');
}

function aplicarFiltroFechaDataTable(fechaInicio, fechaFin) {
    console.log('Aplicando filtro de fecha en DataTable:', fechaInicio, fechaFin);

    if (!documentosTable) {
        console.warn('DataTable no inicializada');
        return;
    }

    rangoFechasSeleccionado = [fechaInicio, fechaFin];
    filtrosActivos.fecha = [fechaInicio, fechaFin];

    console.log('Rango normalizado:', rangoFechasSeleccionado);

    documentosTable.draw();

    const datosFiltrados = documentosTable.rows({ search: 'applied' }).data().toArray();
    console.log('Documentos después del filtro:', datosFiltrados.length);

    const consolidados = calcularConsolidados(datosFiltrados);
    actualizarTarjetasResumen(consolidados);

    Swal.fire({
        icon: 'success',
        title: 'Filtro aplicado',
        text: `Fechas: ${fechaInicio.toLocaleDateString()} - ${fechaFin.toLocaleDateString()}`,
        timer: 1500,
        showConfirmButton: false
    });
}

function limpiarFiltroFechaDataTable() {
    console.log('Limpiando filtro de fecha en DataTable');

    rangoFechasSeleccionado = null;
    filtrosActivos.fecha = null;

    if (documentosTable) {
        documentosTable.draw();

        const consolidados = calcularConsolidados(documentosGlobales);
        actualizarTarjetasResumen(consolidados);
    }
}

$(document).ready(function () {
    console.log('Inicializando documents-table.js');

    // VERIFICAR QUE DATATABLES ESTÉ CARGADO ANTES DE INICIALIZAR
    if (!isDataTableLoaded()) {
        console.error('DataTables no está cargado. Verifica que el script esté incluido correctamente.');
        // Reintentar después de un breve tiempo
        setTimeout(() => {
            if (isDataTableLoaded()) {
                console.log('DataTables cargado después del reintento');
                inicializarAplicacion();
            } else {
                console.error('DataTables no se cargó después del reintento');
            }
        }, 1000);
    } else {
        inicializarAplicacion();
    }

    function inicializarAplicacion() {
        const checkDataLoaded = setInterval(() => {
            if (typeof datosGlobales !== 'undefined') {
                clearInterval(checkDataLoaded);
                console.log('Datos globales disponibles, cargando tabla...');

                if (document.getElementById('filtroFecha')) {
                    window.flatpickrInstance = flatpickr("#filtroFecha", {
                        mode: "range",
                        dateFormat: "Y-m-d",
                        locale: "es",
                        onChange: function (selectedDates, dateStr) {
                            if (selectedDates.length === 2) {
                                aplicarFiltroFecha(selectedDates[0], selectedDates[1]);
                            } else if (selectedDates.length === 0) {
                                rangoFechasSeleccionado = null;
                                filtrosActivos.fecha = null;
                                if (documentosTable) {
                                    documentosTable.draw();
                                }
                            }
                        }
                    });
                }

                cargarTablaDocumentos();
            }
        }, 100);
    }
});

window.aplicarFiltroFechaDataTable = aplicarFiltroFechaDataTable;
window.limpiarFiltroFechaDataTable = limpiarFiltroFechaDataTable;
window.aplicarFiltroFecha = aplicarFiltroFechaDataTable;
window.limpiarFiltros = limpiarFiltroFechaDataTable;


window.cambiarResponsable = cambiarResponsable;
window.cambiarEstadoDocumento = cambiarEstadoDocumento;
window.restablecerDocumento = restablecerDocumento;
window.imprimirSoloClientesDesdeTabla = imprimirSoloClientesDesdeTabla;
window.actualizarInmediatamente = actualizarInmediatamente;
window.limpiarFiltros = limpiarFiltros;
window.toggleFinalizados = toggleFinalizados;
window.aplicarFiltroPorEstado = aplicarFiltroPorEstado;
window.limpiarFiltroTarjetas = limpiarFiltroTarjetas;
window.inicializarTarjetasInteractivas = inicializarTarjetasInteractivas;
// Al final del archivo, en la sección de exportaciones, AGREGA:
window.refrescarUI = refrescarUI;