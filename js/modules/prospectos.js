// js/modules/prospectos.js - VERSIÓN COMPLETA Y FUNCIONAL
class Prospectos {
    constructor(app) {
        this.app = app;
        this.datos = [];
        this.filtros = {
            search: '',
            fechaInicio: '',
            fechaFin: '',
            estado: 'todos',
            seguimiento: 'todos',
            asesor: 'todos'
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
            document.getElementById('prospectofiltroAgenteGroup').style.display = 'block';
        }        

        this.datos = this.app.getProspectos();
        this.setupEventListeners();
        await this.renderTable();
        await this.loadUsuariosParaFiltros();
    }

    async loadData() {
        try {
            UI.showLoading(document.getElementById('prospectosTab'));
            await this.app.refreshGlobalData("prospectos");
            this.datos = this.app.getProspectos();
            
            UI.hideLoading(document.getElementById('prospectosTab'));
        } catch (error) {
            console.error('Error loading prospectos:', error);
            UI.showAlert('Error al cargar los prospectos', 'error');
            UI.hideLoading(document.getElementById('prospectosTab'));
        }
    }

    async loadUsuariosParaFiltros() {
        const agentes = this.app.getAgentes();
        const selectAsesor = document.getElementById('filtroAsesor');
            
        if (selectAsesor) {
            // Limpiar opciones excepto la primera
            while (selectAsesor.children.length > 1) {
                selectAsesor.removeChild(selectAsesor.lastChild);
            }
            
            // Agregar agentes
            agentes.forEach(agente => {
                const option = document.createElement('option');
                option.value = agente.id;
                option.textContent = `${agente.nombre} ${agente.apellido}`;
                selectAsesor.appendChild(option);
            });
        }        
    }

    setupEventListeners() {
        if (this.eventListenersSetup) return;
        this.eventListenersSetup = true;

        // En setupEventListeners - agregar esto después de los otros event listeners
        const btnGuardarSeguimiento = document.getElementById('btnGuardarSeguimiento');
        if (btnGuardarSeguimiento && !btnGuardarSeguimiento.hasListener) {
            btnGuardarSeguimiento.hasListener = true;
            btnGuardarSeguimiento.addEventListener('click', () => {
                this.guardarSeguimiento();
            });
        }

        // Búsqueda
        const searchInput = document.getElementById('prospectosSearch');
        if (searchInput && !searchInput.hasListener) {
            searchInput.hasListener = true;
            searchInput.addEventListener('input', Utils.debounce((e) => {
                this.filtros.search = e.target.value;
                this.paginacion.paginaActual = 1;
                this.renderTable();
            }, 300));
        }

        // Botón Voltear lista
        const btnVoltear = document.getElementById('btnVoltearProspectos');
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
        const btnFiltros = document.getElementById('btnFiltrosProspectos');
        if (btnFiltros && !btnFiltros.hasListener) {
            btnFiltros.hasListener = true;
            btnFiltros.addEventListener('click', () => {
                this.mostrarModalFiltros();
            });
        }

        // Aplicar filtros desde el modal
        const btnAplicarFiltros = document.getElementById('btnAplicarFiltros');
        if (btnAplicarFiltros && !btnAplicarFiltros.hasListener) {
            btnAplicarFiltros.hasListener = true;
            btnAplicarFiltros.addEventListener('click', () => {
                this.aplicarFiltrosDesdeModal();
            });
        }

        // Limpiar filtros desde el modal
        const btnLimpiarFiltros = document.getElementById('btnLimpiarFiltros');
        if (btnLimpiarFiltros && !btnLimpiarFiltros.hasListener) {
            btnLimpiarFiltros.hasListener = true;
            btnLimpiarFiltros.addEventListener('click', () => {
                this.limpiarFiltrosDesdeModal();
            });
        }

        // Exportar
        const exportBtn = document.getElementById('exportProspectos');
        if (exportBtn && !exportBtn.hasListener) {
            exportBtn.hasListener = true;
            exportBtn.addEventListener('click', () => {
                this.exportData();
            });
        }

        // Botón crear prospecto
        const btnCrear = document.getElementById('btnCrearProspecto');
        if (btnCrear) {
            if (this.isAdmin()) {
                btnCrear.style.display = 'none';
            } else {
                if (!btnCrear.hasListener) {
                    btnCrear.hasListener = true;
                    btnCrear.addEventListener('click', () => {
                        this.mostrarModalCrear();
                    });
                }
            }
        }

        if (!this.isAdmin()) {
            // Solo agentes pueden guardar prospectos, prórrogas y registros
            const btnGuardarProspecto = document.getElementById('btnGuardarProspecto');
            if (btnGuardarProspecto && !btnGuardarProspecto.hasListener) {
                btnGuardarProspecto.hasListener = true;
                btnGuardarProspecto.addEventListener('click', () => {
                    this.guardarProspecto();
                });
            }

            const btnGuardarProrroga = document.getElementById('btnGuardarProrroga');
            if (btnGuardarProrroga && !btnGuardarProrroga.hasListener) {
                btnGuardarProrroga.hasListener = true;
                btnGuardarProrroga.addEventListener('click', () => {
                    this.guardarProrroga();
                });
            }

            const btnGuardarRegistro = document.getElementById('btnGuardarRegistro');
            if (btnGuardarRegistro && !btnGuardarRegistro.hasListener) {
                btnGuardarRegistro.hasListener = true;
                btnGuardarRegistro.addEventListener('click', () => {
                    this.guardarRegistro();
                });
            }
        }

        // Inicializar paginación
        if (!this.paginationInitialized) {
            this.pagination = initPagination('prospectosPagination', {
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

        // Modal de cambiar agente
        if (this.isAdmin()) {
            this.setupCambiarAgenteModal();
        }
        
        this.actualizarIndicadorFiltros();
    }

    mostrarModalFiltros() {
        this.cargarAsesoresEnModal();
        this.establecerValoresActualesEnModal();
        this.mostrarFiltrosActivos();
        UI.showModal('modalFiltrosProspectos');
    }

    cargarAsesoresEnModal() {
        const agentes = this.app.getAgentes();
        const selectAsesor = document.getElementById('filtroAsesor');
        
        if (selectAsesor) {
            // Limpiar opciones excepto la primera
            while (selectAsesor.children.length > 1) {
                selectAsesor.removeChild(selectAsesor.lastChild);
            }
            
            // Agregar agentes
            agentes.forEach(agente => {
                const option = document.createElement('option');
                option.value = agente.id;
                option.textContent = `${agente.nombre} ${agente.apellido}`;
                selectAsesor.appendChild(option);
            });
        }
    }

    establecerValoresActualesEnModal() {
        document.getElementById('fechaInicio').value = this.filtros.fechaInicio;
        document.getElementById('fechaFin').value = this.filtros.fechaFin;
        document.getElementById('filtroEstado').value = this.filtros.estado;
        document.getElementById('filtroSeguimiento').value = this.filtros.seguimiento;
        document.getElementById('filtroAsesor').value = this.filtros.asesor;
    }

    aplicarFiltrosDesdeModal() {
        this.filtros.fechaInicio = document.getElementById('fechaInicio').value;
        this.filtros.fechaFin = document.getElementById('fechaFin').value;
        this.filtros.estado = document.getElementById('filtroEstado').value;
        this.filtros.seguimiento = document.getElementById('filtroSeguimiento').value;
        this.filtros.asesor = document.getElementById('filtroAsesor').value;
        
        this.paginacion.paginaActual = 1;
        
        UI.closeModal('modalFiltrosProspectos');
        this.renderTable();
        this.actualizarIndicadorFiltros();
        UI.showAlert('Filtros aplicados correctamente', 'success');
    }

    limpiarFiltrosDesdeModal() {
        document.getElementById('fechaInicio').value = '';
        document.getElementById('fechaFin').value = '';
        document.getElementById('filtroEstado').value = 'todos';
        document.getElementById('filtroSeguimiento').value = 'todos';
        document.getElementById('filtroAsesor').value = 'todos';
        
        UI.closeModal('modalFiltrosProspectos');
        this.clearFilters();
    }

    mostrarFiltrosActivos() {
        const container = document.getElementById('filtrosAplicadosContainer');
        const content = document.getElementById('filtrosAplicados');
        
        if (!container || !content) return;
        
        const filtrosActivos = [];
        const agentes = this.app.getAgentes();

        if (this.filtros.fechaInicio || this.filtros.fechaFin) {
            const textoFecha = this.filtros.fechaInicio && this.filtros.fechaFin 
                ? `${this.filtros.fechaInicio} a ${this.filtros.fechaFin}`
                : this.filtros.fechaInicio 
                    ? `Desde ${this.filtros.fechaInicio}`
                    : `Hasta ${this.filtros.fechaFin}`;
            filtrosActivos.push({ tipo: 'fecha', texto: textoFecha });
        }
        
        if (this.filtros.estado !== 'todos') {
            const estadosTexto = {
                'nuevo': 'Nuevo',
                'reciente': 'Reciente',
                'antiguo': 'Antiguo', 
                'expirado': 'Expirado'
            };
            const textoEstado = estadosTexto[this.filtros.estado] || this.filtros.estado;
            filtrosActivos.push({ tipo: 'estado', texto: textoEstado });
        }

        if (this.filtros.seguimiento !== 'todos') {
            filtrosActivos.push({ tipo: 'seguimiento', texto: `Seguimiento: ${this.filtros.seguimiento}` });
        }
        
        if (this.filtros.asesor !== 'todos') {
            const agente = agentes.find(u => u.id === parseInt(this.filtros.asesor));
            const textoAsesor = agente ? `${agente.nombre} ${agente.apellido}` : 'Asesor';
            filtrosActivos.push({ tipo: 'asesor', texto: textoAsesor });
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
            case 'estado':
                this.filtros.estado = 'todos';
                break;
            case 'seguimiento':
                this.filtros.seguimiento = 'todos';
                break;
            case 'asesor':
                this.filtros.asesor = 'todos';
                break;
        }
        
        this.sincronizarInputsModal();
        this.paginacion.paginaActual = 1;
        this.renderTable();
        this.actualizarIndicadorFiltros();
        this.mostrarFiltrosActivos();
    }

    sincronizarInputsModal() {
        document.getElementById('fechaInicio').value = this.filtros.fechaInicio;
        document.getElementById('fechaFin').value = this.filtros.fechaFin;
        document.getElementById('filtroEstado').value = this.filtros.estado;
        document.getElementById('filtroSeguimiento').value = this.filtros.seguimiento;
        document.getElementById('filtroAsesor').value = this.filtros.asesor;
    }

    actualizarIndicadorFiltros() {
        const btnFiltros = document.getElementById('btnFiltrosProspectos');
        if (!btnFiltros) return;
        
        const tieneFiltros = this.filtros.fechaInicio || this.filtros.fechaFin || 
                            this.filtros.estado !== 'todos' || this.filtros.seguimiento !== 'todos' || this.filtros.asesor !== 'todos';
        
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
                'nombre', 'apellido', 'celular'
            ]);
        }

        if (this.filtros.fechaInicio || this.filtros.fechaFin) {
            datosFiltrados = Utils.filtrarPorFechas(
                datosFiltrados, 
                this.filtros.fechaInicio, 
                this.filtros.fechaFin, 
                'fecha'
            );
        }

        if (this.filtros.estado !== 'todos') {
            datosFiltrados = datosFiltrados.filter(prospecto => {
                const estadoInfo = this.calcularEstadoProspecto(prospecto.fecha);
                return estadoInfo.estado === this.filtros.estado;
            });
        }

        if (this.filtros.seguimiento !== 'todos') {
            datosFiltrados = datosFiltrados.filter(prospecto => 
                prospecto.seguimiento === this.filtros.seguimiento
            );
        }

        if (this.filtros.asesor !== 'todos') {
            datosFiltrados = datosFiltrados.filter(prospecto => 
                String(prospecto.agenteId) === this.filtros.asesor
            );
        }

        return datosFiltrados;
    }

    calcularEstadoProspecto(fechaProspecto) {
        const hoy = new Date();
        const fecha = new Date(fechaProspecto);
        const diferenciaDias = Math.floor((hoy - fecha) / (1000 * 60 * 60 * 24));
        
        if (diferenciaDias <= 10) {
            return { estado: 'nuevo', dias: diferenciaDias };
        } else if (diferenciaDias <= 25) {
            return { estado: 'reciente', dias: diferenciaDias };
        } else if (diferenciaDias <= 30) {
            return { estado: 'antiguo', dias: diferenciaDias };
        } else {
            return { estado: 'expirado', dias: diferenciaDias };
        }
    }

    renderTable() {
        const tbody = document.getElementById('prospectosTableBody');
        const table = document.getElementById('prospectosTable');
        
        if (!tbody || !table) return;

        let datosFiltrados = this.aplicarFiltros();
        const agentes = this.app.getAgentes();

        if (this.ordenDescendente) {
            datosFiltrados = [...datosFiltrados].reverse();
        }

        const paginado = Utils.paginar(
            datosFiltrados, 
            this.paginacion.paginaActual, 
            this.paginacion.porPagina
        );

        if (this.pagination) {
            this.pagination.update(datosFiltrados.length, this.paginacion.paginaActual);
        }

        if (paginado.datos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="table-empty">
                        <i class="fas fa-users"></i>
                        <h3>No se encontraron prospectos</h3>
                        <p>No hay prospectos que coincidan con los filtros aplicados.</p>
                    </td>
                </tr>
            `;
            return;
        }

        const esAdmin = this.isAdmin();

        tbody.innerHTML = paginado.datos.map(prospecto => {
            const agente = agentes.find(u => u.id === prospecto.agenteId);
            const nombreAgente = agente ? `${agente.nombre} ${agente.apellido}` : 'N/A';
            const nombreCortoAgente = agente ? 
                `${agente.nombre.split(' ')[0]} ${agente.apellido.split(' ')[0]}`.substring(0, 15) + (agente.nombre.length > 15 ? '...' : '') : 'N/A';
            
            const estadoInfo = this.calcularEstadoProspecto(prospecto.fecha);
            const badgeClass = Utils.getBadgeClass(estadoInfo.estado);
            const seguimientoBadgeClass = this.getSeguimientoBadgeClass(prospecto.seguimiento);

            const estaExpirado = estadoInfo.estado === 'expirado';
            const esAntiguo = estadoInfo.estado === 'antiguo';

            return `
                <tr>
                    <td>
                        <div class="mobile-cell-content">
                            <div class="main-info">${prospecto.nombre} ${prospecto.apellido}</div>
                            <div class="mobile-secondary-info">
                                <span class="mobile-extra"><i class="fas fa-user-tie"></i> ${nombreCortoAgente}</span>
                                <span class="mobile-extra"><i class="fas fa-calendar"></i> ${Utils.formatDate(prospecto.fecha)}</span>
                            </div>
                        </div>
                    </td>
                    <td>${prospecto.celular}</td>
                    <td class="col-hide-mobile">${nombreAgente}</td>
                    <td class="col-hide-mobile">${Utils.formatDate(prospecto.fecha)}</td>
                    <td>
                        <span class="badge ${badgeClass}">${estadoInfo.estado.charAt(0).toUpperCase() + estadoInfo.estado.slice(1)}</span>
                        <div class="mobile-secondary-info">
                            <span class="mobile-seguimiento">
                                <i class="fas fa-chart-line"></i> 
                                <span class="badge ${seguimientoBadgeClass}">${prospecto.seguimiento || 'Tibio'}</span>
                            </span>
                        </div>
                    </td>
                    <td class="col-hide-mobile">
                        <span class="badge ${seguimientoBadgeClass}">${prospecto.seguimiento || 'Tibio'}</span>
                    </td>
                    <td class="actions-column">
                        <div class="actions-dropdown">
                            <button class="actions-toggle">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                            <div class="actions-menu">
                                ${!esAdmin && !estaExpirado ? `
                                <button class="action-item" data-action="editar" data-id="${prospecto.id}">
                                    <i class="fas fa-edit"></i>
                                    Editar
                                </button>
                                ` : ''}
                                
                                ${esAdmin ? `
                                <button class="action-item" data-action="cambiar-agente" data-id="${prospecto.id}">
                                    <i class="fas fa-user-edit"></i>
                                    Cambiar Agente
                                </button>
                                ` : ''}

                                ${!esAdmin ? `
                                <button class="action-item" data-action="seguimiento" data-id="${prospecto.id}">
                                    <i class="fas fa-chart-line"></i>
                                    Cambiar Seguimiento
                                </button>
                                ` : ''}
                                
                                ${!esAdmin && esAntiguo ? `
                                <button class="action-item" data-action="prorroga" data-id="${prospecto.id}">
                                    <i class="fas fa-clock"></i>
                                    Prórroga
                                </button>
                                ` : ''}
                                
                                ${!esAdmin && !estaExpirado ? `
                                <button class="action-item" data-action="registrar" data-id="${prospecto.id}">
                                    <i class="fas fa-user-check"></i>
                                    Registrar
                                </button>
                                ` : ''}
                                
                                <button class="action-item" data-action="ver-detalles" data-id="${prospecto.id}">
                                    <i class="fas fa-eye"></i>
                                    Ver Detalles
                                </button>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        this.setupActionListeners();
    }

    setupActionListeners() {
        const tbody = document.getElementById('prospectosTableBody');
        if (!tbody) return;

        tbody.addEventListener('click', (e) => {
            const actionItem = e.target.closest('.action-item');
            if (!actionItem) return;

            const action = actionItem.getAttribute('data-action');
            const prospectoId = actionItem.getAttribute('data-id');

            switch (action) {
                case 'editar':
                    this.editarProspecto(prospectoId);
                    break;
                case 'cambiar-agente':
                    this.cambiarAgente(prospectoId);
                    break;
                case 'prorroga':
                    this.solicitarProrroga(prospectoId);
                    break;
                case 'registrar':
                    this.registrarProspecto(prospectoId);
                    break;
                case 'seguimiento':
                    this.mostrarModalSeguimiento(prospectoId);
                    break;
                case 'ver-detalles':
                    this.verDetalles(prospectoId);
                    break;
            }

            const dropdown = actionItem.closest('.actions-dropdown');
            if (dropdown) {
                dropdown.classList.remove('show');
            }
        });
    }

    mostrarModalCrear() {
        document.getElementById('modalProspectoTitulo').textContent = 'Crear Prospecto';
        document.getElementById('prospectoId').value = '';
        document.getElementById('formProspecto').reset();
        
        UI.showModal('modalProspecto');
    }

    editarProspecto(prospectoId) {
        const prospecto = this.datos.find(p => p.id === prospectoId);
        if (!prospecto) {
            UI.showAlert('Prospecto no encontrado', 'error');
            return;
        }

        document.getElementById('modalProspectoTitulo').textContent = 'Editar Prospecto';
        document.getElementById('prospectoId').value = prospecto.id;
        document.getElementById('prospectoNombre').value = prospecto.nombre || '';
        document.getElementById('prospectoApellido').value = prospecto.apellido || '';
        document.getElementById('prospectoCelular').value = prospecto.celular || '';
        
        UI.showModal('modalProspecto');
    }

    async guardarProspecto() {
        const form = document.getElementById('formProspecto');
        const button = document.getElementById('btnGuardarProspecto');
        
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const prospectoId = document.getElementById('prospectoId').value;
        const nombre = document.getElementById('prospectoNombre').value.trim();
        const apellido = document.getElementById('prospectoApellido').value.trim();
        const celular = document.getElementById('prospectoCelular').value.trim();
        const agenteId = 1;

        try {
            UI.setButtonLoading(button, true, 'Guardando...');

            let result;
            if (prospectoId) {
                result = await this.app.api.put(`/prospectos/${prospectoId}`, {
                    nombre,
                    apellido,
                    celular,
                    agenteId
                });
            } else {
                result = await this.app.api.post('/prospectos', {
                    nombre,
                    apellido,
                    celular,
                    agenteId
                });
            }

            UI.showAlert(result?.message || 'Prospecto guardado correctamente', 'success');
            UI.closeModal('modalProspecto');

            await this.loadData();
            this.renderTable();

        } catch (error) {
            console.error('Error guardando prospecto:', error);
            UI.showAlert(error.message, 'error');
        } finally {
            UI.setButtonLoading(button, false);
        }
    }

    solicitarProrroga(prospectoId) {
        const prospecto = this.datos.find(p => p.id === prospectoId);
        if (!prospecto) {
            UI.showAlert('Prospecto no encontrado', 'error');
            return;
        }

        document.getElementById('prorrogaProspectoId').value = prospectoId;
        document.getElementById('prorrogaFecha').value = prospecto.fecha;
        document.getElementById('prorrogaMotivo').value = '';
        document.getElementById('prorrogaImagenUrl').value = '';
        
        UI.showModal('modalProrroga');
    }

    async guardarProrroga() {
        const prospectoId = document.getElementById('prorrogaProspectoId').value;
        const fecha = document.getElementById('prorrogaFecha').value;
        const motivo = document.getElementById('prorrogaMotivo').value.trim();
        const imagenUrl = document.getElementById('prorrogaImagenUrl').value.trim();
        const button = document.getElementById('btnGuardarProrroga');

        if (!motivo) {
            UI.showAlert('Debe ingresar el motivo de la prórroga', 'warning');
            return;
        }

        try {
            UI.setButtonLoading(button, true, 'Solicitando...');

            const result = await this.app.api.post('/prorrogas', {
                clienteId: prospectoId,
                descripcion: motivo,
                imagenUrl: imagenUrl || '',
                fechaLimite: fecha
            });

            UI.showAlert(result?.message || 'Prórroga solicitada correctamente', 'success');
            UI.closeModal('modalProrroga');

            await this.loadData();
            this.renderTable();

        } catch (error) {
            console.error('Error solicitando prórroga:', error);
            UI.showAlert(error.message, 'error');
        } finally {
            UI.setButtonLoading(button, false);
        }
    }

    registrarProspecto(prospectoId) {
        const prospecto = this.datos.find(p => p.id === prospectoId);
        if (!prospecto) {
            UI.showAlert('Prospecto no encontrado', 'error');
            return;
        }

        document.getElementById('registrarProspectoId').value = prospectoId;
        document.getElementById('registrarFechaFirma').value = new Date().toISOString().split('T')[0];
        
        this.cargarProyectosEnSelect();
        
        document.getElementById('registrarLote').value = '';
        document.getElementById('registrarManzano').value = '';
        document.getElementById('registrarMetodoPago').value = '';
        document.getElementById('registrarMonto').value = '';
        
        UI.showModal('modalRegistrar');
    }

    cargarProyectosEnSelect() {
        const selectProyecto = document.getElementById('registrarProyecto');
        const proyectos = this.app.getProyectos();
        
        selectProyecto.innerHTML = '<option value="">Seleccionar proyecto...</option>';
        
        if (proyectos && proyectos.length > 0) {
            proyectos.forEach(proyecto => {
                const option = document.createElement('option');
                option.value = proyecto.id;
                option.textContent = proyecto.nombre;
                selectProyecto.appendChild(option);
            });
        }
    }

    async guardarRegistro() {
        const prospectoId = document.getElementById('registrarProspectoId').value;
        const proyectoId = document.getElementById('registrarProyecto').value;
        const lote = document.getElementById('registrarLote').value;
        const manzano = document.getElementById('registrarManzano').value;
        const fechaFirma = document.getElementById('registrarFechaFirma').value;
        const metodoPago = document.getElementById('registrarMetodoPago').value;
        const monto = document.getElementById('registrarMonto').value;
        const button = document.getElementById('btnGuardarRegistro');

        if (!proyectoId || !lote || !manzano || !fechaFirma || !metodoPago || !monto) {
            UI.showAlert('Por favor complete todos los campos obligatorios', 'warning');
            return;
        }

        try {
            UI.setButtonLoading(button, true, 'Registrando...');

            const result = await this.app.api.post(`/prospectos/${prospectoId}/crear-contrato`, {
                proyecto: proyectoId,
                lote: parseInt(lote),
                manzano,
                fechaFirma,
                metodoPago,
                monto: parseFloat(monto)
            });

            UI.showAlert(result?.message || 'Prospecto registrado como cliente correctamente', 'success');
            UI.closeModal('modalRegistrar');

            await this.loadData();
            this.renderTable();

        } catch (error) {
            console.error('Error registrando prospecto:', error);
            UI.showAlert(error.message, 'error');
        } finally {
            UI.setButtonLoading(button, false);
        }
    }

    clearFilters() {
        this.filtros = {
            search: '',
            fechaInicio: '',
            fechaFin: '',
            estado: 'todos',
            seguimiento: 'todos',
            asesor: 'todos'
        };
        this.paginacion.paginaActual = 1;

        document.getElementById('prospectosSearch').value = '';

        this.renderTable();
        this.actualizarIndicadorFiltros();
        UI.showAlert('Filtros limpiados correctamente', 'success');
    }

    setupCambiarAgenteModal() {
        const guardarBtn = document.getElementById('btnGuardarCambioAgente');
        if (guardarBtn) {
            guardarBtn.addEventListener('click', async () => {
                await this.guardarCambioAgente();
            });
        }
    }

    async cambiarAgente(prospectoId) {
        const prospecto = this.datos.find(p => p.id === prospectoId);
        if (!prospecto) return;

        const agentes = this.app.getAgentes();

        const select = document.getElementById('selectNuevoAgente');
        select.innerHTML = '';
        
        agentes.forEach(agente => {
            const option = document.createElement('option');
            option.value = agente.id;
            option.textContent = `${agente.nombre} ${agente.apellido}`;
            if (agente.id === prospecto.agenteId) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        document.getElementById('prospectoIdCambio').value = prospectoId;
        UI.showModal('modalCambiarAgente');
    }

    async guardarCambioAgente() {
        const prospectoId = document.getElementById('prospectoIdCambio').value;
        const nuevoAgenteId = document.getElementById('selectNuevoAgente').value;
        const button = document.getElementById('btnGuardarCambioAgente');

        if (!nuevoAgenteId) {
            UI.showAlert('Debe seleccionar un agente', 'warning');
            return;
        }

        try {
            UI.setButtonLoading(button, true, 'Guardando...');

            await this.app.api.cambiarAgenteProspecto(prospectoId, nuevoAgenteId);
            
            UI.showAlert('Agente cambiado correctamente', 'success');
            UI.closeModal('modalCambiarAgente');
            
            await this.loadData();
            this.renderTable();

        } catch (error) {
            console.error('Error cambiando agente:', error);
            UI.showAlert(error.message, 'error');
        } finally {
            UI.setButtonLoading(button, false);
        }
    }

    verDetalles(prospectoId) {
        const prospecto = this.datos.find(p => p.id === prospectoId);
        if (!prospecto) return;

        const agentes = this.app.getAgentes();
        const agente = agentes.find(u => u.id === prospecto.agenteId);
        const estadoInfo = this.calcularEstadoProspecto(prospecto.fecha);
        const badgeClass = Utils.getBadgeClass(estadoInfo.estado);

        Swal.fire({
            title: `${prospecto.nombre} ${prospecto.apellido}`,
            html: `
                <div class="prospecto-details">
                    <div class="detail-item">
                        <strong class="detail-label">Celular:</strong>
                        <span class="detail-value">${prospecto.celular}</span>
                    </div>
                    <div class="detail-item">
                        <strong class="detail-label">Asesor:</strong>
                        <span class="detail-value">${agente ? `${agente.nombre} ${agente.apellido}` : 'N/A'}</span>
                    </div>
                    <div class="detail-item">
                        <strong class="detail-label">Fecha de registro:</strong>
                        <span class="detail-value">${Utils.formatDate(prospecto.fecha)}</span>
                    </div>
                    <div class="detail-item">
                        <strong class="detail-label">Estado:</strong>
                        <span class="detail-value">
                            <span class="badge ${badgeClass}">${estadoInfo.estado.charAt(0).toUpperCase() + estadoInfo.estado.slice(1)}</span>
                        </span>
                    </div>
                    <div class="detail-item">
                        <strong class="detail-label">Días transcurridos:</strong>
                        <span class="detail-value">${estadoInfo.dias} días</span>
                    </div>
                </div>
            `,
            icon: 'info',
            confirmButtonText: 'Cerrar',
            customClass: {
                popup: 'custom-swal-popup',
                htmlContainer: 'custom-swal-html'
            }
        });
    }

    exportData() {
        const datosFiltrados = this.aplicarFiltros();

        if (datosFiltrados.length === 0) {
            UI.showAlert('No hay datos para exportar', 'warning');
            return;
        }

        const agentes = this.app.getAgentes();

        const data = datosFiltrados.map(prospecto => {
            const agente = agentes.find(u => u.id === prospecto.agenteId);
            const estadoInfo = this.calcularEstadoProspecto(prospecto.fecha);

            return [
                `${prospecto.nombre} ${prospecto.apellido}`,
                prospecto.celular,
                agente ? `${agente.nombre} ${agente.apellido}` : 'N/A',
                Utils.formatDate(prospecto.fecha) || '-',
                estadoInfo.estado.charAt(0).toUpperCase() + estadoInfo.estado.slice(1),
                prospecto.seguimiento || 'Tibio',
                estadoInfo.dias
            ];
        });

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF("landscape");

        doc.setFontSize(16);
        doc.text("Reporte de Prospectos", 14, 20);

        const hoy = new Date();
        const fechaGeneracion = hoy.toLocaleDateString('es-BO');
        doc.setFontSize(10);
        doc.text(`Generado: ${fechaGeneracion}`, 14, 28);

        const filtrosTexto = [];
        if (this.filtros.fechaInicio || this.filtros.fechaFin) {
            filtrosTexto.push(`Fechas: ${this.filtros.fechaInicio || '-'} a ${this.filtros.fechaFin || '-'}`);
        }
        if (this.filtros.estado !== 'todos') {
            filtrosTexto.push(`Estado: ${this.filtros.estado.charAt(0).toUpperCase() + this.filtros.estado.slice(1)}`);
        }
        if (this.filtros.seguimiento !== 'todos') {
            filtrosTexto.push(`Seguimiento: ${this.filtros.seguimiento}`);
        }
        if (this.filtros.asesor !== 'todos') {
            const agente = agentes.find(u => u.id === this.filtros.asesor);
            filtrosTexto.push(`Asesor: ${agente ? `${agente.nombre} ${agente.apellido}` : 'N/A'}`);
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
            head: [["Nombre", "Celular", "Asesor", "Fecha Registro", "Estado", "Seguimiento", "Días"]],
            body: data,
            startY: filtrosTexto.length > 0 ? 38 : 35,
            styles: { fontSize: 8 }
        });

        const nombreArchivo = `reporte_prospectos_${hoy.getFullYear()}-${hoy.getMonth()+1}-${hoy.getDate()}.pdf`;
        doc.save(nombreArchivo);

        UI.showAlert('PDF generado correctamente', 'success');
    }


    // Método para obtener la clase CSS del seguimiento
    getSeguimientoBadgeClass(seguimiento) {
        const classes = {
            'Caliente': 'status-caliente',
            'Tibio': 'status-tibio',
            'Frio': 'status-frio'
        };
        return classes[seguimiento] || 'status-tibio';
    }

    // Método para mostrar modal de seguimiento
    mostrarModalSeguimiento(prospectoId) {
        const prospecto = this.datos.find(p => p.id === prospectoId);
        if (!prospecto) {
            UI.showAlert('Prospecto no encontrado', 'error');
            return;
        }

        document.getElementById('seguimientoProspectoId').value = prospectoId;
        document.getElementById('selectSeguimiento').value = prospecto.seguimiento || 'Tibio';
        
        UI.showModal('modalSeguimiento');
    }

    // Método para guardar el seguimiento
    async guardarSeguimiento() {
        const prospectoId = document.getElementById('seguimientoProspectoId').value;
        const seguimiento = document.getElementById('selectSeguimiento').value;
        const button = document.getElementById('btnGuardarSeguimiento');

        if (!seguimiento) {
            UI.showAlert('Debe seleccionar un estado de seguimiento', 'warning');
            return;
        }

        try {
            UI.setButtonLoading(button, true, 'Guardando...');

            const result = await this.app.api.cambiarSeguimientoProspecto(prospectoId, seguimiento);

            UI.showAlert(result.message || `Seguimiento actualizado a "${seguimiento}"`, 'success');
            UI.closeModal('modalSeguimiento');
            
            // Recargar datos desde el backend para asegurar consistencia
            await this.loadData();
            this.renderTable();
        } catch (error) {
            console.error('Error guardando seguimiento:', error);
            UI.showAlert(error.message, 'error');
        } finally {
            UI.setButtonLoading(button, false);
        }
    }

    getTitle() {
        return 'Gestión de Prospectos';
    }

    cleanup() {
        this.eventListenersSetup = false;

        if (this.pagination) {
            this.pagination.destroy();
            this.pagination = null;
        }
    }
}

let prospectosModule;