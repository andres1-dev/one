/**
 * View 3: KPIs & Analítica de Inventario y Cumplimiento de Despachos
 */
import { state } from '../state.js';
import { DOM } from '../dom.js';
import { MONTH_NAMES } from '../config.js';
import { formatNumber, escapeHtml, getISOWeekNumber } from '../utils.js';
import { openInventoryDrilldown, openDespachosDrilldown } from '../modals/drilldownModal.js';

export function computeAndRenderKPIs() {
    if (!state.records.length) return;

    const totalInventario = state.records.reduce((acc, r) => acc + (r.undCort || 0), 0);
    const totalLotes = state.records.length;

    if (DOM.kpiTotalInventario) DOM.kpiTotalInventario.textContent = formatNumber(totalInventario);

    // 1. Inventario por Clase
    renderQuadSection(
        groupDataBy(state.records, 'clase', totalInventario),
        DOM.tblClase,
        totalInventario,
        totalLotes,
        'clase',
        'Clase (PVP)'
    );

    // 2. Inventario por Tipo de Tejido
    renderQuadSection(
        groupDataBy(state.records, 'tipoTejido', totalInventario),
        DOM.tblTejido,
        totalInventario,
        totalLotes,
        'tipoTejido',
        'Tipo de Tejido'
    );

    // 3. Inventario por Género
    renderQuadSection(
        groupDataBy(state.records, 'genero', totalInventario),
        DOM.tblGenero,
        totalInventario,
        totalLotes,
        'genero',
        'Género'
    );

    // 4. Inventario por Cuento o Línea
    renderQuadSection(
        groupDataBy(state.records, 'cuento', totalInventario),
        DOM.tblCuento,
        totalInventario,
        totalLotes,
        'cuento',
        'Cuento o Línea'
    );

    // 5. Antigüedad de Lotes
    computeAndRenderAntiguedad(totalInventario);

    // 6. Despachos (Mensual, Semanal, Diario)
    computeAndRenderDespachos();
}

function groupDataBy(records, key, totalUnits) {
    const map = {};
    records.forEach(r => {
        const val = r[key] || 'NA';
        if (!map[val]) map[val] = { name: val, unidades: 0, lotes: 0 };
        map[val].unidades += (r.undCort || 0);
        map[val].lotes += 1;
    });

    const items = Object.values(map);
    items.sort((a, b) => b.unidades - a.unidades);

    items.forEach(it => {
        it.pct = totalUnits > 0 ? (it.unidades / totalUnits) * 100 : 0;
    });

    return items;
}

function renderQuadSection(items, tbodyElem, totalUnits, totalLotes, fieldKey, fieldLabel) {
    let tbodyHtml = '';

    items.forEach(it => {
        tbodyHtml += `
            <tr class="clickable-row" data-field="${fieldKey}" data-value="${escapeHtml(it.name)}" data-label="${fieldLabel}: ${escapeHtml(it.name)}" title="Haz clic para ver las OPs y Referencias">
                <td>${escapeHtml(it.name)}</td>
                <td class="text-right">${formatNumber(it.unidades)}</td>
                <td class="text-right">${formatNumber(it.lotes)}</td>
                <td class="text-right">${it.pct.toFixed(2).replace('.', ',')}%</td>
            </tr>
        `;
    });

    tbodyHtml += `
        <tr class="total-row">
            <td>Total</td>
            <td class="text-right">${formatNumber(totalUnits)}</td>
            <td class="text-right">${formatNumber(totalLotes)}</td>
            <td class="text-right">100,00%</td>
        </tr>
    `;

    if (tbodyElem) {
        tbodyElem.innerHTML = tbodyHtml;
        tbodyElem.querySelectorAll('tr.clickable-row').forEach(row => {
            row.addEventListener('click', () => {
                const key = row.dataset.field;
                const val = row.dataset.value;
                const label = row.dataset.label;
                openInventoryDrilldown(key, val, label);
            });
        });
    }
}

function computeAndRenderAntiguedad(totalInventario) {
    let maxDate = new Date();
    state.records.forEach(r => {
        if (r.parsedFechaCorte && r.parsedFechaCorte > maxDate) {
            maxDate = r.parsedFechaCorte;
        }
    });

    const refDate = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate());
    const byFecha = {};
    let weightedDaysSum = 0;

    state.records.forEach(r => {
        const fechaKey = r.fechaCorte || 'Sin Fecha';
        let dias = 0;

        if (r.parsedFechaCorte) {
            const f = new Date(r.parsedFechaCorte.getFullYear(), r.parsedFechaCorte.getMonth(), r.parsedFechaCorte.getDate());
            const diffTime = refDate - f;
            dias = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
        }

        if (!byFecha[fechaKey]) {
            byFecha[fechaKey] = {
                fecha: fechaKey,
                parsedDate: r.parsedFechaCorte,
                unidades: 0,
                lotes: 0,
                diasAntiguedad: dias
            };
        }

        byFecha[fechaKey].unidades += (r.undCort || 0);
        byFecha[fechaKey].lotes += 1;
        weightedDaysSum += dias * (r.undCort || 0);
    });

    const mediaPonderada = totalInventario > 0 ? Math.round(weightedDaysSum / totalInventario) : 0;
    if (DOM.kpiMediaPonderada) {
        DOM.kpiMediaPonderada.textContent = `${mediaPonderada} Días`;
    }

    const allDates = Object.values(byFecha);
    allDates.forEach(it => {
        it.pct = totalInventario > 0 ? (it.unidades / totalInventario) * 100 : 0;
    });

    // 1. TABLA GENERAL: Más recientes primero
    const listGeneral = [...allDates].sort((a, b) => {
        const timeA = a.parsedDate ? a.parsedDate.getTime() : 0;
        const timeB = b.parsedDate ? b.parsedDate.getTime() : 0;
        return timeB - timeA;
    });

    let generalHtml = '';
    listGeneral.forEach(it => {
        generalHtml += `
            <tr class="clickable-row" data-fecha="${escapeHtml(it.fecha)}" title="Haz clic para ver las OPs cortadas en esta fecha">
                <td><strong>${escapeHtml(it.fecha)}</strong></td>
                <td class="text-right">${formatNumber(it.unidades)}</td>
                <td class="text-right">${formatNumber(it.lotes)}</td>
                <td class="text-right">${it.diasAntiguedad} d</td>
                <td class="text-right">${it.pct.toFixed(2).replace('.', ',')}%</td>
            </tr>
        `;
    });
    if (DOM.tblAntiguedad) {
        DOM.tblAntiguedad.innerHTML = generalHtml;
        DOM.tblAntiguedad.querySelectorAll('tr.clickable-row').forEach(row => {
            row.addEventListener('click', () => {
                const f = row.dataset.fecha;
                openInventoryDrilldown('fechaCorte', f, `Fecha Corte: ${f}`);
            });
        });
    }

    // 2. TABLA CRÍTICOS (>30 días): Del más viejo al más reciente
    const listCriticos = allDates.filter(it => it.diasAntiguedad > 30);
    listCriticos.sort((a, b) => b.diasAntiguedad - a.diasAntiguedad);

    const totalCriticosUnits = listCriticos.reduce((acc, it) => acc + it.unidades, 0);
    if (DOM.badgeTotalCriticos) {
        DOM.badgeTotalCriticos.textContent = `${formatNumber(totalCriticosUnits)} Unds`;
    }

    let criticosHtml = '';
    if (listCriticos.length === 0) {
        criticosHtml = `<tr><td colspan="6" class="text-center" style="padding: 1.5rem; color: var(--text-muted);">No hay lotes con más de 30 días de antigüedad</td></tr>`;
    } else {
        listCriticos.forEach(it => {
            let alertBadge = '<span class="tag tag-pending">> 30 Días</span>';
            if (it.diasAntiguedad > 60) alertBadge = '<span class="tag tag-danger">> 60 Días</span>';
            if (it.diasAntiguedad > 90) alertBadge = '<span class="tag tag-danger" style="font-weight:700;">> 90 Días!</span>';

            criticosHtml += `
                <tr class="clickable-row" data-fecha="${escapeHtml(it.fecha)}" title="Haz clic para ver las OPs críticas">
                    <td><strong>${escapeHtml(it.fecha)}</strong></td>
                    <td class="text-right" style="font-weight:600; color: #ef4444;">${formatNumber(it.unidades)}</td>
                    <td class="text-right">${formatNumber(it.lotes)}</td>
                    <td class="text-right"><strong>${it.diasAntiguedad} Días</strong></td>
                    <td class="text-right">${it.pct.toFixed(2).replace('.', ',')}%</td>
                    <td class="text-center">${alertBadge}</td>
                </tr>
            `;
        });
    }
    if (DOM.tblCriticos) {
        DOM.tblCriticos.innerHTML = criticosHtml;
        DOM.tblCriticos.querySelectorAll('tr.clickable-row').forEach(row => {
            row.addEventListener('click', () => {
                const f = row.dataset.fecha;
                openInventoryDrilldown('fechaCorte', f, `Lotes Críticos Fecha: ${f}`);
            });
        });
    }
}

function computeAndRenderDespachos() {
    if (state.despachosRecords && state.despachosRecords.length > 0) {
        const byMonth = {};
        const byWeek = {};
        const byDay = {};

        let totalGeneralPendiente = 0;
        let totalGeneralLotesPendientes = 0;

        state.despachosRecords.forEach(r => {
            const parsed = r.parsedDate || parseDateString(r.fecha);
            const year = parsed ? parsed.getFullYear() : 'Sin Fecha';
            const monthIdx = parsed ? parsed.getMonth() : -1;
            const monthName = (parsed && MONTH_NAMES[monthIdx]) ? MONTH_NAMES[monthIdx] : 'Sin Fecha';
            const mesKey = parsed ? `${year}-${String(monthIdx).padStart(2, '0')}` : 'sin-fecha';
            const weekNum = parsed ? getISOWeekNumber(parsed) : 0;
            const weekKey = parsed ? `${year}-${String(weekNum).padStart(2, '0')}` : 'sin-fecha';
            const fechaStr = r.fecha || 'Sin Fecha';
            const cant = Number(r.cantidad) || 0;
            const isDesp = Boolean(r.isDespachado);

            const cantDesp = isDesp ? cant : 0;
            const cantPend = !isDesp ? cant : 0;

            if (!isDesp) {
                totalGeneralPendiente += cant;
                totalGeneralLotesPendientes += 1;
            }

            // 1. Mensual (Totales del mes)
            if (!byMonth[mesKey]) {
                byMonth[mesKey] = {
                    mesKey: mesKey,
                    monthIdx: monthIdx,
                    mes: monthName,
                    year: year,
                    cant: 0,
                    cantDespachado: 0,
                    cantPendiente: 0,
                    orderTimestamp: parsed ? new Date(year, monthIdx, 1).getTime() : 0
                };
            }
            byMonth[mesKey].cant += cant;
            byMonth[mesKey].cantDespachado += cantDesp;
            byMonth[mesKey].cantPendiente += cantPend;

            // 2. Semanal (Totales de la semana)
            if (!byWeek[weekKey]) {
                byWeek[weekKey] = {
                    weekKey: weekKey,
                    semana: weekNum,
                    year: year,
                    cant: 0,
                    cantDespachado: 0,
                    cantPendiente: 0,
                    daysSet: new Set(),
                    orderTimestamp: parsed ? parsed.getTime() : 0
                };
            }
            byWeek[weekKey].cant += cant;
            byWeek[weekKey].cantDespachado += cantDesp;
            byWeek[weekKey].cantPendiente += cantPend;
            byWeek[weekKey].daysSet.add(fechaStr);
            if (parsed && parsed.getTime() > byWeek[weekKey].orderTimestamp) {
                byWeek[weekKey].orderTimestamp = parsed.getTime();
            }

            // 3. Diario (Totales por fecha exacta)
            if (!byDay[fechaStr]) {
                byDay[fechaStr] = {
                    fecha: fechaStr,
                    parsedDate: parsed,
                    semana: weekNum,
                    mes: monthName,
                    totalProg: 0,
                    despachadoReal: 0,
                    pendiente: 0,
                    lotesTotal: 0,
                    lotesDespachados: 0,
                    lotesPendientes: 0
                };
            }
            byDay[fechaStr].totalProg += cant;
            byDay[fechaStr].despachadoReal += cantDesp;
            byDay[fechaStr].pendiente += cantPend;
            byDay[fechaStr].lotesTotal += 1;
            if (isDesp) {
                byDay[fechaStr].lotesDespachados += 1;
            } else {
                byDay[fechaStr].lotesPendientes += 1;
            }
        });

        if (DOM.kpiPendienteDespacho) DOM.kpiPendienteDespacho.textContent = formatNumber(Math.round(totalGeneralPendiente));
        if (DOM.kpiLotesPendientes) DOM.kpiLotesPendientes.textContent = `${totalGeneralLotesPendientes} Lotes sin 'X'`;
        if (DOM.badgeDiarioPendiente) DOM.badgeDiarioPendiente.textContent = `Pendiente: ${formatNumber(Math.round(totalGeneralPendiente))}`;

        // 1. RENDER MENSUAL
        const mesesList = Object.values(byMonth).sort((a, b) => b.orderTimestamp - a.orderTimestamp);
        const totalMensual = mesesList.reduce((acc, it) => acc + it.cant, 0);
        const mediaMensual = mesesList.length > 0 ? Math.round(totalMensual / mesesList.length) : 0;
        if (DOM.kpiMediaMensual) DOM.kpiMediaMensual.textContent = formatNumber(mediaMensual);

        let mensualHtml = '';
        mesesList.forEach(it => {
            const pct = totalMensual > 0 ? (it.cant / totalMensual) * 100 : 0;
            mensualHtml += `
                <tr class="clickable-row" data-type="mes" data-value="${it.monthIdx}" data-year="${it.year}" data-label="Despachos Mes: ${it.mes} ${it.year}" title="Haz clic para ver las OPs despachadas en este mes">
                    <td style="text-transform: capitalize;">${escapeHtml(it.mes)} ${it.year}</td>
                    <td class="text-right">${formatNumber(Math.round(it.cant))}</td>
                    <td class="text-right">${pct.toFixed(2).replace('.', ',')}%</td>
                </tr>
            `;
        });

        mensualHtml += `
            <tr class="total-row">
                <td>Total Despachos</td>
                <td class="text-right">${formatNumber(Math.round(totalMensual))}</td>
                <td class="text-right">100,00%</td>
            </tr>
        `;
        if (DOM.tblMensual) {
            DOM.tblMensual.innerHTML = mensualHtml;
            DOM.tblMensual.querySelectorAll('tr.clickable-row').forEach(row => {
                row.addEventListener('click', () => {
                    const m = parseInt(row.dataset.value, 10);
                    const y = parseInt(row.dataset.year, 10);
                    const label = row.dataset.label;
                    openDespachosDrilldown((r) => {
                        const p = r.parsedDate || parseDateString(r.fecha);
                        return p && p.getMonth() === m && p.getFullYear() === y;
                    }, label);
                });
            });
        }

        // 2. RENDER SEMANAL
        const semanasList = Object.values(byWeek).sort((a, b) => b.orderTimestamp - a.orderTimestamp);
        const totalSemanasUnits = semanasList.reduce((acc, it) => acc + it.cant, 0);
        const mediaSemanal = semanasList.length > 0 ? Math.round(totalSemanasUnits / semanasList.length) : 0;
        if (DOM.kpiMediaSemanal) DOM.kpiMediaSemanal.textContent = formatNumber(mediaSemanal);

        let semanalHtml = '';
        semanasList.forEach(it => {
            const diasCount = it.daysSet.size || 1;
            const promDia = Math.round(it.cant / diasCount);
            semanalHtml += `
                <tr class="clickable-row" data-type="semana" data-value="${it.semana}" data-year="${it.year}" data-label="Despachos: Semana ${it.semana} (${it.year})" title="Haz clic para ver las OPs despachadas en esta semana">
                    <td><strong>Semana ${it.semana}</strong> <span style="font-size:0.7rem; color:var(--text-muted);">(${it.year})</span></td>
                    <td class="text-right">${formatNumber(Math.round(it.cant))}</td>
                    <td class="text-right">${diasCount}</td>
                    <td class="text-right">${formatNumber(promDia)} / día</td>
                </tr>
            `;
        });
        if (DOM.tblSemanal) {
            DOM.tblSemanal.innerHTML = semanalHtml;
            DOM.tblSemanal.querySelectorAll('tr.clickable-row').forEach(row => {
                row.addEventListener('click', () => {
                    const sem = parseInt(row.dataset.value, 10);
                    const y = parseInt(row.dataset.year, 10);
                    const label = row.dataset.label;
                    openDespachosDrilldown((r) => {
                        const p = r.parsedDate || parseDateString(r.fecha);
                        return p && getISOWeekNumber(p) === sem && p.getFullYear() === y;
                    }, label);
                });
            });
        }

        // 3. RENDER DIARIO
        const diasList = Object.values(byDay).sort((a, b) => {
            const timeA = a.parsedDate ? a.parsedDate.getTime() : 0;
            const timeB = b.parsedDate ? b.parsedDate.getTime() : 0;
            return timeB - timeA;
        });

        const totalDiasUnits = diasList.reduce((acc, it) => acc + it.totalProg, 0);
        const mediaDiaria = diasList.length > 0 ? Math.round(totalDiasUnits / diasList.length) : 0;
        if (DOM.kpiMediaDiaria) DOM.kpiMediaDiaria.textContent = formatNumber(mediaDiaria);

        let diarioHtml = '';
        diasList.forEach(it => {
            const totalProg = it.totalProg || 1;
            const pctDesp = ((it.despachadoReal / totalProg) * 100).toFixed(2).replace('.', ',') + '%';
            const pctNoDesp = ((it.pendiente / totalProg) * 100).toFixed(2).replace('.', ',') + '%';

            let estadoBadge = '<span class="tag tag-integrated">Completado</span>';
            if (it.pendiente > 0 && it.despachadoReal > 0) {
                estadoBadge = '<span class="tag tag-pending">Parcial</span>';
            } else if (it.pendiente > 0 && it.despachadoReal === 0) {
                estadoBadge = '<span class="tag tag-danger">Pendiente</span>';
            }

            diarioHtml += `
                <tr class="clickable-row" data-fecha="${escapeHtml(it.fecha)}" title="Haz clic para ver las OPs despachadas en esta fecha">
                    <td><strong>${escapeHtml(it.fecha)}</strong></td>
                    <td class="text-right">${formatNumber(Math.round(it.totalProg))}</td>
                    <td class="text-center">${it.semana}</td>
                    <td style="text-transform: capitalize;">${escapeHtml(it.mes)}</td>
                    <td class="text-right"><strong style="color: #10b981; font-family: var(--font-mono);">${formatNumber(Math.round(it.despachadoReal))}</strong></td>
                    <td class="text-right">${pctDesp}</td>
                    <td class="text-right"><strong style="color: ${it.pendiente > 0 ? '#f59e0b' : 'inherit'}; font-family: var(--font-mono);">${formatNumber(Math.round(it.pendiente))}</strong></td>
                    <td class="text-right">${pctNoDesp}</td>
                    <td class="text-center">${estadoBadge}</td>
                </tr>
            `;
        });
        if (DOM.tblDiario) {
            DOM.tblDiario.innerHTML = diarioHtml;
            DOM.tblDiario.querySelectorAll('tr.clickable-row').forEach(row => {
                row.addEventListener('click', () => {
                    const f = row.dataset.fecha;
                    openDespachosDrilldown((r) => r.fecha === f, `Despachos Fecha: ${f}`);
                });
            });
        }
    }
}
