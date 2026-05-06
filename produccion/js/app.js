// App principal - ULTRA OPTIMIZADO con Grid.js

let grid = null;
let allData = [];
let filteredData = [];
let cardsVisible = 20;
let cardsObserver = null;
let primerDia = getPrimerDiaMes();
let hoy = getHoy();


function getPrimerDiaMes() {
    const hoy = new Date();
    return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
}

function getHoy() {
    return new Date();
}

function formatearFecha(fecha) {
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function calcularDiasNumero(fechaSiesa, entregas) {
    if (!fechaSiesa) return 0;
    const fechaSiesaDate = new Date(fechaSiesa + 'T00:00:00-05:00');
    let fechaComparacion;
    if (entregas.length > 0 && entregas[0].Registro) {
        fechaComparacion = new Date(entregas[0].Registro);
    } else {
        const ahora = new Date();
        const colombiaOffset = -5 * 60;
        const localOffset = ahora.getTimezoneOffset();
        const diffOffset = colombiaOffset - localOffset;
        fechaComparacion = new Date(ahora.getTime() + diffOffset * 60 * 1000);
    }
    return Math.floor((fechaComparacion - fechaSiesaDate) / (1000 * 60 * 60 * 24));
}

function calcularDias(fechaSiesa, entregas) {
    const dias = calcularDiasNumero(fechaSiesa, entregas);
    let className = '';
    if (dias <= 2) className = 'dias-ok';
    else if (dias <= 5) className = 'dias-warning';
    else className = 'dias-danger';
    return gridjs.html(`<span class="dias-badge ${className}">${dias} día${dias !== 1 ? 's' : ''}</span>`);
}

function poblarFiltros(data) {
    const clientes = [...new Set(data.map(f => f['Razón social cliente factura']).filter(v => v))].sort();
    const proveedores = [...new Set(data.map(f => f.proveedor).filter(v => v))].sort();
    const estados = [...new Set(data.map(f => f.Estado).filter(v => v))].sort();
    const tipos = [...new Set(data.map(f => f.tipo).filter(v => v))].sort();
    
    $('#filtroCliente').html('<option value="">Todos</option>' + clientes.map(c => `<option value="${c}">${c}</option>`).join(''));
    $('#filtroProveedor').html('<option value="">Todos</option>' + proveedores.map(p => `<option value="${p}">${p}</option>`).join(''));
    
    // Multi-select de Estado: OWNER y ADMIN ven todos los estados (incluidas Anuladas), otros no ven Anuladas
    const user_role_filtro = (JSON.parse(localStorage.getItem('user') || '{}')).rol || '';
    const canSeeAnuladas = user_role_filtro === 'OWNER' || user_role_filtro === 'ADMIN';
    
    const estadosFiltrados = canSeeAnuladas ? estados : estados.filter(e => e !== 'Anuladas');
    
    // Por defecto solo "Aprobadas" está marcado
    const estadoCheckboxes = estadosFiltrados.map(e => {
        const checked = e === 'Aprobadas' ? 'checked' : '';
        return `<label class="filtro-estado-item"><input type="checkbox" value="${e}" ${checked}> ${e}</label>`;
    }).join('');
    $('#filtroEstadoDropdown').html(estadoCheckboxes);
    actualizarLabelEstado();

    // Multi-select de tipo: para admin/owner REMISION y OFICAL por defecto; para otros, todos marcados
    const canSeeAllTipos = user_role_filtro === 'OWNER' || user_role_filtro === 'ADMIN';
    const DEFAULT_TIPOS_UPPER = canSeeAllTipos ? ['REMISION', 'OFICAL', 'OFICIAL'] : null; // null = todos
    const tipoCheckboxes = tipos.map(t => {
        const checked = (DEFAULT_TIPOS_UPPER === null || DEFAULT_TIPOS_UPPER.includes(t.toUpperCase())) ? 'checked' : '';
        return `<label class="filtro-tipo-item"><input type="checkbox" value="${t}" ${checked}> ${t}</label>`;
    }).join('');
    $('#filtroTipoDropdown').html(tipoCheckboxes);
    actualizarLabelTipo();
}

function aplicarFiltros() {
    cardsVisible = 20;
    const filtroCliente = $('#filtroCliente').val();

    const filtroProveedor = $('#filtroProveedor').val();
    // Leer estados seleccionados del multi-select
    const filtroEstados = $('#filtroEstadoDropdown input[type=checkbox]:checked').map(function() { return this.value; }).get();
    // Leer tipos seleccionados del multi-select
    const filtroTipos = $('#filtroTipoDropdown input[type=checkbox]:checked').map(function() { return this.value; }).get();
    const filtroConfirmacion = $('#filtroConfirmacion').val();
    const busca = (window.activeColumnSearch ? '' : (window._spotlightQuery || '')).toLowerCase();
    
    // Sincronizar visual de tarjetas si se cambia el select
    $('.stat-card').removeClass('active');
    if (filtroConfirmacion === 'ENTREGADO') $('.stat-delivered').addClass('active');
    if (filtroConfirmacion === 'PENDIENTE') $('.stat-pending').addClass('active');
    
    filteredData = allData.filter(row => {
        // Soporte para búsqueda por columna específica desde Spotlight
        const columnSearch = window.activeColumnSearch; // { column: 'Nro documento', text: '...' }
        
        if (columnSearch && columnSearch.text) {
            const val = String(row[columnSearch.column] || '').toLowerCase();
            if (!val.includes(columnSearch.text.toLowerCase())) return false;
        } else if (busca) {
            const contenido = Object.values(row).join(' ').toLowerCase();
            if (!contenido.includes(busca)) return false;
        }

        if (filtroCliente && row['Razón social cliente factura'] !== filtroCliente) return false;
        if (filtroProveedor && row.proveedor !== filtroProveedor) return false;
        // Si hay estados seleccionados, filtrar; si no hay ninguno, mostrar todos
        if (filtroEstados.length > 0 && !filtroEstados.includes(row.Estado)) return false;
        // Si hay tipos seleccionados, filtrar; si no hay ninguno, mostrar todos
        if (filtroTipos.length > 0 && !filtroTipos.includes(row.tipo)) return false;
        if (filtroConfirmacion && row.confirmacion !== filtroConfirmacion) return false;
        return true;
    });
    
    // Guardar filtros en localStorage si está habilitada la persistencia
    const persistenciaHabilitada = $('#switchPersistencia').is(':checked');
    if (persistenciaHabilitada) {
        const filtrosDoc = {
            cliente: filtroCliente,
            proveedor: filtroProveedor,
            estados: filtroEstados,
            tipos: filtroTipos,
            confirmacion: filtroConfirmacion,
            search: busca
        };
        localStorage.setItem('siesa_filtros', JSON.stringify(filtrosDoc));
    }

    actualizarGrid();
    renderizarTarjetas();
    actualizarStats();
}

function actualizarStats() {
    const entregadas = filteredData.filter(f => f.confirmacion === 'ENTREGADO');
    const pendientes = filteredData.filter(f => f.confirmacion === 'PENDIENTE');
    
    const total = filteredData.length;
    
    // Entregadas
    const countEnt = entregadas.length;
    const valEnt = entregadas.reduce((acc, f) => acc + (parseFloat(f['Valor subtotal local']) || 0), 0);
    const unitsEnt = entregadas.reduce((acc, f) => acc + (parseFloat(f['Cantidad inv.']) || 0), 0);
    const percEnt = total > 0 ? Math.round((countEnt / total) * 100) : 0;
    
    // Pendientes
    const countPend = pendientes.length;
    const valPend = pendientes.reduce((acc, f) => acc + (parseFloat(f['Valor subtotal local']) || 0), 0);
    const unitsPend = pendientes.reduce((acc, f) => acc + (parseFloat(f['Cantidad inv.']) || 0), 0);
    const percPend = total > 0 ? Math.round((countPend / total) * 100) : 0;
    
    // Actualizar UI
    $('#countEntregadas').text(countEnt.toLocaleString('es-CO'));
    $('#valEntregadas').text('$' + Math.round(valEnt).toLocaleString('es-CO'));
    $('#unitsEntregadas').text(Math.round(unitsEnt).toLocaleString('es-CO'));
    $('#percentEntregadas').text(percEnt + '%');
    
    $('#countPendientes').text(countPend.toLocaleString('es-CO'));
    $('#valPendientes').text('$' + Math.round(valPend).toLocaleString('es-CO'));
    $('#unitsPendientes').text(Math.round(unitsPend).toLocaleString('es-CO'));
    $('#percentPendientes').text(percPend + '%');
    $('#percentPendientes').text(percPend + '%');
}

async function actualizarEstadoSiesa(documento, nuevoEstado) {
    try {
        // Obtener token de autenticación
        const user = JSON.parse(localStorage.getItem('user') || '{}')
        if (!user || !window.supabase) {
            throw new Error('No hay sesión activa')
        }
        
        const { data: { session } } = await window.supabase.auth.getSession()
        if (!session) {
            throw new Error('Sesión expirada. Por favor inicia sesión nuevamente.')
        }
        
        const response = await fetch(`${SiesaConfig.FUNCTIONS_URL}/delivery-operations`, {
            method: 'PATCH',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ documento, nuevoEstado })
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.error);
        
        // Actualizar datos locales
        const index = allData.findIndex(f => f['Nro documento'] === documento);
        if (index !== -1) allData[index].Estado = nuevoEstado;
        
        const filteredIndex = filteredData.findIndex(f => f['Nro documento'] === documento);
        if (filteredIndex !== -1) filteredData[filteredIndex].Estado = nuevoEstado;

        actualizarGrid();
        renderizarTarjetas();
    } catch (error) {
        console.error('❌ Error actualizando estado:', error);
        alert('Error al actualizar estado: ' + error.message);
        
        // Si es error de autenticación, redirigir al login
        if (error.message.includes('sesión') || error.message.includes('autenticación')) {
            window.location.reload();
        }
    }
}

async function actualizarOPSiesa(documento, nuevaOP) {
    try {
        // Obtener token de autenticación
        const user = JSON.parse(localStorage.getItem('user') || '{}')
        if (!user || !window.supabase) {
            throw new Error('No hay sesión activa')
        }
        
        const { data: { session } } = await window.supabase.auth.getSession()
        if (!session) {
            throw new Error('Sesión expirada. Por favor inicia sesión nuevamente.')
        }
        
        const response = await fetch(`${SiesaConfig.FUNCTIONS_URL}/delivery-operations`, {
            method: 'PATCH',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ documento, nuevaOP })
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.error);
        
        // Actualizar datos locales
        const fIndex = allData.findIndex(f => f['Nro documento'] === documento);
        if (fIndex !== -1) allData[fIndex].op = nuevaOP;
        
        const filteredIndex = filteredData.findIndex(f => f['Nro documento'] === documento);
        if (filteredIndex !== -1) filteredData[filteredIndex].op = nuevaOP;

    } catch (error) {
        console.error('❌ Error actualizando OP:', error);
        alert('Error al actualizar OP: ' + error.message);
        
        // Si es error de autenticación, redirigir al login
        if (error.message.includes('sesión') || error.message.includes('autenticación')) {
            window.location.reload();
        }
    }
}

function habilitarEdicionOP(container, documento) {
    if (container.classList.contains('editing')) return;
    
    const span = container.querySelector('.op-text');
    const valorActual = (span.innerText === '-' || span.innerText === 'Sin OP') ? '' : span.innerText;
    
    container.classList.add('editing');
    container.innerHTML = `
        <input type="text" class="input-op-siesa" 
               value="${valorActual}" 
               onblur="finalizarEdicionOP(this, '${documento}')"
               onkeyup="if(event.key==='Enter') this.blur()">
    `;
    container.querySelector('input').focus();
}

async function finalizarEdicionOP(input, documento) {
    const nuevaOP = input.value;
    const container = input.parentElement;
    
    // Actualizar visual inmediatamente (optimista)
    container.classList.remove('editing');
    container.innerHTML = `
        <span class="op-text">${nuevaOP || '-'}</span>
    `;
    
    // Guardar en Supabase
    await actualizarOPSiesa(documento, nuevaOP);
}

function actualizarGrid() {
    if (grid && filteredData) {
        const estadosDisponibles = ['Aprobadas', 'Anuladas', 'En elaboración'];
        
        // Verificar permisos del usuario
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const canEdit = user.rol === 'OWNER' || user.rol === 'ADMIN';
        
        grid.updateConfig({
            data: filteredData.map(f => {
                // Estado: Select editable solo para ADMIN/OWNER, texto plano para otros
                const selectEstado = canEdit ? gridjs.html(`
                    <select class="form-select form-select-sm select-estado-siesa" 
                            onchange="actualizarEstadoSiesa('${f['Nro documento']}', this.value)">
                        ${estadosDisponibles.map(e => `<option value="${e}" ${f.Estado === e ? 'selected' : ''}>${e}</option>`).join('')}
                        ${!estadosDisponibles.includes(f.Estado) ? `<option value="${f.Estado}" selected>${f.Estado}</option>` : ''}
                    </select>
                `) : gridjs.html(`
                    <span>${f.Estado || '-'}</span>
                `);

                // OP: Editable solo para ADMIN/OWNER, texto plano para otros
                const displayOP = canEdit ? gridjs.html(`
                    <div class="editable-op-container" onclick="habilitarEdicionOP(this, '${f['Nro documento']}')">
                        <span class="op-text">${f.op || '-'}</span>
                    </div>
                `) : gridjs.html(`
                    <span>${f.op || '-'}</span>
                `);

                return [
                    selectEstado, f['Nro documento'], f.Fecha, f['Razón social cliente factura'], f.Notas || '-', f.proveedor || '-',
                    f['Valor subtotal local'] ? '$' + Math.round(parseFloat(f['Valor subtotal local'])).toLocaleString('es-CO') : '$0',
                    f.Referencia || '-', f['Cantidad inv.'] ? Math.round(f['Cantidad inv.']).toLocaleString('es-CO') : '0',
                    f.referencias_detalle ? gridjs.html((typeof f.referencias_detalle === 'string' ? JSON.parse(f.referencias_detalle) : f.referencias_detalle).map(ref => `<div class="ref-detalle">${ref.referencia} (${ref.cantidad}) - $${Math.round(ref.valor_subtotal).toLocaleString('es-CO')}</div>`).join('')) : '-',
                    displayOP, f.tipo || '-',
                    gridjs.html(f.entregas.length > 0 ? '<span class="badge badge-entregado">ENTREGADO</span>' : '<span class="badge badge-pendiente">PENDIENTE</span>'),
                    calcularDias(f.Fecha, f.entregas),
                    f.entregas.length > 0 ? gridjs.html(f.entregas.map(e => `<div class="entrega-fecha">${new Date(e.Registro).toLocaleString('es-CO', {year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'})}</div>`).join('')) : '-',
                    f.entregas.length > 0 && f.entregas[0].Url_Ih3 ? gridjs.html(`<div class="soporte-img"><a href="#" onclick="openImageModal('${f.entregas[0].Url_Ih3}', '${f['Nro documento']}', '${f.entregas[0].Registro}'); return false;"><img src="${f.entregas[0].Url_Ih3}" alt="Soporte" /></a></div>`) : '-'
                ];
            })
        }).forceRender();
    }
}

async function cargarDatos(fechaInicio, fechaFin) {
    try {
        $('#loading').show();
        
        // Obtener token de autenticación
        const user = JSON.parse(localStorage.getItem('user') || '{}')
        if (!user || !window.supabase) {
            throw new Error('No hay sesión activa')
        }
        
        const { data: { session } } = await window.supabase.auth.getSession()
        if (!session) {
            throw new Error('Sesión expirada. Por favor inicia sesión nuevamente.')
        }
        
        const fechaInicioStr = formatearFecha(fechaInicio);
        const fechaFinStr = formatearFecha(fechaFin);
        const url = `${SiesaConfig.FUNCTIONS_URL}/delivery-operations?fechaInicio=${fechaInicioStr}&fechaFin=${fechaFinStr}`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${session.access_token}`
            }
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.error);
        
        // Filtrar según permisos del usuario
        const user_role = (JSON.parse(localStorage.getItem('user') || '{}')).rol || '';
        const canSeeAll = user_role === 'OWNER' || user_role === 'ADMIN';
        
        const dataFiltrada = canSeeAll
            ? result.data // OWNER y ADMIN ven todo (incluidas Anuladas, NOTAS, DEVOLUCION)
            : result.data.filter(f => {
                // Otros roles: filtrar NOTAS y DEVOLUCION (Anuladas ya filtradas en backend)
                const tipo = (f.tipo || '').toUpperCase();
                return tipo !== 'NOTAS' && tipo !== 'DEVOLUCION';
            });
        
        allData = dataFiltrada.map(f => ({...f, confirmacion: (f.entregas || []).length > 0 ? 'ENTREGADO' : 'PENDIENTE'}));
        filteredData = [...allData];
        poblarFiltros(allData);
        
        if (!grid) {
            grid = new gridjs.Grid({
                columns: [
                    'Estado', 
                    'Documento', 
                    'Fecha', 
                    'Cliente', 
                    'Notas', 
                    { name: 'Proveedor', hidden: true }, 
                    'Valor', 
                    'Referencia', 
                    'Cantidad', 
                    'Detalles', 
                    'OP', 
                    { name: 'Tipo', hidden: true }, 
                    'Confirmacion', 
                    'Diferencia', 
                    'Entrega', 
                    'Soporte'
                ],

                data: [],
                search: false, // Usamos el buscador global personalizado
                sort: {
                    multiColumn: false
                },
                pagination: {
                    enabled: true,
                    limit: 10,
                    summary: true
                },
                fixedHeader: true,
                height: 'auto',
                language: {
                    search: {placeholder: 'Buscar...'},
                    pagination: {previous: 'Anterior', next: 'Siguiente', showing: 'Mostrando', results: () => 'registros', of: 'de', to: 'a'}
                }
            }).render(document.getElementById('deliveryTable'));
        }
        
        // Renderizar en el siguiente tick para no bloquear
        $('#loading').hide();
        
        // Mostrar mensaje de procesamiento
        if (filteredData.length > 500) {
            $('#loading .spinner-border').after('<p class="mt-2 text-white">Procesando ' + filteredData.length + ' registros...</p>');
            $('#loading').show();
        }
        
        setTimeout(() => {
            // Cargar filtros guardados si la persistencia está habilitada
            const persistenciaHabilitada = $('#switchPersistencia').is(':checked');
            if (persistenciaHabilitada) {
                const savedFilters = localStorage.getItem('siesa_filtros');
                if (savedFilters) {
                    try {
                        const p = JSON.parse(savedFilters);
                        if (p.cliente) $('#filtroCliente').val(p.cliente);
                        if (p.proveedor) $('#filtroProveedor').val(p.proveedor);
                        if (p.estados && Array.isArray(p.estados)) {
                            $('#filtroEstadoDropdown input[type=checkbox]').each(function() {
                                $(this).prop('checked', p.estados.includes(this.value));
                            });
                            actualizarLabelEstado();
                        }
                        if (p.tipos && Array.isArray(p.tipos)) {
                            $('#filtroTipoDropdown input[type=checkbox]').each(function() {
                                $(this).prop('checked', p.tipos.includes(this.value));
                            });
                            actualizarLabelTipo();
                        }
                        if (p.confirmacion) $('#filtroConfirmacion').val(p.confirmacion);
                        if (p.search) $('#globalSearch').val(p.search);
                    } catch (e) {
                        console.error('Error al restaurar filtros:', e);
                    }
                }
            } else {
                // Si no hay persistencia, asegurar que "Aprobadas" esté seleccionado por defecto
                // (ya se hace en poblarFiltros, pero lo reforzamos aquí)
                const aprobadaCheckbox = $('#filtroEstadoDropdown input[type=checkbox][value="Aprobadas"]');
                if (aprobadaCheckbox.length && !aprobadaCheckbox.is(':checked')) {
                    aprobadaCheckbox.prop('checked', true);
                    actualizarLabelEstado();
                }
            }

            actualizarGrid();
            renderizarTarjetas();
            actualizarStats();
            aplicarFiltros(); // Re-aplicar con los valores restaurados
            setupInfiniteScroll();
            $('#loading').hide();

            $('#loading p').remove();
        }, 0);
    } catch (error) {
        console.error('❌ Error:', error);
        $('#loading').hide();
        alert('Error cargando datos: ' + error.message);
    }
}

$(document).ready(function() {
    
    // Inicializar estado del switch de persistencia
    const persistenciaConfig = localStorage.getItem('siesa_persist_enabled');
    const persistenciaHabilitada = persistenciaConfig === 'true'; // Por defecto false
    $('#switchPersistencia').prop('checked', persistenciaHabilitada);

    // Cargar rango guardado si existe y está habilitada la persistencia
    if (persistenciaHabilitada) {
        const savedRange = localStorage.getItem('siesa_date_range');
        if (savedRange) {
            try {
                const parsed = JSON.parse(savedRange);
                if (parsed && parsed.length === 2) {
                    primerDia = new Date(parsed[0]);
                    hoy = new Date(parsed[1]);
                }
            } catch (e) {
                console.error('Error al cargar rango de fechas guardado:', e);
            }
        }
    }

    cargarDatos(primerDia, hoy);

    // Manejar cambio en el switch de persistencia
    $('#switchPersistencia').on('change', function() {
        const isEnabled = $(this).is(':checked');
        localStorage.setItem('siesa_persist_enabled', isEnabled);
        
        if (!isEnabled) {
            // Limpiar datos guardados si se desactiva
            localStorage.removeItem('siesa_date_range');
            localStorage.removeItem('siesa_filtros');
        } else {
            // Guardar estado actual si se activa
            aplicarFiltros();
            if (glassCalState.startDate && glassCalState.endDate) {
                localStorage.setItem('siesa_date_range', JSON.stringify([glassCalState.startDate.toISOString(), glassCalState.endDate.toISOString()]));
            }
        }
    });

    cargarDatos(primerDia, hoy);
    $('#filtroCliente, #filtroProveedor, #filtroConfirmacion').on('change', aplicarFiltros);
    // Multi-select de estado: escuchar cambios en checkboxes
    $(document).on('change', '#filtroEstadoDropdown input[type=checkbox]', function() {
        actualizarLabelEstado();
        aplicarFiltros();
    });
    // Multi-select de tipo: escuchar cambios en checkboxes
    $(document).on('change', '#filtroTipoDropdown input[type=checkbox]', function() {
        actualizarLabelTipo();
        aplicarFiltros();
    });
    

    $('#btnLimpiarFiltros').on('click', function() {
        $('#filtroCliente, #filtroProveedor, #filtroConfirmacion').val('');
        // Desmarcar todos los estados y marcar solo "Aprobadas"
        $('#filtroEstadoDropdown input[type=checkbox]').prop('checked', false);
        $('#filtroEstadoDropdown input[type=checkbox][value="Aprobadas"]').prop('checked', true);
        actualizarLabelEstado();
        // Desmarcar todos los tipos
        $('#filtroTipoDropdown input[type=checkbox]').prop('checked', false);
        actualizarLabelTipo();
        window.activeColumnSearch = null;
        window._spotlightQuery = '';
        $('.stat-card').removeClass('active');
        filteredData = [...allData];
        actualizarGrid();
        renderizarTarjetas();
        actualizarStats();
    });
    $('#btnDescargarCSV').on('click', descargarCSV);

    // Filtros rápidos por tarjetas de estadísticas
    $('.stat-delivered').on('click', function() {
        const current = $('#filtroConfirmacion').val();
        const newVal = current === 'ENTREGADO' ? '' : 'ENTREGADO';
        $('#filtroConfirmacion').val(newVal);
        
        // Actualizar visualmente las tarjetas
        $('.stat-card').removeClass('active');
        if (newVal) $(this).addClass('active');
        
        aplicarFiltros();
    });
    
    $('.stat-pending').on('click', function() {
        const current = $('#filtroConfirmacion').val();
        const newVal = current === 'PENDIENTE' ? '' : 'PENDIENTE';
        $('#filtroConfirmacion').val(newVal);
        
        // Actualizar visualmente las tarjetas
        $('.stat-card').removeClass('active');
        if (newVal) $(this).addClass('active');
        
        aplicarFiltros();
    });

    initSpotlight();

    // Gestión de visibilidad de toolbar según rol
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    if (currentUser.rol !== 'OWNER' && currentUser.rol !== 'ADMIN') {
        $('#btnUpload, #divider1').hide();
    }
});



// Función para renderizar tarjetas móviles (optimizada)
function renderizarTarjetas() {
    const container = document.getElementById('deliveryCards');
    if (!container) return;
    
    const dataToRender = filteredData.slice(0, cardsVisible);
    const hasMore = filteredData.length > cardsVisible;
    
    // Verificar permisos del usuario
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const canEdit = user.rol === 'OWNER' || user.rol === 'ADMIN';
    
    if (filteredData.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center py-5">
                <div class="mb-3" style="font-size: 3rem; opacity: 0.2;">
                    <i class="fa-solid fa-magnifying-glass"></i>
                </div>
                <h5 class="text-muted">No se encontraron resultados</h5>
                <p class="text-muted small">Intenta ajustar los filtros o términos de búsqueda</p>
            </div>
        `;
        return;
    }

    container.innerHTML = dataToRender.map((f, index) => {

        const entregas = f.entregas || [];
        const esEntregado = entregas.length > 0;
        const esAnulado = f.Estado && f.Estado.toLowerCase().includes('anulad');
        
        let cardClass = 'card-pendiente';
        if (esAnulado) cardClass = 'card-anulada';
        else if (esEntregado) cardClass = 'card-entregada';
        
        const dias = calcularDiasNumero(f.Fecha, entregas);
        let diasClass = 'dias-ok';
        if (dias > 5) diasClass = 'dias-danger';
        else if (dias > 2) diasClass = 'dias-warning';
        
        const collapseSoporteId = `collapse-sop-${index}`;
        const collapseDetalleId = `collapse-det-${index}`;
        
        const detalles = f.referencias_detalle ? (typeof f.referencias_detalle === 'string' ? JSON.parse(f.referencias_detalle) : f.referencias_detalle) : [];

        const estadosDisponibles = ['Aprobadas', 'Anuladas', 'En elaboración'];
        
        // Estado: Select editable solo para ADMIN/OWNER, texto plano para otros
        const selectEstado = canEdit ? `
            <select class="form-select form-select-sm select-estado-siesa mt-1" 
                    onchange="actualizarEstadoSiesa('${f['Nro documento']}', this.value)">
                ${estadosDisponibles.map(e => `<option value="${e}" ${f.Estado === e ? 'selected' : ''}>${e}</option>`).join('')}
                ${!estadosDisponibles.includes(f.Estado) ? `<option value="${f.Estado}" selected>${f.Estado}</option>` : ''}
            </select>
        ` : `
            <span class="mt-1">${f.Estado || '-'}</span>
        `;

        return `
            <div class="delivery-card ${cardClass} mb-3">
                <div class="card-header-custom">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h6 class="mb-1">${f['Nro documento']}</h6>
                            <small class="text-muted"><i class="far fa-calendar-alt me-1"></i>${f.Fecha}</small>
                            ${selectEstado}
                        </div>
                        <span class="badge ${esEntregado ? 'badge-entregado' : 'badge-pendiente'}">
                            ${esEntregado ? 'ENTREGADO' : 'PENDIENTE'}
                        </span>
                    </div>
                </div>
                <div class="card-body-custom">
                    <div class="info-row">
                        <span class="info-label">Cliente:</span>
                        <span class="info-value text-dark">${f['Razón social cliente factura'] || '-'}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Proveedor:</span>
                        <span class="info-value">${f.proveedor || '-'}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">OP:</span>
                        <span class="info-value">
                            ${canEdit ? `
                            <div class="editable-op-container justify-content-end" onclick="habilitarEdicionOP(this, '${f['Nro documento']}')">
                                <span class="op-text">${f.op || '-'}</span>
                            </div>
                            ` : `
                            <span>${f.op || '-'}</span>
                            `}
                        </span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Valor:</span>
                        <span class="info-value text-primary fw-bold">$${f['Valor subtotal local'] ? Math.round(parseFloat(f['Valor subtotal local'])).toLocaleString('es-CO') : '0'}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Referencia:</span>
                        <span class="info-value">${f.Referencia || '-'}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Cantidad:</span>
                        <span class="info-value">${f['Cantidad inv.'] ? Math.round(f['Cantidad inv.']).toLocaleString('es-CO') : '0'}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Tipo:</span>
                        <span class="info-value">${f.tipo || '-'}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Diferencia:</span>
                        <span class="dias-badge ${diasClass}">${dias} día${dias !== 1 ? 's' : ''}</span>
                    </div>
                    ${f.Notas ? `
                        <div class="info-row flex-column align-items-start">
                            <span class="info-label mb-1">Notas:</span>
                            <span class="info-value text-start w-100 small text-muted">${f.Notas}</span>
                        </div>
                    ` : ''}
                    ${esEntregado && entregas[0].Registro ? `
                        <div class="info-row">
                            <span class="info-label">Fecha Entrega:</span>
                            <span class="info-value text-success fw-bold">${new Date(entregas[0].Registro).toLocaleString('es-CO', {
                                year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                            })}</span>
                        </div>
                    ` : ''}

                    <!-- DETALLE DE PRODUCTOS (COLAPSABLE) -->
                    ${detalles.length > 0 ? `
                        <button class="btn-collapsible mt-3" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseDetalleId}">
                            <span><i class="fas fa-list-ul me-2"></i>Ver Detalles de Mercancía</span>
                            <i class="fas fa-chevron-down"></i>
                        </button>
                        <div class="collapse" id="${collapseDetalleId}">
                            <div class="collapsible-content">
                                ${detalles.map(ref => `
                                    <div class="product-item">
                                        <div class="product-name">${ref.referencia}</div>
                                        <div class="product-meta">
                                            <span class="badge bg-light text-dark border">Cant: ${ref.cantidad}</span>
                                            <span class="text-primary font-monospace">$${Math.round(ref.valor_subtotal).toLocaleString('es-CO')}</span>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

                    <!-- SOPORTE DE ENTREGA (COLAPSABLE - SIEMPRE AL FINAL) -->
                    ${esEntregado && entregas[0].Url_Ih3 ? `
                        <button class="btn-collapsible mt-2 btn-soporte-alt" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseSoporteId}">
                            <span><i class="fas fa-camera me-2"></i>Soporte de Entrega</span>
                            <i class="fas fa-chevron-down"></i>
                        </button>
                        <div class="collapse" id="${collapseSoporteId}">
                            <div class="collapsible-content p-0 overflow-hidden">
                                <a href="#" onclick="openImageModal('${entregas[0].Url_Ih3}', '${f['Nro documento']}', '${entregas[0].Registro}'); return false;" style="cursor: pointer;">
                                    <img src="${entregas[0].Url_Ih3}" alt="Soporte" class="img-fluid w-100" />
                                </a>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('') + (hasMore ? '<div id="cardsSentinel" style="height: 20px;"></div>' : '');
    
    // Si hay centinela, observarlo
    if (hasMore) {
        setTimeout(observeSentinel, 100);
    }
}

function observeSentinel() {
    const sentinel = document.getElementById('cardsSentinel');
    if (!sentinel) return;
    
    if (cardsObserver) cardsObserver.disconnect();
    
    cardsObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            cardsVisible += 20;
            renderizarTarjetas();
        }
    }, { threshold: 0.1 });
    
    cardsObserver.observe(sentinel);
}

function setupInfiniteScroll() {
    // Ya lo manejamos dentro de renderizarTarjetas con el centinela
}


function descargarCSV() {
    if (filteredData.length === 0) {
        alert('No hay datos para exportar');
        return;
    }

    
    // Headers en español
    const headers = [
      'Estado', 'Nro documento', 'Fecha', 'Razon Social', 'Proveedor', 'Docto Referencia',
      'Notas', 'Cia', 'OP', 'Tipo', 'Valor Subtotal', 'Referencia', 'Cantidad',
      'Confirmación', 'Fecha Confirmación', 'ID Soporte', 'Link Soporte IH3'
    ];

    const rows = filteredData.map(f => {
      const entregas = f.entregas || [];
      const fechaEntrega = (entregas.length > 0 && entregas[0].Registro) ? new Date(entregas[0].Registro).toLocaleString('es-CO') : '-';
      
      const urlImagen = (entregas.length > 0 && entregas[0].Url_Ih3) ? entregas[0].Url_Ih3 : '';

      return [
        f.Estado || '',
        f['Nro documento'] || '',
        f.Fecha || '',
        (f['Razón social cliente factura'] || '').replace(/;/g, ','),
        f.proveedor || '-',
        f['Docto. referencia'] || '',
        (f.Notas || '').replace(/;/g, ','),
        f['Compáa'] || '',
        f.op || '',
        f.tipo || '',
        f['Valor subtotal local'] || 0,
        f.Referencia || '',
        f['Cantidad inv.'] || 0,
        f.confirmacion || '',
        fechaEntrega,
        urlImagen,
        urlImagen
      ];
    });

    // Unir headers y filas con punto y coma
    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\n');

    // Añadir BOM para que Excel reconozca caracteres especiales (eñes, tildes)
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_delivery_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
}

// Event listener para botón flotante de filtros
$(document).ready(function() {
    $('#btnFiltrosMobile').on('click', function() {
        $('.filtros').toggleClass('filtros-visible');
    });
    
    $(document).on('click', function(e) {
        if (!$(e.target).closest('.filtros, #btnFiltrosMobile').length) {
            $('.filtros').removeClass('filtros-visible');
        }
    });
});

// Función para abrir el modal de imagen
function openImageModal(imageUrl, factura, fecha) {
    document.getElementById('modalImage').src = imageUrl;
    document.getElementById('modalFactura').textContent = factura;
    document.getElementById('modalFecha').textContent = new Date(fecha).toLocaleString('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const modal = new bootstrap.Modal(document.getElementById('imageModal'));
    modal.show();
}

// Exponer función globalmente
window.openImageModal = openImageModal;

// Actualiza el texto del botón del dropdown de tipo según selección
function actualizarLabelTipo() {
    const checked = $('#filtroTipoDropdown input[type=checkbox]:checked').map(function() { return this.value; }).get();
    const label = checked.length === 0 ? 'Todos' : checked.join(', ');
    $('#filtroTipoLabel').text(label);
}

// Actualiza el texto del botón del dropdown de estado según selección
function actualizarLabelEstado() {
    const checked = $('#filtroEstadoDropdown input[type=checkbox]:checked').map(function() { return this.value; }).get();
    const label = checked.length === 0 ? 'Todos' : checked.join(', ');
    $('#filtroEstadoLabel').text(label);
}

// ========== SPOTLIGHT SEARCH LOGIC ==========
window.activeColumnSearch = null;

function initSpotlight() {
    const overlay = $('#spotlightOverlay');
    const input = $('#spotlightInput');
    const results = $('#spotlightResults');
    let selectedIndex = -1;

    const options = [
        { id: 'general', title: 'Búsqueda General', subtitle: 'En todas las columnas', icon: 'fa-magnifying-glass', column: null },
        { id: 'factura', title: 'Por Factura', subtitle: 'Buscar en Documento', icon: 'fa-file-invoice-dollar', column: 'Nro documento' },
        { id: 'op', title: 'Por Orden de Producción', subtitle: 'Buscar en OP', icon: 'fa-gears', column: 'op' },
        { id: 'referencia', title: 'Por Referencia', subtitle: 'Buscar en Referencia', icon: 'fa-barcode', column: 'Referencia' },
        { id: 'fecha', title: 'Filtrar por Fecha', subtitle: 'Rango de fechas', icon: 'fa-calendar-days', action: 'date' },
        { id: 'cliente', title: 'Filtrar por Cliente', subtitle: 'Seleccionar razón social', icon: 'fa-user-tie', action: 'filter', filterType: 'cliente' },
        { id: 'proveedor', title: 'Filtrar por Proveedor', subtitle: 'Seleccionar proveedor', icon: 'fa-truck', action: 'filter', filterType: 'proveedor' },
        { id: 'estado', title: 'Filtrar por Estado', subtitle: 'Seleccionar estado factura', icon: 'fa-list-check', action: 'filter', filterType: 'estado' },
        { id: 'tipo', title: 'Filtrar por Tipo', subtitle: 'Seleccionar tipo de documento', icon: 'fa-tags', action: 'filter', filterType: 'tipo' },
        { id: 'confirmacion', title: 'Confirmación', subtitle: 'Filtrar por entregado/pendiente', icon: 'fa-circle-check', action: 'filter', filterType: 'confirmacion' },
        { id: 'limpiar', title: 'Limpiar Filtros', subtitle: 'Restablecer todos los valores', icon: 'fa-trash-can', action: 'clear' }
    ];

    window.spotlightActiveFilter = null;

    function openSpotlight() {
        overlay.addClass('active');
        window.spotlightActiveFilter = null;
        results.show();
        $('#spotlightDateContainer').removeClass('active');
        input.val('').attr('placeholder', 'Buscar por documento, OP o referencia...').focus();
        renderActiveFiltersInSpotlight();
        renderResults('');
    }

    function closeSpotlight() {
        overlay.removeClass('active');
        selectedIndex = -1;
    }

    function renderResults(query) {
        results.empty();
        selectedIndex = 0;

        if (window.spotlightActiveFilter) {
            renderFilterSubmenu(query);
            return;
        }

        const filteredOptions = options.filter(o => 
            o.title.toLowerCase().includes(query.toLowerCase()) || 
            o.subtitle.toLowerCase().includes(query.toLowerCase())
        );

        const listToRender = filteredOptions.length > 0 ? filteredOptions : options;

        listToRender.forEach((opt, index) => {
            const isSelected = index === 0;
            const item = $(`
                <div class="spotlight-result-item ${isSelected ? 'selected' : ''}" data-index="${index}">
                    <div class="item-icon">
                        <i class="fa-solid ${opt.icon}"></i>
                    </div>
                    <div class="item-content">
                        <div class="item-title">${opt.title} ${query && !opt.action && !opt.column ? `"${query}"` : ''}</div>
                        <div class="item-subtitle">${opt.subtitle}</div>
                    </div>
                    <div class="item-shortcut">↵ Seleccionar</div>
                </div>
            `);

            item.on('click', () => selectOption(opt));
            results.append(item);
        });
        
        // Actualizar el arreglo de opciones actuales para la navegación por teclado
        window._currentSpotlightList = listToRender;
    }

    function renderFilterSubmenu(query) {
        const filterType = window.spotlightActiveFilter;
        let items = [];

        if (filterType === 'cliente') {
            items = [...new Set(allData.map(f => f['Razón social cliente factura']).filter(v => v))].sort();
        } else if (filterType === 'proveedor') {
            items = [...new Set(allData.map(f => f.proveedor).filter(v => v))].sort();
        } else if (filterType === 'estado') {
            items = [...new Set(allData.map(f => f.Estado).filter(v => v))].sort();
        } else if (filterType === 'tipo') {
            items = [...new Set(allData.map(f => f.tipo).filter(v => v))].sort();
        } else if (filterType === 'confirmacion') {
            items = ['ENTREGADO', 'PENDIENTE'];
        }

        const filteredItems = items.filter(it => it.toLowerCase().includes(query.toLowerCase()));
        
        if (filteredItems.length === 0) {
            results.append('<div class="p-4 text-center text-muted small">No se encontraron resultados</div>');
            return;
        }

        filteredItems.forEach((it, index) => {
            const isSelected = index === 0;
            const item = $(`
                <div class="spotlight-result-item ${isSelected ? 'selected' : ''}" data-index="${index}">
                    <div class="item-icon">
                        <i class="fa-solid fa-check" style="opacity: ${isItemSelected(filterType, it) ? 1 : 0.2}"></i>
                    </div>
                    <div class="item-content">
                        <div class="item-title">${it}</div>
                    </div>
                </div>
            `);

            item.on('click', () => applyFilterFromSpotlight(filterType, it));
            results.append(item);
        });

        window._currentSpotlightList = filteredItems.map(it => ({ value: it, isFilterItem: true }));
    }

    function renderActiveFiltersInSpotlight() {
        const container = $('#spotlightActiveFilters').empty();
        
        // Búsqueda Global
        if (window._spotlightQuery) {
            addTag(container, 'Búsqueda', `"${window._spotlightQuery}"`, () => {
                window._spotlightQuery = '';
                $('#spotlightInput').val('');
                aplicarFiltros();
                renderActiveFiltersInSpotlight();
                renderResults('');
            }, () => {
                $('#spotlightInput').val(window._spotlightQuery).focus();
            });
        }

        // Búsqueda por Columna específica
        if (window.activeColumnSearch && window.activeColumnSearch.text) {
            addTag(container, window.activeColumnSearch.column, `"${window.activeColumnSearch.text}"`, () => {
                window.activeColumnSearch = null;
                aplicarFiltros();
                renderActiveFiltersInSpotlight();
                renderResults('');
            }, () => {
                $('#spotlightInput').val(window.activeColumnSearch.text).focus();
            });
        }

        // Cliente
        const cliente = $('#filtroCliente').val();
        if (cliente) addTag(container, 'Cliente', cliente, 
            () => { $('#filtroCliente').val(''); aplicarFiltros(); renderActiveFiltersInSpotlight(); },
            () => { window.spotlightActiveFilter = 'cliente'; input.val('').focus(); renderResults(''); }
        );

        // Proveedor
        const proveedor = $('#filtroProveedor').val();
        if (proveedor) addTag(container, 'Proveedor', proveedor, 
            () => { $('#filtroProveedor').val(''); aplicarFiltros(); renderActiveFiltersInSpotlight(); },
            () => { window.spotlightActiveFilter = 'proveedor'; input.val('').focus(); renderResults(''); }
        );

        // Estado (multi)
        const estados = $('#filtroEstadoDropdown input:checked').map(function() { return this.value; }).get();
        const esDefaultEstado = (estados.length === 1 && estados[0] === 'Aprobadas');
        if (estados.length > 0 && !esDefaultEstado) {
            addTag(container, 'Estados', estados.length, () => { 
                $('#filtroEstadoDropdown input').prop('checked', false);
                $('#filtroEstadoDropdown input[value="Aprobadas"]').prop('checked', true);
                actualizarLabelEstado();
                aplicarFiltros();
                renderActiveFiltersInSpotlight();
            }, () => { window.spotlightActiveFilter = 'estado'; input.val('').focus(); renderResults(''); });
        }

        // Tipo (multi)
        const tiposChecked = $('#filtroTipoDropdown input:checked').map(function() { return this.value; }).get();
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const canSeeAllTipos = user.rol === 'OWNER' || user.rol === 'ADMIN';
        const defaultTipos = ['REMISION', 'OFICAL', 'OFICIAL'];
        
        let esDefaultTipo = false;
        if (canSeeAllTipos) {
            esDefaultTipo = (tiposChecked.length === 3 && tiposChecked.every(t => defaultTipos.includes(t.toUpperCase())));
        } else {
            const totalTipos = $('#filtroTipoDropdown input').length;
            esDefaultTipo = (tiposChecked.length === totalTipos);
        }

        if (tiposChecked.length > 0 && !esDefaultTipo) {
            addTag(container, 'Tipos', tiposChecked.length, () => {
                if (canSeeAllTipos) {
                    $('#filtroTipoDropdown input').each(function() {
                        $(this).prop('checked', defaultTipos.includes(this.value.toUpperCase()));
                    });
                } else {
                    $('#filtroTipoDropdown input').prop('checked', true);
                }
                actualizarLabelTipo();
                aplicarFiltros();
                renderActiveFiltersInSpotlight();
            }, () => { window.spotlightActiveFilter = 'tipo'; input.val('').focus(); renderResults(''); });
        }

        // Confirmación
        const conf = $('#filtroConfirmacion').val();
        if (conf) addTag(container, 'Conf.', conf, 
            () => { $('#filtroConfirmacion').val(''); aplicarFiltros(); renderActiveFiltersInSpotlight(); },
            () => { window.spotlightActiveFilter = 'confirmacion'; input.val('').focus(); renderResults(''); }
        );

        // Fecha
        if (glassCalState.startDate && glassCalState.endDate) {
            const esDefaultFecha = (
                glassCalState.startDate.getTime() === primerDia.getTime() && 
                glassCalState.endDate.getTime() === hoy.getTime()
            );

            if (!esDefaultFecha) {
                const fmt = d => d.toLocaleDateString('es-CO', {day:'2-digit', month:'short'});
                addTag(container, 'Fecha', `${fmt(glassCalState.startDate)} - ${fmt(glassCalState.endDate)}`, () => {
                    glassCalState.startDate = primerDia;
                    glassCalState.endDate = hoy;
                    cargarDatos(primerDia, hoy);
                    renderActiveFiltersInSpotlight();
                }, () => {
                    selectedIndex = -1;
                    results.hide();
                    $('#spotlightDateContainer').addClass('active');
                    renderGlassCalendar();
                });
            }
        }

        function addTag(parent, label, value, onRemove, onEdit) {
            const tag = $(`
                <div class="filter-tag" style="${onEdit ? 'cursor: pointer;' : ''}">
                    <span class="tag-label">${label}:</span>
                    <span class="tag-value">${value}</span>
                    <div class="tag-remove" title="Quitar filtro"><i class="fa-solid fa-xmark"></i></div>
                </div>
            `);
            
            if (onEdit) {
                tag.on('click', (e) => {
                    e.stopPropagation();
                    onEdit();
                });
            }

            tag.find('.tag-remove').on('click', (e) => {
                e.stopPropagation();
                onRemove();
            });
            parent.append(tag);
        }
    }

    function isItemSelected(type, value) {
        if (type === 'cliente') return $('#filtroCliente').val() === value;
        if (type === 'proveedor') return $('#filtroProveedor').val() === value;
        if (type === 'confirmacion') return $('#filtroConfirmacion').val() === value;
        if (type === 'estado') return $('#filtroEstadoDropdown input[value="'+value+'"]').is(':checked');
        if (type === 'tipo') return $('#filtroTipoDropdown input[value="'+value+'"]').is(':checked');
        return false;
    }

    function selectOption(opt) {
        const query = input.val().trim();
        
        if (opt.action === 'date') {
            results.hide();
            $('#spotlightDateContainer').addClass('active');
            initGlassCalendar();
            return;
        }

        if (opt.action === 'filter') {
            window.spotlightActiveFilter = opt.filterType;
            input.val('').attr('placeholder', 'Filtrar ' + opt.filterType + '...').focus();
            renderResults('');
            return;
        }

        if (opt.action === 'clear') {
            $('#btnLimpiarFiltros').trigger('click');
            closeSpotlight();
            return;
        }

        if (opt.column) {
            window.activeColumnSearch = { column: opt.column, text: query };
            window._spotlightQuery = '';
        } else {
            window._spotlightQuery = query;
            window.activeColumnSearch = null;
        }

        aplicarFiltros();
        renderActiveFiltersInSpotlight();
        closeSpotlight();
    }

    function applyFilterFromSpotlight(type, value) {
        if (type === 'cliente') $('#filtroCliente').val(value);
        if (type === 'proveedor') $('#filtroProveedor').val(value);
        if (type === 'confirmacion') $('#filtroConfirmacion').val(value);
        if (type === 'estado') {
            const cb = $('#filtroEstadoDropdown input[value="'+value+'"]');
            cb.prop('checked', !cb.is(':checked'));
            actualizarLabelEstado();
        }
        if (type === 'tipo') {
            const cb = $('#filtroTipoDropdown input[value="'+value+'"]');
            cb.prop('checked', !cb.is(':checked'));
            actualizarLabelTipo();
        }

        aplicarFiltros();
        
        // Si es estado o tipo (multi-select), no cerramos el spotlight para permitir marcar varios
        if (type !== 'estado' && type !== 'tipo') {
            closeSpotlight();
        } else {
            renderActiveFiltersInSpotlight();
            renderResults(input.val()); // Refrescar checks
        }
    }

    // ---- GLASS CALENDAR ENGINE ----
    let glassCalState = {
        year: new Date().getFullYear(),
        month: new Date().getMonth(),
        startDate: null,
        endDate: null
    };

    const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                       'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

    function initGlassCalendar() {
        // Tomar fechas actuales del estado si existen
        if (glassCalState.startDate && glassCalState.endDate) {
            // Ya están inicializadas o se mantienen las anteriores
        } else {
            // Inicializar con primer día y hoy si están vacías
            glassCalState.startDate = primerDia;
            glassCalState.endDate = hoy;
        }

        renderGlassCalendar();

        $('#glassCalPrev').off('click').on('click', () => {
            glassCalState.month--;
            if (glassCalState.month < 0) { glassCalState.month = 11; glassCalState.year--; }
            renderGlassCalendar();
        });

        $('#glassCalNext').off('click').on('click', () => {
            glassCalState.month++;
            if (glassCalState.month > 11) { glassCalState.month = 0; glassCalState.year++; }
            renderGlassCalendar();
        });

        $('#glassCalApply').off('click').on('click', () => {
            if (glassCalState.startDate && glassCalState.endDate) {
                cargarDatos(glassCalState.startDate, glassCalState.endDate);
                
                if ($('#switchPersistencia').is(':checked')) {
                    localStorage.setItem('siesa_date_range', JSON.stringify([
                        glassCalState.startDate.toISOString(),
                        glassCalState.endDate.toISOString()
                    ]));
                }
                
                closeSpotlight();
            }
        });
    }

    function renderGlassCalendar() {
        const { year, month, startDate, endDate } = glassCalState;
        const today = new Date();
        today.setHours(0,0,0,0);

        // Título
        $('#glassCalTitle').text(`${MONTHS_ES[month]} ${year}`);

        // Calcular días
        const firstDay = new Date(year, month, 1);
        const lastDay  = new Date(year, month + 1, 0);
        // Ajustar: lunes=0 ... domingo=6
        let startDow = firstDay.getDay() - 1;
        if (startDow < 0) startDow = 6;

        const container = $('#glassCalDays').empty();

        // Celdas vacías al inicio
        for (let i = 0; i < startDow; i++) {
            container.append('<div></div>');
        }

        // Días del mes
        for (let d = 1; d <= lastDay.getDate(); d++) {
            const date = new Date(year, month, d);
            date.setHours(0,0,0,0);

            const isFuture = date > today;
            let classes = 'glass-day';
            if (isFuture) classes += ' other-month';
            if (date.getTime() === today.getTime()) classes += ' today';

            // Rango
            if (startDate && date.getTime() === new Date(startDate).setHours(0,0,0,0)) classes += ' start';
            if (endDate   && date.getTime() === new Date(endDate).setHours(0,0,0,0))   classes += ' end';
            if (startDate && endDate) {
                const s = new Date(startDate).setHours(0,0,0,0);
                const e = new Date(endDate).setHours(0,0,0,0);
                if (date > s && date < e) classes += ' in-range';
            }

            const cell = $(`<div class="${classes}">${d}</div>`);
            if (!isFuture) {
                cell.on('click', () => handleGlassDayClick(date));
            }
            container.append(cell);
        }

        // Etiqueta de rango
        updateGlassLabel();
        // Botón aplicar
        const applyBtn = $('#glassCalApply');
        applyBtn.prop('disabled', !(glassCalState.startDate && glassCalState.endDate));
    }

    function handleGlassDayClick(date) {
        if (!glassCalState.startDate || (glassCalState.startDate && glassCalState.endDate)) {
            // Nuevo inicio
            glassCalState.startDate = date;
            glassCalState.endDate   = null;
        } else {
            // Fin del rango
            if (date < glassCalState.startDate) {
                glassCalState.endDate   = glassCalState.startDate;
                glassCalState.startDate = date;
            } else {
                glassCalState.endDate = date;
            }
        }
        renderGlassCalendar();
    }

    function updateGlassLabel() {
        const { startDate, endDate } = glassCalState;
        const label = $('#glassCalLabel');
        const fmt = d => d.toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' });
        if (!startDate) {
            label.text('Selecciona una fecha de inicio');
        } else if (!endDate) {
            label.text(`Inicio: ${fmt(startDate)} → elige fecha fin`);
        } else {
            label.text(`${fmt(startDate)}  →  ${fmt(endDate)}`);
        }
    }

    // Keyboard Shortcuts
    $(document).on('keydown', (e) => {
        // Ctrl+K o Cmd+K
        if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            openSpotlight();
            return false;
        }

        if (overlay.hasClass('active')) {
            const currentList = window._currentSpotlightList || options;

            if (e.key === 'Escape') {
                if (window.spotlightActiveFilter) {
                    window.spotlightActiveFilter = null;
                    input.val('').attr('placeholder', 'Buscar por documento, OP o referencia...').focus();
                    renderResults('');
                } else {
                    closeSpotlight();
                }
                return;
            }

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = (selectedIndex + 1) % currentList.length;
                updateSelection();
            }

            if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = (selectedIndex - 1 + currentList.length) % currentList.length;
                updateSelection();
            }

            if (e.key === 'Enter') {
                e.preventDefault();
                const selected = currentList[selectedIndex];
                if (selected.isFilterItem) {
                    applyFilterFromSpotlight(window.spotlightActiveFilter, selected.value);
                } else {
                    selectOption(selected);
                }
            }
        }
    });

    function updateSelection() {
        results.find('.spotlight-result-item').removeClass('selected');
        results.find(`.spotlight-result-item[data-index="${selectedIndex}"]`).addClass('selected');
        
        // Asegurar que el item seleccionado esté visible
        const selectedItem = results.find('.selected')[0];
        if (selectedItem) {
            selectedItem.scrollIntoView({ block: 'nearest' });
        }
    }

    input.on('input', () => {
        renderResults(input.val().trim());
    });

    overlay.on('click', (e) => {
        if (e.target === overlay[0]) closeSpotlight();
    });

    // Botón lupa en el header → abrir Spotlight
    $('#btnSpotlight').on('click', () => openSpotlight());
}
