// js/common.js
// Configuración global de la aplicación
const API_URL = 'https://urbanizacion-backend.fly.dev'; // Reemplaza con tu URL real

// Función para formatear fechas
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

// Función para calcular días restantes
function calcularDiasRestantes(fecha) {
    if (!fecha) return 0;
    
    const fechaProspecto = new Date(fecha);
    const hoy = new Date();
    const diferencia = hoy.getTime() - fechaProspecto.getTime();
    const dias = Math.floor(diferencia / (1000 * 60 * 60 * 24));
    
    return Math.max(0, 30 - dias);
}

// Función para verificar si es reciente
function esReciente(fecha) {
    return calcularDiasRestantes(fecha) >= 7;
}

// Función para obtener clase de badge según estado
function getBadgeClass(estado) {
    const classes = {
        'aprobado': 'badge-success',
        'rechazado': 'badge-warning',
        'pendiente': 'badge-info',
        'activo': 'badge-success',
        'inactivo': 'badge-danger',
        'reciente': 'badge-success',
        'antiguo': 'badge-warning',
        'firmado': 'badge-success',
        'activa': 'badge-info',
        'vencido': 'badge-danger'
    };
    
    return classes[estado?.toLowerCase()] || 'badge-secondary';
}

// Mostrar alertas con SweetAlert2
function showAlert(message, type = 'success') {
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer);
            toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });

    Toast.fire({
        icon: type,
        title: message
    });
}

// Función para setear botón en estado loading
function setButtonLoading(button, isLoading, loadingText = 'Procesando...') {
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