class AuthManager {
    constructor() {
        this.user = null;
        this.init();
    }

    init() {
        this.loadUserFromStorage();
    }

    loadUserFromStorage() {
        try {
            const userData = localStorage.getItem('user');
            if (userData) {
                this.user = JSON.parse(userData);
            }
        } catch (error) {
            console.error('Error loading user from storage:', error);
            this.user = null;
        }
    }

    isAuthenticated() {
        return this.user !== null;
    }

    isAdmin() {
        return this.user && this.user.rol === 'Admin';
    }

    isSuperAdmin() {
        return this.user && this.user.rol === 'SuperAdmin';
    }

    isAgente() {
        return this.user && this.user.rol === 'Agente';
    }

    getUser() {
        return this.user;
    }

    setUser(userData) {
        this.user = userData;
        localStorage.setItem('user', JSON.stringify(userData));
    }

    logout() {
        Swal.fire({
            title: '¿Cerrar sesión?',
            text: '¿Estás seguro de que deseas salir del sistema?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Sí, salir',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                localStorage.removeItem('user');
                window.location.href = 'index.html';
            }
        });
    }

    getAuthHeaders() {
        if (!this.user) return {};
        
        return {
            'Content-Type': 'application/json',
            'email': this.user.email,
            'password': this.user.password
        };
    }

    // Nuevo método para aplicar permisos de rol
    applyRolePermissions() {
        const body = document.body;
        
        // Remover clases de rol anteriores
        body.classList.remove('rol-admin', 'rol-superadmin', 'rol-agente');
        
        if (this.user) {
            // Agregar clase según el rol
            switch(this.user.rol) {
                case 'Admin':
                    body.classList.add('rol-admin');
                    break;
                case 'SuperAdmin':
                    body.classList.add('rol-superadmin');
                    break;
                case 'Agente':
                    body.classList.add('rol-agente');
                    break;
                default:
                    body.classList.add('rol-agente'); // Por defecto
            }
        }
    }
}