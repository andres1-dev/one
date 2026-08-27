/**
 * Modal: Carga y Actualización Masiva de Hoja "DATA" vía CSV
 * Headers esperados (23 columnas):
 * OP, Ref, Coleccion, UndProg, UndCort, FechaCorte, Estado de integracion,
 * Bodega Despacho, InvPlanta, NombrePlanta, FSalidaConf, FEntregaConf,
 * Proceso, InvBPT, Saldo BPT, Descripcion, Cuento, Genero, Tipo Tejido,
 * pvp, TEMPLO DE LA MODA, BARRANCA, VALOR FACTURACION
 */
import { DATA_HEADERS } from '../config.js';
import { DOM } from '../dom.js';
import { uploadDataToGAS, fetchAllData } from '../api.js';
import { showToast, formatNumber, escapeHtml } from '../utils.js';

let parsedCsvRows = null;

export function openUploadModal() {
    parsedCsvRows = null;
    if (DOM.csvFileInput) DOM.csvFileInput.value = '';
    if (DOM.csvPreviewContainer) DOM.csvPreviewContainer.classList.add('hidden');
    if (DOM.csvDropzone) DOM.csvDropzone.classList.remove('hidden');
    if (DOM.btnConfirmUploadCsv) {
        DOM.btnConfirmUploadCsv.disabled = true;
        DOM.btnConfirmUploadCsv.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            <span>Subir a Hoja DATA</span>
        `;
    }

    if (DOM.uploadCsvModal) {
        DOM.uploadCsvModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

export function closeUploadModal() {
    if (DOM.uploadCsvModal) {
        DOM.uploadCsvModal.classList.add('hidden');
        document.body.style.overflow = '';
    }
    parsedCsvRows = null;
}

export function handleFileSelect(file) {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
        showToast('Por favor selecciona un archivo con formato .CSV', 'warning');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        processCsvText(text, file.name);
    };
    reader.onerror = () => {
        showToast('Error al leer el archivo seleccionado', 'error');
    };
    reader.readAsText(file, 'UTF-8');
}

/**
 * Parser robusto de CSV con soporte para comillas, saltos de línea y delimitador (coma o punto y coma)
 */
export function parseCSV(text) {
    const lines = [];
    let currentRow = [];
    let currentCell = '';
    let insideQuotes = false;

    // Detectar delimitador inspeccionando la primera línea
    const firstLine = text.split(/\r?\n/)[0] || '';
    const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (insideQuotes && nextChar === '"') {
                currentCell += '"';
                i++; // Saltar comilla de escape
            } else {
                insideQuotes = !insideQuotes;
            }
        } else if (char === delimiter && !insideQuotes) {
            currentRow.push(currentCell.trim());
            currentCell = '';
        } else if ((char === '\r' || char === '\n') && !insideQuotes) {
            if (char === '\r' && nextChar === '\n') {
                i++; // Saltar \n en CRLF
            }
            currentRow.push(currentCell.trim());
            currentCell = '';
            if (currentRow.some(cell => cell.length > 0)) {
                lines.push(currentRow);
            }
            currentRow = [];
        } else {
            currentCell += char;
        }
    }

    // Última fila pendiente
    if (currentCell.length > 0 || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        if (currentRow.some(cell => cell.length > 0)) {
            lines.push(currentRow);
        }
    }

    return lines;
}

function processCsvText(csvText, fileName) {
    try {
        const rows = parseCSV(csvText);
        if (rows.length < 2) {
            showToast('El archivo CSV no contiene registros suficientes (mínimo cabecera + 1 fila)', 'warning');
            return;
        }

        const headers = rows[0].map(h => h.trim().replace(/^[\uFEFF\xEF\xBB\xBF]/, ''));
        parsedCsvRows = rows;

        // Validar columnas
        const normalizedExpected = DATA_HEADERS.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
        const normalizedUploaded = headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

        let matchedCount = 0;
        normalizedExpected.forEach(exp => {
            if (normalizedUploaded.includes(exp)) matchedCount++;
        });

        const isExactMatch = matchedCount === DATA_HEADERS.length && headers.length === DATA_HEADERS.length;

        renderCsvPreview(fileName, rows, isExactMatch, matchedCount);

        if (DOM.btnConfirmUploadCsv) {
            DOM.btnConfirmUploadCsv.disabled = false;
        }
    } catch (err) {
        console.error('Error parseando CSV:', err);
        showToast(`Error al procesar el archivo CSV: ${err.message}`, 'error');
    }
}

function renderCsvPreview(fileName, rows, isExactMatch, matchedCount) {
    if (DOM.csvFileName) DOM.csvFileName.textContent = fileName;
    if (DOM.csvRowCount) DOM.csvRowCount.textContent = `${formatNumber(rows.length - 1)} Registros de Datos`;
    if (DOM.csvColCount) DOM.csvColCount.textContent = `${rows[0].length} Columnas`;

    if (DOM.csvValidationBadge) {
        if (isExactMatch) {
            DOM.csvValidationBadge.className = 'tag tag-integrated';
            DOM.csvValidationBadge.textContent = `✅ Encabezados 100% Coincidentes (${DATA_HEADERS.length}/${DATA_HEADERS.length})`;
        } else {
            DOM.csvValidationBadge.className = 'tag tag-pending';
            DOM.csvValidationBadge.textContent = `⚠️ Coinciden ${matchedCount} de ${DATA_HEADERS.length} columnas`;
        }
    }

    // Renderizar tabla de previsualización (Primeras 5 filas)
    if (DOM.csvPreviewTableHead && DOM.csvPreviewTableBody) {
        const headers = rows[0];
        let thHtml = '<tr>';
        headers.forEach(h => {
            thHtml += `<th>${escapeHtml(h)}</th>`;
        });
        thHtml += '</tr>';
        DOM.csvPreviewTableHead.innerHTML = thHtml;

        let tbodyHtml = '';
        const previewRows = rows.slice(1, 6);
        previewRows.forEach(row => {
            tbodyHtml += '<tr>';
            for (let i = 0; i < headers.length; i++) {
                tbodyHtml += `<td>${escapeHtml(row[i] || '')}</td>`;
            }
            tbodyHtml += '</tr>';
        });
        DOM.csvPreviewTableBody.innerHTML = tbodyHtml;
    }

    if (DOM.csvDropzone) DOM.csvDropzone.classList.add('hidden');
    if (DOM.csvPreviewContainer) DOM.csvPreviewContainer.classList.remove('hidden');
}

export async function submitCsvUpload() {
    if (!parsedCsvRows || parsedCsvRows.length === 0) {
        showToast('No hay datos procesados para subir', 'warning');
        return;
    }

    if (DOM.btnConfirmUploadCsv) {
        DOM.btnConfirmUploadCsv.disabled = true;
        DOM.btnConfirmUploadCsv.innerHTML = `
            <div class="btn-spinner"></div>
            <span>Subiendo ${formatNumber(parsedCsvRows.length - 1)} filas a DATA...</span>
        `;
    }

    showToast(`Enviando ${formatNumber(parsedCsvRows.length - 1)} registros a la hoja "DATA"...`, 'info', 4000);

    try {
        await uploadDataToGAS(parsedCsvRows);
        showToast(`✅ Hoja "DATA" actualizada exitosamente con ${formatNumber(parsedCsvRows.length - 1)} filas`, 'success', 5000);
        closeUploadModal();
        
        // Recargar datos actualizados en la aplicación
        setTimeout(() => {
            fetchAllData();
        }, 1200);
    } catch (err) {
        console.error('Error subiendo CSV a GAS:', err);
        showToast(`Error al subir datos a Google Apps Script: ${err.message}`, 'error');
        if (DOM.btnConfirmUploadCsv) {
            DOM.btnConfirmUploadCsv.disabled = false;
            DOM.btnConfirmUploadCsv.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                <span>Reintentar Subida</span>
            `;
        }
    }
}
