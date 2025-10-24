class Ranking {
    constructor(app) {
        this.app = app;
        this.datos = {
            porAsesor: [],
            porEquipo: []
        };
        this.filtros = {
            fechaInicio: '',
            fechaFin: '',
            proyecto: 'todos',
            tipoRanking: 'asesor'
        };
        this.charts = {};
        this.eventListenersSetup = false;
    }

    async init() {
        this.setupEventListeners();
        await this.loadData();
    }

    async loadData() {
        try {
            UI.showLoading(document.getElementById('rankingTab'));
            
            // Construir query string con filtros
            const queryParams = new URLSearchParams();
            
            if (this.filtros.fechaInicio) queryParams.append('fechaInicio', this.filtros.fechaInicio);
            if (this.filtros.fechaFin) queryParams.append('fechaFin', this.filtros.fechaFin);
            if (this.filtros.proyecto && this.filtros.proyecto !== 'todos') {
                queryParams.append('proyecto', this.filtros.proyecto);
            }
            queryParams.append('tipoRanking', this.filtros.tipoRanking);
            
            const url = `/contratos/ranking2${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
            const response = await this.app.api.get(url);
            
            if (!response) {
                throw new Error('El endpoint no retornó datos');
            }

            this.datos = response;

            this.renderDashboard();
            UI.hideLoading(document.getElementById('rankingTab'));
            
        } catch (error) {
            console.error('❌ Error cargando ranking:', error);
            UI.hideLoading(document.getElementById('rankingTab'));
            UI.showAlert(`Error al cargar el ranking: ${error.message}`, 'error');
        }
    }

    setupEventListeners() {
        if (this.eventListenersSetup) return;
        
        this.eventListenersSetup = true;

        // Botón de filtros
        const btnFiltros = document.getElementById('btnFiltrosRanking');
        if (btnFiltros && !btnFiltros.hasListener) {
            btnFiltros.hasListener = true;
            btnFiltros.addEventListener('click', () => {
                this.mostrarModalFiltros();
            });
        }

        // Aplicar filtros desde el modal
        const btnAplicarFiltros = document.getElementById('btnAplicarFiltrosRanking');
        if (btnAplicarFiltros && !btnAplicarFiltros.hasListener) {
            btnAplicarFiltros.hasListener = true;
            btnAplicarFiltros.addEventListener('click', () => {
                this.aplicarFiltrosDesdeModal();
            });
        }

        // Limpiar filtros desde el modal
        const btnLimpiarFiltros = document.getElementById('btnLimpiarFiltrosRanking');
        if (btnLimpiarFiltros && !btnLimpiarFiltros.hasListener) {
            btnLimpiarFiltros.hasListener = true;
            btnLimpiarFiltros.addEventListener('click', () => {
                this.limpiarFiltrosDesdeModal();
            });
        }

        // Exportar datos
        const exportBtn = document.getElementById('exportRanking');
        if (exportBtn && !exportBtn.hasListener) {
            exportBtn.hasListener = true;
            exportBtn.addEventListener('click', () => {
                this.exportData();
            });
        }

        this.actualizarIndicadorFiltros();
    }

    mostrarModalFiltros() {
        try {
            this.cargarOpcionesEnModal();
            this.establecerValoresActualesEnModal();
            UI.showModal('modalFiltrosRanking');
        } catch (error) {
            console.error('❌ Error mostrando modal de filtros:', error);
            UI.showAlert('Error al abrir los filtros', 'error');
        }
    }

    cargarOpcionesEnModal() {
        try {
            const proyectos = this.app.getProyectos();
            console.log('📋 Cargando proyectos para filtros:', proyectos);

            // Proyectos
            const selectProyecto = document.getElementById('filtroProyectoRanking');
            if (selectProyecto) {
                selectProyecto.innerHTML = '<option value="todos">Todos los proyectos</option>';
                proyectos.forEach(proyecto => {
                    const option = document.createElement('option');
                    option.value = proyecto.id;
                    option.textContent = proyecto.nombre;
                    selectProyecto.appendChild(option);
                });
            }
        } catch (error) {
            console.error('❌ Error cargando opciones del modal:', error);
        }
    }

    establecerValoresActualesEnModal() {
        try {
            document.getElementById('fechaInicioRanking').value = this.filtros.fechaInicio;
            document.getElementById('fechaFinRanking').value = this.filtros.fechaFin;
            document.getElementById('filtroProyectoRanking').value = this.filtros.proyecto;
            document.getElementById('rankingTipo').value = this.filtros.tipoRanking;
        } catch (error) {
            console.error('❌ Error estableciendo valores en modal:', error);
        }
    }

    aplicarFiltrosDesdeModal() {
        try {
            this.filtros.fechaInicio = document.getElementById('fechaInicioRanking').value;
            this.filtros.fechaFin = document.getElementById('fechaFinRanking').value;
            this.filtros.proyecto = document.getElementById('filtroProyectoRanking').value;
            this.filtros.tipoRanking = document.getElementById('rankingTipo').value;
            
            UI.closeModal('modalFiltrosRanking');
            this.aplicarFiltros();
        } catch (error) {
            console.error('❌ Error aplicando filtros:', error);
            UI.showAlert('Error al aplicar los filtros', 'error');
        }
    }

    aplicarFiltros() {
        try {
            // Recargar datos con los filtros aplicados
            this.loadData();
            this.actualizarIndicadorFiltros();
            this.mostrarFiltrosActivos();
            UI.showAlert('Filtros aplicados correctamente', 'success');
        } catch (error) {
            console.error('❌ Error en aplicarFiltros:', error);
        }
    }

    limpiarFiltrosDesdeModal() {
        try {
            document.getElementById('fechaInicioRanking').value = '';
            document.getElementById('fechaFinRanking').value = '';
            document.getElementById('filtroProyectoRanking').value = 'todos';
            document.getElementById('rankingTipo').value = 'asesor';
            
            UI.closeModal('modalFiltrosRanking');
            this.clearFilters();
        } catch (error) {
            console.error('❌ Error limpiando filtros:', error);
        }
    }

    mostrarFiltrosActivos() {
        try {
            const container = document.getElementById('filtrosAplicadosContainerRanking');
            const content = document.getElementById('filtrosAplicadosRanking');
            
            if (!container || !content) {
                console.warn('⚠️ No se encontraron contenedores de filtros activos');
                return;
            }
            
            const filtrosActivos = [];
            const proyectos = this.app.getProyectos();

            if (this.filtros.fechaInicio || this.filtros.fechaFin) {
                const textoFecha = this.filtros.fechaInicio && this.filtros.fechaFin 
                    ? `${this.filtros.fechaInicio} a ${this.filtros.fechaFin}`
                    : this.filtros.fechaInicio 
                        ? `Desde ${this.filtros.fechaInicio}`
                        : `Hasta ${this.filtros.fechaFin}`;
                filtrosActivos.push({ tipo: 'fecha', texto: textoFecha });
            }
            
            if (this.filtros.proyecto !== 'todos') {
                const proyecto = proyectos.find(p => p.id === this.filtros.proyecto);
                const textoProyecto = proyecto ? proyecto.nombre : 'Proyecto';
                filtrosActivos.push({ tipo: 'proyecto', texto: textoProyecto });
            }

            if (this.filtros.tipoRanking) {
                const textoTipo = this.filtros.tipoRanking === 'asesor' ? 'Por Asesor' : 'Por Equipo';
                filtrosActivos.push({ tipo: 'tipoRanking', texto: textoTipo });
            }
            
            if (filtrosActivos.length > 0) {
                container.style.display = 'block';
                content.innerHTML = filtrosActivos.map(filtro => `
                    <span class="filtro-activo">
                        ${filtro.texto}
                        <button class="remove-filtro" data-tipo="${filtro.tipo}">
                            <i class="fas fa-times"></i>
                        </button>
                    </span>
                `).join('');

                content.querySelectorAll('.remove-filtro').forEach(button => {
                    button.addEventListener('click', (e) => {
                        const tipo = e.currentTarget.getAttribute('data-tipo');
                        this.removerFiltro(tipo);
                    });
                });
            } else {
                container.style.display = 'none';
            }
        } catch (error) {
            console.error('❌ Error mostrando filtros activos:', error);
        }
    }

    removerFiltro(tipo) {
        try {
            switch (tipo) {
                case 'fecha':
                    this.filtros.fechaInicio = '';
                    this.filtros.fechaFin = '';
                    break;
                case 'proyecto':
                    this.filtros.proyecto = 'todos';
                    break;
                case 'tipoRanking':
                    this.filtros.tipoRanking = 'asesor';
                    break;
            }
            
            this.sincronizarInputsModal();
            this.aplicarFiltros();
        } catch (error) {
            console.error('❌ Error removiendo filtro:', error);
        }
    }

    sincronizarInputsModal() {
        try {
            document.getElementById('fechaInicioRanking').value = this.filtros.fechaInicio;
            document.getElementById('fechaFinRanking').value = this.filtros.fechaFin;
            document.getElementById('filtroProyectoRanking').value = this.filtros.proyecto;
            document.getElementById('rankingTipo').value = this.filtros.tipoRanking;
        } catch (error) {
            console.error('❌ Error sincronizando inputs:', error);
        }
    }

    actualizarIndicadorFiltros() {
        try {
            const btnFiltros = document.getElementById('btnFiltrosRanking');
            if (!btnFiltros) return;
            
            const tieneFiltros = this.filtros.fechaInicio || this.filtros.fechaFin || 
                                this.filtros.proyecto !== 'todos' || this.filtros.tipoRanking !== 'asesor';
            
            if (tieneFiltros) {
                btnFiltros.classList.add('btn-filtros-activos');
            } else {
                btnFiltros.classList.remove('btn-filtros-activos');
            }
        } catch (error) {
            console.error('❌ Error actualizando indicador de filtros:', error);
        }
    }

    getDatosActuales() {
        return this.filtros.tipoRanking === 'asesor' 
            ? this.datos.porAsesor 
            : this.datos.porEquipo;
    }

    renderDashboard() {
        try {
            // Solo renderizar los gráficos que quedan
            this.renderPerformanceChart();
            this.renderDistributionChart();
            this.mostrarFiltrosActivos();
        } catch (error) {
            console.error('❌ Error renderizando dashboard:', error);
        }
    }

    renderPerformanceChart() {
        try {
            const container = document.getElementById('rankingPerformanceChart');
            if (!container) {
                console.warn('⚠️ No se encontró el canvas del performance chart');
                return;
            }

            const datosActuales = this.getDatosActuales().slice(0, 8);
            
            // Destruir chart anterior si existe
            if (this.charts.performance) {
                this.charts.performance.destroy();
            }

            if (datosActuales.length === 0) {
                container.style.display = 'none';
                return;
            }

            container.style.display = 'block';
            const ctx = container.getContext('2d');

            // Crear gradientes para las barras
            const gradientPuntos = ctx.createLinearGradient(0, 0, 0, 400);
            gradientPuntos.addColorStop(0, 'rgba(59, 130, 246, 0.8)');
            gradientPuntos.addColorStop(1, 'rgba(59, 130, 246, 0.1)');

            const gradientMontos = ctx.createLinearGradient(0, 0, 0, 400);
            gradientMontos.addColorStop(0, 'rgba(16, 185, 129, 0.8)');
            gradientMontos.addColorStop(1, 'rgba(16, 185, 129, 0.1)');

            // Función para formatear moneda
            const formatCurrency = (value) => {
                return new Intl.NumberFormat('es-BO', {
                    style: 'currency',
                    currency: 'BOB',
                    minimumFractionDigits: 0
                }).format(value);
            };

            this.charts.performance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: datosActuales.map(item => item.nombre || 'Sin nombre'),
                    datasets: [
                        {
                            label: 'Puntos de Rendimiento',
                            data: datosActuales.map(item => item.cantidad || 0),
                            backgroundColor: gradientPuntos,
                            borderColor: '#3b82f6',
                            borderWidth: 2,
                            borderRadius: 6,
                            borderSkipped: false,
                            yAxisID: 'y',
                            order: 2
                        },
                        {
                            label: 'Monto Total (Bs)',
                            data: datosActuales.map(item => item.montoTotal || 0),
                            backgroundColor: gradientMontos,
                            borderColor: '#10b981',
                            borderWidth: 2,
                            borderRadius: 6,
                            borderSkipped: false,
                            yAxisID: 'y1',
                            order: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false,
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                usePointStyle: true,
                                padding: 20,
                                color: '#6b7280'
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            borderColor: '#3b82f6',
                            borderWidth: 1,
                            callbacks: {
                                label: (context) => {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    if (context.dataset.label.includes('Monto')) {
                                        label += formatCurrency(context.parsed.y);
                                    } else {
                                        label += context.parsed.y;
                                    }
                                    return label;
                                }
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('❌ Error renderizando performance chart:', error);
        }
    }

    renderDistributionChart() {
        try {
            const container = document.getElementById('rankingDistributionChart');
            if (!container) {
                console.warn('⚠️ No se encontró el canvas del distribution chart');
                return;
            }

            const datosActuales = this.getDatosActuales();
            
            // Destruir chart anterior si existe
            if (this.charts.distribution) {
                this.charts.distribution.destroy();
            }

            if (datosActuales.length === 0) {
                container.style.display = 'none';
                return;
            }

            container.style.display = 'block';
            const ctx = container.getContext('2d');

            const top5 = datosActuales.slice(0, 5);
            const others = datosActuales.slice(5);
            
            // Calcular totales de montos en lugar de puntos
            const top5MontoTotal = top5.reduce((sum, item) => sum + (item.montoTotal || 0), 0);
            const othersMontoTotal = others.reduce((sum, item) => sum + (item.montoTotal || 0), 0);

            const data = [
                ...top5.map(item => item.montoTotal || 0),
                othersMontoTotal
            ];

            const labels = [
                ...top5.map(item => `${item.nombre || 'Sin nombre'}`),
                'Otros'
            ];

            const backgroundColors = [
                '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280'
            ];

            // Función para formatear moneda
            const formatCurrency = (value) => {
                return new Intl.NumberFormat('es-BO', {
                    style: 'currency',
                    currency: 'BOB',
                    minimumFractionDigits: 0
                }).format(value);
            };

            this.charts.distribution = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: backgroundColors,
                        borderColor: '#fff',
                        borderWidth: 2,
                        hoverBackgroundColor: backgroundColors.map(color => this.darkenColor(color, 0.2)),
                        hoverOffset: 8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '70%',
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                padding: 20,
                                usePointStyle: true,
                                pointStyle: 'circle',
                                color: '#6b7280',
                                font: {
                                    size: 11
                                },
                                generateLabels: (chart) => {
                                    const data = chart.data;
                                    if (data.labels.length && data.datasets.length) {
                                        return data.labels.map((label, i) => {
                                            const value = data.datasets[0].data[i];
                                            const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                            
                                            return {
                                                text: `${label}: ${formatCurrency(value)} (${percentage}%)`,
                                                fillStyle: data.datasets[0].backgroundColor[i],
                                                strokeStyle: data.datasets[0].borderColor,
                                                lineWidth: data.datasets[0].borderWidth,
                                                hidden: isNaN(data.datasets[0].data[i]) || chart.getDatasetMeta(0).data[i].hidden,
                                                index: i
                                            };
                                        });
                                    }
                                    return [];
                                }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    const label = context.label || '';
                                    const value = context.parsed;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                    return `${label}: ${formatCurrency(value)} (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('❌ Error renderizando distribution chart:', error);
        }
    }

    // Método auxiliar para oscurecer colores (para hover effects)
    darkenColor(color, amount) {
        try {
            let usePound = false;
            if (color[0] === "#") {
                color = color.slice(1);
                usePound = true;
            }
            const num = parseInt(color, 16);
            let r = (num >> 16) + (amount * 255);
            r = Math.max(Math.min(255, r), 0).toString(16);
            let g = ((num >> 8) & 0x00FF) + (amount * 255);
            g = Math.max(Math.min(255, g), 0).toString(16);
            let b = (num & 0x0000FF) + (amount * 255);
            b = Math.max(Math.min(255, b), 0).toString(16);
            return (usePound ? "#" : "") + 
                (r.length === 1 ? "0" + r : r) + 
                (g.length === 1 ? "0" + g : g) + 
                (b.length === 1 ? "0" + b : b);
        } catch (error) {
            console.warn('Error oscureciendo color:', color, error);
            return color;
        }
    }

    exportData() {
        const datosActuales = this.getDatosActuales();

        if (datosActuales.length === 0) {
            UI.showAlert('No hay datos para exportar', 'warning');
            return;
        }

        const data = datosActuales.map(item => {
            return [
                item.posicion.toString(),
                item.nombre || 'N/A',
                item.cantidad.toString(),
                this.formatCurrencyForPDF(item.montoTotal || 0),
                item.cantidadReal.toString(),
                this.formatCurrencyForPDF(parseFloat(item.promedio) || 0)
            ];
        });

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF("landscape");

        doc.setFontSize(16);
        doc.text("Reporte de Ranking", 14, 20);

        const hoy = new Date();
        const fechaGeneracion = hoy.toLocaleDateString('es-BO');
        doc.setFontSize(10);
        doc.text(`Generado: ${fechaGeneracion}`, 14, 28);

        const filtrosTexto = [];
        if (this.filtros.fechaInicio || this.filtros.fechaFin) {
            filtrosTexto.push(`Fechas: ${this.filtros.fechaInicio || '-'} a ${this.filtros.fechaFin || '-'}`);
        }
        if (this.filtros.proyecto !== 'todos') {
            const proyectos = this.app.getProyectos();
            const proyecto = proyectos.find(p => p.id === this.filtros.proyecto);
            filtrosTexto.push(`Proyecto: ${proyecto ? proyecto.nombre : 'N/A'}`);
        }
        if (this.filtros.tipoRanking) {
            const textoTipo = this.filtros.tipoRanking === 'asesor' ? 'Por Asesor' : 'Por Equipo';
            filtrosTexto.push(`Tipo: ${textoTipo}`);
        }

        if (filtrosTexto.length > 0) {
            const pageWidth = doc.internal.pageSize.getWidth();
            const margin = 14;
            const usableWidth = pageWidth - margin * 2;

            filtrosTexto.forEach((texto, index) => {
                let x, align;

                if (filtrosTexto.length === 1) {
                    x = margin;
                    align = 'left';
                } else if (filtrosTexto.length === 2) {
                    x = index === 0 ? margin : pageWidth / 2;
                    align = index === 0 ? 'left' : 'center';
                } else if (filtrosTexto.length === 3) {
                    if (index === 0) { x = margin; align = 'left'; }
                    else if (index === 1) { x = pageWidth / 2; align = 'center'; }
                    else { x = pageWidth - margin; align = 'right'; }
                } else {
                    x = margin + (usableWidth / (filtrosTexto.length - 1)) * index;
                    align = 'center';
                }

                const textoDividido = doc.splitTextToSize(texto, usableWidth / filtrosTexto.length);
                doc.text(textoDividido, x, 33, { align: align });
            });
        }

        doc.autoTable({
            head: [["Posición", "Nombre", "Puntos", "Monto Total", "Contratos", "Promedio"]],
            body: data,
            startY: filtrosTexto.length > 0 ? 38 : 35,
            styles: { fontSize: 8 }
        });

        const nombreArchivo = `reporte_ranking_${hoy.getFullYear()}-${hoy.getMonth()+1}-${hoy.getDate()}.pdf`;
        doc.save(nombreArchivo);

        UI.showAlert('PDF generado correctamente', 'success');
    }

    formatCurrencyForPDF(value) {
        return new Intl.NumberFormat('es-BO', {
            style: 'currency',
            currency: 'BOB',
            minimumFractionDigits: 0
        }).format(value);
    }

    clearFilters() {
        try {
            this.filtros = {
                fechaInicio: '',
                fechaFin: '',
                proyecto: 'todos',
                tipoRanking: 'asesor'
            };

            // Recargar datos sin filtros
            this.loadData();
            this.actualizarIndicadorFiltros();
            this.mostrarFiltrosActivos();
            UI.showAlert('Filtros limpiados correctamente', 'success');
        } catch (error) {
            console.error('❌ Error limpiando filtros:', error);
        }
    }

    getTitle() {
        return 'Ranking de Ventas';
    }

    cleanup() {
        try {
            Object.values(this.charts).forEach(chart => {
                if (chart) chart.destroy();
            });
            this.charts = {};
            this.eventListenersSetup = false;
        } catch (error) {
            console.error('❌ Error en cleanup:', error);
        }
    }

    onTabShow() {
        console.log('👁️ Mostrando tab de ranking...');
        this.loadData();
    }
}