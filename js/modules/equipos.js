class Equipos {
    constructor(app) {
        this.app = app;
        this.datos = [];
        this.equiposOriginales = [];
        this.filtros = {
            search: ''
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

    async init() {
        this.equiposOriginales = this.app.getEquipos();
        this.datos = [...this.equiposOriginales];
        this.setupEventListeners();
        await this.renderTable();
    }

    async loadData() {
        try {
            UI.showLoading(document.getElementById('equiposTab'));
            await this.app.refreshGlobalData("equipos");
            this.equiposOriginales = this.app.getEquipos();
            this.datos = [...this.equiposOriginales];
            UI.hideLoading(document.getElementById('equiposTab'));
        } catch (error) {
            console.error('Error loading equipos:', error);
            UI.showAlert('Error al cargar los equipos', 'error');
            UI.hideLoading(document.getElementById('equiposTab'));
        }
    }

    // MÉTODO CORREGIDO: Obtener miembros como array
    obtenerMiembrosArray(equipo) {
        if (!equipo.miembros) return [];
        
        if (Array.isArray(equipo.miembros)) {
            return equipo.miembros;
        }
        
        if (typeof equipo.miembros === 'string') {
            return equipo.miembros.split(',').filter(id => id.trim() !== '');
        }
        
        return [];
    }

    // MÉTODO CORREGIDO: Obtener nombres de miembros
    obtenerNombresMiembros(equipo) {
        const miembrosArray = this.obtenerMiembrosArray(equipo);
        const agentes = this.app.getAgentes();
        
        return miembrosArray.map(miembroId => {
            const agente = agentes.find(a => a.id === miembroId);
            return agente ? `${agente.nombre} ${agente.apellido}` : 'Agente no encontrado';
        }).join(', ');
    }

    setupEventListeners() {
        if (this.eventListenersSetup) return;
        this.eventListenersSetup = true;

        // Búsqueda
        const searchInput = document.getElementById('equiposSearch');
        if (searchInput && !searchInput.hasListener) {
            searchInput.hasListener = true;
            searchInput.addEventListener('input', Utils.debounce((e) => {
                this.filtros.search = e.target.value;
                this.paginacion.paginaActual = 1;
                this.renderTable();
            }, 300));
        }

        // Botón Voltear lista
        const btnVoltear = document.getElementById('btnVoltearEquipos');
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

        // Botón Crear Equipo
        const btnCrearEquipo = document.getElementById('btnCrearEquipo');
        if (btnCrearEquipo && !btnCrearEquipo.hasListener) {
            btnCrearEquipo.hasListener = true;
            btnCrearEquipo.addEventListener('click', () => {
                this.mostrarModalCrearEquipo();
            });
        }

        // Exportar
        const exportBtn = document.getElementById('exportEquipos');
        if (exportBtn && !exportBtn.hasListener) {
            exportBtn.hasListener = true;
            exportBtn.addEventListener('click', () => {
                this.exportData();
            });
        }

        // EVENT LISTENER GLOBAL PARA PAGINACIÓN
        document.addEventListener('click', (e) => {
            // Botón Anterior
            if (e.target.closest('#prevPageEquipos')) {
                e.preventDefault();
                if (this.paginacion.paginaActual > 1) {
                    this.paginacion.paginaActual--;
                    this.renderTable();
                }
            }
            // Botón Siguiente
            else if (e.target.closest('#nextPageEquipos')) {
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
            this.pagination = initPagination('equiposPagination', {
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
    }

    mostrarModalCrearEquipo() {
        this.cargarAgentesEnModal();
        document.getElementById('equipoNombre').value = '';
        document.getElementById('equipoMiembros').innerHTML = '';
        UI.showModal('modalCrearEquipo');
    }

    cargarAgentesEnModal() {
        const agentes = this.app.getAgentes();
        const container = document.getElementById('agentesDisponibles');
        
        if (!container) return;

        container.innerHTML = agentes.map(agente => `
            <div class="agente-checkbox-item">
                <label class="checkbox-label">
                    <input type="checkbox" value="${agente.id}" class="agente-checkbox">
                    <span class="checkmark"></span>
                    <span class="agente-info">
                        <strong>${agente.nombre} ${agente.apellido}</strong>
                        <small>${agente.telefono || 'Sin teléfono'}</small>
                    </span>
                </label>
            </div>
        `).join('');

        // Event listener para checkboxes
        container.querySelectorAll('.agente-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                this.actualizarMiembrosSeleccionados();
            });
        });
    }

    actualizarMiembrosSeleccionados() {
        const checkboxes = document.querySelectorAll('.agente-checkbox:checked');
        const miembrosContainer = document.getElementById('equipoMiembros');
        const agentes = this.app.getAgentes();

        miembrosContainer.innerHTML = Array.from(checkboxes).map(checkbox => {
            const agenteId = checkbox.value;
            const agente = agentes.find(a => a.id === agenteId);
            if (!agente) return '';

            return `
                <div class="miembro-seleccionado" data-agente-id="${agenteId}">
                    <span>${agente.nombre} ${agente.apellido}</span>
                    <button type="button" class="btn-remove-miembro" onclick="this.removeMiembro('${agenteId}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        }).join('');

        // Configurar event listeners para botones de eliminar
        miembrosContainer.querySelectorAll('.btn-remove-miembro').forEach(btn => {
            btn.removeMiembro = (agenteId) => {
                const checkbox = document.querySelector(`.agente-checkbox[value="${agenteId}"]`);
                if (checkbox) {
                    checkbox.checked = false;
                    this.actualizarMiembrosSeleccionados();
                }
            };
        });
    }

    async crearEquipo() {
        try {
            const nombre = document.getElementById('equipoNombre').value.trim();
            const checkboxes = document.querySelectorAll('.agente-checkbox:checked');
            const miembros = Array.from(checkboxes).map(checkbox => checkbox.value);

            if (!nombre) {
                UI.showAlert('El nombre del equipo es requerido', 'warning');
                return;
            }

            if (miembros.length === 0) {
                UI.showAlert('Selecciona al menos un miembro para el equipo', 'warning');
                return;
            }

            UI.showLoading();

            await this.app.api.post('/equipos', {
                nombre,
                miembros
            });

            UI.hideLoading();
            UI.showAlert('Equipo creado exitosamente', 'success');
            UI.closeModal('modalCrearEquipo');

            // Recargar datos
            await this.loadData();

        } catch (error) {
            console.error('Error al crear equipo:', error);
            UI.hideLoading();
            UI.showAlert(error.message || 'Error al crear el equipo', 'error');
        }
    }

    aplicarFiltros() {
        let datosFiltrados = [...this.datos];

        if (this.filtros.search) {
            const searchTerm = this.filtros.search.toLowerCase();
            const agentes = this.app.getAgentes();
            
            // Pre-cachear búsqueda de agentes para mejor performance
            const agentesMap = new Map();
            agentes.forEach(agente => {
                agentesMap.set(agente.id, agente);
            });

            datosFiltrados = datosFiltrados.filter(equipo => {
                // Buscar en nombre del equipo
                if (equipo.nombre?.toLowerCase().includes(searchTerm)) {
                    return true;
                }

                // Buscar en nombres de agentes miembros
                const miembrosArray = this.obtenerMiembrosArray(equipo);
                return miembrosArray.some(miembroId => {
                    const agente = agentesMap.get(miembroId);
                    if (!agente) return false;
                    
                    const nombreCompleto = `${agente.nombre} ${agente.apellido}`.toLowerCase();
                    const telefono = agente.telefono?.toLowerCase() || '';
                    
                    return nombreCompleto.includes(searchTerm) || 
                        telefono.includes(searchTerm);
                });
            });
        }

        return datosFiltrados;
    }

    renderTable() {
        const tbody = document.getElementById('equiposTableBody');
        const table = document.getElementById('equiposTable');
        
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
                    <td colspan="3" class="table-empty">
                        <i class="fas fa-users-cog"></i>
                        <h3>No se encontraron equipos</h3>
                        <p>No hay equipos que coincidan con la búsqueda.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = paginado.datos.map(equipo => {
            // USAR MÉTODOS CORREGIDOS
            const miembrosArray = this.obtenerMiembrosArray(equipo);
            const miembrosNombres = this.obtenerNombresMiembros(equipo);
            const totalMiembros = miembrosArray.length;

            return `
                <tr>
                    <td>
                        <div class="mobile-cell-content">
                            <div class="main-info">${equipo.nombre}</div>
                            <div class="mobile-secondary-info">
                                <span class="mobile-extra"><i class="fas fa-users"></i> ${totalMiembros} miembros</span>
                            </div>
                        </div>
                    </td>
                    <td class="col-hide-mobile">${miembrosNombres}</td>
                    <td class="actions-column">
                        <div class="actions-dropdown">
                            <button class="actions-toggle">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                            <div class="actions-menu">
                                <button class="action-item" data-action="ver-detalles" data-id="${equipo.id}">
                                    <i class="fas fa-eye"></i>
                                    Ver Detalles
                                </button>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        //botones extra en actions
        // ${this.isAdmin() ? `
        //                         <button class="action-item" data-action="editar" data-id="${equipo.id}">
        //                             <i class="fas fa-edit"></i>
        //                             Editar
        //                         </button>
        //                         <button class="action-item text-danger" data-action="eliminar" data-id="${equipo.id}">
        //                             <i class="fas fa-trash"></i>
        //                             Eliminar
        //                         </button>
        //                         ` : ''}

        this.setupActionListeners();
    }

    actualizarEstadoBotonesPaginacion(totalItems) {
        const prevBtn = document.getElementById('prevPageEquipos');
        const nextBtn = document.getElementById('nextPageEquipos');
        const totalPages = Math.ceil(totalItems / this.paginacion.porPagina);

        if (prevBtn) {
            prevBtn.disabled = this.paginacion.paginaActual === 1;
        }
        if (nextBtn) {
            nextBtn.disabled = this.paginacion.paginaActual === totalPages;
        }
    }

    setupActionListeners() {
        const tbody = document.getElementById('equiposTableBody');
        if (!tbody) return;

        tbody.addEventListener('click', (e) => {
            const actionItem = e.target.closest('.action-item');
            if (!actionItem) return;

            const action = actionItem.getAttribute('data-action');
            const equipoId = actionItem.getAttribute('data-id');

            switch (action) {
                case 'ver-detalles':
                    this.verDetallesEquipo(equipoId);
                    break;
                case 'editar':
                    this.editarEquipo(equipoId);
                    break;
                case 'eliminar':
                    this.eliminarEquipo(equipoId);
                    break;
            }

            const dropdown = actionItem.closest('.actions-dropdown');
            if (dropdown) {
                dropdown.classList.remove('show');
            }
        });
    }

    verDetallesEquipo(equipoId) {
        const equipo = this.datos.find(e => e.id === equipoId);
        if (!equipo) {
            UI.showAlert('Equipo no encontrado', 'error');
            return;
        }

        const agentes = this.app.getAgentes();
        const miembrosArray = this.obtenerMiembrosArray(equipo);
        
        const miembrosNombres = miembrosArray.map(miembroId => {
            const agente = agentes.find(a => a.id === miembroId);
            return agente ? {
                nombre: `${agente.nombre} ${agente.apellido}`,
                telefono: agente.telefono || 'Sin teléfono'
            } : null;
        }).filter(Boolean);

        // Actualizar título del modal
        document.getElementById('modalDetallesEquipoTitulo').textContent = `Detalles: ${equipo.nombre}`;

        // Generar contenido
        const detallesBody = document.getElementById('detallesEquipoBody');
        detallesBody.innerHTML = `
            <div class="detail-section">
                <h4 class="section-title">
                    <i class="fas fa-info-circle"></i>
                    Información del Equipo
                </h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <strong class="detail-label">Nombre:</strong>
                        <span class="detail-value">${equipo.nombre}</span>
                    </div>
                    <div class="detail-item">
                        <strong class="detail-label">Total de Miembros:</strong>
                        <span class="detail-value">${miembrosNombres.length}</span>
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <h4 class="section-title">
                    <i class="fas fa-users"></i>
                    Miembros del Equipo
                </h4>
                <div class="miembros-list">
                    ${miembrosNombres.length > 0 ? 
                        miembrosNombres.map(miembro => `
                            <div class="miembro-item">
                                <i class="fas fa-user-tie"></i>
                                <div class="miembro-info">
                                    <strong>${miembro.nombre}</strong>
                                    <small>${miembro.telefono}</small>
                                </div>
                            </div>
                        `).join('') : 
                        '<p class="text-muted">No hay miembros en este equipo</p>'
                    }
                </div>
            </div>
        `;

        // Mostrar el modal
        UI.showModal('modalDetallesEquipo');
    }

    editarEquipo(equipoId) {
        // Implementar edición de equipo
        UI.showAlert('Funcionalidad de edición en desarrollo', 'info');
    }

    async eliminarEquipo(equipoId) {
        const confirm = await UI.showConfirm(
            'Eliminar Equipo',
            '¿Estás seguro de que deseas eliminar este equipo? Esta acción no se puede deshacer.',
            'warning'
        );

        if (confirm) {
            try {
                UI.showLoading();
                await this.app.api.delete(`/equipos/${equipoId}`);
                UI.hideLoading();
                UI.showAlert('Equipo eliminado exitosamente', 'success');
                await this.loadData();
            } catch (error) {
                console.error('Error al eliminar equipo:', error);
                UI.hideLoading();
                UI.showAlert(error.message || 'Error al eliminar el equipo', 'error');
            }
        }
    }

    clearFilters() {
        this.filtros = {
            search: ''
        };
        this.paginacion.paginaActual = 1;

        document.getElementById('equiposSearch').value = '';

        this.renderTable();
        UI.showAlert('Filtros limpiados correctamente', 'success');
    }

    exportData() {
        const datosFiltrados = this.aplicarFiltros();

        if (datosFiltrados.length === 0) {
            UI.showAlert('No hay datos para exportar', 'warning');
            return;
        }

        const data = datosFiltrados.map(equipo => {
            const miembrosNombres = this.obtenerNombresMiembros(equipo);
            const totalMiembros = this.obtenerMiembrosArray(equipo).length;

            return [
                equipo.nombre,
                miembrosNombres,
                totalMiembros
            ];
        });

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        doc.setFontSize(16);
        doc.text("Reporte de Equipos", 14, 20);

        const hoy = new Date();
        const fechaGeneracion = hoy.toLocaleDateString('es-BO');
        doc.setFontSize(10);
        doc.text(`Generado: ${fechaGeneracion}`, 14, 28);

        doc.autoTable({
            head: [["Nombre", "Miembros", "Total Miembros"]],
            body: data,
            startY: 35,
            styles: { fontSize: 8 }
        });

        const nombreArchivo = `reporte_equipos_${hoy.getFullYear()}-${hoy.getMonth()+1}-${hoy.getDate()}.pdf`;
        doc.save(nombreArchivo);

        UI.showAlert('PDF generado correctamente', 'success');
    }

    getTitle() {
        return 'Gestión de Equipos';
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