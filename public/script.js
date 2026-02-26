// Configurações da API
const API_BASE_URL = window.location.origin;
console.log(API_BASE_URL);
// Elementos DOM
const navButtons = document.querySelectorAll('.nav-btn');
const tabContents = document.querySelectorAll('.tab-content');
const loadingOverlay = document.getElementById('loadingOverlay');
const toastContainer = document.getElementById('toastContainer');

// Estado da aplicação
let remetentes = [];
let historicoEmails = [];

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// Função de inicialização
async function initializeApp() {
    showLoading();
    try {
        await Promise.all([
            carregarRemetentes(),
            carregarHistorico()
        ]);
        atualizarSelectRemetentes();
    } catch (error) {
        showToast('Erro ao carregar dados iniciais', 'error');
    } finally {
        hideLoading();
    }
}

// Navegação entre abas
navButtons.forEach(button => {
    button.addEventListener('click', () => {
        const targetTab = button.getAttribute('data-tab');
        
        // Atualizar botões
        navButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        // Atualizar conteúdo
        tabContents.forEach(content => content.classList.remove('active'));
        document.getElementById(targetTab).classList.add('active');
    });
});

// Funções de Modal
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('active');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('active');
}

// Fechar modal ao clicar fora
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
});

// Loading
function showLoading() {
    loadingOverlay.classList.add('active');
}

function hideLoading() {
    loadingOverlay.classList.remove('active');
}

// Toast Notifications
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

// API Functions
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
        headers: {
            'Content-Type': 'application/json',
        },
        ...options
    };
    
    try {
        const response = await fetch(url, config);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Erro na requisição');
        }
        
        return data;
    } catch (error) {
        throw new Error(error.message || 'Erro de conexão');
    }
}

// Remetentes
async function carregarRemetentes() {
    try {
        const data = await apiRequest('/remetentes');
        remetentes = data;
        renderizarRemetentes();
    } catch (error) {
        showToast('Erro ao carregar remetentes: ' + error.message, 'error');
    }
}

function renderizarRemetentes() {
    const container = document.getElementById('remetentesContainer');
    
    if (remetentes.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #718096;">
                <i class="fas fa-users" style="font-size: 3rem; margin-bottom: 20px; opacity: 0.5;"></i>
                <h3>Nenhum remetente cadastrado</h3>
                <p>Clique em "Novo Remetente" para adicionar o primeiro remetente.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = remetentes.map(remetente => `
        <div class="card">
            <div class="card-header">
                <div class="card-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="card-info">
                    <h3>${remetente.email}</h3>
                    <p>Cadastrado em ${formatarData(remetente.data_cadastro)}</p>
                </div>
            </div>
            <div class="card-actions">
                <button class="btn btn-danger" onclick="deletarRemetente(${remetente.id})">
                    <i class="fas fa-trash"></i> Deletar
                </button>
            </div>
        </div>
    `).join('');
}

async function cadastrarRemetente(formData) {
    try {
        showLoading();
        await apiRequest('/cadastrar-remetente', {
            method: 'POST',
            body: JSON.stringify(formData)
        });
        
        showToast('Remetente cadastrado com sucesso!', 'success');
        closeModal('addRemetenteModal');
        
        // Recarregar dados
        await carregarRemetentes();
        atualizarSelectRemetentes();
        
        // Limpar formulário
        document.getElementById('addRemetenteForm').reset();
    } catch (error) {
        showToast('Erro ao cadastrar remetente: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function deletarRemetente(id) {
    if (!confirm('Tem certeza que deseja deletar este remetente?')) {
        return;
    }
    
    try {
        showLoading();
        await apiRequest(`/remetentes/${id}`, {
            method: 'DELETE'
        });
        
        showToast('Remetente deletado com sucesso!', 'success');
        
        // Recarregar dados
        await carregarRemetentes();
        atualizarSelectRemetentes();
    } catch (error) {
        showToast('Erro ao deletar remetente: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Atualizar select de remetentes
function atualizarSelectRemetentes() {
    const select = document.getElementById('remetente');
    const currentValue = select.value;
    
    select.innerHTML = '<option value="">Selecione um remetente</option>';
    
    remetentes.forEach(remetente => {
        const option = document.createElement('option');
        option.value = remetente.email;
        option.textContent = remetente.email;
        select.appendChild(option);
    });
    
    // Manter valor selecionado se ainda existir
    if (currentValue && remetentes.some(r => r.email === currentValue)) {
        select.value = currentValue;
    }
}

// Envio de Email
async function enviarEmail(formData) {
    try {
        showLoading();
        await apiRequest('/send-email', {
            method: 'POST',
            body: JSON.stringify(formData)
        });
        
        showToast('Email enviado com sucesso!', 'success');
        
        // Limpar formulário
        document.getElementById('emailForm').reset();
        
        // Recarregar histórico
        await carregarHistorico();
    } catch (error) {
        showToast('Erro ao enviar email: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Histórico
async function carregarHistorico() {
    try {
        const data = await apiRequest('/emails');
        historicoEmails = data;
        renderizarHistorico();
    } catch (error) {
        showToast('Erro ao carregar histórico: ' + error.message, 'error');
    }
}

function renderizarHistorico() {
    const tbody = document.getElementById('historicoTable');
    const cardsContainer = document.getElementById('historicoCards');
    
    if (historicoEmails.length === 0) {
        const emptyMessage = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: #718096;">
                    <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 10px; opacity: 0.5; display: block;"></i>
                    <p>Nenhum email enviado ainda</p>
                </td>
            </tr>
        `;
        
        tbody.innerHTML = emptyMessage;
        cardsContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #718096;">
                <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 10px; opacity: 0.5; display: block;"></i>
                <p>Nenhum email enviado ainda</p>
            </div>
        `;
        return;
    }
    
    // Renderizar tabela para desktop
    tbody.innerHTML = historicoEmails.map(email => `
        <tr>
            <td>${email.id}</td>
            <td>${email.remetente}</td>
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
    
    // Renderizar cards para mobile
    cardsContainer.innerHTML = historicoEmails.map(email => `
        <div class="email-card">
            <div class="email-card-header">
                <span class="email-id">#${email.id}</span>
                <span class="email-date">${formatarData(email.data_envio)}</span>
            </div>
            <div class="email-info">
                <div class="email-info-item">
                    <span class="email-info-label">Remetente:</span>
                    <span class="email-info-value">${email.remetente}</span>
                </div>
                <div class="email-info-item">
                    <span class="email-info-label">Destinatário:</span>
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
        const email = await apiRequest(`/emails/${id}`);
        mostrarDetalhesEmail(email);
    } catch (error) {
        showToast('Erro ao carregar detalhes: ' + error.message, 'error');
    }
}

function mostrarDetalhesEmail(email) {
    const detailsContainer = document.getElementById('emailDetails');
    detailsContainer.innerHTML = `
        <div class="email-detail-item">
            <label>ID:</label>
            <p>${email.id}</p>
        </div>
        <div class="email-detail-item">
            <label>Remetente:</label>
            <p>${email.remetente}</p>
        </div>
        <div class="email-detail-item">
            <label>Destinatário:</label>
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
        await apiRequest(`/emails/${id}`, {
            method: 'DELETE'
        });
        
        showToast('Email deletado com sucesso!', 'success');
        await carregarHistorico();
    } catch (error) {
        showToast('Erro ao deletar email: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Utilitários
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

// Event Listeners
document.getElementById('addRemetenteForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {
        email: formData.get('email'),
        senha: formData.get('senha')
    };
    
    await cadastrarRemetente(data);
});

document.getElementById('emailForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {
        remetente: formData.get('remetente'),
        destinatario: formData.get('destinatario'),
        subject: formData.get('assunto'),
        message: formData.get('mensagem')
    };
    
    await enviarEmail(data);
});

// Funções globais para uso no HTML
window.showModal = showModal;
window.closeModal = closeModal;
window.carregarHistorico = carregarHistorico;
window.verDetalhesEmail = verDetalhesEmail;
window.deletarEmail = deletarEmail;
window.deletarRemetente = deletarRemetente; 