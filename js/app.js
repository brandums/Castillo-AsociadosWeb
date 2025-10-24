// js/app.js - VERSIÓN CORREGIDA
class App {
    constructor() {
        this.auth = new AuthManager();
        this.api = new ApiService();
        this.ui = new UIManager();
        this.currentModule = null;
        
        this.modules = {
            dashboard: null,
            prospectos: null,
            clientes: null,
            agentes: null,
            contratos: null,
            equipos: null,
            prorrogas: null,
            ranking: null,
            reservas: null
        };

        this.globalData = {
            usuarios: [],
            proyectos: [],
            clientes: [],
            equipos: [],
            prospectos: [],
            reservas: [],
            contratos: [],
            prorrogas: []
        };

        this.dataLoaded = false;
        this.dataLoading = false;
    }

    async init() {
        if (this.initialized) {
            return;
        }

        // Verificar autenticación PRIMERO
        if (!this.auth.isAuthenticated()) {
            window.location.href = 'index.html';
            return;
        }

        try {
            this.auth.applyRolePermissions();

            // Configurar UI inmediatamente (SIDEBAR DEBE FUNCIONAR INMEDIATAMENTE)
            this.setupUI();
            this.setupEventListeners();
            UI.setupTableActions();

            this.redirectIfNoPermission();

            await this.showModule('dashboard');

            this.loadGlobalDataInBackground();

            this.initialized = true;
        } catch (error) {
            console.error('❌ Error inicializando aplicación:', error);
            UI.showAlert('Error al cargar algunos componentes', 'warning');
        }
    }

    redirectIfNoPermission() {
        const currentModule = this.getCurrentModuleFromURL();
        
        if (this.auth.isAgente()) {
            const modulesProhibidos = ['agentes', 'equipos'];
            if (modulesProhibidos.includes(currentModule)) {
                this.showModule('dashboard');
                UI.showAlert('No tienes permisos para acceder a este módulo', 'warning');
            }
        }
    }

    getCurrentModuleFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('module') || 'dashboard';
    }


    async loadGlobalDataInBackground() {
        try {
            // Cargar datos para otros módulos sin bloquear la UI
            const loadPromises = [
                this.api.loadUsers().then(users => this.globalData.usuarios = users),
                this.api.loadProjects().then(projects => this.globalData.proyectos = projects),
                this.api.loadClients().then(clients => this.globalData.clientes = clients),
                this.api.loadTeams().then(teams => this.globalData.equipos = teams),
                this.api.loadProspectos().then(prospectos => this.globalData.prospectos = prospectos),
                this.api.loadReservas().then(reservas => this.globalData.reservas = reservas),
                this.api.loadContratos().then(contratos => this.globalData.contratos = contratos),
                this.api.loadProrrogas().then(prorrogas => this.globalData.prorrogas = prorrogas)
            ];

            // No esperamos a que terminen, se cargan en segundo plano
            Promise.allSettled(loadPromises).then(results => {
                this.dataLoaded = true;
            });

        } catch (error) {
            console.error('❌ Error cargando datos en segundo plano:', error);
        }
    }

    // MÉTODOS PARA ACCEDER A DATOS GLOBALES
    getAgentes() {
        return this.globalData.usuarios;
    }

    getProyectos() {
        return this.globalData.proyectos;
    }

    getClientes() {
        return this.globalData.clientes;
    }

    getEquipos() {
        return this.globalData.equipos;
    }

    getProspectos() {
        return this.globalData.prospectos;
    }

    getContratos() {
        return this.globalData.contratos;
    }

    getReservas() {
        return this.globalData.reservas;
    }

    // MÉTODO PARA ACTUALIZAR DATOS GLOBALES (cuando hay cambios)
    async refreshGlobalData(dataType = null) {
        try {
            if (!dataType || dataType === 'usuarios') {
                this.api.clearEndpointCache('/usuarios');
                this.globalData.usuarios = await this.api.loadUsers();
            }
            if (!dataType || dataType === 'proyectos') {
                this.api.clearEndpointCache('/proyectos');
                this.globalData.proyectos = await this.api.loadProjects();
            }
            if (!dataType || dataType === 'clientes') {
                this.api.clearEndpointCache('/clientes');
                this.globalData.clientes = await this.api.loadClients();
            }
            if (!dataType || dataType === 'equipos') {
                this.api.clearEndpointCache('/equipos');
                this.globalData.equipos = await this.api.loadTeams();
            }
            if (!dataType || dataType === 'prospectos') {
                this.api.clearEndpointCache('/prospectos');
                this.globalData.prospectos = await this.api.loadProspectos();
            }
            if (!dataType || dataType === 'contratos') {
                this.api.clearEndpointCache('/contratos');
                this.globalData.contratos = await this.api.loadContratos();
            }
            if (!dataType || dataType === 'reservas') {
                this.api.clearEndpointCache('/reservas');
                this.globalData.reservas = await this.api.loadReservas();
            }
        } catch (error) {
            console.error('❌ Error actualizando datos globales:', error);
            throw error;
        }
    }

    setupUI() {
        // Configurar nombre de usuario
        const user = this.auth.getUser();
        if (user) {
            const userNameElement = document.getElementById('userName');
            if (userNameElement) {
                userNameElement.textContent = `${user.nombre} ${user.apellido}`;
            }
        }

        // Inicializar módulos BÁSICOS
        this.modules.dashboard = new Dashboard(this);
        this.modules.prospectos = new Prospectos(this);
        this.modules.clientes = new Clientes(this);
        this.modules.agentes = new Agentes(this);
        this.modules.contratos = new Contratos(this);
        this.modules.equipos = new Equipos(this);
        this.modules.prorrogas = new Prorrogas(this);
        this.modules.ranking = new Ranking(this);
        this.modules.reservas = new Reservas(this);

        // Configurar sidebar toggle
        this.setupSidebarToggle();
    }

    setupEventListeners() {
        // Navegación del sidebar
        const navItems = document.querySelectorAll('.nav-item');
        
        navItems.forEach((item) => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const tab = item.getAttribute('data-tab');
                this.showModule(tab);
            });
        });

        // Logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.auth.logout();
            });
        }
    }

    setupSidebarToggle() {
        const toggleBtn = document.querySelector('.sidebar-toggle');
        const body = document.body;

        if (!toggleBtn) {
            console.warn('No se encontró el botón del sidebar');
            return;
        }

        // Solo guardar estado de "collapsed" en escritorio
        const savedState = localStorage.getItem('sidebarCollapsed');
        if (savedState === 'true' && window.innerWidth > 1024) {
            body.classList.add('sidebar-collapsed');
        }

        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (window.innerWidth <= 1024) {
                // 📱 En móvil → abrir/cerrar overlay
                body.classList.toggle('sidebar-open');
            } else {
                // 💻 En escritorio → colapsar/expandir
                body.classList.toggle('sidebar-collapsed');
                const isCollapsed = body.classList.contains('sidebar-collapsed');
                localStorage.setItem('sidebarCollapsed', isCollapsed);
            }
        });

        // Cerrar sidebar en móvil si se hace clic afuera
        document.addEventListener('click', (event) => {
            if (body.classList.contains('sidebar-open')) {
                const sidebar = document.querySelector('.sidebar');
                if (sidebar && !sidebar.contains(event.target) && !toggleBtn.contains(event.target)) {
                    body.classList.remove('sidebar-open');
                }
            }
        });
    }

    async showModule(moduleName) {
        if (!this.hasPermission(moduleName)) {
            UI.showAlert('No tienes permisos para acceder a este módulo', 'warning');
            moduleName = 'dashboard'; // Redirigir al dashboard
        }

        // Ocultar todos los tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });

        // Mostrar nuevo tab
        const tabElement = document.getElementById(`${moduleName}Tab`);
        if (tabElement) {
            tabElement.classList.add('active');
        }

        // Actualizar navegación
        this.updateNavigation(moduleName);

        // Inicializar módulo si existe
        if (this.modules[moduleName] && this.modules[moduleName].init) {
            try {
                await this.modules[moduleName].init();
                this.currentModule = this.modules[moduleName];
            } catch (error) {
                console.error(`❌ Error en módulo ${moduleName}:`, error);
            }
        }
    }

    hasPermission(moduleName) {
        const user = this.auth.getUser();
        if (!user) return false;

        // Definir permisos por rol
        const permissions = {
            'agente': ['dashboard', 'prospectos', 'clientes', 'reservas', 'contratos', 'prorrogas', 'ranking'],
            'admin': ['dashboard', 'prospectos', 'clientes', 'agentes', 'reservas', 'contratos', 'prorrogas', 'equipos', 'ranking'],
            'superadmin': ['dashboard', 'prospectos', 'clientes', 'agentes', 'reservas', 'contratos', 'prorrogas', 'equipos', 'ranking']
        };

        const userRole = user.rol.toLowerCase();
        return permissions[userRole] && permissions[userRole].includes(moduleName);
    }

    updateNavigation(moduleName) {
        // Actualizar navegación
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const navItem = document.querySelector(`[data-tab="${moduleName}"]`);
        if (navItem) {
            navItem.classList.add('active');
        }

        // Actualizar título
        const pageTitle = document.querySelector('.page-title');
        if (pageTitle) {
            const titles = {
                'dashboard': 'Dashboard',
                'prospectos': 'Prospectos', 
                'clientes': 'Clientes',
                'agentes': 'Agentes',
                'reservas': 'Reservas',
                'contratos': 'Contratos',
                'prorrogas': 'Prórrogas', 
                'equipos': 'Equipos',
                'ranking': 'Ranking'
            };
            pageTitle.textContent = titles[moduleName] || 'Dashboard';
        }

        if (window.innerWidth <= 1024) {
            document.body.classList.remove('sidebar-open');
        }
    }
}

// Inicializar aplicación
document.addEventListener('DOMContentLoaded', async () => {
    try {
        window.app = new App();
        await app.init();
    } catch (error) {
        console.error('💥 Error crítico:', error);
    }
});