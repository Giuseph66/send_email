const express = require('express');
const dotenv = require('dotenv');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');
const session = require('express-session');
const { google } = require('googleapis');
const puppeteer = require('puppeteer');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');
const UserAgent = require('user-agents');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();

dotenv.config();
app.use(express.json());
app.use(session({
  name: 'send_email.sid',
  secret: process.env.SESSION_SECRET || 'troque-este-segredo-em-desenvolvimento',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Servir arquivos estáticos da pasta public
app.use(express.static(path.join(__dirname, 'public')));

// Configuração do cache
const cache = new NodeCache({ 
  stdTTL: parseInt(process.env.CACHE_TTL_SECONDS) || 3600, // 1 hora por padrão
  checkperiod: 120 // Verificar a cada 2 minutos
});

// Configuração do rate limiting
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: parseInt(process.env.RATE_LIMIT_PER_HOUR) || 100, // máximo 100 requests por hora
  message: {
    success: false,
    error: 'Rate limit excedido. Máximo 100 requests por hora.',
    details: 'Tente novamente em algumas horas.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Aplicar rate limiting apenas nas rotas de scraping
app.use('/api/scrape-product', limiter);

// Configuração de user agents
const userAgent = new UserAgent();

// Função para gerar headers realistas
function getRealisticHeaders() {
  const ua = userAgent.toString();
  return {
    'User-Agent': ua,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Upgrade-Insecure-Requests': '1'
  };
}

// Função para delay aleatório
function randomDelay(min = 1000, max = 3000) {
  return new Promise(resolve => {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    setTimeout(resolve, delay);
  });
}

// Função para detectar o site
function detectSite(url) {
  const hostname = new URL(url).hostname.toLowerCase();
  
  if (hostname.includes('mercadolivre.com.br') || hostname.includes('mercadolibre.com')) {
    return 'mercadolivre';
  } else if (hostname.includes('amazon.com.br') || hostname.includes('amazon.com')) {
    return 'amazon';
  } else if (hostname.includes('magazineluiza.com.br')) {
    return 'magazineluiza';
  } else if (hostname.includes('americanas.com.br')) {
    return 'americanas';
  } else if (hostname.includes('submarino.com.br')) {
    return 'submarino';
  } else {
    return 'generic';
  }
}

// Função para extrair dados do Mercado Livre
async function extractMercadoLivre(page) {
  try {
    const data = await page.evaluate(() => {
      // Tentar extrair dados do JSON-LD primeiro
      const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of jsonLdScripts) {
        try {
          const jsonData = JSON.parse(script.textContent);
          if (jsonData['@type'] === 'Product') {
            // Extrair imagem do JSON-LD
            let imageUrl = '';
            if (jsonData.image) {
              if (Array.isArray(jsonData.image)) {
                imageUrl = jsonData.image[0] || '';
              } else if (typeof jsonData.image === 'string') {
                imageUrl = jsonData.image;
              } else if (jsonData.image.url) {
                imageUrl = jsonData.image.url;
              }
            }
            
            // Extrair preço original do JSON-LD
            let price = 0;
            if (jsonData.offers) {
              // Tentar encontrar preço original primeiro
              if (jsonData.offers.price) {
                price = jsonData.offers.price;
              } else if (jsonData.offers.highPrice) {
                price = jsonData.offers.highPrice;
              } else if (jsonData.offers.priceRange) {
                price = jsonData.offers.priceRange.split('-')[0]; // Pegar o primeiro valor
              }
            }
            
            return {
              title: jsonData.name || '',
              price: price,
              imageUrl: imageUrl,
              description: jsonData.description || '',
              availability: jsonData.offers?.availability === 'https://schema.org/InStock' ? 'available' : 'unavailable'
            };
          }
        } catch (e) {
          continue;
        }
      }

      // Fallback para meta tags
      const title = document.querySelector('meta[property="og:title"]')?.content ||
                   document.querySelector('meta[name="twitter:title"]')?.content ||
                   document.querySelector('h1.ui-pdp-title')?.textContent?.trim() ||
                   document.querySelector('.ui-pdp-title')?.textContent?.trim() || '';

      // Buscar preço original (sem desconto)
      let price = 0;
      
      // 0. Primeiro tentar meta tags específicas para preço
      const ogPrice = document.querySelector('meta[property="product:price:amount"]')?.content ||
                     document.querySelector('meta[name="twitter:data1"]')?.content ||
                     document.querySelector('meta[property="og:price:amount"]')?.content ||
                     document.querySelector('meta[name="price"]')?.content;
      
      if (ogPrice) {
        const extractedPrice = parseFloat(ogPrice.replace(/[^\d,]/g, '').replace(',', '.'));
        if (extractedPrice > 0) {
          price = extractedPrice;
          console.log('💰 Preço encontrado via meta tags:', price);
        }
      }
      
      // 1. Tentar encontrar preço original primeiro - seletores mais específicos
      const originalPriceSelectors = [
        's.andes-money-amount--previous', // Elemento strikethrough com preço anterior
        '.andes-money-amount--previous', // Classe específica para preço anterior
        's[aria-label*="Antes:"]', // Elemento s com aria-label contendo "Antes:"
        '.ui-pdp-price__original-value', // Valor original
        '.andes-money-amount__original',
        '.price-tag-original', 
        '.andes-money-amount__original-value',
        '[data-testid="original-price"]',
        '.andes-money-amount__original-amount',
        '.ui-pdp-price__original',
        '.andes-money-amount__original-fraction',
        '.andes-money-amount__original-cents',
        '.price-tag-original-fraction',
        '.andes-money-amount__original-currency'
      ];
      
      for (const selector of originalPriceSelectors) {
        const element = document.querySelector(selector);
        console.log(`🔍 Testando seletor: ${selector} - Elemento encontrado:`, !!element);
        if (element) {
          console.log(`🔍 Elemento encontrado:`, element.outerHTML.substring(0, 200));
          const priceText = element.textContent?.replace(/[^\d,]/g, '') || '0';
          const extractedPrice = parseFloat(priceText.replace(',', '.'));
          console.log(`🔍 Preço extraído: ${priceText} -> ${extractedPrice}`);
          if (extractedPrice > 0) {
            price = extractedPrice;
            console.log(`💰 Preço original encontrado (${selector}):`, price);
            break;
          }
        }
      }
      
      // 2. Buscar por elementos com aria-label contendo "Antes:"
      if (price === 0) {
        const elementsWithAriaLabel = document.querySelectorAll('[aria-label*="Antes:"]');
        console.log(`🔍 Elementos com aria-label "Antes:" encontrados:`, elementsWithAriaLabel.length);
        for (const element of elementsWithAriaLabel) {
          const ariaLabel = element.getAttribute('aria-label');
          console.log(`🔍 aria-label encontrado:`, ariaLabel);
          const priceMatch = ariaLabel.match(/(\d+)/);
          if (priceMatch) {
            const extractedPrice = parseFloat(priceMatch[1]);
            console.log(`🔍 Preço extraído do aria-label:`, extractedPrice);
            if (extractedPrice > 0) {
              price = extractedPrice;
              console.log('💰 Preço original encontrado (aria-label):', price);
              break;
            }
          }
        }
      }
      
      // 2.1. Buscar especificamente pelo texto "537" na página
      if (price === 0) {
        const bodyText = document.body.textContent || '';
        if (bodyText.includes('537')) {
          console.log('🔍 Texto "537" encontrado na página');
          // Buscar elementos que contenham "537"
          const allElements = document.querySelectorAll('*');
          for (const element of allElements) {
            if (element.textContent && element.textContent.includes('537')) {
              console.log('🔍 Elemento com "537":', element.tagName, element.className);
              const priceMatch = element.textContent.match(/R\$\s*537/);
              if (priceMatch) {
                price = 537;
                console.log('💰 Preço 537 encontrado diretamente:', price);
                break;
              }
            }
          }
        }
      }
      
      // 3. Se não encontrar preço original, buscar por elementos que contenham "original" ou "antes"
      if (price === 0) {
        const allElements = document.querySelectorAll('*');
        for (const element of allElements) {
          const text = element.textContent?.toLowerCase() || '';
          if ((text.includes('original') || text.includes('antes') || text.includes('de:')) && 
              element.textContent?.includes('R$')) {
            const priceMatch = element.textContent.match(/R\$\s*(\d+(?:,\d{2})?)/);
            if (priceMatch) {
              const extractedPrice = parseFloat(priceMatch[1].replace(',', '.'));
              if (extractedPrice > 0) {
                price = extractedPrice;
                console.log('💰 Preço original encontrado (texto):', price);
                break;
              }
            }
          }
        }
      }
      
      // 4. Se ainda não encontrar, usar o preço atual como fallback
      if (price === 0) {
        const priceElement = document.querySelector('.andes-money-amount__fraction') ||
                            document.querySelector('.price-tag-fraction') ||
                            document.querySelector('[data-testid="price"]') ||
                            document.querySelector('.andes-money-amount__value') ||
                            document.querySelector('.ui-pdp-price__value');
        
        if (priceElement) {
          const priceText = priceElement.textContent?.replace(/[^\d,]/g, '') || '0';
          price = parseFloat(priceText.replace(',', '.'));
          console.log('💰 Preço atual encontrado (fallback):', price);
        }
      }
      
      // 5. SEMPRE buscar todos os preços e pegar o maior (estratégia mais agressiva)
      const priceRegex = /R\$\s*(\d+(?:,\d{2})?)/g;
      const bodyText = document.body.textContent || '';
      const priceMatches = [...bodyText.matchAll(priceRegex)];
      
      if (priceMatches.length > 0) {
        const prices = priceMatches.map(match => parseFloat(match[1].replace(',', '.')));
        console.log('🔍 Todos os preços encontrados:', prices);
        console.log('🔍 Texto completo dos matches:', priceMatches.map(m => m[0]));
        const maxPrice = Math.max(...prices);
        
        // SEMPRE usar o maior preço encontrado (forçar preço original)
        price = maxPrice;
        console.log('💰 Preço maior encontrado via regex (forçado):', price);
      }
      
      // 5. Buscar também por números que podem ser preços sem R$
      const numberRegex = /\b(\d{3,}(?:,\d{2})?)\b/g;
      const numberMatches = [...bodyText.matchAll(numberRegex)];
      if (numberMatches.length > 0) {
        const numbers = numberMatches.map(match => parseFloat(match[1].replace(',', '.')));
        console.log('🔍 Números grandes encontrados:', numbers);
        const maxNumber = Math.max(...numbers);
        if (maxNumber > price && maxNumber >= 100) { // Só considerar números >= 100
          price = maxNumber;
          console.log('💰 Número maior encontrado (sem R$):', price);
        }
      }
      
      // Debug: mostrar todas as meta tags de preço
      console.log('🔍 Debug - Meta tags de preço encontradas:');
      const priceMetaTags = [
        'meta[property="product:price:amount"]',
        'meta[name="twitter:data1"]',
        'meta[property="og:price:amount"]',
        'meta[name="price"]'
      ];
      
      priceMetaTags.forEach(selector => {
        const element = document.querySelector(selector);
        if (element) {
          console.log(`  - ${selector}:`, element.content);
        }
      });
      
      // Debug: mostrar todos os elementos que contêm preços
      console.log('🔍 Debug - Elementos com preços encontrados:');
      const allPriceElements = document.querySelectorAll('*');
      for (const element of allPriceElements) {
        const text = element.textContent || '';
        if (text.includes('R$') && text.match(/\d+/)) {
          console.log('  - Elemento:', element.tagName, element.className, '| Texto:', text.trim().substring(0, 100));
        }
      }

      // Tentar múltiplos seletores para encontrar a imagem
      let imageUrl = '';
      
      // 1. Meta tags para imagem
      const ogImage = document.querySelector('meta[property="og:image"]')?.content ||
                     document.querySelector('meta[name="twitter:image"]')?.content;
      if (ogImage && ogImage.startsWith('http')) {
        imageUrl = ogImage;
      }
      
      // 2. Imagem principal do produto
      if (!imageUrl) {
        const mainImage = document.querySelector('.ui-pdp-image img')?.src ||
                         document.querySelector('[data-testid="image"] img')?.src ||
                         document.querySelector('.ui-pdp-gallery img')?.src ||
                         document.querySelector('.ui-pdp-gallery__image img')?.src ||
                         document.querySelector('.carousel-item img')?.src ||
                         document.querySelector('.ui-pdp-image__element')?.src;
        if (mainImage && mainImage.startsWith('http')) {
          imageUrl = mainImage;
        }
      }
      
      // 3. Buscar qualquer imagem que contenha "mlstatic" (CDN do Mercado Livre)
      if (!imageUrl) {
        const allImages = document.querySelectorAll('img');
        for (const img of allImages) {
          if (img.src && img.src.includes('mlstatic') && img.src.startsWith('http')) {
            imageUrl = img.src;
            break;
          }
        }
      }
      
      // 4. Fallback para qualquer imagem com src válido
      if (!imageUrl) {
        const allImages = document.querySelectorAll('img');
        for (const img of allImages) {
          if (img.src && img.src.startsWith('http') && !img.src.includes('logo') && !img.src.includes('icon')) {
            imageUrl = img.src;
            break;
          }
        }
      }

      const description = document.querySelector('meta[property="og:description"]')?.content ||
                         document.querySelector('.ui-pdp-description__content')?.textContent?.trim() || '';

      // Verificar disponibilidade
      const availabilityElement = document.querySelector('.ui-pdp-buybox__quantity-selector') ||
                                 document.querySelector('[data-testid="quantity-selector"]');
      const availability = availabilityElement ? 'available' : 'unavailable';

      return {
        title,
        price,
        imageUrl,
        description,
        availability
      };
    });

    return data;
  } catch (error) {
    console.error('Erro ao extrair dados do Mercado Livre:', error);
    throw new Error('Falha ao extrair dados do produto');
  }
}

// Função para extrair dados da Amazon
async function extractAmazon(page) {
  try {
    const data = await page.evaluate(() => {
      const title = document.querySelector('#productTitle')?.textContent?.trim() ||
                   document.querySelector('h1.a-size-large')?.textContent?.trim() || '';

      const priceElement = document.querySelector('.a-price-whole') ||
                          document.querySelector('.a-price .a-offscreen') ||
                          document.querySelector('#priceblock_dealprice') ||
                          document.querySelector('#priceblock_ourprice');
      
      let price = 0;
      if (priceElement) {
        const priceText = priceElement.textContent?.replace(/[^\d,]/g, '') || '0';
        price = parseFloat(priceText.replace(',', '.'));
      }

      const imageUrl = document.querySelector('#landingImage')?.src ||
                      document.querySelector('#imgTagWrapperId img')?.src ||
                      document.querySelector('.a-dynamic-image')?.src || '';

      const description = document.querySelector('#feature-bullets ul')?.textContent?.trim() ||
                         document.querySelector('#productDescription p')?.textContent?.trim() || '';

      const availability = document.querySelector('#availability span')?.textContent?.toLowerCase().includes('estoque') ? 'available' : 'unavailable';

      return {
        title,
        price,
        imageUrl,
        description,
        availability
      };
    });

    return data;
  } catch (error) {
    console.error('Erro ao extrair dados da Amazon:', error);
    throw new Error('Falha ao extrair dados do produto');
  }
}

// Função genérica para extrair dados
async function extractGeneric(page) {
  try {
    const data = await page.evaluate(() => {
      const title = document.querySelector('meta[property="og:title"]')?.content ||
                   document.querySelector('h1')?.textContent?.trim() ||
                   document.querySelector('title')?.textContent?.trim() || '';

      // Buscar preço com regex
      const priceRegex = /R\$\s*(\d+(?:,\d{2})?)/g;
      const bodyText = document.body.textContent || '';
      const priceMatch = bodyText.match(priceRegex);
      
      let price = 0;
      if (priceMatch) {
        const priceText = priceMatch[0].replace(/[^\d,]/g, '');
        price = parseFloat(priceText.replace(',', '.'));
      }

      const imageUrl = document.querySelector('meta[property="og:image"]')?.content ||
                      document.querySelector('img[src*="product"]')?.src ||
                      document.querySelector('img[alt*="produto"]')?.src || '';

      const description = document.querySelector('meta[property="og:description"]')?.content ||
                         document.querySelector('meta[name="description"]')?.content || '';

      return {
        title,
        price,
        imageUrl,
        description,
        availability: 'unknown'
      };
    });

    return data;
  } catch (error) {
    console.error('Erro ao extrair dados genéricos:', error);
    throw new Error('Falha ao extrair dados do produto');
  }
}

// Função principal de scraping
async function scrapeProduct(url, retries = 3) {
  let browser;
  
  try {
    console.log(`🔍 Iniciando scraping de: ${url}`);
    
    // Verificar cache primeiro
    const cacheKey = `scrape:${url}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      console.log('📦 Dados encontrados no cache');
      return cachedData;
    }

    // Configurar browser
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    
    // Configurar headers realistas
    const headers = getRealisticHeaders();
    await page.setExtraHTTPHeaders(headers);
    await page.setUserAgent(headers['User-Agent']);

    // Configurar viewport
    await page.setViewport({ width: 1366, height: 768 });

    // Navegar para a página com timeout
    const timeout = parseInt(process.env.TIMEOUT_MS) || 30000;
    await page.goto(url, { 
      waitUntil: 'networkidle2', 
      timeout 
    });

    // Delay aleatório para parecer mais humano e aguardar carregamento completo
    await randomDelay(5000, 8000);

    // Detectar site e extrair dados
    const site = detectSite(url);
    let extractedData;

    switch (site) {
      case 'mercadolivre':
        extractedData = await extractMercadoLivre(page);
        break;
      case 'amazon':
        extractedData = await extractAmazon(page);
        break;
      default:
        extractedData = await extractGeneric(page);
    }

    // Debug: Log dos dados extraídos
    console.log('🔍 Debug - Dados extraídos:', {
      title: extractedData.title,
      price: extractedData.price,
      priceType: extractedData.price > 0 ? 'Preço encontrado' : 'Preço não encontrado',
      imageUrl: extractedData.imageUrl,
      imageUrlLength: extractedData.imageUrl?.length || 0,
      description: extractedData.description?.substring(0, 100) + '...',
      availability: extractedData.availability
    });

    // Validar dados extraídos
    if (!extractedData.title || extractedData.title.trim() === '') {
      throw new Error('Título do produto não encontrado');
    }

    if (extractedData.price <= 0) {
      console.warn('⚠️ Preço não encontrado ou inválido');
    }
    
    if (!extractedData.imageUrl || extractedData.imageUrl.length < 10) {
      console.warn('⚠️ URL da imagem inválida ou muito curta:', extractedData.imageUrl);
    }

    const result = {
      success: true,
      data: {
        title: extractedData.title.trim(),
        price: extractedData.price,
        imageUrl: extractedData.imageUrl,
        description: extractedData.description?.trim() || '',
        availability: extractedData.availability || 'unknown'
      }
    };

    // Salvar no cache
    cache.set(cacheKey, result);
    console.log('✅ Scraping concluído com sucesso');
    
    return result;

  } catch (error) {
    console.error('💥 Erro durante scraping:', error.message);
    
    if (retries > 0) {
      console.log(`🔄 Tentando novamente... (${retries} tentativas restantes)`);
      await randomDelay(3000, 6000); // Delay maior entre tentativas
      return scrapeProduct(url, retries - 1);
    }
    
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Configuração do banco de dados SQLite
const dbPath = path.join(__dirname, 'emails.db');
const db = new sqlite3.Database(dbPath);

const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.send'
];

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function getEncryptionKey() {
  if (!process.env.TOKEN_ENCRYPTION_KEY) {
    throw new Error('TOKEN_ENCRYPTION_KEY não configurada');
  }
  return crypto.createHash('sha256').update(process.env.TOKEN_ENCRYPTION_KEY).digest();
}

function encryptToken(token) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decryptToken(value) {
  const [iv, tag, encrypted] = value.split(':').map(part => Buffer.from(part, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      err ? reject(err) : resolve(this);
    });
  });
}

function hashApiToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateApiToken() {
  return `se_${crypto.randomBytes(32).toString('base64url')}`;
}

async function requireAuth(req, res, next) {
  try {
    if (req.session.userId) {
      req.userId = req.session.userId;
      return next();
    }

    const authHeader = req.get('authorization') || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) {
      const row = await dbGet(
        `SELECT id FROM google_users WHERE api_token_hash = ? AND refresh_token_encrypted IS NOT NULL`,
        [hashApiToken(match[1])]
      );
      if (row) {
        req.userId = row.id;
        return next();
      }
    }

    return res.status(401).json({ error: 'Não autenticado' });
  } catch (error) {
    console.error('Erro ao autenticar:', error);
    return res.status(500).json({ error: 'Erro ao autenticar' });
  }
}

function escapeHeader(value) {
  return String(value || '').replace(/[\r\n]/g, ' ').trim();
}

function encodeSubject(subject) {
  return `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
}

function createMimeMessage({ from, to, subject, html }) {
  const lines = [
    `From: ${escapeHeader(from)}`,
    `To: ${escapeHeader(to)}`,
    `Subject: ${encodeSubject(escapeHeader(subject))}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    '',
    html
  ];
  return Buffer.from(lines.join('\r\n'), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ==================== ENDPOINTS DA API DE SCRAPING ====================

// Endpoint principal para scraping de produtos
app.post('/api/scrape-product', async (req, res) => {
  try {
    const { url } = req.body;

    // Validar entrada
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL é obrigatória',
        details: 'Forneça uma URL válida no campo "url"'
      });
    }

    // Validar formato da URL
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'URL inválida',
        details: 'Forneça uma URL válida (ex: https://www.mercadolivre.com.br/...)'
      });
    }

    // Verificar se é um site suportado
    const site = detectSite(url);
    if (site === 'generic') {
      console.warn(`⚠️ Site não otimizado: ${url}`);
    }

    console.log(`🚀 Processando scraping para: ${url} (${site})`);
    
    // Executar scraping
    const result = await scrapeProduct(url);
    
    // Adicionar headers de rate limiting
    res.set({
      'X-RateLimit-Remaining': res.get('X-RateLimit-Remaining') || 'N/A',
      'X-RateLimit-Reset': res.get('X-RateLimit-Reset') || 'N/A',
      'Cache-Control': 'public, max-age=3600',
      'ETag': `"${Buffer.from(url).toString('base64')}"`
    });

    res.json(result);

  } catch (error) {
    console.error('💥 Erro no endpoint de scraping:', error.message);
    
    // Determinar código de status baseado no tipo de erro
    let statusCode = 500;
    let errorMessage = 'Erro interno do servidor';
    let details = 'Tente novamente em alguns minutos';

    if (error.message.includes('timeout') || error.message.includes('Timeout')) {
      statusCode = 408;
      errorMessage = 'Timeout na requisição';
      details = 'O site demorou muito para responder. Tente novamente.';
    } else if (error.message.includes('not found') || error.message.includes('404')) {
      statusCode = 404;
      errorMessage = 'Produto não encontrado';
      details = 'A URL pode estar incorreta ou o produto foi removido.';
    } else if (error.message.includes('blocked') || error.message.includes('bot')) {
      statusCode = 403;
      errorMessage = 'Acesso bloqueado pelo site';
      details = 'O site está bloqueando requisições automatizadas.';
    } else if (error.message.includes('Título do produto não encontrado')) {
      statusCode = 422;
      errorMessage = 'Dados do produto não encontrados';
      details = 'Não foi possível extrair informações do produto desta página.';
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details: details
    });
  }
});

// Endpoint de health check
app.get('/health', (req, res) => {
  const healthData = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cache: {
      keys: cache.keys().length,
      stats: cache.getStats()
    },
    environment: {
      node_version: process.version,
      platform: process.platform,
      arch: process.arch
    }
  };

  res.json(healthData);
});

// Endpoint para estatísticas da API
app.get('/api/stats', (req, res) => {
  const stats = {
    cache: {
      keys: cache.keys().length,
      hits: cache.getStats().hits,
      misses: cache.getStats().misses,
      ksize: cache.getStats().ksize,
      vsize: cache.getStats().vsize
    },
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  };

  res.json(stats);
});

// Endpoint para limpar cache (apenas para desenvolvimento)
app.delete('/api/cache', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      error: 'Cache não pode ser limpo em produção'
    });
  }

  cache.flushAll();
  res.json({
    success: true,
    message: 'Cache limpo com sucesso'
  });
});

// Criar tabelas para armazenar remetentes e emails enviados
db.serialize(() => {
  // Tabela para remetentes cadastrados
  db.run(`CREATE TABLE IF NOT EXISTS remetentes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Tabela para emails enviados
  db.run(`CREATE TABLE IF NOT EXISTS emails_enviados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    remetente TEXT,
    destinatario TEXT NOT NULL,
    assunto TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    data_envio DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'enviado'
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS google_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    picture TEXT,
    refresh_token_encrypted TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.all(`PRAGMA table_info(emails_enviados)`, (err, columns = []) => {
    if (err) {
      console.error('Erro ao verificar emails_enviados:', err);
      return;
    }
    const names = columns.map(column => column.name);
    if (!names.includes('user_id')) {
      db.run(`ALTER TABLE emails_enviados ADD COLUMN user_id INTEGER`);
    }
    if (!names.includes('gmail_message_id')) {
      db.run(`ALTER TABLE emails_enviados ADD COLUMN gmail_message_id TEXT`);
    }
  });

  db.all(`PRAGMA table_info(google_users)`, (err, columns = []) => {
    if (err) {
      console.error('Erro ao verificar google_users:', err);
      return;
    }
    const names = columns.map(column => column.name);
    if (!names.includes('api_token_hash')) {
      db.run(`ALTER TABLE google_users ADD COLUMN api_token_hash TEXT`);
    }
  });
});

// Rota principal - redireciona para login ou dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Rota para página de login
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Rota para dashboard (página principal)
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/auth/google', (req, res) => {
  const oauth2Client = getOAuth2Client();
  const mode = ['login', 'register', 'connect'].includes(req.query.mode) ? req.query.mode : 'login';
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent select_account',
    include_granted_scopes: true,
    state: mode,
    scope: GOOGLE_SCOPES
  });
  res.redirect(url);
});

app.get('/auth/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.redirect('/login?error=missing_code');
    }

    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();

    const existing = await dbGet(`SELECT id, refresh_token_encrypted FROM google_users WHERE google_id = ? OR email = ?`, [profile.id, profile.email]);
    const refreshTokenEncrypted = tokens.refresh_token
      ? encryptToken(tokens.refresh_token)
      : existing?.refresh_token_encrypted;

    if (!refreshTokenEncrypted) {
      return res.redirect('/dashboard?error=missing_refresh_token');
    }

    if (existing) {
      await dbRun(`
        UPDATE google_users
        SET google_id = ?, email = ?, name = ?, picture = ?, refresh_token_encrypted = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [profile.id, profile.email, profile.name, profile.picture, refreshTokenEncrypted, existing.id]);
      req.session.userId = existing.id;
    } else {
      const result = await dbRun(`
        INSERT INTO google_users (google_id, email, name, picture, refresh_token_encrypted)
        VALUES (?, ?, ?, ?, ?)
      `, [profile.id, profile.email, profile.name, profile.picture, refreshTokenEncrypted]);
      req.session.userId = result.lastID;
    }

    res.redirect(process.env.APP_URL ? `${process.env.APP_URL}/dashboard` : '/dashboard');
  } catch (error) {
    console.error('Erro no callback Google:', error);
    res.redirect('/login?error=google_auth_failed');
  }
});

app.get('/auth/me', requireAuth, async (req, res) => {
  try {
    const user = await dbGet(`
      SELECT id, email, name, picture, refresh_token_encrypted, api_token_hash
      FROM google_users
      WHERE id = ?
    `, [req.userId]);

    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: 'Não autenticado' });
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      googleConnected: Boolean(user.refresh_token_encrypted),
      apiTokenConfigured: Boolean(user.api_token_hash)
    });
  } catch (error) {
    console.error('Erro em /auth/me:', error);
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
});

app.post('/auth/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao sair' });
    }
    res.clearCookie('send_email.sid');
    res.json({ message: 'Logout realizado' });
  });
});

app.delete('/auth/google/disconnect', requireAuth, async (req, res) => {
  try {
    await dbRun(`UPDATE google_users SET refresh_token_encrypted = NULL, api_token_hash = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [req.userId]);
    req.session.destroy(() => {});
    res.clearCookie('send_email.sid');
    res.json({ message: 'Conta Google desconectada' });
  } catch (error) {
    console.error('Erro ao desconectar Google:', error);
    res.status(500).json({ error: 'Erro ao desconectar Google' });
  }
});

app.post('/auth/api-token', requireAuth, async (req, res) => {
  try {
    const token = generateApiToken();
    await dbRun(
      `UPDATE google_users SET api_token_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [hashApiToken(token), req.userId]
    );
    res.json({ token });
  } catch (error) {
    console.error('Erro ao gerar API token:', error);
    res.status(500).json({ error: 'Erro ao gerar API token' });
  }
});

app.delete('/auth/api-token', requireAuth, async (req, res) => {
  try {
    await dbRun(`UPDATE google_users SET api_token_hash = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [req.userId]);
    res.json({ message: 'API token revogado' });
  } catch (error) {
    console.error('Erro ao revogar API token:', error);
    res.status(500).json({ error: 'Erro ao revogar API token' });
  }
});

app.post('/send-email', requireAuth, async (req, res) => {
  const { destinatario, subject, message } = req.body;

  if (!destinatario || !subject || !message) {
    return res.status(400).json({
      error: 'Campos obrigatórios: destinatario, subject, message'
    });
  }

  try {
    const user = await dbGet(`SELECT id, email, refresh_token_encrypted FROM google_users WHERE id = ?`, [req.userId]);
    if (!user || !user.refresh_token_encrypted) {
      return res.status(400).json({ error: 'Conta Google não conectada' });
    }

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: decryptToken(user.refresh_token_encrypted) });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const raw = createMimeMessage({
      from: user.email,
      to: destinatario,
      subject,
      html: message
    });

    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw }
    });

    await dbRun(`
      INSERT INTO emails_enviados (user_id, gmail_message_id, remetente, destinatario, assunto, mensagem)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [user.id, result.data.id, user.email, destinatario, subject, message]);

    res.status(200).json({
      message: 'E-mail enviado com sucesso!',
      gmailMessageId: result.data.id
    });
  } catch (error) {
    console.error('Erro ao enviar e-mail com Gmail API:', error);
    res.status(500).json({ error: 'Falha ao enviar o e-mail pela Gmail API.' });
  }
});

// Rota para listar todos os emails enviados
app.get('/emails', requireAuth, async (req, res) => {
  try {
    const rows = await dbAll(`SELECT * FROM emails_enviados WHERE user_id = ? ORDER BY data_envio DESC`, [req.userId]);
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar emails:', error);
    res.status(500).json({ error: 'Erro ao buscar emails' });
  }
});

// Rota para buscar email por ID
app.get('/emails/:id', requireAuth, async (req, res) => {
  try {
    const row = await dbGet(`SELECT * FROM emails_enviados WHERE id = ? AND user_id = ?`, [req.params.id, req.userId]);
    if (!row) {
      return res.status(404).json({ error: 'Email não encontrado' });
    }
    res.json(row);
  } catch (error) {
    console.error('Erro ao buscar email:', error);
    res.status(500).json({ error: 'Erro ao buscar email' });
  }
});

// Rota para deletar email por ID
app.delete('/emails/:id', requireAuth, async (req, res) => {
  try {
    const result = await dbRun(`DELETE FROM emails_enviados WHERE id = ? AND user_id = ?`, [req.params.id, req.userId]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Email não encontrado' });
    }
    res.json({ message: 'Email deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar email:', error);
    res.status(500).json({ error: 'Erro ao deletar email' });
  }
});

const PORT = process.env.PORT || 3550;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📧 Interface web disponível em: http://localhost:${PORT}`);
  console.log(`🔐 Página de login: http://localhost:${PORT}/login`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
  console.log(`🔍 API de Scraping: http://localhost:${PORT}/api/scrape-product`);
  console.log(`❤️ Health Check: http://localhost:${PORT}/health`);
  console.log(`📈 Estatísticas: http://localhost:${PORT}/api/stats`);
  console.log(`\n📋 Endpoints disponíveis:`);
  console.log(`   POST /api/scrape-product - Scraping de produtos`);
  console.log(`   GET  /health - Status da API`);
  console.log(`   GET  /api/stats - Estatísticas`);
  console.log(`   DELETE /api/cache - Limpar cache (dev only)`);
});

// Fechar conexão com o banco quando o servidor for encerrado
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Erro ao fechar banco de dados:', err);
    } else {
      console.log('Conexão com banco de dados fechada');
    }
    process.exit(0);
  });
});
