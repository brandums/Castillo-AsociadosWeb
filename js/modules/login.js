//const API_URL = 'https://localhost:7240';
const API_URL = 'https://brandums-001-site1.mtempurl.com';

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
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      let data;
      const text = await response.text();
      try {
          data = text ? JSON.parse(text) : {};
      } catch (e) {
          data = { message: `Error del servidor (${response.status}): ${text || 'Sin respuesta'}` };
      }

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
