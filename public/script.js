const API_BASE_URL = window.location.origin;
const navButtons = document.querySelectorAll('.nav-btn');
const tabContents = document.querySelectorAll('.tab-content');
const loadingOverlay = document.getElementById('loadingOverlay');
const toastContainer = document.getElementById('toastContainer');

let usuarioAtual = null;
let historicoEmails = [];
let pendingEmailData = null;

document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    showLoading();
    try {
        usuarioAtual = await apiRequest('/auth/me');
        document.getElementById('userDisplay').textContent = usuarioAtual.name || usuarioAtual.email;
        renderizarContaGoogle();
        await carregarHistorico();
    } catch (error) {
        window.location.href = '/login';
    } finally {
        hideLoading();
    }
}

navButtons.forEach(button => {
    button.addEventListener('click', () => {
        const targetTab = button.getAttribute('data-tab');
        navButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        tabContents.forEach(content => content.classList.remove('active'));
        document.getElementById(targetTab).classList.add('active');
    });
});

function showModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
});

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

async function apiRequest(endpoint, options = {}) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Erro na requisição');
    }
    return data;
}

function renderizarContaGoogle() {
    const container = document.getElementById('googleAccountContainer');

    if (!usuarioAtual || !usuarioAtual.googleConnected) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fab fa-google"></i>
                <p>Sua conta Google está desconectada.</p>
                <button class="btn btn-primary" onclick="conectarGoogle()">
                    <i class="fab fa-google"></i> Reconectar Google
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <div class="card-avatar">
                    ${usuarioAtual.picture ? `<img src="${usuarioAtual.picture}" alt="">` : '<i class="fab fa-google"></i>'}
                </div>
                <div class="card-info">
                    <h3>${usuarioAtual.email}</h3>
                    <p>Conta logada com permissao Gmail</p>
                </div>
            </div>
            <div class="card-actions">
                <button class="btn btn-danger" onclick="desconectarGoogle()">
                    <i class="fas fa-unlink"></i> Desconectar Google
                </button>
            </div>
        </div>
    `;
}

function conectarGoogle() {
    window.location.href = '/auth/google?mode=login';
}

async function desconectarGoogle() {
    if (!confirm('Desconectar sua conta Google deste sistema?')) {
        return;
    }

    try {
        showLoading();
        await apiRequest('/auth/google/disconnect', { method: 'DELETE' });
        window.location.href = '/login';
    } catch (error) {
        showToast('Erro ao desconectar Google: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function enviarEmail(formData) {
    try {
        showLoading();
        await apiRequest('/send-email', {
            method: 'POST',
            body: JSON.stringify(formData)
        });
        showToast('Email enviado com sucesso!', 'success');
        document.getElementById('emailForm').reset();
        await carregarHistorico();
    } catch (error) {
        showToast('Erro ao enviar email: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function carregarHistorico() {
    try {
        historicoEmails = await apiRequest('/emails');
        renderizarHistorico();
    } catch (error) {
        showToast('Erro ao carregar histórico: ' + error.message, 'error');
    }
}

function renderizarHistorico() {
    const tbody = document.getElementById('historicoTable');
    const cardsContainer = document.getElementById('historicoCards');

    if (historicoEmails.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6">
                    <div class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <p>Nenhum email enviado ainda</p>
                    </div>
                </td>
            </tr>
        `;
        cardsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>Nenhum email enviado ainda</p>
            </div>
        `;
        return;
    }

    tbody.innerHTML = historicoEmails.map(email => `
        <tr>
            <td>${email.id}</td>
            <td>${email.remetente || '-'}</td>
            <td>${email.destinatario}</td>
            <td>${email.assunto}</td>
            <td>${formatarData(email.data_envio)}</td>
            <td>
                <div class="table-actions">
                    <button class="btn btn-secondary" onclick="verDetalhesEmail(${email.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-danger" onclick="deletarEmail(${email.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    cardsContainer.innerHTML = historicoEmails.map(email => `
        <div class="email-card">
            <div class="email-card-header">
                <span class="email-id">#${email.id}</span>
                <span class="email-date">${formatarData(email.data_envio)}</span>
            </div>
            <div class="email-info">
                <div class="email-info-item">
                    <span class="email-info-label">Remetente:</span>
                    <span class="email-info-value">${email.remetente || '-'}</span>
                </div>
                <div class="email-info-item">
                    <span class="email-info-label">Destinatario:</span>
                    <span class="email-info-value">${email.destinatario}</span>
                </div>
                <div class="email-info-item">
                    <span class="email-info-label">Assunto:</span>
                    <span class="email-info-value">${email.assunto}</span>
                </div>
                <div class="email-info-item">
                    <span class="email-info-label">Status:</span>
                    <span class="email-info-value">${email.status}</span>
                </div>
            </div>
            <div class="email-actions">
                <button class="btn btn-secondary" onclick="verDetalhesEmail(${email.id})">
                    <i class="fas fa-eye"></i> Ver
                </button>
                <button class="btn btn-danger" onclick="deletarEmail(${email.id})">
                    <i class="fas fa-trash"></i> Deletar
                </button>
            </div>
        </div>
    `).join('');
}

async function verDetalhesEmail(id) {
    try {
        mostrarDetalhesEmail(await apiRequest(`/emails/${id}`));
    } catch (error) {
        showToast('Erro ao carregar detalhes: ' + error.message, 'error');
    }
}

function mostrarDetalhesEmail(email) {
    document.getElementById('emailDetails').innerHTML = `
        <div class="email-detail-item">
            <label>ID:</label>
            <p>${email.id}</p>
        </div>
        <div class="email-detail-item">
            <label>Remetente:</label>
            <p>${email.remetente || '-'}</p>
        </div>
        <div class="email-detail-item">
            <label>Destinatario:</label>
            <p>${email.destinatario}</p>
        </div>
        <div class="email-detail-item">
            <label>Assunto:</label>
            <p>${email.assunto}</p>
        </div>
        <div class="email-detail-item">
            <label>Mensagem:</label>
            <p style="white-space: pre-wrap;">${email.mensagem}</p>
        </div>
        <div class="email-detail-item">
            <label>Gmail Message ID:</label>
            <p>${email.gmail_message_id || '-'}</p>
        </div>
        <div class="email-detail-item">
            <label>Data de Envio:</label>
            <p>${formatarData(email.data_envio)}</p>
        </div>
        <div class="email-detail-item">
            <label>Status:</label>
            <p>${email.status}</p>
        </div>
    `;
    showModal('viewEmailModal');
}

async function deletarEmail(id) {
    if (!confirm('Tem certeza que deseja deletar este email?')) {
        return;
    }

    try {
        showLoading();
        await apiRequest(`/emails/${id}`, { method: 'DELETE' });
        showToast('Email deletado com sucesso!', 'success');
        await carregarHistorico();
    } catch (error) {
        showToast('Erro ao deletar email: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function formatarData(dataString) {
    const data = new Date(dataString);
    return data.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

document.getElementById('emailForm').addEventListener('submit', (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    pendingEmailData = {
        destinatario: formData.get('destinatario'),
        subject: formData.get('assunto'),
        message: formData.get('mensagem')
    };

    document.getElementById('confirmFrom').textContent = usuarioAtual?.email || '-';
    document.getElementById('confirmTo').textContent = pendingEmailData.destinatario;
    document.getElementById('confirmSubject').textContent = pendingEmailData.subject;
    const msg = pendingEmailData.message;
    document.getElementById('confirmBody').textContent = msg.length > 200 ? msg.slice(0, 200) + '...' : msg;
    document.getElementById('sendConfirm').classList.add('active');
    e.target.querySelector('[type="submit"]').disabled = true;
});

async function confirmarEnvio() {
    if (!pendingEmailData) return;
    const data = pendingEmailData;
    pendingEmailData = null;
    document.getElementById('sendConfirm').classList.remove('active');
    document.getElementById('emailForm').querySelector('[type="submit"]').disabled = false;
    await enviarEmail(data);
}

function cancelarEnvio() {
    pendingEmailData = null;
    document.getElementById('sendConfirm').classList.remove('active');
    const submitBtn = document.getElementById('emailForm').querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = false;
}

async function logout() {
    try {
        await apiRequest('/auth/logout', { method: 'POST' });
    } finally {
        window.location.href = '/login';
    }
}

window.showModal = showModal;
window.closeModal = closeModal;
window.carregarHistorico = carregarHistorico;
window.verDetalhesEmail = verDetalhesEmail;
window.deletarEmail = deletarEmail;
window.conectarGoogle = conectarGoogle;
window.desconectarGoogle = desconectarGoogle;
window.confirmarEnvio = confirmarEnvio;
window.cancelarEnvio = cancelarEnvio;
window.logout = logout;
