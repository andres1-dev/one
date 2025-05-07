<script>
        // Configuración de Toast
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
            didOpen: (toast) => {
                toast.addEventListener('mouseenter', Swal.stopTimer)
                toast.addEventListener('mouseleave', Swal.resumeTimer)
            }
        });
        
            const API_URL = (async () => {
      const apiKey = 'AIzaSyAn6o3jTwxe2ahhT-Aj03BWAS2ccE3NlE4';
      const fetchSheet = async (id, range) => {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${range}?key=${apiKey}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Error al obtener ${range}`);
        return (await res.json()).values || [];
      };
      const parseJSON = str => {
        try { return str ? JSON.parse(str) : null; } catch { return null; }
      };

      const [main, comp] = await Promise.all([
        fetchSheet('133NiyjNApZGkEFs4jUvpJ9So-cSEzRVeW2FblwOCrjI', 'DATA2!A2:S'),
        fetchSheet('1d5dCCCgiWXfM6vHu3zGGKlvK2EycJtT7Uk4JqUjDOfE', 'DATA!C2:C')
      ]);

      const compParsed = comp.map(r => parseJSON(r[0]));
      return main.map(row => {
        const doc = row[0]?.toString();
        const compMatch = compParsed.find(c => c?.Documento === doc);
        return {
          A: row[0], FECHA: row[1], TALLER: row[2], LINEA: row[3],
          AUDITOR: row[4], ESCANER: row[5], LOTE: row[6], REFPROV: row[7],
          DESCRIPCIÓN: row[8], CANTIDAD: row[9], REFERENCIA: row[10],
          TIPO: row[11], PVP: row[12], PRENDA: row[13], GENERO: row[14],
          PROVEEDOR: row[15], ANEXOS: parseJSON(row[16]), HR: parseJSON(row[17]),
          Clientes: compMatch ? compMatch.Clientes : null
        };
      });
    })();

        // URL de la API
        /*const API_URL = "https://script.google.com/macros/s/AKfycbxvAb-hl2No_otFOvqSdFIgrDg1RU0Jh2JHB2kYyqksYi_to9gspsps3bbHLLj87JbG/exec";*/

        
        // Datos almacenados para exportación
        let allData = [];
        let processedRows = [];
        let dataTable;
        let columnsVisibility = {};
        
        // Opciones para filtros
        let plantasOptions = [];
        let tiposOptions = [];
        
        $(document).ready(function() {
            // Inicializar la configuración de columnas
            initColumnConfig();
            
            // Cargar datos iniciales
            loadData();
            
            // Configurar eventos
            $('#refresh-btn').click(loadData);
            $('#export-excel').click(exportToExcel);
            $('#toggle-columns').click(showColumnsModal);
            $('#save-columns').click(saveColumnsConfig);
            $('#apply-filters').click(applyFilters);
            $('#reset-filters').click(resetFilters);
            
            // Actualizar la última fecha
            updateLastUpdateDate();
        });
        
        function initColumnConfig() {
            const columns = [
                { name: 'OP', visible: true },
                { name: 'Fecha', visible: true },
                { name: 'Planta', visible: true },
                { name: 'Gestor', visible: true },
                { name: 'Auditor', visible: true },
                { name: 'Escáner', visible: false },
                { name: 'Lote', visible: false },
                { name: 'REF.PROV', visible: true },
                { name: 'Descripción', visible: true },
                { name: 'Cantidad', visible: true },
                { name: 'Referencia', visible: true },
                { name: 'Tipo', visible: true },
                { name: 'PVP', visible: true },
                { name: 'TP', visible: true },
                { name: 'Género', visible: true },
                { name: 'Proveedor', visible: false },
                { name: 'Color', visible: true },
                { name: 'Talla', visible: true },
                { name: 'Templo', visible: true },
                { name: 'Shopping', visible: true }
            ];
            
            // Inicializar objeto de visibilidad
            columns.forEach((col, index) => {
                columnsVisibility[index] = col.visible;
            });
            
            // Llenar contenedor del modal
            const $columnsContainer = $('#columns-container');
            columns.forEach((col, index) => {
                const $columnCheck = $(`
                    <div class="col-md-6 mb-2">
                        <div class="form-check">
                            <input class="form-check-input column-toggle" type="checkbox" value="${index}" id="col-${index}" ${col.visible ? 'checked' : ''}>
                            <label class="form-check-label" for="col-${index}">${col.name}</label>
                        </div>
                    </div>
                `);
                $columnsContainer.append($columnCheck);
            });
        }
        
        function showColumnsModal() {
            const modal = new bootstrap.Modal(document.getElementById('columns-modal'));
            modal.show();
        }
        
        function saveColumnsConfig() {
            $('.column-toggle').each(function() {
                const colIndex = parseInt($(this).val());
                columnsVisibility[colIndex] = $(this).prop('checked');
            });
            
            // Aplicar visibilidad a la tabla
            if (dataTable) {
                Object.keys(columnsVisibility).forEach(index => {
                    dataTable.column(parseInt(index)).visible(columnsVisibility[index]);
                });
                
                // Cerrar modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('columns-modal'));
                modal.hide();
                
                // Notificar
                Toast.fire({
                    icon: 'success',
                    title: 'Configuración de columnas guardada'
                });
            }
        }
        
        function updateLastUpdateDate() {
            const now = new Date();
            const dateStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            $('#last-update').text(dateStr);
        }
        
function loadData() {
  $('#refresh-btn').prop('disabled', true);
  $('#refresh-btn').html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> <span class="d-none d-md-inline">Cargando...</span>');
  $('#export-excel').prop('disabled', true);
  $('#loading-overlay').show();

  API_URL.then(function(data) {
    allData = data;
    processData(data);
    updateStats(data);
    updateFilters(data);
    $('#export-excel').prop('disabled', false);

    Toast.fire({
      icon: 'success',
      title: 'Datos cargados correctamente'
    });
  }).catch(function(error) {
    Swal.fire({
      icon: 'error',
      title: 'Error al cargar datos',
      text: error.message || 'No se pudo conectar con el servidor',
      confirmButtonText: 'Entendido',
      confirmButtonColor: 'var(--color-primary)'
    });
    console.error(error);
  }).finally(function() {
    $('#refresh-btn').prop('disabled', false);
    $('#refresh-btn').html('<i class="bi bi-arrow-repeat"></i> <span class="d-none d-md-inline">Actualizar Datos</span>');
    $('#loading-overlay').hide();
    updateLastUpdateDate();
  });
}

        
        function processData(data) {
            // Limpiar datos procesados
            processedRows = [];
            
            data.forEach(item => {
                if (item.Clientes) {
                    // Procesar distribuciones de Templo
                    if (item.Clientes.Templo && item.Clientes.Templo.distribucion) {
                        item.Clientes.Templo.distribucion.forEach(dist => {
                            const temploQty = dist.cantidad;
                            const shoppingQty = findShoppingQuantity(item, dist.codigo, dist.talla);
                            const rubenQty = findRubenQuantity(item, dist.codigo, dist.talla);
                            
                            const rowData = createRowData(item, dist.color, dist.talla, temploQty, shoppingQty, rubenQty);
                            processedRows.push(rowData);
                        });
                    }
                    
                    // Procesar distribuciones de Shopping (por si hay tallas/colores no presentes en Templo)
                    if (item.Clientes.Shopping && item.Clientes.Shopping.distribucion) {
                        item.Clientes.Shopping.distribucion.forEach(dist => {
                            // Verificar si ya se procesó esta combinación color/talla
                            const exists = item.Clientes.Templo && item.Clientes.Templo.distribucion.some(d => 
                                d.codigo === dist.codigo && d.talla === dist.talla);
                            
                            if (!exists) {
                                const shoppingQty = dist.cantidad;
                                const temploQty = 0;
                                const rubenQty = findRubenQuantity(item, dist.codigo, dist.talla);
                                
                                const rowData = createRowData(item, dist.color, dist.talla, temploQty, shoppingQty, rubenQty);
                                processedRows.push(rowData);
                            }
                        });
                    }
                    
                    // Procesar distribuciones de Rubén (si existen y no están ya procesadas)
                    if (item.Clientes.Ruben && item.Clientes.Ruben.distribucion) {
                        item.Clientes.Ruben.distribucion.forEach(dist => {
                            // Verificar si ya se procesó esta combinación color/talla
                            const exists = (item.Clientes.Templo && item.Clientes.Templo.distribucion.some(d => 
                                d.codigo === dist.codigo && d.talla === dist.talla)) || 
                                (item.Clientes.Shopping && item.Clientes.Shopping.distribucion.some(d => 
                                d.codigo === dist.codigo && d.talla === dist.talla));
                            
                            if (!exists) {
                                const rubenQty = dist.cantidad;
                                const temploQty = 0;
                                const shoppingQty = 0;
                                
                                const rowData = createRowData(item, dist.color, dist.talla, temploQty, shoppingQty, rubenQty);
                                processedRows.push(rowData);
                            }
                        });
                    }
                }
            });
            
            // Renderizar tabla
            renderTable(processedRows);
        }
        
        function updateStats(data) {
            let totalTemplo = 0;
            let totalShopping = 0;
            let uniqueRefs = new Set();
            let totalRefs = 0;
            
            // Calcular estadísticas
            processedRows.forEach(row => {
                totalTemplo += parseInt(row.Templo) || 0;
                totalShopping += parseInt(row.Shopping) || 0;
                uniqueRefs.add(row.RefProv);
                totalRefs++;
            });
            
            // Actualizar UI
            $('#total-records').text(processedRows.length);
            $('#total-templo').text(totalTemplo);
            $('#total-shopping').text(totalShopping);
            $('#unique-refs').text(uniqueRefs.size);
            $('#total-refs').text(totalRefs);
            
            // Calcular porcentajes
            const total = totalTemplo + totalShopping;
            if (total > 0) {
                $('#templo-percent').text(Math.round((totalTemplo / total) * 100) + '% del total');
                $('#shopping-percent').text(Math.round((totalShopping / total) * 100) + '% del total');
            }
            
            // Cambio simulado para el badge
            const randomChange = Math.floor(Math.random() * 20) - 10; // -10 a +10
            const changeElement = $('#records-change');
            
            if (randomChange >= 0) {
                changeElement.html(`<i class="bi bi-arrow-up-short"></i>+${randomChange}%`);
                changeElement.removeClass('negative').addClass('positive');
            } else {
                changeElement.html(`<i class="bi bi-arrow-down-short"></i>${randomChange}%`);
                changeElement.removeClass('positive').addClass('negative');
            }
        }
        
        function updateFilters(data) {
            // Extraer opciones únicas para los filtros
            plantasOptions = [...new Set(processedRows.map(row => row.Planta).filter(Boolean))];
            tiposOptions = [...new Set(processedRows.map(row => row.Tipo).filter(Boolean))];
            
            // Actualizar selectores
            const $locationFilter = $('#location-filter');
            const $productFilter = $('#product-filter');
            
            // Preservar selecciones actuales
            const currentLocation = $locationFilter.val();
            const currentProduct = $productFilter.val();
            
            // Limpiar opciones existentes excepto la primera
            $locationFilter.find('option:not(:first)').remove();
            $productFilter.find('option:not(:first)').remove();
            
            // Añadir nuevas opciones
            plantasOptions.forEach(planta => {
                $locationFilter.append(`<option value="${planta}">${planta}</option>`);
            });
            
            tiposOptions.forEach(tipo => {
                $productFilter.append(`<option value="${tipo}">${tipo}</option>`);
            });
            
            // Restaurar selecciones si existían
            if (currentLocation && plantasOptions.includes(currentLocation)) {
                $locationFilter.val(currentLocation);
            }
            
            if (currentProduct && tiposOptions.includes(currentProduct)) {
                $productFilter.val(currentProduct);
            }
        }
        
        function renderTable(rows) {
            // Destruir tabla existente si ya fue inicializada
            if (dataTable) {
                dataTable.destroy();
            }
            
            // Limpiar tbody
            const $tbody = $('#distribution-table tbody');
            $tbody.empty();
            
            // Añadir filas
            rows.forEach(rowData => {
                addTableRowFromData(rowData, $tbody);
            });
            
            // Inicializar DataTables
            dataTable = $('#distribution-table').DataTable({
                scrollX: true,
                scrollY: "65vh",
                scrollCollapse: true,
                paging: true,
                language: {
                    url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json'
                },
                pageLength: 25,
                lengthMenu: [10, 25, 50, 100],
                order: [[0, 'desc'], [1, 'desc']],
                drawCallback: function() {
                    
                    // Aplicar configuración de visibilidad de columnas
                    if (columnsVisibility) {
                        Object.keys(columnsVisibility).forEach(index => {
                            dataTable.column(parseInt(index)).visible(columnsVisibility[index]);
                        });
                    }
                },
                initComplete: function() {
                    // Añadir clases de estilo al wrapper
                    $('.dataTables_wrapper').addClass('pt-0');
                }
            });
        }
        
        // Crea un objeto con los datos de la fila para exportar
        function createRowData(item, color, talla, temploQty, shoppingQty, rubenQty) {
            return {
                OP: item.A || '',
                Fecha: item.FECHA || '',
                Planta: item.TALLER || '',
                Gestor: item.LINEA || '',
                Auditor: item.AUDITOR || '',
                Escaner: item.ESCANER || '',
                Lote: item.LOTE || '',
                RefProv: item.REFPROV || '',
                Descripcion: item.DESCRIPCIÓN || '',
                Cantidad: item.CANTIDAD || '',
                Referencia: item.REFERENCIA || '',
                Tipo: item.TIPO || '',
                PVP: item.PVP || '',
                TP: item.PRENDA || '',
                Genero: item.GENERO || '',
                Proveedor: item.PROVEEDOR || '',
                Color: color || '',
                Talla: talla || '',
                Templo: temploQty || 0,
                Shopping: shoppingQty || 0
            };
        }
        
        // Agrega una fila a la tabla a partir de un objeto de datos
        function addTableRowFromData(rowData, $tbody) {
            const                 $row = $(`
                <tr>
                    <td>${rowData.OP}</td>
                    <td>${rowData.Fecha}</td>
                    <td>${rowData.Planta}</td>
                    <td>${rowData.Gestor}</td>
                    <td>${rowData.Auditor}</td>
                    <td>${rowData.Escaner}</td>
                    <td>${rowData.Lote}</td>
                    <td>${rowData.RefProv}</td>
                    <td>${rowData.Descripcion}</td>
                    <td>${rowData.Cantidad}</td>
                    <td>${rowData.Referencia}</td>
                    <td>${rowData.Tipo}</td>
                    <td>${rowData.PVP}</td>
                    <td>${rowData.TP}</td>
                    <td>${rowData.Genero}</td>
                    <td>${rowData.Proveedor}</td>
                    <td>${rowData.Color}</td>
                    <td>${rowData.Talla}</td>
                    <td>${rowData.Templo}</td>
                    <td>${rowData.Shopping}</td>
                </tr>
            `);
            
            $tbody.append($row);
        }
        
        function findShoppingQuantity(item, codigo, talla) {
            if (item.Clientes && item.Clientes.Shopping && item.Clientes.Shopping.distribucion) {
                const dist = item.Clientes.Shopping.distribucion.find(d => 
                    d.codigo === codigo && d.talla === talla);
                return dist ? dist.cantidad : 0;
            }
            return 0;
        }
        
        function findRubenQuantity(item, codigo, talla) {
            if (item.Clientes && item.Clientes.Ruben && item.Clientes.Ruben.distribucion) {
                const dist = item.Clientes.Ruben.distribucion.find(d => 
                    d.codigo === codigo && d.talla === talla);
                return dist ? dist.cantidad : 0;
            }
            return 0;
        }
        
        function applyFilters() {
            const dateFilter = $('#date-filter').val();
            const locationFilter = $('#location-filter').val();
            const productFilter = $('#product-filter').val();
            
            let filteredRows = [...processedRows];
            
            // Filtrar por fecha
            if (dateFilter !== 'all') {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const weekStart = new Date(today);
                weekStart.setDate(today.getDate() - today.getDay());
                
                const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                
                filteredRows = filteredRows.filter(row => {
                    if (!row.Fecha) return false;
                    
                    const rowDate = parseDate(row.Fecha);
                    if (!rowDate) return false;
                    
                    if (dateFilter === 'today') {
                        return isSameDay(rowDate, today);
                    } else if (dateFilter === 'week') {
                        return rowDate >= weekStart;
                    } else if (dateFilter === 'month') {
                        return rowDate >= monthStart;
                    }
                    return true;
                });
            }
            
            // Filtrar por planta
            if (locationFilter !== 'all') {
                filteredRows = filteredRows.filter(row => row.Planta === locationFilter);
            }
            
            // Filtrar por tipo
            if (productFilter !== 'all') {
                filteredRows = filteredRows.filter(row => row.Tipo === productFilter);
            }
            
            // Renderizar tabla filtrada
            renderTable(filteredRows);
            
            // Mostrar mensaje de filtros aplicados
            Toast.fire({
                icon: 'info',
                title: `Mostrando ${filteredRows.length} de ${processedRows.length} registros`
            });
        }
        
        function resetFilters() {
            $('#date-filter').val('all');
            $('#location-filter').val('all');
            $('#product-filter').val('all');
            
            // Renderizar todos los datos
            renderTable(processedRows);
            
            // Notificar
            Toast.fire({
                icon: 'success',
                title: 'Filtros restablecidos'
            });
        }
        
        // Helpers para manejo de fechas
        function parseDate(dateStr) {
            if (!dateStr) return null;
            
            // Detectar formato (DD/MM/YYYY o YYYY-MM-DD)
            let parts;
            if (dateStr.includes('/')) {
                parts = dateStr.split('/');
                return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            } else if (dateStr.includes('-')) {
                parts = dateStr.split('-');
                return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            }
            
            return null;
        }
        
        function isSameDay(date1, date2) {
            return date1.getDate() === date2.getDate() &&
                date1.getMonth() === date2.getMonth() &&
                date1.getFullYear() === date2.getFullYear();
        }
        
        // Función para exportar los datos a Excel
        function exportToExcel() {
            if (!processedRows || processedRows.length === 0) {
                Swal.fire({
                    icon: 'warning',
                    title: 'No hay datos',
                    text: 'No hay datos disponibles para exportar',
                    confirmButtonText: 'Entendido',
                    confirmButtonColor: 'var(--color-primary)'
                });
                return;
            }
            
            // Mostrar notificación de procesamiento
            Toast.fire({
                icon: 'info',
                title: 'Generando archivo Excel...'
            });
            
            // Si hay un filtro aplicado, exportar solo los datos filtrados
            let dataToExport = processedRows;
            
            if (dataTable) {
                const indexes = dataTable.rows({ search: 'applied' }).indexes();
                if (indexes.length < processedRows.length) {
                    dataToExport = [];
                    indexes.each(idx => {
                        dataToExport.push(processedRows[idx]);
                    });
                }
            }
            
            try {
                // Crear una hoja de trabajo
                const worksheet = XLSX.utils.json_to_sheet(dataToExport);
                
                // Aplicar estilos (cabeceras en negrita)
                const range = XLSX.utils.decode_range(worksheet['!ref']);
                for (let col = range.s.c; col <= range.e.c; col++) {
                    const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
                    if (worksheet[cellRef]) {
                        worksheet[cellRef].s = { font: { bold: true } };
                    }
                }
                
                // Crear un libro de trabajo y añadir la hoja
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, "Distribución");
                
                // Generar el archivo Excel
                const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
                
                // Obtener la fecha actual para el nombre del archivo
                const now = new Date();
                const dateStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
                const timeStr = `${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}`;
                
                // Guardar como archivo Excel
                const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
                saveAs(blob, `Distribucion_Productos_${dateStr}_${timeStr}.xlsx`);
                
                // Notificar éxito
                Toast.fire({
                    icon: 'success',
                    title: `Excel exportado con éxito (${dataToExport.length} registros)`
                });
            } catch (error) {
                console.error("Error al exportar a Excel:", error);
                
                Swal.fire({
                    icon: 'error',
                    title: 'Error al exportar',
                    text: 'Ocurrió un error al generar el archivo Excel',
                    confirmButtonText: 'Entendido',
                    confirmButtonColor: 'var(--color-primary)'
                });
            }
        }
</script>
