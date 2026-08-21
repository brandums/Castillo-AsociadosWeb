// js/modules/dashboard.js - VERSIÓN OPTIMIZADA CON ENDPOINT ÚNICO
class Dashboard {
    constructor(app) {
        this.app = app;
        this.stats = {
            totalProspectos: 0,
            totalClientes: 0,
            totalReservas: 0,
            totalContratos: 0
        };
        this.chartInstances = {};
        this.dashboardData = null;
        this.previousMonthData = {};
        
        // Estado del Calendario Interactivo
        this.calendarCurrentDate = new Date();
        this.calendarSelectedDate = new Date();
        this.calendarFilter = 'todos';
        this.calendarVisitas = [];
        this.calendarReservas = [];
        this.calendarEventsMap = {};
        this.calendarListenersSetup = false;
    }

    async init() {
        try {
            // Cargar datos del dashboard en una sola llamada
            await this.loadDashboardData();
            
            // Inicializar componentes con los datos cargados
            this.updateStatsDisplay();
            await this.loadCharts();
            this.loadPerformanceData();
            this.loadRecentActivity();
            this.loadBirthdays();
            await this.loadCalendarData();
            this.setupEventListeners();
            
        } catch (error) {
            console.error('❌ Error inicializando dashboard:', error);
            UI.showAlert('Error al cargar el dashboard', 'error');
        }
    }

    async loadDashboardData() {
        try {
            UI.showLoading(document.getElementById('dashboardTab'));
            
            // Una sola llamada para todos los datos del dashboard
            this.dashboardData = await this.app.api.get('/dashboard');
            
            // Calcular tendencias con los datos raw
            if (this.dashboardData.datosRaw) {
                await this.calculateTrends(
                    this.dashboardData.datosRaw.prospectos,
                    this.dashboardData.datosRaw.clientes,
                    this.dashboardData.datosRaw.reservas,
                    this.dashboardData.datosRaw.contratos
                );
            }
            
            UI.hideLoading(document.getElementById('dashboardTab'));
            
        } catch (error) {
            console.error('❌ Error cargando datos del dashboard:', error);
            UI.hideLoading(document.getElementById('dashboardTab'));
            
            // Fallback: cargar datos individualmente si el endpoint falla
            await this.loadDataFallback();
        }
    }

    async loadDataFallback() {
        try {
            console.warn('⚠️ Usando fallback: cargando datos individualmente');
            
            const [
                prospectos,
                clientes,
                reservas,
                contratos,
                usuarios
            ] = await Promise.all([
                this.app.api.loadProspectos(),
                this.app.api.loadClients(),
                this.app.api.loadReservas(),
                this.app.api.loadContratos(),
                this.app.api.loadUsers()
            ]);

            const contratosVigentes = contratos?.filter(c => c.estado !== 'Baja') || [];

            // Calcular datos manualmente
            await this.calculateTrends(prospectos, clientes, reservas, contratosVigentes);

            const reservasActivas = reservas?.filter(r => 
                r.estado === 'Activa' || r.estado === 'activa' || 
                r.estado === 'Pendiente' || r.estado === 'pendiente' ||
                !r.estado
            ).length || 0;

            this.stats = {
                totalProspectos: prospectos?.length || 0,
                totalClientes: clientes?.length || 0,
                totalReservas: reservasActivas,
                totalContratos: contratosVigentes.length
            };

            // Crear estructura de datos simulada para gráficos
            this.dashboardData = {
                estadisticas: this.stats,
                graficos: await this.calculateChartsFallback(prospectos, reservas, contratosVigentes),
                rendimientoAgentes: await this.calculatePerformanceFallback(usuarios, prospectos, contratosVigentes),
                actividadReciente: await this.calculateActivityFallback(reservas, contratosVigentes)
            };

        } catch (fallbackError) {
            console.error('❌ Error en fallback:', fallbackError);
            throw new Error('No se pudieron cargar los datos del dashboard');
        }
    }

    async calculateTrends(prospectos, clientes, reservas, contratos) {
        try {
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            
            // Mes anterior
            const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
            const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

            // Función para contar elementos por mes
            const countByMonth = (items, dateFields, type) => {
                let currentMonthCount = 0;
                let prevMonthCount = 0;

                if (items && Array.isArray(items)) {
                    items.forEach(item => {
                        try {
                            let dateStr = null;
                            
                            // Buscar en diferentes campos de fecha
                            for (const field of dateFields) {
                                if (item[field]) {
                                    dateStr = item[field];
                                    break;
                                }
                            }
                            
                            if (!dateStr) return;
                            
                            const date = Utils.parseLocalDate(dateStr);
                            if (!date) return;

                            const itemMonth = date.getMonth();
                            const itemYear = date.getFullYear();

                            if (itemMonth === currentMonth && itemYear === currentYear) {
                                currentMonthCount++;
                            } else if (itemMonth === prevMonth && itemYear === prevYear) {
                                prevMonthCount++;
                            }
                        } catch (error) {
                            console.warn(`Error procesando fecha de ${type}:`, error);
                        }
                    });
                }

                return { current: currentMonthCount, previous: prevMonthCount };
            };

            // Calcular tendencias con campos correctos
            this.previousMonthData = {
                prospectos: countByMonth(prospectos, ['fecha', 'fechaCreacion', 'createdAt'], 'prospectos'),
                clientes: countByMonth(clientes, ['fechaPago', 'fechaCreacion', 'createdAt'], 'clientes'),
                reservas: countByMonth(reservas, ['fechaReserva', 'createdAt'], 'reservas'),
                contratos: countByMonth(contratos, ['fechaFirma', 'createdAt'], 'contratos')
            };

        } catch (error) {
            console.error('Error calculando tendencias:', error);
            this.previousMonthData = {
                prospectos: { current: 0, previous: 0 },
                clientes: { current: 0, previous: 0 },
                reservas: { current: 0, previous: 0 },
                contratos: { current: 0, previous: 0 }
            };
        }
    }

    calculateTrendPercentage(current, previous) {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
    }

    updateStatsDisplay() {
        if (!this.dashboardData) return;

        this.stats = { ...this.dashboardData.estadisticas };

        // Actualizar números
        document.getElementById('totalProspectos').textContent = 
            this.stats.totalProspectos.toLocaleString();
        document.getElementById('totalClientes').textContent = 
            this.stats.totalClientes.toLocaleString();
        document.getElementById('totalReservas').textContent = 
            this.stats.totalReservas.toLocaleString();
        document.getElementById('totalContratos').textContent = 
            this.stats.totalContratos.toLocaleString();

        // Actualizar tendencias si están disponibles
        this.updateTrendElements();
    }

    updateTrendElements() {
        // Solo mostrar tendencias si tenemos datos del mes anterior
        if (Object.keys(this.previousMonthData).length === 0) {
            this.hideTrends();
            return;
        }

        const trends = {
            prospectos: this.calculateTrendPercentage(
                this.previousMonthData.prospectos.current,
                this.previousMonthData.prospectos.previous
            ),
            clientes: this.calculateTrendPercentage(
                this.previousMonthData.clientes.current,
                this.previousMonthData.clientes.previous
            ),
            reservas: this.calculateTrendPercentage(
                this.previousMonthData.reservas.current,
                this.previousMonthData.reservas.previous
            ),
            contratos: this.calculateTrendPercentage(
                this.previousMonthData.contratos.current,
                this.previousMonthData.contratos.previous
            )
        };

        // Actualizar cada elemento de tendencia
        Object.keys(trends).forEach(statType => {
            const trendElement = document.querySelector(`.stat-card:nth-child(${this.getStatIndex(statType)}) .stat-trend`);
            if (trendElement) {
                const trend = trends[statType];
                const currentData = this.previousMonthData[statType].current;
                const previousData = this.previousMonthData[statType].previous;
                
                if (currentData > 0 || previousData > 0) {
                    const isPositive = trend >= 0;
                    
                    trendElement.className = `stat-trend ${isPositive ? 'trend-up' : 'trend-down'}`;
                    trendElement.innerHTML = `
                        <i class="fas fa-arrow-${isPositive ? 'up' : 'down'}"></i>
                        <span>${Math.abs(trend)}% vs mes anterior</span>
                    `;
                    trendElement.style.display = 'flex';
                } else {
                    trendElement.style.display = 'none';
                }
            }
        });
    }

    hideTrends() {
        // Ocultar elementos de tendencia
        document.querySelectorAll('.stat-trend').forEach(trend => {
            trend.style.display = 'none';
        });
    }

    getStatIndex(statType) {
        const indexMap = {
            'prospectos': 1,
            'clientes': 2,
            'reservas': 3,
            'contratos': 4
        };
        return indexMap[statType] || 1;
    }

    destroyCharts() {
        Object.values(this.chartInstances).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        this.chartInstances = {};
    }

    async loadCharts() {
        this.destroyCharts();
        
        if (!this.dashboardData) {
            console.warn('⚠️ No hay datos para cargar gráficos');
            return;
        }

        try {
            await this.loadProgressChart();
            await this.loadProspectosChart();
            await this.loadReservasChart();
        } catch (error) {
            console.error('Error loading charts:', error);
        }
    }

    async loadProgressChart() {
        const canvas = document.getElementById('progressChart');
        if (!canvas || !this.dashboardData) return;

        try {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const data = this.dashboardData.graficos.progresoMensual;

            this.chartInstances.progress = new Chart(ctx, {
                type: 'line',
                data: data,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { 
                            position: 'top',
                            labels: {
                                usePointStyle: true,
                                padding: 20
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(0, 0, 0, 0.1)'
                            },
                            ticks: {
                                precision: 0
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            }
                        }
                    }
                }
            });
        } catch (error) {
            this.showChartError(canvas, 'gráfico de progreso', error);
        }
    }

    async loadProspectosChart() {
        const canvas = document.getElementById('prospectosChart');
        if (!canvas || !this.dashboardData?.graficos?.estadosProspectos) {
            this.showChartError(canvas, 'gráfico de prospectos', new Error('Datos no disponibles'));
            return;
        }

        try {
            const ctx = canvas.getContext('2d');
            const estados = this.dashboardData.graficos.estadosProspectos;

            // SI el backend envía la estructura completa de Chart.js
            let data;
            if (estados.labels && estados.datasets) {
            // Backend envía estructura Chart.js completa
            data = estados;
            } else {
            // Backend envía objeto simple - construir estructura Chart.js
            data = {
                labels: Object.keys(estados),
                datasets: [{
                data: Object.values(estados),
                backgroundColor: ['#4361ee', '#4cc9f0', '#7209b7', '#f72585'],
                borderWidth: 3,
                borderColor: '#fff',
                hoverOffset: 15
                }]
            };
            }

            this.chartInstances.prospectos = new Chart(ctx, {
            type: 'doughnut',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                legend: { 
                    position: 'bottom',
                    labels: {
                    padding: 15,
                    usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                    label: function(context) {
                        const label = context.label || '';
                        const value = context.raw || 0;
                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                        const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                        return `${label}: ${value} (${percentage}%)`;
                    }
                    }
                }
                },
                cutout: '65%'
            }
            });

        } catch (error) {
            this.showChartError(canvas, 'gráfico de prospectos', error);
        }
        }

        async loadReservasChart() {
        const canvas = document.getElementById('reservasChart');
        if (!canvas || !this.dashboardData?.graficos?.reservasPorEstado) {
            this.showChartError(canvas, 'gráfico de reservas', new Error('Datos no disponibles'));
            return;
        }

        try {
            const ctx = canvas.getContext('2d');
            const estados = this.dashboardData.graficos.reservasPorEstado;

            // SI el backend envía la estructura completa de Chart.js
            let data;
            if (estados.labels && estados.datasets) {
            // Backend envía estructura Chart.js completa
            data = estados;
            } else {
            // Backend envía objeto simple - construir estructura Chart.js
            data = {
                labels: Object.keys(estados),
                datasets: [{
                data: Object.values(estados),
                backgroundColor: ['#4361ee', '#4cc9f0', '#7209b7', '#f72585', '#4895ef', '#3a0ca3'],
                borderWidth: 3,
                borderColor: '#fff',
                hoverOffset: 15
                }]
            };
            }

            this.chartInstances.reservas = new Chart(ctx, {
            type: 'pie',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                legend: { 
                    position: 'bottom',
                    labels: {
                    padding: 15,
                    usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                    label: function(context) {
                        const label = context.label || '';
                        const value = context.raw || 0;
                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                        const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                        return `${label}: ${value} (${percentage}%)`;
                    }
                    }
                }
                }
            }
            });

        } catch (error) {
            this.showChartError(canvas, 'gráfico de reservas', error);
        }
        }

    loadPerformanceData() {
        const container = document.getElementById('agentPerformance');
        if (!container || !this.dashboardData) return;

        const agentesConDatos = this.dashboardData.rendimientoAgentes;

        if (!agentesConDatos || agentesConDatos.length === 0) {
            container.innerHTML = this.getEmptyState('Sin datos de rendimiento', 'chart-line');
            return;
        }

        container.innerHTML = agentesConDatos.map(agente => {
            const conversion = agente.conversion || 0;
            const progressClass = conversion > 25 ? 'success' : conversion > 10 ? 'warning' : 'danger';
            
            return `
                <div class="performance-card ${conversion > 25 ? 'success' : ''}">
                    <div class="performance-header">
                        <div class="performance-agent">
                            <div class="agent-avatar">
                                ${(agente.nombre?.charAt(0) || 'A') + (agente.apellido?.charAt(0) || 'G')}
                            </div>
                            <div class="agent-info">
                                <h4>${agente.nombre || 'Agente'} ${agente.apellido || ''}</h4>
                                <p>${agente.rol || 'Agente'}</p>
                            </div>
                        </div>
                    </div>
                    <div class="performance-stats">
                        <div class="stat-item">
                            <h4>${agente.prospectos || 0}</h4>
                            <p>Prospectos</p>
                        </div>
                        <div class="stat-item">
                            <h4>${agente.clientes || 0}</h4>
                            <p>Clientes</p>
                        </div>
                        <div class="stat-item">
                            <h4>${conversion}%</h4>
                            <p>Conversión</p>
                        </div>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill progress-${progressClass}" 
                             style="width: ${Math.min(conversion, 100)}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    loadRecentActivity() {
        const container = document.getElementById('recentActivity');
        if (!container || !this.dashboardData) return;

        const actividades = this.dashboardData.actividadReciente;

        if (!actividades || actividades.length === 0) {
            container.innerHTML = this.getEmptyState('No hay actividad reciente', 'inbox');
            return;
        }

        container.innerHTML = actividades.map(actividad => `
            <div class="activity-item">
                <div class="activity-icon bg-${actividad.color}">
                    <i class="fas fa-${actividad.icono}"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-title">${actividad.titulo}</div>
                    <div class="activity-description">${actividad.descripcion}</div>
                </div>
                <div class="activity-time">
                    ${Utils.formatDate(actividad.fecha)}
                </div>
            </div>
        `).join('');
    }

    // Métodos de fallback para cuando no existe el endpoint /dashboard
    async calculateChartsFallback(prospectos, reservas, contratos) {
        // Gráfico de progreso mensual
        const meses = this.getLast6Months();
        
        const prospectosPorMes = this.groupByMonth(prospectos, ['fecha'], meses, 'prospectos');
        const clientesPorMes = this.groupByMonth(contratos, ['fechaFirma'], meses, 'clientes');
        const reservasPorMes = this.groupByMonth(reservas, ['fechaReserva'], meses, 'reservas');

        // Gráfico de estados de prospectos
        const estadosProspectos = this.calcularEstadosProspectos(prospectos);

        // Gráfico de reservas por estado
        const reservasPorEstado = this.calcularReservasPorEstado(reservas);

        return {
            progresoMensual: {
                labels: meses,
                datasets: [
                    { label: 'Prospectos', data: prospectosPorMes },
                    { label: 'Clientes', data: clientesPorMes },
                    { label: 'Reservas', data: reservasPorMes }
                ]
            },
            estadosProspectos,
            reservasPorEstado
        };
    }

    async calculatePerformanceFallback(usuarios, prospectos, contratos) {
        const agentes = usuarios.filter(u => u.rol === 'Agente');
        const rendimiento = [];

        agentes.forEach(agente => {
            const prospectosAgente = prospectos.filter(p => p.agenteId === agente.id).length;
            const clientesAgente = contratos.filter(c => c.asesorId === agente.id).length;
            const conversion = prospectosAgente > 0 ? Math.round((clientesAgente / prospectosAgente) * 100) : 0;

            rendimiento.push({
                ...agente,
                prospectos: prospectosAgente,
                clientes: clientesAgente,
                conversion
            });
        });

        return rendimiento
            .sort((a, b) => b.conversion - a.conversion)
            .slice(0, 4);
    }

    async calculateActivityFallback(reservas, contratos) {
        const actividades = [];

        // Agregar reservas recientes
        const reservasRecientes = reservas
            .sort((a, b) => {
                const fechaB = Utils.parseLocalDate(b.fechaReserva || b.createdAt);
                const fechaA = Utils.parseLocalDate(a.fechaReserva || a.createdAt);
                return (fechaB?.getTime() || 0) - (fechaA?.getTime() || 0);
            })
            .slice(0, 2);
        
        reservasRecientes.forEach(reserva => {
            actividades.push({
                tipo: 'reserva',
                titulo: 'Nueva Reserva',
                descripcion: `Reserva para terreno ${reserva.nroTerreno || 'N/A'}`,
                fecha: reserva.fechaReserva || reserva.createdAt,
                icono: 'calendar-check',
                color: 'primary'
            });
        });

        // Agregar contratos recientes
        const contratosRecientes = contratos
            .sort((a, b) => new Date(b.fechaFirma || b.createdAt) - new Date(a.fechaFirma || a.createdAt))
            .slice(0, 2);
        
        contratosRecientes.forEach(contrato => {
            actividades.push({
                tipo: 'contrato',
                titulo: 'Contrato Firmado',
                descripcion: `Contrato para terreno ${contrato.nroTerreno || 'N/A'}`,
                fecha: contrato.fechaFirma || contrato.createdAt,
                icono: 'file-contract',
                color: 'success'
            });
        });

        return actividades
            .sort((a, b) => {
                const fechaB = Utils.parseLocalDate(b.fecha);
                const fechaA = Utils.parseLocalDate(a.fecha);
                return (fechaB?.getTime() || 0) - (fechaA?.getTime() || 0);
            })
            .slice(0, 5);
    }

    // Métodos auxiliares para cálculos
    getLast6Months() {
        const months = [];
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const today = new Date();
        
        for (let i = 5; i >= 0; i--) {
            const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
            months.push(`${monthNames[date.getMonth()]} ${date.getFullYear()}`);
        }
        
        return months;
    }

    groupByMonth(items, dateFields, months, type) {
        if (!items || !Array.isArray(items)) {
            return new Array(months.length).fill(0);
        }
        
        const counts = new Array(months.length).fill(0);
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        
        items.forEach(item => {
            try {
                let dateStr = null;
                
                // Buscar en diferentes campos de fecha
                for (const field of dateFields) {
                    if (item[field]) {
                        dateStr = item[field];
                        break;
                    }
                }
                
                if (!dateStr) return;
                
                const date = Utils.parseLocalDate(dateStr);
                if (!date) return;
                
                const itemMonthYear = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
                
                const index = months.indexOf(itemMonthYear);
                if (index !== -1) {
                    counts[index]++;
                }
            } catch (error) {
                console.warn(`Error procesando fecha de ${type}:`, error);
            }
        });
        
        return counts;
    }

    calcularEstadosProspectos(prospectos) {
        const categories = {
            'Nuevos (0-10 días)': 0,
            'Recientes (11-24 días)': 0,
            'Antiguos (25-30 días)': 0,
            'Expirados (+30 días)': 0
        };

        const now = new Date();
        
        prospectos.forEach(prospecto => {
            try {
                const fechaCreacion = new Date(prospecto.fecha);
                if (isNaN(fechaCreacion.getTime())) return;
                
                const diffTime = Math.abs(now - fechaCreacion);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays <= 10) categories['Nuevos (0-10 días)']++;
                else if (diffDays <= 24) categories['Recientes (11-24 días)']++;
                else if (diffDays <= 30) categories['Antiguos (25-30 días)']++;
                else categories['Expirados (+30 días)']++;
            } catch (error) {
                console.warn('Error calculando antigüedad de prospecto:', error);
            }
        });

        return categories;
    }

    calcularReservasPorEstado(reservas) {
        const estados = {};
        
        reservas.forEach(reserva => {
            const estado = reserva.estado || 'Pendiente';
            let estadoNormalizado = estado;
            
            if (estado.toLowerCase().includes('pendiente')) estadoNormalizado = 'Pendiente';
            if (estado.toLowerCase().includes('activa')) estadoNormalizado = 'Activa';
            if (estado.toLowerCase().includes('firmado') || estado.toLowerCase().includes('firmada')) estadoNormalizado = 'Firmada';
            if (estado.toLowerCase().includes('cancel')) estadoNormalizado = 'Cancelada';
            if (estado.toLowerCase().includes('expirado')) estadoNormalizado = 'Expirada';
            
            estados[estadoNormalizado] = (estados[estadoNormalizado] || 0) + 1;
        });

        return Object.keys(estados).length === 0 ? { 'Sin datos': 1 } : estados;
    }

    // Métodos de utilidad
    showChartError(canvas, chartName, error) {
        const container = canvas.parentElement;
        container.innerHTML = `
            <div class="chart-error">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error al cargar el ${chartName}</p>
                <small>${error.message}</small>
            </div>
        `;
    }

    getEmptyState(message, icon = 'chart-line') {
        return `
            <div class="empty-state">
                <i class="fas fa-${icon}"></i>
                <h3>${message}</h3>
                <p>No hay datos disponibles para mostrar.</p>
            </div>
        `;
    }

    async loadBirthdays() {
        try {
            const data = await this.app.api.get('/dashboard/birthdays');
            this.renderBirthdays('todayBirthdaysList', data.delDia, true);
            this.renderBirthdays('upcomingBirthdaysList', data.proximos, false);
        } catch (error) {
            console.error('Error loading birthdays:', error);
            document.getElementById('todayBirthdaysList').innerHTML = '<div class="error-state">Error al cargar cumpleañeros</div>';
            document.getElementById('upcomingBirthdaysList').innerHTML = '<div class="error-state">Error al cargar cumpleañeros</div>';
        }
    }

    renderBirthdays(containerId, data, isToday) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!data || data.length === 0) {
            container.innerHTML = `<div class="empty-state" style="padding: 20px; text-align: center; color: #6c757d;"><i class="fas fa-glass-cheers" style="font-size: 24px; margin-bottom: 10px; display: block;"></i><p style="margin:0;">No hay cumpleañeros ${isToday ? 'hoy' : 'en los próximos 7 días'}.</p></div>`;
            return;
        }

        let html = '<ul style="list-style: none; padding: 0; margin: 0;">';
        data.forEach(c => {
            let cel = c.celular ? c.celular.trim() : '';
            // Add 591 if number length is 8 digits
            let waNumber = cel;
            if (cel.length === 8) {
                waNumber = '591' + cel;
            } else if (cel.startsWith('+')) {
                waNumber = cel.substring(1);
            }
            const paginaFelicitacion = `${app.api.BASE_URL}/dashboard/felicitacion/${c.id}`;
            const mensaje = `¡Hola ${c.nombre}! 🎉\n\nDe parte de todo el equipo de Castillo & Asociados, queremos desearte un muy feliz cumpleaños. ¡Que pases un excelente día lleno de alegría!\n\n${paginaFelicitacion}`;
            const wsLink = `https://wa.me/${waNumber}?text=${encodeURIComponent(mensaje)}`;
            
            html += `
                <li style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee;">
                    <div>
                        <strong style="display: block;">${c.nombre} ${c.apellido}</strong>
                        <span style="font-size: 0.85em; color: #666;">${c.fechaCumpleanos}</span>
                    </div>
                    <div style="display: flex; gap: 5px;">
                        ${isToday ? `
                            <a href="${wsLink}" target="_blank" class="btn btn-sm" style="background: #25D366; color: white; padding: 5px 10px; border-radius: 4px; text-decoration: none;" title="Enviar WhatsApp">
                                <i class="fab fa-whatsapp"></i>
                            </a>
                            ${!c.felicitado ? `
                                <button class="btn btn-sm btn-outline" onclick="app.modules.dashboard.markBirthdayGreeted(${c.id})" style="padding: 5px 10px; border-radius: 4px; border: 1px solid #ddd; background: transparent; cursor:pointer;" title="Marcar como felicitado">
                                    <i class="fas fa-check" style="color: #6c757d;"></i>
                                </button>
                            ` : `
                                <span style="color: #28a745; padding: 5px 10px;" title="Ya fue felicitado este año">
                                    <i class="fas fa-check-double"></i>
                                </span>
                            `}
                        ` : ''}
                    </div>
                </li>
            `;
        });
        html += '</ul>';
        container.innerHTML = html;
    }

    async markBirthdayGreeted(clientId) {
        try {
            await this.app.api.post(`/dashboard/birthdays/${clientId}/greet`, {});
            UI.showAlert('Felicitación registrada', 'success');
            this.loadBirthdays();
        } catch (error) {
            console.error('Error marking greeting:', error);
            UI.showAlert('Error al marcar la felicitación', 'error');
        }
    }

    setupEventListeners() {
        // El dashboard se actualiza automáticamente al cargar
        // Se pueden agregar listeners para actualizaciones manuales si es necesario
    }

    getTitle() {
        return 'Dashboard';
    }

    cleanup() {
        this.destroyCharts();
    }

    // ==========================================
    // MÓDULO CALENDARIO DE VISITAS (SOLO VISITAS)
    // ==========================================

    formatDateKey(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    async loadCalendarData() {
        try {
            const url = `${API_URL}/visitas`;
            const headers = this.app.auth.getAuthHeaders();
            const resVisitas = await fetch(url, { headers });
            if (resVisitas.ok) {
                this.calendarVisitas = await resVisitas.json();
            } else {
                this.calendarVisitas = [];
            }
        } catch (e) {
            console.warn('Error cargando visitas del calendario:', e);
            this.calendarVisitas = [];
        }

        this.renderCalendar();
        this.renderCalendarAgenda();
        this.setupCalendarEventListeners();
    }

    renderCalendar() {
        const year = this.calendarCurrentDate.getFullYear();
        const month = this.calendarCurrentDate.getMonth();

        // Título del mes en español
        const monthNames = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        const titleEl = document.getElementById('calMonthYearTitle');
        if (titleEl) {
            titleEl.textContent = `${monthNames[month]} ${year}`;
        }

        // Agrupar visitas por fecha YYYY-MM-DD
        this.calendarEventsMap = {};

        (this.calendarVisitas || []).forEach(v => {
            try {
                const dateObj = new Date(v.visitDate);
                if (isNaN(dateObj.getTime())) return;
                const dateKey = this.formatDateKey(dateObj);
                if (!this.calendarEventsMap[dateKey]) this.calendarEventsMap[dateKey] = [];
                this.calendarEventsMap[dateKey].push({
                    type: 'visita',
                    data: v,
                    date: dateObj
                });
            } catch (err) {}
        });

        // Construir cuadrícula de días
        const grid = document.getElementById('calendarDaysGrid');
        if (!grid) return;
        grid.innerHTML = '';

        // Primer día del mes (Lunes = 0)
        const firstDayIndex = new Date(year, month, 1).getDay();
        const startOffset = (firstDayIndex === 0 ? 6 : firstDayIndex - 1);

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        // Días previos
        for (let i = startOffset - 1; i >= 0; i--) {
            const cell = document.createElement('div');
            cell.className = 'cal-day-cell empty-day';
            cell.textContent = daysInPrevMonth - i;
            grid.appendChild(cell);
        }

        const todayKey = this.formatDateKey(new Date());
        const selectedKey = this.formatDateKey(this.calendarSelectedDate);

        // Días del mes
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDayDate = new Date(year, month, day);
            const dateKey = this.formatDateKey(currentDayDate);
            const events = this.calendarEventsMap[dateKey] || [];

            const cell = document.createElement('div');
            cell.className = 'cal-day-cell';
            cell.dataset.date = dateKey;

            if (dateKey === todayKey) cell.classList.add('today-day');
            if (dateKey === selectedKey) cell.classList.add('selected-day');

            const dayNum = document.createElement('span');
            dayNum.textContent = day;
            cell.appendChild(dayNum);

            // Indicadores de visitas (dots)
            if (events.length > 0) {
                const dotsContainer = document.createElement('div');
                dotsContainer.className = 'cal-day-dots';

                let hasProgramada = false;
                let hasCancelada = false;

                events.forEach(e => {
                    if (e.data.status === 2) hasCancelada = true;
                    else hasProgramada = true;
                });

                if (hasProgramada) {
                    const dot = document.createElement('span');
                    dot.className = 'cal-dot dot-visita';
                    dot.title = 'Visita Programada';
                    dotsContainer.appendChild(dot);
                }
                if (hasCancelada) {
                    const dot = document.createElement('span');
                    dot.className = 'cal-dot dot-cancelada';
                    dot.title = 'Visita Cancelada';
                    dotsContainer.appendChild(dot);
                }

                cell.appendChild(dotsContainer);
            }

            grid.appendChild(cell);
        }

        // Celdas para completar la última semana
        const totalCells = startOffset + daysInMonth;
        const remainingCells = (totalCells % 7 === 0) ? 0 : 7 - (totalCells % 7);
        for (let j = 1; j <= remainingCells; j++) {
            const cell = document.createElement('div');
            cell.className = 'cal-day-cell empty-day';
            cell.textContent = j;
            grid.appendChild(cell);
        }
    }

    renderCalendarAgenda() {
        const dateKey = this.formatDateKey(this.calendarSelectedDate);
        const events = this.calendarEventsMap[dateKey] || [];

        // Título de la agenda en español
        const titleEl = document.getElementById('agendaSelectedDateTitle');
        if (titleEl) {
            const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
            const formatted = this.calendarSelectedDate.toLocaleDateString('es-ES', options);
            titleEl.textContent = formatted.charAt(0).toUpperCase() + formatted.slice(1);
        }

        const countEl = document.getElementById('agendaEventsCount');
        if (countEl) {
            countEl.textContent = `${events.length} ${events.length === 1 ? 'visita' : 'visitas'}`;
        }

        const container = document.getElementById('agendaEventsList');
        if (!container) return;

        if (events.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 30px 15px; color: #94a3b8;">
                    <i class="fas fa-car" style="font-size: 2.2rem; margin-bottom: 12px; opacity: 0.4; color: #cbd5e1;"></i>
                    <h5 style="margin: 0 0 6px 0; color: #475569; font-weight: 600;">Sin visitas</h5>
                    <p style="margin: 0 0 15px 0; font-size: 0.82rem;">No hay visitas programadas para este día.</p>
                    <button class="btn btn-sm btn-success" onclick="app.showModule('visitas')" style="padding: 6px 14px; font-size: 0.8rem; border-radius: 6px;">
                        <i class="fas fa-plus"></i> Programar Visita
                    </button>
                </div>
            `;
            return;
        }

        let html = '';
        events.forEach(item => {
            const v = item.data;
            const timeStr = item.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const isCancelled = v.status === 2;
            const isCompleted = v.status === 1;
            const badgeClass = isCancelled ? 'danger' : (isCompleted ? 'primary' : 'success');
            const badgeText = isCancelled ? 'Cancelada' : (isCompleted ? 'Completada' : 'Programada');
            const cardTypeClass = isCancelled ? 'event-cancelada' : 'event-visita';

            const personas = v.attendeesCount || 1;
            const cupos = v.occupiedSeatsOnTrip || (personas + 1);
            const cuposBadge = v.status === 0 
                ? `<span class="badge ${cupos >= 8 ? 'badge-danger' : 'badge-info'}" style="font-size: 0.75rem;"><i class="fas fa-shuttle-van"></i> ${cupos}/8 cupos</span>` 
                : '';

            const mensaje = `Buen día, consulta sobre la visita programada para ${v.projectName} a las ${timeStr} para el prospecto ${v.prospectName} (${personas} personas).`;
            const wsUrl = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;

            html += `
                <div class="agenda-event-card ${cardTypeClass}">
                    <div class="agenda-event-top">
                        <div class="agenda-event-title">
                            <i class="fas fa-car" style="color: ${isCancelled ? '#ef4444' : '#10b981'};"></i>
                            <span>Visita: ${v.projectName || 'Proyecto'}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                            <span class="agenda-event-time">
                                <i class="fas fa-clock" style="font-size: 0.75rem;"></i> ${timeStr}
                            </span>
                            ${cuposBadge}
                        </div>
                    </div>
                    <div class="agenda-event-details">
                        <div><strong>Prospecto:</strong> ${v.prospectName || 'No especificado'} (${personas} ${personas === 1 ? 'persona' : 'personas'})</div>
                        <div><strong>Asesor:</strong> ${v.agentName || 'No especificado'}</div>
                        ${v.status === 0 ? `<div><strong>Ocupación de salida:</strong> <span style="font-weight:600; color:${cupos >= 8 ? '#ef4444' : '#2b72eb'};">${cupos}/8 cupos</span> (${v.availableSeatsOnTrip !== undefined ? v.availableSeatsOnTrip : (8 - cupos)} disponibles)</div>` : ''}
                    </div>
                    <div class="agenda-event-actions">
                        <span class="badge badge-${badgeClass}">${badgeText}</span>
                        <div style="display: flex; gap: 6px;">
                            <a href="${wsUrl}" target="_blank" class="btn btn-sm" style="background: #25D366; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; text-decoration: none;" title="WhatsApp">
                                <i class="fab fa-whatsapp"></i>
                            </a>
                            <button class="btn btn-sm btn-outline" onclick="app.showModule('visitas')" style="padding: 4px 8px; font-size: 0.75rem;">
                                Ver en Visitas
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    setupCalendarEventListeners() {
        if (this.calendarListenersSetup) return;
        this.calendarListenersSetup = true;

        const prevBtn = document.getElementById('calPrevMonth');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                this.calendarCurrentDate.setMonth(this.calendarCurrentDate.getMonth() - 1);
                this.renderCalendar();
            });
        }

        const nextBtn = document.getElementById('calNextMonth');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.calendarCurrentDate.setMonth(this.calendarCurrentDate.getMonth() + 1);
                this.renderCalendar();
            });
        }

        const todayBtn = document.getElementById('calTodayBtn');
        if (todayBtn) {
            todayBtn.addEventListener('click', () => {
                this.calendarCurrentDate = new Date();
                this.calendarSelectedDate = new Date();
                this.renderCalendar();
                this.renderCalendarAgenda();
            });
        }

        const grid = document.getElementById('calendarDaysGrid');
        if (grid) {
            grid.addEventListener('click', (e) => {
                const cell = e.target.closest('.cal-day-cell:not(.empty-day)');
                if (cell && cell.dataset.date) {
                    const [y, m, d] = cell.dataset.date.split('-').map(Number);
                    this.calendarSelectedDate = new Date(y, m - 1, d);

                    document.querySelectorAll('.cal-day-cell.selected-day').forEach(c => c.classList.remove('selected-day'));
                    cell.classList.add('selected-day');

                    this.renderCalendarAgenda();
                }
            });
        }
    }
}
