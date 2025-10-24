// js/modules/contratos.js - VERSIÓN CORREGIDA CON ESTRUCTURA IDÉNTICA
class Contratos {
    constructor(app) {
        this.app = app;
        this.datos = [];
        this.contratosOriginales = []; // Guardamos los datos originales
        this.filtros = {
            search: '',
            equipo: 'todos',
            asesor: 'todos',
            metodoPago: 'todos',
            proyecto: 'todos',
            tipo: 'todos',
            amurallado: 'todos',
            fechaInicio: '',
            fechaFin: ''
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
            document.getElementById('contratofiltroAgenteGroup').style.display = 'block';
        }        

        this.contratosOriginales = this.app.getContratos();
        this.procesarContratos();
        this.setupEventListeners();
        await this.renderTable();
    }

    async loadData() {
        try {
            UI.showLoading(document.getElementById('contratosTab'));
            await this.app.refreshGlobalData("estadisticas-contratos");
            this.contratosOriginales = this.app.getContratos();
            this.procesarContratos();
            UI.hideLoading(document.getElementById('contratosTab'));
        } catch (error) {
            console.error('Error loading contratos:', error);
            UI.showAlert('Error al cargar los contratos', 'error');
            UI.hideLoading(document.getElementById('contratosTab'));
        }
    }

    procesarContratos() {
        const proyectos = this.app.getProyectos();
        const agentes = this.app.getAgentes();
        const equipos = this.app.getEquipos();
        const clientes = this.app.getProspectos();

        this.datos = this.contratosOriginales.map(contrato => {
            const proyecto = proyectos.find(p => p.id === contrato.proyectoId);
            const agente = agentes.find(a => a.id === contrato.asesorId);
            const equipoObj = equipos.find(e => e.id === contrato.equipoId);
            const cliente = clientes.find(c => c.id === contrato.clienteId);

            return {
                id: contrato.id,
                proyectoId: contrato.proyectoId,
                proyecto: proyecto ? proyecto.nombre : 'N/A',
                manzano: contrato.manzano || 'N/A',
                nroTerreno: contrato.nroTerreno || 'N/A',
                clienteId: contrato.clienteId,
                cliente: cliente ? `${cliente.nombre} ${cliente.apellido}` : 'N/A',
                asesorId: contrato.asesorId,
                asesor: agente ? `${agente.nombre} ${agente.apellido}` : 'N/A',
                equipoId: contrato.equipoId,
                equipo: equipoObj ? equipoObj.nombre : 'Sin equipo',
                tipo: contrato.tipo || 'N/A',
                metodoPago: contrato.metodoPago || 'N/A',
                monto: contrato.monto || 0,
                fechaFirma: Utils.formatDate(contrato.fechaFirma), // Para mostrar
                fechaFirmaOriginal: contrato.fechaFirma, // Para filtrar
                amurallado: contrato.Amurallado || false
            };
        });
    }

    setupEventListeners() {
        if (this.eventListenersSetup) return;
        this.eventListenersSetup = true;

        // Búsqueda
        const searchInput = document.getElementById('contratosSearch');
        if (searchInput && !searchInput.hasListener) {
            searchInput.hasListener = true;
            searchInput.addEventListener('input', Utils.debounce((e) => {
                this.filtros.search = e.target.value;
                this.paginacion.paginaActual = 1;
                this.renderTable();
            }, 300));
        }

        // Botón Voltear lista
        const btnVoltear = document.getElementById('btnVoltearContratos');
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
        const btnFiltros = document.getElementById('btnFiltrosContratos');
        if (btnFiltros && !btnFiltros.hasListener) {
            btnFiltros.hasListener = true;
            btnFiltros.addEventListener('click', () => {
                this.mostrarModalFiltros();
            });
        }

        // Aplicar filtros desde el modal
        const btnAplicarFiltros = document.getElementById('btnAplicarFiltrosContratos');
        if (btnAplicarFiltros && !btnAplicarFiltros.hasListener) {
            btnAplicarFiltros.hasListener = true;
            btnAplicarFiltros.addEventListener('click', () => {
                this.aplicarFiltrosDesdeModal();
            });
        }

        // Limpiar filtros desde el modal
        const btnLimpiarFiltros = document.getElementById('btnLimpiarFiltrosContratos');
        if (btnLimpiarFiltros && !btnLimpiarFiltros.hasListener) {
            btnLimpiarFiltros.hasListener = true;
            btnLimpiarFiltros.addEventListener('click', () => {
                this.limpiarFiltrosDesdeModal();
            });
        }

        // Exportar
        const exportBtn = document.getElementById('exportContratos');
        if (exportBtn && !exportBtn.hasListener) {
            exportBtn.hasListener = true;
            exportBtn.addEventListener('click', () => {
                this.exportData();
            });
        }

        // EVENT LISTENER GLOBAL PARA PAGINACIÓN (igual que clientes)
        document.addEventListener('click', (e) => {
            // Botón Anterior
            if (e.target.closest('#prevPageContratos')) {
                e.preventDefault();
                if (this.paginacion.paginaActual > 1) {
                    this.paginacion.paginaActual--;
                    this.renderTable();
                }
            }
            // Botón Siguiente
            else if (e.target.closest('#nextPageContratos')) {
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
            this.pagination = initPagination('contratosPagination', {
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
        UI.showModal('modalFiltrosContratos');
    }

    cargarOpcionesEnModal() {
        const proyectos = this.app.getProyectos();
        const agentes = this.app.getAgentes();
        const equipos = this.app.getEquipos();

        // Proyectos
        const selectProyecto = document.getElementById('filtroProyectoContratos');
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
        const selectAsesor = document.getElementById('filtroAsesorContratos');
        if (selectAsesor) {
            selectAsesor.innerHTML = '<option value="todos">Todos los asesores</option>';
            agentes.forEach(agente => {
                const option = document.createElement('option');
                option.value = agente.id;
                option.textContent = `${agente.nombre} ${agente.apellido}`;
                selectAsesor.appendChild(option);
            });
        }

        // Equipos
        const selectEquipo = document.getElementById('filtroEquipoContratos');
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
        document.getElementById('fechaInicioContratos').value = this.filtros.fechaInicio;
        document.getElementById('fechaFinContratos').value = this.filtros.fechaFin;
        document.getElementById('filtroProyectoContratos').value = this.filtros.proyecto;
        document.getElementById('filtroAsesorContratos').value = this.filtros.asesor;
        document.getElementById('filtroEquipoContratos').value = this.filtros.equipo;
        document.getElementById('filtroMetodoPagoContratos').value = this.filtros.metodoPago;
        document.getElementById('filtroTipoContratos').value = this.filtros.tipo;
        document.getElementById('filtroAmuralladoContratos').value = this.filtros.amurallado;
    }

    aplicarFiltrosDesdeModal() {
        this.filtros.fechaInicio = document.getElementById('fechaInicioContratos').value;
        this.filtros.fechaFin = document.getElementById('fechaFinContratos').value;
        this.filtros.proyecto = document.getElementById('filtroProyectoContratos').value;
        this.filtros.asesor = document.getElementById('filtroAsesorContratos').value;
        this.filtros.equipo = document.getElementById('filtroEquipoContratos').value;
        this.filtros.metodoPago = document.getElementById('filtroMetodoPagoContratos').value;
        this.filtros.tipo = document.getElementById('filtroTipoContratos').value;
        this.filtros.amurallado = document.getElementById('filtroAmuralladoContratos').value;
        
        this.paginacion.paginaActual = 1;
        
        UI.closeModal('modalFiltrosContratos');
        this.renderTable();
        this.actualizarIndicadorFiltros();
        UI.showAlert('Filtros aplicados correctamente', 'success');
    }

    limpiarFiltrosDesdeModal() {
        document.getElementById('fechaInicioContratos').value = '';
        document.getElementById('fechaFinContratos').value = '';
        document.getElementById('filtroProyectoContratos').value = 'todos';
        document.getElementById('filtroAsesorContratos').value = 'todos';
        document.getElementById('filtroEquipoContratos').value = 'todos';
        document.getElementById('filtroMetodoPagoContratos').value = 'todos';
        document.getElementById('filtroTipoContratos').value = 'todos';
        document.getElementById('filtroAmuralladoContratos').value = 'todos';
        
        UI.closeModal('modalFiltrosContratos');
        this.clearFilters();
    }

    mostrarFiltrosActivos() {
        const container = document.getElementById('filtrosAplicadosContainerContratos');
        const content = document.getElementById('filtrosAplicadosContratos');
        
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

        if (this.filtros.asesor !== 'todos') {
            const agente = agentes.find(a => a.id === this.filtros.asesor);
            const textoAsesor = agente ? `${agente.nombre} ${agente.apellido}` : 'Asesor';
            filtrosActivos.push({ tipo: 'asesor', texto: textoAsesor });
        }
        
        if (this.filtros.equipo !== 'todos') {
            const equipo = equipos.find(e => e.id === this.filtros.equipo);
            const textoEquipo = equipo ? equipo.nombre : 'Equipo';
            filtrosActivos.push({ tipo: 'equipo', texto: textoEquipo });
        }
        
        if (this.filtros.metodoPago !== 'todos') {
            filtrosActivos.push({ tipo: 'metodoPago', texto: `Método: ${this.filtros.metodoPago}` });
        }
        
        if (this.filtros.tipo !== 'todos') {
            filtrosActivos.push({ tipo: 'tipo', texto: `Tipo: ${this.filtros.tipo}` });
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
            case 'asesor':
                this.filtros.asesor = 'todos';
                break;
            case 'equipo':
                this.filtros.equipo = 'todos';
                break;
            case 'metodoPago':
                this.filtros.metodoPago = 'todos';
                break;
            case 'tipo':
                this.filtros.tipo = 'todos';
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
        document.getElementById('fechaInicioContratos').value = this.filtros.fechaInicio;
        document.getElementById('fechaFinContratos').value = this.filtros.fechaFin;
        document.getElementById('filtroProyectoContratos').value = this.filtros.proyecto;
        document.getElementById('filtroAsesorContratos').value = this.filtros.asesor;
        document.getElementById('filtroEquipoContratos').value = this.filtros.equipo;
        document.getElementById('filtroMetodoPagoContratos').value = this.filtros.metodoPago;
        document.getElementById('filtroTipoContratos').value = this.filtros.tipo;
        document.getElementById('filtroAmuralladoContratos').value = this.filtros.amurallado;
    }

    actualizarIndicadorFiltros() {
        const btnFiltros = document.getElementById('btnFiltrosContratos');
        if (!btnFiltros) return;
        
        const tieneFiltros = Object.values(this.filtros).some(valor => 
            valor !== '' && valor !== 'todos'
        );
        
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
                'cliente', 'nroTerreno', 'manzano', 'proyecto', 'asesor', 'equipo'
            ]);
        }

        // Filtros por IDs (igual que clientes)
        if (this.filtros.proyecto !== 'todos') {
            datosFiltrados = datosFiltrados.filter(contrato => 
                contrato.proyectoId === this.filtros.proyecto
            );
        }

        if (this.filtros.asesor !== 'todos') {
            datosFiltrados = datosFiltrados.filter(contrato => 
                contrato.asesorId === this.filtros.asesor
            );
        }

        if (this.filtros.equipo !== 'todos') {
            datosFiltrados = datosFiltrados.filter(contrato => 
                contrato.equipoId === this.filtros.equipo
            );
        }

        // Filtros por valores directos
        if (this.filtros.metodoPago !== 'todos') {
            datosFiltrados = datosFiltrados.filter(contrato => 
                contrato.metodoPago === this.filtros.metodoPago
            );
        }

        if (this.filtros.tipo !== 'todos') {
            datosFiltrados = datosFiltrados.filter(contrato => 
                contrato.tipo === this.filtros.tipo
            );
        }

        if (this.filtros.amurallado !== 'todos') {
            datosFiltrados = datosFiltrados.filter(contrato => 
                this.filtros.amurallado === 'amurallado' ? contrato.amurallado : !contrato.amurallado
            );
        }

        // CORRECCIÓN: Filtro por fechas usando la fecha original
        if (this.filtros.fechaInicio || this.filtros.fechaFin) {
            datosFiltrados = Utils.filtrarPorFechas(
                datosFiltrados, 
                this.filtros.fechaInicio, 
                this.filtros.fechaFin, 
                'fechaFirmaOriginal' // Usar la fecha original para filtrar
            );
        }

        return datosFiltrados;
    }

    renderTable() {
        const tbody = document.getElementById('contratosTableBody');
        const table = document.getElementById('contratosTable');
        
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
                    <td colspan="10" class="table-empty">
                        <i class="fas fa-file-contract"></i>
                        <h3>No se encontraron contratos</h3>
                        <p>No hay contratos que coincidan con los filtros aplicados.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = paginado.datos.map(contrato => {
            const montoFormateado = contrato.monto ? `Bs ${parseFloat(contrato.monto).toLocaleString('es-BO')}` : 'N/A';
            // Usar la fecha formateada para mostrar
            const fechaFirma = contrato.fechaFirma;
            const amuralladoBadge = contrato.amurallado ? 
                '<span class="badge badge-success">Amurallado</span>' : 
                '<span class="badge badge-warning">No Amurallado</span>';

            // Determinar la clase CSS según el tipo
            let tipoClass = '';
            if (contrato.tipo === 'Terreno') {
                tipoClass = 'fila-borde-verde';
            } else if (contrato.tipo === 'Muralla') {
                tipoClass = 'fila-borde-ladrillo';
            }

            return `
                <tr class="${tipoClass}">
                    <td>
                        <div class="mobile-cell-content">
                            <div class="main-info">${contrato.proyecto}</div>
                            <div class="mobile-secondary-info">
                                <span class="mobile-extra"><div class="lote-detail"><strong>Mz:</strong> ${contrato.manzano}</div></span>
                                <span class="mobile-extra"><div class="lote-detail"><strong>Lt:</strong> ${contrato.nroTerreno}</div></span>
                            </div>
                        </div>
                    </td>
                    <td class="col-hide-mobile">
                        <div class="lote-info">
                            <div class="lote-detail"><strong>Mz:</strong> ${contrato.manzano}</div>
                            <div class="lote-detail"><strong>Lt:</strong> ${contrato.nroTerreno}</div>
                        </div>
                    </td>
                    <td>${contrato.cliente}</td>
                    <td class="col-hide-mobile">${contrato.asesor}</td>
                    <td class="col-hide-mobile">${contrato.equipo}</td>
                    <td class="col-hide-mobile">${contrato.metodoPago}</td>
                    <td>${montoFormateado}</td>
                    <td class="col-hide-mobile">${fechaFirma}</td>
                    <td style="display:none;" class="col-hide-mobile">${amuralladoBadge}</td>
                    <td class="actions-column">
                        <div class="actions-dropdown">
                            <button class="actions-toggle">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                            <div class="actions-menu">
                                <button class="action-item" data-action="ver-detalles" data-id="${contrato.id}">
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


    actualizarEstadoBotonesPaginacion(totalItems) {
        const prevBtn = document.getElementById('prevPageContratos');
        const nextBtn = document.getElementById('nextPageContratos');
        const totalPages = Math.ceil(totalItems / this.paginacion.porPagina);

        if (prevBtn) {
            prevBtn.disabled = this.paginacion.paginaActual === 1;
        }
        if (nextBtn) {
            nextBtn.disabled = this.paginacion.paginaActual === totalPages;
        }
    }

    setupActionListeners() {
        const tbody = document.getElementById('contratosTableBody');
        if (!tbody) return;

        tbody.addEventListener('click', (e) => {
            const actionItem = e.target.closest('.action-item');
            if (!actionItem) return;

            const action = actionItem.getAttribute('data-action');
            const contratoId = actionItem.getAttribute('data-id');

            switch (action) {
                case 'ver-detalles':
                    this.verDetallesContrato(contratoId);
                    break;
            }

            const dropdown = actionItem.closest('.actions-dropdown');
            if (dropdown) {
                dropdown.classList.remove('show');
            }
        });
    }

    verDetallesContrato(contratoId) {
        const contrato = this.datos.find(c => c.id === contratoId);
        if (!contrato) {
            UI.showAlert('Contrato no encontrado', 'error');
            return;
        }

        const montoFormateado = contrato.monto ? `Bs ${parseFloat(contrato.monto).toLocaleString('es-BO')}` : 'N/A';
        // Usar la fecha formateada para mostrar
        const fechaFirma = contrato.fechaFirma;
        const amuralladoTexto = contrato.amurallado ? 'Amurallado' : 'No Amurallado';

        // Determinar color del tipo
        const tipoColor = contrato.tipo === 'Terreno' ? 'text-success' : contrato.tipo === 'Muralla' ? 'text-danger' : 'text-muted';

        document.getElementById('modalDetallesContratoTitulo').textContent = `Contrato - ${contrato.proyecto}`;
        document.getElementById('detalleProyecto').textContent = contrato.proyecto;
        document.getElementById('detalleManzano').textContent = contrato.manzano;
        document.getElementById('detalleLote').textContent = contrato.nroTerreno;
        document.getElementById('detalleTipo').innerHTML = `<span class="${tipoColor}">${contrato.tipo}</span>`;
        document.getElementById('detalleCliente').textContent = contrato.cliente;
        document.getElementById('detalleAsesor').textContent = contrato.asesor;
        document.getElementById('detalleEquipo').textContent = contrato.equipo;
        document.getElementById('detalleFechaFirma').textContent = fechaFirma;
        document.getElementById('detalleMetodoPago').textContent = contrato.metodoPago;
        document.getElementById('detalleMonto').textContent = montoFormateado;
        document.getElementById('detalleEstado').innerHTML = contrato.amurallado ? 
            '<span class="badge badge-success">Amurallado</span>' : 
            '<span class="badge badge-warning">No Amurallado</span>';

        // Mostrar el modal
        UI.showModal('modalDetallesContrato');
    }


    clearFilters() {
        this.filtros = {
            search: '',
            equipo: 'todos',
            asesor: 'todos',
            metodoPago: 'todos',
            proyecto: 'todos',
            tipo: 'todos',
            amurallado: 'todos',
            fechaInicio: '',
            fechaFin: ''
        };
        this.paginacion.paginaActual = 1;

        document.getElementById('contratosSearch').value = '';

        this.renderTable();
        this.actualizarIndicadorFiltros();
        UI.showAlert('Filtros limpiados correctamente', 'success');
    }

    exportData() {
        const datosFiltrados = this.aplicarFiltros();

        if (datosFiltrados.length === 0) {
            UI.showAlert('No hay datos para exportar', 'warning');
            return;
        }

        const data = datosFiltrados.map(contrato => {
            // Usar la fecha formateada para exportar
            const fechaFirma = contrato.fechaFirma;
            const montoFormateado = contrato.monto ? `Bs ${parseFloat(contrato.monto).toLocaleString('es-BO')}` : 'N/A';
            const amurallado = contrato.amurallado ? 'Amurallado' : 'No Amurallado';

            return [
                contrato.proyecto,
                `Mz: ${contrato.manzano}, Lt: ${contrato.nroTerreno}`,
                contrato.cliente,
                contrato.asesor,
                contrato.equipo,
                contrato.tipo,
                contrato.metodoPago,
                montoFormateado,
                amurallado,
                fechaFirma
            ];
        });

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF("landscape");

        doc.setFontSize(16);
        doc.text("Reporte de Contratos", 14, 20);

        const hoy = new Date();
        const fechaGeneracion = hoy.toLocaleDateString('es-BO');
        doc.setFontSize(10);
        doc.text(`Generado: ${fechaGeneracion}`, 14, 28);

        const filtrosTexto = [];
        if (this.filtros.equipo !== 'todos') {
            const equipos = this.app.getEquipos();
            const equipo = equipos.find(e => e.id === this.filtros.equipo);
            filtrosTexto.push(`Equipo: ${equipo ? equipo.nombre : 'N/A'}`);
        }
        if (this.filtros.asesor !== 'todos') {
            const agentes = this.app.getAgentes();
            const agente = agentes.find(a => a.id === this.filtros.asesor);
            filtrosTexto.push(`Asesor: ${agente ? `${agente.nombre} ${agente.apellido}` : 'N/A'}`);
        }
        if (this.filtros.metodoPago !== 'todos') filtrosTexto.push(`Método: ${this.filtros.metodoPago}`);
        if (this.filtros.proyecto !== 'todos') {
            const proyectoNombre = this.getProyectoNombre(this.filtros.proyecto);
            filtrosTexto.push(`Proyecto: ${proyectoNombre}`);
        }
        if (this.filtros.tipo !== 'todos') filtrosTexto.push(`Tipo: ${this.filtros.tipo}`);
        if (this.filtros.amurallado !== 'todos') {
            filtrosTexto.push(this.filtros.amurallado === 'amurallado' ? 'Amurallados' : 'No Amurallados');
        }
        if (this.filtros.fechaInicio || this.filtros.fechaFin) {
            filtrosTexto.push(`Fechas: ${this.filtros.fechaInicio || 'Inicio'} - ${this.filtros.fechaFin || 'Fin'}`);
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
            head: [["Proyecto", "Lote", "Cliente", "Asesor", "Equipo", "Tipo", "Método Pago", "Monto", "Amurallado", "Fecha Firma"]],
            body: data,
            startY: filtrosTexto.length > 0 ? 38 : 35,
            styles: { fontSize: 7 }
        });

        const nombreArchivo = `reporte_contratos_${hoy.getFullYear()}-${hoy.getMonth()+1}-${hoy.getDate()}.pdf`;
        doc.save(nombreArchivo);

        UI.showAlert('PDF generado correctamente', 'success');
    }

    getProyectoNombre(proyectoId) {
        const proyectos = this.app.getProyectos();
        const proyecto = proyectos.find(p => p.id === proyectoId);
        return proyecto ? proyecto.nombre : 'N/A';
    }

    getTitle() {
        return 'Gestión de Contratos';
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

let contratosModule;