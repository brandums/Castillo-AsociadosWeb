class Clientes {
    constructor(app) {
        this.app = app;
        this.datos = [];
        this.clientesOriginales = []; // Guardamos los datos originales
        this.filtros = {
            search: '',
            fechaInicio: '',
            fechaFin: '',
            proyecto: 'todos',
            agente: 'todos',
            equipo: 'todos',
            amurallado: 'todos'
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
        if(this.isAdmin())
        {
            document.getElementById('clientefiltroAgenteGroup').style.display = 'block';
        }   

        this.clientesOriginales = this.app.getClientes();
        this.agruparClientes();
        this.setupEventListeners();
        await this.renderTable();
    }

    async loadData() {
        try {
            UI.showLoading(document.getElementById('clientesTab'));
            await this.app.refreshGlobalData("clientes");
            this.clientesOriginales = this.app.getClientes();
            this.agruparClientes();
            UI.hideLoading(document.getElementById('clientesTab'));
        } catch (error) {
            console.error('Error loading clientes:', error);
            UI.showAlert('Error al cargar los clientes', 'error');
            UI.hideLoading(document.getElementById('clientesTab'));
        }
    }

    agruparClientes() {
        const agrupados = {};
        
        this.clientesOriginales.forEach(cliente => {
            const clave = `${cliente.nombre}-${cliente.apellido}-${cliente.telefono}`;
            
            if (!agrupados[clave]) {
                agrupados[clave] = {
                    id: cliente.clienteId,
                    nombre: cliente.nombre,
                    apellido: cliente.apellido,
                    telefono: cliente.telefono,
                    firmas: 0,
                    contratos: [],
                    tieneAmurallado: false,
                    // Propiedades para filtros
                    proyectos: new Set(),
                    agentes: new Set(),
                    equipos: new Set(),
                    // USAR fechaFirma directamente ya que viene del endpoint
                    fechaFirma: cliente.fechaFirma // ← CAMBIAR de 'fecha' a 'fechaFirma'
                };
            }
            
            agrupados[clave].firmas++;
            agrupados[clave].contratos.push(cliente);
            
            // Agregar a los sets para filtros rápidos
            if (cliente.proyecto) agrupados[clave].proyectos.add(cliente.proyecto);
            if (cliente.asesorId) agrupados[clave].agentes.add(cliente.asesorId);
            if (cliente.equipo) agrupados[clave].equipos.add(cliente.equipo);
            
            if (cliente.amurallado) {
                agrupados[clave].tieneAmurallado = true;
            }

            // Si hay múltiples contratos, usar la fecha más temprana
            if (cliente.fechaFirma) {
                const fechaActual = new Date(cliente.fechaFirma);
                if (!agrupados[clave].fechaFirma || fechaActual < new Date(agrupados[clave].fechaFirma)) {
                    agrupados[clave].fechaFirma = cliente.fechaFirma;
                }
            }
        });
        
        this.datos = Object.values(agrupados);
    }

    setupEventListeners() {
        if (this.eventListenersSetup) return;
        this.eventListenersSetup = true;

        // Búsqueda
        const searchInput = document.getElementById('clientesSearch');
        if (searchInput && !searchInput.hasListener) {
            searchInput.hasListener = true;
            searchInput.addEventListener('input', Utils.debounce((e) => {
                this.filtros.search = e.target.value;
                this.paginacion.paginaActual = 1;
                this.renderTable();
            }, 300));
        }

        // Botón Voltear lista
        const btnVoltear = document.getElementById('btnVoltearClientes');
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
        const btnFiltros = document.getElementById('btnFiltrosClientes');
        if (btnFiltros && !btnFiltros.hasListener) {
            btnFiltros.hasListener = true;
            btnFiltros.addEventListener('click', () => {
                this.mostrarModalFiltros();
            });
        }

        // Aplicar filtros desde el modal
        const btnAplicarFiltros = document.getElementById('btnAplicarFiltrosClientes');
        if (btnAplicarFiltros && !btnAplicarFiltros.hasListener) {
            btnAplicarFiltros.hasListener = true;
            btnAplicarFiltros.addEventListener('click', () => {
                this.aplicarFiltrosDesdeModal();
            });
        }

        // Limpiar filtros desde el modal
        const btnLimpiarFiltros = document.getElementById('btnLimpiarFiltrosClientes');
        if (btnLimpiarFiltros && !btnLimpiarFiltros.hasListener) {
            btnLimpiarFiltros.hasListener = true;
            btnLimpiarFiltros.addEventListener('click', () => {
                this.limpiarFiltrosDesdeModal();
            });
        }

        // Exportar
        const exportBtn = document.getElementById('exportClientes');
        if (exportBtn && !exportBtn.hasListener) {
            exportBtn.hasListener = true;
            exportBtn.addEventListener('click', () => {
                this.exportData();
            });
        }

        const btnConfirmarAmurallar = document.getElementById('btnConfirmarAmurallar');
        if (btnConfirmarAmurallar && !btnConfirmarAmurallar.hasListener) {
            btnConfirmarAmurallar.hasListener = true;
            btnConfirmarAmurallar.addEventListener('click', () => {
                this.confirmarAmurallarContrato();
            });
        }

        // EVENT LISTENER GLOBAL PARA PAGINACIÓN (IMPORTANTE)
        document.addEventListener('click', (e) => {
            // Botón Anterior
            if (e.target.closest('#prevPageClientes')) {
                e.preventDefault();
                if (this.paginacion.paginaActual > 1) {
                    this.paginacion.paginaActual--;
                    this.renderTable();
                }
            }
            // Botón Siguiente
            else if (e.target.closest('#nextPageClientes')) {
                e.preventDefault();
                const datosFiltrados = this.aplicarFiltros();
                const totalPages = Math.ceil(datosFiltrados.length / this.paginacion.porPagina);
                
                if (this.paginacion.paginaActual < totalPages) {
                    this.paginacion.paginaActual++;
                    this.renderTable();
                }
            }
            // Botones de números de página
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
            this.pagination = initPagination('clientesPagination', {
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
        UI.showModal('modalFiltrosClientes');
    }

    cargarOpcionesEnModal() {
        const proyectos = this.app.getProyectos();
        const agentes = this.app.getAgentes();
        const equipos = this.app.getEquipos();

        // Proyectos
        const selectProyecto = document.getElementById('filtroProyectoClientes');
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
        const selectAgente = document.getElementById('filtroAgenteClientes');
        if (selectAgente) {
            selectAgente.innerHTML = '<option value="todos">Todos los agentes</option>';
            agentes.forEach(agente => {
                const option = document.createElement('option');
                option.value = agente.id;
                option.textContent = `${agente.nombre} ${agente.apellido}`;
                selectAgente.appendChild(option);
            });
        }

        // Equipos
        const selectEquipo = document.getElementById('filtroEquipoClientes');
        if (selectEquipo) {
            selectEquipo.innerHTML = '<option value="todos">Todos los equipos</option>';
            equipos.forEach(equipo => {
                const option = document.createElement('option');
                option.value = equipo.id;
                option.textContent = equipo.nombre;
                selectEquipo.appendChild(option);
            });
        }
    }

    establecerValoresActualesEnModal() {
        document.getElementById('fechaInicioClientes').value = this.filtros.fechaInicio;
        document.getElementById('fechaFinClientes').value = this.filtros.fechaFin;
        document.getElementById('filtroProyectoClientes').value = this.filtros.proyecto;
        document.getElementById('filtroAgenteClientes').value = this.filtros.agente;
        document.getElementById('filtroEquipoClientes').value = this.filtros.equipo;
        document.getElementById('filtroAmuralladoClientes').value = this.filtros.amurallado;
    }

    aplicarFiltrosDesdeModal() {
        this.filtros.fechaInicio = document.getElementById('fechaInicioClientes').value;
        this.filtros.fechaFin = document.getElementById('fechaFinClientes').value;
        this.filtros.proyecto = document.getElementById('filtroProyectoClientes').value;
        this.filtros.agente = document.getElementById('filtroAgenteClientes').value;
        this.filtros.equipo = document.getElementById('filtroEquipoClientes').value;
        this.filtros.amurallado = document.getElementById('filtroAmuralladoClientes').value;
        
        this.paginacion.paginaActual = 1;
        
        UI.closeModal('modalFiltrosClientes');
        this.renderTable();
        this.actualizarIndicadorFiltros();
        UI.showAlert('Filtros aplicados correctamente', 'success');
    }

    limpiarFiltrosDesdeModal() {
        document.getElementById('fechaInicioClientes').value = '';
        document.getElementById('fechaFinClientes').value = '';
        document.getElementById('filtroProyectoClientes').value = 'todos';
        document.getElementById('filtroAgenteClientes').value = 'todos';
        document.getElementById('filtroEquipoClientes').value = 'todos';
        document.getElementById('filtroAmuralladoClientes').value = 'todos';
        
        UI.closeModal('modalFiltrosClientes');
        this.clearFilters();
    }

    mostrarFiltrosActivos() {
        const container = document.getElementById('filtrosAplicadosContainerClientes');
        const content = document.getElementById('filtrosAplicadosClientes');
        
        if (!container || !content) return;
        
        const filtrosActivos = [];
        const proyectos = this.app.getProyectos();
        const agentes = this.app.getAgentes();
        const equipos = this.app.getEquipos();

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
        
        if (this.filtros.equipo !== 'todos') {
            const equipo = equipos.find(e => e.id === this.filtros.equipo);
            const textoEquipo = equipo ? equipo.nombre : 'Equipo';
            filtrosActivos.push({ tipo: 'equipo', texto: textoEquipo });
        }
        
        if (this.filtros.amurallado !== 'todos') {
            const textoAmurallado = this.filtros.amurallado === 'amurallado' ? 'Amurallados' : 'No Amurallados';
            filtrosActivos.push({ tipo: 'amurallado', texto: textoAmurallado });
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
            case 'equipo':
                this.filtros.equipo = 'todos';
                break;
            case 'amurallado':
                this.filtros.amurallado = 'todos';
                break;
        }
        
        this.sincronizarInputsModal();
        this.paginacion.paginaActual = 1;
        this.renderTable();
        this.actualizarIndicadorFiltros();
        this.mostrarFiltrosActivos();
    }

    sincronizarInputsModal() {
        document.getElementById('fechaInicioClientes').value = this.filtros.fechaInicio;
        document.getElementById('fechaFinClientes').value = this.filtros.fechaFin;
        document.getElementById('filtroProyectoClientes').value = this.filtros.proyecto;
        document.getElementById('filtroAgenteClientes').value = this.filtros.agente;
        document.getElementById('filtroEquipoClientes').value = this.filtros.equipo;
        document.getElementById('filtroAmuralladoClientes').value = this.filtros.amurallado;
    }

    actualizarIndicadorFiltros() {
        const btnFiltros = document.getElementById('btnFiltrosClientes');
        if (!btnFiltros) return;
        
        const tieneFiltros = this.filtros.fechaInicio || this.filtros.fechaFin || 
                            this.filtros.proyecto !== 'todos' || this.filtros.agente !== 'todos' || 
                            this.filtros.equipo !== 'todos' || this.filtros.amurallado !== 'todos';
        
        if (tieneFiltros) {
            btnFiltros.classList.add('btn-filtros-activos');
        } else {
            btnFiltros.classList.remove('btn-filtros-activos');
        }
    }

    aplicarFiltros() {
        let datosFiltrados = [...this.datos];

        if (this.filtros.search) {
            datosFiltrados = Utils.buscarEnTexto(datosFiltrados, this.filtros.search, [
                'nombre', 'apellido', 'telefono'
            ]);
        }

        // Filtro por proyecto
        if (this.filtros.proyecto !== 'todos') {
            datosFiltrados = datosFiltrados.filter(cliente => 
                cliente.proyectos && cliente.proyectos.has(this.filtros.proyecto)
            );
        }

        // Filtro por agente
        if (this.filtros.agente !== 'todos') {
            datosFiltrados = datosFiltrados.filter(cliente => 
                cliente.agentes && cliente.agentes.has(this.filtros.agente)
            );
        }

        // Filtro por equipo
        if (this.filtros.equipo !== 'todos') {
            datosFiltrados = datosFiltrados.filter(cliente => 
                cliente.equipos && cliente.equipos.has(this.filtros.equipo)
            );
        }

        // Filtro por amurallado
        if (this.filtros.amurallado !== 'todos') {
            datosFiltrados = datosFiltrados.filter(cliente => 
                this.filtros.amurallado === 'amurallado' ? cliente.tieneAmurallado : !cliente.tieneAmurallado
            );
        }

        // FILTRO POR FECHAS - CORREGIDO: usar 'fechaFirma'
        if (this.filtros.fechaInicio || this.filtros.fechaFin) {        
            datosFiltrados = Utils.filtrarPorFechas(
                datosFiltrados, 
                this.filtros.fechaInicio, 
                this.filtros.fechaFin, 
                'fechaFirma'
            );
        }

        return datosFiltrados;
    }

    renderTable() {
        const tbody = document.getElementById('clientesTableBody');
        const table = document.getElementById('clientesTable');
        
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
                    <td colspan="4" class="table-empty">
                        <i class="fas fa-user-check"></i>
                        <h3>No se encontraron clientes</h3>
                        <p>No hay clientes que coincidan con los filtros aplicados.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = paginado.datos.map(cliente => {
            const estaAmurallado = cliente.tieneAmurallado;
            
            return `
                <tr>
                    <td>
                        <div class="mobile-cell-content">
                            <div class="main-info">${cliente.nombre} ${cliente.apellido}</div>
                        </div>
                    </td>
                    <td>${cliente.telefono}</td>
                    <td>
                        <span class="badge badge-primary">${cliente.firmas} firma(s)</span>
                    </td>
                    <td class="actions-column">
                        <div class="actions-dropdown">
                            <button class="actions-toggle">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                            <div class="actions-menu">
                                <button class="action-item" data-action="ver-firmas" data-id="${cliente.id}">
                                    <i class="fas fa-file-contract"></i>
                                    Ver Firmas
                                </button>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        this.setupActionListeners();
    }

    actualizarEstadoBotonesPaginacion(totalItems) {
        const prevBtn = document.getElementById('prevPageClientes');
        const nextBtn = document.getElementById('nextPageClientes');
        const totalPages = Math.ceil(totalItems / this.paginacion.porPagina);

        if (prevBtn) {
            prevBtn.disabled = this.paginacion.paginaActual === 1;
        }
        if (nextBtn) {
            nextBtn.disabled = this.paginacion.paginaActual === totalPages;
        }
    }

    setupActionListeners() {
        const tbody = document.getElementById('clientesTableBody');
        if (!tbody) return;

        tbody.addEventListener('click', (e) => {
            const actionItem = e.target.closest('.action-item');
            if (!actionItem) return;

            const action = actionItem.getAttribute('data-action');
            const clienteId = actionItem.getAttribute('data-id');

            switch (action) {
                case 'ver-firmas':
                    this.verFirmasCliente(clienteId);
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
            equipo: 'todos',
            amurallado: 'todos'
        };
        this.paginacion.paginaActual = 1;

        document.getElementById('clientesSearch').value = '';

        this.renderTable();
        this.actualizarIndicadorFiltros();
        UI.showAlert('Filtros limpiados correctamente', 'success');
    }

    async verFirmasCliente(clienteId) {
        try {
            const cliente = this.datos.find(c => c.id === clienteId);
            if (!cliente) {
                UI.showAlert('Cliente no encontrado', 'error');
                return;
            }
            
            const agentes = this.app.getAgentes();
            const proyectos = this.app.getProyectos();

            const esAdmin = this.isAdmin();
            
            // Actualizar título del modal
            document.getElementById('modalFirmasTitulo').textContent = 
                `Firmas de ${cliente.nombre} ${cliente.apellido}`;

            // Generar contenido de la tabla
            const tbody = document.getElementById('firmasTableBody');
            tbody.innerHTML = cliente.contratos.map(contrato => {
                const agente = agentes.find(a => a.id === contrato.asesorId);
                const proyecto = proyectos.find(p => p.id === contrato.proyecto);
                const nombreCortoAgente = agente ? 
                    `${agente.nombre.split(' ')[0]} ${agente.apellido.split(' ')[0]}`.substring(0, 15) + (agente.nombre.length > 15 ? '...' : '') : 'N/A';
                const nombreProyecto = proyecto ? proyecto.nombre : contrato.proyecto;
                const fechaFirma = Utils.formatDate(contrato.fechaFirma);
                const estaDeshabilitado = !esAdmin || contrato.amurallado;

                return `
                    <tr>
                        <td>
                            <div class="mobile-cell-content">
                                <div class="main-info">${nombreProyecto}</div>
                                <div class="mobile-secondary-info">
                                    <span class="mobile-extra"><i class="fas fa-user-tie"></i> ${nombreCortoAgente}</span>
                                    <span class="mobile-extra"><i class="fas fa-calendar"></i> ${Utils.formatDate(fechaFirma)}</span>
                                </div>
                            </div>
                        </td>
                        
                        <td class="text-center">${contrato.manzano || 'N/A'}</td>
                        <td class="text-center">${contrato.nroTerreno || 'N/A'}</td>
                        <td class="actions-column">
                            <button class="btn btn-sm ${contrato.amurallado ? 'btn-secondary' : 'btn-warning'}" 
                                    ${estaDeshabilitado  ? 'disabled' : ''}
                                    data-action="amurallar-contrato" 
                                    data-contrato-id="${contrato.contratoId}">
                                <i class="fas fa-wall"></i>
                                ${contrato.amurallado ? 'Amurallado' : 'Amurallar'}
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');

            // Mostrar el modal
            UI.showModal('modalFirmasCliente');

            // Configurar event listeners para las acciones dentro del modal
            this.setupFirmasActionListeners();

        } catch (error) {
            console.error('Error al mostrar firmas:', error);
            UI.showAlert('Error al cargar las firmas del cliente', 'error');
        }
    }

    setupFirmasActionListeners() {
        const firmasTbody = document.getElementById('firmasTableBody');
        if (!firmasTbody) return;

        firmasTbody.addEventListener('click', (e) => {
            const button = e.target.closest('button[data-action="amurallar-contrato"]');
            if (!button) return;

            const contratoId = button.getAttribute('data-contrato-id');
            this.abrirModalAmurallar(contratoId);
        });
    }

    abrirModalAmurallar(contratoId) {
        try {
            UI.closeModal('modalFirmasCliente');
            
            document.getElementById('amurallarContratoId').value = contratoId;
            
            document.getElementById('amurallarMetodoPago').value = '';
            document.getElementById('amurallarMonto').value = '';
            
            UI.showModal('modalAmurallarContrato');
            
        } catch (error) {
            console.error('Error al abrir modal de amurallar:', error);
            UI.showAlert('Error al preparar el amurallado', 'error');
        }
    }

    async confirmarAmurallarContrato() {
        try {
            const contratoId = document.getElementById('amurallarContratoId').value;
            const metodoPago = document.getElementById('amurallarMetodoPago').value;
            const monto = document.getElementById('amurallarMonto').value;

            if (!metodoPago) {
                UI.showAlert('Seleccione un método de pago', 'warning');
                return;
            }

            if (!monto || parseFloat(monto) <= 0) {
                UI.showAlert('Ingrese un monto válido', 'warning');
                return;
            }

            UI.showLoading();

            await this.app.api.crearMuralla(contratoId, metodoPago, parseFloat(monto));
            
            UI.hideLoading();
            UI.showAlert('Contrato amurallado correctamente', 'success');
            
            UI.closeModal('modalAmurallarContrato');
            
            await this.loadData();
            
            UI.showAlert('El contrato ha sido amurallado exitosamente', 'success');

        } catch (error) {
            console.error('Error al amurallar contrato:', error);
            UI.hideLoading();
            UI.showAlert(error.message || 'Error al amurallar el contrato', 'error');
        }
    }

    exportData() {
        const datosFiltrados = this.aplicarFiltros();

        if (datosFiltrados.length === 0) {
            UI.showAlert('No hay datos para exportar', 'warning');
            return;
        }

        const data = datosFiltrados.map(cliente => {
            return [
                `${cliente.nombre} ${cliente.apellido}`,
                cliente.telefono,
                cliente.firmas,
                cliente.tieneAmurallado ? 'Sí' : 'No'
            ];
        });

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF("landscape");

        doc.setFontSize(16);
        doc.text("Reporte de Clientes", 14, 20);

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
        if (this.filtros.agente !== 'todos') {
            const agentes = this.app.getAgentes();
            const agente = agentes.find(a => a.id === this.filtros.agente);
            filtrosTexto.push(`Agente: ${agente ? `${agente.nombre} ${agente.apellido}` : 'N/A'}`);
        }
        if (this.filtros.equipo !== 'todos') {
            const equipos = this.app.getEquipos();
            const equipo = equipos.find(e => e.id === this.filtros.equipo);
            filtrosTexto.push(`Equipo: ${equipo ? equipo.nombre : 'N/A'}`);
        }
        if (this.filtros.amurallado !== 'todos') {
            filtrosTexto.push(`Amurallado: ${this.filtros.amurallado === 'amurallado' ? 'Sí' : 'No'}`);
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
            head: [["Nombre", "Teléfono", "Firmas", "Amurallado"]],
            body: data,
            startY: filtrosTexto.length > 0 ? 38 : 35,
            styles: { fontSize: 8 }
        });

        const nombreArchivo = `reporte_clientes_${hoy.getFullYear()}-${hoy.getMonth()+1}-${hoy.getDate()}.pdf`;
        doc.save(nombreArchivo);

        UI.showAlert('PDF generado correctamente', 'success');
    }

    getTitle() {
        return 'Gestión de Clientes';
    }

    cleanup() {
        this.eventListenersSetup = false;

        if (this.pagination) {
            this.pagination.destroy();
            this.pagination = null;
        }
    }

    onTabShow() {
        this.loadData();
    }
}