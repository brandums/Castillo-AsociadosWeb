class Prorrogas {
    constructor(app) {
        this.app = app;
        this.datos = [];
        this.prorrogasOriginales = [];
        this.filtros = {
            search: '',
            fechaInicio: '',
            fechaFin: '',
            estado: 'todos',
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

        this.selectedProrrogas = new Set();
        this.currentBulkAction = null;
    }

    // Métodos de utilidad para roles
    getCurrentUser = () => this.app.auth.getUser();
    
    isAdmin = () => {
        const user = this.getCurrentUser();
        return user && user.rol === 'Admin';
    }

    async init() {
        // Verificar si el elemento existe antes de acceder
        const filtroAgenteGroup = document.getElementById('prorrogafiltroAgenteGroup');
        if (filtroAgenteGroup && this.isAdmin()) {
            filtroAgenteGroup.style.display = 'block';
        }

        this.prorrogasOriginales = await this.app.api.loadProrrogas();
        this.procesarDatos();
        this.setupEventListeners();
        await this.renderTable();
    }

    async loadData() {
        try {
            const prorrogasTab = document.getElementById('prorrogasTab');
            if (prorrogasTab) {
                UI.showLoading(prorrogasTab);
            }
            
            await this.app.refreshGlobalData("prorrogas");
            this.prorrogasOriginales = await this.app.api.loadProrrogas();
            this.procesarDatos();
            
            if (prorrogasTab) {
                UI.hideLoading(prorrogasTab);
            }
        } catch (error) {
            console.error('Error loading prorrogas:', error);
            UI.showAlert('Error al cargar las prórrogas', 'error');
            
            const prorrogasTab = document.getElementById('prorrogasTab');
            if (prorrogasTab) {
                UI.hideLoading(prorrogasTab);
            }
        }
    }

    procesarDatos() {
        const agentes = this.app.getAgentes();
        const prospectos = this.app.getProspectos();
        
        this.datos = this.prorrogasOriginales.map(prorroga => {
            // Buscar información del cliente (prospecto)
            const prospecto = prospectos.find(p => p.id === prorroga.clienteId);
            const clienteNombre = prospecto ? `${prospecto.nombre} ${prospecto.apellido}` : 'Cliente no encontrado';
            
            // Buscar información del asesor
            const asesor = agentes.find(a => a.id === prorroga.agenteId);
            const asesorNombre = asesor ? `${asesor.nombre} ${asesor.apellido}` : 'Asesor no encontrado';
            
            // Buscar información del administrador (si existe)
            const administrador = prorroga.administradorId ? 
                agentes.find(a => a.id === prorroga.administradorId) : null;
            const administradorNombre = administrador ? 
                `${administrador.nombre} ${administrador.apellido}` : 'Pendiente';

            const calcularFechaLimiteExtendida = (fechaOriginal) => {
                if (!fechaOriginal) return null;
                
                try {
                    const fecha = new Date(fechaOriginal);
                    fecha.setDate(fecha.getDate() + 30);
                    return fecha.toISOString().split('T')[0];
                } catch (error) {
                    console.error('Error al calcular fecha extendida:', error);
                    return fechaOriginal;
                }
            };

            const fechaLimiteExtendida = calcularFechaLimiteExtendida(prorroga.fechaLimite);
                
            return {
                id: prorroga.id,
                clienteId: prorroga.clienteId,
                clienteNombre: clienteNombre,
                asesorId: prorroga.agenteId,
                asesorNombre: asesorNombre,
                administradorId: prorroga.administradorId,
                administradorNombre: administradorNombre,
                descripcion: prorroga.descripcion || 'Sin descripción',
                imagen: prorroga.imagen,
                fechaSolicitudOriginal: prorroga.fechaSolicitud,
                fechaLimiteOriginal: prorroga.fechaLimite,
                fechaSolicitud: Utils.formatDate(prorroga.fechaSolicitud),
                fechaLimite: Utils.formatDate(fechaLimiteExtendida),
                fechaResolucion: prorroga.fechaResolucion ? Utils.formatDate(prorroga.fechaResolucion) : null,
                estado: prorroga.estado || 'pendiente',
                searchText: `${clienteNombre} ${asesorNombre} ${prorroga.descripcion || ''}`.toLowerCase()
            };
        });
    }

    setupEventListeners() {
        if (this.eventListenersSetup) return;
        this.eventListenersSetup = true;

        // Búsqueda
        const searchInput = document.getElementById('prorrogasSearch');
        if (searchInput && !searchInput.hasListener) {
            searchInput.hasListener = true;
            searchInput.addEventListener('input', Utils.debounce((e) => {
                this.filtros.search = e.target.value;
                this.paginacion.paginaActual = 1;
                this.renderTable();
            }, 300));
        }

        // Botón Voltear lista
        const btnVoltear = document.getElementById('btnVoltearProrrogas');
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
        const btnFiltros = document.getElementById('btnFiltrosProrrogas');
        if (btnFiltros && !btnFiltros.hasListener) {
            btnFiltros.hasListener = true;
            btnFiltros.addEventListener('click', () => {
                this.mostrarModalFiltros();
            });
        }

        // Aplicar filtros desde el modal
        const btnAplicarFiltros = document.getElementById('btnAplicarFiltrosProrrogas');
        if (btnAplicarFiltros && !btnAplicarFiltros.hasListener) {
            btnAplicarFiltros.hasListener = true;
            btnAplicarFiltros.addEventListener('click', () => {
                this.aplicarFiltrosDesdeModal();
            });
        }

        // Limpiar filtros desde el modal
        const btnLimpiarFiltros = document.getElementById('btnLimpiarFiltrosProrrogas');
        if (btnLimpiarFiltros && !btnLimpiarFiltros.hasListener) {
            btnLimpiarFiltros.hasListener = true;
            btnLimpiarFiltros.addEventListener('click', () => {
                this.limpiarFiltrosDesdeModal();
            });
        }

        // Exportar
        const exportBtn = document.getElementById('exportProrrogas');
        if (exportBtn && !exportBtn.hasListener) {
            exportBtn.hasListener = true;
            exportBtn.addEventListener('click', () => {
                this.exportData();
            });
        }

        // Event listener para el cambio de acción en el modal de revisión
        const selectAccion = document.getElementById('prorrogaAccion');
        if (selectAccion && !selectAccion.hasListener) {
            selectAccion.hasListener = true;
            selectAccion.addEventListener('change', (e) => {
                this.toggleDiasExtra(e.target.value);
            });
        }

        // Event listener para guardar la revisión
        const btnGuardarRevision = document.getElementById('btnGuardarRevision');
        if (btnGuardarRevision && !btnGuardarRevision.hasListener) {
            btnGuardarRevision.hasListener = true;
            btnGuardarRevision.addEventListener('click', () => {
                this.guardarRevision();
            });
        }

        // Event listener para cambios en días extra
        const inputDiasExtra = document.getElementById('prorrogaDiasExtra');
        if (inputDiasExtra && !inputDiasExtra.hasListener) {
            inputDiasExtra.hasListener = true;
            inputDiasExtra.addEventListener('input', (e) => {
                this.actualizarNuevaFechaLimite(e.target.value);
            });
        }

        // EVENT LISTENER GLOBAL PARA PAGINACIÓN (COMO EN CLIENTES)
        document.addEventListener('click', (e) => {
            // Botón Anterior
            if (e.target.closest('#prevPageProrrogas')) {
                e.preventDefault();
                if (this.paginacion.paginaActual > 1) {
                    this.paginacion.paginaActual--;
                    this.renderTable();
                }
            }
            // Botón Siguiente
            else if (e.target.closest('#nextPageProrrogas')) {
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

        // Inicializar paginación (COMO EN CLIENTES)
        if (!this.paginationInitialized) {
            this.pagination = initPagination('prorrogasPagination', {
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

        const bulkApproveBtn = document.getElementById('bulkApproveBtn');
        if (bulkApproveBtn && !bulkApproveBtn.hasListener) {
            bulkApproveBtn.hasListener = true;
            bulkApproveBtn.addEventListener('click', () => {
                this.openBulkActionModal('aprobar');
            });
        }

        const bulkRejectBtn = document.getElementById('bulkRejectBtn');
        if (bulkRejectBtn && !bulkRejectBtn.hasListener) {
            bulkRejectBtn.hasListener = true;
            bulkRejectBtn.addEventListener('click', () => {
                this.openBulkActionModal('rechazar');
            });
        }

        const bulkCancelBtn = document.getElementById('bulkCancelBtn');
        if (bulkCancelBtn && !bulkCancelBtn.hasListener) {
            bulkCancelBtn.hasListener = true;
            bulkCancelBtn.addEventListener('click', () => {
                this.clearSelection();
            });
        }

        // ✨ NUEVO: Confirmar acción múltiple
        const bulkModalConfirm = document.getElementById('bulkModalConfirm');
        if (bulkModalConfirm && !bulkModalConfirm.hasListener) {
            bulkModalConfirm.hasListener = true;
            bulkModalConfirm.addEventListener('click', () => {
                this.processBulkAction();
            });
        }

        const bulkModalCancel = document.getElementById('bulkModalCancel');
        if (bulkModalCancel && !bulkModalCancel.hasListener) {
            bulkModalCancel.hasListener = true;
            bulkModalCancel.addEventListener('click', () => {
                UI.closeModal('bulkActionModal');
            });
        }
        
        this.actualizarIndicadorFiltros();
    }

    aplicarFiltros() {
        let datosFiltrados = [...this.datos];

        // Filtro de búsqueda
        if (this.filtros.search) {
            datosFiltrados = Utils.buscarEnTexto(datosFiltrados, this.filtros.search, [
                'clienteNombre', 'asesorNombre', 'descripcion'
            ]);
        }

        // Filtro por estado
        if (this.filtros.estado !== 'todos') {
            datosFiltrados = datosFiltrados.filter(prorroga => 
                prorroga.estado === this.filtros.estado
            );
        }

        // Filtro por asesor
        if (this.filtros.asesor !== 'todos') {
            datosFiltrados = datosFiltrados.filter(prorroga => 
                prorroga.asesorId === this.filtros.asesor
            );
        }

        // FILTRO POR FECHAS - CORREGIDO: usar fechas originales
        if (this.filtros.fechaInicio || this.filtros.fechaFin) {        
            datosFiltrados = Utils.filtrarPorFechas(
                datosFiltrados, 
                this.filtros.fechaInicio, 
                this.filtros.fechaFin, 
                'fechaSolicitudOriginal' // ← CAMBIADO: usar fecha original
            );
        }

        return datosFiltrados;
    }

    renderTable() {
        const tbody = document.getElementById('prorrogasTableBody');
        const table = document.getElementById('prorrogasTable');
        
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
                    <td colspan="7" class="table-empty">
                        <i class="fas fa-clock"></i>
                        <h3>No se encontraron prórrogas</h3>
                        <p>No hay solicitudes de prórroga que coincidan con los filtros aplicados.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = paginado.datos.map(prorroga => {
            const estadoBadge = this.getEstadoBadge(prorroga.estado);
            const esAdmin = this.isAdmin();
            const estaPendiente = prorroga.estado === 'pendiente';
            const isSelected = this.selectedProrrogas.has(prorroga.id);

            return `
                <tr data-prorroga-id="${prorroga.id}" data-status="${prorroga.estado}" class="${isSelected ? 'selected' : ''}">
                    <td class="checkbox-cell">
                        ${estaPendiente ? `
                        <label class="custom-checkbox">
                            <input type="checkbox" class="prorroga-checkbox" ${isSelected ? 'checked' : ''}>
                            <span class="checkmark"></span>
                        </label>
                        ` : `
                        <label class="custom-checkbox">
                            <input type="checkbox" class="prorroga-checkbox" disabled>
                            <span class="checkmark"></span>
                        </label>
                        `}
                    </td>
                    <td>
                        <div class="mobile-cell-content">
                            <div class="main-info">${prorroga.clienteNombre}</div>
                            <div class="mobile-secondary-info">
                                <span class="mobile-extra"><i class="fas fa-user-tie"></i> ${prorroga.asesorNombre}</span>
                            </div>
                        </div>
                    </td>
                    <td class="col-hide-mobile">${prorroga.asesorNombre}</td>
                    <td class="col-hide-mobile">${prorroga.fechaSolicitud}</td>
                    <td class="col-hide-mobile">${prorroga.fechaLimite}</td>
                    <td>${estadoBadge}</td>
                    <td class="actions-column">
                        <div class="actions-dropdown">
                            <button class="actions-toggle">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                            <div class="actions-menu">
                                <button class="action-item" data-action="ver-detalles" data-id="${prorroga.id}">
                                    <i class="fas fa-eye"></i>
                                    Ver detalles
                                </button>
                                ${esAdmin && estaPendiente ? `
                                <button class="action-item" data-action="revisar" data-id="${prorroga.id}">
                                    <i class="fas fa-check-circle"></i>
                                    Revisar
                                </button>
                                ` : ''}
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        this.updateSelectAllCheckbox();
        this.setupCheckboxListeners();
        this.setupActionListeners();
    }

    actualizarEstadoBotonesPaginacion(totalItems) {
        const prevBtn = document.getElementById('prevPageProrrogas');
        const nextBtn = document.getElementById('nextPageProrrogas');
        const totalPages = Math.ceil(totalItems / this.paginacion.porPagina);

        if (prevBtn) {
            prevBtn.disabled = this.paginacion.paginaActual === 1;
        }
        if (nextBtn) {
            nextBtn.disabled = this.paginacion.paginaActual === totalPages;
        }
    }

    // ... (el resto de los métodos se mantienen igual, pero asegúrate de que en verDetalles y revisarProrroga
    // también uses las fechas formateadas para display)

    getEstadoBadge(estado) {
        const estados = {
            'pendiente': { class: 'warning', text: 'Pendiente' },
            'aprobado': { class: 'success', text: 'Aprobado' },
            'rechazado': { class: 'danger', text: 'Rechazado' }
        };
        
        const estadoInfo = estados[estado] || { class: 'secondary', text: estado };
        return `<span class="badge badge-${estadoInfo.class}">${estadoInfo.text}</span>`;
    }

    setupActionListeners() {
        const tbody = document.getElementById('prorrogasTableBody');
        if (!tbody) return;

        tbody.addEventListener('click', (e) => {
            const actionItem = e.target.closest('.action-item');
            if (!actionItem) return;

            const action = actionItem.getAttribute('data-action');
            const prorrogaId = actionItem.getAttribute('data-id');

            switch (action) {
                case 'ver-detalles':
                    this.verDetalles(prorrogaId);
                    break;
                case 'revisar':
                    this.revisarProrroga(prorrogaId);
                    break;
            }

            const dropdown = actionItem.closest('.actions-dropdown');
            if (dropdown) {
                dropdown.classList.remove('show');
            }
        });
    }

    verDetalles(prorrogaId) {
        const prorroga = this.datos.find(p => p.id === prorrogaId);
        if (!prorroga) {
            UI.showAlert('Prórroga no encontrada', 'error');
            return;
        }

        // Procesar la descripción para mantener saltos de línea
        const descripcionFormateada = prorroga.descripcion 
            ? prorroga.descripcion.replace(/\n/g, '<br>')
            : 'Sin descripción';

        const detallesBody = document.getElementById('detallesProrrogaBody');
        detallesBody.innerHTML = `
            <div class="detail-section">
                <h4 class="section-title">
                    <i class="fas fa-user"></i>
                    Información del Cliente y Asesor
                </h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <strong class="detail-label">Cliente:</strong>
                        <span class="detail-value">${prorroga.clienteNombre}</span>
                    </div>
                    <div class="detail-item">
                        <strong class="detail-label">Asesor:</strong>
                        <span class="detail-value">${prorroga.asesorNombre}</span>
                    </div>
                    <div class="detail-item">
                        <strong class="detail-label">Administrador:</strong>
                        <span class="detail-value">${prorroga.administradorNombre}</span>
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <h4 class="section-title">
                    <i class="fas fa-calendar"></i>
                    Fechas
                </h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <strong class="detail-label">Fecha de Solicitud:</strong>
                        <span class="detail-value">${prorroga.fechaSolicitud}</span>
                    </div>
                    <div class="detail-item">
                        <strong class="detail-label">Fecha Límite Original:</strong>
                        <span class="detail-value">${prorroga.fechaLimite}</span>
                    </div>
                    <div class="detail-item">
                        <strong class="detail-label">Fecha de Resolución:</strong>
                        <span class="detail-value">${prorroga.fechaResolucion || 'Pendiente'}</span>
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <h4 class="section-title">
                    <i class="fas fa-info-circle"></i>
                    Información de la Solicitud
                </h4>
                <div class="detail-grid">
                    <div class="detail-item full-width">
                        <strong class="detail-label">Estado:</strong>
                        <span class="detail-value">${this.getEstadoBadge(prorroga.estado)}</span>
                    </div>
                    <div class="detail-item full-width">
                        <strong class="detail-label">Descripción:</strong>
                    </div>
                    <div class="detail-item full-width">
                        <div class="detail-value description-text" style="text-align: left; margin-left: 0; padding-left: 0;">
                            ${descripcionFormateada}
                        </div>
                    </div>
                    ${prorroga.imagen ? `
                    <div class="detail-item full-width">
                        <strong class="detail-label">Imagen Adjunta:</strong>
                        <div class="image-preview">
                            <img src="${prorroga.imagen}" alt="Imagen de prórroga" style="max-width: 100%; max-height: 300px;">
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;

        UI.showModal('modalDetallesProrroga');
    }

    revisarProrroga(prorrogaId) {
        const prorroga = this.datos.find(p => p.id === prorrogaId);
        if (!prorroga) {
            UI.showAlert('Prórroga no encontrada', 'error');
            return;
        }

        // Procesar la descripción para mantener saltos de línea
        const descripcionFormateada = prorroga.descripcion 
            ? prorroga.descripcion.replace(/\n/g, '<br>')
            : 'Sin descripción';

        // Llenar información básica
        document.getElementById('prorrogaId').value = prorroga.id;
        document.getElementById('prorrogaClienteInfo').textContent = prorroga.clienteNombre;
        document.getElementById('prorrogaAsesorInfo').textContent = prorroga.asesorNombre;
        document.getElementById('prorrogaFechaSolicitud').textContent = prorroga.fechaSolicitud;
        document.getElementById('prorrogaFechaLimite').textContent = prorroga.fechaLimite;
        
        // Usar innerHTML para la descripción con saltos de línea
        document.getElementById('prorrogaDescripcion').innerHTML = descripcionFormateada;

        // Mostrar imagen si existe
        const imagenContainer = document.getElementById('prorrogaImagenContainer');
        if (prorroga.imagen) {
            document.getElementById('prorrogaImagenPreview').src = prorroga.imagen;
            imagenContainer.style.display = 'block';
        } else {
            imagenContainer.style.display = 'none';
        }

        // Resetear formulario
        document.getElementById('prorrogaAccion').value = '';
        document.getElementById('prorrogaDiasExtra').value = '';
        document.getElementById('prorrogaComentario').value = '';
        document.getElementById('diasExtraGroup').style.display = 'none';

        UI.showModal('modalRevisarProrroga');
    }

    toggleDiasExtra(accion) {
        const diasExtraGroup = document.getElementById('diasExtraGroup');
        if (accion === 'aprobado') {
            diasExtraGroup.style.display = 'block';
            this.actualizarNuevaFechaLimite(7); // Valor por defecto
        } else {
            diasExtraGroup.style.display = 'none';
        }
    }

    actualizarNuevaFechaLimite(diasExtra) {
        const prorrogaId = document.getElementById('prorrogaId').value;
        const prorroga = this.datos.find(p => p.id === prorrogaId);
        
        if (prorroga && diasExtra) {
            // Usar la fecha original para el cálculo
            const fechaLimite = new Date(prorroga.fechaLimiteOriginal);
            fechaLimite.setDate(fechaLimite.getDate() + parseInt(diasExtra));
            
            document.getElementById('nuevaFechaLimite').textContent = 
                Utils.formatDate(fechaLimite.toISOString().split('T')[0]);
        }
    }

    async guardarRevision() {
        const prorrogaId = document.getElementById('prorrogaId').value;
        const accion = document.getElementById('prorrogaAccion').value;
        const diasExtra = document.getElementById('prorrogaDiasExtra').value;
        const comentario = document.getElementById('prorrogaComentario').value;

        if (!accion) {
            UI.showAlert('Seleccione una acción', 'warning');
            return;
        }

        if (accion === 'aprobado' && (!diasExtra || parseInt(diasExtra) <= 0)) {
            UI.showAlert('Ingrese un número válido de días extra', 'warning');
            return;
        }

        try {
            UI.showLoading();

            await this.app.api.put(`/prorrogas/${prorrogaId}`, {
                estado: accion,
                diasExtra: accion === 'aprobado' ? parseInt(diasExtra) : undefined,
                comentario: comentario || undefined
            });

            UI.hideLoading();
            UI.showAlert(`Solicitud ${accion} correctamente`, 'success');
            UI.closeModal('modalRevisarProrroga');

            // Recargar datos
            await this.loadData();
            this.renderTable();

        } catch (error) {
            console.error('Error al guardar revisión:', error);
            UI.hideLoading();
            UI.showAlert(error.message || 'Error al procesar la solicitud', 'error');
        }
    }

    // Los métodos de filtros, exportación, etc. se mantienen igual que en tu versión original
    // ... (mostrarModalFiltros, cargarOpcionesEnModal, establecerValoresActualesEnModal, etc.)

    mostrarModalFiltros() {
        this.cargarOpcionesEnModal();
        this.establecerValoresActualesEnModal();
        this.mostrarFiltrosActivos();
        UI.showModal('modalFiltrosProrrogas');
    }

    cargarOpcionesEnModal() {
        const agentes = this.app.getAgentes();

        // Agentes
        const selectAsesor = document.getElementById('filtroAsesorProrrogas');
        if (selectAsesor) {
            selectAsesor.innerHTML = '<option value="todos">Todos los asesores</option>';
            agentes.forEach(agente => {
                const option = document.createElement('option');
                option.value = agente.id;
                option.textContent = `${agente.nombre} ${agente.apellido}`;
                selectAsesor.appendChild(option);
            });
        }
    }

    establecerValoresActualesEnModal() {
        document.getElementById('fechaInicioProrrogas').value = this.filtros.fechaInicio;
        document.getElementById('fechaFinProrrogas').value = this.filtros.fechaFin;
        document.getElementById('filtroEstadoProrrogas').value = this.filtros.estado;
        document.getElementById('filtroAsesorProrrogas').value = this.filtros.asesor;
    }

    aplicarFiltrosDesdeModal() {
        this.filtros.fechaInicio = document.getElementById('fechaInicioProrrogas').value;
        this.filtros.fechaFin = document.getElementById('fechaFinProrrogas').value;
        this.filtros.estado = document.getElementById('filtroEstadoProrrogas').value;
        this.filtros.asesor = document.getElementById('filtroAsesorProrrogas').value;
        
        this.paginacion.paginaActual = 1;
        
        UI.closeModal('modalFiltrosProrrogas');
        this.renderTable();
        this.actualizarIndicadorFiltros();
        UI.showAlert('Filtros aplicados correctamente', 'success');
    }

    limpiarFiltrosDesdeModal() {
        document.getElementById('fechaInicioProrrogas').value = '';
        document.getElementById('fechaFinProrrogas').value = '';
        document.getElementById('filtroEstadoProrrogas').value = 'todos';
        document.getElementById('filtroAsesorProrrogas').value = 'todos';
        
        UI.closeModal('modalFiltrosProrrogas');
        this.clearFilters();
    }

    mostrarFiltrosActivos() {
        const container = document.getElementById('filtrosAplicadosContainerProrrogas');
        const content = document.getElementById('filtrosAplicadosProrrogas');
        
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
            const textoEstado = this.filtros.estado === 'pendiente' ? 'Pendientes' : 
                              this.filtros.estado === 'aprobado' ? 'Aprobados' : 'Rechazados';
            filtrosActivos.push({ tipo: 'estado', texto: textoEstado });
        }

        if (this.filtros.asesor !== 'todos') {
            const agente = agentes.find(a => a.id === this.filtros.asesor);
            const textoAgente = agente ? `${agente.nombre} ${agente.apellido}` : 'Agente';
            filtrosActivos.push({ tipo: 'asesor', texto: textoAgente });
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
        document.getElementById('fechaInicioProrrogas').value = this.filtros.fechaInicio;
        document.getElementById('fechaFinProrrogas').value = this.filtros.fechaFin;
        document.getElementById('filtroEstadoProrrogas').value = this.filtros.estado;
        document.getElementById('filtroAsesorProrrogas').value = this.filtros.asesor;
    }

    actualizarIndicadorFiltros() {
        const btnFiltros = document.getElementById('btnFiltrosProrrogas');
        if (!btnFiltros) return;
        
        const tieneFiltros = this.filtros.fechaInicio || this.filtros.fechaFin || 
                            this.filtros.estado !== 'todos' || this.filtros.asesor !== 'todos';
        
        if (tieneFiltros) {
            btnFiltros.classList.add('btn-filtros-activos');
        } else {
            btnFiltros.classList.remove('btn-filtros-activos');
        }
    }

    clearFilters() {
        this.filtros = {
            search: '',
            fechaInicio: '',
            fechaFin: '',
            estado: 'todos',
            asesor: 'todos'
        };
        this.paginacion.paginaActual = 1;

        document.getElementById('prorrogasSearch').value = '';

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

        const data = datosFiltrados.map(prorroga => {
            return [
                prorroga.clienteNombre,
                prorroga.asesorNombre,
                prorroga.fechaSolicitud,
                prorroga.fechaLimite,
                prorroga.estado.charAt(0).toUpperCase() + prorroga.estado.slice(1),
                prorroga.administradorNombre
            ];
        });

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF("landscape");

        doc.setFontSize(16);
        doc.text("Reporte de Prórrogas", 14, 20);

        const hoy = new Date();
        const fechaGeneracion = hoy.toLocaleDateString('es-BO');
        doc.setFontSize(10);
        doc.text(`Generado: ${fechaGeneracion}`, 14, 28);

        // Aplicar filtros en el reporte
        const filtrosTexto = [];
        if (this.filtros.fechaInicio || this.filtros.fechaFin) {
            filtrosTexto.push(`Fechas: ${this.filtros.fechaInicio || '-'} a ${this.filtros.fechaFin || '-'}`);
        }
        if (this.filtros.estado !== 'todos') {
            filtrosTexto.push(`Estado: ${this.filtros.estado}`);
        }
        if (this.filtros.asesor !== 'todos') {
            const agentes = this.app.getAgentes();
            const agente = agentes.find(a => a.id === this.filtros.asesor);
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
            head: [["Cliente", "Asesor", "Fecha Solicitud", "Fecha Límite", "Estado", "Administrador"]],
            body: data,
            startY: filtrosTexto.length > 0 ? 38 : 35,
            styles: { fontSize: 8 }
        });

        const nombreArchivo = `reporte_prorrogas_${hoy.getFullYear()}-${hoy.getMonth()+1}-${hoy.getDate()}.pdf`;
        doc.save(nombreArchivo);

        UI.showAlert('PDF generado correctamente', 'success');
    }

    getTitle() {
        return 'Gestión de Prórrogas';
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

    setupCheckboxListeners() {
        // Checkbox principal
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        if (selectAllCheckbox) {
            selectAllCheckbox.onclick = () => {
                const checkboxes = document.querySelectorAll('.prorroga-checkbox:not(:disabled)');
                const shouldCheck = selectAllCheckbox.checked;
                
                checkboxes.forEach(checkbox => {
                    checkbox.checked = shouldCheck;
                    const row = checkbox.closest('tr');
                    const prorrogaId = row.dataset.prorrogaId;
                    
                    if (shouldCheck) {
                        this.selectedProrrogas.add(prorrogaId);
                        row.classList.add('selected');
                    } else {
                        this.selectedProrrogas.delete(prorrogaId);
                        row.classList.remove('selected');
                    }
                });
                
                this.updateBulkActionsBar();
            };
        }

        // Checkboxes individuales
        document.querySelectorAll('.prorroga-checkbox').forEach(checkbox => {
            checkbox.onclick = () => {
                const row = checkbox.closest('tr');
                const prorrogaId = row.dataset.prorrogaId;
                
                if (checkbox.checked) {
                    this.selectedProrrogas.add(prorrogaId);
                    row.classList.add('selected');
                } else {
                    this.selectedProrrogas.delete(prorrogaId);
                    row.classList.remove('selected');
                }
                
                this.updateSelectAllCheckbox();
                this.updateBulkActionsBar();
            };
        });
    }

    // ✨ NUEVO: Actualizar checkbox principal
    updateSelectAllCheckbox() {
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        if (!selectAllCheckbox) return;
        
        const checkboxes = document.querySelectorAll('.prorroga-checkbox:not(:disabled)');
        const checkedCount = document.querySelectorAll('.prorroga-checkbox:checked').length;
        
        selectAllCheckbox.checked = checkedCount > 0 && checkedCount === checkboxes.length;
        selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
    }

    // ✨ NUEVO: Actualizar barra de acciones
    updateBulkActionsBar() {
        const bar = document.getElementById('bulkActionsBar');
        const count = document.getElementById('selectedCount');
        
        if (!bar || !count) return;
        
        count.textContent = this.selectedProrrogas.size;
        
        if (this.selectedProrrogas.size > 0) {
            bar.classList.add('show');
        } else {
            bar.classList.remove('show');
        }
    }

    // ✨ NUEVO: Abrir modal de acción múltiple
    openBulkActionModal(action) {
        this.currentBulkAction = action;
        
        const title = action === 'aprobar' ? 'Aprobar Prórrogas Seleccionadas' : 'Rechazar Prórrogas Seleccionadas';
        document.getElementById('bulkModalTitle').textContent = title;
        
        // Mostrar/ocultar días extra
        const diasExtraGroup = document.getElementById('bulkDiasExtraGroup');
        if (diasExtraGroup) {
            diasExtraGroup.style.display = action === 'aprobar' ? 'block' : 'none';
        }
        
        // Actualizar texto info
        const infoText = action === 'aprobar' 
            ? 'Se aprobarán todas las prórrogas seleccionadas con los mismos días extra.'
            : 'Se rechazarán todas las prórrogas seleccionadas.';
        document.getElementById('bulkInfoText').textContent = infoText;
        
        // Llenar lista de prórrogas seleccionadas
        const list = document.getElementById('selectedItemsList');
        if (list) {
            list.innerHTML = '';
            this.selectedProrrogas.forEach(id => {
                const prorroga = this.datos.find(p => p.id === id);
                if (prorroga) {
                    const div = document.createElement('div');
                    div.className = 'selected-item';
                    div.innerHTML = `<i class="fas fa-user"></i> ${prorroga.clienteNombre} - ${prorroga.asesorNombre}`;
                    list.appendChild(div);
                }
            });
        }
        
        UI.showModal('bulkActionModal');
    }

    // ✨ NUEVO: Procesar acción múltiple
    async processBulkAction() {
        const diasExtra = document.getElementById('bulkDiasExtra')?.value;
        const comentario = document.getElementById('bulkComentario')?.value;
        
        if (this.currentBulkAction === 'aprobar' && (!diasExtra || parseInt(diasExtra) <= 0)) {
            UI.showAlert('Por favor, ingrese días extra válidos', 'warning');
            return;
        }
        
        try {
            UI.showLoading();
            
            const promises = Array.from(this.selectedProrrogas).map(prorrogaId => {
                return this.app.api.put(`/prorrogas/${prorrogaId}`, {
                    estado: this.currentBulkAction === 'aprobar' ? 'aprobado' : 'rechazado',
                    diasExtra: this.currentBulkAction === 'aprobar' ? parseInt(diasExtra) : undefined,
                    comentario: comentario || undefined
                });
            });
            
            await Promise.all(promises);
            
            UI.hideLoading();
            UI.showAlert(
                `${this.selectedProrrogas.size} prórrogas ${this.currentBulkAction === 'aprobar' ? 'aprobadas' : 'rechazadas'} correctamente`, 
                'success'
            );
            
            UI.closeModal('bulkActionModal');
            this.clearSelection();
            
            // Recargar datos
            await this.loadData();
            this.renderTable();
            
        } catch (error) {
            console.error('Error al procesar acciones múltiples:', error);
            UI.hideLoading();
            UI.showAlert(error.message || 'Error al procesar las solicitudes', 'error');
        }
    }

    // ✨ NUEVO: Limpiar selección
    clearSelection() {
        this.selectedProrrogas.clear();
        document.querySelectorAll('.prorroga-checkbox:checked').forEach(checkbox => {
            checkbox.checked = false;
            checkbox.closest('tr').classList.remove('selected');
        });
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        }
        this.updateBulkActionsBar();
    }
}