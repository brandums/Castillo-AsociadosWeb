class ApiService {
    constructor() {
        this.BASE_URL = API_URL;
        this.cache = new Map();
        this.requestQueue = new Map();
        this.auth = new AuthManager(); // ← INICIALIZAR AUTH MANAGER
    }

    async request(endpoint, options = {}) {
        const url = `${this.BASE_URL}${endpoint}`;
        const cacheKey = `${options.method || 'GET'}:${url}`;
        
        try {
            // OBTENER HEADERS DE AUTENTICACIÓN DEL AUTH MANAGER - CORREGIDO
            const authHeaders = this.auth.getAuthHeaders();
            
            // Configurar headers por defecto COMBINANDO con auth headers
            const headers = {
                ...authHeaders, // ← HEADERS DE AUTH PRIMERO
                ...options.headers // ← HEADERS ESPECÍFICOS DESPUÉS
            };

            const config = {
                ...options,
                headers
            };

            // Mostrar loading si la request tarda más de 500ms
            const loadingTimeout = setTimeout(() => {
                UI.showLoading();
            }, 500);

            const response = await fetch(url, config);
            
            clearTimeout(loadingTimeout);
            UI.hideLoading();

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                
                // Manejar específicamente error 401
                if (response.status === 401) {
                    console.error('❌ Error 401 - No autenticado');
                    this.auth.logout(); // ← USAR EL LOGOUT DEL AUTH MANAGER
                    throw new Error('Sesión expirada. Por favor inicie sesión nuevamente.');
                }
                
                throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            // Cachear respuestas GET exitosas
            if (options.method === undefined || options.method === 'GET') {
                this.cache.set(cacheKey, {
                    data,
                    timestamp: Date.now()
                });
            }

            return data;

        } catch (error) {
            console.error(`❌ API Error [${endpoint}]:`, error);
            
            // No mostrar alerta para errores de redirección
            if (!error.message.includes('Sesión expirada')) {
                UI.showAlert(`Error de conexión: ${error.message}`, 'error');
            }
            throw error;
        }
    }

    // ... el resto de los métodos se mantienen igual ...
    async get(endpoint, useCache = true) {
        const cacheKey = `GET:${this.BASE_URL}${endpoint}`;
        
        if (useCache && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < 30000) {
                return cached.data;
            }
        }

        return this.request(endpoint);
    }

    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async patch(endpoint, data) {
        return this.request(endpoint, {
            method: 'PATCH', 
            body: JSON.stringify(data)
        });
    }

    async delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE'
        });
    }

    // Métodos específicos para la aplicación
    async loadDashboard() {
        return this.get('/dashboard');
    }

    async loadUsers() {
        return this.get('/usuarios/estadisticas-agentes');
    }

    async loadProjects() {
        return this.get('/proyectos');
    }

    async loadClients() {
        return this.get('/clientes');
    }

    async loadTeams() {
        return this.get('/equipos');
    }

    async loadAllProspectos() {
        return this.get('/todoProspectos');
    }

    async loadProspectos() {
        return this.get('/prospectos');
    }

    async loadReservas() {
        return this.get('/reservas-completas');
    }

    async loadContratos() {
        return this.get('/contratos');
    }

    async loadProrrogas() {
        return this.get('/prorrogas');
    }

    async loadClientesFijos() {
        return this.get('/clientes-fijos');
    }

    async loadRanking() {
        return this.get('/contratos/ranking2');
    }

    // Métodos para operaciones específicas
    async cambiarAgenteProspecto(prospectoId, nuevoAgenteId) {
        return this.patch(`/prospectos/${prospectoId}/cambiar-agente`, {
            nuevoAgenteId
        });
    }
    
    async cambiarSeguimientoProspecto(prospectoId, seguimiento) {
        return this.patch(`/prospectos/${prospectoId}/seguimiento`, {
            seguimiento
        });
    }

    async firmarReserva(reservaId, metodoPago, monto) {
        return this.put(`/reservas/${reservaId}/firmar`, {
            metodoPago,
            monto
        });
    }

    async ampliarReserva(reservaId, dias) {
        return this.put(`/reservas/${reservaId}/ampliar`, {
            dias: parseInt(dias)
        });
    }

    async editarLoteReserva(reservaId, nuevoManzano, nuevoTerreno) {
        return this.put(`/reservas/${reservaId}/editar-lote`, {
            nuevoManzano,
            nuevoTerreno
        });
    }

    async ejecutarAccionReserva(reservaId, accion, datos = {}) {
        return this.put(`/reservas/${reservaId}/accion`, {
            accion,
            ...datos
        });
    }

    async crearMuralla(contratoId, metodoPago, monto) {
        return this.post('/contratos/muralla', {
            contratoId,
            metodoPago,
            monto
        });
    }

    async actualizarProrroga(prorrogaId, datos) {
        return this.put(`/prorrogas/${prorrogaId}`, datos);
    }

    // Limpiar cache
    clearCache() {
        this.cache.clear();
    }

    clearEndpointCache(endpoint) {
        const keysToDelete = [];
        for (const [key] of this.cache) {
            if (key.includes(endpoint)) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this.cache.delete(key));
    }
}