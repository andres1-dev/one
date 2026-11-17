// ============================================================
// js/v2/app-v2.js
// Controlador principal v2 - 100% ON-DEMAND, CERO EGRESO BRUTO
// Reutiliza Grid.js, Spotlight, Calendar y Modals pero
// NUNCA descarga lotes masivos de miles de facturas.
// ============================================================

let grid = null;
let allData = [];
let filteredData = [];
let cardsVisible = 20;
let cardsObserver = null;
let primerDia = getPrimerDiaMes();
let hoy = getHoy();

function getPrimerDiaMes() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
}

function getHoy() {
    return new Date();
}

function formatearFecha(fecha) {
    if (!fecha) return '';
    const d = new Date(fecha);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function calcularDiasNumero(fechaSiesa, entregas) {
    if (!fechaSiesa) return 0;
    const fechaSiesaDate = new Date(fechaSiesa + 'T00:00:00-05:00');
    let fechaComparacion;
    if (entregas && entregas.length > 0 && entregas[0].Registro) {
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

// Poblar filtros desde la PCR ligera (sin descargar documentos)
async function inicializarFiltrosDesdePCR() {
    try {
        const resp = await ApiClientV2.fetchFilterOptions();
        if (resp && resp.success && resp.data) {
            const { clientes, proveedores, estados, tipos } = resp.data;
            poblarFiltrosConOpciones(clientes || [], proveedores || [], estados || [], tipos || []);
        }
    } catch (e) {
        console.warn('⚠️ No se pudieron obtener filtros por PCR, usando fallback estático:', e.message);
        // Fallback básico si aún no se ha desplegado la PCR
        poblarFiltrosConOpciones([], [], ['Aprobadas', 'En elaboración', 'Anuladas'], ['REMISION', 'OFICIAL', 'NOTAS', 'DEVOLUCION']);
    }
}

function poblarFiltrosConOpciones(clientes, proveedores, estados, tipos) {
    $('#filtroCliente').html('<option value="">Todos</option>' + clientes.map(c => `<option value="${c}">${c}</option>`).join(''));
    $('#filtroProveedor').html('<option value="">Todos</option>' + proveedores.map(p => `<option value="${p}">${p}</option>`).join(''));
    
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const canSeeAnuladas = user.rol === 'OWNER' || user.rol === 'ADMIN';
    const estadosFiltrados = canSeeAnuladas ? estados : estados.filter(e => e !== 'Anuladas');
    
    const estadoCheckboxes = estadosFiltrados.map(e => {
        const checked = e === 'Aprobadas' ? 'checked' : '';
        return `<label class="filtro-estado-item"><input type="checkbox" value="${e}" ${checked}> ${e}</label>`;
    }).join('');
    $('#filtroEstadoDropdown').html(estadoCheckboxes);
    actualizarLabelEstado();

    const canSeeAllTipos = user.rol === 'OWNER' || user.rol === 'ADMIN';
    const DEFAULT_TIPOS_UPPER = canSeeAllTipos ? ['REMISION', 'OFICAL', 'OFICIAL'] : null;
    const tipoCheckboxes = tipos.map(t => {
        const checked = (DEFAULT_TIPOS_UPPER === null || DEFAULT_TIPOS_UPPER.includes(t.toUpperCase())) ? 'checked' : '';
        return `<label class="filtro-tipo-item"><input type="checkbox" value="${t}" ${checked}> ${t}</label>`;
    }).join('');
    $('#filtroTipoDropdown').html(tipoCheckboxes);
    actualizarLabelTipo();
}

function actualizarLabelTipo() {
    const checked = $('#filtroTipoDropdown input[type=checkbox]:checked').map(function() { return this.value; }).get();
    const label = checked.length === 0 ? 'Todos' : checked.join(', ');
    $('#filtroTipoLabel').text(label);
}

function actualizarLabelEstado() {
    const checked = $('#filtroEstadoDropdown input[type=checkbox]:checked').map(function() { return this.value; }).get();
    const label = checked.length === 0 ? 'Todos' : checked.join(', ');
    $('#filtroEstadoLabel').text(label);
}

// Modificación clave: cargarDatos() en v2 NO baja datos masivos
async function cargarDatos(fechaInicio, fechaFin) {
    try {
        $('#loading').show();
        // 1. Cargar KPIs on-demand usando la nueva EF (~300 bytes)
        await KpiLoaderV2.cargarConFiltrosActivos();
        
        // 2. Ejecutar búsqueda on-demand paginada
        SearchEngineV2.buscar(1);
    } catch (e) {
        console.error('❌ Error en cargarDatos v2:', e);
    } finally {
        $('#loading').hide();
    }
}

// Aplicar filtros en v2: Dispara la búsqueda on-demand a Postgres
function aplicarFiltros() {
    cardsVisible = 20;
    const filtroConfirmacion = $('#filtroConfirmacion').val();
    
    $('.stat-card').removeClass('active');
    if (filtroConfirmacion === 'ENTREGADO') $('.stat-delivered').addClass('active');
    if (filtroConfirmacion === 'PENDIENTE') $('.stat-pending').addClass('active');
    
    // Guardar filtros en localStorage si está habilitada la persistencia
    if ($('#switchPersistencia').is(':checked')) {
        const filtrosDoc = {
            cliente: $('#filtroCliente').val(),
            proveedor: $('#filtroProveedor').val(),
            estados: $('#filtroEstadoDropdown input:checked').map(function() { return this.value; }).get(),
            tipos: $('#filtroTipoDropdown input:checked').map(function() { return this.value; }).get(),
            confirmacion: filtroConfirmacion,
            search: window._spotlightQuery || ''
        };
        localStorage.setItem('siesa_filtros', JSON.stringify(filtrosDoc));
    }

    // Búsqueda on-demand a Supabase
    SearchEngineV2.buscar(1);
}

// Actualizaciones optimistas (usando endpoint PATCH original)
async function actualizarEstadoSiesa(documento, nuevoEstado) {
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (!user || !window.supabase) throw new Error('No hay sesión activa');
        
        const { data: { session } } = await window.supabase.auth.getSession();
        if (!session) throw new Error('Sesión expirada');
        
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
        
        // Actualizar datos locales de la página actual
        const index = allData.findIndex(f => f['Nro documento'] === documento);
        if (index !== -1) allData[index].Estado = nuevoEstado;
        
        const filteredIndex = filteredData.findIndex(f => f['Nro documento'] === documento);
        if (filteredIndex !== -1) filteredData[filteredIndex].Estado = nuevoEstado;

        actualizarGrid();
        renderizarTarjetas();
        
        // Refrescar KPIs
        KpiLoaderV2.cargarConFiltrosActivos();
    } catch (error) {
        console.error('❌ Error actualizando estado:', error);
        alert('Error al actualizar estado: ' + error.message);
    }
}

async function actualizarOPSiesa(documento, nuevaOP) {
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (!user || !window.supabase) throw new Error('No hay sesión activa');
        
        const { data: { session } } = await window.supabase.auth.getSession();
        if (!session) throw new Error('Sesión expirada');
        
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
        
        const fIndex = allData.findIndex(f => f['Nro documento'] === documento);
        if (fIndex !== -1) allData[fIndex].op = nuevaOP;
        
        const filteredIndex = filteredData.findIndex(f => f['Nro documento'] === documento);
        if (filteredIndex !== -1) filteredData[filteredIndex].op = nuevaOP;
    } catch (error) {
        console.error('❌ Error actualizando OP:', error);
        alert('Error al actualizar OP: ' + error.message);
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
    container.classList.remove('editing');
    container.innerHTML = `<span class="op-text">${nuevaOP || '-'}</span>`;
    await actualizarOPSiesa(documento, nuevaOP);
}

function setDatos(data) {
    allData = data || [];
    filteredData = data || [];
    actualizarGrid();
    renderizarTarjetas();
}
window.setDatos = setDatos;

function actualizarGrid() {
    if (!grid) {
        inicializarGrid();
        return;
    }
    
    const estadosDisponibles = ['Aprobadas', 'Anuladas', 'En elaboración'];
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const canEdit = user.rol === 'OWNER' || user.rol === 'ADMIN';
    
    const rowData = (filteredData || []).map(f => {
        const selectEstado = canEdit ? gridjs.html(`
            <select class="form-select form-select-sm select-estado-siesa" 
                    onchange="actualizarEstadoSiesa('${f['Nro documento']}', this.value)">
                ${estadosDisponibles.map(e => `<option value="${e}" ${f.Estado === e ? 'selected' : ''}>${e}</option>`).join('')}
                ${!estadosDisponibles.includes(f.Estado) ? `<option value="${f.Estado}" selected>${f.Estado}</option>` : ''}
            </select>
        `) : gridjs.html(`<span>${f.Estado || '-'}</span>`);

        const displayOP = canEdit ? gridjs.html(`
            <div class="editable-op-container" onclick="habilitarEdicionOP(this, '${f['Nro documento']}')">
                <span class="op-text">${f.op || '-'}</span>
            </div>
        `) : gridjs.html(`<span>${f.op || '-'}</span>`);

        const entregas = f.entregas || [];
        const esEntregado = f.confirmacion === 'ENTREGADO' || entregas.length > 0;

        return [
            selectEstado, 
            f['Nro documento'] || '-', 
            f.Fecha || '-', 
            f['Razón social cliente factura'] || '-', 
            f.Notas || '-', 
            f.proveedor || '-',
            f['Valor subtotal local'] ? '$' + Math.round(parseFloat(f['Valor subtotal local'])).toLocaleString('es-CO') : '$0',
            f.Referencia || '-', 
            f['Cantidad inv.'] ? Math.round(parseFloat(f['Cantidad inv.'])).toLocaleString('es-CO') : '0',
            f.referencias_detalle ? gridjs.html((typeof f.referencias_detalle === 'string' ? JSON.parse(f.referencias_detalle) : f.referencias_detalle).map(ref => `<div class="ref-detalle">${ref.referencia} (${ref.cantidad}) - $${Math.round(ref.valor_subtotal).toLocaleString('es-CO')}</div>`).join('')) : '-',
            displayOP, 
            f.tipo || '-',
            gridjs.html(esEntregado ? '<span class="badge badge-entregado">ENTREGADO</span>' : '<span class="badge badge-pendiente">PENDIENTE</span>'),
            calcularDias(f.Fecha, entregas),
            esEntregado && entregas.length > 0 ? gridjs.html(entregas.map(e => `<div class="entrega-fecha">${new Date(e.Registro).toLocaleString('es-CO', {year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'})}</div>`).join('')) : '-',
            esEntregado && entregas.length > 0 && entregas[0].Url_Ih3 ? gridjs.html(`<div class="soporte-img"><a href="#" onclick="openImageModal('${entregas[0].Url_Ih3}', '${f['Nro documento']}', '${entregas[0].Registro}'); return false;"><img src="${entregas[0].Url_Ih3}" alt="Soporte" /></a></div>`) : '-'
        ];
    });

    grid.updateConfig({
        data: rowData
    }).forceRender();
}

function inicializarGrid() {
    const tableEl = document.getElementById('deliveryTable');
    if (!tableEl) return;
    tableEl.innerHTML = '';
    grid = new gridjs.Grid({
        columns: [
            'Estado', 'Documento', 'Fecha', 'Cliente', 'Notas', 
            { name: 'Proveedor', hidden: true }, 
            'Valor', 'Referencia', 'Cantidad', 'Detalles', 'OP', 
            { name: 'Tipo', hidden: true }, 
            'Confirmacion', 'Diferencia', 'Entrega', 'Soporte'
        ],
        data: [],
        search: false,
        sort: { multiColumn: false },
        pagination: { enabled: true, limit: 10, summary: true },
        fixedHeader: true,
        height: 'auto',
        language: {
            search: { placeholder: 'Buscar...' },
            pagination: { previous: 'Anterior', next: 'Siguiente', showing: 'Mostrando', results: () => 'registros', of: 'de', to: 'a' },
            noRecordsFound: 'No hay datos cargados. Usa el buscador o filtros para consultar.'
        }
    }).render(tableEl);
}

function renderizarTarjetas() {
    const container = document.getElementById('deliveryCards');
    if (!container) return;
    
    const dataToRender = filteredData.slice(0, cardsVisible);
    const hasMore = filteredData.length > cardsVisible;
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
        
        const selectEstado = canEdit ? `
            <select class="form-select form-select-sm select-estado-siesa mt-1" 
                    onchange="actualizarEstadoSiesa('${f['Nro documento']}', this.value)">
                ${estadosDisponibles.map(e => `<option value="${e}" ${f.Estado === e ? 'selected' : ''}>${e}</option>`).join('')}
                ${!estadosDisponibles.includes(f.Estado) ? `<option value="${f.Estado}" selected>${f.Estado}</option>` : ''}
            </select>
        ` : `<span class="mt-1">${f.Estado || '-'}</span>`;

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
                            ` : `<span>${f.op || '-'}</span>`}
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
    
    if (hasMore) setTimeout(observeSentinel, 100);
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

function openImageModal(imageUrl, factura, fecha) {
    document.getElementById('modalImage').src = imageUrl;
    document.getElementById('modalFactura').textContent = factura;
    document.getElementById('modalFecha').textContent = new Date(fecha).toLocaleString('es-CO', {
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });
    const modal = new bootstrap.Modal(document.getElementById('imageModal'));
    modal.show();
}
window.openImageModal = openImageModal;

function descargarCSV() {
    if (!filteredData || filteredData.length === 0) {
        alert('No hay datos para exportar');
        return;
    }
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
    const csvContent = [headers.join(';'), ...rows.map(row => row.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_delivery_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ========== INICIALIZACIÓN V2 ==========
$(document).ready(async function() {
    $('#loading').hide();
    inicializarGrid();
    
    // Contenedor de paginación para v2
    if (!$('#paginacionV2').length) {
        $('#deliveryTable').after('<div id="paginacionV2" class="mb-4"></div>');
    }

    // 1. Obtener opciones de filtros con la PCR rápida (cero egreso de facturas)
    try {
        await inicializarFiltrosDesdePCR();
    } catch (e) {
        console.warn('Filtros iniciales:', e.message);
    }
    
    // 2. Cargar KPIs on-demand con rango del mes activo (~300 bytes)
    try {
        await KpiLoaderV2.cargarConFiltrosActivos();
    } catch (e) {
        console.warn('KPIs iniciales:', e.message);
    }
    
    // 3. Cargar automáticamente la Página 1 (los 50 registros más recientes)
    // Consume solo ~35 KB y le da al usuario una vista viva e interactiva de inmediato.
    try {
        SearchEngineV2.buscar(1);
    } catch (e) {
        console.warn('Carga inicial de página 1:', e.message);
    } finally {
        $('#loading').hide();
    }

    // Event listeners de filtros
    $('#filtroCliente, #filtroProveedor, #filtroConfirmacion').on('change', aplicarFiltros);
    $(document).on('change', '#filtroEstadoDropdown input[type=checkbox]', function() {
        actualizarLabelEstado();
        aplicarFiltros();
    });
    $(document).on('change', '#filtroTipoDropdown input[type=checkbox]', function() {
        actualizarLabelTipo();
        aplicarFiltros();
    });

    $('#btnLimpiarFiltros').on('click', function() {
        $('#filtroCliente, #filtroProveedor, #filtroConfirmacion').val('');
        $('#filtroEstadoDropdown input[type=checkbox]').prop('checked', false);
        $('#filtroEstadoDropdown input[type=checkbox][value="Aprobadas"]').prop('checked', true);
        actualizarLabelEstado();
        $('#filtroTipoDropdown input[type=checkbox]').prop('checked', false);
        actualizarLabelTipo();
        window.activeColumnSearch = null;
        window._spotlightQuery = '';
        $('.stat-card').removeClass('active');
        aplicarFiltros();
    });

    $('#btnDescargarCSV').on('click', descargarCSV);

    // Click en tarjetas KPI filtra on-demand por confirmación
    $('.stat-delivered').on('click', function() {
        const current = $('#filtroConfirmacion').val();
        const newVal = current === 'ENTREGADO' ? '' : 'ENTREGADO';
        $('#filtroConfirmacion').val(newVal);
        aplicarFiltros();
    });

    $('.stat-pending').on('click', function() {
        const current = $('#filtroConfirmacion').val();
        const newVal = current === 'PENDIENTE' ? '' : 'PENDIENTE';
        $('#filtroConfirmacion').val(newVal);
        aplicarFiltros();
    });

    // Inicializar spotlight adaptado para v2
    initSpotlight();

    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    if (currentUser.rol !== 'OWNER' && currentUser.rol !== 'ADMIN') {
        $('#btnUpload, #divider1').hide();
    }
});

// Spotlight integrado con SearchEngineV2
window.activeColumnSearch = null;
window.glassCalState = {
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
    startDate: getPrimerDiaMes(),
    endDate: getHoy(),
    dateFilterMode: 'documento'
};

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

    function openSpotlight() {
        overlay.addClass('active');
        results.show();
        $('#spotlightDateContainer').removeClass('active');
        input.val('').attr('placeholder', 'Buscar por documento, OP o referencia...').focus();
        renderResults('');
    }

    function closeSpotlight() {
        overlay.removeClass('active');
        selectedIndex = -1;
    }

    function renderResults(query) {
        results.empty();
        selectedIndex = 0;
        const filteredOptions = options.filter(o => 
            o.title.toLowerCase().includes(query.toLowerCase()) || 
            o.subtitle.toLowerCase().includes(query.toLowerCase())
        );
        const listToRender = filteredOptions.length > 0 ? filteredOptions : options;
        listToRender.forEach((opt, index) => {
            const isSelected = index === 0;
            const item = $(`
                <div class="spotlight-result-item ${isSelected ? 'selected' : ''}" data-index="${index}">
                    <div class="item-icon"><i class="fa-solid ${opt.icon}"></i></div>
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
        window._currentSpotlightList = listToRender;
    }

    function selectOption(opt) {
        const query = input.val().trim();
        if (opt.action === 'date') {
            results.hide();
            $('#spotlightDateContainer').addClass('active');
            initGlassCalendarV2();
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
        closeSpotlight();
        SearchEngineV2.buscar(1);
    }

    // Glass Calendar V2
    function initGlassCalendarV2() {
        renderGlassCalendarV2();
        $('#glassCalModeDoc').off('click').on('click', () => {
            glassCalState.dateFilterMode = 'documento';
            renderGlassCalendarV2();
        });
        $('#glassCalModeEntrega').off('click').on('click', () => {
            glassCalState.dateFilterMode = 'entrega';
            renderGlassCalendarV2();
        });
        $('#glassCalPrev').off('click').on('click', () => {
            glassCalState.month--;
            if (glassCalState.month < 0) { glassCalState.month = 11; glassCalState.year--; }
            renderGlassCalendarV2();
        });
        $('#glassCalNext').off('click').on('click', () => {
            glassCalState.month++;
            if (glassCalState.month > 11) { glassCalState.month = 0; glassCalState.year++; }
            renderGlassCalendarV2();
        });
        $('#glassCalApply').off('click').on('click', async () => {
            if (glassCalState.startDate && glassCalState.endDate) {
                closeSpotlight();
                await KpiLoaderV2.cargarConFiltrosActivos();
                SearchEngineV2.buscar(1);
            }
        });
    }

    const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    function renderGlassCalendarV2() {
        const { year, month, startDate, endDate, dateFilterMode } = glassCalState;
        $('#glassCalTitle').text(`${MONTHS_ES[month]} ${year}`);
        $('#glassCalModeDoc').toggleClass('active', dateFilterMode === 'documento');
        $('#glassCalModeEntrega').toggleClass('active', dateFilterMode === 'entrega');

        const firstDay = new Date(year, month, 1);
        const lastDay  = new Date(year, month + 1, 0);
        let startDow = firstDay.getDay() - 1;
        if (startDow < 0) startDow = 6;
        const container = $('#glassCalDays').empty();
        for (let i = 0; i < startDow; i++) container.append('<div></div>');

        for (let d = 1; d <= lastDay.getDate(); d++) {
            const date = new Date(year, month, d);
            date.setHours(0,0,0,0);
            let classes = 'glass-day';
            if (startDate && date.getTime() === new Date(startDate).setHours(0,0,0,0)) classes += ' start';
            if (endDate && date.getTime() === new Date(endDate).setHours(0,0,0,0)) classes += ' end';
            if (startDate && endDate && date > startDate && date < endDate) classes += ' in-range';
            
            const cell = $(`<div class="${classes}">${d}</div>`);
            cell.on('click', () => {
                if (!glassCalState.startDate || (glassCalState.startDate && glassCalState.endDate)) {
                    glassCalState.startDate = date;
                    glassCalState.endDate = null;
                } else {
                    if (date < glassCalState.startDate) {
                        glassCalState.endDate = glassCalState.startDate;
                        glassCalState.startDate = date;
                    } else {
                        glassCalState.endDate = date;
                    }
                }
                renderGlassCalendarV2();
            });
            container.append(cell);
        }

        const fmt = d => d ? d.toLocaleDateString('es-CO', { day:'2-digit', month:'short' }) : '';
        $('#glassCalLabel').text(startDate && endDate ? `${fmt(startDate)} → ${fmt(endDate)}` : 'Selecciona rango');
        $('#glassCalApply').prop('disabled', !(startDate && endDate));
    }

    $(document).on('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
            e.preventDefault();
            openSpotlight();
        }
        if (overlay.hasClass('active') && e.key === 'Escape') closeSpotlight();
    });

    input.on('input', () => renderResults(input.val().trim()));
    overlay.on('click', (e) => { if (e.target === overlay[0]) closeSpotlight(); });
    $('#btnSpotlight').on('click', () => openSpotlight());
}
