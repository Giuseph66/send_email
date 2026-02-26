#!/bin/bash

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Iniciando API de Scraping de Produtos${NC}"
echo "=================================================="

# Caminho base do projeto
PROJETO_DIR="$HOME/progetos/Servidores/emails"

# Ir para o diretório do projeto
cd "$PROJETO_DIR" || {
  echo -e "${RED}❌ Diretório não encontrado: $PROJETO_DIR${NC}"
  exit 1
}

# Verificar se o Node.js está instalado
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js não está instalado. Por favor, instale o Node.js primeiro.${NC}"
    exit 1
fi

# Verificar se o npm está instalado
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm não está instalado. Por favor, instale o npm primeiro.${NC}"
    exit 1
fi

# Verificar versão do Node.js
NODE_VERSION=$(node --version)
echo -e "${GREEN}✅ Node.js versão: ${NODE_VERSION}${NC}"

# Instalar dependências se necessário
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Instalando dependências...${NC}"
    npm install
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Dependências instaladas com sucesso!${NC}"
    else
        echo -e "${RED}❌ Erro ao instalar dependências${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Dependências já instaladas${NC}"
fi

# Verificar se o arquivo .env existe
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️ Arquivo .env não encontrado. Criando .env de exemplo...${NC}"
    cat > .env << EOF
# Configurações da API de Scraping
PORT=3550
NODE_ENV=development

# Rate Limiting
RATE_LIMIT_PER_HOUR=100

# Cache
CACHE_TTL_SECONDS=3600

# Timeout
TIMEOUT_MS=30000

# Logs
LOG_LEVEL=info

# Chave da API (opcional, para autenticação futura)
API_KEY=your_secret_key_here
EOF
    echo -e "${GREEN}✅ Arquivo .env criado!${NC}"
fi

# Verificar se o Puppeteer precisa instalar o Chrome
echo -e "${YELLOW}🔍 Verificando Puppeteer...${NC}"
if [ ! -d "node_modules/puppeteer/.local-chromium" ]; then
    echo -e "${YELLOW}📦 Instalando Chrome para Puppeteer...${NC}"
    npx puppeteer browsers install chrome
fi

echo ""
echo -e "${BLUE}🎯 Configuração da API:${NC}"
echo "   📍 Porta: ${PORT:-3550}"
echo "   🚦 Rate Limit: ${RATE_LIMIT_PER_HOUR:-100} requests/hora"
echo "   📦 Cache TTL: ${CACHE_TTL_SECONDS:-3600} segundos"
echo "   ⏱️ Timeout: ${TIMEOUT_MS:-30000}ms"
echo ""

echo -e "${GREEN}🚀 Iniciando servidor...${NC}"
echo "=================================================="

# Iniciar o servidor Node.js em segundo plano e salvar o PID
nohup node index.js > node_server.log 2>&1 &
echo $! > .pid_node

echo -e "${GREEN}✅ Servidor iniciado com sucesso!${NC}"
echo -e "${BLUE}📊 Logs disponíveis em: node_server.log${NC}"
echo -e "${BLUE}🆔 PID do processo: $(cat .pid_node)${NC}"
echo ""
echo -e "${YELLOW}🔗 Endpoints disponíveis:${NC}"
echo "   POST http://localhost:3550/api/scrape-product"
echo "   GET  http://localhost:3550/health"
echo "   GET  http://localhost:3550/api/stats"
echo ""
echo -e "${YELLOW}🧪 Para testar a API:${NC}"
echo "   npm test"
echo "   ou"
echo "   node test-api.js"
