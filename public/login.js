// Configurações
const API_BASE_URL = 'http://localhost:3500';

// Elementos DOM
const loginForm = document.getElementById('loginForm');
const loadingOverlay = document.getElementById('loadingOverlay');
const toastContainer = document.getElementById('toastContainer');

// Credenciais padrão
const DEFAULT_CREDENTIALS = {
    username: 'jesus_ateu',
    password: '123456'
};

// Verificar se já está logado
document.addEventListener('DOMContentLoaded', function() {
    checkAuthStatus();
});

// Verificar status de autenticação
function checkAuthStatus() {
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    const authTimestamp = localStorage.getItem('authTimestamp');
    
    // Verificar se o token ainda é válido (24 horas)
    if (isAuthenticated && authTimestamp) {
        const now = Date.now();
        const authTime = parseInt(authTimestamp);
        const hoursDiff = (now - authTime) / (1000 * 60 * 60);
        
        if (hoursDiff < 24) {
            // Token ainda válido, redirecionar para dashboard
            window.location.href = '/dashboard';
            return;
        } else {
            // Token expirado, limpar dados
            clearAuthData();
        }
    }
}

// Toggle password visibility
function togglePassword() {
    const passwordInput = document.getElementById('password');
    const toggleBtn = document.querySelector('.toggle-password i');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleBtn.className = 'fas fa-eye-slash';
    } else {
        passwordInput.type = 'password';
        toggleBtn.className = 'fas fa-eye';
    }
}

// Loading functions
function showLoading() {
    loadingOverlay.classList.add('active');
}

function hideLoading() {
    loadingOverlay.classList.remove('active');
}

// Toast notifications
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Remover toast após 5 segundos
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

// Validar credenciais
function validateCredentials(username, password) {
    // Verificar credenciais padrão
    if (username === 'admin' && password === 'admin123') {
        showToast('Acha mesmo que você é o admin?', 'error');
        return false;
    }
    if (username === DEFAULT_CREDENTIALS.username && password === DEFAULT_CREDENTIALS.password) {
        return true;
    }
    
    // Aqui você pode adicionar validação adicional se necessário
    // Por exemplo, verificar contra uma API ou banco de dados
    
    return false;
}

// Salvar dados de autenticação
function saveAuthData(username) {
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('authUsername', username);
    localStorage.setItem('authTimestamp', Date.now().toString());
}

// Limpar dados de autenticação
function clearAuthData() {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('authUsername');
    localStorage.removeItem('authTimestamp');
}

// Processar login
async function processLogin(username, password, remember) {
    try {
        showLoading();
        
        // Simular delay de rede
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Validar credenciais
        if (validateCredentials(username, password)) {
            // Salvar dados de autenticação
            saveAuthData(username);
            
            showToast('Login realizado com sucesso!', 'success');
            
            // Redirecionar após um breve delay
            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 1000);
            
        } else {
            throw new Error('Credenciais inválidas');
        }
        
    } catch (error) {
        showToast('Erro no login: ' + error.message, 'error');
        
        // Adicionar classe de erro aos campos
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        
        usernameInput.parentElement.classList.add('error');
        passwordInput.parentElement.classList.add('error');
        
        // Limpar classes de erro após 3 segundos
        setTimeout(() => {
            usernameInput.parentElement.classList.remove('error');
            passwordInput.parentElement.classList.remove('error');
        }, 3000);
        
    } finally {
        hideLoading();
    }
}

// Event listener para o formulário de login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(loginForm);
    const username = formData.get('username').trim();
    const password = formData.get('password');
    const remember = formData.get('remember') === 'on';
    
    // Validação básica
    if (!username || !password) {
        showToast('Por favor, preencha todos os campos', 'error');
        return;
    }
    
    // Processar login
    await processLogin(username, password, remember);
});

// Event listeners para validação em tempo real
document.getElementById('username').addEventListener('input', function() {
    this.parentElement.classList.remove('error');
});

document.getElementById('password').addEventListener('input', function() {
    this.parentElement.classList.remove('error');
});

// Prevenir envio do formulário ao pressionar Enter no campo de senha
document.getElementById('password').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        loginForm.dispatchEvent(new Event('submit'));
    }
});

// Função para logout (pode ser chamada de outras páginas)
function logout() {
    clearAuthData();
    window.location.href = '/login';
}

// Função para verificar se está autenticado (para outras páginas)
function isAuthenticated() {
    const isAuth = localStorage.getItem('isAuthenticated');
    const authTimestamp = localStorage.getItem('authTimestamp');
    
    if (!isAuth || !authTimestamp) {
        return false;
    }
    
    // Verificar se o token ainda é válido (24 horas)
    const now = Date.now();
    const authTime = parseInt(authTimestamp);
    const hoursDiff = (now - authTime) / (1000 * 60 * 60);
    
    return hoursDiff < 24;
}

// Função para obter dados do usuário autenticado
function getAuthUser() {
    return {
        username: localStorage.getItem('authUsername'),
        isAuthenticated: isAuthenticated()
    };
}

// Exportar funções para uso em outras páginas
window.logout = logout;
window.isAuthenticated = isAuthenticated;
window.getAuthUser = getAuthUser; 