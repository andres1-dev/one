async function generarReporteCompleto(targetDate = new Date()) {
    try {
        // 1. Cargar datos si no están en memoria
        if (consolidatedData.length === 0 || budgetData.length === 0) {
            await cargarDatosIniciales();
        }

        // 2. Validar y formatear fecha
        const fechaObj = parseDate(targetDate);
        if (!fechaObj) {
            throw new Error("Fecha no válida");
        }

        // 3. Buscar fecha actual más cercana con datos
        const currentYear = fechaObj.getFullYear();
        const currentResult = findClosestDateWithData(fechaObj, currentYear, consolidatedData);
        
        if (!currentResult) {
            throw new Error("No hay datos disponibles para el año actual");
        }

        // 4. Obtener fecha equivalente en el año anterior
        let previousResult = null;
        const previousYear = currentYear - 1;
        const previousDate = new Date(fechaObj);
        previousDate.setFullYear(previousYear);
        
        if (consolidatedData.some(d => d.Año === previousYear)) {
            previousResult = findClosestDateWithData(previousDate, previousYear, consolidatedData);
        }

        // 5. Generar reporte (manteniendo estructura original)
        const report = {
            filtros: {
                actual: formatDate(currentResult.date),
                anterior: previousResult ? formatDate(previousResult.date) : null,
                isExact: currentResult.isExact,
                previousIsExact: previousResult ? previousResult.isExact : false
            },
            dia: {
                actual: generateDayMetrics(currentResult.data, currentResult.date, consolidatedData, false),
                anterior: previousResult ? generateDayMetrics(
                    previousResult.data, 
                    previousResult.date, 
                    consolidatedData, 
                    true,
                    currentResult.date
                ) : null
            },
            mes: {
                actual: generatePeriodMetrics('mes', currentResult.date, consolidatedData, false),
                anterior: previousResult ? generatePeriodMetrics(
                    'mes', 
                    previousResult.date, 
                    consolidatedData, 
                    true, 
                    currentResult.date
                ) : null
            },
            año: {
                actual: generatePeriodMetrics('año', currentResult.date, consolidatedData, false),
                anterior: previousResult ? generatePeriodMetrics(
                    'año', 
                    previousResult.date, 
                    consolidatedData, 
                    true, 
                    currentResult.date
                ) : null
            },
            // Mantener datos para tendencias y gestión anual
            tendencias: getTrendsData(currentYear, previousYear, consolidatedData)
        };

        // Calcular gestiones anuales
        if (report.dia.anterior) {
            report.dia.actual.gestion = calculateGrowth(
                report.dia.actual.porcentaje,
                report.dia.anterior.porcentaje
            );
        }
        if (report.mes.anterior) {
            report.mes.actual.gestion = calculateGrowth(
                report.mes.actual.porcentaje,
                report.mes.anterior.porcentaje
            );
        }
        if (report.año.anterior) {
            report.año.actual.gestion = calculateGrowth(
                report.año.actual.porcentaje,
                report.año.anterior.porcentaje
            );
        }

        return report;

    } catch (error) {
        console.error("Error en generarReporteCompleto:", error);
        throw error;
    }
}
