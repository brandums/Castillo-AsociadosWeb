class Visitas {
    constructor(app) {
        this.app = app;
        this.datos = [];
        this.proyectos = [];
        this.prospectos = [];
        this.filtros = {
            search: '',
            fechaInicio: '',
            fechaFin: '',
            proyecto: 'todos',
            estado: 'todos'
        };
        this.paginacion = {
            paginaActual: 1,
            porPagina: 10,
            totalPaginas: 1
        };
        this.ordenDescendente = false;
        this.initialized = false;
    }

    async init() {
        this.tableBody = document.getElementById('visitasTableBody');
        this.btnNuevaVisita = document.getElementById('btnNuevaVisita');
        this.formVisita = document.getElementById('formVisita');
        this.btnGuardarVisita = document.getElementById('btnGuardarVisita');

        if (!this.tableBody) return;

        await this.cargarProyectosYProspectos();
        await this.cargarVisitas();

        if (!this.initialized) {
            this.setupEventListeners();
            this.initialized = true;
        }
    }

    // ========== API (fetch directo, sin pasar por api.js) ==========

    async _safeFetch(endpoint) {
        try {
            const url = `${API_URL}${endpoint}`;
            const headers = this.app.auth.getAuthHeaders();
            const res = await fetch(url, { headers });
            if (!res.ok) return [];
            return await res.json();
        } catch (e) {
            console.error(`Error fetching ${endpoint}:`, e);
            return [];
        }
    }

    async _safePost(endpoint, body) {
        const url = `${API_URL}${endpoint}`;
        const headers = this.app.auth.getAuthHeaders();
        const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `Error ${res.status}`);
        }
        return await res.json();
    }

    async _safePut(endpoint, body) {
        const url = `${API_URL}${endpoint}`;
        const headers = this.app.auth.getAuthHeaders();
        const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `Error ${res.status}`);
        }
        return await res.json();
    }

    // ========== CARGA DE DATOS ==========

    async cargarProyectosYProspectos() {
        try {
            this.proyectos = await this._safeFetch('/proyectos');
            const prospectos = await this._safeFetch('/prospectos');

            const user = this.app.auth.getUser();
            if (user.rol === 'Agente') {
                this.prospectos = prospectos.filter(p => p.agenteId === user.id);
            } else {
                this.prospectos = prospectos;
            }

            this.llenarSelects();
            this.llenarFiltroProyectos();
        } catch (error) {
            console.error('Error al cargar datos base:', error);
        }
    }

    llenarSelects() {
        const selectProyecto = document.getElementById('visitaProyecto');
        const selectProspecto = document.getElementById('visitaProspecto');

        if (selectProyecto) {
            let html = '<option value="">Seleccione un proyecto</option>';
            (this.proyectos || []).forEach(p => {
                html += `<option value="${p.id}">${p.nombre}</option>`;
            });
            selectProyecto.innerHTML = html;
        }

        if (selectProspecto) {
            let html = '<option value="">Seleccione un prospecto</option>';
            
            // Para admin, priorizar prospectos recientes (últimos 60 días) para máxima velocidad
            const hoy = new Date();
            let lista = this.prospectos || [];
            
            const user = this.app.auth.getUser();
            if (user && user.rol !== 'Agente') {
                const recientes = lista.filter(p => {
                    if (!p.fecha) return false;
                    const d = new Date(p.fecha);
                    return (hoy - d) / (1000 * 60 * 60 * 24) <= 60;
                });
                lista = recientes.length > 0 ? recientes : lista.slice(0, 300);
            }

            lista.forEach(p => {
                html += `<option value="${p.id}">${p.nombre} ${p.apellido}</option>`;
            });
            selectProspecto.innerHTML = html;
        }
    }

    llenarFiltroProyectos() {
        const select = document.getElementById('filtroProyectoVisitas');
        if (!select) return;
        let html = '<option value="todos">Todos los proyectos</option>';
        (this.proyectos || []).forEach(p => {
            html += `<option value="${p.id}">${p.nombre}</option>`;
        });
        select.innerHTML = html;
    }

    async cargarVisitas() {
        try {
            this.datos = await this._safeFetch('/visitas');
            this.renderTable();
        } catch (error) {
            console.error('Error al cargar visitas:', error);
            this.datos = [];
            this.renderTable();
        }
    }

    // ========== FILTROS Y BÚSQUEDA ==========

    aplicarFiltros() {
        let resultado = [...(this.datos || [])];

        // Búsqueda textual
        if (this.filtros.search) {
            const term = this.filtros.search.toLowerCase();
            resultado = resultado.filter(v =>
                (v.prospectName || '').toLowerCase().includes(term) ||
                (v.projectName || '').toLowerCase().includes(term) ||
                (v.agentName || '').toLowerCase().includes(term)
            );
        }

        // Filtro por proyecto
        if (this.filtros.proyecto !== 'todos') {
            resultado = resultado.filter(v => String(v.projectId) === String(this.filtros.proyecto));
        }

        // Filtro por estado
        if (this.filtros.estado !== 'todos') {
            resultado = resultado.filter(v => String(v.status) === String(this.filtros.estado));
        }

        // Filtro por fechas
        if (this.filtros.fechaInicio) {
            const desde = new Date(this.filtros.fechaInicio);
            resultado = resultado.filter(v => new Date(v.visitDate) >= desde);
        }
        if (this.filtros.fechaFin) {
            const hasta = new Date(this.filtros.fechaFin);
            hasta.setHours(23, 59, 59);
            resultado = resultado.filter(v => new Date(v.visitDate) <= hasta);
        }

        // Ordenamiento
        resultado.sort((a, b) => {
            const dateA = new Date(a.visitDate);
            const dateB = new Date(b.visitDate);
            return this.ordenDescendente ? dateA - dateB : dateB - dateA;
        });

        return resultado;
    }

    actualizarIndicadorFiltros() {
        const btn = document.getElementById('btnFiltrosVisitas');
        if (!btn) return;
        const tieneFiltros = this.filtros.fechaInicio || this.filtros.fechaFin ||
            this.filtros.proyecto !== 'todos' || this.filtros.estado !== 'todos';
        if (tieneFiltros) {
            btn.classList.add('btn-filtros-activos');
        } else {
            btn.classList.remove('btn-filtros-activos');
        }
    }

    // ========== RENDERIZADO ==========

    renderTable() {
        if (!this.tableBody) return;

        const filtrados = this.aplicarFiltros();

        // Paginación
        this.paginacion.totalPaginas = Math.max(1, Math.ceil(filtrados.length / this.paginacion.porPagina));
        if (this.paginacion.paginaActual > this.paginacion.totalPaginas) {
            this.paginacion.paginaActual = this.paginacion.totalPaginas;
        }

        const inicio = (this.paginacion.paginaActual - 1) * this.paginacion.porPagina;
        const paginados = filtrados.slice(inicio, inicio + this.paginacion.porPagina);

        this.tableBody.innerHTML = '';

        if (paginados.length === 0) {
            this.tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="table-empty">
                        <i class="fas fa-car"></i>
                        <h3>No se encontraron visitas</h3>
                        <p>No hay visitas que coincidan con los filtros aplicados.</p>
                    </td>
                </tr>
            `;
            this.renderPagination();
            return;
        }

        paginados.forEach(v => {
            const fecha = new Date(v.visitDate);
            const dateStr = fecha.toLocaleDateString();
            const timeStr = fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            let estadoClass = v.status === 0 ? 'success' : (v.status === 1 ? 'primary' : 'danger');
            let estadoText = v.status === 0 ? 'PROGRAMADA' : (v.status === 1 ? 'COMPLETADA' : 'CANCELADA');

            // Acciones dropdown
            let accionesMenu = '';
            if (v.status === 0) {
                accionesMenu = `
                    <button class="action-item" data-action="cancelar" data-id="${v.id}">
                        <i class="fas fa-times"></i> Cancelar Visita
                    </button>`;
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="mobile-cell-content">
                        <div class="main-info">${v.prospectName}</div>
                        <div class="mobile-secondary-info">
                            <span class="mobile-extra"><i class="fas fa-user-tie"></i> ${v.agentName}</span>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="mobile-cell-content">
                        <div class="main-info">${v.projectName}</div>
                        <div class="mobile-secondary-info">
                            <span class="mobile-extra"><i class="fas fa-calendar"></i> ${dateStr}</span>
                            <span class="mobile-extra"><i class="fas fa-clock"></i> ${timeStr}</span>
                        </div>
                    </div>
                </td>
                <td class="col-hide-mobile">${dateStr}</td>
                <td class="col-hide-mobile">${timeStr}</td>
                <td class="col-hide-mobile">${v.agentName}</td>
                <td>
                    <span class="badge badge-${estadoClass}">${estadoText}</span>
                </td>
                <td class="actions-column">
                    <div class="actions-dropdown">
                        <button class="actions-toggle">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                        <div class="actions-menu">
                            <button class="action-item" data-action="ver-mas" data-id="${v.id}">
                                <i class="fas fa-eye"></i> Ver más
                            </button>
                            ${accionesMenu}
                        </div>
                    </div>
                </td>
            `;
            this.tableBody.appendChild(tr);
        });

        this.renderPagination();
    }

    // ========== PAGINACIÓN ==========

    renderPagination() {
        const container = document.getElementById('pageNumbersVisitas');
        const prevBtn = document.getElementById('prevPageVisitas');
        const nextBtn = document.getElementById('nextPageVisitas');

        if (!container) return;

        container.innerHTML = '';

        const total = this.paginacion.totalPaginas;
        const actual = this.paginacion.paginaActual;

        if (prevBtn) prevBtn.disabled = actual <= 1;
        if (nextBtn) nextBtn.disabled = actual >= total;

        // Mostrar máximo 5 páginas
        let start = Math.max(1, actual - 2);
        let end = Math.min(total, start + 4);
        if (end - start < 4) start = Math.max(1, end - 4);

        for (let i = start; i <= end; i++) {
            const btn = document.createElement('button');
            btn.className = `pagination-btn ${i === actual ? 'active' : ''}`;
            btn.textContent = i;
            btn.addEventListener('click', () => {
                this.paginacion.paginaActual = i;
                this.renderTable();
            });
            container.appendChild(btn);
        }
    }

    // ========== EXPORTAR ==========

    exportarVisitas() {
        const filtrados = this.aplicarFiltros();
        if (filtrados.length === 0) {
            UI.showAlert('No hay datos para exportar', 'warning');
            return;
        }

        // Crear CSV
        let csv = 'ID,Fecha,Hora,Proyecto,Prospecto,Agente,Estado\n';
        filtrados.forEach(v => {
            const fecha = new Date(v.visitDate);
            const dateStr = fecha.toLocaleDateString();
            const timeStr = fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const estado = v.status === 0 ? 'Programada' : (v.status === 1 ? 'Completada' : 'Cancelada');
            csv += `${v.id},"${dateStr}","${timeStr}","${v.projectName}","${v.prospectName}","${v.agentName}","${estado}"\n`;
        });

        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `visitas_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);

        UI.showAlert('Exportación exitosa', 'success');
    }

    // ========== VER DETALLES ==========

    verDetalles(id) {
        const v = this.datos.find(x => x.id === id);
        if (!v) return;

        const fecha = new Date(v.visitDate);
        const dateStr = fecha.toLocaleDateString();
        const timeStr = fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const estado = v.status === 0 ? 'Programada' : (v.status === 1 ? 'Completada' : 'Cancelada');

        Swal.fire({
            title: 'Detalles de la Visita',
            html: `
                <div style="text-align: left; line-height: 2;">
                    <p><strong><i class="fas fa-hashtag"></i> ID:</strong> ${v.id}</p>
                    <p><strong><i class="fas fa-calendar"></i> Fecha:</strong> ${dateStr}</p>
                    <p><strong><i class="fas fa-clock"></i> Hora:</strong> ${timeStr}</p>
                    <p><strong><i class="fas fa-building"></i> Proyecto:</strong> ${v.projectName}</p>
                    <p><strong><i class="fas fa-user"></i> Prospecto:</strong> ${v.prospectName}</p>
                    <p><strong><i class="fas fa-user-tie"></i> Agente:</strong> ${v.agentName}</p>
                    <p><strong><i class="fas fa-info-circle"></i> Estado:</strong> ${estado}</p>
                </div>
            `,
            confirmButtonText: 'Cerrar',
            width: 500
        });
    }

    // ========== EVENT LISTENERS ==========

    setupEventListeners() {
        // Botón nueva visita
        if (this.btnNuevaVisita) {
            this.btnNuevaVisita.addEventListener('click', () => {
                if (this.formVisita) this.formVisita.reset();
                UI.showModal('modalVisita');
            });
        }

        // Botón guardar visita
        if (this.btnGuardarVisita) {
            this.btnGuardarVisita.addEventListener('click', (e) => {
                e.preventDefault();
                this.guardarVisita();
            });
        }

        // Búsqueda con debounce
        const searchInput = document.getElementById('visitasSearch');
        if (searchInput) {
            let timeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    this.filtros.search = e.target.value;
                    this.paginacion.paginaActual = 1;
                    this.renderTable();
                }, 300);
            });
        }

        // Botón voltear
        const btnVoltear = document.getElementById('btnVoltearVisitas');
        if (btnVoltear) {
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

        // Botón filtros - abrir modal
        const btnFiltros = document.getElementById('btnFiltrosVisitas');
        if (btnFiltros) {
            btnFiltros.addEventListener('click', () => {
                UI.showModal('modalFiltrosVisitas');
            });
        }

        // Botón aplicar filtros
        const btnAplicar = document.getElementById('btnAplicarFiltrosVisitas');
        if (btnAplicar) {
            btnAplicar.addEventListener('click', () => {
                this.filtros.fechaInicio = document.getElementById('fechaInicioVisitas').value;
                this.filtros.fechaFin = document.getElementById('fechaFinVisitas').value;
                this.filtros.proyecto = document.getElementById('filtroProyectoVisitas').value;
                this.filtros.estado = document.getElementById('filtroEstadoVisitas').value;
                this.paginacion.paginaActual = 1;
                this.actualizarIndicadorFiltros();
                this.renderTable();
                UI.closeModal('modalFiltrosVisitas');
            });
        }

        // Botón limpiar filtros
        const btnLimpiar = document.getElementById('btnLimpiarFiltrosVisitas');
        if (btnLimpiar) {
            btnLimpiar.addEventListener('click', () => {
                this.filtros.fechaInicio = '';
                this.filtros.fechaFin = '';
                this.filtros.proyecto = 'todos';
                this.filtros.estado = 'todos';
                document.getElementById('fechaInicioVisitas').value = '';
                document.getElementById('fechaFinVisitas').value = '';
                document.getElementById('filtroProyectoVisitas').value = 'todos';
                document.getElementById('filtroEstadoVisitas').value = 'todos';
                this.actualizarIndicadorFiltros();
                this.paginacion.paginaActual = 1;
                this.renderTable();
            });
        }

        // Botón exportar
        const btnExportar = document.getElementById('exportVisitas');
        if (btnExportar) {
            btnExportar.addEventListener('click', () => this.exportarVisitas());
        }

        // Paginación
        const prevBtn = document.getElementById('prevPageVisitas');
        const nextBtn = document.getElementById('nextPageVisitas');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (this.paginacion.paginaActual > 1) {
                    this.paginacion.paginaActual--;
                    this.renderTable();
                }
            });
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (this.paginacion.paginaActual < this.paginacion.totalPaginas) {
                    this.paginacion.paginaActual++;
                    this.renderTable();
                }
            });
        }

        // Click en acciones de la tabla (dropdown)
        if (this.tableBody) {
            this.tableBody.addEventListener('click', (e) => {
                const actionItem = e.target.closest('.action-item');
                if (actionItem) {
                    const action = actionItem.getAttribute('data-action');
                    const id = parseInt(actionItem.getAttribute('data-id'), 10);

                    // Cerrar dropdown
                    const dropdown = actionItem.closest('.actions-dropdown');
                    if (dropdown) dropdown.classList.remove('show');

                    if (action === 'cancelar') this.cancelarVisita(id);
                    if (action === 'ver-mas') this.verDetalles(id);
                }
            });
        }
    }

    // ========== GUARDAR VISITA ==========

    async guardarVisita() {
        const fecha = document.getElementById('visitaFecha').value;
        const hora = document.getElementById('visitaHora').value;
        const proyectoId = document.getElementById('visitaProyecto').value;
        const prospectoId = document.getElementById('visitaProspecto').value;

        if (!fecha || !hora || !proyectoId || !prospectoId) {
            UI.showAlert('Complete todos los campos', 'warning');
            return;
        }

        // Enviar fecha-hora SIN convertir a UTC para evitar desfase de zona horaria
        // El servidor no usa hora boliviana, así que enviamos la hora tal cual
        const visitDate = `${fecha}T${hora}:00`;

        try {
            await this._safePost('/visitas', {
                visitDate: visitDate,
                projectId: parseInt(proyectoId),
                prospectId: parseInt(prospectoId)
            });

            UI.closeModal('modalVisita');
            UI.showAlert('Visita programada exitosamente', 'success');
            await this.cargarVisitas();

            // Abrir WhatsApp
            const selectProspecto = document.getElementById('visitaProspecto');
            const selectProyecto = document.getElementById('visitaProyecto');
            const prospectoName = selectProspecto.options[selectProspecto.selectedIndex].text;
            const proyectoName = selectProyecto.options[selectProyecto.selectedIndex].text;
            const user = this.app.auth.getUser();
            const agenteName = user.nombre + ' ' + user.apellido;

            const mensaje = `Buen día, se informa que el día ${fecha} a las ${hora} queda agendado una visita a ${proyectoName} a cargo del agente ${agenteName}, para el prospecto ${prospectoName}`;
            const url = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
            window.open(url, '_blank');

        } catch (error) {
            UI.showAlert(error.message || 'Error al programar visita', 'error');
        }
    }

    // ========== CANCELAR VISITA ==========

    async cancelarVisita(id) {
        const result = await Swal.fire({
            title: '¿Cancelar visita?',
            text: '¿Está seguro de cancelar esta visita?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, cancelar',
            cancelButtonText: 'No'
        });

        if (!result.isConfirmed) return;

        try {
            await this._safePut(`/visitas/${id}/cancelar`, {});

            const visita = this.datos.find(v => v.id === id);

            UI.showAlert('Visita cancelada exitosamente', 'success');
            await this.cargarVisitas();

            if (visita) {
                const fechaObj = new Date(visita.visitDate);
                const fecha = fechaObj.toLocaleDateString();
                const hora = fechaObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                const mensaje = `Buen día, se informa que la visita programada para el día ${fecha} a las ${hora} en ${visita.projectName} con el prospecto ${visita.prospectName} a cargo de ${visita.agentName} ha sido CANCELADA.`;
                const url = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
                window.open(url, '_blank');
            }

        } catch (error) {
            UI.showAlert(error.message || 'Error al cancelar visita', 'error');
        }
    }
}