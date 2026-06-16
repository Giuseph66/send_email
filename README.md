# send_email

Projeto Node.js + Express + SQLite para envio de emails com cadastro/login via Google, OAuth2 e Gmail API. Cada conta Google acessa apenas o proprio perfil, token de envio e historico. Nao ha mesclagem de conteudo entre usuarios.

Tambem mantem a API de scraping existente em `/api/scrape-product`.

## Funcionalidades

- Cadastro e login com Google via OAuth2
- Isolamento por usuario Google logado
- Sessao real no backend com cookie `httpOnly`
- Refresh token criptografado no SQLite
- Envio pela Gmail API (`gmail.users.messages.send`)
- Historico de emails enviados
- API de scraping preservada

## Configuracao Google Cloud

1. Acesse Google Cloud Console.
2. Crie ou selecione um projeto.
3. Ative a Gmail API.
4. Configure a OAuth consent screen.
5. Crie um OAuth Client do tipo Web application.
6. Adicione o redirect URI local:

```text
http://localhost:3550/auth/google/callback
```

7. Copie Client ID e Client Secret para o `.env`.

## Variaveis de ambiente

```bash
cp .env.example .env
```

Edite:

```env
PORT=3550
APP_URL=http://localhost:3550
SESSION_SECRET=troque-por-um-segredo-longo
TOKEN_ENCRYPTION_KEY=troque-por-uma-chave-longa-aleatoria
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3550/auth/google/callback
```

`TOKEN_ENCRYPTION_KEY` nunca vai para o frontend. O refresh token fica criptografado em `google_users.refresh_token_encrypted`.

## Teste local

```bash
npm install
npm start
```

Abra:

```text
http://localhost:3550/login
```

Fluxo:

1. Clique em `Cadastrar conta Google` ou `Entrar com Google`.
2. Autorize as permissoes.
3. Volte para `/dashboard`.
4. Envie um email de teste informando destinatario, assunto e mensagem.
5. Veja o envio em `Historico`.

## Rotas principais

As rotas autenticadas usam sessao do Express via cookie `send_email.sid`.
Para integracoes externas, use API token por usuario via header `Authorization: Bearer`.

Se voce rodar:

```bash
curl http://localhost:3550/auth/me
```

sem cookie de sessao, a resposta esperada e:

```json
{"error":"Não autenticado"}
```

Para testar rotas protegidas via terminal, faca login no navegador e gere um API token em `Minha Conta Google`.

### Autenticacao

- `GET /auth/google`
- `GET /auth/google/callback`
- `GET /auth/me` - requer cookie de sessao ou Bearer token
- `POST /auth/logout` - requer cookie de sessao
- `DELETE /auth/google/disconnect` - requer cookie de sessao
- `POST /auth/api-token` - gera novo API token; requer cookie de sessao
- `DELETE /auth/api-token` - revoga API token; requer cookie de sessao ou Bearer token

### Emails

- `POST /send-email` - requer cookie de sessao ou Bearer token
- `GET /emails` - requer cookie de sessao ou Bearer token
- `GET /emails/:id` - requer cookie de sessao ou Bearer token
- `DELETE /emails/:id` - requer cookie de sessao ou Bearer token

`/send-email` exige autenticacao e recebe:

```json
{
  "destinatario": "destino@exemplo.com",
  "subject": "Assunto",
  "message": "<p>Mensagem HTML</p>"
}
```

Nao envie `remetente`; o backend usa a conta Google da sessao atual.

Exemplo com API token:

```bash
curl http://localhost:3550/auth/me \
  -H 'Authorization: Bearer SEU_API_TOKEN'
```

Envio por outra plataforma:

```bash
curl -X POST http://localhost:3550/send-email \
  -H 'Authorization: Bearer SEU_API_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "destinatario": "destino@exemplo.com",
    "subject": "Teste API",
    "message": "<p>Email enviado por API externa</p>"
  }'
```

O API token pertence ao usuario Google logado. Ele acessa apenas perfil, envio e historico desse usuario.

### Scraping

- `POST /api/scrape-product`
- `GET /health`
- `GET /api/stats`
- `DELETE /api/cache` apenas fora de producao

## Banco SQLite

Tabelas usadas:

- `google_users`: usuario Google e refresh token criptografado
- `emails_enviados`: historico, com `user_id` e `gmail_message_id`
- `remetentes`: mantida apenas por compatibilidade com bancos antigos

## Seguranca

- Nao ha cadastro de senha de email.
- Nao ha envio via senha de app no novo fluxo.
- Refresh token nao e exposto ao frontend.
- Sessao usa cookie `httpOnly`.
- `.env`, `emails.db` e `node_modules` ficam fora do Git via `.gitignore`.
