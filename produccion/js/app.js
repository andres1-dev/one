// App principal - ULTRA OPTIMIZADO con Grid.js

let grid = null;
let flatpickrInstance = null;
let allData = [];
let filteredData = [];
let cardsVisible = 20;
let cardsObserver = null;


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
    const busca = $('#globalSearch').val().toLowerCase();
    
    // Sincronizar visual de tarjetas si se cambia el select
    $('.stat-card').removeClass('active');
    if (filtroConfirmacion === 'ENTREGADO') $('.stat-delivered').addClass('active');
    if (filtroConfirmacion === 'PENDIENTE') $('.stat-pending').addClass('active');
    
    filteredData = allData.filter(row => {
        if (busca) {
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
    if (grid && filteredData && filteredData.length > 0) {
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
    let primerDia = getPrimerDiaMes();
    let hoy = getHoy();
    
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

    flatpickrInstance = flatpickr("#dateRange", {
        mode: "range", dateFormat: "d/m/Y", locale: "es", maxDate: "today", altInput: false,
        position: "auto center",
        onReady: function(selectedDates, dateStr, instance) {
            const fechas = [primerDia, hoy];
            instance.setDate(fechas, true);
            if (instance.selectedDates.length !== 2) {
                instance.selectedDates = [primerDia, hoy];
                instance.input.value = `${primerDia.toLocaleDateString('es-CO', {day: '2-digit', month: '2-digit', year: 'numeric'})} a ${hoy.toLocaleDateString('es-CO', {day: '2-digit', month: '2-digit', year: 'numeric'})}`;
            }
        },
        onOpen: function(selectedDates, dateStr, instance) {
            // Guardar las fechas que había justo antes de abrir para comparar al cerrar
            instance._datesBeforeOpen = [...selectedDates];
        },
        onClose: function(selectedDates, dateStr, instance) {
            if (selectedDates.length === 2) {
                // Verificar si las fechas cambiaron realmente respecto a cuando se abrió
                const antes = instance._datesBeforeOpen || [];
                const haCambiado = antes.length !== 2 || 
                                  selectedDates[0].getTime() !== antes[0].getTime() || 
                                  selectedDates[1].getTime() !== antes[1].getTime();

                if (haCambiado) {
                    const inicio = selectedDates[0].toLocaleDateString('es-CO', {day: '2-digit', month: '2-digit', year: 'numeric'});
                    const fin = selectedDates[1].toLocaleDateString('es-CO', {day: '2-digit', month: '2-digit', year: 'numeric'});
                    $('#dateRange').val(`${inicio} a ${fin}`);
                    
                    if ($('#switchPersistencia').is(':checked')) {
                        localStorage.setItem('siesa_date_range', JSON.stringify([
                            selectedDates[0].toISOString(),
                            selectedDates[1].toISOString()
                        ]));
                    }
                    
                    cargarDatos(selectedDates[0], selectedDates[1]);
                }
            }
        }
    });

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
            if (flatpickrInstance.selectedDates.length === 2) {
                localStorage.setItem('siesa_date_range', JSON.stringify(flatpickrInstance.selectedDates.map(d => d.toISOString())));
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
    $('#globalSearch').on('keyup', aplicarFiltros);
    
    // Enfocar buscador al hacer clic en el wrapper (para expansión)
    $('.search-wrapper').on('click', function() {
        $('#globalSearch').focus();
    });
    
    // Mantener expandido si hay texto
    $('#globalSearch').on('input blur', function() {
        const hasText = $(this).val().trim().length > 0;
        if (hasText) {
            $('.search-wrapper').addClass('has-content');
        } else {
            $('.search-wrapper').removeClass('has-content');
        }
    });

    $('.date-picker-wrapper').on('click', function() {
        if (flatpickrInstance) flatpickrInstance.open();
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
      'Estado', 'Nro documento', 'Fecha', 'Razon Social', 'Docto Referencia',
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
