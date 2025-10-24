// js/modules/agentes.js - VERSIÓN CORREGIDA
class Agentes {
    constructor(app) {
        this.app = app;
        this.datos = [];
        this.filtros = {
            search: '',
            equipo: 'todos'
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

    async init() {
        this.datos = this.app.getAgentes();
        this.setupEventListeners();
        await this.renderTable();
    }

    async loadData() {
        try {
            UI.showLoading(document.getElementById('agentesTab'));
            await this.app.refreshGlobalData("estadisticas-agentes");
            this.datos = this.app.getAgentes();
            await this.loadEquiposParaFiltros();
            UI.hideLoading(document.getElementById('agentesTab'));
        } catch (error) {
            console.error('Error loading agentes:', error);
            UI.showAlert('Error al cargar los agentes', 'error');
            UI.hideLoading(document.getElementById('agentesTab'));
        }
    }

    async loadEquiposParaFiltros() {
        const selectEquipo = document.getElementById('filtroEquipoAgentes');
            
        if (selectEquipo) {
            // Limpiar opciones excepto la primera
            while (selectEquipo.children.length > 1) {
                selectEquipo.removeChild(selectEquipo.lastChild);
            }
            
            // Agregar equipos únicos
            const equiposUnicos = [...new Set(this.datos.map(agente => agente.equipo))].filter(equipo => equipo && equipo !== 'Sin equipo');
            
            equiposUnicos.forEach(equipo => {
                const option = document.createElement('option');
                option.value = equipo;
                option.textContent = equipo;
                selectEquipo.appendChild(option);
            });
        }        
    }

    setupEventListeners() {
        if (this.eventListenersSetup) return;
        this.eventListenersSetup = true;

        // Búsqueda
        const searchInput = document.getElementById('agentesSearch');
        if (searchInput && !searchInput.hasListener) {
            searchInput.hasListener = true;
            searchInput.addEventListener('input', Utils.debounce((e) => {
                this.filtros.search = e.target.value;
                this.paginacion.paginaActual = 1;
                this.renderTable();
            }, 300));
        }

        // Botón Voltear lista
        const btnVoltear = document.getElementById('btnVoltearAgentes');
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
        const btnFiltros = document.getElementById('btnFiltrosAgentes');
        if (btnFiltros && !btnFiltros.hasListener) {
            btnFiltros.hasListener = true;
            btnFiltros.addEventListener('click', () => {
                this.mostrarModalFiltros();
            });
        }

        // Aplicar filtros desde el modal
        const btnAplicarFiltros = document.getElementById('btnAplicarFiltrosAgentes');
        if (btnAplicarFiltros && !btnAplicarFiltros.hasListener) {
            btnAplicarFiltros.hasListener = true;
            btnAplicarFiltros.addEventListener('click', () => {
                this.aplicarFiltrosDesdeModal();
            });
        }

        // Limpiar filtros desde el modal
        const btnLimpiarFiltros = document.getElementById('btnLimpiarFiltrosAgentes');
        if (btnLimpiarFiltros && !btnLimpiarFiltros.hasListener) {
            btnLimpiarFiltros.hasListener = true;
            btnLimpiarFiltros.addEventListener('click', () => {
                this.limpiarFiltrosDesdeModal();
            });
        }

        // Exportar
        const exportBtn = document.getElementById('exportAgentes');
        if (exportBtn && !exportBtn.hasListener) {
            exportBtn.hasListener = true;
            exportBtn.addEventListener('click', () => {
                this.exportData();
            });
        }

        // Inicializar paginación
        if (!this.paginationInitialized) {
            this.setupPagination();
        }
        
        this.actualizarIndicadorFiltros();
    }

    setupPagination() {
        // Configurar event listeners para los botones de paginación
        const prevBtn = document.getElementById('prevPageAgentes');
        const nextBtn = document.getElementById('nextPageAgentes');

        if (prevBtn && !prevBtn.hasListener) {
            prevBtn.hasListener = true;
            prevBtn.addEventListener('click', () => {
                if (this.paginacion.paginaActual > 1) {
                    this.paginacion.paginaActual--;
                    this.renderTable();
                }
            });
        }

        if (nextBtn && !nextBtn.hasListener) {
            nextBtn.hasListener = true;
            nextBtn.addEventListener('click', () => {
                const datosFiltrados = this.aplicarFiltros();
                const totalPaginas = Math.ceil(datosFiltrados.length / this.paginacion.porPagina);
                
                if (this.paginacion.paginaActual < totalPaginas) {
                    this.paginacion.paginaActual++;
                    this.renderTable();
                }
            });
        }

        // Inicializar paginación con Utils si existe
        if (typeof initPagination === 'function' && !this.paginationInitialized) {
            this.pagination = initPagination('agentesPagination', {
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

    updatePaginationControls(datosFiltrados) {
        const totalPaginas = Math.ceil(datosFiltrados.length / this.paginacion.porPagina);
        const pageNumbers = document.getElementById('pageNumbersAgentes');
        const prevBtn = document.getElementById('prevPageAgentes');
        const nextBtn = document.getElementById('nextPageAgentes');

        if (!pageNumbers) return;

        // Actualizar estado de botones
        if (prevBtn) {
            prevBtn.disabled = this.paginacion.paginaActual === 1;
            prevBtn.classList.toggle('disabled', this.paginacion.paginaActual === 1);
        }

        if (nextBtn) {
            nextBtn.disabled = this.paginacion.paginaActual === totalPaginas;
            nextBtn.classList.toggle('disabled', this.paginacion.paginaActual === totalPaginas);
        }

        // Generar números de página
        let paginationHTML = '';
        const maxVisiblePages = 5;
        let startPage = Math.max(1, this.paginacion.paginaActual - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPaginas, startPage + maxVisiblePages - 1);

        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        // Botón primera página
        if (startPage > 1) {
            paginationHTML += `
                <button class="pagination-btn pagination-number" data-page="1">1</button>
                ${startPage > 2 ? '<span class="pagination-ellipsis">...</span>' : ''}
            `;
        }

        // Números de página
        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <button class="pagination-btn pagination-number ${i === this.paginacion.paginaActual ? 'active' : ''}" 
                        data-page="${i}">${i}</button>
            `;
        }

        // Botón última página
        if (endPage < totalPaginas) {
            paginationHTML += `
                ${endPage < totalPaginas - 1 ? '<span class="pagination-ellipsis">...</span>' : ''}
                <button class="pagination-btn pagination-number" data-page="${totalPaginas}">${totalPaginas}</button>
            `;
        }

        pageNumbers.innerHTML = paginationHTML;

        // Agregar event listeners a los números de página
        pageNumbers.querySelectorAll('.pagination-number').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = parseInt(e.target.getAttribute('data-page'));
                this.paginacion.paginaActual = page;
                this.renderTable();
            });
        });
    }

    mostrarModalFiltros() {
        this.cargarEquiposEnModal();
        this.establecerValoresActualesEnModal();
        this.mostrarFiltrosActivos();
        UI.showModal('modalFiltrosAgentes');
    }

    cargarEquiposEnModal() {
        const selectEquipo = document.getElementById('filtroEquipoAgentes');
        
        if (selectEquipo) {
            // Limpiar opciones excepto la primera
            while (selectEquipo.children.length > 1) {
                selectEquipo.removeChild(selectEquipo.lastChild);
            }
            
            // Agregar equipos únicos
            const equiposUnicos = [...new Set(this.datos.map(agente => agente.equipo))].filter(equipo => equipo && equipo !== 'Sin equipo');
            
            equiposUnicos.forEach(equipo => {
                const option = document.createElement('option');
                option.value = equipo;
                option.textContent = equipo;
                selectEquipo.appendChild(option);
            });
        }
    }

    establecerValoresActualesEnModal() {
        document.getElementById('filtroEquipoAgentes').value = this.filtros.equipo;
    }

    aplicarFiltrosDesdeModal() {
        this.filtros.equipo = document.getElementById('filtroEquipoAgentes').value;
        
        this.paginacion.paginaActual = 1;
        
        UI.closeModal('modalFiltrosAgentes');
        this.renderTable();
        this.actualizarIndicadorFiltros();
        UI.showAlert('Filtros aplicados correctamente', 'success');
    }

    limpiarFiltrosDesdeModal() {
        document.getElementById('filtroEquipoAgentes').value = 'todos';
        
        UI.closeModal('modalFiltrosAgentes');
        this.clearFilters();
    }

    mostrarFiltrosActivos() {
        const container = document.getElementById('filtrosAplicadosContainerAgentes');
        const content = document.getElementById('filtrosAplicadosAgentes');
        
        if (!container || !content) return;
        
        const filtrosActivos = [];

        if (this.filtros.equipo !== 'todos') {
            filtrosActivos.push({ tipo: 'equipo', texto: `Equipo: ${this.filtros.equipo}` });
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
            case 'equipo':
                this.filtros.equipo = 'todos';
                break;
        }
        
        this.sincronizarInputsModal();
        this.paginacion.paginaActual = 1;
        this.renderTable();
        this.actualizarIndicadorFiltros();
        this.mostrarFiltrosActivos();
    }

    sincronizarInputsModal() {
        document.getElementById('filtroEquipoAgentes').value = this.filtros.equipo;
    }

    actualizarIndicadorFiltros() {
        const btnFiltros = document.getElementById('btnFiltrosAgentes');
        if (!btnFiltros) return;
        
        const tieneFiltros = this.filtros.equipo !== 'todos';
        
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
                'nombre', 'apellido', 'telefono', 'equipo'
            ]);
        }

        if (this.filtros.equipo !== 'todos') {
            datosFiltrados = datosFiltrados.filter(agente => 
                agente.equipo === this.filtros.equipo
            );
        }

        return datosFiltrados;
    }

    renderTable() {
        const tbody = document.getElementById('agentesTableBody');
        const table = document.getElementById('agentesTable');
        
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

        // Actualizar controles de paginación
        this.updatePaginationControls(datosFiltrados);

        // Actualizar paginación si existe
        if (this.pagination) {
            this.pagination.update(datosFiltrados.length, this.paginacion.paginaActual);
        }

        if (paginado.datos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="table-empty">
                        <i class="fas fa-user-tie"></i>
                        <h3>No se encontraron agentes</h3>
                        <p>No hay agentes que coincidan con los filtros aplicados.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = paginado.datos.map(agente => {
            return `
                <tr>
                    <td>
                        <div class="mobile-cell-content">
                            <div class="main-info">${agente.nombre} ${agente.apellido}</div>
                            <div class="mobile-secondary-info">
                                <span class="mobile-extra"><i class="fas fa-phone"></i> ${agente.telefono || 'N/A'}</span>
                                <span class="mobile-extra"><i class="fas fa-users"></i> ${agente.equipo || 'Sin equipo'}</span>
                            </div>
                        </div>
                    </td>
                    <td>${agente.telefono || 'N/A'}</td>
                    <td>
                        <span class="badge badge-info">${agente.cantidadProspectos || 0}</span>
                    </td>
                    <td>
                        <span class="badge badge-success">${agente.cantidadContratos || 0}</span>
                    </td>
                    <td class="col-hide-mobile">
                        <span class="badge badge-secondary">${agente.equipo || 'Sin equipo'}</span>
                    </td>
                </tr>
            `;
        }).join('');
    }

    clearFilters() {
        this.filtros = {
            search: '',
            equipo: 'todos'
        };
        this.paginacion.paginaActual = 1;

        document.getElementById('agentesSearch').value = '';

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

        const data = datosFiltrados.map(agente => [
            `${agente.nombre} ${agente.apellido}`,
            agente.telefono || 'N/A',
            agente.cantidadProspectos || 0,
            agente.cantidadContratos || 0,
            agente.equipo || 'Sin equipo'
        ]);

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF("landscape");

        doc.setFontSize(16);
        doc.text("Reporte de Agentes", 14, 20);

        const hoy = new Date();
        const fechaGeneracion = hoy.toLocaleDateString('es-BO');
        doc.setFontSize(10);
        doc.text(`Generado: ${fechaGeneracion}`, 14, 28);

        const filtrosTexto = [];
        if (this.filtros.equipo !== 'todos') {
            filtrosTexto.push(`Equipo: ${this.filtros.equipo}`);
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
                } else {
                    x = margin + (usableWidth / (filtrosTexto.length - 1)) * index;
                    align = 'center';
                }

                const textoDividido = doc.splitTextToSize(texto, usableWidth / filtrosTexto.length);
                doc.text(textoDividido, x, 33, { align: align });
            });
        }

        doc.autoTable({
            head: [["Nombre", "Teléfono", "Prospectos", "Contratos", "Equipo"]],
            body: data,
            startY: filtrosTexto.length > 0 ? 38 : 35,
            styles: { fontSize: 8 }
        });

        const nombreArchivo = `reporte_agentes_${hoy.getFullYear()}-${hoy.getMonth()+1}-${hoy.getDate()}.pdf`;
        doc.save(nombreArchivo);

        UI.showAlert('PDF generado correctamente', 'success');
    }

    getTitle() {
        return 'Gestión de Agentes';
    }

    cleanup() {
        this.eventListenersSetup = false;

        if (this.pagination) {
            this.pagination.destroy();
            this.pagination = null;
        }
    }
}

let agentesModule;