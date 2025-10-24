// js/core/ui.js
class UIManager {
    constructor() {
        this.modals = new Map();
        this.init();
    }

    init() {
        this.setupGlobalEventListeners();
        this.setupModals();
    }

    setupGlobalEventListeners() {
        // Cerrar modales al hacer click fuera
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target.id);
            }
        });

        // Cerrar modales con ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
    }

    setupModals() {
        // Registrar todos los modales
        document.querySelectorAll('.modal').forEach(modal => {
            this.modals.set(modal.id, modal);
            
            // Configurar botones de cerrar
            modal.querySelectorAll('.close-btn').forEach(btn => {
                btn.addEventListener('click', () => this.closeModal(modal.id));
            });
        });
    }

    // Modal Management
    showModal(modalId) {
        const modal = this.modals.get(modalId);
        if (modal) {
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    }

    closeModal(modalId) {
        const modal = this.modals.get(modalId);
        if (modal) {
            modal.classList.remove('show');
            document.body.style.overflow = '';
        }
    }

    closeAllModals() {
        this.modals.forEach(modal => {
            modal.classList.remove('show');
        });
        document.body.style.overflow = '';
    }

    // Loading States
    showLoading(container = document.body) {
        container.classList.add('loading');
    }

    hideLoading(container = document.body) {
        container.classList.remove('loading');
    }

    setButtonLoading(button, isLoading, loadingText = 'Procesando...') {
        if (!button) return;
        
        if (isLoading) {
            button.dataset.originalText = button.innerHTML;
            button.innerHTML = `
                <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                ${loadingText}
            `;
            button.disabled = true;
        } else {
            if (button.dataset.originalText) {
                button.innerHTML = button.dataset.originalText;
            }
            button.disabled = false;
        }
    }

    // Alert System
    showAlert(message, type = 'success', duration = 3000) {
        const alertContainer = document.getElementById('alertContainer') || this.createAlertContainer();
        
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.innerHTML = `
            <div class="alert-content">
                <i class="fas fa-${this.getAlertIcon(type)}"></i>
                <span>${message}</span>
                <button class="alert-close" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        alertContainer.appendChild(alert);

        // Animar entrada
        setTimeout(() => alert.classList.add('show'), 10);

        // Auto-remover
        if (duration > 0) {
            setTimeout(() => {
                if (alert.parentElement) {
                    alert.classList.remove('show');
                    setTimeout(() => alert.remove(), 300);
                }
            }, duration);
        }

        return alert;
    }

    createAlertContainer() {
        const container = document.createElement('div');
        container.id = 'alertContainer';
        container.className = 'alert-container';
        document.body.appendChild(container);
        return container;
    }

    getAlertIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    // Table Actions Dropdown
    setupTableActions() {
        // ✅ Prevenir duplicados
        if (this.tableActionsInitialized) {
            return;
        }
        this.tableActionsInitialized = true;
        
        document.addEventListener('click', (e) => {
            const toggle = e.target.closest('.actions-toggle');
            if (toggle) {
                const dropdown = toggle.closest('.actions-dropdown');
                
                // ✅ Cerrar todos los demás dropdowns primero
                document.querySelectorAll('.actions-dropdown.show').forEach(otherDropdown => {
                    if (otherDropdown !== dropdown) {
                        otherDropdown.classList.remove('show');
                    }
                });
                
                // ✅ Alternar el dropdown actual
                dropdown.classList.toggle('show');
                e.stopPropagation();
            } else {
                // ✅ Cerrar todos los dropdowns al hacer click fuera
                document.querySelectorAll('.actions-dropdown.show').forEach(dropdown => {
                    dropdown.classList.remove('show');
                });
            }
        });
        
        // ✅ Prevenir que clicks dentro del menú lo cierren
        document.addEventListener('click', (e) => {
            if (e.target.closest('.actions-menu')) {
                e.stopPropagation();
            }
        });
    }

    // Form Helpers
    serializeForm(form) {
        const formData = new FormData(form);
        const data = {};
        
        for (const [key, value] of formData.entries()) {
            data[key] = value;
        }
        
        return data;
    }

    resetForm(form) {
        form.reset();
        // Limpiar clases de validación
        form.querySelectorAll('.is-valid, .is-invalid').forEach(el => {
            el.classList.remove('is-valid', 'is-invalid');
        });
    }

    validateForm(form) {
        let isValid = true;
        const inputs = form.querySelectorAll('[required]');
        
        inputs.forEach(input => {
            if (!input.value.trim()) {
                this.markInvalid(input, 'Este campo es requerido');
                isValid = false;
            } else {
                this.markValid(input);
            }
        });
        
        return isValid;
    }

    markInvalid(input, message) {
        input.classList.add('is-invalid');
        input.classList.remove('is-valid');
        
        let feedback = input.parentElement.querySelector('.invalid-feedback');
        if (!feedback) {
            feedback = document.createElement('div');
            feedback.className = 'invalid-feedback';
            input.parentElement.appendChild(feedback);
        }
        feedback.textContent = message;
    }

    markValid(input) {
        input.classList.add('is-valid');
        input.classList.remove('is-invalid');
        
        const feedback = input.parentElement.querySelector('.invalid-feedback');
        if (feedback) {
            feedback.remove();
        }
    }

    // Pagination
    setupPagination(container, currentPage, totalPages, onPageChange) {
        container.innerHTML = '';
        
        const prevBtn = document.createElement('button');
        prevBtn.className = `page-btn ${currentPage === 1 ? 'disabled' : ''}`;
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        prevBtn.disabled = currentPage === 1;
        prevBtn.addEventListener('click', () => onPageChange(currentPage - 1));
        
        const nextBtn = document.createElement('button');
        nextBtn.className = `page-btn ${currentPage === totalPages ? 'disabled' : ''}`;
        nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.addEventListener('click', () => onPageChange(currentPage + 1));
        
        const pageInfo = document.createElement('span');
        pageInfo.className = 'page-info';
        pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
        
        container.appendChild(prevBtn);
        container.appendChild(pageInfo);
        container.appendChild(nextBtn);
    }

    // Data Table Helpers
    createTableRow(data, columns, actions = []) {
        const row = document.createElement('tr');
        
        columns.forEach(column => {
            const cell = document.createElement('td');
            
            if (column.render) {
                cell.innerHTML = column.render(data);
            } else {
                cell.textContent = data[column.key] || '';
            }
            
            row.appendChild(cell);
        });
        
        // Columna de acciones
        if (actions.length > 0) {
            const actionsCell = document.createElement('td');
            actionsCell.className = 'actions-column';
            
            const dropdown = this.createActionsDropdown(actions, data);
            actionsCell.appendChild(dropdown);
            
            row.appendChild(actionsCell);
        }
        
        return row;
    }

    createActionsDropdown(actions, data) {
        const dropdown = document.createElement('div');
        dropdown.className = 'actions-dropdown';
        
        const toggle = document.createElement('button');
        toggle.className = 'actions-toggle';
        toggle.innerHTML = '<i class="fas fa-ellipsis-v"></i>';
        
        const menu = document.createElement('div');
        menu.className = 'actions-menu';
        
        actions.forEach(action => {
            const item = document.createElement('button');
            item.className = `action-item ${action.class || ''}`;
            item.innerHTML = `
                <i class="fas fa-${action.icon}"></i>
                ${action.label}
            `;
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                action.handler(data);
                dropdown.classList.remove('show');
            });
            menu.appendChild(item);
        });
        
        dropdown.appendChild(toggle);
        dropdown.appendChild(menu);
        
        return dropdown;
    }

    // Utility Methods
    formatDate(dateString) {
        if (!dateString) return 'N/A';
        
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('es-BO', {
            style: 'currency',
            currency: 'BOB'
        }).format(amount);
    }

    debounce(func, wait) {
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
}

// Instancia global para uso fácil
const UI = new UIManager();