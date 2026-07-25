// Configuración de DataTable para documentos disponibles
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
let filtroFacturadosActivo = false;

// ─── Configuración Supabase ───────────────────────────────────────────────────
const SUPABASE_URL_DT      = "https://iladaofarozipitwaeti.supabase.co";
const SUPABASE_ANON_KEY_DT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlsYWRhb2Zhcm96aXBpdHdhZXRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NjYzMDksImV4cCI6MjA5MzA0MjMwOX0.4fyiibeZS10DCgov62d7tIFVzJHsklsBrbokAJ9ptK8";
const SUPABASE_RPC_BASE    = `${SUPABASE_URL_DT}/rest/v1/rpc`;

// ─── Cliente Supabase para Realtime ──────────────────────────────────────────
let supabaseClient = null;
let realtimeChannel = null;

function inicializarSupabaseRealtime() {
    // Crear cliente solo si la lib está cargada
    if (typeof window.supabase === 'undefined') {
        console.warn('Supabase JS no cargado — Realtime deshabilitado');
        return;
    }

    supabaseClient = window.supabase.createClient(SUPABASE_URL_DT, SUPABASE_ANON_KEY_DT, {
        realtime: { params: { eventsPerSecond: 10 } }
    });

    // Suscribirse a cambios en la tabla distribuciones
    realtimeChannel = supabaseClient
        .channel('distribuciones-cambios')
        .on(
            'postgres_changes',
            {
                event:  '*',          // INSERT, UPDATE, DELETE
                schema: 'public',
                table:  'distribuciones',
            },
            (payload) => manejarCambioRealtime(payload)
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('✅ Realtime conectado — distribuciones');
                updateStatusIndicator('success');
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.warn('⚠️ Realtime error:', status);
                updateStatusIndicator('error');
            }
        });
}

// ─── Manejador de eventos Realtime ───────────────────────────────────────────

async function manejarCambioRealtime(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    const rec = String((newRecord?.id_distribucion || oldRecord?.id_distribucion) ?? '');

    if (!rec) return;

    const ESTADOS_ACTIVOS = ['PENDIENTE', 'DIRECTO', 'ELABORACION', 'PAUSADO'];

    if (eventType === 'DELETE') {
        // Eliminar fila de la tabla
        if (documentosTable) {
            const fila = documentosTable.row((idx, data) => data.rec === rec);
            if (fila.any()) {
                fila.remove().draw(false);
                if (timers[rec]) { clearInterval(timers[rec]); delete timers[rec]; }
            }
        }
        documentosGlobales = documentosGlobales.filter(d => d.rec !== rec);
        return;
    }

    const nuevoEstado = String(newRecord?.estado ?? '').toUpperCase();

    // Si pasó a FINALIZADO o TERMINADO → sacar de la tabla
    if (!ESTADOS_ACTIVOS.includes(nuevoEstado)) {
        if (documentosTable) {
            const fila = documentosTable.row((idx, data) => data.rec === rec);
            if (fila.any()) {
                fila.remove().draw(false);
                if (timers[rec]) { clearInterval(timers[rec]); delete timers[rec]; }
            }
        }
        documentosGlobales = documentosGlobales.filter(d => d.rec !== rec);

        const consolidados = calcularConsolidados(documentosGlobales);
        actualizarTarjetasResumen(consolidados);
        return;
    }

    // Para INSERT o UPDATE con estado activo → refrescar esa fila via Edge Function
    // Usamos un pequeño debounce para no saturar si llegan varios eventos seguidos
    clearTimeout(realtimeDebounce[rec]);
    realtimeDebounce[rec] = setTimeout(async () => {
        await actualizarFilaEspecifica(rec);

        // Reiniciar timer si pasó a ELABORACION
        if (nuevoEstado === 'ELABORACION') {
            if (!timers[rec]) {
                timers[rec] = setInterval(() => actualizarDuracionEnTabla(rec), 1000);
            }
        } else if (nuevoEstado === 'PAUSADO' || nuevoEstado === 'FINALIZADO') {
            if (timers[rec]) { clearInterval(timers[rec]); delete timers[rec]; }
        }
    }, 300);
}

// Debounce map por REC para no saturar con múltiples eventos simultáneos
const realtimeDebounce = {};

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

// ─── llamarAPI — reemplaza el Google Apps Script con RPCs de Supabase ────────
//
//  Acciones soportadas:
//    asignarResponsable  → sep_asignar_responsable(p_id, p_responsable)
//    pausar              → sep_pausar(p_id)
//    reanudar            → sep_reanudar(p_id)
//    finalizar           → sep_finalizar(p_id)
//    restablecer         → sep_restablecer(p_id)

async function llamarAPI(params) {
    const { action, id, responsable } = params;

    // Mapa action → nombre de RPC
    const rpcMap = {
        asignarResponsable: 'sep_asignar_responsable',
        pausar:             'sep_pausar',
        reanudar:           'sep_reanudar',
        finalizar:          'sep_finalizar',
        restablecer:        'sep_restablecer',
    };

    const rpcName = rpcMap[action];
    if (!rpcName) {
        return { success: false, message: `Acción desconocida: ${action}` };
    }

    // Construir body según la RPC
    let body = { p_id: String(id) };
    if (action === 'asignarResponsable') {
        body.p_responsable = responsable;
    }

    try {
        const response = await fetch(`${SUPABASE_RPC_BASE}/${rpcName}`, {
            method:  'POST',
            headers: {
                'Content-Type':  'application/json',
                'apikey':         SUPABASE_ANON_KEY_DT,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY_DT}`,
                'Prefer':         'return=representation',
            },
            body: JSON.stringify(body),
        });

        const raw = await response.json();

        if (!response.ok) {
            // Supabase devuelve { code, message, details, hint } en errores
            const msg = raw?.message || raw?.hint || `Error HTTP ${response.status}`;
            console.error(`RPC ${rpcName} error:`, raw);
            return { success: false, message: msg };
        }

        // Supabase devuelve el JSONB de la RPC directamente como objeto
        // Nuestras RPCs ya devuelven { success, message, data }
        const result = Array.isArray(raw) ? raw[0] : raw;
        return result ?? { success: true };

    } catch (error) {
        return {
            success: false,
            error:   error.message,
            message: 'Error de conexión con Supabase',
        };
    }
}

// ─── actualizarFilaEspecifica — usa la Edge Function para evitar RLS ─────────

async function actualizarFilaEspecifica(rec) {
    if (!documentosTable) return;

    try {
        // Llamar a la Edge Function con filtro por ID específico
        const response = await fetch(
            `${SUPABASE_URL_DT}/functions/v1/separacion-datos?id=${rec}`,
            {
                method:  'GET',
                headers: {
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY_DT}`,
                    'apikey':         SUPABASE_ANON_KEY_DT,
                },
            }
        );

        if (!response.ok) return;

        const json = await response.json();
        if (!json.success || !json.data || json.data.length === 0) return;

        const item = json.data[0];

        const documento   = String(item.DOCUMENTO || '').trim();
        const estado      = String(item.ESTADO    || '').trim().toUpperCase();
        const colaborador = String(item.COLABORADOR || '').trim();
        const fechaHora   = item.FECHA_DISTRIBUCION || item.FECHA || '';
        const fechaSolo   = formatearFechaSolo(fechaHora);
        const fechaObjeto = parsearFecha(fechaSolo);

        // Actualizar datosGlobales con el item fresco
        const indexGlobal = datosGlobales.findIndex(d => d.REC === documento);
        if (indexGlobal !== -1) {
            datosGlobales[indexGlobal] = { ...datosGlobales[indexGlobal], ...item };
        } else {
            datosGlobales.push(item);
        }
        window.printingDatosGlobales = datosGlobales;
        window.datosGlobales         = datosGlobales;

        const cantidadTotal = parseInt(item.CANTIDAD) || 0;

        // Extraer clientes y género
        let clientesList = [];
        if (item.DISTRIBUCION && item.DISTRIBUCION.Clientes) {
            clientesList = Object.keys(item.DISTRIBUCION.Clientes);
        } else if (item.CLIENTES) {
            clientesList = Object.keys(item.CLIENTES);
        }
        const cantClientes = clientesList.length;

        const documentoActualizado = {
            rec:            documento,
            estado:         estado,
            colaborador:    colaborador,
            fecha:          fechaSolo,
            fecha_completa: fechaHora,
            fecha_objeto:   fechaObjeto,
            cantidad:       cantidadTotal,
            lote:           item.LOTE    || '',
            refProv:        item.REFPROV || '',
            prenda:         item.PRENDA  || '',
            genero:         item.GENERO  || '',
            cantClientes:   cantClientes,
            clientesList:   clientesList,
            tieneClientes:  cantClientes > 0,
            datosCompletos:       item,
            datetime_inicio:      item.INICIO                  || '',
            datetime_fin:         item.FIN                     || '',
            duracion_guardada:    item.DURACION                || '',
            pausas:               item.PAUSAS                  || '',
            datetime_pausas:      item.DATETIME_ULTIMA_PAUSA   || '',
            duracion_pausas:      item.DURACION_PAUSAS         || '',
            tieneFactura:         item.TIENE_FACTURA     || false,
            nroFactura:           item.NRO_FACTURA       || '',
            facturasDetalle:      item.FACTURAS_DETALLE  || [],
        };

        // Actualizar en documentosGlobales
        const index = documentosGlobales.findIndex(d => d.rec === rec);
        if (index !== -1) {
            documentosGlobales[index] = documentoActualizado;
        } else {
            documentosGlobales.push(documentoActualizado);
        }

        const estadosParaMostrar = obtenerEstadosParaMostrar();
        const debeMostrarse      = estadosParaMostrar.includes(estado);

        const fila = documentosTable.row((idx, data) => data.rec === rec);

        if (fila.any()) {
            if (debeMostrarse) {
                fila.data(documentoActualizado).draw(false);
                const rowNode = fila.node();
                $(rowNode).removeClass('actualizando-fila');
                const selectCell = $(rowNode).find('td:eq(2)');
                selectCell.html(generarSelectResponsables(rec, colaborador, documentosGlobales, documentoActualizado));
            } else {
                fila.remove();
                if (timers[rec]) {
                    clearInterval(timers[rec]);
                    delete timers[rec];
                }
            }
        } else if (debeMostrarse) {
            documentosTable.row.add(documentoActualizado).draw(false);
        }

        const consolidados = calcularConsolidados(
            documentosGlobales.filter(doc => obtenerEstadosParaMostrar().includes(doc.estado))
        );
        actualizarTarjetasResumen(consolidados);

    } catch (error) {
        console.error('Error actualizando fila:', error);
    }
}

async function actualizarInmediatamente(forzarRecarga = false, recEspecifico = null, accion = null) {
    if (actualizacionEnProgreso && !forzarRecarga) {
        return;
    }

    if (forzarRecarga && !recEspecifico) {
        vaciarTablaCompletamente();
    }

    let estadoTabla = null;
    actualizacionEnProgreso = true;

    try {
        if (!forzarRecarga) {
            estadoTabla = guardarEstadoTabla();
        }

        if (forzarRecarga || !documentosTable) {
            // Si es forzado, recargar datos globales primero
            if (forzarRecarga && typeof window.cargarDatos === 'function') {
                await window.cargarDatos();
            }

            await cargarTablaDocumentos(); // Esta función ya inicializa las tarjetas
        } else {
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

    } catch (error) {
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
        if (typeof cargarDatos === 'function') {
            await cargarDatos();
            return true;
        } else {
            return false;
        }
    } catch (error) {
        return false;
    }
}

function formatearFechaSolo(fechaHoraStr) {
    if (!fechaHoraStr) return '-';

    try {
        // Acepta ISO 8601 (2026-07-08T14:04:21-05:00),
        // con espacio (2026-07-08 14:04:21) o solo fecha (2026-07-08)
        const d = new Date(fechaHoraStr);
        if (!isNaN(d.getTime())) {
            // Formatear como dd/mm/yyyy usando la fecha LOCAL del servidor
            // (extraemos de la cadena original para evitar problemas de TZ)
            const partesSolo = fechaHoraStr.split('T')[0].split(' ')[0]; // "2026-07-08"
            const [yyyy, mm, dd] = partesSolo.split('-');
            if (yyyy && mm && dd) return `${dd}/${mm}/${yyyy}`;
        }
        return fechaHoraStr;
    } catch (e) {
        return fechaHoraStr;
    }
}

function parsearFecha(fechaStr) {
    if (!fechaStr || fechaStr === '-') return null;

    try {
        // Acepta dd/mm/yyyy (formato de display) o yyyy-mm-dd (ISO)
        if (fechaStr.includes('/')) {
            const [dd, mm, yyyy] = fechaStr.split('/');
            if (!dd || !mm || !yyyy) return null;
            const fecha = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
            return isNaN(fecha.getTime()) ? null : fecha;
        }

        if (fechaStr.includes('-')) {
            const fecha = new Date(fechaStr);
            return isNaN(fecha.getTime()) ? null : fecha;
        }

        return null;
    } catch (e) {
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
                return false;
            }
        }
    );
}

function aplicarFiltroFecha(fechaInicio, fechaFin) {
    const inicio = new Date(fechaInicio);
    inicio.setHours(0, 0, 0, 0);

    const fin = new Date(fechaFin);
    fin.setHours(23, 59, 59, 999);

    rangoFechasSeleccionado = [inicio, fin];
    filtrosActivos.fecha = [fechaInicio, fechaFin];

    if (documentosTable) {
        documentosTable.draw();

        const datosFiltrados = documentosTable.rows({ search: 'applied' }).data().toArray();

        const consolidados = calcularConsolidados(datosFiltrados);
        actualizarTarjetasResumen(consolidados);
    }
}

function limpiarFiltros() {
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

// ─── cargarResponsables — lee de Supabase en vez de Sheets ──────────────────

async function cargarResponsables() {
    try {
        const response = await fetch(
            `${SUPABASE_URL_DT}/rest/v1/responsables?activo=eq.true&select=nombre&order=nombre.asc`,
            {
                headers: {
                    'apikey':         SUPABASE_ANON_KEY_DT,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY_DT}`,
                },
            }
        );

        if (!response.ok) throw new Error('Error al obtener responsables');

        const data = await response.json();
        listaResponsables = data.map(r => r.nombre).filter(n => n);
        return listaResponsables;

    } catch (error) {
        // Fallback por si Supabase no responde
        listaResponsables = [
            'NICOLE VALERIA MONCALEANO DIAZ',
            'KELLY TATIANA FERNANDEZ ASTUDILLO',
            'MARI YEINS MORENO GUERRERO',
            'KAROL VALENTINA MERCADO CORTES',
            'PAULA VANESSA SANCHEZ ERAZO',
            'YAMILETH ARDILA PASAJE',
            'ALVAREZ RAMOS JHON SEBASTIAN',
            'GUADIR OCAMPO KAROL FABIANA',
            'IBARGUEN ARROYO KEVIN JULIAN',
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

function toggleFacturados() {
    filtroFacturadosActivo = !filtroFacturadosActivo;
    const btn = document.getElementById('btnToggleFacturados');
    const modalText = document.getElementById('modalFacturadosText');

    if (btn) {
        if (filtroFacturadosActivo) {
            btn.classList.add('active');
            btn.style.background = '#10b981';
            btn.style.color = 'white';
            btn.style.borderColor = '#10b981';
            btn.innerHTML = '<i class="fas fa-file-invoice-dollar"></i><span class="hide-xs"> Todos</span>';
        } else {
            btn.classList.remove('active');
            btn.style.background = '';
            btn.style.color = '';
            btn.style.borderColor = '';
            btn.innerHTML = '<i class="fas fa-file-invoice-dollar"></i><span class="hide-xs"> Facturados</span>';
        }
    }

    if (modalText) {
        modalText.textContent = filtroFacturadosActivo ? 'Mostrar Todos' : 'Solo Facturados';
    }

    aplicarFiltroFacturados();
}

function ejecutarToggleFacturados() {
    cerrarModalControles();
    toggleFacturados();
}

function aplicarFiltroFacturados() {
    if (!documentosTable) return;

    // Limpiar filtros de facturados existentes
    $.fn.dataTable.ext.search = $.fn.dataTable.ext.search.filter(function(searchFunc) {
        return searchFunc.name !== 'filtroFacturados';
    });

    // Si el filtro está activo, agregar el nuevo filtro
    if (filtroFacturadosActivo) {
        const filtroFacturados = function(settings, data, dataIndex) {
            const rowData = documentosTable.row(dataIndex).data();
            return rowData && rowData.tieneFactura === true;
        };
        filtroFacturados.name = 'filtroFacturados';
        $.fn.dataTable.ext.search.push(filtroFacturados);
    }

    documentosTable.draw();

    // Actualizar tarjetas con los datos filtrados
    const datosFiltrados = documentosTable.rows({ search: 'applied' }).data().toArray();
    const consolidados = calcularConsolidados(datosFiltrados);
    actualizarTarjetasResumen(consolidados, true);
}

async function cargarTablaDocumentos() {
    try {
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

        const consolidados = calcularConsolidados(documentosDisponibles);
        actualizarTarjetasResumen(consolidados);

        if (documentosDisponibles.length > 0) {
            inicializarDataTable(documentosDisponibles);
            poblarFiltrosDinamicos(documentosDisponibles);

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
                        <th>Clientes</th>
                        <th>Género</th>
                        <th>Prenda</th>
                        <th>Lote</th>
                        <th>RefProv</th>
                        <th>Factura</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td colspan="13" class="text-center text-muted py-4">
                            No se encontraron documentos
                        </td>
                    </tr>
                </tbody>
            `);
        }

        if (loader) {
            loader.style.display = 'none';
        }

        // Inicializar Realtime la primera vez que carga la tabla
        if (!realtimeChannel) {
            inicializarSupabaseRealtime();
        }

    } catch (error) {
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
                    <th>Clientes</th>
                    <th>Género</th>
                    <th>Prenda</th>
                    <th>Lote</th>
                    <th>RefProv</th>
                    <th>Factura</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td colspan="13" class="text-center text-danger py-4">
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
            await window.loaderPromise;
        }

        // Usar los datos globales cargados por main.js
        let values = window.datosTablaDocumentos || [];

        // Si por alguna razón no hay datos, intentar cargarlos (fallback)
        if (!values || values.length === 0) {
            if (typeof window.cargarDatos === 'function') {
                await window.cargarDatos();
                values = window.datosTablaDocumentos || [];
            }
        }

        if (!values || values.length === 0) {
            return [];
        }

        const datosGlobalesMap = {};
        if (datosGlobales && datosGlobales.length > 0) {
            datosGlobales.forEach(item => {
                if (item.REC) {
                    datosGlobalesMap[item.REC] = item;
                }
            });
        } else {
            // datosGlobales está vacío o no disponible
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
                const cantidadTotal = datosCompletos ? calcularCantidadTotal({ rec: documento, datosCompletos }) : 0;

                let clientesList = [];
                if (datosCompletos && datosCompletos.DISTRIBUCION && datosCompletos.DISTRIBUCION.Clientes) {
                    clientesList = Object.keys(datosCompletos.DISTRIBUCION.Clientes);
                } else if (datosCompletos && datosCompletos.CLIENTES) {
                    clientesList = Object.keys(datosCompletos.CLIENTES);
                }
                const cantClientes = clientesList.length;

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
                    genero: datosCompletos ? (datosCompletos.GENERO || '') : '',
                    cantClientes: cantClientes,
                    clientesList: clientesList,
                    tieneClientes: cantClientes > 0,
                    datosCompletos: datosCompletos,
                    datetime_inicio: datetime_inicio,
                    datetime_fin: datetime_fin,
                    duracion_guardada: duracion_guardada,
                    pausas: pausas,
                    datetime_pausas: datetime_pausas,
                    duracion_pausas: duracion_pausas,
                    tieneFactura: datosCompletos ? (datosCompletos.TIENE_FACTURA || false) : false,
                    nroFactura: datosCompletos ? (datosCompletos.NRO_FACTURA || '') : '',
                    facturasDetalle: datosCompletos ? (datosCompletos.FACTURAS_DETALLE || []) : [],
                };
            })
            .filter(doc => doc.rec && estadosParaMostrar.includes(doc.estado));

        return documentosProcesados;

    } catch (error) {
        throw error;
    }
}

async function cambiarResponsable(rec, responsable) {
    if (actualizacionEnProgreso) {
        return;
    }

    try {
        actualizacionEnProgreso = true;

        vaciarTablaCompletamente();

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

            await actualizarDatosGlobales();
            await cargarTablaDocumentos();

        } else {
            await mostrarNotificacion('Error', result.message || 'Error al asignar responsable', 'error');
            await cargarTablaDocumentos();
        }
    } catch (error) {
        Swal.close();
        await mostrarNotificacion('Error', 'Error al asignar responsable: ' + error.message, 'error');
        await cargarTablaDocumentos();
    } finally {
        actualizacionEnProgreso = false;
    }
}

function vaciarTablaCompletamente() {
    // Destruir DataTable si existe
    if (documentosTable) {
        documentosTable.destroy();
        documentosTable = null;
    }

    // Limpiar contenido y mostrar solo headers - PERO NO AFECTAR TARJETAS
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
                    <th>Clientes</th>
                    <th>Género</th>
                    <th>Prenda</th>
                    <th>Lote</th>
                    <th>RefProv</th>
                    <th>Factura</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td colspan="13" class="text-center text-muted py-4">
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

async function cambiarEstadoDocumento(rec, nuevoEstado) {
    if (actualizacionEnProgreso) {
        return;
    }

    try {
        const documentoActual = documentosGlobales.find(doc => doc.rec === rec);
        const estadoActual = documentoActual ? documentoActual.estado : '';

        if (nuevoEstado === 'FINALIZADO' && estadoActual === 'PAUSADO') {
            const confirmar = await mostrarConfirmacion(
                '¿Finalizar documento desde estado PAUSADO?',
                `REC${rec} se encuentra actualmente PAUSADO. ¿Continuar?`,
                'warning'
            );

            if (!confirmar) return;

            marcarFilaComoActualizando(rec);
            actualizacionEnProgreso = true;

            const loadingToast = Swal.fire({
                title: 'Finalizando...',
                text: `REC${rec}`,
                icon: 'info',
                position: 'center',
                showConfirmButton: false,
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });

            // Una sola llamada — sep_finalizar maneja el estado PAUSADO internamente
            const resultFinalizar = await llamarAPI({
                action: 'finalizar',
                id: rec
            });

            Swal.close();

            if (resultFinalizar.success) {
                if (timers[rec]) { clearInterval(timers[rec]); delete timers[rec]; }
                await mostrarNotificacion('✓ Finalizado', `REC${rec} completado`, 'success');
                await actualizarInmediatamente(true);
            } else {
                await mostrarNotificacion('Error', 'Error al finalizar: ' + (resultFinalizar.message || 'Error desconocido'), 'error');
                await actualizarFilaEspecifica(rec);
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

            // Para FINALIZADO: recargar completa
            actualizacionEnProgreso = true;

            const loadingToast = Swal.fire({
                title: 'Finalizando...',
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
                action: 'finalizar',
                id: rec
            });

            Swal.close();

            if (result.success) {
                if (timers[rec]) {
                    clearInterval(timers[rec]);
                    delete timers[rec];
                }

                await mostrarNotificacion('✓ Finalizado', `REC${rec} completado`, 'success');

                // RECARGAR COMPLETA PARA FINALIZADO
                await actualizarInmediatamente(true);

            } else {
                await mostrarNotificacion('Error', 'Error al finalizar: ' + (result.message || 'Error desconocido'), 'error');
                await actualizarInmediatamente(true);
            }

            actualizacionEnProgreso = false;
            return;
        }

        // Para otros estados (PAUSADO, ELABORACION): actualización parcial
        marcarFilaComoActualizando(rec);

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
            default:
                Swal.close();
                await mostrarNotificacion('Error', 'Estado no válido', 'error');
                await actualizarFilaEspecifica(rec);
                actualizacionEnProgreso = false;
                return;
        }

        const result = await llamarAPI({
            action: action,
            id: rec
        });

        Swal.close();

        if (result.success) {
            if (nuevoEstado === 'PAUSADO') {
                if (timers[rec]) {
                    clearInterval(timers[rec]);
                    delete timers[rec];
                }
            }

            await mostrarNotificacion('✓ Actualizado', `${nuevoEstado}`, 'success');

            // ACTUALIZACIÓN PARCIAL (solo la fila)
            await actualizarFilaEspecifica(rec);
            await actualizarDatosGlobales();

        } else {
            await mostrarNotificacion('Error', result.message || 'Error al cambiar estado', 'error');
            await actualizarFilaEspecifica(rec);
        }
    } catch (error) {
        Swal.close();
        await mostrarNotificacion('Error', 'Error al cambiar estado: ' + error.message, 'error');

        // Si hay error, recargar completa
        await actualizarInmediatamente(true);
    } finally {
        actualizacionEnProgreso = false;
    }
}

function marcarFilaComoActualizando(rec) {
    if (!documentosTable) return;

    const fila = documentosTable.row((idx, data) => data.rec === rec);
    if (!fila.any()) return;

    const rowNode = fila.node();
    $(rowNode).addClass('actualizando-fila');

    // Celda de estado
    const celdaEstado = $(rowNode).find('td:eq(1)');

    // Indicador sutil sin spinner
    celdaEstado.html(`
        <span class="text-muted small fst-italic">Actualizando…</span>
    `);
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

            // RECARGAR COMPLETA PARA RESTABLECER
            await actualizarInmediatamente(true);

        } else {
            await mostrarNotificacion('Error', result.message || 'Error al restablecer', 'error');
            await actualizarInmediatamente(true);
        }
    } catch (error) {
        Swal.close();
        await mostrarNotificacion('Error', 'Error al restablecer documento: ' + error.message, 'error');
        await actualizarInmediatamente(true);
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
    // Para DIRECTO, el cliente está implícito (100% a 1 cliente); también verificar tieneClientes normal
    const tieneClientes = data.tieneClientes || data.estado === 'DIRECTO';
    const puedeImprimir = tieneColaborador && tieneClientes;

    let botonesEstado = '';

    const puedePausar = data.estado !== 'DIRECTO';

    const botonImprimir = `
        <button class="btn ${puedeImprimir ? 'btn-primary' : 'btn-secondary'}" 
                ${puedeImprimir ? '' : 'disabled'}
                onclick="imprimirTodoDesdeTabla('${data.rec}')"
                title="${puedeImprimir ? 'Imprimir todas las plantillas' : 'No se puede imprimir'}">
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

// ===== FILTROS AVANZADOS DINÁMICOS (CLIENTES, GÉNERO, PRENDA) =====
let filtrosAvanzadosTabla = {
    cliente: '',
    genero: '',
    prenda: ''
};

function evaluarFiltrosAvanzadosTabla(settings, data, dataIndex, rowData) {
    const row = rowData || (settings && settings.aoData && settings.aoData[dataIndex] ? settings.aoData[dataIndex]._aData : null);
    if (!row) return true;

    // 1. Filtro Cliente
    if (filtrosAvanzadosTabla.cliente) {
        const targetCliente = filtrosAvanzadosTabla.cliente.toLowerCase().trim();
        const tieneCliente = Array.isArray(row.clientesList) &&
            row.clientesList.some(c => String(c).toLowerCase().trim() === targetCliente);
        if (!tieneCliente) return false;
    }

    // 2. Filtro Género
    if (filtrosAvanzadosTabla.genero) {
        const targetGenero = filtrosAvanzadosTabla.genero.toLowerCase().trim();
        const rowGenero = String(row.genero || '').toLowerCase().trim();
        if (rowGenero !== targetGenero) return false;
    }

    // 3. Filtro Prenda
    if (filtrosAvanzadosTabla.prenda) {
        const targetPrenda = filtrosAvanzadosTabla.prenda.toLowerCase().trim();
        const rowPrenda = String(row.prenda || '').toLowerCase().trim();
        if (rowPrenda !== targetPrenda) return false;
    }

    return true;
}

function poblarFiltrosDinamicos(documentos) {
    if (!documentos || !Array.isArray(documentos)) return;

    // Actualizar badge de conteo total
    const $badgeTotal = $('#totalDocsCountBadge');
    if ($badgeTotal.length) {
        $badgeTotal.text(`${documentos.length} ${documentos.length === 1 ? 'doc' : 'docs'}`);
    }

    const selectCliente = document.getElementById('filtroCliente');
    const selectGenero  = document.getElementById('filtroGenero');
    const selectPrenda  = document.getElementById('filtroPrenda');

    if (!selectCliente || !selectGenero || !selectPrenda) return;

    const clienteActual = selectCliente.value || '';
    const generoActual  = selectGenero.value  || '';
    const prendaActual  = selectPrenda.value  || '';

    const clientesMap = {};
    const generosMap  = {};
    const prendasMap  = {};

    documentos.forEach(doc => {
        // Clientes
        if (doc.clientesList && Array.isArray(doc.clientesList)) {
            doc.clientesList.forEach(cli => {
                const cTrim = String(cli || '').trim();
                if (cTrim) {
                    clientesMap[cTrim] = (clientesMap[cTrim] || 0) + 1;
                }
            });
        }

        // Género
        const gTrim = String(doc.genero || '').trim();
        if (gTrim) {
            generosMap[gTrim] = (generosMap[gTrim] || 0) + 1;
        }

        // Prenda
        const pTrim = String(doc.prenda || '').trim();
        if (pTrim) {
            prendasMap[pTrim] = (prendasMap[pTrim] || 0) + 1;
        }
    });

    // 1. Poblar Clientes
    const clientesOrdenados = Object.keys(clientesMap).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    selectCliente.innerHTML = '<option value="">Todos los Clientes</option>';
    clientesOrdenados.forEach(cli => {
        const count = clientesMap[cli];
        const option = document.createElement('option');
        option.value = cli;
        option.textContent = `${cli} (${count})`;
        if (cli === clienteActual) option.selected = true;
        selectCliente.appendChild(option);
    });

    // 2. Poblar Géneros
    const generosOrdenados = Object.keys(generosMap).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    selectGenero.innerHTML = '<option value="">Todos los Géneros</option>';
    generosOrdenados.forEach(gen => {
        const count = generosMap[gen];
        const option = document.createElement('option');
        option.value = gen;
        option.textContent = `${gen} (${count})`;
        if (gen === generoActual) option.selected = true;
        selectGenero.appendChild(option);
    });

    // 3. Poblar Prendas
    const prendasOrdenadas = Object.keys(prendasMap).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    selectPrenda.innerHTML = '<option value="">Todas las Prendas</option>';
    prendasOrdenadas.forEach(pre => {
        const count = prendasMap[pre];
        const option = document.createElement('option');
        option.value = pre;
        option.textContent = `${pre} (${count})`;
        if (pre === prendaActual) option.selected = true;
        selectPrenda.appendChild(option);
    });
}

function aplicarFiltrosAvanzadosTabla() {
    const valCliente = $('#filtroCliente').val() || '';
    const valGenero  = $('#filtroGenero').val() || '';
    const valPrenda  = $('#filtroPrenda').val() || '';

    filtrosAvanzadosTabla = {
        cliente: valCliente,
        genero: valGenero,
        prenda: valPrenda
    };


    const hayFiltros = Boolean(valCliente || valGenero || valPrenda);
    if (hayFiltros) {
        $('#btnResetFiltrosTabla').removeClass('d-none');
    } else {
        $('#btnResetFiltrosTabla').addClass('d-none');
    }

    if (documentosTable) {
        if (!$.fn.dataTable.ext.search.includes(evaluarFiltrosAvanzadosTabla)) {
            $.fn.dataTable.ext.search.push(evaluarFiltrosAvanzadosTabla);
        }

        documentosTable.draw();

        const datosFiltrados = documentosTable.rows({ search: 'applied' }).data().toArray();
        const consolidadosFiltrados = calcularConsolidados(datosFiltrados);
        actualizarTarjetasResumen(consolidadosFiltrados, hayFiltros);
    }
}

function limpiarFiltrosAvanzadosTabla() {
    $('#filtroCliente').val('');
    $('#filtroGenero').val('');
    $('#filtroPrenda').val('');
    aplicarFiltrosAvanzadosTabla();
}

// ===== ORDENAMIENTO POR ANTIGÜEDAD =====
let ordenAntiguedadEstado = 'none'; // 'none' | 'asc' (más viejos primero) | 'desc' (más recientes primero)

function ordenarPorAntiguedad(direccionForzada) {
    if (!documentosTable) return;

    let nuevaDireccion = direccionForzada;
    if (!nuevaDireccion) {
        if (ordenAntiguedadEstado === 'asc') {
            nuevaDireccion = 'desc';
        } else if (ordenAntiguedadEstado === 'desc') {
            nuevaDireccion = 'none';
        } else {
            nuevaDireccion = 'asc';
        }
    }

    ordenAntiguedadEstado = nuevaDireccion;
    actualizarBotonSortAntiguedadUI();

    if (ordenAntiguedadEstado === 'asc') {
        // Ordenar por fecha asc (lo más viejo primero) y REC asc secundario
        documentosTable.order([[3, 'asc'], [0, 'asc']]).draw();
    } else if (ordenAntiguedadEstado === 'desc') {
        // Ordenar por fecha desc (lo más reciente primero) y REC desc secundario
        documentosTable.order([[3, 'desc'], [0, 'desc']]).draw();
    } else {
        // Restablecer a orden por defecto (Responsable asc)
        documentosTable.order([[2, 'asc']]).draw();
    }
}

function actualizarBotonSortAntiguedadUI() {
    const $btn = $('#btnSortAntiguedad');
    const $icon = $('#iconSortAntiguedad');
    const $label = $('#labelSortAntiguedad');

    if ($btn.length === 0) return;

    if (ordenAntiguedadEstado === 'asc') {
        $btn.addClass('active').attr('title', 'Ordenado por antigüedad: más viejos primero. Clic para ver más recientes.');
        $icon.attr('class', 'fas fa-arrow-up-wide-short filter-pill-icon');
        $label.text('Más Viejos');
    } else if (ordenAntiguedadEstado === 'desc') {
        $btn.addClass('active').attr('title', 'Ordenado por antigüedad: más recientes primero. Clic para quitar orden.');
        $icon.attr('class', 'fas fa-arrow-down-wide-short filter-pill-icon');
        $label.text('Más Recientes');
    } else {
        $btn.removeClass('active').attr('title', 'Ordenar por antigüedad (lo más viejo primero)');
        $icon.attr('class', 'fas fa-clock filter-pill-icon');
        $label.text('Antigüedad');
    }

    const $modalText = $('#modalSortText');
    if ($modalText.length) {
        if (ordenAntiguedadEstado === 'asc') {
            $modalText.text('Antigüedad: Más Viejos Primero');
        } else if (ordenAntiguedadEstado === 'desc') {
            $modalText.text('Antigüedad: Más Recientes Primero');
        } else {
            $modalText.text('Ordenar por Antigüedad');
        }
    }
}

function ejecutarSortAntiguedad() {
    const controlsModal = bootstrap.Modal.getInstance(document.getElementById('controlsModal'));
    if (controlsModal) {
        controlsModal.hide();
    }
    ordenarPorAntiguedad();
}

window.poblarFiltrosDinamicos = poblarFiltrosDinamicos;
window.aplicarFiltrosAvanzadosTabla = aplicarFiltrosAvanzadosTabla;
window.limpiarFiltrosAvanzadosTabla = limpiarFiltrosAvanzadosTabla;
window.ordenarPorAntiguedad = ordenarPorAntiguedad;
window.ejecutarSortAntiguedad = ejecutarSortAntiguedad;


function inicializarDataTable(documentos) {
    // VERIFICAR QUE DATATABLES ESTÉ CARGADO ANTES DE INICIALIZAR
    if (!isDataTableLoaded()) {
        setTimeout(() => {
            if (isDataTableLoaded()) {
                inicializarDataTable(documentos);
            }
        }, 500);
        return;
    }

    const table = $('#documentosTable');

    // MANTENER Y REGISTRAR EL EVALUADOR DE FILTROS AVANZADOS
    $.fn.dataTable.ext.search = $.fn.dataTable.ext.search.filter(f => f !== evaluarFiltrosAvanzadosTabla);
    $.fn.dataTable.ext.search.push(evaluarFiltrosAvanzadosTabla);

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
                    if (type === 'sort' || type === 'type') {
                        if (row.fecha_objeto && row.fecha_objeto instanceof Date && !isNaN(row.fecha_objeto.getTime())) {
                            return row.fecha_objeto.getTime();
                        }
                        if (row.fecha_completa) {
                            const parsed = Date.parse(row.fecha_completa);
                            if (!isNaN(parsed)) return parsed;
                        }
                        if (typeof data === 'string' && data.includes('/')) {
                            const parts = data.split('/');
                            if (parts.length === 3) {
                                return parts[2] + parts[1].padStart(2, '0') + parts[0].padStart(2, '0');
                            }
                        }
                        const recNum = parseInt(row.rec, 10);
                        return !isNaN(recNum) ? recNum : 0;
                    }
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
                    return data ? `<span class="fw-semibold text-body">${data}</span>` : '-';
                }
            },
            {
                data: null,
                render: function (data, type, row) {
                    const cant = row.cantClientes || 0;
                    const lista = row.clientesList && row.clientesList.length > 0 ? row.clientesList.join(', ') : 'Sin clientes';
                    if (cant === 0) {
                        return `<span class="badge badge-tabla-simetrico badge-clientes-grey" title="Sin clientes asignados"><i class="fas fa-user-slash"></i>0</span>`;
                    }
                    return `<span class="badge badge-tabla-simetrico badge-clientes-grey" title="Clientes (${cant}): ${lista}"><i class="fas fa-users"></i>${cant} ${cant === 1 ? 'cliente' : 'clientes'}</span>`;
                }
            },
            {
                data: 'genero',
                render: function (data) {
                    if (!data) return '<span class="text-muted small">-</span>';
                    const rawUpper = String(data).toUpperCase();

                    let iconClass = 'fa-venus-mars';
                    let badgeClass = 'bg-secondary-subtle text-secondary';

                    // HOMBRE, NIÑO / NINO, MASCULINO, BOY(S) -> AZUL
                    if (rawUpper.includes('HOMBRE') || rawUpper.includes('NIÑO') || rawUpper.includes('NINO') || rawUpper.includes('MASCULINO') || rawUpper.includes('BOY') || rawUpper === 'M') {
                        iconClass = (rawUpper.includes('NIÑ') || rawUpper.includes('NIN') || rawUpper.includes('BOY')) ? 'fa-child' : 'fa-mars';
                        badgeClass = 'badge-genero-azul';
                    }
                    // DAMA, MUJER, NIÑA / NINA, FEMENINO, GIRL(S) -> ROSADO
                    else if (rawUpper.includes('DAMA') || rawUpper.includes('MUJER') || rawUpper.includes('NIÑA') || rawUpper.includes('NINA') || rawUpper.includes('FEMENINO') || rawUpper.includes('GIRL') || rawUpper === 'F') {
                        iconClass = (rawUpper.includes('NIÑ') || rawUpper.includes('NIN') || rawUpper.includes('GIRL')) ? 'fa-child-dress' : 'fa-venus';
                        badgeClass = 'badge-genero-rosado';
                    }
                    // UNISEX
                    else if (rawUpper.includes('UNISEX')) {
                        iconClass = 'fa-genderless';
                        badgeClass = 'badge-genero-unisex';
                    }

                    return `<span class="badge badge-tabla-simetrico ${badgeClass}" title="Género: ${data}"><i class="fas ${iconClass}"></i>${data}</span>`;
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
                    if (data.tieneFactura) {
                        return `<span class="badge badge-tabla-simetrico badge-factura-si" title="Factura: ${data.nroFactura}"><i class="fas fa-check"></i><span class="hide-xs">Facturado</span></span>`;
                    } else {
                        return `<span class="badge badge-tabla-simetrico badge-factura-no" title="Sin factura"><i class="fas fa-times"></i><span class="hide-xs">Sin factura</span></span>`;
                    }
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
            "decimal": "",
            "emptyTable": "No hay datos disponibles en la tabla",
            "info": "Mostrando _START_ a _END_ de _TOTAL_ registros",
            "infoEmpty": "Mostrando 0 a 0 de 0 registros",
            "infoFiltered": "(filtrado de _MAX_ registros totales)",
            "infoPostFix": "",
            "thousands": ",",
            "lengthMenu": "Mostrar _MENU_ registros",
            "loadingRecords": "Cargando...",
            "processing": "Procesando...",
            "search": "Buscar:",
            "zeroRecords": "No se encontraron registros coincidentes",
            "paginate": {
                "first": "Primero",
                "last": "Último",
                "next": "Siguiente",
                "previous": "Anterior"
            },
            "aria": {
                "sortAscending": ": activar para ordenar la columna de manera ascendente",
                "sortDescending": ": activar para ordenar la columna de manera descendente"
            }
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
                    '<tr><td colspan="13" class="text-center text-muted py-4">No se encontraron documentos</td></tr>'
                );
            }

            if (filtrosActivos.busqueda) {
                api.search(filtrosActivos.busqueda).draw();
            }
        }
    });

    configurarFiltroFecha();
    actualizarBotonSortAntiguedadUI();

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
}

/**
 * Imprime todas las plantillas de clientes de un REC directamente a la impresora
 * Abre una pestaña por cliente, cada una dispara window.print() automáticamente.
 * Cuando el usuario termina con una, se abre la siguiente.
 */
function imprimirTodoDesdeTabla(rec) {
    const pool = (window.printingDatosGlobales && window.printingDatosGlobales.length > 0)
        ? window.printingDatosGlobales
        : (window.datosGlobales && window.datosGlobales.length > 0 ? window.datosGlobales : []);

    const datos = pool.find(item => String(item.REC) === String(rec));

    if (!datos) {
        Swal.fire({ icon: 'error', title: 'Error', text: `No se encontró REC${rec}`, timer: 2000, showConfirmButton: false });
        return;
    }

    const clientesObj = (datos.DISTRIBUCION && datos.DISTRIBUCION.Clientes &&
        Object.keys(datos.DISTRIBUCION.Clientes).length > 0)
        ? datos.DISTRIBUCION.Clientes
        : (datos.CLIENTES || {});

    const clientes = Object.keys(clientesObj);

    if (clientes.length === 0) {
        Swal.fire({ icon: 'warning', title: 'Sin clientes', text: `REC${rec} no tiene clientes asignados`, timer: 2000, showConfirmButton: false });
        return;
    }

    if (typeof print_generarDocumentoCompleto !== 'function') {
        alert('Error: Función de impresión no disponible');
        return;
    }

    // Abrir la primera pestaña directamente (en el tick del click del usuario)
    // Las siguientes se encadenan via window._imprimirSiguiente cuando cada una termina
    let index = 0;

    function abrirSiguiente() {
        if (index >= clientes.length) {
            delete window._imprimirSiguiente;
            return;
        }

        const cliente = clientes[index];
        index++;

        // Registrar el callback ANTES de abrir la ventana
        window._imprimirSiguiente = abrirSiguiente;

        const html = print_generarDocumentoCompleto(datos, { modo: 'cliente', clienteNombre: cliente }, true);

        const ventana = window.open('', '_blank');
        if (!ventana) {
            alert('El navegador bloqueó una ventana emergente. Permite popups para este sitio.');
            return;
        }
        ventana.document.write(html);
        ventana.document.close();
    }

    abrirSiguiente();
}

window.imprimirTodoDesdeTabla = imprimirTodoDesdeTabla;

async function imprimirSoloClientesDesdeTabla(rec) {
    try {
        const documento = datosGlobales.find(doc => doc.REC === rec);

        if (!documento) {
            await mostrarNotificacion('Error', `No se encontró el documento REC${rec} en datos globales`, 'error');
            return;
        }

        // Obtener clientes desde DISTRIBUCION.Clientes o CLIENTES directamente
        const clientes = (documento.DISTRIBUCION && documento.DISTRIBUCION.Clientes &&
            Object.keys(documento.DISTRIBUCION.Clientes).length > 0)
            ? documento.DISTRIBUCION.Clientes
            : documento.CLIENTES || null;

        if (!clientes || Object.keys(clientes).length === 0) {
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
            clientes: clientes,
            responsable: documentoEnTabla.colaborador
        };

        if (typeof imprimirSoloClientes === 'function') {
            imprimirSoloClientes(datosImpresion);
            await mostrarNotificacion('Éxito', `Imprimiendo REC${rec}`, 'success');
        } else {
            await mostrarNotificacion('Error', 'Función de impresión no disponible', 'error');
        }

    } catch (error) {
        await mostrarNotificacion('Error', 'Error al preparar la impresión: ' + error.message, 'error');
    }
}

function aplicarFiltroPorEstado(tipoFiltro) {
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

    // VERIFICAR QUE DATATABLES ESTÉ CARGADO ANTES DE USAR EXT
    if (!isDataTableLoaded()) {
        return;
    }

    // Remover filtros de estado previos manteniendo la función de filtros avanzados y fechas
    $.fn.dataTable.ext.search = $.fn.dataTable.ext.search.filter(filter => {
        return filter === evaluarFiltrosAvanzadosTabla || filter.name === 'evaluarFiltrosAvanzadosTabla' || filter.toString().includes('fecha_objeto') || filter.toString().includes('rangoFechasSeleccionado');
    });

    // Aplicar filtro de estado
    $.fn.dataTable.ext.search.push(
        function evaluarFiltroEstado(settings, data, dataIndex, rowData) {
            const row = rowData || (settings && settings.aoData && settings.aoData[dataIndex] ? settings.aoData[dataIndex]._aData : null);
            if (!row) return false;

            return estadosFiltro.includes(row.estado);
        }
    );

    // OBTENER NÚMERO DE DOCUMENTOS QUE COINCIDEN CON EL FILTRO
    const documentosFiltrados = documentosGlobales.filter(doc =>
        estadosFiltro.includes(doc.estado)
    );

    // SOLO PARA EL FILTRO "EN PROCESO": SI HAY MÁS DE 5 DOCUMENTOS, MOSTRAR TODOS
    if (tipoFiltro === 'proceso' && documentosFiltrados.length > 5) {
        documentosTable.page.len(-1); // -1 muestra todos los registros
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
    filtroTarjetaActivo = null;

    document.querySelectorAll('.resumen-card').forEach(card => {
        card.classList.remove('active');
    });

    if (!documentosTable) return;

    // VERIFICAR QUE DATATABLES ESTÉ CARGADO ANTES DE USAR EXT
    if (!isDataTableLoaded()) {
        return;
    }

    // Remover filtros de estado manteniendo los filtros avanzados y fechas
    $.fn.dataTable.ext.search = $.fn.dataTable.ext.search.filter(filter => {
        return filter === evaluarFiltrosAvanzadosTabla || filter.name === 'evaluarFiltrosAvanzadosTabla' || filter.toString().includes('fecha_objeto') || filter.toString().includes('rangoFechasSeleccionado');
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
}

function aplicarFiltroFechaDataTable(fechaInicio, fechaFin) {
    if (!documentosTable) {
        return;
    }

    rangoFechasSeleccionado = [fechaInicio, fechaFin];
    filtrosActivos.fecha = [fechaInicio, fechaFin];

    documentosTable.draw();

    const datosFiltrados = documentosTable.rows({ search: 'applied' }).data().toArray();

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
    rangoFechasSeleccionado = null;
    filtrosActivos.fecha = null;

    if (documentosTable) {
        documentosTable.draw();

        const consolidados = calcularConsolidados(documentosGlobales);
        actualizarTarjetasResumen(consolidados);
    }
}

$(document).ready(function () {
    // VERIFICAR QUE DATATABLES ESTÉ CARGADO ANTES DE INICIALIZAR
    if (!isDataTableLoaded()) {
        // Reintentar después de un breve tiempo
        setTimeout(() => {
            if (isDataTableLoaded()) {
                inicializarAplicacion();
            }
        }, 1000);
    } else {
        inicializarAplicacion();
    }

    function inicializarAplicacion() {
        const checkDataLoaded = setInterval(() => {
            if (typeof datosGlobales !== 'undefined') {
                clearInterval(checkDataLoaded);

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

// ─── BÚSQUEDA DE FINALIZADOS ─────────────────────────────────────────────────
//
//  Flujo:
//    1. El usuario ingresa un número de OP (REC) o un Lote
//    2. Se busca en la tabla `ingresos` de Supabase para obtener el id_ingreso
//    3. Con ese id se busca en `distribuciones` filtrando por estado = FINALIZADO
//    4. Se enriquece con la Edge Function y se muestran los resultados en el modal
// ─────────────────────────────────────────────────────────────────────────────

async function buscarFinalizados() {
    const input = document.getElementById('finalizadosInput');
    const resultadosEl = document.getElementById('finalizadosResultados');
    const btn = document.getElementById('btnBuscarFinalizados');

    const valor = (input ? input.value : '').trim();
    if (!valor) {
        if (resultadosEl) resultadosEl.innerHTML = `
            <div class="alert alert-warning mb-0">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Ingrese un número de OP o Lote para buscar.
            </div>`;
        return;
    }

    // Estado: cargando
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Buscando...'; }
    if (resultadosEl) resultadosEl.innerHTML = `
        <div class="text-center text-muted py-4">
            <div class="spinner-border spinner-border-sm me-2" role="status"></div>
            Buscando en Supabase...
        </div>`;

    try {
        // ── Estrategia de búsqueda ────────────────────────────────────────────
        //
        //  Tabla ingresos:     id_ingreso (= número de OP/REC), lote
        //  Tabla distribuciones: id_distribucion (= id_ingreso), estado
        //
        //  Caso A — búsqueda por OP/REC:
        //    Buscar directo en distribuciones donde id_distribucion = valor AND estado = FINALIZADO
        //
        //  Caso B — búsqueda por Lote:
        //    1. Buscar en ingresos donde lote = valor → obtener lista de id_ingreso
        //    2. Buscar en distribuciones donde id_distribucion IN (ids) AND estado = FINALIZADO
        //
        //  Ejecutamos ambas búsquedas en paralelo y deduplicamos

        const valorEncoded = encodeURIComponent(valor);

        const [respPorOP, respIngresosLote] = await Promise.all([
            // Búsqueda directa por OP en distribuciones
            fetch(
                `${SUPABASE_URL_DT}/rest/v1/distribuciones?id_distribucion=eq.${valorEncoded}&estado=eq.FINALIZADO&select=id_distribucion,estado,colaborador,fecha_distribucion,inicio,fin,duracion&limit=50`,
                {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY_DT,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY_DT}`,
                    },
                }
            ),
            // Búsqueda por Lote en ingresos
            fetch(
                `${SUPABASE_URL_DT}/rest/v1/ingresos?lote=eq.${valorEncoded}&select=id_ingreso,lote&limit=50`,
                {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY_DT,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY_DT}`,
                    },
                }
            ),
        ]);

        const distsPorOP  = respPorOP.ok           ? await respPorOP.json()           : [];
        const ingresosLote = respIngresosLote.ok   ? await respIngresosLote.json()    : [];

        // Si hay ingresos por lote, buscar sus distribuciones finalizadas
        let distsPorLote = [];
        if (ingresosLote.length > 0) {
            const ids = ingresosLote.map(i => i.id_ingreso);
            const filtro = ids.map(id => `id_distribucion.eq.${id}`).join(',');
            const respDistLote = await fetch(
                `${SUPABASE_URL_DT}/rest/v1/distribuciones?or=(${filtro})&estado=eq.FINALIZADO&select=id_distribucion,estado,colaborador,fecha_distribucion,inicio,fin,duracion&limit=50`,
                {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY_DT,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY_DT}`,
                    },
                }
            );
            distsPorLote = respDistLote.ok ? await respDistLote.json() : [];
        }

        // Unificar y deduplicar por id_distribucion
        const distMap = {};
        [...distsPorOP, ...distsPorLote].forEach(d => { distMap[d.id_distribucion] = d; });
        const distribuciones = Object.values(distMap);

        if (distribuciones.length === 0) {
            resultadosEl.innerHTML = `
                <div class="alert alert-info mb-0">
                    <i class="fas fa-info-circle me-2"></i>
                    No se encontraron documentos <strong>finalizados</strong> para <strong>"${valor}"</strong>.
                    <br><small class="text-muted">Puede que estén en otro estado activo o no exista ese OP/Lote.</small>
                </div>`;
            return;
        }

        // ── Enriquecer con la Edge Function ──────────────────────────────────
        const resultadosEnriquecidos = await Promise.all(
            distribuciones.map(async (dist) => {
                try {
                    const resp = await fetch(
                        `${SUPABASE_URL_DT}/functions/v1/separacion-datos?id=${dist.id_distribucion}&finalizado=true`,
                        {
                            headers: {
                                'Authorization': `Bearer ${SUPABASE_ANON_KEY_DT}`,
                                'apikey': SUPABASE_ANON_KEY_DT,
                            },
                        }
                    );
                    if (!resp.ok) return { dist, datosCompletos: null };
                    const json = await resp.json();
                    const item = (json.success && json.data && json.data.length > 0) ? json.data[0] : null;
                    return { dist, datosCompletos: item };
                } catch {
                    return { dist, datosCompletos: null };
                }
            })
        );

        // ── Renderizar resultados ─────────────────────────────────────────────
        resultadosEl.innerHTML = renderizarResultadosFinalizados(resultadosEnriquecidos, valor);

    } catch (error) {
        if (resultadosEl) resultadosEl.innerHTML = `
            <div class="alert alert-danger mb-0">
                <i class="fas fa-exclamation-circle me-2"></i>
                Error al buscar: ${error.message}
            </div>`;
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-search me-1"></i>Buscar'; }
    }
}

function renderizarResultadosFinalizados(resultados, terminoBusqueda) {
    if (!resultados || resultados.length === 0) {
        return `<div class="alert alert-info mb-0"><i class="fas fa-info-circle me-2"></i>Sin resultados.</div>`;
    }

    const filas = resultados.map(({ dist, datosCompletos }) => {
        const rec        = dist.id_distribucion || '';
        const colaborador = dist.colaborador || datosCompletos?.COLABORADOR || 'Sin asignar';
        const fechaStr   = formatearFechaSolo(dist.fecha_distribucion || datosCompletos?.FECHA_DISTRIBUCION || '');
        const duracion   = dist.duracion || datosCompletos?.DURACION || '-';
        const lote       = datosCompletos?.LOTE       || '-';
        const refProv    = datosCompletos?.REFPROV     || '-';
        const prenda     = datosCompletos?.PRENDA      || '-';
        const cantidad   = datosCompletos?.CANTIDAD    || '-';

        const tieneClientes = datosCompletos?.DISTRIBUCION?.Clientes &&
            Object.keys(datosCompletos.DISTRIBUCION.Clientes).length > 0;

        const btnImprimir = (tieneClientes || datosCompletos) ? `
            <button class="btn btn-sm btn-primary" 
                    onclick="imprimirFinalizadoDesdeModal('${rec}')"
                    title="Imprimir plantillas">
                <i class="fas fa-print"></i>
            </button>` : `
            <button class="btn btn-sm btn-secondary" disabled title="Sin datos para imprimir">
                <i class="fas fa-print"></i>
            </button>`;

        const btnRestablecer = `
            <button class="btn btn-sm btn-danger"
                    onclick="restablecerFinalizadoDesdeModal('${rec}')"
                    title="Restablecer documento">
                <i class="fas fa-undo"></i>
            </button>`;

        return `
            <tr>
                <td><strong>REC${rec}</strong></td>
                <td><span class="badge bg-dark">FINALIZADO</span></td>
                <td class="small">${colaborador}</td>
                <td class="small">${fechaStr}</td>
                <td class="small">${duracion}</td>
                <td class="small">${cantidad}</td>
                <td class="small hide-sm">${prenda}</td>
                <td class="small hide-sm">${lote}</td>
                <td class="small hide-md">${refProv}</td>
                <td>
                    <div class="d-flex gap-1">
                        ${btnImprimir}
                        ${btnRestablecer}
                    </div>
                </td>
            </tr>`;
    }).join('');

    return `
        <div class="table-responsive">
            <p class="text-muted small mb-2">
                <i class="fas fa-check-circle text-success me-1"></i>
                ${resultados.length} resultado(s) encontrado(s) para <strong>"${terminoBusqueda}"</strong>
            </p>
            <table class="table table-hover table-sm w-100 mb-0">
                <thead class="table-light">
                    <tr>
                        <th>Documento</th>
                        <th>Estado</th>
                        <th>Responsable</th>
                        <th>Fecha</th>
                        <th>Duración</th>
                        <th>Cantidad</th>
                        <th class="hide-sm">Prenda</th>
                        <th class="hide-sm">Lote</th>
                        <th class="hide-md">RefProv</th>
                        <th>Factura</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${filas}
                </tbody>
            </table>
        </div>`;
}

async function imprimirFinalizadoDesdeModal(rec) {
    // Cerrar el modal de Bootstrap antes del Swal para evitar conflicto de foco
    const modalEl = document.getElementById('finalizadosModal');
    const modalInstance = modalEl ? bootstrap.Modal.getInstance(modalEl) : null;
    if (modalInstance) {
        await new Promise(resolve => {
            modalEl.addEventListener('hidden.bs.modal', resolve, { once: true });
            modalInstance.hide();
        });
    }

    // Obtener datos completos desde la Edge Function (con ?finalizado=true para saltear filtro de estados)
    let datosCompletos = null;
    try {
        const resp = await fetch(
            `${SUPABASE_URL_DT}/functions/v1/separacion-datos?id=${rec}&finalizado=true`,
            {
                headers: {
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY_DT}`,
                    'apikey': SUPABASE_ANON_KEY_DT,
                },
            }
        );
        if (resp.ok) {
            const json = await resp.json();
            if (json.success && json.data && json.data.length > 0) {
                datosCompletos = json.data[0];
            }
        }
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo obtener los datos del documento.', timer: 2000, showConfirmButton: false });
        if (modalInstance) modalInstance.show();
        return;
    }

    if (!datosCompletos) {
        Swal.fire({ icon: 'warning', title: 'Sin datos', text: `No se encontraron datos para REC${rec}.`, timer: 2000, showConfirmButton: false });
        if (modalInstance) modalInstance.show();
        return;
    }

    const tieneClientes = datosCompletos.DISTRIBUCION?.Clientes &&
        Object.keys(datosCompletos.DISTRIBUCION.Clientes).length > 0;

    if (!tieneClientes) {
        // Sin clientes — imprimir principal directo (no necesita Swal)
        if (typeof print_abrirPlantillaImpresion === 'function') {
            print_abrirPlantillaImpresion(datosCompletos, { modo: 'completo', soloImpresionPrincipal: true });
        }
        if (modalInstance) modalInstance.show();
        return;
    }

    // Mostrar opciones: principal + clientes
    const clientes = Object.keys(datosCompletos.DISTRIBUCION.Clientes);

    const { value: seleccion } = await Swal.fire({
        title: `Imprimir REC${rec}`,
        html: `
            <div style="text-align:left">
                <p class="mb-2 text-muted small">Seleccione qué imprimir:</p>
                <div class="form-check mb-1">
                    <input class="form-check-input" type="checkbox" id="swal_principal" checked>
                    <label class="form-check-label" for="swal_principal">Plantilla Principal</label>
                </div>
                ${clientes.map(c => `
                <div class="form-check mb-1">
                    <input class="form-check-input fin-cliente-check" type="checkbox" value="${c}" id="swal_c_${c.replace(/\s+/g,'_')}" checked>
                    <label class="form-check-label" for="swal_c_${c.replace(/\s+/g,'_')}">${c}</label>
                </div>`).join('')}
            </div>`,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-print me-1"></i>Imprimir',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#3085d6',
        preConfirm: () => {
            const items = [];
            if (document.getElementById('swal_principal')?.checked) {
                items.push({ datos: datosCompletos, options: { modo: 'completo', soloImpresionPrincipal: true } });
            }
            document.querySelectorAll('.fin-cliente-check:checked').forEach(cb => {
                items.push({ datos: datosCompletos, options: { modo: 'cliente', clienteNombre: cb.value } });
            });
            if (items.length === 0) {
                Swal.showValidationMessage('Selecciona al menos una opción');
                return false;
            }
            return items;
        }
    });

    if (seleccion && seleccion.length > 0 && typeof print_imprimirLoteDocumentos === 'function') {
        print_imprimirLoteDocumentos(seleccion, `Separación REC${rec}`);
    }

    // Reabrir el modal de finalizados después de imprimir
    if (modalInstance) modalInstance.show();
}

async function restablecerFinalizadoDesdeModal(rec) {
    // Cerrar el modal de Bootstrap ANTES de mostrar SweetAlert
    // para que el input de contraseña reciba el foco correctamente
    const modalEl = document.getElementById('finalizadosModal');
    const modalInstance = modalEl ? bootstrap.Modal.getInstance(modalEl) : null;

    if (modalInstance) {
        // Esperar a que el modal se cierre antes de abrir Swal
        await new Promise(resolve => {
            modalEl.addEventListener('hidden.bs.modal', resolve, { once: true });
            modalInstance.hide();
        });
    }

    // Ahora sí ejecutar el restablecer (Swal puede recibir input sin problema)
    const password = await Swal.fire({
        title: 'Restablecer Documento',
        input: 'password',
        inputLabel: 'Ingrese la contraseña para restablecer REC' + rec,
        showCancelButton: true,
        confirmButtonText: 'Aceptar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        inputValidator: (value) => {
            if (!value) return 'Este campo es obligatorio';
        }
    });

    if (!password.isConfirmed || !password.value) {
        // Reabrir el modal si canceló
        if (modalInstance) modalInstance.show();
        return;
    }

    if (password.value !== 'one') {
        await Swal.fire({ icon: 'error', title: 'Error', text: 'Contraseña incorrecta', timer: 2000, showConfirmButton: false });
        if (modalInstance) modalInstance.show();
        return;
    }

    const loadingSwal = Swal.fire({
        title: 'Restableciendo...',
        text: `REC${rec}`,
        icon: 'info',
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading()
    });

    const result = await llamarAPI({ action: 'restablecer', id: rec });
    Swal.close();

    if (result.success) {
        await Swal.fire({ icon: 'success', title: '✓ Restablecido', text: `REC${rec}`, timer: 1500, showConfirmButton: false });
        // Reabrir modal y actualizar búsqueda
        if (modalInstance) {
            modalInstance.show();
            modalEl.addEventListener('shown.bs.modal', () => buscarFinalizados(), { once: true });
        }
        // También actualizar la tabla principal
        actualizarInmediatamente(true);
    } else {
        await Swal.fire({ icon: 'error', title: 'Error', text: result.message || 'Error al restablecer', timer: 2500, showConfirmButton: false });
        if (modalInstance) modalInstance.show();
    }
}

window.buscarFinalizados              = buscarFinalizados;
window.imprimirFinalizadoDesdeModal   = imprimirFinalizadoDesdeModal;
window.restablecerFinalizadoDesdeModal = restablecerFinalizadoDesdeModal;
window.abrirBusquedaFinalizados       = function() {
    if (typeof abrirBusquedaFinalizados === 'function') abrirBusquedaFinalizados();
};


// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// ESTADÍSTICAS DEL DÍA
// ═══════════════════════════════════════════════════════════════════════════════

// ── Estado global de estadísticas ─────────────────────────────────────────────
let _estadColaboradores   = [];   // colaboradores procesados
let _estadMeta            = 4;    // seg/prenda meta
let _estadTopPorEfic      = true; // true = eficiencia, false = cantidad
let _estadSoloFinalizados = true; // Predeterminado: solo lotes finalizados
let _estadRawDists        = [];   // todas las distribuciones del día (raw)
let _estadCantMap         = {};   // mapa de cantidades por id_distribucion
let _estadChartInstance   = null; // instancia Chart.js activa

function mostrarEstadisticas() {
    const inputFecha = document.getElementById('estadFechaInput');
    if (inputFecha && !inputFecha.value) {
        inputFecha.value = new Date().toISOString().split('T')[0];
    }
    const modal = new bootstrap.Modal(document.getElementById('estadisticasModal'));
    modal.show();
    document.getElementById('estadisticasModal').addEventListener('shown.bs.modal', () => {
        cargarEstadisticas();
    }, { once: true });
}

// ── Utilidades de tiempo ──────────────────────────────────────────────────────

function estad_hmsASegundos(t) {
    if (!t || t === '-') return 0;
    const p = String(t).trim().split(':').map(Number);
    if (p.length === 3) return (p[0] || 0) * 3600 + (p[1] || 0) * 60 + (p[2] || 0);
    if (p.length === 2) return (p[0] || 0) * 60 + (p[1] || 0);
    return 0;
}

function estad_segAHMS(s) {
    s = Math.max(0, Math.floor(s));
    if (s === 0) return '0s';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
}

function estad_obtenerRangoSemanaActual() {
    const ahora = new Date();
    const diaSemana = ahora.getDay(); // 0: dom, 1: lun, ..., 6: sáb
    const diffLunes = diaSemana === 0 ? -6 : 1 - diaSemana;
    
    const lunes = new Date(ahora);
    lunes.setDate(ahora.getDate() + diffLunes);
    
    const domingo = new Date(lunes);
    domingo.setDate(lunes.getDate() + 6);
    
    const fmt = d => d.toISOString().split('T')[0];
    return [fmt(lunes), fmt(domingo)];
}

function estad_calcularNumPausas(dist, secPaus) {
    if (dist.pausas !== undefined && dist.pausas !== null && dist.pausas !== '') {
        if (typeof dist.pausas === 'number') return dist.pausas;
        if (Array.isArray(dist.pausas)) return dist.pausas.length;
        if (typeof dist.pausas === 'string') {
            const trimmed = dist.pausas.trim();
            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                try { return JSON.parse(trimmed).length; } catch (_) {}
            }
            if (trimmed.includes(',')) {
                return trimmed.split(',').filter(x => x.trim().length > 0).length;
            }
            const parsed = parseInt(trimmed, 10);
            if (!isNaN(parsed) && parsed > 0) return parsed;
        }
    }
    // Fallback: si hay tiempo de pausa acumulado (>0s), como mínimo hubo 1 pausa
    return secPaus > 0 ? 1 : 0;
}

function estad_colorEfic(pct) {
    if (pct >= 100) return 'var(--success-color)';
    if (pct >= 80)  return 'var(--warning-color)';
    if (pct >= 60)  return '#e67e22';
    return 'var(--danger-color)';
}

function estad_badgeEfic(pct) {
    if (pct >= 100) return 'badge bg-success';
    if (pct >= 80)  return 'badge bg-warning';
    return 'badge bg-danger';
}

function estad_toggleFiltroFinalizados() {
    _estadSoloFinalizados = !_estadSoloFinalizados;
    estad_procesarYRenderizar();
}

// ── Carga principal ───────────────────────────────────────────────────────────

async function cargarEstadisticas() {
    const inputFecha = document.getElementById('estadFechaInput');
    const fechaLabel = document.getElementById('estadFechaLabel');
    const contenido  = document.getElementById('estadContenido');
    const tarjetasEl = document.getElementById('estadTarjetasGlobal');

    const fecha = (inputFecha && inputFecha.value)
        ? inputFecha.value
        : new Date().toISOString().split('T')[0];

    // Label legible
    if (fechaLabel) {
        const d = new Date(fecha + 'T12:00:00');
        fechaLabel.textContent = d.toLocaleDateString('es-ES', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
    }

    // Spinner
    if (contenido) contenido.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border" style="color:var(--accent-color); width:2rem; height:2rem;" role="status"></div>
            <p class="mt-2 small" style="color:var(--text-muted);">Procesando datos...</p>
        </div>`;
    if (tarjetasEl) tarjetasEl.innerHTML = '';

    try {
        const fechaDesde = `${fecha}T00:00:00`;
        const fechaHasta = `${fecha}T23:59:59`;

        const respDist = await fetch(
            `${SUPABASE_URL_DT}/rest/v1/distribuciones` +
            `?inicio=gte.${encodeURIComponent(fechaDesde)}` +
            `&inicio=lte.${encodeURIComponent(fechaHasta)}` +
            `&select=id_distribucion,colaborador,estado,inicio,fin,duracion,duracion_pausas,pausas,datos_distribucion` +
            `&order=colaborador.asc`,
            { headers: { 'apikey': SUPABASE_ANON_KEY_DT, 'Authorization': `Bearer ${SUPABASE_ANON_KEY_DT}` } }
        );

        if (!respDist.ok) throw new Error(`Error consultando distribuciones: ${respDist.status}`);
        const dists = await respDist.json();

        _estadRawDists = dists || [];

        if (!_estadRawDists || _estadRawDists.length === 0) {
            if (contenido) contenido.innerHTML = `
                <div class="alert alert-info mb-0" style="border-radius:var(--radius-md);">
                    <i class="fas fa-info-circle me-2"></i>
                    No hay distribuciones registradas para esta fecha.
                </div>`;
            if (tarjetasEl) tarjetasEl.innerHTML = estad_tarjetasVacias();
            if (_estadChartInstance) {
                _estadChartInstance.destroy();
                _estadChartInstance = null;
            }
            return;
        }

        // Calcular cantidades desde JSONB y memoria
        const cantMap = {};

        const pool = [
            ...(window.datosGlobales        || []),
            ...(window.printingDatosGlobales || []),
        ];
        pool.forEach(item => {
            const rec  = String(item.REC || item.DOCUMENTO || '');
            const cant = parseInt(item.CANTIDAD) || 0;
            if (rec && cant > 0) cantMap[rec] = cant;
        });
        if (documentosGlobales && documentosGlobales.length > 0) {
            documentosGlobales.forEach(doc => {
                const rec  = String(doc.rec || '');
                const cant = parseInt(doc.cantidad) || 0;
                if (rec && cant > 0) cantMap[rec] = cant;
            });
        }

        _estadRawDists.forEach(dist => {
            const rec = String(dist.id_distribucion);
            if (cantMap[rec] > 0) return;

            let cantJSONB = 0;
            try {
                const dd = typeof dist.datos_distribucion === 'string'
                    ? JSON.parse(dist.datos_distribucion)
                    : dist.datos_distribucion;

                if (dd && dd.Clientes) {
                    Object.values(dd.Clientes).forEach(cliente => {
                        if (Array.isArray(cliente.distribucion)) {
                            cliente.distribucion.forEach(item => {
                                cantJSONB += parseInt(item.cantidad) || 0;
                            });
                        }
                    });
                }
            } catch (_) { cantJSONB = 0; }

            cantMap[rec] = cantJSONB;
        });

        _estadCantMap = cantMap;

        // Renderizar según el filtro actual
        estad_procesarYRenderizar();

    } catch (err) {
        const msg = err.message || String(err);
        if (contenido) contenido.innerHTML = `
            <div class="alert alert-danger mb-0" style="border-radius:var(--radius-md);">
                <i class="fas fa-exclamation-circle me-2"></i>
                Error: <strong>${msg}</strong>
                <button class="btn btn-sm btn-danger ms-3" onclick="cargarEstadisticas()">
                    <i class="fas fa-redo me-1"></i>Reintentar
                </button>
            </div>`;
    }
}

// ── Procesamiento y Renderizado según filtro ──────────────────────────────────

function estad_procesarYRenderizar() {
    const contenido  = document.getElementById('estadContenido');
    const tarjetasEl = document.getElementById('estadTarjetasGlobal');
    const META_SEG   = 4;

    // Actualizar visualmente el switch en el header
    const swEl  = document.getElementById('estadFiltroFinalizadosSwitch');
    const lblEl = document.getElementById('estadFiltroFinalizadosLabel');
    if (swEl)  swEl.classList.toggle('activo', _estadSoloFinalizados);
    if (lblEl) lblEl.textContent = _estadSoloFinalizados ? 'Solo Finalizados' : 'Todos los Lotes';

    // Filtrar distribuciones
    const dists = _estadSoloFinalizados
        ? _estadRawDists.filter(d => d.estado === 'FINALIZADO')
        : _estadRawDists;

    if (!dists || dists.length === 0) {
        if (contenido) contenido.innerHTML = `
            <div class="alert alert-info mb-0" style="border-radius:var(--radius-md);">
                <i class="fas fa-info-circle me-2"></i>
                ${_estadSoloFinalizados
                    ? 'No hay lotes <strong>finalizados</strong> para esta fecha.'
                    : 'No hay distribuciones registradas para esta fecha.'}
            </div>`;
        if (tarjetasEl) tarjetasEl.innerHTML = estad_tarjetasVacias();
        if (_estadChartInstance) {
            _estadChartInstance.destroy();
            _estadChartInstance = null;
        }
        return;
    }

    // Agrupar por colaborador
    const porColaborador = {};

    dists.forEach(dist => {
        const nombre = (dist.colaborador || '').trim();
        if (!nombre) return;

        if (!porColaborador[nombre]) {
            porColaborador[nombre] = {
                nombre,
                lotes: 0,
                unidades: 0,
                secTrabajados: 0,
                secPausas: 0,
                numPausas: 0,
                tieneActivos: false,
            };
        }

        const c       = porColaborador[nombre];
        const rec     = String(dist.id_distribucion);
        const cant    = _estadCantMap[rec] || 0;
        const secTrab = estad_hmsASegundos(dist.duracion);
        const secPaus = estad_hmsASegundos(dist.duracion_pausas);
        const nPausas = estad_calcularNumPausas(dist, secPaus);

        c.lotes++;
        c.unidades      += cant;
        c.secTrabajados += secTrab;
        c.secPausas     += secPaus;
        c.numPausas     += nPausas;

        if (['ELABORACION', 'PENDIENTE', 'PAUSADO', 'DIRECTO'].includes(dist.estado)) {
            c.tieneActivos = true;
        }
    });

    const colaboradores = Object.values(porColaborador)
        .map(c => {
            const sp    = c.unidades > 0 ? c.secTrabajados / c.unidades : Infinity;
            const efPct = sp < Infinity && sp > 0 ? Math.round((META_SEG / sp) * 100) : 0;
            return { ...c, _efPct: efPct };
        })
        .sort((a, b) => b._efPct - a._efPct);

    const tot = colaboradores.reduce((a, c) => ({
        lotes:         a.lotes         + c.lotes,
        unidades:      a.unidades      + c.unidades,
        secTrabajados: a.secTrabajados + c.secTrabajados,
        secPausas:     a.secPausas     + c.secPausas,
        numPausas:     a.numPausas     + c.numPausas,
    }), { lotes: 0, unidades: 0, secTrabajados: 0, secPausas: 0, numPausas: 0 });

    const totSegPrenda = tot.unidades > 0 ? tot.secTrabajados / tot.unidades : 0;
    const totEficPct   = totSegPrenda > 0 ? Math.round((META_SEG / totSegPrenda) * 100) : 0;

    _estadColaboradores = colaboradores;
    _estadMeta          = META_SEG;

    if (tarjetasEl) {
        tarjetasEl.innerHTML = estad_tarjetasGlobales(tot, totSegPrenda, totEficPct);
    }

    const numPersonas = colaboradores.length;

    if (contenido) {
        contenido.innerHTML = estad_renderCuerpo(colaboradores, META_SEG, dists.length);
        // Dibujar gráficas e inicializar controles tras insertar en DOM
        setTimeout(() => {
            estad_dibujarGraficoHora(dists, _estadCantMap, numPersonas, totEficPct);
            
            // Inicializar Flatpickr en el input de rango individual (predeterminado: semana en curso)
            const inputRangoPersona = document.getElementById('estadPersonaRangoInput');
            const rangoSemana = estad_obtenerRangoSemanaActual();
            if (inputRangoPersona && typeof flatpickr !== 'undefined') {
                if (!inputRangoPersona._flatpickr) {
                    flatpickr(inputRangoPersona, {
                        mode: "range",
                        locale: "es",
                        dateFormat: "Y-m-d",
                        defaultDate: rangoSemana,
                        onChange: function(selectedDates) {
                            if (selectedDates.length === 1 || selectedDates.length === 2) {
                                estad_cargarEvaluacionPersona();
                            }
                        }
                    });
                }
            }
            // Cargar evaluación por persona inicial
            estad_cargarEvaluacionPersona();
        }, 50);
    }
}

// ── Tarjetas globales ─────────────────────────────────────────────────────────

function estad_tarjeta(icono, colorIcon, label, valor, sub) {
    const subHtml = `<div style="font-size:0.67rem; font-weight:600; height:0.9rem; line-height:0.9rem; ${sub ? `color:${colorIcon};` : 'visibility:hidden;'}">${sub || '&nbsp;'}</div>`;
    return `
        <div class="col-6 col-sm-4 col-lg-2">
            <div class="estad-card h-100" style="--card-accent:${colorIcon};">
                <!-- Ícono watermark de fondo -->
                <i class="${icono} estad-card-bg-icon"></i>
                <!-- Contenido -->
                <div class="estad-card-body">
                    <div class="estad-card-valor">${valor}</div>
                    <div class="estad-card-label">${label}</div>
                    ${subHtml}
                </div>
            </div>
        </div>`;
}

function estad_tarjetasGlobales(tot, totSegPrenda, totEficPct) {
    const efColor = estad_colorEfic(totEficPct);
    return `
        ${estad_tarjeta('fas fa-tshirt',       'var(--info-color)',    'Unidades',      tot.unidades.toLocaleString(), null)}
        ${estad_tarjeta('fas fa-boxes',        'var(--accent-color)', 'Lotes',         tot.lotes, null)}
        ${estad_tarjeta('fas fa-clock',        'var(--success-color)','T. Activo',     estad_segAHMS(tot.secTrabajados), null)}
        ${estad_tarjeta('fas fa-pause-circle', 'var(--danger-color)', 'En Pausas',     estad_segAHMS(tot.secPausas), `${tot.numPausas} pausa${tot.numPausas !== 1 ? 's' : ''}`)}
        ${estad_tarjeta('fas fa-stopwatch',    'var(--warning-color)','Seg / Prenda',  totSegPrenda > 0 ? totSegPrenda.toFixed(1) + 's' : '-', 'meta: 4s')}
        ${estad_tarjeta('fas fa-bolt',         efColor,               'Efic. Global',  totEficPct + '%', totEficPct >= 100 ? '✓ Sobre meta' : 'vs meta 4s')}
    `;
}

function estad_tarjetasVacias() {
    return `
        ${estad_tarjeta('fas fa-tshirt',       'var(--info-color)',    'Unidades',     '—', null)}
        ${estad_tarjeta('fas fa-boxes',        'var(--accent-color)', 'Lotes',        '—', null)}
        ${estad_tarjeta('fas fa-clock',        'var(--success-color)','T. Activo',    '—', null)}
        ${estad_tarjeta('fas fa-pause-circle', 'var(--danger-color)', 'En Pausas',    '—', null)}
        ${estad_tarjeta('fas fa-stopwatch',    'var(--warning-color)','Seg / Prenda', '—', null)}
        ${estad_tarjeta('fas fa-bolt',         'var(--text-muted)',    'Efic. Global', '—', null)}
    `;
}

// ── Cuerpo: ranking + tabla ───────────────────────────────────────────────────

function estad_toggleTopMode() {
    _estadTopPorEfic = !_estadTopPorEfic;

    const lbl = document.getElementById('estadSwitchLabel');
    // El switch del top está dentro del podio container — buscamos por ID de hermano
    const sw = document.querySelector('#estadPodioContainer')?.parentElement?.querySelector('.estad-switch');
    const titulo = document.querySelector('#estadPodioContainer')
        ?.closest('.mb-3, .mb-4')
        ?.querySelector('p');

    if (lbl)    lbl.textContent = _estadTopPorEfic ? 'Por eficiencia' : 'Por cantidad';
    if (sw)     sw.classList.toggle('activo', !_estadTopPorEfic);
    if (titulo) titulo.innerHTML = `<i class="fas fa-trophy me-1" style="color:var(--warning-color);"></i>Top del día — ${_estadTopPorEfic ? 'por eficiencia' : 'por cantidad'}`;

    if (!_estadColaboradores.length) return;

    const ordenados = _estadTopPorEfic
        ? [..._estadColaboradores].sort((a, b) => b._efPct - a._efPct)
        : [..._estadColaboradores].sort((a, b) => b.unidades - a.unidades);

    const podioEl = document.getElementById('estadPodioContainer');
    if (podioEl) {
        podioEl.innerHTML = estad_renderPodio(ordenados, _estadMeta);
    }
}

function estad_renderPodio(top3, META_SEG) {
    const podioLabels  = ['1°', '2°', '3°'];
    const podioAcentos = ['#f59e0b', '#94a3b8', '#cd7f32'];
    const podioIconos  = ['fas fa-crown', 'fas fa-medal', 'fas fa-award'];

    const top = top3.slice(0, 3);
    const ordenVisual = top.length === 1 ? [0]
        : top.length === 2              ? [1, 0]
        : [1, 0, 2];

    return ordenVisual.map(idx => {
        const c      = top[idx];
        if (!c) return '';
        const efPct  = c._efPct || 0;
        const sp     = c.unidades > 0 ? c.secTrabajados / c.unidades : 0;
        const nombre = estad_nombreCorto(c.nombre);
        const acento = podioAcentos[idx];
        const icono  = podioIconos[idx];
        const esTop1 = idx === 0;

        const statPrincipalVal   = _estadTopPorEfic
            ? `${efPct}%`
            : c.unidades.toLocaleString();
        const statPrincipalLabel = _estadTopPorEfic ? 'eficiencia' : 'unidades';
        const barraW             = _estadTopPorEfic
            ? Math.min(efPct, 100)
            : 0;

        return `
            <div class="estad-podio-item${esTop1 ? ' estad-podio-top' : ''}">
                <i class="${icono} estad-podio-bg-icon" style="color:${acento};"></i>
                <div class="estad-podio-pos" style="color:${acento};">${podioLabels[idx]}</div>
                <div class="estad-podio-nombre" title="${c.nombre}">${nombre}</div>
                <div class="estad-podio-efic" style="color:${acento};">${statPrincipalVal}</div>
                <div class="estad-podio-efic-label">${statPrincipalLabel}</div>
                <div class="estad-podio-barra" style="${barraW === 0 ? 'opacity:0;' : ''}">
                    <div class="estad-podio-barra-fill" style="width:${barraW}%; background:${acento};"></div>
                </div>
                <div class="estad-podio-stats">
                    <div class="estad-podio-stat">
                        <span class="estad-podio-stat-val">${c.unidades.toLocaleString()}</span>
                        <span class="estad-podio-stat-lbl">uds</span>
                    </div>
                    <div class="estad-podio-sep"></div>
                    <div class="estad-podio-stat">
                        <span class="estad-podio-stat-val">${efPct}%</span>
                        <span class="estad-podio-stat-lbl">efic.</span>
                    </div>
                    <div class="estad-podio-sep"></div>
                    <div class="estad-podio-stat">
                        <span class="estad-podio-stat-val">${sp > 0 ? sp.toFixed(1)+'s' : '—'}</span>
                        <span class="estad-podio-stat-lbl">seg/pda</span>
                    </div>
                </div>
            </div>`;
    }).join('');
}

function estad_renderCuerpo(colaboradores, META_SEG, totalDists) {
    if (!colaboradores.length) {
        return `<div class="alert alert-info mb-0"><i class="fas fa-info-circle me-2"></i>Sin datos para mostrar.</div>`;
    }

    const filas = colaboradores.map(c => {
        const sp      = c.unidades > 0 ? c.secTrabajados / c.unidades : 0;
        const efPct   = c._efPct || 0;
        const efColor = estad_colorEfic(efPct);
        const barW    = Math.min(efPct, 100);
        const nombre  = estad_nombreCorto(c.nombre);

        const badgeEstado = c.tieneActivos
            ? `<span class="badge" style="background:#d1fae5; color:#065f46; font-size:0.6rem; font-weight:600; padding:2px 6px; border-radius:99px;">EN PROCESO</span>`
            : `<span class="badge" style="background:#f1f5f9; color:#475569; font-size:0.6rem; font-weight:600; padding:2px 6px; border-radius:99px;">FINALIZADO</span>`;

        return `
            <tr>
                <td style="max-width:160px;">
                    <div class="fw-semibold" style="font-size:0.8rem; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${c.nombre}">${nombre}</div>
                    ${badgeEstado}
                </td>
                <td class="text-center fw-bold" style="color:var(--text-primary); font-size:0.875rem;">${c.unidades > 0 ? c.unidades.toLocaleString() : '<span style="color:var(--text-muted);">—</span>'}</td>
                <td class="text-center" style="font-size:0.8rem;">${c.lotes}</td>
                <td class="text-center" style="font-size:0.8rem; color:var(--text-secondary); font-variant-numeric:tabular-nums;">${estad_segAHMS(c.secTrabajados)}</td>
                <td class="text-center" style="font-size:0.8rem;">
                    <span style="color:var(--danger-color); font-variant-numeric:tabular-nums;">${estad_segAHMS(c.secPausas)}</span>
                    <div style="font-size:0.67rem; color:var(--text-muted);">${c.numPausas} pausa${c.numPausas !== 1 ? 's' : ''}</div>
                </td>
                <td class="text-center" style="font-size:0.8rem; color:var(--text-secondary);">${sp > 0 ? sp.toFixed(1) + 's' : '—'}</td>
                <td style="min-width:100px;">
                    <div class="d-flex align-items-center gap-1">
                        <div class="progress flex-grow-1" style="height:5px; background:var(--border-light); border-radius:99px;">
                            <div style="width:${barW}%; background:${efColor}; height:100%; border-radius:99px; transition:width .6s ease;"></div>
                        </div>
                        <span class="fw-bold" style="color:${efColor}; font-size:0.75rem; min-width:36px; text-align:right;">${efPct}%</span>
                    </div>
                </td>
            </tr>`;
    }).join('');

    return `
        <!-- Nota unidades sin datos -->
        ${colaboradores.some(c => c.unidades === 0) ? `
        <div class="alert alert-info mb-3" style="border-radius:var(--radius-md); padding:.6rem .875rem; font-size:.78rem;">
            <i class="fas fa-info-circle me-2"></i>
            Algunos colaboradores muestran <strong>— unidades</strong> porque sus documentos estaban
            finalizados antes de que la app los cargara. Actualiza la tabla principal
            (<i class="fas fa-sync-alt"></i>) y vuelve a abrir las estadísticas.
        </div>` : ''}

        <!-- Top del día -->
        ${colaboradores.length >= 2 ? `
        <div class="mb-4">
            <div class="d-flex align-items-center justify-content-between mb-2">
                <p class="small fw-semibold mb-0" style="color:var(--text-secondary); text-transform:uppercase; letter-spacing:.04em; font-size:0.72rem;">
                    <i class="fas fa-trophy me-1" style="color:var(--warning-color);"></i>Top del día — por eficiencia
                </p>
                <div class="d-flex align-items-center gap-2">
                    <span id="estadSwitchLabel" style="font-size:0.72rem; color:var(--text-muted); font-weight:500;">Por eficiencia</span>
                    <div class="estad-switch" onclick="estad_toggleTopMode()" title="Cambiar criterio del top">
                        <div class="estad-switch-thumb"></div>
                    </div>
                </div>
            </div>
            <div id="estadPodioContainer" class="estad-podio-container">
                ${estad_renderPodio(colaboradores, META_SEG)}
            </div>
        </div>` : ''}

        <!-- Sección Producción por Hora y Capacidad Instalada -->
        <div class="mb-4">
            <div class="d-flex align-items-center justify-content-between mb-2">
                <p class="small fw-semibold mb-0" style="color:var(--text-secondary); text-transform:uppercase; letter-spacing:.04em; font-size:0.72rem;">
                    <i class="fas fa-chart-area me-1" style="color:var(--accent-color);"></i>Producción por Hora & Estimado Capacidad Instalada
                </p>
                <span class="badge bg-light text-dark border" style="font-size:0.68rem; font-weight:500;" id="estadJornadaBadge">
                    <i class="fas fa-clock me-1 text-primary"></i>504 min (30,240 s) / jornada
                </span>
            </div>

            <!-- Resumen Capacidad Instalada KPIs -->
            <div id="estadCapacidadKPIs" class="row g-2 mb-3"></div>

            <!-- Gráfico Chart.js Container -->
            <div class="card border-0 p-3" style="border-radius:var(--radius-md); box-shadow:var(--shadow-sm); background:var(--bg-primary); border:1px solid var(--border-light) !important;">
                <div style="position: relative; height: 260px; width: 100%;">
                    <canvas id="estadGraficoHoraCanvas"></canvas>
                </div>
            </div>
        </div>

        <!-- Tabla detalle -->
        <p class="small fw-semibold mb-2" style="color:var(--text-secondary); text-transform:uppercase; letter-spacing:.04em; font-size:0.72rem;">
            <i class="fas fa-table me-1" style="color:var(--accent-color);"></i>Detalle por colaborador
            <span class="ms-2 fw-normal" style="font-size:0.7rem; color:var(--text-muted); text-transform:none;">${totalDists} distribución${totalDists !== 1 ? 'es' : ''} del día</span>
        </p>
        <div class="card border-0" style="border-radius:var(--radius-md); box-shadow:var(--shadow-sm); overflow:hidden;">
            <div class="table-responsive">
                <table class="table table-hover mb-0" style="font-size:0.8rem;">
                    <thead>
                        <tr>
                            <th>Colaborador</th>
                            <th class="text-center">Unidades</th>
                            <th class="text-center">Lotes</th>
                            <th class="text-center">T. Activo</th>
                            <th class="text-center">T. Pausas</th>
                            <th class="text-center">Seg/Prenda</th>
                            <th class="text-center">Eficiencia</th>
                        </tr>
                    </thead>
                    <tbody>${filas}</tbody>
                </table>
            </div>
        </div>

        <!-- Nota metodología -->
        <p class="mt-2 mb-3" style="font-size:0.7rem; color:var(--text-muted);">
            <i class="fas fa-info-circle me-1"></i>
            Eficiencia = (4s ÷ seg/prenda) × 100. Meta: 4 seg/prenda.
            Valores &gt;100% indican rendimiento sobre la meta.
        </p>

        <!-- Sección Evaluación Individual de Desempeño por Persona y Rango -->
        <div class="mt-4 pt-3 border-top">
            <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                <div>
                    <p class="small fw-semibold mb-0" style="color:var(--text-secondary); text-transform:uppercase; letter-spacing:.04em; font-size:0.75rem;">
                        <i class="fas fa-user-check me-1" style="color:var(--accent-color);"></i>Evaluación de Desempeño Individual
                    </p>
                    <span style="font-size:0.7rem; color:var(--text-muted);">Evaluación por día basada en el tiempo real dedicado a separación (meta 4s/prenda)</span>
                </div>
                <div class="d-flex align-items-center gap-2 flex-wrap">
                    <!-- Selector de Colaborador -->
                    <select id="estadPersonaSelect" class="form-select form-select-sm" style="width: auto; min-width: 170px; font-size: 0.78rem;" onchange="estad_cargarEvaluacionPersona()">
                        ${colaboradores.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('')}
                    </select>
                    <!-- Selector de Rango de Fechas con Flatpickr -->
                    <div class="input-group input-group-sm" style="width: auto;">
                        <span class="input-group-text bg-light" style="font-size: 0.75rem;"><i class="fas fa-calendar-alt text-primary"></i></span>
                        <input type="text" id="estadPersonaRangoInput" class="form-control form-control-sm bg-white" placeholder="Seleccionar rango..." style="width: 190px; font-size: 0.78rem; cursor: pointer;" readonly>
                    </div>
                    <button class="btn btn-sm btn-primary" onclick="estad_cargarEvaluacionPersona()" style="font-size:0.75rem;">
                        <i class="fas fa-chart-line me-1"></i>Evaluar
                    </button>
                </div>
            </div>

            <!-- KPIs de Calificación Individual -->
            <div id="estadPersonaKPIs" class="row g-2 mb-3"></div>

            <!-- Contenedor del Gráfico Individual -->
            <div class="card border-0 p-3" style="border-radius:var(--radius-md); box-shadow:var(--shadow-sm); background:var(--bg-primary); border:1px solid var(--border-light) !important;">
                <div style="position: relative; height: 280px; width: 100%;">
                    <canvas id="estadPersonaCanvas"></canvas>
                </div>
            </div>
        </div>`;
}

function estad_dibujarGraficoHora(dists, cantMap, numPersonas, eficGlobalPct) {

    // ── Jornada real ──────────────────────────────────────────────────────────
    // Inicio: 7:10  |  Desayuno: 8:00-8:15  |  Almuerzo: 12:00-12:30
    const HORA_INICIO  = { h: 7,  m: 10 };
    const DESAYUNO     = { ini: { h: 8, m: 0 }, fin: { h: 8, m: 15 } };
    const ALMUERZO     = { ini: { h: 12, m: 0 }, fin: { h: 12, m: 30 } };

    // Minutos efectivos de trabajo dentro de cada hora del día
    function minEfectivos(hora) {
        if (hora < HORA_INICIO.h) return 0;                           // antes de iniciar
        let min = 60;
        if (hora === HORA_INICIO.h)  min -= HORA_INICIO.m;           // 7→ 50 min (7:10-8:00)
        if (hora === DESAYUNO.ini.h) min -= (DESAYUNO.fin.m - DESAYUNO.ini.m); // 8→ 45 min
        if (hora === ALMUERZO.ini.h) min -= (ALMUERZO.fin.m - ALMUERZO.ini.m); // 12→ 30 min
        return Math.max(0, min);
    }

    function esDescanso(hora) {
        return hora === DESAYUNO.ini.h || hora === ALMUERZO.ini.h;
    }

    // ── Rango de horas: 07:00 → 17:00 ────────────────────────────────────────
    const H_INI = 7;
    const H_FIN = 17;
    const horasLabels = [];
    for (let h = H_INI; h <= H_FIN; h++) {
        horasLabels.push(`${String(h).padStart(2,'0')}:00`);
    }

    // ── Acumular producción real por hora (usando campo fin) ──────────────────
    const horasMap = {};
    for (let h = H_INI; h <= H_FIN; h++) horasMap[h] = 0;

    dists.forEach(dist => {
        const timestamp = dist.fin || dist.inicio;
        if (!timestamp) return;
        const dt = new Date(timestamp);
        if (isNaN(dt.getTime())) return;
        const h = dt.getHours();
        const rec = String(dist.id_distribucion);
        const cant = cantMap[rec] || 0;
        if (horasMap[h] !== undefined) horasMap[h] += cant;
    });

    const datosHoras = [];
    for (let h = H_INI; h <= H_FIN; h++) datosHoras.push(horasMap[h]);

    // ── Cálculos de capacidad ─────────────────────────────────────────────────
    const N = Math.max(1, numPersonas);
    const metaHora100         = N * 900;
    const metaHoraActual      = Math.round(N * 900 * (eficGlobalPct / 100));
    const capacidadDiaria     = N * 7560;
    const capacidadDiariaEfic = Math.round(N * 7560 * (eficGlobalPct / 100));

    // Meta por hora ajustada a los minutos efectivos reales de cada franja
    const metaActualPorHora = [];
    const meta100PorHora    = [];
    for (let h = H_INI; h <= H_FIN; h++) {
        const factor = minEfectivos(h) / 60;
        metaActualPorHora.push(Math.round(metaHoraActual * factor));
        meta100PorHora.push(Math.round(metaHora100 * factor));
    }

    // ── Notas de descanso / inicio para tooltip ───────────────────────────────
    const notaHora = {};
    notaHora[7]  = `⏱ Inicio de jornada: 7:10 am (10 min iniciales)`;
    notaHora[8]  = `☕ Desayuno: 8:00 - 8:15 am (15 min descanso)`;
    notaHora[12] = `🍽 Almuerzo: 12:00 - 12:30 pm (30 min descanso)`;

    // ── KPIs ──────────────────────────────────────────────────────────────────
    const kpiEl = document.getElementById('estadCapacidadKPIs');
    if (kpiEl) {
        kpiEl.innerHTML = `
            <div class="col-6 col-md-6">
                <div class="p-2 rounded" style="background:var(--bg-secondary); border:1px solid var(--border-light);">
                    <div class="text-muted" style="font-size:0.65rem; font-weight:700; text-transform:uppercase; letter-spacing:0.03em;">Meta Hora (${eficGlobalPct}% Efic.)</div>
                    <div class="fw-bold" style="font-size:0.95rem; color:var(--warning-color);"><i class="fas fa-bullseye me-1"></i>${metaHoraActual.toLocaleString()} <span style="font-size:0.72rem; font-weight:normal;">uds/h</span></div>
                    <div class="text-muted" style="font-size:0.65rem;">meta según ritmo actual</div>
                    <div style="font-size:0.63rem; border-top:1px dashed var(--border-light); margin-top:3px; padding-top:3px; color:var(--success-color); font-weight:600;"><i class="fas fa-tachometer-alt me-1"></i>100% efic: ${metaHora100.toLocaleString()} uds/h <span style="font-weight:normal; color:var(--text-muted);">— 900/h por pers.</span></div>
                </div>
            </div>
            <div class="col-6 col-md-6">
                <div class="p-2 rounded" style="background:var(--bg-secondary); border:1px solid var(--border-light);">
                    <div class="text-muted" style="font-size:0.65rem; font-weight:700; text-transform:uppercase; letter-spacing:0.03em;">Capacidad Instalada Día</div>
                    <div class="fw-bold" style="font-size:0.95rem; color:var(--accent-color);"><i class="fas fa-industry me-1"></i>${capacidadDiariaEfic.toLocaleString()} <span style="font-size:0.72rem; font-weight:normal;">uds/día</span></div>
                    <div class="text-muted" style="font-size:0.65rem;">${eficGlobalPct}% efic. actual</div>
                    <div style="font-size:0.63rem; border-top:1px dashed var(--border-light); margin-top:3px; padding-top:3px; color:var(--success-color); font-weight:600;"><i class="fas fa-arrow-up me-1"></i>100% efic: ${capacidadDiaria.toLocaleString()} uds/día <span style="font-weight:normal; color:var(--text-muted);">— 7,560/d por pers.</span></div>
                </div>
            </div>
        `;

        // Actualizar badge de jornada con número de personas
        const badgeJornada = document.getElementById('estadJornadaBadge');
        if (badgeJornada) {
            badgeJornada.innerHTML = `<i class="fas fa-users me-1 text-primary"></i>${N} ${N === 1 ? 'persona' : 'personas'} &nbsp;&middot;&nbsp; <i class="fas fa-clock me-1 text-primary"></i>504 min (30,240 s) / jornada`;
        }
    }

    // ── Gráfico ───────────────────────────────────────────────────────────────
    const canvas = document.getElementById('estadGraficoHoraCanvas');
    if (!canvas || typeof Chart === 'undefined') return;

    if (_estadChartInstance) {
        _estadChartInstance.destroy();
        _estadChartInstance = null;
    }

    // Plugin inline para sombrear la proporción EXACTA en el eje X timeline
    const pluginDescansos = {
        id: 'descansos',
        beforeDraw(chart) {
            const { ctx, chartArea, scales } = chart;
            if (!chartArea) return;
            const xScale = scales.x;
            ctx.save();

            // Configuración de sombreado proporcional por hora
            // minIni: minuto donde inicia el descanso/no laboral dentro de la hora
            // durMin: duración en minutos del descanso
            const franjasEspeciales = {
                7:  { minIni: 0, durMin: 10, color: 'rgba(148, 163, 184, 0.15)', border: '#94a3b8' }, // 7:00-7:10 (10m)
                8:  { minIni: 0, durMin: 15, color: 'rgba(245, 158, 11, 0.18)',  border: '#f59e0b' }, // 8:00-8:15 (15m)
                12: { minIni: 0, durMin: 30, color: 'rgba(239, 68, 68, 0.16)',   border: '#ef4444' }  // 12:00-12:30 (30m)
            };

            horasLabels.forEach((lbl, i) => {
                const hora = H_INI + i;
                const config = franjasEspeciales[hora];
                if (!config) return;

                const x0 = xScale.getPixelForValue(i - 0.5);
                const x1 = xScale.getPixelForValue(i + 0.5);
                const anchoHora = x1 - x0;

                // Ancho proporcional exacto en el eje X
                const xInicioFranja = x0 + (anchoHora * (config.minIni / 60));
                const anchoFranja   = anchoHora * (config.durMin / 60);

                // Relleno de fondo del descanso
                ctx.fillStyle = config.color;
                ctx.fillRect(xInicioFranja, chartArea.top, anchoFranja, chartArea.bottom - chartArea.top);

                // Lógica de borde/indicador vertical sutil
                ctx.strokeStyle = config.border;
                ctx.lineWidth = 1;
                ctx.setLineDash([2, 2]);
                ctx.beginPath();
                ctx.moveTo(xInicioFranja + anchoFranja, chartArea.top);
                ctx.lineTo(xInicioFranja + anchoFranja, chartArea.bottom);
                ctx.stroke();
                ctx.setLineDash([]);
            });

            ctx.restore();
        }
    };

    const ctx = canvas.getContext('2d');
    _estadChartInstance = new Chart(ctx, {
        type: 'bar',
        plugins: [pluginDescansos],
        data: {
            labels: horasLabels,
            datasets: [
                {
                    label: 'Producción Real (unidades)',
                    data: datosHoras,
                    backgroundColor: 'rgba(59, 130, 246, 0.78)',
                    borderColor: '#2563eb',
                    borderWidth: 1,
                    borderRadius: 4,
                    order: 2
                },
                {
                    label: `Meta Hora Actual (${eficGlobalPct}% Efic.)`,
                    data: metaActualPorHora,
                    type: 'line',
                    borderColor: '#f59e0b',
                    borderWidth: 2.5,
                    borderDash: [6, 4],
                    pointRadius: metaActualPorHora.map((v, i) => (H_INI + i === 7 || H_INI + i === 8 || H_INI + i === 12) ? 4 : 0),
                    pointHoverRadius: 4,
                    pointBackgroundColor: '#f59e0b',
                    fill: false,
                    order: 1
                },
                {
                    label: 'Meta Hora 100%',
                    data: meta100PorHora,
                    type: 'line',
                    borderColor: '#10b981',
                    borderWidth: 1.5,
                    borderDash: [3, 3],
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    fill: false,
                    order: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    position: 'top',
                    labels: { boxWidth: 12, font: { size: 11 }, usePointStyle: true }
                },
                tooltip: {
                    callbacks: {
                        title(items) {
                            const i   = items[0]?.dataIndex ?? 0;
                            const h   = H_INI + i;
                            const min = minEfectivos(h);
                            let tit = `${horasLabels[i]} — ${min} min productivos`;
                            if (notaHora[h]) tit += `\n${notaHora[h]}`;
                            return tit;
                        },
                        footer(tooltipItems) {
                            let prodReal = 0;
                            tooltipItems.forEach(item => {
                                if (item.datasetIndex === 0) prodReal = item.raw || 0;
                            });
                            const i = tooltipItems[0]?.dataIndex ?? 0;
                            const metaEstaHora = metaActualPorHora[i];
                            if (metaEstaHora > 0) {
                                const pct = Math.round((prodReal / metaEstaHora) * 100);
                                return `Cumplimiento meta hora: ${pct}%`;
                            }
                            return '';
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { size: 10 },
                        color(ctx) {
                            const h = H_INI + ctx.index;
                            if (h === 7)  return '#64748b'; // gris 7am (inicio 7:10)
                            if (h === 8)  return '#d97706'; // ámbar 8am (desayuno)
                            if (h === 12) return '#dc2626'; // rojo 12pm (almuerzo)
                            return undefined;
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    ticks: { font: { size: 10 } }
                }
            }
        }
    });
}


let _estadPersonaChartInstance = null;

async function estad_cargarEvaluacionPersona() {
    const selPersona  = document.getElementById('estadPersonaSelect');
    const inputRango  = document.getElementById('estadPersonaRangoInput');
    const kpiEl       = document.getElementById('estadPersonaKPIs');
    const canvas      = document.getElementById('estadPersonaCanvas');

    if (!selPersona || !selPersona.value) return;
    const persona = selPersona.value;

    const rangoSemanaDef = estad_obtenerRangoSemanaActual();
    let fechaDesde = rangoSemanaDef[0];
    let fechaHasta = rangoSemanaDef[1];

    if (inputRango && inputRango.value) {
        const partes = inputRango.value.split(' a ');
        if (partes.length === 2) {
            fechaDesde = partes[0].trim();
            fechaHasta = partes[1].trim();
        } else if (partes.length === 1 && partes[0].trim()) {
            fechaDesde = partes[0].trim();
            fechaHasta = fechaDesde;
        }
    }

    if (kpiEl) {
        kpiEl.innerHTML = `
            <div class="col-12 text-center py-2 text-muted" style="font-size:0.75rem;">
                <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                Procesando evaluación por día para <strong>${persona}</strong>...
            </div>`;
    }

    try {
        const resp = await fetch(
            `${SUPABASE_URL_DT}/rest/v1/distribuciones` +
            `?colaborador=ilike.${encodeURIComponent(persona)}` +
            `&select=id_distribucion,colaborador,estado,inicio,fin,duracion,duracion_pausas,datos_distribucion,fecha_distribucion,created_at` +
            `&order=created_at.desc` +
            `&limit=1000`,
            { headers: { 'apikey': SUPABASE_ANON_KEY_DT, 'Authorization': `Bearer ${SUPABASE_ANON_KEY_DT}` } }
        );

        if (!resp.ok) throw new Error('Error al consultar datos');
        let allDists = await resp.json() || [];

        // Solo distribuciones finalizadas para evaluación de rendimiento
        allDists = allDists.filter(d => d.estado === 'FINALIZADO');

        const ahora = new Date();
        const hoyStr = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;

        console.log('[EvalPersona] persona:', persona, '| fechaDesde:', fechaDesde, '| fechaHasta:', fechaHasta, '| hoyStr:', hoyStr);
        console.log('[EvalPersona] Total FINALIZADOS de Supabase:', allDists.length);

        // Extraer fecha YYYY-MM-DD: prioridad = inicio > fin > fecha_distribucion > created_at
        // inicio/fin = cuándo se HIZO el trabajo real
        // fecha_distribucion = fecha del documento (generalmente coincide con el día de trabajo)
        // created_at = fecha de inserción en BD (NO confiable, puede ser importación masiva)
        const extraerFechaLocal = d => {
            const raw = d.inicio || d.fin || d.fecha_distribucion || d.created_at;
            if (!raw) return hoyStr;
            const match = String(raw).match(/^(\d{4}-\d{2}-\d{2})/);
            if (match) return match[1];
            return hoyStr;
        };

        // Filtrar distribuciones dentro del rango de fechas (fechaDesde -> fechaHasta)
        const dists = allDists.filter(d => {
            const fStr = extraerFechaLocal(d);
            return fStr >= fechaDesde && fStr <= fechaHasta;
        });

        console.log('[EvalPersona] Distribuciones en rango:', dists.length);
        if (dists.length > 0) {
            const conteoFechas = {};
            dists.forEach(d => {
                const f = extraerFechaLocal(d);
                conteoFechas[f] = (conteoFechas[f] || 0) + 1;
            });
            console.log('[EvalPersona] Conteo por fecha:', conteoFechas);
        }

        // Helper interno para obtener cantidad exacta de un lote
        function obtenerCant(d) {
            const rec = String(d.id_distribucion);

            if (d.cantidad && parseInt(d.cantidad) > 0) return parseInt(d.cantidad);
            if (d.CANTIDAD && parseInt(d.CANTIDAD) > 0) return parseInt(d.CANTIDAD);

            if (d.datos_distribucion) {
                try {
                    const dd = typeof d.datos_distribucion === 'string'
                        ? JSON.parse(d.datos_distribucion)
                        : d.datos_distribucion;
                    if (dd) {
                        if (dd.CANTIDAD || dd.cantidad) return parseInt(dd.CANTIDAD || dd.cantidad) || 0;
                        if (dd.total_cantidad || dd.CANTIDAD_TOTAL) return parseInt(dd.total_cantidad || dd.CANTIDAD_TOTAL) || 0;
                        if (dd.Clientes) {
                            let totalCli = 0;
                            Object.values(dd.Clientes).forEach(cli => {
                                if (Array.isArray(cli.distribucion)) {
                                    cli.distribucion.forEach(item => totalCli += parseInt(item.cantidad) || 0);
                                } else if (cli.cantidad) {
                                    totalCli += parseInt(cli.cantidad) || 0;
                                }
                            });
                            if (totalCli > 0) return totalCli;
                        }
                    }
                } catch (_) {}
            }
            return 0;
        }

        let totalUnidades = 0;
        let totalSecTrabajados = 0;

        dists.forEach(d => {
            totalUnidades += obtenerCant(d);
            totalSecTrabajados += estad_hmsASegundos(d.duracion);
        });

        // Meta esperada de unidades según el tiempo real dedicado a la operación (4 seg / prenda)
        const metaUnidadesEsperadas = Math.round(totalSecTrabajados / 4);
        const segPorPrenda = totalUnidades > 0 ? (totalSecTrabajados / totalUnidades) : 0;
        const eficPct = segPorPrenda > 0 ? Math.round((4 / segPorPrenda) * 100) : 0;

        // Calificación cualitativa basada en eficiencia sobre el tiempo dedicado
        let calificacion = { texto: 'SIN DATOS EN PERIODO', color: 'var(--text-muted)', bg: '#f1f5f9' };
        if (dists.length > 0 && totalUnidades > 0) {
            if (eficPct >= 100)      calificacion = { texto: 'SOBRESALIENTE ⭐', color: '#047857', bg: '#d1fae5' };
            else if (eficPct >= 80) calificacion = { texto: 'BUENO 👍',         color: '#b45309', bg: '#fef3c7' };
            else if (eficPct >= 60) calificacion = { texto: 'REGULAR ⚠️',       color: '#c2410c', bg: '#ffedd5' };
            else                     calificacion = { texto: 'BAJO RENDIMIENTO 🔴', color: '#b91c1c', bg: '#fee2e2' };
        }

        if (kpiEl) {
            kpiEl.innerHTML = `
                <div class="col-6 col-md-3">
                    <div class="p-2 rounded h-100" style="background:var(--bg-secondary); border:1px solid var(--border-light);">
                        <div class="text-muted" style="font-size:0.65rem; font-weight:700; text-transform:uppercase;">Calificación</div>
                        <div class="fw-bold mt-1" style="font-size:0.82rem; color:${calificacion.color}; background:${calificacion.bg}; padding:3px 8px; border-radius:6px; display:inline-block;">
                            ${calificacion.texto}
                        </div>
                        <div class="text-muted mt-1" style="font-size:0.63rem;">${dists.length} lote${dists.length !== 1 ? 's' : ''} en operación</div>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="p-2 rounded h-100" style="background:var(--bg-secondary); border:1px solid var(--border-light);">
                        <div class="text-muted" style="font-size:0.65rem; font-weight:700; text-transform:uppercase;">Eficiencia en Operación</div>
                        <div class="fw-bold" style="font-size:0.95rem; color:${estad_colorEfic(eficPct)};">${eficPct}%</div>
                        <div class="text-muted" style="font-size:0.63rem;">${segPorPrenda > 0 ? segPorPrenda.toFixed(1) + 's / prenda' : '—'} (meta 4s)</div>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="p-2 rounded h-100" style="background:var(--bg-secondary); border:1px solid var(--border-light);">
                        <div class="text-muted" style="font-size:0.65rem; font-weight:700; text-transform:uppercase;">Tiempo Empleado</div>
                        <div class="fw-bold" style="font-size:0.95rem; color:var(--text-primary);"><i class="fas fa-stopwatch text-primary me-1"></i>${estad_segAHMS(totalSecTrabajados)}</div>
                        <div class="text-muted" style="font-size:0.63rem;">dedicado a separación</div>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="p-2 rounded h-100" style="background:var(--bg-secondary); border:1px solid var(--border-light);">
                        <div class="text-muted" style="font-size:0.65rem; font-weight:700; text-transform:uppercase;">Producción vs Meta</div>
                        <div class="fw-bold" style="font-size:0.95rem; color:var(--info-color);">${totalUnidades.toLocaleString()} <span style="font-size:0.7rem; font-weight:normal;">/ ${metaUnidadesEsperadas.toLocaleString()} meta</span></div>
                        <div class="text-muted" style="font-size:0.63rem;">según tiempo empleado</div>
                    </div>
                </div>
            `;
        }

        // ── Agrupar SIEMPRE por Día (Formato Local sin desfase UTC) ─────────────
        const diasMap   = {};
        const segMap    = {};
        const lotesMap  = {};

        const [y1, m1, d1] = fechaDesde.split('-').map(Number);
        const [y2, m2, d2] = fechaHasta.split('-').map(Number);

        const fechaIter = new Date(y1, m1 - 1, d1, 12, 0, 0);
        const fechaFin  = new Date(y2, m2 - 1, d2, 12, 0, 0);

        while (fechaIter <= fechaFin) {
            const yr = fechaIter.getFullYear();
            const mo = String(fechaIter.getMonth() + 1).padStart(2, '0');
            const dy = String(fechaIter.getDate()).padStart(2, '0');
            const key = `${yr}-${mo}-${dy}`;

            diasMap[key]  = 0;
            segMap[key]   = 0;
            lotesMap[key] = 0;

            fechaIter.setDate(fechaIter.getDate() + 1);
        }

        dists.forEach(d => {
            const f = extraerFechaLocal(d);
            const cant = obtenerCant(d);
            const sec  = estad_hmsASegundos(d.duracion);
            
            if (diasMap[f] !== undefined) {
                diasMap[f]  += cant;
                segMap[f]   += sec;
                lotesMap[f] += 1;
            } else {
                diasMap[f]  = cant;
                segMap[f]   = sec;
                lotesMap[f] = 1;
            }
        });

        const labels             = [];
        const datosUnidades      = [];
        const datosMetaTiempo    = [];
        const datosEficiencia    = [];
        const metaEficienciaLine = [];
        const tiemposFormateados = [];

        const fechasOrdenadas = Object.keys(diasMap).sort();
        fechasOrdenadas.forEach(f => {
            const dt = new Date(f + 'T12:00:00');
            const labelDia = dt.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
            labels.push(labelDia);

            const uds = diasMap[f];
            const sec = segMap[f];
            const metaUdsTiempo = Math.round(sec / 4); // Meta de unidades estrictamente para los segundos trabajados ese día

            datosUnidades.push(uds);
            datosMetaTiempo.push(metaUdsTiempo);
            tiemposFormateados.push(estad_segAHMS(sec));

            const sp = (uds > 0 && sec > 0) ? (sec / uds) : 0;
            const ef = sp > 0 ? Math.round((4 / sp) * 100) : 0;
            datosEficiencia.push(ef);
            metaEficienciaLine.push(100);
        });

        // Renderizar gráfica combo con Chart.js
        if (!canvas || typeof Chart === 'undefined') return;

        if (_estadPersonaChartInstance) {
            _estadPersonaChartInstance.destroy();
            _estadPersonaChartInstance = null;
        }

        const ctx = canvas.getContext('2d');
        _estadPersonaChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Unidades Producidas',
                        data: datosUnidades,
                        backgroundColor: 'rgba(59, 130, 246, 0.78)',
                        borderColor: '#2563eb',
                        borderWidth: 1,
                        borderRadius: 4,
                        yAxisID: 'yUnits',
                        order: 3
                    },
                    {
                        label: 'Meta Esperada (según tiempo empleado)',
                        data: datosMetaTiempo,
                        type: 'line',
                        borderColor: '#94a3b8',
                        borderWidth: 1.5,
                        borderDash: [3, 3],
                        pointRadius: 3,
                        pointBackgroundColor: '#94a3b8',
                        fill: false,
                        yAxisID: 'yUnits',
                        order: 2
                    },
                    {
                        label: 'Eficiencia % Real (vs Meta 4s)',
                        data: datosEficiencia,
                        type: 'line',
                        borderColor: '#f59e0b',
                        backgroundColor: '#f59e0b',
                        borderWidth: 2.5,
                        pointRadius: 4,
                        yAxisID: 'yEfic',
                        order: 1
                    },
                    {
                        label: 'Meta Eficiencia (100%)',
                        data: metaEficienciaLine,
                        type: 'line',
                        borderColor: '#10b981',
                        borderWidth: 1.5,
                        borderDash: [4, 4],
                        pointRadius: 0,
                        fill: false,
                        yAxisID: 'yEfic',
                        order: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { boxWidth: 12, font: { size: 11 }, usePointStyle: true }
                    },
                    tooltip: {
                        callbacks: {
                            title(items) {
                                const idx = items[0]?.dataIndex ?? 0;
                                const tForm = tiemposFormateados[idx] || '0s';
                                return `${labels[idx]} — Tiempo en separación: ${tForm}`;
                            },
                            footer(tooltipItems) {
                                const idx = tooltipItems[0]?.dataIndex ?? 0;
                                const udsReal = datosUnidades[idx] || 0;
                                const udsMeta = datosMetaTiempo[idx] || 0;
                                const ef      = datosEficiencia[idx] || 0;
                                if (udsMeta > 0) {
                                    return `Uds Reales: ${udsReal.toLocaleString()} / Meta esperada: ${udsMeta.toLocaleString()}\nEficiencia: ${ef}%`;
                                }
                                return 'Sin actividad de separación este día.';
                            }
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { font: { size: 10 } } },
                    yUnits: {
                        type: 'linear',
                        position: 'left',
                        beginAtZero: true,
                        title: { display: true, text: 'Unidades', font: { size: 10 } },
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        ticks: { font: { size: 10 } }
                    },
                    yEfic: {
                        type: 'linear',
                        position: 'right',
                        beginAtZero: true,
                        suggestedMax: 120,
                        title: { display: true, text: 'Eficiencia %', font: { size: 10 } },
                        grid: { display: false },
                        ticks: {
                            font: { size: 10 },
                            callback: value => value + '%'
                        }
                    }
                }
            }
        });

    } catch (err) {
        console.error('Error cargando evaluación persona:', err);
        if (kpiEl) {
            kpiEl.innerHTML = `<div class="col-12 alert alert-warning p-2 small mb-0"><i class="fas fa-exclamation-triangle me-1"></i>No se pudieron cargar los datos de evaluación para esta selección.</div>`;
        }
    }
}

function estad_nombreCorto(nombre) {
    const p = (nombre || '').trim().split(/\s+/);
    return p.length >= 2 ? `${p[0]} ${p[p.length - 1]}` : nombre;
}

window.mostrarEstadisticas = mostrarEstadisticas;
window.cargarEstadisticas  = cargarEstadisticas;
window.estad_toggleFiltroFinalizados = estad_toggleFiltroFinalizados;
window.estad_cargarEvaluacionPersona = estad_cargarEvaluacionPersona;


