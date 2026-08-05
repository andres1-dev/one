window.printingDatosGlobales = [];
window.printingModuleInitialized = false;
window.printingClientesCache = null;

// Clientes especiales que se manejan como anexos de tipo "CLIENTE"
const PRINT_CLIENTES_ESPECIALES = {
    "ESTEBAN": { nombre: "Esteban", nit: "1007348825" },
    "JESUS":   { nombre: "Jesús",   nit: "70825517" },
    "ALEX":    { nombre: "Alex",    nit: "14838951" },
    "RUBEN":   { nombre: "Ruben",   nit: "901920844" }
};

// ============================================
// FUNCIONES DE NORMALIZACIÓN (compartidas)
// ============================================

function print_normalizeDocumento(documento) {
    return String(documento || '').replace(/^REC/i, '').trim();
}

function print_normalizeLinea(linea) {
    return String(linea || '').replace(/^LINEA\s*/i, '').replace(/\s+/g, '').toUpperCase();
}

function print_normalizePVP(pvp) {
    return String(pvp || '').replace(/\$\s*/g, '').replace(/\./g, '').trim();
}

function print_normalizeDate(dateStr) {
    if (!dateStr) return null;
    if (dateStr.includes('T')) return dateStr.split('T')[0];
    if (dateStr.includes('/')) {
        const [dd, mm, yyyy] = dateStr.split('/');
        return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }
    return dateStr;
}

function print_getClaseByPVP(pvp) {
    const valor = parseFloat(pvp);
    if (isNaN(valor)) return 'NO DEFINIDO';
    if (valor <= 39900) return 'LINEA';
    if (valor <= 59900) return 'MODA';
    return 'PRONTAMODA';
}

// ============================================
// CARGAR CLIENTES (una sola vez, cacheado)
// ============================================

async function print_getClientes() {
    if (window.printingClientesCache) return window.printingClientesCache;

    const clientesData = await supabase.selectAll('clientes', { order: 'nombre_corto.asc' });
    const map = {};
    if (Array.isArray(clientesData)) {
        clientesData.forEach(row => {
            const id = String(row.id_cliente || '').trim();
            if (id) {
                map[id] = {
                    id,
                    razonSocial:  row.razon_social  || '',
                    nombreCorto:  row.nombre_corto  || '',
                    tipoCliente:  row.tipo_cliente  || '',
                    estado:       row.estado ? 'ACTIVO' : 'INACTIVO',
                    direccion:    row.direccion     || '',
                    telefono:     row.telefono      || '',
                    email:        row.email         || '',
                    tipoEmpresa:  row.tipo_empresa  || ''
                };
            }
        });
    }
    window.printingClientesCache = map;
    return map;
}

// ============================================
// LÓGICA DE MEZCLA DE DATOS POR LOTE (Legacy)
// ============================================

function print_mergeLoteData(registros, clientesMap) {
    const fulls = registros.filter(r => (r.tipo || '').toUpperCase() === 'FULL');
    const anexos = registros.filter(r => (r.tipo || '').toUpperCase() !== 'FULL');

    const result = [];

    fulls.forEach(full => {
        // Clonar para evitar mutaciones
        const principal = JSON.parse(JSON.stringify(full));
        
        // HR y consolidación
        const hrMap = new Map();
        const rawHR = Array.isArray(principal.hr) ? principal.hr : [];
        rawHR.forEach(item => {
            const key = `${item.codigo_color}-${item.color}-${item.talla}`;
            hrMap.set(key, { ...item });
        });

        const anexosNormales = [];
        const clientesEspecialesData = {};
        let totalCantidad = rawHR.reduce((sum, item) => sum + (Number(item.cantidad) || 0), 0);

        anexos.forEach(anexo => {
            const nombreAnexo = (anexo.tipo || '').toUpperCase();
            const anexoHR = Array.isArray(anexo.hr) ? anexo.hr : [];

            // 1. Clientes Especiales (RUBEN, ESTEBAN...)
            if (PRINT_CLIENTES_ESPECIALES[nombreAnexo]) {
                const cInfo = PRINT_CLIENTES_ESPECIALES[nombreAnexo];
                const distribucion = anexoHR.map(h => {
                    const cant = Number(h.cantidad) || 0;
                    totalCantidad += cant;
                    return {
                        codigo:   String(h.codigo_color || '').trim(),
                        color:    String(h.color || '').trim(),
                        talla:    String(h.talla || '').trim(),
                        cantidad: cant
                    };
                });

                if (distribucion.length > 0) {
                    const cid = cInfo.nit;
                    const cBase = clientesMap[cid] || { id: cid, nombre: cInfo.nombre, razonSocial: cInfo.nombre };
                    clientesEspecialesData[nombreAnexo] = {
                        ...cBase,
                        distribucion: distribucion
                    };
                }
                return;
            }

            // 2. Pendientes y Promociones (se suman al HR del FULL)
            if (nombreAnexo === 'PENDIENTES' || nombreAnexo === 'PROMO') {
                anexoHR.forEach(h => {
                    const key = `${h.codigo_color}-${h.color}-${h.talla}`;
                    const cant = Number(h.cantidad) || 0;
                    if (hrMap.has(key)) {
                        hrMap.get(key).cantidad += cant;
                    } else {
                        hrMap.set(key, { 
                            codigo_color: String(h.codigo_color || '').trim(),
                            color: String(h.color || '').trim(),
                            talla: String(h.talla || '').trim(),
                            cantidad: cant 
                        });
                    }
                    totalCantidad += cant;
                });
                // PENDIENTES solo va al HR (igual que legacy), PROMO va a ambos
                if (nombreAnexo === 'PENDIENTES') return;
            }

            // 3. Otros Anexos (IMPERFECTA, OTROS, PROMO...)
            // A. Desde el HR del anexo
            anexoHR.forEach(h => {
                const cant = Number(h.cantidad) || 0;
                // Si no es PROMO (que ya sumó arriba), sumar a la cantidad total
                if (nombreAnexo !== 'PROMO') totalCantidad += cant;
                
                anexosNormales.push({
                    DOCUMENTO: anexo.refprov || '',
                    CODIGO:    h.codigo_color || '',
                    COLOR:     h.color || '',
                    TALLA:     h.talla || '',
                    TIPO:      nombreAnexo,
                    CANTIDAD:  cant,
                    REC:       anexo.id_ingreso || ''
                });
            });

            // B. Desde la columna 'anexos' del registro anexo (si tiene data extra)
            try {
                const extra = typeof anexo.anexos === 'string' ? JSON.parse(anexo.anexos) : (Array.isArray(anexo.anexos) ? anexo.anexos : []);
                if (extra.length > 0) anexosNormales.push(...extra);
            } catch(e) {}
        });

        // Actualizar datos del registro FULL
        principal.hr = Array.from(hrMap.values());
        principal.cantidad = totalCantidad;
        
        // Unir con anexos que ya traía la columna 'anexos' de Supabase (si existen)
        let anexosBase = [];
        try {
            anexosBase = typeof principal.anexos === 'string' ? JSON.parse(principal.anexos) : (Array.isArray(principal.anexos) ? principal.anexos : []);
        } catch(e) { anexosBase = []; }
        
        principal.anexos = [...anexosBase, ...anexosNormales];
        principal._clientesEspeciales = clientesEspecialesData;

        result.push(principal);
    });

    return result;
}

// ============================================
// CONSULTAR SUPABASE SOLO POR LOS IDs PEDIDOS
// Usa el operador "in" de PostgREST:
//   id_ingreso=in.(2450,2451,2452)
// ============================================

async function print_fetchByIds(ids) {
    if (!ids || ids.length === 0) return [];

    const startTime = performance.now();

    // 1. Normalizar y consultar registros iniciales
    const cleanIds = ids.map(id => print_normalizeDocumento(String(id)));
    const inFilter = `(${cleanIds.join(',')})`;

    const [sisproData, clientesMap] = await Promise.all([
        supabase.request(`ingresos?id_ingreso=in.${inFilter}&select=*`, { method: 'GET' }),
        print_getClientes()
    ]);

    if (!Array.isArray(sisproData) || sisproData.length === 0) return [];

    // 2. Identificar lotes para traer "hermanos" (anexos)
    const lotesUnicos = [...new Set(sisproData.map(r => r.lote).filter(l => l && l > 0))];
    
    let allLoteData = [];
    if (lotesUnicos.length > 0) {
        const loteFilter = `(${lotesUnicos.join(',')})`;
        allLoteData = await supabase.request(`ingresos?lote=in.${loteFilter}&select=*`, { method: 'GET' });
    } else {
        allLoteData = sisproData;
    }

    // 3. Agrupar por Lote y Mezclar
    const groups = {};
    allLoteData.forEach(r => {
        const l = r.lote || 0;
        if (!groups[l]) groups[l] = [];
        groups[l].push(r);
    });

    const mergedRecords = [];
    for (const l in groups) {
        const merged = print_mergeLoteData(groups[l], clientesMap);
        // Si no hay FULL en el lote, mantenemos los registros individuales para no perderlos
        if (merged.length === 0) {
            mergedRecords.push(...groups[l]);
        } else {
            mergedRecords.push(...merged);
        }
    }

    // 4. Consultar Distribuciones para los registros finales
    const finalDocIds = mergedRecords.map(r => print_normalizeDocumento(r.id_ingreso));
    const finalInFilter = `(${finalDocIds.join(',')})`;
    const distribucionesData = await supabase.request(`distribuciones?id_distribucion=in.${finalInFilter}&select=*`, { method: 'GET' });

    const distribucionesMap = {};
    const colaboradorMap    = {};
    if (Array.isArray(distribucionesData)) {
        distribucionesData.forEach(row => {
            const doc = print_normalizeDocumento(row.id_distribucion);
            if (row.colaborador) colaboradorMap[doc] = row.colaborador;
            if (row.datos_distribucion?.Clientes) {
                distribucionesMap[doc] = row.datos_distribucion.Clientes;
            }
        });
    }

    // 5. Construir Resultado Final enriquecido
    const resultadoFinal = [];
    mergedRecords.forEach(row => {
        const documento = print_normalizeDocumento(row.id_ingreso);
        const rawPVP    = print_normalizePVP(row.pvp ? row.pvp.toString() : '');

        // Clientes de distribución (base de datos)
        let clientesEnriquecidos = {};
        const esRefVar = (row.refprov === 'REFVAR' || row.referencia === 'REFVAR');
        if (distribucionesMap[documento]) {
            for (const [nombre, datos] of Object.entries(distribucionesMap[documento])) {
                const cid = datos.id;
                // Enriquecer distribución con referencia y descripcion si es REFVAR
                let distribucionEnriquecida = datos.distribucion || [];
                if (esRefVar && Array.isArray(distribucionEnriquecida)) {
                    distribucionEnriquecida = distribucionEnriquecida.map(item => {
                        const hrItem = (row.hr || []).find(h => h.codigo_color === item.codigo && h.talla === item.talla && h.color === item.color);
                        return {
                            ...item,
                            referencia: hrItem?.referencia || '',
                            descripcion: hrItem?.descripcion || ''
                        };
                    });
                }
                clientesEnriquecidos[nombre] = clientesMap[cid]
                    ? { ...clientesMap[cid], distribucion: distribucionEnriquecida, porcentaje: datos.porcentaje || '' }
                    : { id: cid, nombre, razonSocial: datos.nombre || nombre, distribucion: distribucionEnriquecida, porcentaje: datos.porcentaje || '' };
            }
        }

        // Agregar clientes especiales inyectados por el merge (RUBEN, ESTEBAN...)
        if (row._clientesEspeciales) {
            for (const [nombre, data] of Object.entries(row._clientesEspeciales)) {
                const nombreFormateado = nombre.charAt(0) + nombre.slice(1).toLowerCase();
                clientesEnriquecidos[nombreFormateado] = data;
            }
        }

        resultadoFinal.push({
            DOCUMENTO:    documento,
            REC:          documento,
            FECHA:        print_normalizeDate(row.fecha_traslado),
            TALLER:       row.taller    || '',
            LINEA:        print_normalizeLinea(row.linea),
            AUDITOR:      row.auditor   || '',
            ESCANER:      row.escaner   || '',
            LOTE:         row.lote      || 0,
            REFPROV:      row.refprov   || '',
            DESCRIPCIÓN:  row.descripcion || '',
            DESCRIPCION:  row.descripcion || '',
            CANTIDAD:     row.cantidad  || 0,
            REFERENCIA:   row.referencia || '',
            TIPO:         row.tipo      || 'FULL',
            PVP:          rawPVP,
            PRENDA:       row.prenda    || '',
            GENERO:       row.genero    || '',
            GESTOR:       row.gestor    || '',
            PROVEEDOR:    row.proveedor || '',
            CLASE:        row.clase     || print_getClaseByPVP(rawPVP),
            HR:           (row.hr || []).map(h => ({
                codigo_color: h.codigo_color || '',
                color: h.color || '',
                talla: h.talla || '',
                cantidad: h.cantidad || 0,
                referencia: h.referencia || '',
                descripcion: h.descripcion || ''
            })),
            ANEXOS:       row.anexos || [],
            FUENTE:       'SUPABASE',
            COLABORADOR:  colaboradorMap[documento] || '',
            CLIENTES:     clientesEnriquecidos,
            DISTRIBUCION: {
                Documento:   documento,
                Clientes:    clientesEnriquecidos,
                Colaborador: colaboradorMap[documento] || ''
            }
        });
    });

    // Mapeo extra: si el usuario buscó un ID que ahora es parte de un FULL, 
    // nos aseguramos de que el resultado sea encontrable por el ID original.
    // Esto es vital para que print_buscarPorREC lo encuentre.
    const searchMap = {};
    allLoteData.forEach(r => {
        const origId = print_normalizeDocumento(r.id_ingreso);
        const l = r.lote || 0;
        // Encontrar el registro FULL de este lote en resultadoFinal
        const parent = resultadoFinal.find(f => f.LOTE === l && f.TIPO === 'FULL');
        if (parent) searchMap[origId] = parent;
    });

    const finalResultWithAliases = [...resultadoFinal];
    cleanIds.forEach(id => {
        if (!finalResultWithAliases.find(r => r.REC === id) && searchMap[id]) {
            // Creamos una copia con el REC cambiado para que la búsqueda lo encuentre
            const alias = { ...searchMap[id], REC: id };
            finalResultWithAliases.push(alias);
        }
    });

    const loadTime = performance.now() - startTime;
    Logger.success('printing-main', `${resultadoFinal.length} lotes procesados (${finalResultWithAliases.length} mapeos) en ${loadTime.toFixed(0)}ms`);

    // Actualizar caché global
    finalResultWithAliases.forEach(item => {
        const idx = window.printingDatosGlobales.findIndex(x => x.REC === item.REC);
        if (idx >= 0) window.printingDatosGlobales[idx] = item;
        else window.printingDatosGlobales.push(item);
    });

    return finalResultWithAliases;
}

// ============================================
// INICIALIZACIÓN — ya no carga datos masivos,
// solo prepara el módulo y cachea clientes
// ============================================

async function print_cargarDatos() {
    const loader          = document.getElementById('printLoader');
    const resultContainer = document.getElementById('printResultContainer');

    // Nuevo diseño 2026: clase CSS 'visible' en lugar de style.display
    if (loader) loader.classList.add('visible');
    if (resultContainer) resultContainer.innerHTML = '';

    try {
        // Pre-cargar clientes (son pocos y se reusan siempre)
        await print_getClientes();

        if (loader) loader.classList.remove('visible');
        if (resultContainer) {
            resultContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon-wrap">
                        <i class="fa-solid fa-print"></i>
                    </div>
                    <h5>Sin resultados aún</h5>
                    <p>Ingrese un número de REC y presione <strong>Buscar</strong> o <kbd>Enter</kbd>.</p>
                </div>`;
        }

        window.printingModuleInitialized = true;
        Logger.success('printing-main', 'Módulo de impresión listo (carga bajo demanda)');
    } catch (error) {
        if (loader) loader.classList.remove('visible');
        if (resultContainer) {
            resultContainer.innerHTML = `
                <div class="result-error">
                    <span class="result-icon"><i class="fa-solid fa-circle-xmark"></i></span>
                    <div>
                        <strong>Error al inicializar el módulo</strong>
                        <p style="font-size:12px;margin-top:4px;opacity:.8">${error.message}</p>
                        <button class="btn-primary" onclick="print_cargarDatos()" style="margin-top:12px;font-size:12px;padding:6px 14px">
                            <i class="fa-solid fa-rotate-right"></i> Reintentar
                        </button>
                    </div>
                </div>`;
        }
        throw error;
    }
}

function initPrintingModule() {
    if (!window.printingModuleInitialized) {
        print_cargarDatos();
    }
}
