const axios = require('axios');

// Configuração da API
const API_BASE_URL = 'https://umbonate-theda-conterminously.ngrok-free.dev';
const API_ENDPOINT = `${API_BASE_URL}/api/scrape-product`;

// URLs de teste
const TEST_URLS = {
  mercadoLivre: 'https://www.mercadolivre.com.br/jogo-de-panelas-brinox-smart-plus-6pcs-ceramic-life-vanilla-4791102/p/MLB33325840#reco_item_pos=2&reco_backend=item_decorator&reco_backend_type=function&reco_client=home_items-decorator-legacy&reco_id=be1dd6fa-2b0b-41e3-a146-e227042c5228&reco_model=&c_id=/home/navigation-trends-recommendations/element&c_uid=67e7e25e-e733-4d5d-8bcf-f0988b5f1b07&da_id=navigation_trend&da_position=1&id_origin=/home/dynamic_access&da_sort_algorithm=ranker'
};

// Função para testar um endpoint
async function testEndpoint(url, description) {
  console.log(`\n🧪 Testando: ${description}`);
  console.log(`📎 URL: ${url}`);
  
  try {
    const startTime = Date.now();
    
    const response = await axios.post(API_ENDPOINT, { url }, {
      timeout: 60000, // 60 segundos de timeout
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`⏱️ Tempo: ${duration}ms`);
    console.log(`📊 Rate Limit Remaining: ${response.headers['x-ratelimit-remaining'] || 'N/A'}`);
    console.log(`📦 Cache Control: ${response.headers['cache-control'] || 'N/A'}`);
    
    if (response.data.success) {
      console.log(`📝 Título: ${response.data.data.title}`);
      console.log(`💰 Preço: R$ ${response.data.data.price}`);
      console.log(`🖼️ Imagem: ${response.data.data.imageUrl ? 'Encontrada' : 'Não encontrada'}`);
      if (response.data.data.imageUrl) {
        console.log(`🔗 Link da Imagem: ${response.data.data.imageUrl}`);
      }
      console.log(`📋 Descrição: ${response.data.data.description ? 'Encontrada' : 'Não encontrada'}`);
      if (response.data.data.description) {
        console.log(`📄 Descrição Completa: ${response.data.data.description}`);
      }
      console.log(`📦 Disponibilidade: ${response.data.data.availability}`);
    } else {
      console.log(`❌ Erro: ${response.data.error}`);
      console.log(`📄 Detalhes: ${response.data.details}`);
    }
    
    return { success: true, duration, data: response.data };
    
  } catch (error) {
    console.log(`❌ Erro: ${error.message}`);
    
    if (error.response) {
      console.log(`📊 Status: ${error.response.status}`);
      console.log(`📄 Resposta: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    
    return { success: false, error: error.message };
  }
}

// Função para testar health check
async function testHealthCheck() {
  console.log(`\n🏥 Testando Health Check`);
  
  try {
    const response = await axios.get(`${API_BASE_URL}/health`);
    console.log(`✅ Status: ${response.status}`);
    console.log(`📊 Uptime: ${Math.floor(response.data.uptime)}s`);
    console.log(`💾 Memória: ${Math.round(response.data.memory.heapUsed / 1024 / 1024)}MB`);
    console.log(`📦 Cache Keys: ${response.data.cache.keys}`);
    
    return { success: true, data: response.data };
  } catch (error) {
    console.log(`❌ Erro: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Função para testar estatísticas
async function testStats() {
  console.log(`\n📈 Testando Estatísticas`);
  
  try {
    const response = await axios.get(`${API_BASE_URL}/api/stats`);
    console.log(`✅ Status: ${response.status}`);
    console.log(`📦 Cache Hits: ${response.data.cache.hits}`);
    console.log(`📦 Cache Misses: ${response.data.cache.misses}`);
    console.log(`📦 Cache Keys: ${response.data.cache.keys}`);
    
    return { success: true, data: response.data };
  } catch (error) {
    console.log(`❌ Erro: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Função para testar rate limiting
async function testRateLimit() {
  console.log(`\n🚦 Testando Rate Limiting`);
  
  const promises = [];
  for (let i = 0; i < 5; i++) {
    promises.push(
      axios.post(API_ENDPOINT, { url: TEST_URLS.mercadoLivre })
        .catch(error => ({ error: true, status: error.response?.status }))
    );
  }
  
  try {
    const results = await Promise.all(promises);
    const successful = results.filter(r => !r.error).length;
    const rateLimited = results.filter(r => r.status === 429).length;
    
    console.log(`✅ Requests bem-sucedidos: ${successful}`);
    console.log(`🚫 Requests rate-limited: ${rateLimited}`);
    
    return { success: true, successful, rateLimited };
  } catch (error) {
    console.log(`❌ Erro: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Função principal de teste
async function runTests() {
  console.log('🚀 Iniciando testes da API de Scraping');
  console.log('=' .repeat(50));
  
  const results = {
    healthCheck: await testHealthCheck(),
    stats: await testStats(),
    mercadoLivre: await testEndpoint(TEST_URLS.mercadoLivre, 'Mercado Livre'),
    rateLimit: await testRateLimit()
  };
  
  // Resumo dos testes
  console.log('\n' + '=' .repeat(50));
  console.log('📊 RESUMO DOS TESTES');
  console.log('=' .repeat(50));
  
  Object.entries(results).forEach(([test, result]) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${test}: ${result.success ? 'PASSOU' : 'FALHOU'}`);
  });
  
  const passed = Object.values(results).filter(r => r.success).length;
  const total = Object.keys(results).length;
  
  console.log(`\n🎯 Resultado: ${passed}/${total} testes passaram`);
  
  if (passed === total) {
    console.log('🎉 Todos os testes passaram! A API está funcionando corretamente.');
  } else {
    console.log('⚠️ Alguns testes falharam. Verifique os logs acima.');
  }
}

// Executar testes se este arquivo for chamado diretamente
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testEndpoint,
  testHealthCheck,
  testStats,
  testRateLimit,
  runTests
};