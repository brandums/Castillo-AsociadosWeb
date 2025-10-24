// js/core/utils.js
class Utils {
    static calcularDiasRestantes(fecha) {
        if (!fecha) return 0;
        
        const fechaProspecto = new Date(fecha);
        const hoy = new Date();
        const diferencia = hoy.getTime() - fechaProspecto.getTime();
        const dias = Math.floor(diferencia / (1000 * 60 * 60 * 24));
        
        return Math.max(0, 30 - dias); // 30 días para considerar "reciente"
    }

    static esReciente(fecha) {
        return this.calcularDiasRestantes(fecha) >= 7;
    }

    static getBadgeClass(estado) {
        const classes = {
            'aprobado': 'badge-success',
            'rechazado': 'badge-warning',
            'pendiente': 'badge-info',
            'activo': 'badge-success',
            'inactivo': 'badge-danger',
            'reciente': 'badge-primary',
            'antiguo': 'badge-warning',
            'firmado': 'badge-success',
            'activa': 'badge-info',
            'vencido': 'badge-danger',

            'nuevo': 'badge-success',
            'expirado': 'badge-danger'
        };
        
        return classes[estado?.toLowerCase()] || 'badge-secondary';
    }

    static getStatusBadge(estado) {
        const statusMap = {
            'aprobado': { class: 'status-active', text: 'Aprobado' },
            'rechazado': { class: 'status-cancelled', text: 'Rechazado' },
            'pendiente': { class: 'status-pending', text: 'Pendiente' },
            'activo': { class: 'status-active', text: 'Activo' },
            'inactivo': { class: 'status-cancelled', text: 'Inactivo' },
            'firmado': { class: 'status-completed', text: 'Firmado' },
            'activa': { class: 'status-active', text: 'Activa' },
            'vencido': { class: 'status-expired', text: 'Vencido' },

            'nuevo': { class: 'status-active', text: 'Nuevo' },
            'reciente': { class: 'status-active', text: 'Reciente' },
            'antiguo': { class: 'status-pending', text: 'Antiguo' },
            'expirado': { class: 'status-expired', text: 'Expirado' }
        };
        
        const status = statusMap[estado?.toLowerCase()] || { class: 'status-pending', text: estado || 'Desconocido' };
        
        return `<span class="status-badge ${status.class}">${status.text}</span>`;
    }

    static filtrarPorFechas(datos, fechaInicio, fechaFin, campoFecha = 'fecha') {
        if (!fechaInicio && !fechaFin) return datos;
        
        return datos.filter(item => {
            const fechaItem = new Date(item[campoFecha]?.split('T')[0]);
            const desde = fechaInicio ? new Date(fechaInicio) : null;
            const hasta = fechaFin ? new Date(fechaFin) : null;

            return (!desde || fechaItem >= desde) &&
                   (!hasta || fechaItem <= hasta);
        });
    }

    static buscarEnTexto(datos, texto, campos) {
        if (!texto) return datos;
        
        const termino = texto.toLowerCase();
        return datos.filter(item => {
            return campos.some(campo => {
                const valor = item[campo];
                return valor && String(valor).toLowerCase().includes(termino);
            });
        });
    }

    static agruparPor(datos, clave) {
        return datos.reduce((grupos, item) => {
            const key = item[clave];
            if (!grupos[key]) {
                grupos[key] = [];
            }
            grupos[key].push(item);
            return grupos;
        }, {});
    }

    static ordenarPor(datos, campo, direccion = 'asc') {
        return [...datos].sort((a, b) => {
            let aVal = a[campo];
            let bVal = b[campo];
            
            // Manejar fechas
            if (campo.includes('fecha') || campo.includes('Fecha')) {
                aVal = new Date(aVal);
                bVal = new Date(bVal);
            }
            
            // Manejar números
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return direccion === 'asc' ? aVal - bVal : bVal - aVal;
            }
            
            // Manejar strings
            aVal = String(aVal || '').toLowerCase();
            bVal = String(bVal || '').toLowerCase();
            
            if (aVal < bVal) return direccion === 'asc' ? -1 : 1;
            if (aVal > bVal) return direccion === 'asc' ? 1 : -1;
            return 0;
        });
    }

    static paginar(datos, pagina = 1, porPagina = 10) {
        const inicio = (pagina - 1) * porPagina;
        const fin = inicio + porPagina;
        const totalPaginas = Math.ceil(datos.length / porPagina);
        
        return {
            datos: datos.slice(inicio, fin),
            paginaActual: pagina,
            totalPaginas,
            totalRegistros: datos.length,
            hasPrev: pagina > 1,
            hasNext: pagina < totalPaginas
        };
    }

    static exportarCSV(datos, nombreArchivo = 'datos') {
        if (!datos.length) {
            UI.showAlert('No hay datos para exportar', 'warning');
            return;
        }
        
        const cabeceras = Object.keys(datos[0]);
        const filas = datos.map(fila => 
            cabeceras.map(cabecera => {
                const valor = fila[cabecera];
                // Escapar comas y comillas
                return `"${String(valor || '').replace(/"/g, '""')}"`;
            }).join(',')
        );
        
        const csv = [cabeceras.join(','), ...filas].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `${nombreArchivo}_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    static generarPDF(titulo, cabeceras, datos, nombreArchivo = 'reporte') {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Título
        doc.setFontSize(16);
        doc.text(titulo, 14, 20);
        doc.setFontSize(10);
        doc.text(`Generado: ${new Date().toLocaleDateString('es-ES')}`, 14, 28);
        
        // Preparar datos para la tabla
        const datosTabla = datos.map(fila => 
            cabeceras.map(cabecera => fila[cabecera.key] || '')
        );
        
        const cabecerasTexto = cabeceras.map(c => c.text);
        
        // Generar tabla
        doc.autoTable({
            head: [cabecerasTexto],
            body: datosTabla,
            startY: 35,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [67, 97, 238] }
        });
        
        // Guardar PDF
        doc.save(`${nombreArchivo}_${new Date().toISOString().split('T')[0]}.pdf`);
    }

    static async cargarSelect(selectElement, datos, valorKey = 'id', textoKey = 'nombre', opcionTodos = true) {
        selectElement.innerHTML = '';
        
        if (opcionTodos) {
            const option = document.createElement('option');
            option.value = 'todos';
            option.textContent = 'Todos';
            selectElement.appendChild(option);
        }
        
        datos.forEach(item => {
            const option = document.createElement('option');
            option.value = item[valorKey];
            option.textContent = item[textoKey];
            selectElement.appendChild(option);
        });
    }

    static inicializarFiltroProyectos(selectElement, proyectos, onChange) {
        this.cargarSelect(selectElement, proyectos, 'id', 'nombre');
        
        if (onChange) {
            selectElement.addEventListener('change', onChange);
        }
    }

    static crearFiltrosAvanzados(container, filtros, onChange) {
        container.innerHTML = '';
        
        filtros.forEach(filtro => {
            const group = document.createElement('div');
            group.className = 'filter-group';
            
            const label = document.createElement('label');
            label.textContent = filtro.label;
            label.htmlFor = filtro.id;
            
            let input;
            
            switch (filtro.type) {
                case 'select':
                    input = document.createElement('select');
                    input.className = 'form-control';
                    input.id = filtro.id;
                    
                    filtro.options.forEach(opt => {
                        const option = document.createElement('option');
                        option.value = opt.value;
                        option.textContent = opt.text;
                        input.appendChild(option);
                    });
                    break;
                    
                case 'date':
                    input = document.createElement('input');
                    input.type = 'date';
                    input.className = 'form-control';
                    input.id = filtro.id;
                    break;
                    
                case 'text':
                default:
                    input = document.createElement('input');
                    input.type = 'text';
                    input.className = 'form-control';
                    input.id = filtro.id;
                    input.placeholder = filtro.placeholder || '';
            }
            
            if (onChange) {
                input.addEventListener('change', onChange);
                if (filtro.type === 'text') {
                    input.addEventListener('input', Utils.debounce(onChange, 300));
                }
            }
            
            group.appendChild(label);
            group.appendChild(input);
            container.appendChild(group);
        });
    }

    // Debounce utility
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    static formatDate(dateString) {
        if (!dateString) return '-';
        
        try {
            // Limpiar y normalizar la fecha
            const cleanDate = dateString.toString().trim();
            
            // Caso 1: Formato "2025-10-08" o "2025-10-8"
            if (cleanDate.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
                const [year, month, day] = cleanDate.split('-');
                const date = new Date(
                    parseInt(year), 
                    parseInt(month) - 1, 
                    parseInt(day)
                );
                return date.toLocaleDateString('es-ES');
            }
            
            // Caso 2: Formato "8-10-2025" o "08-10-2025" (día-mes-año)
            if (cleanDate.match(/^\d{1,2}-\d{1,2}-\d{4}$/)) {
                const [day, month, year] = cleanDate.split('-');
                const date = new Date(
                    parseInt(year), 
                    parseInt(month) - 1, 
                    parseInt(day)
                );
                return date.toLocaleDateString('es-ES');
            }
            
            // Caso 3: Formato "8/10/2025" o "08/10/2025" (día/mes/año)
            if (cleanDate.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
                const [day, month, year] = cleanDate.split('/');
                const date = new Date(
                    parseInt(year), 
                    parseInt(month) - 1, 
                    parseInt(day)
                );
                return date.toLocaleDateString('es-ES');
            }
            
            // Caso 4: Intentar con Date nativo para otros formatos
            const date = new Date(cleanDate);
            if (!isNaN(date.getTime())) {
                return date.toLocaleDateString('es-ES');
            }
            
            return '-';
            
        } catch (e) {
            console.error('Error formateando fecha:', e, dateString);
            return '-';
        }
    }

    static formatDateTime(dateString) {
        if (!dateString) return '-';
        try {
            if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
                const [year, month, day] = dateString.split('-');
                const date = new Date(year, month - 1, day);
                return date.toLocaleString('es-ES');
            }
            
            const date = new Date(dateString);
            return date.toLocaleString('es-ES');
        } catch (e) {
            return '-';
        }
    }
}


// CLASE DE PAGINACIÓN MEJORADA - GLOBAL
class PaginationManager {
    constructor(config) {
        this.container = config.container;
        this.onPageChange = config.onPageChange;
        this.totalItems = config.totalItems || 0;
        this.currentPage = config.currentPage || 1;
        this.pageSize = config.pageSize || 10;
        this.maxPages = config.maxPages || 3;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.render();
    }
    
    setupEventListeners() {
        this.container.addEventListener('click', (e) => {
            const btn = e.target.closest('.pagination-btn, .pagination-number');
            if (!btn) return;
            
            e.preventDefault();
            
            if (btn.id === 'prevPage') this.previousPage();
            else if (btn.id === 'nextPage') this.nextPage();
            else if (btn.classList.contains('pagination-number')) {
                const page = parseInt(btn.dataset.page);
                if (page) this.goToPage(page);
            }
        });
    }
    
    render() {
        this.totalPages = Math.ceil(this.totalItems / this.pageSize);
        
        if (this.totalPages <= 1) {
            this.container.style.display = 'none';
            return;
        }
        
        this.container.style.display = 'flex';
        this.updateButtons();
        this.generatePageNumbers();
    }
    
    updateButtons() {
        const prevBtn = this.container.querySelector('#prevPage');
        const nextBtn = this.container.querySelector('#nextPage');
        
        if (prevBtn) {
            prevBtn.disabled = this.currentPage === 1;
        }
        if (nextBtn) {
            nextBtn.disabled = this.currentPage === this.totalPages;
        }
    }
    
    generatePageNumbers() {
        const numbersContainer = this.container.querySelector('.pagination-numbers');
        if (!numbersContainer) return;
        
        numbersContainer.innerHTML = '';
        
        if (this.totalPages <= 1) return;
        
        let startPage, endPage;
        
        if (this.totalPages <= this.maxPages) {
            startPage = 1;
            endPage = this.totalPages;
        } else {
            const maxPagesBeforeCurrent = Math.floor(this.maxPages / 2);
            const maxPagesAfterCurrent = Math.ceil(this.maxPages / 2) - 1;
            
            if (this.currentPage <= maxPagesBeforeCurrent) {
                startPage = 1;
                endPage = this.maxPages;
            } else if (this.currentPage + maxPagesAfterCurrent >= this.totalPages) {
                startPage = this.totalPages - this.maxPages + 1;
                endPage = this.totalPages;
            } else {
                startPage = this.currentPage - maxPagesBeforeCurrent;
                endPage = this.currentPage + maxPagesAfterCurrent;
            }
        }
        
        // Agregar primera página y elipsis si es necesario
        if (startPage > 1) {
            this.addPageNumber(numbersContainer, 1);
            if (startPage > 2) {
                this.addEllipsis(numbersContainer);
            }
        }
        
        // Agregar números de página
        for (let i = startPage; i <= endPage; i++) {
            this.addPageNumber(numbersContainer, i);
        }
        
        // Agregar última página y elipsis si es necesario
        if (endPage < this.totalPages) {
            if (endPage < this.totalPages - 1) {
                this.addEllipsis(numbersContainer);
            }
            this.addPageNumber(numbersContainer, this.totalPages);
        }
    }
    
    addPageNumber(container, page) {
        const number = document.createElement('button');
        number.className = `pagination-number ${page === this.currentPage ? 'active' : ''}`;
        number.textContent = page;
        number.dataset.page = page;
        number.title = `Ir a página ${page}`;
        container.appendChild(number);
    }
    
    addEllipsis(container) {
        const ellipsis = document.createElement('span');
        ellipsis.className = 'pagination-ellipsis';
        ellipsis.textContent = '...';
        container.appendChild(ellipsis);
    }
    
    goToPage(page) {
        if (page < 1 || page > this.totalPages || page === this.currentPage) return;
        
        this.currentPage = page;
        this.render();
        
        if (this.onPageChange) {
            this.onPageChange(this.currentPage, this.pageSize);
        }
    }
    
    previousPage() {
        this.goToPage(this.currentPage - 1);
    }
    
    nextPage() {
        this.goToPage(this.currentPage + 1);
    }
    
    update(totalItems, currentPage = 1) {
        this.totalItems = totalItems;
        this.currentPage = currentPage;
        this.render();
    }
    
    destroy() {
        // Limpiar event listeners si es necesario
        this.container.innerHTML = '';
    }
}

// Función helper global para inicializar paginación
function initPagination(containerId, config) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn(`Contenedor de paginación #${containerId} no encontrado`);
        return null;
    }
    
    return new PaginationManager({
        container: container,
        ...config
    });
}