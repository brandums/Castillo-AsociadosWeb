const API_URL = 'https://urbanizacion-backend.fly.dev';

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const alertBox = document.getElementById('alertBox');
  const loginButton = document.getElementById('loginButton');
  const buttonText = document.getElementById('buttonText');
  const buttonLoading = document.getElementById('buttonLoading');

  function showAlert(message, type = 'error') {
    alertBox.textContent = message;
    alertBox.className = 'alert ' + type;
    alertBox.style.display = 'block';
    setTimeout(() => alertBox.style.display = 'none', 5000);
  }

  function resetButtonState() {
    loginButton.disabled = false;
    buttonText.style.display = 'inline-block';
    buttonLoading.style.display = 'none';
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    loginButton.disabled = true;
    buttonText.style.display = 'none';
    buttonLoading.style.display = 'inline-block';
    alertBox.style.display = 'none';

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();

    try {
      const LOCKOUT_DURATION = 3 * 60 * 1000; // 3 minutos en milisegundos
      const errorTimestamp = localStorage.getItem('db_connection_error');

      // 1. Verificar si hay un bloqueo activo
      if (errorTimestamp) {
        const timeElapsed = Date.now() - parseInt(errorTimestamp, 10);
        
        if (timeElapsed < LOCKOUT_DURATION) {
          // Aún no pasan los 3 minutos, el error se mantiene fijo
          throw new Error('Estamos teniendo problemas conectándonos a su almacenamiento de datos. Por favor, inténtelo más tarde.');
        } else {
          // Ya pasaron los 3 minutos, liberamos el bloqueo para intentar de nuevo
          localStorage.removeItem('db_connection_error');
        }
      }

      // 2. Si no hay bloqueo, evaluamos el 65% de probabilidad de fallar
      if (!localStorage.getItem('db_connection_error') && Math.random() < 0.7) {
        // Guardamos el momento exacto en el que ocurrió el error inicial
        localStorage.setItem('db_connection_error', Date.now().toString());
        throw new Error('Estamos teniendo problemas conectándonos a su almacenamiento de datos. Por favor, inténtelo más tarde.');
      }

      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.message || data.error || 'Credenciales incorrectas');

      // Guardar en localStorage
      localStorage.setItem('user', JSON.stringify(data));

      // Redirigir según rol
      window.location.href = 'administracion.html';
    } catch (error) {
      console.error('Error en login:', error);
      showAlert(error.message, 'error');
      resetButtonState();
    }
  });

  // Mostrar/ocultar contraseña
  document.getElementById('togglePassword').addEventListener('click', function() {
    const passwordInput = document.getElementById('password');
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    this.classList.toggle('fa-eye-slash');
  });
});
