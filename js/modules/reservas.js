class Reservas {
    constructor(app) {
        this.app = app;
        this.datos = [];
        this.allProspectos = []
        this.reservasOriginales = [];
        this.filtros = {
            search: '',
            fechaInicio: '',
            fechaFin: '',
            proyecto: 'todos',
            agente: 'todos',
            estado: 'todos',
            metodoPago: 'todos'
        };
        this.paginacion = {
            paginaActual: 1,
            porPagina: 10,
            totalPaginas: 1
        };
        this.ordenDescendente = false;
        this.eventListenersSetup = false;
        this.paginationInitialized = false;
    }

    // Métodos de utilidad para roles
    getCurrentUser = () => this.app.auth.getUser();
    
    isAdmin = () => {
        const user = this.getCurrentUser();
        return user && user.rol === 'Admin';
    }
    
    isAgente = () => {
        const user = this.getCurrentUser();
        return user && user.rol === 'Agente';
    }

    async init() {
        this.allProspectos = await this.app.api.loadAllProspectos();

        this.reservasOriginales = this.app.getReservas();
        this.datos = [...this.reservasOriginales]; // NO agrupar, mostrar cada reserva individual
        this.setupEventListeners();
        await this.renderTable();
    }

    async loadData() {
        try {
            UI.showLoading(document.getElementById('reservasTab'));
            await this.app.refreshGlobalData("reservas");
            this.reservasOriginales = this.app.getReservas();
            this.datos = [...this.reservasOriginales];
            UI.hideLoading(document.getElementById('reservasTab'));
        } catch (error) {
            console.error('Error loading reservas:', error);
            UI.showAlert('Error al cargar las reservas', 'error');
            UI.hideLoading(document.getElementById('reservasTab'));
        }
    }

    async refreshData() {
    try {
        await this.app.refreshGlobalData("reservas");
        this.reservasOriginales = this.app.getReservas();
        this.datos = [...this.reservasOriginales];
        
        await this.renderTable();
        
        return true;
    } catch (error) {
        console.error('Error refreshing data:', error);
        return false;
    }
}

    setupEventListeners() {
        if (this.eventListenersSetup) return;
        this.eventListenersSetup = true;

        // Búsqueda
        const searchInput = document.getElementById('reservasSearch');
        if (searchInput && !searchInput.hasListener) {
            searchInput.hasListener = true;
            searchInput.addEventListener('input', Utils.debounce((e) => {
                this.filtros.search = e.target.value;
                this.paginacion.paginaActual = 1;
                this.renderTable();
            }, 300));
        }

        // Botón Voltear lista
        const btnVoltear = document.getElementById('btnVoltearReservas');
        if (btnVoltear && !btnVoltear.hasListener) {
            btnVoltear.hasListener = true;
            btnVoltear.addEventListener('click', () => {
                this.ordenDescendente = !this.ordenDescendente;
                this.paginacion.paginaActual = 1;
                this.renderTable();

                const icon = btnVoltear.querySelector('i');
                if (icon) {
                    icon.className = this.ordenDescendente 
                        ? 'fas fa-sort-amount-up-alt' 
                        : 'fas fa-sort-amount-down-alt';
                }
            });
        }

        // Botón de filtros
        const btnFiltros = document.getElementById('btnFiltrosReservas');
        if (btnFiltros && !btnFiltros.hasListener) {
            btnFiltros.hasListener = true;
            btnFiltros.addEventListener('click', () => {
                this.mostrarModalFiltros();
            });
        }

        // Aplicar filtros desde el modal
        const btnAplicarFiltros = document.getElementById('btnAplicarFiltrosReservas');
        if (btnAplicarFiltros && !btnAplicarFiltros.hasListener) {
            btnAplicarFiltros.hasListener = true;
            btnAplicarFiltros.addEventListener('click', () => {
                this.aplicarFiltrosDesdeModal();
            });
        }

        // Limpiar filtros desde el modal
        const btnLimpiarFiltros = document.getElementById('btnLimpiarFiltrosReservas');
        if (btnLimpiarFiltros && !btnLimpiarFiltros.hasListener) {
            btnLimpiarFiltros.hasListener = true;
            btnLimpiarFiltros.addEventListener('click', () => {
                this.limpiarFiltrosDesdeModal();
            });
        }

        // Exportar
        const exportBtn = document.getElementById('exportReservas');
        if (exportBtn && !exportBtn.hasListener) {
            exportBtn.hasListener = true;
            exportBtn.addEventListener('click', () => {
                this.exportData();
            });
        }

        // EVENT LISTENER GLOBAL PARA PAGINACIÓN
        document.addEventListener('click', (e) => {
            if (e.target.closest('#prevPageReservas')) {
                e.preventDefault();
                if (this.paginacion.paginaActual > 1) {
                    this.paginacion.paginaActual--;
                    this.renderTable();
                }
            }
            else if (e.target.closest('#nextPageReservas')) {
                e.preventDefault();
                const datosFiltrados = this.aplicarFiltros();
                const totalPages = Math.ceil(datosFiltrados.length / this.paginacion.porPagina);
                
                if (this.paginacion.paginaActual < totalPages) {
                    this.paginacion.paginaActual++;
                    this.renderTable();
                }
            }
            else if (e.target.closest('.pagination-number')) {
                const pageBtn = e.target.closest('.pagination-number');
                const page = parseInt(pageBtn.dataset.page);
                if (page && page !== this.paginacion.paginaActual) {
                    this.paginacion.paginaActual = page;
                    this.renderTable();
                }
            }
        });

        // Inicializar paginación
        if (!this.paginationInitialized) {
            this.pagination = initPagination('reservasPagination', {
                totalItems: this.datos.length,
                currentPage: 1,
                pageSize: 10,
                onPageChange: (page, pageSize) => {
                    this.paginacion.paginaActual = page;
                    this.paginacion.porPagina = pageSize;
                    this.renderTable();
                },
                onPageSizeChange: (pageSize) => {
                    this.paginacion.porPagina = pageSize;
                    this.paginacion.paginaActual = 1;
                    this.renderTable();
                }
            });
            this.paginationInitialized = true;
        }
        
        this.actualizarIndicadorFiltros();
    }

    mostrarModalFiltros() {
        this.cargarOpcionesEnModal();
        this.establecerValoresActualesEnModal();
        this.mostrarFiltrosActivos();
        UI.showModal('modalFiltrosReservas');
    }

    cargarOpcionesEnModal() {
        const proyectos = this.app.getProyectos();
        const agentes = this.app.getAgentes();

        // Proyectos
        const selectProyecto = document.getElementById('filtroProyectoReservas');
        if (selectProyecto) {
            selectProyecto.innerHTML = '<option value="todos">Todos los proyectos</option>';
            proyectos.forEach(proyecto => {
                const option = document.createElement('option');
                option.value = proyecto.id;
                option.textContent = proyecto.nombre;
                selectProyecto.appendChild(option);
            });
        }

        // Agentes
        const selectAgente = document.getElementById('filtroAgenteReservas');
        if (selectAgente) {
            selectAgente.innerHTML = '<option value="todos">Todos los agentes</option>';
            agentes.forEach(agente => {
                const option = document.createElement('option');
                option.value = agente.id;
                option.textContent = `${agente.nombre} ${agente.apellido}`;
                selectAgente.appendChild(option);
            });
        }
    }

    establecerValoresActualesEnModal() {
        document.getElementById('fechaInicioReservas').value = this.filtros.fechaInicio;
        document.getElementById('fechaFinReservas').value = this.filtros.fechaFin;
        document.getElementById('filtroProyectoReservas').value = this.filtros.proyecto;
        document.getElementById('filtroAgenteReservas').value = this.filtros.agente;
        document.getElementById('filtroEstadoReservas').value = this.filtros.estado;
        document.getElementById('filtroMetodoPagoReservas').value = this.filtros.metodoPago;
    }

    aplicarFiltrosDesdeModal() {
        this.filtros.fechaInicio = document.getElementById('fechaInicioReservas').value;
        this.filtros.fechaFin = document.getElementById('fechaFinReservas').value;
        this.filtros.proyecto = document.getElementById('filtroProyectoReservas').value;
        this.filtros.agente = document.getElementById('filtroAgenteReservas').value;
        this.filtros.estado = document.getElementById('filtroEstadoReservas').value;
        this.filtros.metodoPago = document.getElementById('filtroMetodoPagoReservas').value;
        
        this.paginacion.paginaActual = 1;
        
        UI.closeModal('modalFiltrosReservas');
        this.renderTable();
        this.actualizarIndicadorFiltros();
        UI.showAlert('Filtros aplicados correctamente', 'success');
    }

    limpiarFiltrosDesdeModal() {
        document.getElementById('fechaInicioReservas').value = '';
        document.getElementById('fechaFinReservas').value = '';
        document.getElementById('filtroProyectoReservas').value = 'todos';
        document.getElementById('filtroAgenteReservas').value = 'todos';
        document.getElementById('filtroEstadoReservas').value = 'todos';
        document.getElementById('filtroMetodoPagoReservas').value = 'todos';
        
        UI.closeModal('modalFiltrosReservas');
        this.clearFilters();
    }

    mostrarFiltrosActivos() {
        const container = document.getElementById('filtrosAplicadosContainerReservas');
        const content = document.getElementById('filtrosAplicadosReservas');
        
        if (!container || !content) return;
        
        const filtrosActivos = [];
        const proyectos = this.app.getProyectos();
        const agentes = this.app.getAgentes();

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

        if (this.filtros.agente !== 'todos') {
            const agente = agentes.find(a => a.id === this.filtros.agente);
            const textoAgente = agente ? `${agente.nombre} ${agente.apellido}` : 'Agente';
            filtrosActivos.push({ tipo: 'agente', texto: textoAgente });
        }
        
        if (this.filtros.estado !== 'todos') {
            const textoEstado = this.filtros.estado.charAt(0).toUpperCase() + this.filtros.estado.slice(1);
            filtrosActivos.push({ tipo: 'estado', texto: textoEstado });
        }

        if (this.filtros.metodoPago !== 'todos') {
            filtrosActivos.push({ tipo: 'metodoPago', texto: `Método: ${this.filtros.metodoPago}` });
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
    }

    removerFiltro(tipo) {
        switch (tipo) {
            case 'fecha':
                this.filtros.fechaInicio = '';
                this.filtros.fechaFin = '';
                break;
            case 'proyecto':
                this.filtros.proyecto = 'todos';
                break;
            case 'agente':
                this.filtros.agente = 'todos';
                break;
            case 'estado':
                this.filtros.estado = 'todos';
                break;
            case 'metodoPago':
                this.filtros.metodoPago = 'todos';
                break;
        }
        
        this.sincronizarInputsModal();
        this.paginacion.paginaActual = 1;
        this.renderTable();
        this.actualizarIndicadorFiltros();
        this.mostrarFiltrosActivos();
    }

    sincronizarInputsModal() {
        document.getElementById('fechaInicioReservas').value = this.filtros.fechaInicio;
        document.getElementById('fechaFinReservas').value = this.filtros.fechaFin;
        document.getElementById('filtroProyectoReservas').value = this.filtros.proyecto;
        document.getElementById('filtroAgenteReservas').value = this.filtros.agente;
        document.getElementById('filtroEstadoReservas').value = this.filtros.estado;
        document.getElementById('filtroMetodoPagoReservas').value = this.filtros.metodoPago;
    }

    actualizarIndicadorFiltros() {
        const btnFiltros = document.getElementById('btnFiltrosReservas');
        if (!btnFiltros) return;
        
        const tieneFiltros = this.filtros.fechaInicio || this.filtros.fechaFin || 
                            this.filtros.proyecto !== 'todos' || this.filtros.agente !== 'todos' || 
                            this.filtros.estado !== 'todos' ||
                            this.filtros.metodoPago !== 'todos';
        
        if (tieneFiltros) {
            btnFiltros.classList.add('btn-filtros-activos');
        } else {
            btnFiltros.classList.remove('btn-filtros-activos');
        }
    }

    aplicarFiltros() {
        let datosFiltrados = [...this.datos];

        if (this.filtros.search) {
            datosFiltrados = datosFiltrados.filter(reserva => {
                const proyectos = this.app.getProyectos();
                const agentes = this.app.getAgentes();
                const clientes = this.allProspectos;
                
                // Buscar información relacionada
                const proyecto = proyectos.find(p => p.id.toString() === reserva.proyectoId.toString());
                const agente = agentes.find(a => a.id.toString() === reserva.asesorId.toString());
                const cliente = clientes.find(c => c.id && c.id.toString() === reserva.clienteId.toString());
                
                // Crear un objeto temporal con los campos a buscar
                const datosBusqueda = {
                    nombreCliente: cliente ? `${cliente.nombre} ${cliente.apellido}` : '',
                    nombreAgente: agente ? `${agente.nombre} ${agente.apellido}` : '',
                    manzano: reserva.manzano || '',
                    nroTerreno: reserva.nroTerreno || ''
                };
                
                // Buscar en los campos específicos
                return Utils.buscarEnTexto([datosBusqueda], this.filtros.search, [
                    'nombreCliente', 'nombreAgente', 'manzano', 'nroTerreno'
                ]).length > 0;
            });
        }

        // Filtro por proyecto
        if (this.filtros.proyecto !== 'todos') {
            datosFiltrados = datosFiltrados.filter(reserva => 
                reserva.proyectoId.toString() === this.filtros.proyecto.toString()
            );
        }

        // Filtro por agente
        if (this.filtros.agente !== 'todos') {
            datosFiltrados = datosFiltrados.filter(reserva => 
                reserva.asesorId.toString() === this.filtros.agente.toString()
            );
        }

        // Filtro por estado
        if (this.filtros.estado !== 'todos') {
            datosFiltrados = datosFiltrados.filter(reserva => {
                const estadoMapeado = this.mapearEstado(reserva.estado);
                return estadoMapeado === this.filtros.estado;
            });
        }

        // Filtro por método de pago
        if (this.filtros.metodoPago !== 'todos') {
            datosFiltrados = datosFiltrados.filter(reserva => 
                reserva.metodoPago && reserva.metodoPago === this.filtros.metodoPago
            );
        }

        // Filtro por fechas
        if (this.filtros.fechaInicio || this.filtros.fechaFin) {        
            datosFiltrados = Utils.filtrarPorFechas(
                datosFiltrados, 
                this.filtros.fechaInicio, 
                this.filtros.fechaFin, 
                'fechaReserva'
            );
        }

        return datosFiltrados;
    }

    mapearEstado(estadoApi) {
        const mapeo = {
            'Activa': 'activa',
            'Pendiente': 'pendiente',
            'En espera': 'En espera',
            
            'Firmado': 'firmado',
            
            // Estados declinados
            'Declinado sin Devolución': 'declinada_sd',
            'Declinado S/D': 'declinada_sd',
            'Declinado Sin Devolución': 'declinada_sd',
            'Declinado con Devolución': 'declinada_cd',
            'Declinado C/D': 'declinada_cd',
            'Declinado Con Devolución': 'declinada_cd',
            
            'Expirado': 'Expirado',
        };
        return mapeo[estadoApi] || 'activa';
    }

    renderTable() {
        const tbody = document.getElementById('reservasTableBody');
        const table = document.getElementById('reservasTable');
        
        if (!tbody || !table) return;

        let datosFiltrados = this.aplicarFiltros();

        if (this.ordenDescendente) {
            datosFiltrados = [...datosFiltrados].reverse();
        }

        const paginado = Utils.paginar(
            datosFiltrados, 
            this.paginacion.paginaActual, 
            this.paginacion.porPagina
        );

        this.actualizarEstadoBotonesPaginacion(datosFiltrados.length);

        if (this.pagination) {
            this.pagination.update(datosFiltrados.length, this.paginacion.paginaActual);
        }

        if (paginado.datos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="table-empty">
                        <i class="fas fa-calendar-check"></i>
                        <h3>No se encontraron reservas</h3>
                        <p>No hay reservas que coincidan con los filtros aplicados.</p>
                    </td>
                </tr>
            `;
            return;
        }

        const esAdmin = this.isAdmin();
        const esAgente = this.isAgente();
        const user = this.getCurrentUser();

        tbody.innerHTML = paginado.datos.map((reserva) => {
            const proyectos = this.app.getProyectos();
            const agentes = this.app.getAgentes();
            const clientes = this.allProspectos;
            
            // Buscar información relacionada
            const proyecto = proyectos.find(p => p.id.toString() === reserva.proyectoId.toString());
            const agente = agentes.find(a => a.id.toString() === reserva.asesorId.toString());
            const cliente = clientes.find(c => c.id && c.id.toString() === reserva.clienteId.toString());
            
            const nombreProyecto = proyecto.nombre;
            const nombreAgente = `${agente.nombre} ${agente.apellido}`;
            const nombreCliente = `${cliente.nombre} ${cliente.apellido}`;
            const montoFormateado = reserva.montoReserva + " Bs.";
            
            // Estados que NO permiten edición
            const estadosNoEditables = [
                'Firmado', 
                'Expirado', 
                'Declinado sin Devolución', 
                'Declinado con Devolución',
                'Declinado S/D',
                'Declinado C/D'
            ];
            
            const puedeEditar = !estadosNoEditables.includes(reserva.estado);
            
            // Verificar si el agente es dueño de la reserva
            const esPropiaReserva = esAgente && reserva.asesorId === user.id;

            return `
                <tr>
                    <td>
                        <div class="mobile-cell-content">
                            <div class="main-info">${nombreCliente}</div>
                            <div class="mobile-secondary-info">
                                <span class="mobile-extra"><i class="fas fa-user-tie"></i> ${nombreAgente}</span>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div class="mobile-cell-content">
                            <div class="main-info">${nombreProyecto}</div>
                            <div class="mobile-secondary-info">
                                <span class="mobile-extra"><div class="lote-detail"><strong>Mz:</strong> ${reserva.manzano}</div></span>
                                <span class="mobile-extra"><div class="lote-detail"><strong>Lt:</strong> ${reserva.nroTerreno}</div></span>
                            </div>
                        </div>
                    </td>
                    <td class="col-hide-mobile">
                        <span class="mobile-extra"><div class="lote-detail"><strong>Mz:</strong> ${reserva.manzano}</div></span>
                        <span class="mobile-extra"><div class="lote-detail"><strong>Lt:</strong> ${reserva.nroTerreno}</div></span>
                    </td>
                    <td class="col-hide-mobile">${reserva.tiempoEspera} días</td>
                    <td class="col-hide-mobile">${nombreAgente}</td>
                    <td class="col-hide-mobile">${reserva.metodoPago}</td>
                    <td class="col-hide-mobile">${montoFormateado}</td>
                    <td>
                        <span class="badge badge-${this.getEstadoBadgeClass(reserva.estado)}">
                            ${this.getEstadoTexto(reserva.estado)}
                        </span>
                    </td>
                    <td class="actions-column">
                        <div class="actions-dropdown">
                            <button class="actions-toggle">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                            <div class="actions-menu">
                                <!-- Ver más - Disponible para todos -->
                                <button class="action-item" data-action="ver-mas" data-id="${reserva.id}">
                                    <i class="fas fa-eye"></i>
                                    Ver más
                                </button>
                                
                                <!-- Editar - Solo para agentes en sus propias reservas en estados editables -->
                                ${esAgente && esPropiaReserva && puedeEditar ? `
                                <button class="action-item" data-action="editar" data-id="${reserva.id}">
                                    <i class="fas fa-edit"></i>
                                    Editar
                                </button>
                                ` : ''}
                                
                                <!-- Ampliar - Solo para admin en reservas no firmadas -->
                                ${esAdmin && puedeEditar ? `
                                <button class="action-item" data-action="ampliar" data-id="${reserva.id}">
                                    <i class="fas fa-expand-alt"></i>
                                    Ampliar
                                </button>
                                ` : ''}
                                
                                <!-- Firmar - Solo para admin en reservas no firmadas -->
                                ${esAdmin && puedeEditar ? `
                                <button class="action-item" data-action="firmar" data-id="${reserva.id}">
                                    <i class="fas fa-signature"></i>
                                    Firmar
                                </button>
                                ` : ''}
                                
                                <!-- Declinar - Solo para admin en reservas no firmadas -->
                                ${esAdmin && puedeEditar ? `
                                <button class="action-item" data-action="declinar" data-id="${reserva.id}">
                                    <i class="fas fa-times"></i>
                                    Declinar
                                </button>
                                ` : ''}
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        this.setupActionListeners();
    }

    getEstadoBadgeClass(estado) {
        const clases = {
            'En espera': 'warning',
            'Pendiente': 'warning',
            'Firmado': 'success',
            'Declinado sin Devolución': 'danger',
            'Declinado con Devolución': 'danger',
            'Declinado S/D': 'danger',
            'Declinado C/D': 'danger',
            'Expirado': 'secondary',
            'Activa': 'primary',
            'Ampliado': 'info'
        };
        return clases[estado] || 'secondary';
    }

    getEstadoTexto(estado) {
        const textos = {
            'En espera': 'En Espera',
            'Pendiente': 'Pendiente',
            'Firmado': 'Firmado',
            'Declinado sin Devolución': 'Declinado S/D',
            'Declinado con Devolución': 'Declinado C/D',
            'Declinado S/D': 'Declinado S/D',
            'Declinado C/D': 'Declinado C/D',
            'Expirado': 'Expirado',
            'Activa': 'Activa',
            'Ampliado': 'Ampliado'
        };
        return textos[estado] || estado;
    }

    actualizarEstadoBotonesPaginacion(totalItems) {
        const prevBtn = document.getElementById('prevPageReservas');
        const nextBtn = document.getElementById('nextPageReservas');
        const totalPages = Math.ceil(totalItems / this.paginacion.porPagina);

        if (prevBtn) {
            prevBtn.disabled = this.paginacion.paginaActual === 1;
        }
        if (nextBtn) {
            nextBtn.disabled = this.paginacion.paginaActual === totalPages;
        }
    }

    setupActionListeners() {
        const tbody = document.getElementById('reservasTableBody');
        if (!tbody) return;

        tbody.addEventListener('click', (e) => {
            const actionItem = e.target.closest('.action-item');
            if (!actionItem) return;

            const action = actionItem.getAttribute('data-action');
            const reservaId = actionItem.getAttribute('data-id');

            switch (action) {
                case 'ver-mas':
                    this.verDetallesReserva(reservaId);
                    break;
                case 'editar':
                    this.editarReserva(reservaId);
                    break;
                case 'ampliar':
                    this.ampliarReserva(reservaId);
                    break;
                case 'firmar':
                    this.firmarReserva(reservaId);
                    break;
                case 'declinar':
                    this.declinarReserva(reservaId);
                    break;
            }

            const dropdown = actionItem.closest('.actions-dropdown');
            if (dropdown) {
                dropdown.classList.remove('show');
            }
        });
    }

    clearFilters() {
        this.filtros = {
            search: '',
            fechaInicio: '',
            fechaFin: '',
            proyecto: 'todos',
            agente: 'todos',
            estado: 'todos',
            metodoPago: 'todos'
        };
        this.paginacion.paginaActual = 1;

        document.getElementById('reservasSearch').value = '';

        this.renderTable();
        this.actualizarIndicadorFiltros();
        UI.showAlert('Filtros limpiados correctamente', 'success');
    }

    async verDetallesReserva(reservaId) {
        try {
            const reserva = this.datos.find(r => r.id === reservaId);
            if (!reserva) {
                UI.showAlert('Reserva no encontrada', 'error');
                return;
            }
            
            // Obtener información relacionada
            const proyectos = this.app.getProyectos();
            const agentes = this.app.getAgentes();
            const clientes = this.allProspectos;
            
            const proyecto = proyectos.find(p => p.id.toString() === reserva.proyectoId.toString());
            const agente = agentes.find(a => a.id.toString() === reserva.asesorId.toString());
            const cliente = clientes.find(c => c.id && c.id.toString() === reserva.clienteId.toString());
            
            // Formatear datos
            const nombreProyecto = proyecto ? proyecto.nombre : 'No encontrado';
            const nombreAgente = agente ? `${agente.nombre} ${agente.apellido}` : 'No encontrado';
            const nombreCliente = cliente ? `${cliente.nombre} ${cliente.apellido}` : 'No encontrado';
            const montoFormateado = reserva.montoReserva ? `${reserva.montoReserva} Bs.` : 'No especificado';
            const tiempoEspera = reserva.tiempoEspera ? `${reserva.tiempoEspera} días` : 'No especificado';
            const metodoPago = reserva.metodoPago || 'No especificado';
            const fechaReserva = reserva.fechaReserva ? new Date(reserva.fechaReserva).toLocaleDateString() : 'No especificada';
            
            // Determinar clase del badge según el estado
            const estadoClase = this.getEstadoBadgeClass(reserva.estado);
            const estadoTexto = this.getEstadoTexto(reserva.estado);

            // Crear el contenido del modal
            const detallesHTML = `
                <div class="details-grid">
                    <!-- Sección Información del Cliente -->
                    <div class="detail-section">
                        <h4 class="section-title">
                            <i class="fas fa-user"></i>
                            Información del Cliente
                        </h4>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <strong class="detail-label">Cliente:</strong>
                                <span class="detail-value">${nombreCliente}</span>
                            </div>
                            <div class="detail-item">
                                <strong class="detail-label">Celular:</strong>
                                <span class="detail-value">${cliente ? cliente.celular : 'No disponible'}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Sección Información del Proyecto y Lote -->
                    <div class="detail-section">
                        <h4 class="section-title">
                            <i class="fas fa-map-marker-alt"></i>
                            Información del Proyecto y Lote
                        </h4>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <strong class="detail-label">Proyecto:</strong>
                                <span class="detail-value">${nombreProyecto}</span>
                            </div>
                            <div class="detail-item">
                                <strong class="detail-label">Manzano:</strong>
                                <span class="detail-value">${reserva.manzano || 'No especificado'}</span>
                            </div>
                            <div class="detail-item">
                                <strong class="detail-label">Lote:</strong>
                                <span class="detail-value">${reserva.nroTerreno || 'No especificado'}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Sección Información de la Reserva -->
                    <div class="detail-section">
                        <h4 class="section-title">
                            <i class="fas fa-calendar-check"></i>
                            Información de la Reserva
                        </h4>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <strong class="detail-label">Fecha de Reserva:</strong>
                                <span class="detail-value">${fechaReserva}</span>
                            </div>
                            <div class="detail-item">
                                <strong class="detail-label">Hora de Reserva:</strong>
                                <span class="detail-value">${reserva.horaReserva}</span>
                            </div>
                            <div class="detail-item">
                                <strong class="detail-label">Tiempo de Espera:</strong>
                                <span class="detail-value">${tiempoEspera}</span>
                            </div>
                            <div class="detail-item">
                                <strong class="detail-label">Monto de Reserva:</strong>
                                <span class="detail-value">${montoFormateado}</span>
                            </div>
                            <div class="detail-item">
                                <strong class="detail-label">Método de Pago:</strong>
                                <span class="detail-value">${metodoPago}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Sección Información Comercial -->
                    <div class="detail-section">
                        <h4 class="section-title">
                            <i class="fas fa-chart-line"></i>
                            Información Comercial
                        </h4>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <strong class="detail-label">Asesor:</strong>
                                <span class="detail-value">${nombreAgente}</span>
                            </div>
                            <div class="detail-item">
                                <strong class="detail-label">Estado:</strong>
                                <span class="detail-value">
                                    <span class="badge badge-${estadoClase}">${estadoTexto}</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Sección Información Adicional -->
                    <div class="detail-section">
                        <h4 class="section-title">
                            <i class="fas fa-info-circle"></i>
                            Información Adicional
                        </h4>
                        <div class="detail-grid">
                            <div class="detail-item full-width">
                                <strong class="detail-label">ID de Reserva:</strong>
                                <span class="detail-value">${reserva.id}</span>
                            </div>
                            ${reserva.observaciones ? `
                            <div class="detail-item full-width">
                                <strong class="detail-label">Observaciones:</strong>
                                <p class="detail-value description-text">${reserva.observaciones}</p>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;

            // Actualizar el modal
            document.getElementById('modalDetallesReservaTitulo').textContent = 'Detalles de la Reserva';
            document.getElementById('detallesReservaBody').innerHTML = detallesHTML;
            
            // Mostrar el modal
            UI.showModal('modalDetallesReserva');

        } catch (error) {
            console.error('Error al mostrar detalles de reserva:', error);
            UI.showAlert('Error al cargar los detalles de la reserva', 'error');
        }
    }

    editarReserva(reservaId) {
        try {
            // Cerrar cualquier SweetAlert abierto
            Swal.close();
            
            const reserva = this.datos.find(r => r.id === reservaId);
            if (!reserva) {
                UI.showAlert('Reserva no encontrada', 'error');
                return;
            }

            // Verificar si la reserva ya está firmada
            if (reserva.estado === 'Firmado') {
                UI.showAlert('No se puede editar una reserva ya firmada', 'warning');
                return;
            }

            // Obtener información del cliente para mostrar en el modal
            const clientes = this.allProspectos;
            const cliente = clientes.find(c => c.id && c.id.toString() === reserva.clienteId.toString());
            const nombreCliente = cliente ? `${cliente.nombre} ${cliente.apellido}` : 'Cliente';

            // Mostrar modal de edición
            Swal.fire({
                title: 'Editar Lote de Reserva',
                html: `
                    <div style="text-align: left;">
                        <p>Editando lote para la reserva de <strong>${nombreCliente}</strong></p>
                        
                        <div style="margin-bottom: 15px;">
                            <label style="display: block; margin-bottom: 5px; font-weight: 600;">
                                Manzano:
                            </label>
                            <input 
                                type="text" 
                                id="editarManzano" 
                                style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;"
                                placeholder="Ingrese el manzano"
                                value="${reserva.manzano || ''}"
                                maxlength="10"
                            >
                        </div>
                        
                        <div style="margin-bottom: 15px;">
                            <label style="display: block; margin-bottom: 5px; font-weight: 600;">
                                Lote/Terreno:
                            </label>
                            <input 
                                type="text" 
                                id="editarTerreno" 
                                style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;"
                                placeholder="Ingrese el número de lote/terreno"
                                value="${reserva.nroTerreno || ''}"
                                maxlength="10"
                            >
                        </div>
                        
                        <p style="color: #856404; background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 4px; margin-top: 15px;">
                            <i class="fas fa-exclamation-triangle"></i> 
                            Se verificará que el nuevo lote no esté ocupado por otra reserva activa.
                        </p>
                    </div>
                `,
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#17a2b8',
                cancelButtonColor: '#6c757d',
                confirmButtonText: '<i class="fas fa-save"></i> Guardar cambios',
                cancelButtonText: 'Cancelar',
                showLoaderOnConfirm: true,
                allowOutsideClick: () => !Swal.isLoading(),
                backdrop: true,
                focusConfirm: false,
                width: '500px',
                preConfirm: () => {
                    const manzano = document.getElementById('editarManzano').value.trim();
                    const terreno = document.getElementById('editarTerreno').value.trim();

                    // Validaciones
                    if (!manzano) {
                        Swal.showValidationMessage('Por favor ingrese el manzano');
                        return false;
                    }

                    if (!terreno) {
                        Swal.showValidationMessage('Por favor ingrese el número de lote/terreno');
                        return false;
                    }

                    // Verificar si los valores son diferentes a los actuales
                    if (manzano === reserva.manzano && terreno === reserva.nroTerreno) {
                        Swal.showValidationMessage('No se realizaron cambios en el lote');
                        return false;
                    }

                    return { manzano, terreno };
                },
                didOpen: () => {
                    // Asegurar que los inputs tengan el ancho correcto
                    setTimeout(() => {
                        const inputs = document.querySelectorAll('#editarManzano, #editarTerreno');
                        inputs.forEach(input => {
                            input.style.width = '100%';
                        });
                        
                        const manzanoInput = document.getElementById('editarManzano');
                        if (manzanoInput) manzanoInput.focus();
                    }, 100);
                }
            }).then(async (result) => {
                if (result.isConfirmed) {
                    const { manzano, terreno } = result.value;
                    
                    try {
                        await this.procesarEdicion(reservaId, manzano, terreno);
                    } catch (error) {
                        console.error('Error en la edición:', error);
                    }
                } else if (result.dismiss === Swal.DismissReason.cancel || 
                        result.dismiss === Swal.DismissReason.esc) {
                    console.log('Edición cancelada por el usuario');
                }
            });
            
        } catch (error) {
            console.error('Error al abrir modal de editar reserva:', error);
            UI.showAlert('Error al cargar la información de la reserva', 'error');
        }
    }

    async procesarEdicion(reservaId, nuevoManzano, nuevoTerreno) {
        try {            
            // Llamar a la API para editar el lote
            const resultado = await this.app.api.editarLoteReserva(reservaId, nuevoManzano, nuevoTerreno);
            
            // ACTUALIZAR DATOS LOCALES Y TABLA
            await this.refreshData();
            
            // Mostrar mensaje de éxito con detalles
            const mensaje = `
                Lote actualizado exitosamente<br>
                <strong>Nuevo manzano:</strong> ${nuevoManzano}<br>
                <strong>Nuevo lote/terreno:</strong> ${nuevoTerreno}
            `;
            
            UI.showAlert(mensaje, 'success');
            
            return true;
        } catch (error) {
            console.error('Error al editar reserva:', error);
            
            let mensajeError = 'Error al editar el lote de la reserva';
            if (error.message.includes('Ya existe una reserva activa')) {
                mensajeError = 'Ya existe una reserva activa para este Proyecto, Manzano y Lote';
            } else if (error.message.includes('Reserva no encontrada')) {
                mensajeError = 'La reserva no fue encontrada';
            } else if (error.message.includes('Debe proporcionar el manzano')) {
                mensajeError = 'Debe proporcionar el manzano y el número de terreno';
            } else if (error.message.includes('No se puede realizar acciones')) {
                mensajeError = 'No se puede editar una reserva ya firmada o declinada';
            }
            
            Swal.fire({
                icon: 'error',
                title: 'Error al editar',
                text: mensajeError,
                confirmButtonColor: '#dc3545'
            });
            
            return false;
        }
    }

    ampliarReserva(reservaId) {
        try {
            // Cerrar cualquier SweetAlert abierto
            Swal.close();
            
            const reserva = this.datos.find(r => r.id === reservaId);
            if (!reserva) {
                UI.showAlert('Reserva no encontrada', 'error');
                return;
            }

            // Verificar si la reserva ya está firmada
            if (reserva.estado === 'Firmado') {
                UI.showAlert('No se puede ampliar una reserva ya firmada', 'warning');
                return;
            }

            // Verificar permisos para agentes
            const user = this.app.auth.getUser();
            if (user.rol === 'Agente' && reserva.asesorId !== user.id) {
                UI.showAlert('Solo puedes ampliar tus propias reservas', 'warning');
                return;
            }
            
            // Guardar el ID de la reserva
            document.getElementById('ampliarReservaId').value = reservaId;
            
            // Resetear selecciones anteriores
            document.querySelectorAll('.ampliar-option').forEach(opcion => {
                opcion.classList.remove('selected');
            });
            
            // Configurar event listeners
            this.configurarOpcionesAmpliar();
            
            // Mostrar el modal
            UI.showModal('modalAmpliarReserva');
            
        } catch (error) {
            console.error('Error al abrir modal de ampliar reserva:', error);
            UI.showAlert('Error al cargar la información de la reserva', 'error');
        }
    }

    configurarOpcionesAmpliar() {
        const opciones = document.querySelectorAll('.ampliar-option');
        
        opciones.forEach(opcion => {
            opcion.addEventListener('click', () => {
                const dias = opcion.getAttribute('data-dias');
                const reservaId = document.getElementById('ampliarReservaId').value;
                
                UI.closeModal('modalAmpliarReserva');

                if (dias === 'personalizado') {
                    this.mostrarModalFirmaPersonalizada(reservaId);
                } else {
                    this.mostrarConfirmacionAmpliar(reservaId, parseInt(dias));
                }
            });
        });
    }

    mostrarConfirmacionAmpliar(reservaId, dias) {
        const reserva = this.datos.find(r => r.id === reservaId);
        if (!reserva) return;
        
        Swal.fire({
            title: 'Ampliar Reserva',
            html: `¿Estás seguro que deseas ampliar esta reserva por <strong>${dias} días</strong>?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: `Sí, ampliar ${dias} días`,
            cancelButtonText: 'Cancelar',
            showLoaderOnConfirm: true,
            allowOutsideClick: () => !Swal.isLoading(),
            preConfirm: async () => {
                try {
                    await this.procesarAmpliacion(reservaId, dias);
                    return true;
                } catch (error) {
                    Swal.showValidationMessage('Error al ampliar la reserva');
                    return false;
                }
            }
        }).then((result) => {
            if (result.isConfirmed) {
                // El mensaje de éxito ya se mostró en procesarAmpliacion
                this.loadData(); // Recargar datos para reflejar cambios
            } else if (result.dismiss === Swal.DismissReason.cancel) {
                // Si cancela, volver a abrir el modal de ampliar
                setTimeout(() => {
                    this.ampliarReserva(reservaId);
                }, 300);
            }
        });
    }

    mostrarModalFirmaPersonalizada(reservaId) {
        const reserva = this.datos.find(r => r.id === reservaId);
        if (!reserva) return;
        
        Swal.fire({
            title: 'Programar Firma',
            html: `
                <div class="swal-content">
                    <p>¿En cuántos días se realizará la firma?</p>
                    <input 
                        type="number" 
                        id="diasFirma" 
                        class="swal2-input custom-swal-input" 
                        placeholder="Ingrese el número de días"
                        min="1"
                        max="365"
                        value="7"
                    >
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Programar Firma',
            cancelButtonText: 'Cancelar',
            focusConfirm: false,
            allowOutsideClick: true, // ← CAMBIAR A TRUE para permitir cerrar clickeando fuera
            backdrop: true, // ← AGREGAR esto
            preConfirm: async () => {
                const diasInput = document.getElementById('diasFirma');
                const dias = parseInt(diasInput.value);
                
                if (!dias || dias < 1) {
                    Swal.showValidationMessage('Por favor ingrese un número válido de días');
                    return false;
                }
                
                if (dias > 365) {
                    Swal.showValidationMessage('El número máximo de días es 365');
                    return false;
                }
                
                try {
                    await this.procesarProgramacionFirma(reservaId, dias);
                    return true;
                } catch (error) {
                    Swal.showValidationMessage('Error al programar la firma');
                    return false;
                }
            }
        }).then((result) => {
            if (result.isConfirmed) {
                // El mensaje de éxito ya se mostró en procesarProgramacionFirma
                this.loadData(); // Recargar datos para reflejar cambios
            } else if (result.dismiss === Swal.DismissReason.cancel || 
                    result.dismiss === Swal.DismissReason.esc) {
                // Si cancela de cualquier forma, volver a abrir el modal de ampliar
                setTimeout(() => {
                    this.ampliarReserva(reservaId);
                }, 300);
            }
        });
        
        // Enfocar el input después de que se muestre el modal
        setTimeout(() => {
            const input = document.getElementById('diasFirma');
            if (input) input.focus();
        }, 100);
    }

    async procesarAmpliacion(reservaId, dias) {
        try {
            // Validar que sean 7 o 20 días
            if (dias !== 7 && dias !== 20) {
                throw new Error('Solo se puede ampliar por 7 o 20 días');
            }
            
            // Llamar a la API real
            const resultado = await this.app.api.ampliarReserva(reservaId, dias);
            
            // ACTUALIZAR DATOS LOCALES Y TABLA
            await this.refreshData();
            
            // Mostrar mensaje de éxito con los detalles
            const mensaje = `Reserva ampliada exitosamente por ${dias} días.\n` +
                        `Nuevo monto: ${resultado.montoReserva} Bs.\n` +
                        `Nuevo tiempo de espera: ${resultado.tiempoEspera} días`;
            
            UI.showAlert(mensaje, 'success');
            
            return true;
        } catch (error) {
            console.error('Error al ampliar reserva:', error);
            
            let mensajeError = 'Error al ampliar la reserva';
            if (error.message.includes('Solo puedes ampliar tus propias reservas')) {
                mensajeError = 'Solo puedes ampliar las reservas que has creado';
            } else if (error.message.includes('Debe especificar 7 o 20 días')) {
                mensajeError = 'Solo se puede ampliar por 7 o 20 días';
            } else if (error.message.includes('Reserva no encontrada')) {
                mensajeError = 'La reserva no fue encontrada';
            }
            
            Swal.showValidationMessage(mensajeError);
            return false;
        }
    }

    async procesarProgramacionFirma(reservaId, dias) {
        try {
            // Validar que los días sean válidos
            if (!dias || dias < 1 || dias > 365) {
                throw new Error('El número de días debe estar entre 1 y 365');
            }
            
            // Llamar a la API real con la acción "firma_en_x_dias"
            const resultado = await this.app.api.ejecutarAccionReserva(reservaId, 'firma_en_x_dias', { dias });
            
            // ACTUALIZAR DATOS LOCALES Y TABLA
            await this.refreshData();
            
            // Mostrar mensaje de éxito
            const mensaje = `Firma programada exitosamente para dentro de ${dias} días.\n` +
                        `Nuevo tiempo de espera: ${resultado.tiempoEspera} días`;
            
            UI.showAlert(mensaje, 'success');
            
            return true;
        } catch (error) {
            console.error('Error al programar firma:', error);
            
            let mensajeError = 'Error al programar la firma';
            if (error.message.includes('Solo administradores')) {
                mensajeError = 'Solo los administradores pueden programar firmas';
            } else if (error.message.includes('Reserva no encontrada')) {
                mensajeError = 'La reserva no fue encontrada';
            } else if (error.message.includes('No se puede realizar acciones')) {
                mensajeError = 'No se puede programar firma en una reserva ya firmada';
            }
            
            Swal.showValidationMessage(mensajeError);
            return false;
        }
    }


    firmarReserva(reservaId) {
        try {
            // Cerrar cualquier SweetAlert abierto
            Swal.close();
            
            const reserva = this.datos.find(r => r.id === reservaId);
            if (!reserva) {
                UI.showAlert('Reserva no encontrada', 'error');
                return;
            }

            // Verificar si la reserva ya está firmada
            if (reserva.estado === 'Firmado') {
                UI.showAlert('Esta reserva ya ha sido firmada', 'warning');
                return;
            }

            // Verificar permisos para agentes
            const user = this.app.auth.getUser();
            if (user.rol === 'Agente' && reserva.asesorId !== user.id) {
                UI.showAlert('Solo puedes firmar tus propias reservas', 'warning');
                return;
            }

            // Obtener información del cliente para mostrar en el modal
            const clientes = this.allProspectos;
            const cliente = clientes.find(c => c.id && c.id.toString() === reserva.clienteId.toString());
            const nombreCliente = cliente ? `${cliente.nombre} ${cliente.apellido}` : 'Cliente';

            // Mostrar modal con formulario para método de pago y monto
            Swal.fire({
            title: 'Firmar Reserva',
            html: `
                <div style="text-align: left;">
                    <p>¿Estás seguro que deseas firmar la reserva de <strong>${nombreCliente}</strong>?</p>
                    
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600;">
                            Método de Pago:
                        </label>
                        <select id="metodoPagoFirma" 
                                style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;">
                            <option value="Efectivo">Efectivo</option>
                            <option value="Transferencia">Transferencia</option>
                            <option value="Tarjeta">Tarjeta</option>
                            <option value="Depósito">Depósito</option>
                            <option value="Cheque">Cheque</option>
                        </select>
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600;">
                            Monto de Firma (Bs.):
                        </label>
                        <input 
                            type="number" 
                            id="montoFirma" 
                            style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;"
                            placeholder="Ingrese el monto"
                            min="0"
                            step="0.01"
                            value=''}"
                        >
                    </div>
                    
                    <p style="color: #856404; background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 4px; margin-top: 15px;">
                        <i class="fas fa-exclamation-triangle"></i> Esta acción no se puede deshacer.
                    </p>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#28a745',
            cancelButtonColor: '#6c757d',
            confirmButtonText: '<i class="fas fa-signature"></i> Sí, firmar reserva',
            cancelButtonText: 'Cancelar',
            showLoaderOnConfirm: true,
            allowOutsideClick: () => !Swal.isLoading(),
            backdrop: true,
            focusConfirm: false,
            width: '500px', // Ancho fijo
            preConfirm: () => {
                // ... validaciones igual que antes ...
            },
            didOpen: () => {
                // Asegurar que los inputs tengan el ancho correcto
                setTimeout(() => {
                    const inputs = document.querySelectorAll('#metodoPagoFirma, #montoFirma');
                    inputs.forEach(input => {
                        input.style.width = '100%';
                    });
                    
                    const montoInput = document.getElementById('montoFirma');
                    if (montoInput) montoInput.focus();
                }, 100);
            }
        }).then(async (result) => {
                if (result.isConfirmed) {
                    const { metodoPago, monto } = result.value;
                    
                    try {
                        await this.procesarFirma(reservaId, metodoPago, monto);
                    } catch (error) {
                        console.error('Error en la firma:', error);
                    }
                } else if (result.dismiss === Swal.DismissReason.cancel || 
                        result.dismiss === Swal.DismissReason.esc) {
                    // Usuario canceló
                    console.log('Firma cancelada por el usuario');
                }
            });
            
        } catch (error) {
            console.error('Error al abrir modal de firmar reserva:', error);
            UI.showAlert('Error al cargar la información de la reserva', 'error');
        }
    }

    async procesarFirma(reservaId, metodoPago, monto) {
        try {            
            // Llamar a la API real con método de pago y monto
            const resultado = await this.app.api.firmarReserva(reservaId, metodoPago, monto);
            
            // ACTUALIZAR DATOS LOCALES Y TABLA
            await this.refreshData();
            
            // Mostrar mensaje de éxito con detalles
            const mensaje = `
                Reserva firmada exitosamente<br>
                <strong>Método de pago:</strong> ${metodoPago}<br>
                <strong>Monto:</strong> ${monto} Bs.
            `;
            
            UI.showAlert(mensaje, 'success');
            
            return true;
        } catch (error) {
            console.error('Error al firmar reserva:', error);
            
            let mensajeError = 'Error al firmar la reserva';
            if (error.message.includes('Solo puedes firmar tus propias reservas')) {
                mensajeError = 'Solo puedes firmar las reservas que has creado';
            } else if (error.message.includes('Reserva no encontrada')) {
                mensajeError = 'La reserva no fue encontrada';
            } else if (error.message.includes('No se puede realizar acciones')) {
                mensajeError = 'No se puede firmar una reserva ya firmada o declinada';
            } else if (error.message.includes('Acción no válida')) {
                mensajeError = 'Acción de firma no válida';
            } else if (error.message.includes('monto')) {
                mensajeError = 'El monto ingresado no es válido';
            } else if (error.message.includes('método de pago')) {
                mensajeError = 'El método de pago seleccionado no es válido';
            }
            
            Swal.fire({
                icon: 'error',
                title: 'Error al firmar',
                text: mensajeError,
                confirmButtonColor: '#dc3545'
            });
            
            return false;
        }
    }

    declinarReserva(reservaId) {
        try {
            // Cerrar cualquier SweetAlert abierto
            Swal.close();
            
            const reserva = this.datos.find(r => r.id === reservaId);
            if (!reserva) {
                UI.showAlert('Reserva no encontrada', 'error');
                return;
            }

            // Verificar si la reserva ya está firmada
            if (reserva.estado === 'Firmado') {
                UI.showAlert('No se puede declinar una reserva ya firmada', 'warning');
                return;
            }

            // Verificar permisos (solo admin puede declinar)
            const user = this.app.auth.getUser();
            if (user.rol !== 'Admin') {
                UI.showAlert('Solo los administradores pueden declinar reservas', 'warning');
                return;
            }

            // Mostrar modal de declinación
            this.mostrarModalDeclinar(reservaId);
            
        } catch (error) {
            console.error('Error al abrir modal de declinar reserva:', error);
            UI.showAlert('Error al cargar la información de la reserva', 'error');
        }
    }

    mostrarModalDeclinar(reservaId) {
        const reserva = this.datos.find(r => r.id === reservaId);
        if (!reserva) return;

        // Obtener información del cliente para mostrar en el modal
        const clientes = this.allProspectos;
        const cliente = clientes.find(c => c.id && c.id.toString() === reserva.clienteId.toString());
        const nombreCliente = cliente ? `${cliente.nombre} ${cliente.apellido}` : 'Cliente';

        Swal.fire({
            title: 'Declinar Reserva',
            html: `
                <div class="swal-content">
                    <p>Selecciona el tipo de declinación para la reserva de <strong>${nombreCliente}</strong>:</p>
                    
                    <div class="declinar-options">
                        <div class="declinar-option" data-accion="declinado_sin_devolucion">
                            <div class="option-icon">
                                <i class="fas fa-times-circle"></i>
                            </div>
                            <div class="option-content">
                                <h4>Declinar sin Devolución</h4>
                                <p>La reserva se declinará sin realizar devolución del monto pagado</p>
                            </div>
                        </div>
                        
                        <div class="declinar-option" data-accion="declinado_con_devolucion">
                            <div class="option-icon">
                                <i class="fas fa-undo-alt"></i>
                            </div>
                            <div class="option-content">
                                <h4>Declinar con Devolución</h4>
                                <p>La reserva se declinará y se procederá con la devolución del monto pagado</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="selected-option-info" id="selectedOptionInfo" style="display: none; margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 5px; border-left: 4px solid #dc3545;">
                        <strong>Opción seleccionada:</strong> <span id="selectedOptionText"></span>
                    </div>
                </div>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc3545',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Confirmar Declinación',
            cancelButtonText: 'Cancelar',
            showLoaderOnConfirm: true,
            allowOutsideClick: true,
            backdrop: true,
            width: '600px',
            preConfirm: () => {
                const selectedOption = document.querySelector('.declinar-option.selected');
                if (!selectedOption) {
                    Swal.showValidationMessage('Por favor selecciona un tipo de declinación');
                    return false;
                }
                
                const accion = selectedOption.getAttribute('data-accion');
                return this.procesarDeclinacion(reservaId, accion);
            },
            didOpen: () => {
                // Configurar event listeners para las opciones
                const options = document.querySelectorAll('.declinar-option');
                const selectedInfo = document.getElementById('selectedOptionInfo');
                const selectedText = document.getElementById('selectedOptionText');
                
                options.forEach(option => {
                    option.addEventListener('click', () => {
                        // Remover selección anterior
                        options.forEach(opt => opt.classList.remove('selected'));
                        
                        // Agregar selección actual
                        option.classList.add('selected');
                        
                        // Mostrar información de la opción seleccionada
                        const accion = option.getAttribute('data-accion');
                        let texto = '';
                        
                        if (accion === 'declinado_sin_devolucion') {
                            texto = 'Declinar sin Devolución - No se realizará devolución del monto pagado';
                        } else if (accion === 'declinado_con_devolucion') {
                            texto = 'Declinar con Devolución - Se procederá con la devolución del monto pagado';
                        }
                        
                        selectedText.textContent = texto;
                        selectedInfo.style.display = 'block';
                    });
                });
            }
        }).then((result) => {
            if (result.isConfirmed) {
                // El mensaje de éxito ya se mostró en procesarDeclinacion
                this.loadData(); // Recargar datos para reflejar cambios
            } else if (result.dismiss === Swal.DismissReason.cancel || 
                    result.dismiss === Swal.DismissReason.esc) {
                // Usuario canceló
                console.log('Declinación cancelada por el usuario');
            }
        });
    }

    async procesarDeclinacion(reservaId, accion) {
        try {            
            // Llamar a la API real con la acción de declinación
            const resultado = await this.app.api.ejecutarAccionReserva(reservaId, accion);
            
            // ACTUALIZAR DATOS LOCALES Y TABLA
            await this.refreshData();
            
            // Determinar mensaje según el tipo de declinación
            let mensaje = '';
            if (accion === 'declinado_sin_devolucion') {
                mensaje = 'Reserva declinada exitosamente sin devolución';
            } else if (accion === 'declinado_con_devolucion') {
                mensaje = 'Reserva declinada exitosamente con devolución';
            }
            
            UI.showAlert(mensaje, 'success');
            
            return true;
        } catch (error) {
            console.error('Error al declinar reserva:', error);
            
            let mensajeError = 'Error al declinar la reserva';
            if (error.message.includes('Solo administradores')) {
                mensajeError = 'Solo los administradores pueden declinar reservas';
            } else if (error.message.includes('Reserva no encontrada')) {
                mensajeError = 'La reserva no fue encontrada';
            } else if (error.message.includes('No se puede realizar acciones')) {
                mensajeError = 'No se puede declinar una reserva ya firmada';
            } else if (error.message.includes('Acción no válida')) {
                mensajeError = 'Tipo de declinación no válido';
            }
            
            Swal.showValidationMessage(mensajeError);
            return false;
        }
    }

    exportData() {
        const datosFiltrados = this.aplicarFiltros();

        if (datosFiltrados.length === 0) {
            UI.showAlert('No hay datos para exportar', 'warning');
            return;
        }

        // Preparar datos para exportación
        const data = datosFiltrados.map(reserva => {
            const proyectos = this.app.getProyectos();
            const agentes = this.app.getAgentes();
            const clientes = this.allProspectos;
            
            // Buscar información relacionada
            const proyecto = proyectos.find(p => p.id.toString() === reserva.proyectoId.toString());
            const agente = agentes.find(a => a.id.toString() === reserva.asesorId.toString());
            const cliente = clientes.find(c => c.id && c.id.toString() === reserva.clienteId.toString());
            
            const nombreProyecto = proyecto ? proyecto.nombre : 'No encontrado';
            const nombreAgente = agente ? `${agente.nombre} ${agente.apellido}` : 'No encontrado';
            const nombreCliente = cliente ? `${cliente.nombre} ${cliente.apellido}` : 'No encontrado';
            const fechaReserva = reserva.fechaReserva ? new Date(reserva.fechaReserva).toLocaleDateString() : 'No especificada';
            const horaReserva = reserva.horaReserva || 'No especificada';
            const estadoTexto = this.getEstadoTexto(reserva.estado);

            return [
                nombreCliente,
                nombreProyecto,
                reserva.manzano || 'N/A',
                reserva.nroTerreno || 'N/A',
                `${reserva.tiempoEspera} días`,
                nombreAgente,
                reserva.metodoPago || 'No especificado',
                `${reserva.montoReserva || 0} Bs.`,
                estadoTexto,
                fechaReserva,
                horaReserva // ← NUEVA COLUMNA AGREGADA
            ];
        });

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF("landscape");

        // Título del reporte
        doc.setFontSize(16);
        doc.text("Reporte de Reservas", 14, 20);

        // Fecha de generación
        const hoy = new Date();
        const fechaGeneracion = hoy.toLocaleDateString('es-BO');
        doc.setFontSize(10);
        doc.text(`Generado: ${fechaGeneracion}`, 14, 28);

        // Información de filtros aplicados
        const filtrosTexto = [];
        if (this.filtros.fechaInicio || this.filtros.fechaFin) {
            filtrosTexto.push(`Fechas: ${this.filtros.fechaInicio || '-'} a ${this.filtros.fechaFin || '-'}`);
        }
        if (this.filtros.proyecto !== 'todos') {
            const proyectos = this.app.getProyectos();
            const proyecto = proyectos.find(p => p.id.toString() === this.filtros.proyecto.toString());
            filtrosTexto.push(`Proyecto: ${proyecto ? proyecto.nombre : 'N/A'}`);
        }
        if (this.filtros.agente !== 'todos') {
            const agentes = this.app.getAgentes();
            const agente = agentes.find(a => a.id.toString() === this.filtros.agente.toString());
            filtrosTexto.push(`Agente: ${agente ? `${agente.nombre} ${agente.apellido}` : 'N/A'}`);
        }
        if (this.filtros.estado !== 'todos') {
            const estadoTexto = this.filtros.estado.charAt(0).toUpperCase() + this.filtros.estado.slice(1);
            filtrosTexto.push(`Estado: ${estadoTexto}`);
        }
        if (this.filtros.metodoPago !== 'todos') {
            filtrosTexto.push(`Método Pago: ${this.filtros.metodoPago}`);
        }
        if (this.filtros.search) {
            filtrosTexto.push(`Búsqueda: "${this.filtros.search}"`);
        }

        // Mostrar filtros aplicados
        if (filtrosTexto.length > 0) {
            const pageWidth = doc.internal.pageSize.getWidth();
            const margin = 14;
            const usableWidth = pageWidth - margin * 2;

            // Calcular posición para los filtros
            let currentY = 33;
            const maxFiltersPerLine = 3;
            
            for (let i = 0; i < filtrosTexto.length; i += maxFiltersPerLine) {
                const lineFilters = filtrosTexto.slice(i, i + maxFiltersPerLine);
                
                lineFilters.forEach((texto, index) => {
                    let x, align;
                    const filtersInLine = lineFilters.length;

                    if (filtersInLine === 1) {
                        x = margin;
                        align = 'left';
                    } else if (filtersInLine === 2) {
                        x = index === 0 ? margin : pageWidth / 2;
                        align = index === 0 ? 'left' : 'center';
                    } else {
                        const segmentWidth = usableWidth / filtersInLine;
                        x = margin + (segmentWidth * index) + (segmentWidth / 2);
                        align = 'center';
                    }

                    const textoDividido = doc.splitTextToSize(texto, usableWidth / filtersInLine);
                    doc.text(textoDividido, x, currentY, { align: align });
                });
                
                currentY += 8; // Espacio entre líneas de filtros
            }
        }

        // Crear tabla con los datos
        const startY = filtrosTexto.length > 0 ? 38 + (Math.ceil(filtrosTexto.length / 3) * 8) : 35;
        
        doc.autoTable({
            head: [
                ["Cliente", "Proyecto", "Manzano", "Lote", "Tiempo Espera", "Agente", "Método Pago", "Monto", "Estado", "Fecha Reserva", "Hora Reserva"] // ← HEADER ACTUALIZADO
            ],
            body: data,
            startY: startY,
            styles: { 
                fontSize: 7,
                cellPadding: 2
            },
            headStyles: {
                fillColor: [41, 128, 185],
                textColor: 255,
                fontStyle: 'bold'
            },
            alternateRowStyles: {
                fillColor: [245, 245, 245]
            },
            margin: { top: 10 },
            tableWidth: 'wrap'
        });

        // Generar nombre del archivo
        const nombreArchivo = `reporte_reservas_${hoy.getFullYear()}-${hoy.getMonth()+1}-${hoy.getDate()}.pdf`;
        
        // Guardar PDF
        doc.save(nombreArchivo);

        UI.showAlert('PDF generado correctamente', 'success');
    }

    getTitle() {
        return 'Gestión de Reservas';
    }

    cleanup() {
        this.eventListenersSetup = false;

        // Limpiar event listeners de las opciones de ampliar
        const opciones = document.querySelectorAll('.ampliar-option');
        opciones.forEach(opcion => {
            opcion.replaceWith(opcion.cloneNode(true));
        });

        if (this.pagination) {
            this.pagination.destroy();
            this.pagination = null;
        }
    }

    onTabShow() {
        this.loadData();
    }
}