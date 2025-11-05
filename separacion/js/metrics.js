// ===== SISTEMA DE MÉTRICAS DE RENDIMIENTO =====
// metrics.js - Sistema de medición de rendimiento para documentos finalizados
// Integración no invasiva con el sistema existente

class MetricsSystem {
    constructor(options = {}) {
        this.config = {
            jornadaDiaria: 31680, // 8:48:00 en segundos (528 minutos)
            capacidadBase: 7920, // unidades por persona/día (jornada / 4)
            efectividadTarget: 20, // documentos finalizados por periodo
            tiempoMuertoMaximo: 3600, // 1 hora en segundos
            pausasMaximas: 1800, // 30 minutos en segundos
            eficienciaBase: 4, // divisor base para normalización
            ...options
        };
        
        this.data = [];
        this.filteredData = [];
        this.metrics = {};
        this.isInitialized = false;
        
        // Referencias a elementos DOM
        this.elements = {};
        
        // Instancias de librerías
        this.flatpickrInstance = null;
        this.chartInstances = {};
    }

    // ===== INICIALIZACIÓN =====
    
    init(options = {}) {
        if (this.isInitialized) return;
        
        console.log('Inicializando sistema de métricas...');
        
        // Configuración adicional
        Object.assign(this.config, options);
        
        try {
            this.createUI();
            this.initializeFlatpickr();
            this.bindEvents();
            this.isInitialized = true;
            
            console.log('Sistema de métricas inicializado correctamente');
        } catch (error) {
            console.error('Error inicializando sistema de métricas:', error);
        }
    }
    
    // ===== INTERFAZ DE USUARIO =====
    
    createUI() {
        // Crear contenedor principal
        const metricsContainer = document.createElement('div');
        metricsContainer.id = 'metrics-system';
        metricsContainer.className = 'metrics-container fade-in';
        metricsContainer.innerHTML = this.getMetricsHTML();
        
        // Insertar después de las tarjetas de resumen
        const resumenGrid = document.querySelector('.resumen-grid');
        if (resumenGrid && resumenGrid.parentNode) {
            resumenGrid.parentNode.insertBefore(metricsContainer, resumenGrid.nextSibling);
        } else {
            // Fallback: insertar al inicio del container-fluid
            const container = document.querySelector('.container-fluid');
            if (container) {
                const firstCard = container.querySelector('.card');
                if (firstCard) {
                    container.insertBefore(metricsContainer, firstCard);
                } else {
                    container.appendChild(metricsContainer);
                }
            }
        }
        
        // Guardar referencias a elementos importantes
        this.elements = {
            container: metricsContainer,
            toggleBtn: document.getElementById('metricsToggle'),
            content: document.getElementById('metricsContent'),
            dateFilter: document.getElementById('metricsDateFilter'),
            cardsContainer: document.getElementById('metricsCards'),
            chartsContainer: document.getElementById('metricsCharts'),
            topList: document.getElementById('metricsTopList'),
            efficiencyChart: document.getElementById('efficiencyChart'),
            radarChart: document.getElementById('radarChart')
        };
        
        // Aplicar estilos
        this.applyStyles();
    }
    
    getMetricsHTML() {
        return `
            <div class="card metrics-card">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h5 class="card-title mb-0">
                        <i class="fas fa-chart-line me-2"></i>
                        Métricas de Rendimiento
                    </h5>
                    <button type="button" class="btn btn-sm btn-outline-primary" id="metricsToggle">
                        <i class="fas fa-chevron-down"></i>
                    </button>
                </div>
                
                <div class="card-body" id="metricsContent" style="display: none;">
                    <!-- Filtro de fechas -->
                    <div class="row mb-4">
                        <div class="col-md-6">
                            <div class="filtro-group">
                                <label class="form-label small fw-semibold">Rango de Fechas</label>
                                <input type="text" 
                                       class="form-control form-control-sm" 
                                       id="metricsDateFilter" 
                                       placeholder="Seleccionar rango de fechas"
                                       autocomplete="off">
                            </div>
                        </div>
                        <div class="col-md-6 d-flex align-items-end">
                            <div class="btn-group-sm">
                                <button type="button" class="btn btn-primary btn-sm" onclick="window.metricsSystem.updateMetrics()">
                                    <i class="fas fa-sync-alt me-1"></i>Actualizar
                                </button>
                                <button type="button" class="btn btn-outline-secondary btn-sm" onclick="window.metricsSystem.clearFilters()">
                                    <i class="fas fa-times me-1"></i>Limpiar
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Tarjetas de métricas generales -->
                    <div class="row mb-4" id="metricsCards">
                        <div class="col-md-3">
                            <div class="metric-card eficiencia">
                                <div class="metric-content">
                                    <div class="metric-icon">
                                        <i class="fas fa-bolt"></i>
                                    </div>
                                    <div class="metric-info">
                                        <div class="metric-label">Eficiencia General</div>
                                        <div class="metric-value" id="eficienciaGeneral">0%</div>
                                        <div class="metric-target">Objetivo: 100%</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="metric-card capacidad">
                                <div class="metric-content">
                                    <div class="metric-icon">
                                        <i class="fas fa-industry"></i>
                                    </div>
                                    <div class="metric-info">
                                        <div class="metric-label">Capacidad Instalada</div>
                                        <div class="metric-value" id="capacidadInstalada">0%</div>
                                        <div class="metric-target">Máx: ${this.config.capacidadBase} uds/día</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="metric-card efectividad">
                                <div class="metric-content">
                                    <div class="metric-icon">
                                        <i class="fas fa-bullseye"></i>
                                    </div>
                                    <div class="metric-info">
                                        <div class="metric-label">Efectividad</div>
                                        <div class="metric-value" id="efectividadGeneral">0%</div>
                                        <div class="metric-target">Objetivo: ${this.config.efectividadTarget} docs</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="metric-card capacidad-instalada">
                                <div class="metric-content">
                                    <div class="metric-icon">
                                        <i class="fas fa-users"></i>
                                    </div>
                                    <div class="metric-info">
                                        <div class="metric-label">Equipo Activo</div>
                                        <div class="metric-value" id="equipoActivo">0</div>
                                        <div class="metric-target">Colaboradores</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Gráficas -->
                    <div class="row mb-4" id="metricsCharts">
                        <div class="col-md-6">
                            <div class="chart-container">
                                <h6 class="chart-title">Eficiencia por Usuario</h6>
                                <canvas id="efficiencyChart" height="250"></canvas>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="chart-container">
                                <h6 class="chart-title">Rendimiento Comparativo</h6>
                                <canvas id="radarChart" height="250"></canvas>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Top semanal -->
                    <div class="row">
                        <div class="col-12">
                            <div class="card">
                                <div class="card-header">
                                    <h6 class="card-title mb-0">
                                        <i class="fas fa-trophy me-2"></i>
                                        Top Semanal
                                    </h6>
                                </div>
                                <div class="card-body">
                                    <div id="metricsTopList">
                                        <div class="text-center text-muted py-4">
                                            <i class="fas fa-chart-bar fa-2x mb-2"></i>
                                            <p>No hay datos para mostrar</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    applyStyles() {
        const style = document.createElement('style');
        style.textContent = this.getMetricsCSS();
        document.head.appendChild(style);
    }
    
    getMetricsCSS() {
        return `
            .metrics-container {
                margin-bottom: var(--spacing-xl);
            }
            
            .metrics-card {
                border-radius: var(--radius-lg);
                box-shadow: var(--shadow-sm);
                border: 1px solid var(--border-light);
            }
            
            .metric-card {
                background: var(--bg-secondary);
                border-radius: var(--radius-lg);
                padding: var(--spacing-lg);
                box-shadow: var(--shadow-sm);
                border: 1px solid var(--border-light);
                transition: all var(--transition-base);
                height: 100%;
                position: relative;
                overflow: hidden;
            }
            
            .metric-card::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 4px;
            }
            
            .metric-card.eficiencia::before { background: var(--info-color); }
            .metric-card.capacidad::before { background: var(--success-color); }
            .metric-card.efectividad::before { background: var(--warning-color); }
            .metric-card.capacidad-instalada::before { background: var(--accent-color); }
            
            .metric-card:hover {
                transform: translateY(-2px);
                box-shadow: var(--shadow-md);
            }
            
            .metric-content {
                display: flex;
                align-items: center;
                gap: var(--spacing-md);
            }
            
            .metric-icon {
                width: 50px;
                height: 50px;
                border-radius: var(--radius-lg);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.5rem;
            }
            
            .metric-card.eficiencia .metric-icon { 
                background: rgba(59, 130, 246, 0.1); 
                color: var(--info-color); 
            }
            .metric-card.capacidad .metric-icon { 
                background: rgba(16, 185, 129, 0.1); 
                color: var(--success-color); 
            }
            .metric-card.efectividad .metric-icon { 
                background: rgba(245, 158, 11, 0.1); 
                color: var(--warning-color); 
            }
            .metric-card.capacidad-instalada .metric-icon { 
                background: rgba(15, 52, 96, 0.1); 
                color: var(--accent-color); 
            }
            
            .metric-info {
                flex: 1;
            }
            
            .metric-value {
                font-size: 1.75rem;
                font-weight: 700;
                line-height: 1;
                margin-bottom: var(--spacing-xs);
                color: var(--text-primary);
                font-variant-numeric: tabular-nums;
            }
            
            .metric-label {
                font-size: 0.875rem;
                font-weight: 600;
                color: var(--text-secondary);
                margin-bottom: var(--spacing-xs);
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }
            
            .metric-target {
                font-size: 0.75rem;
                color: var(--text-muted);
                font-weight: 500;
            }
            
            .chart-container {
                background: var(--bg-secondary);
                border-radius: var(--radius-lg);
                padding: var(--spacing-lg);
                box-shadow: var(--shadow-sm);
                border: 1px solid var(--border-light);
                height: 100%;
            }
            
            .chart-title {
                font-weight: 600;
                color: var(--text-primary);
                margin-bottom: var(--spacing-md);
                text-align: center;
            }
            
            .top-item {
                display: flex;
                align-items: center;
                padding: var(--spacing-sm) 0;
                border-bottom: 1px solid var(--border-light);
            }
            
            .top-item:last-child {
                border-bottom: none;
            }
            
            .top-posicion {
                width: 24px;
                height: 24px;
                border-radius: var(--radius-full);
                background: var(--accent-color);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 0.75rem;
                font-weight: 600;
                margin-right: var(--spacing-sm);
                flex-shrink: 0;
            }
            
            .top-info {
                flex: 1;
                min-width: 0;
            }
            
            .top-nombre {
                font-weight: 600;
                color: var(--text-primary);
                font-size: 0.875rem;
                margin-bottom: 2px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .top-metricas {
                display: flex;
                gap: var(--spacing-md);
                font-size: 0.75rem;
            }
            
            .top-metrica {
                display: flex;
                align-items: center;
                gap: 4px;
                color: var(--text-muted);
            }
            
            .top-metrica i {
                font-size: 0.625rem;
            }
            
            .eficiencia-baja { color: var(--danger-color); font-weight: 600; }
            .eficiencia-media { color: var(--warning-color); font-weight: 600; }
            .eficiencia-alta { color: var(--success-color); font-weight: 600; }
            
            @media (max-width: 768px) {
                .metric-content {
                    flex-direction: column;
                    text-align: center;
                    gap: var(--spacing-sm);
                }
                
                .metric-icon {
                    width: 40px;
                    height: 40px;
                    font-size: 1.25rem;
                }
                
                .metric-value {
                    font-size: 1.5rem;
                }
                
                .chart-container {
                    padding: var(--spacing-md);
                }
                
                .top-metricas {
                    flex-direction: column;
                    gap: var(--spacing-xs);
                }
            }
        `;
    }
    
    // ===== FILTROS Y CONFIGURACIÓN =====
    
    initializeFlatpickr() {
        if (!this.elements.dateFilter) return;
        
        this.flatpickrInstance = flatpickr(this.elements.dateFilter, {
            mode: "range",
            locale: "es",
            dateFormat: "d/m/Y",
            allowInput: true,
            onChange: (selectedDates) => {
                if (selectedDates.length === 2) {
                    this.applyDateFilter(selectedDates[0], selectedDates[1]);
                }
            }
        });
    }
    
    bindEvents() {
        // Toggle del panel
        if (this.elements.toggleBtn) {
            this.elements.toggleBtn.addEventListener('click', () => this.toggleMetrics());
        }
    }
    
    toggleMetrics() {
        const content = this.elements.content;
        const icon = this.elements.toggleBtn.querySelector('i');
        
        if (content.style.display === 'none') {
            content.style.display = 'block';
            icon.className = 'fas fa-chevron-up';
            this.elements.toggleBtn.classList.add('active');
        } else {
            content.style.display = 'none';
            icon.className = 'fas fa-chevron-down';
            this.elements.toggleBtn.classList.remove('active');
        }
    }
    
    // ===== PROCESAMIENTO DE DATOS =====
    
    /**
     * Actualiza las métricas con nuevos datos
     * @param {Array} data - Array de documentos finalizados
     * Formato esperado:
     * [
     *   {
     *     rec: string,           // Identificador del documento
     *     colaborador: string,    // Nombre del usuario/responsable
     *     fecha: string,         // Fecha de finalización (formato dd/mm/yyyy)
     *     duracion: number,      // Duración en segundos
     *     cantidad: number,      // Cantidad de unidades
     *     estado: 'FINALIZADO'   // Estado del documento
     *   }
     * ]
     */
    updateMetrics(data = null) {
        if (data) {
            this.data = this.validateAndParseData(data);
        }
        
        if (this.data.length === 0) {
            this.showEmptyState();
            return;
        }
        
        // Aplicar filtros actuales
        this.applyCurrentFilters();
        
        // Calcular métricas
        this.calculateMetrics();
        
        // Actualizar UI
        this.updateUI();
    }
    
    validateAndParseData(data) {
        if (!Array.isArray(data)) {
            console.warn('Los datos deben ser un array');
            return [];
        }
        
        return data
            .filter(item => {
                // Validar campos requeridos
                if (!item || typeof item !== 'object') return false;
                if (!item.colaborador || !item.fecha || !item.estado) return false;
                if (item.estado !== 'FINALIZADO') return false;
                
                // Validar tipos de datos
                if (typeof item.duracion !== 'number' || item.duracion <= 0) return false;
                if (typeof item.cantidad !== 'number' || item.cantidad <= 0) return false;
                
                // Validar formato de fecha (dd/mm/yyyy)
                const fechaRegex = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
                if (!fechaRegex.test(item.fecha)) return false;
                
                return true;
            })
            .map(item => ({
                ...item,
                // Convertir fecha a objeto Date para filtrado
                fechaObj: this.parseFecha(item.fecha)
            }));
    }
    
    parseFecha(fechaStr) {
        const [dd, mm, yyyy] = fechaStr.split('/');
        return new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
    }
    
    applyCurrentFilters() {
        let filteredData = [...this.data];
        
        // Aplicar filtro de fecha si existe
        if (this.flatpickrInstance && this.flatpickrInstance.selectedDates.length === 2) {
            const [startDate, endDate] = this.flatpickrInstance.selectedDates;
            filteredData = filteredData.filter(item => {
                const itemDate = item.fechaObj;
                return itemDate >= startDate && itemDate <= endDate;
            });
        }
        
        this.filteredData = filteredData;
    }
    
    applyDateFilter(startDate, endDate) {
        this.filteredData = this.data.filter(item => {
            const itemDate = item.fechaObj;
            return itemDate >= startDate && itemDate <= endDate;
        });
        
        this.calculateMetrics();
        this.updateUI();
    }
    
    clearFilters() {
        if (this.flatpickrInstance) {
            this.flatpickrInstance.clear();
        }
        this.filteredData = [...this.data];
        this.calculateMetrics();
        this.updateUI();
    }
    
    // ===== CÁLCULO DE MÉTRICAS =====
    
    calculateMetrics() {
        if (this.filteredData.length === 0) {
            this.metrics = {};
            return;
        }
        
        // Agrupar por usuario
        const usuarios = this.groupByUsuario(this.filteredData);
        
        // Calcular métricas por usuario
        this.metrics.porUsuario = {};
        
        for (const [usuario, documentos] of Object.entries(usuarios)) {
            this.metrics.porUsuario[usuario] = this.calcularMetricasUsuario(usuario, documentos);
        }
        
        // Calcular métricas generales
        this.metrics.generales = this.calcularMetricasGenerales(this.metrics.porUsuario);
        
        // Calcular top semanal
        this.metrics.topSemanal = this.calcularTopSemanal(this.metrics.porUsuario);
    }
    
    groupByUsuario(documentos) {
        return documentos.reduce((grupos, documento) => {
            const usuario = documento.colaborador;
            if (!grupos[usuario]) {
                grupos[usuario] = [];
            }
            grupos[usuario].push(documento);
            return grupos;
        }, {});
    }
    
    calcularMetricasUsuario(usuario, documentos) {
        const totalDocumentos = documentos.length;
        const totalDuracion = documentos.reduce((sum, doc) => sum + doc.duracion, 0);
        const totalCantidad = documentos.reduce((sum, doc) => sum + doc.cantidad, 0);
        
        // Eficiencia = (duración total / cantidad total) normalizada
        const tiempoPorUnidad = totalDuracion / totalCantidad;
        const eficiencia = Math.min(100, (this.config.eficienciaBase / tiempoPorUnidad) * 100);
        
        // Capacidad = (cantidad total / días trabajados) vs capacidad base
        const diasTrabajados = this.calcularDiasTrabajados(documentos);
        const capacidadDiaria = diasTrabajados > 0 ? totalCantidad / diasTrabajados : 0;
        const capacidad = Math.min(100, (capacidadDiaria / this.config.capacidadBase) * 100);
        
        // Efectividad = documentos finalizados vs target
        const efectividad = Math.min(100, (totalDocumentos / this.config.efectividadTarget) * 100);
        
        // Tiempos muertos
        const tiempoMuerto = Math.max(0, totalDuracion - (diasTrabajados * this.config.jornadaDiaria));
        const tiempoMuertoPenalizacion = Math.max(0, 100 - (tiempoMuerto / this.config.tiempoMuertoMaximo) * 100);
        
        // Pausas (estimadas como 10% del tiempo total, ajustable)
        const pausasEstimadas = totalDuracion * 0.1;
        const pausasPenalizacion = Math.max(0, 100 - (pausasEstimadas / this.config.pausasMaximas) * 100);
        
        return {
            usuario,
            totalDocumentos,
            totalDuracion,
            totalCantidad,
            diasTrabajados,
            eficiencia: Math.round(eficiencia * 100) / 100,
            capacidad: Math.round(capacidad * 100) / 100,
            efectividad: Math.round(efectividad * 100) / 100,
            tiempoMuerto: Math.round(tiempoMuerto),
            tiempoMuertoPenalizacion: Math.round(tiempoMuertoPenalizacion * 100) / 100,
            pausasEstimadas: Math.round(pausasEstimadas),
            pausasPenalizacion: Math.round(pausasPenalizacion * 100) / 100,
            tiempoPorUnidad: Math.round(tiempoPorUnidad * 100) / 100
        };
    }
    
    calcularDiasTrabajados(documentos) {
        const fechasUnicas = new Set(documentos.map(doc => doc.fecha));
        return fechasUnicas.size;
    }
    
    calcularMetricasGenerales(metricasPorUsuario) {
        const usuarios = Object.values(metricasPorUsuario);
        if (usuarios.length === 0) return {};
        
        // Eficiencia general (promedio ponderado por cantidad)
        const totalCantidad = usuarios.reduce((sum, m) => sum + m.totalCantidad, 0);
        const eficienciaPonderada = usuarios.reduce((sum, m) => 
            sum + (m.eficiencia * m.totalCantidad), 0) / totalCantidad;
        
        // Capacidad instalada (suma de capacidades individuales)
        const capacidadInstalada = usuarios.reduce((sum, m) => sum + m.capacidad, 0);
        
        // Efectividad general
        const efectividadGeneral = usuarios.reduce((sum, m) => sum + m.efectividad, 0) / usuarios.length;
        
        // Equipo activo
        const equipoActivo = usuarios.length;
        
        return {
            eficienciaGeneral: Math.round(eficienciaPonderada * 100) / 100,
            capacidadInstalada: Math.round(capacidadInstalada * 100) / 100,
            efectividadGeneral: Math.round(efectividadGeneral * 100) / 100,
            equipoActivo,
            totalUsuarios: equipoActivo
        };
    }
    
    calcularTopSemanal(metricasPorUsuario) {
        const usuarios = Object.values(metricasPorUsuario);
        
        return {
            eficiencia: [...usuarios].sort((a, b) => b.eficiencia - a.eficiencia).slice(0, 5),
            capacidad: [...usuarios].sort((a, b) => b.capacidad - a.capacidad).slice(0, 5),
            efectividad: [...usuarios].sort((a, b) => b.efectividad - a.efectividad).slice(0, 5),
            productividad: [...usuarios].sort((a, b) => b.totalCantidad - a.totalCantidad).slice(0, 5)
        };
    }
    
    // ===== ACTUALIZACIÓN DE UI =====
    
    updateUI() {
        this.updateMetricCards();
        this.updateCharts();
        this.updateTopList();
    }
    
    updateMetricCards() {
        if (!this.metrics.generales) return;
        
        const { eficienciaGeneral, capacidadInstalada, efectividadGeneral, equipoActivo } = this.metrics.generales;
        
        // Actualizar tarjetas
        this.setElementText('eficienciaGeneral', `${eficienciaGeneral}%`);
        this.setElementText('capacidadInstalada', `${capacidadInstalada}%`);
        this.setElementText('efectividadGeneral', `${efectividadGeneral}%`);
        this.setElementText('equipoActivo', equipoActivo);
        
        // Aplicar clases de color según los valores
        this.applyMetricColor('eficienciaGeneral', eficienciaGeneral);
        this.applyMetricColor('capacidadInstalada', capacidadInstalada);
        this.applyMetricColor('efectividadGeneral', efectividadGeneral);
    }
    
    setElementText(id, text) {
        const element = document.getElementById(id);
        if (element) element.textContent = text;
    }
    
    applyMetricColor(elementId, value) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        element.className = 'metric-value';
        
        if (value >= 80) {
            element.classList.add('text-success');
        } else if (value >= 60) {
            element.classList.add('text-warning');
        } else {
            element.classList.add('text-danger');
        }
    }
    
    updateCharts() {
        this.renderEfficiencyChart();
        this.renderRadarChart();
    }
    
    renderEfficiencyChart() {
        const ctx = this.elements.efficiencyChart;
        if (!ctx) return;
        
        // Destruir chart anterior si existe
        if (this.chartInstances.efficiency) {
            this.chartInstances.efficiency.destroy();
        }
        
        const usuarios = Object.values(this.metrics.porUsuario);
        if (usuarios.length === 0) return;
        
        // Ordenar por eficiencia
        usuarios.sort((a, b) => b.eficiencia - a.eficiencia);
        
        this.chartInstances.efficiency = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: usuarios.map(m => this.truncateName(m.usuario)),
                datasets: [{
                    label: 'Eficiencia (%)',
                    data: usuarios.map(m => m.eficiencia),
                    backgroundColor: usuarios.map(m => 
                        m.eficiencia >= 80 ? 'rgba(16, 185, 129, 0.7)' :
                        m.eficiencia >= 60 ? 'rgba(245, 158, 11, 0.7)' :
                        'rgba(239, 68, 68, 0.7)'
                    ),
                    borderColor: usuarios.map(m => 
                        m.eficiencia >= 80 ? 'rgb(16, 185, 129)' :
                        m.eficiencia >= 60 ? 'rgb(245, 158, 11)' :
                        'rgb(239, 68, 68)'
                    ),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const usuario = usuarios[context.dataIndex];
                                return [
                                    `Eficiencia: ${usuario.eficiencia}%`,
                                    `Tiempo/ud: ${usuario.tiempoPorUnidad}s`,
                                    `Documentos: ${usuario.totalDocumentos}`,
                                    `Unidades: ${usuario.totalCantidad}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Eficiencia (%)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Colaboradores'
                        }
                    }
                }
            }
        });
    }
    
    renderRadarChart() {
        const ctx = this.elements.radarChart;
        if (!ctx) return;
        
        // Destruir chart anterior si existe
        if (this.chartInstances.radar) {
            this.chartInstances.radar.destroy();
        }
        
        const usuarios = Object.values(this.metrics.porUsuario);
        if (usuarios.length === 0) return;
        
        // Tomar solo los primeros 5 usuarios para mejor legibilidad
        const usuariosLimitados = usuarios.slice(0, 5);
        
        const datasets = usuariosLimitados.map((usuario, index) => {
            const colors = [
                'rgba(59, 130, 246, 0.5)',
                'rgba(16, 185, 129, 0.5)',
                'rgba(245, 158, 11, 0.5)',
                'rgba(139, 92, 246, 0.5)',
                'rgba(14, 165, 233, 0.5)'
            ];
            
            const borderColors = [
                'rgb(59, 130, 246)',
                'rgb(16, 185, 129)',
                'rgb(245, 158, 11)',
                'rgb(139, 92, 246)',
                'rgb(14, 165, 233)'
            ];
            
            return {
                label: this.truncateName(usuario.usuario),
                data: [
                    usuario.eficiencia,
                    usuario.capacidad,
                    usuario.efectividad,
                    usuario.tiempoMuertoPenalizacion,
                    usuario.pausasPenalizacion
                ],
                backgroundColor: colors[index % colors.length],
                borderColor: borderColors[index % borderColors.length],
                borderWidth: 1,
                pointBackgroundColor: borderColors[index % borderColors.length]
            };
        });
        
        this.chartInstances.radar = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: [
                    'Eficiencia',
                    'Capacidad',
                    'Efectividad',
                    'Tiempo Muerto',
                    'Pausas'
                ],
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            stepSize: 20
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                return `${context.dataset.label}: ${context.raw}%`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    updateTopList() {
        const container = this.elements.topList;
        if (!container || !this.metrics.topSemanal) return;
        
        const { eficiencia, capacidad, efectividad, productividad } = this.metrics.topSemanal;
        
        let html = `
            <div class="row">
                <div class="col-md-6">
                    <h6 class="small fw-semibold text-muted mb-3">Top Eficiencia</h6>
                    ${this.renderTopList(eficiencia, 'eficiencia')}
                </div>
                <div class="col-md-6">
                    <h6 class="small fw-semibold text-muted mb-3">Top Capacidad</h6>
                    ${this.renderTopList(capacidad, 'capacidad')}
                </div>
            </div>
            <div class="row mt-4">
                <div class="col-md-6">
                    <h6 class="small fw-semibold text-muted mb-3">Top Efectividad</h6>
                    ${this.renderTopList(efectividad, 'efectividad')}
                </div>
                <div class="col-md-6">
                    <h6 class="small fw-semibold text-muted mb-3">Top Productividad</h6>
                    ${this.renderTopList(productividad, 'productividad')}
                </div>
            </div>
        `;
        
        container.innerHTML = html;
    }
    
    renderTopList(usuarios, tipo) {
        if (usuarios.length === 0) {
            return '<div class="text-center text-muted py-2 small">No hay datos</div>';
        }
        
        return usuarios.map((usuario, index) => `
            <div class="top-item">
                <div class="top-posicion">${index + 1}</div>
                <div class="top-info">
                    <div class="top-nombre" title="${usuario.usuario}">${this.truncateName(usuario.usuario)}</div>
                    <div class="top-metricas">
                        <div class="top-metrica">
                            <i class="fas fa-${this.getMetricIcon(tipo)}"></i>
                            <span class="${this.getMetricColorClass(usuario[tipo])}">
                                ${this.getMetricValue(usuario, tipo)}
                            </span>
                        </div>
                        <div class="top-metrica">
                            <i class="fas fa-file"></i>
                            ${usuario.totalDocumentos} docs
                        </div>
                        <div class="top-metrica">
                            <i class="fas fa-cube"></i>
                            ${usuario.totalCantidad} uds
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    getMetricIcon(tipo) {
        const icons = {
            eficiencia: 'bolt',
            capacidad: 'industry',
            efectividad: 'bullseye',
            productividad: 'chart-line'
        };
        return icons[tipo] || 'chart-bar';
    }
    
    getMetricColorClass(value) {
        if (value >= 80) return 'eficiencia-alta';
        if (value >= 60) return 'eficiencia-media';
        return 'eficiencia-baja';
    }
    
    getMetricValue(usuario, tipo) {
        switch (tipo) {
            case 'eficiencia':
                return `${usuario.eficiencia}%`;
            case 'capacidad':
                return `${usuario.capacidad}%`;
            case 'efectividad':
                return `${usuario.efectividad}%`;
            case 'productividad':
                return usuario.totalCantidad;
            default:
                return 'N/A';
        }
    }
    
    truncateName(name, maxLength = 20) {
        return name.length > maxLength ? name.substring(0, maxLength - 3) + '...' : name;
    }
    
    showEmptyState() {
        if (this.elements.cardsContainer) {
            this.elements.cardsContainer.innerHTML = `
                <div class="col-12 text-center py-5">
                    <i class="fas fa-chart-bar fa-3x text-muted mb-3"></i>
                    <h5 class="text-muted">No hay datos disponibles</h5>
                    <p class="text-muted">Los datos de documentos finalizados aparecerán aquí</p>
                </div>
            `;
        }
        
        if (this.elements.chartsContainer) {
            this.elements.chartsContainer.innerHTML = `
                <div class="col-12 text-center py-5">
                    <i class="fas fa-chart-line fa-3x text-muted mb-3"></i>
                    <p class="text-muted">No hay datos para generar gráficas</p>
                </div>
            `;
        }
        
        if (this.elements.topList) {
            this.elements.topList.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="fas fa-trophy fa-2x mb-2"></i>
                    <p>No hay datos para mostrar el ranking</p>
                </div>
            `;
        }
    }
    
    // ===== FUNCIONES PÚBLICAS =====
    
    /**
     * Inicializa el sistema de métricas
     * @param {Object} options - Opciones de configuración
     */
    initMetrics(options = {}) {
        return this.init(options);
    }
    
    /**
     * Actualiza las métricas con nuevos datos
     * @param {Array} data - Array de documentos finalizados
     */
    updateMetrics(data = null) {
        return this.updateMetrics(data);
    }
    
    /**
     * Destruye la instancia y limpia recursos
     */
    destroy() {
        // Destruir instancias de charts
        Object.values(this.chartInstances).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        
        // Destruir flatpickr
        if (this.flatpickrInstance && typeof this.flatpickrInstance.destroy === 'function') {
            this.flatpickrInstance.destroy();
        }
        
        // Remover elementos DOM
        if (this.elements.container && this.elements.container.parentNode) {
            this.elements.container.parentNode.removeChild(this.elements.container);
        }
        
        this.isInitialized = false;
        console.log('Sistema de métricas destruido');
    }
}

// ===== INICIALIZACIÓN GLOBAL =====

// Crear instancia global
window.metricsSystem = new MetricsSystem();

// Función de inicialización pública
function initMetrics(options = {}) {
    return window.metricsSystem.initMetrics(options);
}

// Función de actualización pública
function updateMetrics(data = null) {
    return window.metricsSystem.updateMetrics(data);
}

// Auto-inicialización cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            if (typeof flatpickr !== 'undefined' && typeof Chart !== 'undefined') {
                window.metricsSystem.initMetrics();
            } else {
                console.warn('Flatpickr o Chart.js no están disponibles. Reintentando en 1 segundo...');
                setTimeout(() => window.metricsSystem.initMetrics(), 1000);
            }
        }, 500);
    });
} else {
    setTimeout(() => window.metricsSystem.initMetrics(), 500);
}

// Exportar para módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MetricsSystem, initMetrics, updateMetrics };
}
