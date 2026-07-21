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
            tieneClientes:  item.DISTRIBUCION?.Clientes &&
                            Object.keys(item.DISTRIBUCION.Clientes).length > 0,
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
                        <th>Prenda</th>
                        <th>Lote</th>
                        <th>RefProv</th>
                        <th>Factura</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td colspan="11" class="text-center text-muted py-4">
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
                    <th>Prenda</th>
                    <th>Lote</th>
                    <th>RefProv</th>
                    <th>Factura</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td colspan="11" class="text-center text-danger py-4">
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
                    <th>Prenda</th>
                    <th>Lote</th>
                    <th>RefProv</th>
                    <th>Factura</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td colspan="11" class="text-center text-muted py-4">
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
                    if (data.tieneFactura) {
                        return `
                            <span class="badge bg-success" title="Factura: ${data.nroFactura}">
                                <i class="fas fa-check"></i>
                                <span class="hide-xs ms-1">Facturado</span>
                            </span>
                        `;
                    } else {
                        return `
                            <span class="badge bg-secondary" title="Sin factura">
                                <i class="fas fa-times"></i>
                                <span class="hide-xs ms-1">Sin factura</span>
                            </span>
                        `;
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
                    '<tr><td colspan="11" class="text-center text-muted py-4">No se encontraron documentos</td></tr>'
                );
            }

            if (filtrosActivos.busqueda) {
                api.search(filtrosActivos.busqueda).draw();
            }
        }
    });

    configurarFiltroFecha();

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

// Estado del módulo de estadísticas
let _estadColaboradores = [];   // cache tras la última carga
let _estadMeta          = 4;    // seg/prenda meta
let _estadTopPorEfic    = true; // true = eficiencia, false = cantidad

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
    if (contenido)  contenido.innerHTML  = `
        <div class="text-center py-5">
            <div class="spinner-border" style="color:var(--accent-color); width:2rem; height:2rem;" role="status"></div>
            <p class="mt-2 small" style="color:var(--text-muted);">Procesando datos...</p>
        </div>`;
    if (tarjetasEl) tarjetasEl.innerHTML = '';

    const META_SEG = 4;

    try {
        // ── 1. Obtener distribuciones del día desde Supabase ──────────────────
        // Incluimos datos_distribucion para calcular cantidades directamente del JSONB
        // sin depender de la tabla ingresos (evita problemas de RLS y relaciones)
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

        if (!dists || dists.length === 0) {
            if (contenido) contenido.innerHTML = `
                <div class="alert alert-info mb-0" style="border-radius:var(--radius-md);">
                    <i class="fas fa-info-circle me-2"></i>
                    No hay distribuciones registradas para esta fecha.
                </div>`;
            if (tarjetasEl) tarjetasEl.innerHTML = estad_tarjetasVacias();
            return;
        }

        // ── 2. Calcular cantidades desde datos_distribucion JSONB ─────────────
        //
        //  datos_distribucion.Clientes[nombre].distribucion[].cantidad
        //  Sumamos todas las unidades distribuidas a todos los clientes.
        //  Esta es la cantidad real separada — igual a lo que muestra la tabla.
        //
        //  Fallback: cruzar con window.datosGlobales / documentosGlobales si JSONB vacío.

        const cantMap = {};

        // Pre-cargar desde memoria (activos)
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

        // Calcular desde JSONB para los que no estén en memoria o sean 0
        dists.forEach(dist => {
            const rec = String(dist.id_distribucion);
            if (cantMap[rec] > 0) return; // ya lo tenemos

            let cantJSONB = 0;
            try {
                // datos_distribucion puede venir como string o como objeto
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

        // ── 3. Agrupar por colaborador ────────────────────────────────────────
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
            const cant    = cantMap[rec] || 0;
            const secTrab = estad_hmsASegundos(dist.duracion);
            const secPaus = estad_hmsASegundos(dist.duracion_pausas);
            const nPausas = parseInt(dist.pausas) || 0;

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

        // ── 4. Totales globales ───────────────────────────────────────────────────
        const tot = colaboradores.reduce((a, c) => ({
            lotes:         a.lotes         + c.lotes,
            unidades:      a.unidades      + c.unidades,
            secTrabajados: a.secTrabajados + c.secTrabajados,
            secPausas:     a.secPausas     + c.secPausas,
            numPausas:     a.numPausas     + c.numPausas,
        }), { lotes: 0, unidades: 0, secTrabajados: 0, secPausas: 0, numPausas: 0 });

        const totSegPrenda  = tot.unidades > 0 ? tot.secTrabajados / tot.unidades : 0;
        const totEficPct    = totSegPrenda > 0 ? Math.round((META_SEG / totSegPrenda) * 100) : 0;

        // ── 5. Cachear y renderizar ───────────────────────────────────────────────
        _estadColaboradores = colaboradores;  // guardar para el switch
        _estadMeta          = META_SEG;

        if (tarjetasEl) {
            tarjetasEl.innerHTML = estad_tarjetasGlobales(tot, totSegPrenda, totEficPct);
        }
        if (contenido) {
            contenido.innerHTML = estad_renderCuerpo(colaboradores, META_SEG, dists.length);
        }

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

    // Actualizar label y estado visual del switch
    const lbl    = document.getElementById('estadSwitchLabel');
    const sw     = document.querySelector('.estad-switch');
    const titulo = document.querySelector('#estadPodioContainer')
        ?.closest('.mb-3')
        ?.querySelector('p');

    if (lbl)    lbl.textContent = _estadTopPorEfic ? 'Por eficiencia' : 'Por cantidad';
    if (sw)     sw.classList.toggle('activo', !_estadTopPorEfic);
    if (titulo) titulo.innerHTML = `<i class="fas fa-trophy me-1" style="color:var(--warning-color);"></i>Top del día — ${_estadTopPorEfic ? 'por eficiencia' : 'por cantidad'}`;

    // Re-ordenar sin recargar datos
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

        // Stat principal depende del modo activo
        const statPrincipalVal   = _estadTopPorEfic
            ? `${efPct}%`
            : c.unidades.toLocaleString();
        const statPrincipalLabel = _estadTopPorEfic ? 'eficiencia' : 'unidades';
        const barraW             = _estadTopPorEfic
            ? Math.min(efPct, 100)
            : 0; // no mostrar barra en modo cantidad (no hay máximo relativo)

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

    // ── Filas de tabla (ya ordenadas por eficiencia)
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
        <div class="mb-3">
            <div class="d-flex align-items-center justify-content-between mb-2">
                <p class="small fw-semibold mb-0" style="color:var(--text-secondary); text-transform:uppercase; letter-spacing:.04em; font-size:0.72rem;">
                    <i class="fas fa-trophy me-1" style="color:var(--warning-color);"></i>Top del día — por eficiencia
                </p>
                <!-- Switch modo -->
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
        <p class="mt-2 mb-0" style="font-size:0.7rem; color:var(--text-muted);">
            <i class="fas fa-info-circle me-1"></i>
            Eficiencia = (4s ÷ seg/prenda) × 100. Meta: 4 seg/prenda.
            Valores &gt;100% indican rendimiento sobre la meta.
        </p>`;
}

function estad_nombreCorto(nombre) {
    const p = (nombre || '').trim().split(/\s+/);
    return p.length >= 2 ? `${p[0]} ${p[p.length - 1]}` : nombre;
}

window.mostrarEstadisticas = mostrarEstadisticas;
window.cargarEstadisticas  = cargarEstadisticas;
