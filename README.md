# API de Envio de Emails com SQLite

Esta é uma API Node.js para envio de emails que utiliza SQLite para armazenar remetentes cadastrados e o histórico de emails enviados. Inclui uma interface web moderna com sistema de autenticação.

## Funcionalidades

- ✅ **Sistema de autenticação** com login seguro
- ✅ Interface web moderna e responsiva
- ✅ Cadastro de remetentes com email e senha
- ✅ Envio de emails via SMTP (Gmail) usando credenciais do banco
- ✅ Armazenamento de remetentes no SQLite
- ✅ Armazenamento de emails enviados no SQLite
- ✅ Listagem de remetentes cadastrados
- ✅ Listagem de todos os emails enviados
- ✅ Busca de email por ID
- ✅ Exclusão de email por ID
- ✅ Gerenciamento de remetentes (listar, buscar, deletar)
- ✅ Visualização detalhada de emails enviados
- ✅ Logout e controle de sessão

## Instalação

1. Clone o repositório
2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp env.exemplo .env
```

Edite o arquivo `.env` com suas configurações:
```
PORT=3000
```

## Uso

### Iniciar o servidor
```bash
node index.js
```

### Acessar a aplicação
Após iniciar o servidor, acesse:
```
http://localhost:3000
```

O sistema irá automaticamente:
1. Verificar se você está autenticado
2. Redirecionar para login se necessário
3. Mostrar o dashboard após autenticação

## Sistema de Autenticação

### Credenciais Padrão
- **Usuário:** `admin`
- **Senha:** `admin123`

### Funcionalidades de Segurança
- **Sessão de 24 horas** - Token expira automaticamente
- **Armazenamento local** - Dados de sessão no localStorage
- **Redirecionamento automático** - Para login quando não autenticado
- **Logout seguro** - Limpa todos os dados de sessão

### Fluxo de Autenticação
1. **Acesso inicial** → Verificação de autenticação
2. **Não autenticado** → Redirecionamento para `/login`
3. **Login bem-sucedido** → Redirecionamento para `/dashboard`
4. **Sessão expirada** → Logout automático e redirecionamento

## Interface Web

A interface web oferece três seções principais:

### 1. Remetentes
- **Cadastrar novos remetentes** com email e senha
- **Visualizar remetentes** cadastrados em cards
- **Deletar remetentes** não utilizados

### 2. Enviar Email
- **Selecionar remetente** cadastrado
- **Preencher dados** do email (destinatário, assunto, mensagem)
- **Enviar email** usando as credenciais do remetente

### 3. Histórico
- **Visualizar todos os emails** enviados
- **Ver detalhes** de cada email
- **Deletar emails** do histórico

## API Endpoints

### Autenticação
- `GET /` - Página principal (redireciona para login ou dashboard)
- `GET /login` - Página de login
- `GET /dashboard` - Dashboard principal (requer autenticação)

### Remetentes
- `POST /cadastrar-remetente` - Cadastra novo remetente
- `GET /remetentes` - Lista todos os remetentes
- `GET /remetentes/:id` - Busca remetente específico
- `DELETE /remetentes/:id` - Remove remetente

### Emails
- `POST /send-email` - Envia email
- `GET /emails` - Lista todos os emails enviados
- `GET /emails/:id` - Busca email específico
- `DELETE /emails/:id` - Remove email

## Estrutura do Banco de Dados

### Tabela `remetentes`
- `id`: ID único do registro
- `email`: Email do remetente (único)
- `senha`: Senha do remetente
- `data_cadastro`: Data e hora do cadastro

### Tabela `emails_enviados`
- `id`: ID único do registro
- `remetente`: Email do remetente
- `destinatario`: Email do destinatário
- `assunto`: Assunto do email
- `mensagem`: Conteúdo da mensagem
- `data_envio`: Data e hora do envio
- `status`: Status do email (padrão: 'enviado')

## Fluxo de Uso

1. **Acessar a aplicação:** `http://localhost:3000`
2. **Fazer login:** Use as credenciais padrão ou configure suas próprias
3. **Cadastrar remetente:** Use a aba "Remetentes" para adicionar um email e senha
4. **Enviar email:** Use a aba "Enviar Email" especificando o remetente cadastrado
5. **Consultar histórico:** Use a aba "Histórico" para ver todos os emails enviados
6. **Fazer logout:** Use o botão "Sair" no header

## Arquivos do Projeto

- `index.js`: Servidor principal com todas as rotas
- `public/index.html`: Página principal (verificação de autenticação)
- `public/login.html`: Página de login
- `public/dashboard.html`: Dashboard principal
- `public/login-styles.css`: Estilos da página de login
- `public/styles.css`: Estilos da interface principal
- `public/login.js`: JavaScript da página de login
- `public/script.js`: JavaScript da interface principal
- `emails.db`: Banco de dados SQLite (criado automaticamente)
- `.env`: Arquivo de configuração
- `package.json`: Dependências do projeto
- `test-api.js`: Arquivo de testes da API

## Configuração do Gmail

Para usar com Gmail:

1. Ative a verificação em duas etapas na sua conta Google
2. Gere uma "Senha de App" em: https://myaccount.google.com/apppasswords
3. Use essa senha ao cadastrar o remetente

## Características da Interface Web

- **Design responsivo** que funciona em desktop e mobile
- **Interface moderna** com gradientes e efeitos visuais
- **Sistema de autenticação** com login seguro
- **Navegação por abas** para organizar as funcionalidades
- **Modais interativos** para cadastros e visualizações
- **Notificações toast** para feedback do usuário
- **Loading states** para melhor UX
- **Validação de formulários** em tempo real
- **Animações suaves** para transições
- **Controle de sessão** com logout automático

## Segurança

⚠️ **Importante**: As senhas são armazenadas em texto plano no banco de dados. Para um ambiente de produção, considere:

1. Criptografar as senhas antes de salvar
2. Usar HTTPS
3. Implementar autenticação JWT mais robusta
4. Validar e sanitizar inputs
5. Usar variáveis de ambiente para configurações sensíveis
6. Implementar rate limiting
7. Adicionar logs de auditoria

## Exemplo de Uso

```bash
# 1. Iniciar o servidor
node index.js

# 2. Acessar a aplicação
# Abra http://localhost:3000 no navegador

# 3. Fazer login
# Use: admin / admin123

# 4. Usar a interface web para:
# - Cadastrar remetentes
# - Enviar emails
# - Visualizar histórico
# - Fazer logout
```

## Tecnologias Utilizadas

- **Backend:** Node.js, Express, SQLite3, Nodemailer
- **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
- **UI/UX:** Font Awesome, Google Fonts, CSS Grid/Flexbox
- **Design:** Gradientes, Glassmorphism, Animações CSS
- **Autenticação:** LocalStorage, Sessão de 24 horas # send_email
