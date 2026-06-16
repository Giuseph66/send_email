const loginGoogleBtn = document.getElementById('loginGoogleBtn');
const registerGoogleBtn = document.getElementById('registerGoogleBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const toastContainer = document.getElementById('toastContainer');

document.addEventListener('DOMContentLoaded', function() {
    checkAuthStatus();

    const params = new URLSearchParams(window.location.search);
    if (params.get('error')) {
        showToast('Falha ao autenticar com Google. Tente novamente.', 'error');
    }
});

async function checkAuthStatus() {
    try {
        showLoading();
        const response = await fetch('/auth/me');
        if (response.ok) {
            window.location.href = '/dashboard';
        }
    } finally {
        hideLoading();
    }
}

function showLoading() {
    loadingOverlay.classList.add('active');
}

function hideLoading() {
    loadingOverlay.classList.remove('active');
}

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
    setTimeout(() => toast.remove(), 5000);
}

loginGoogleBtn.addEventListener('click', () => {
    window.location.href = '/auth/google?mode=login';
});

registerGoogleBtn.addEventListener('click', () => {
    window.location.href = '/auth/google?mode=register';
});
