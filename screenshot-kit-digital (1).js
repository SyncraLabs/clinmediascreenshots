/**
 * Script de capturas para justificaciones Kit Digital
 * Incluye: barra de navegador simulada + espera de animaciones
 * 
 * Para usar en Antigravity o servidor con Node.js + Puppeteer
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;

// Configuración de viewports
const VIEWPORTS = {
  desktop: { width: 1920, height: 1080, name: 'desktop' },
  tablet: { width: 768, height: 1024, name: 'tablet' },
  mobile: { width: 375, height: 812, name: 'mobile' }
};

// Altura de la barra de navegador simulada
const BROWSER_BAR_HEIGHT = 80;

/**
 * Genera SVG de barra de navegador estilo Chrome
 */
function generateBrowserBarSVG(url, viewport) {
  const width = viewport.width;
  const isMobile = viewport.name === 'mobile';
  const isTablet = viewport.name === 'tablet';
  
  // Simplificar URL para mostrar
  const displayUrl = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${BROWSER_BAR_HEIGHT}">
      <!-- Fondo de la barra -->
      <rect width="${width}" height="${BROWSER_BAR_HEIGHT}" fill="#f1f3f4"/>
      
      <!-- Línea inferior -->
      <line x1="0" y1="${BROWSER_BAR_HEIGHT - 1}" x2="${width}" y2="${BROWSER_BAR_HEIGHT - 1}" stroke="#dadce0" stroke-width="1"/>
      
      ${!isMobile ? `
      <!-- Pestaña activa -->
      <path d="M 10 ${BROWSER_BAR_HEIGHT - 40} 
               Q 10 ${BROWSER_BAR_HEIGHT - 50} 20 ${BROWSER_BAR_HEIGHT - 50} 
               L 200 ${BROWSER_BAR_HEIGHT - 50} 
               Q 210 ${BROWSER_BAR_HEIGHT - 50} 210 ${BROWSER_BAR_HEIGHT - 40} 
               L 210 ${BROWSER_BAR_HEIGHT - 10}
               L 10 ${BROWSER_BAR_HEIGHT - 10} Z" 
            fill="#ffffff"/>
      
      <!-- Texto de pestaña -->
      <text x="30" y="${BROWSER_BAR_HEIGHT - 25}" font-family="Segoe UI, Arial, sans-serif" font-size="12" fill="#5f6368">
        ${displayUrl.substring(0, 25)}${displayUrl.length > 25 ? '...' : ''}
      </text>
      
      <!-- Botón cerrar pestaña -->
      <circle cx="195" cy="${BROWSER_BAR_HEIGHT - 30}" r="8" fill="transparent"/>
      <text x="192" y="${BROWSER_BAR_HEIGHT - 26}" font-family="Arial" font-size="12" fill="#5f6368">×</text>
      ` : ''}
      
      <!-- Barra de direcciones -->
      <rect x="${isMobile ? 10 : 60}" y="${BROWSER_BAR_HEIGHT - 35}" 
            width="${isMobile ? width - 20 : (isTablet ? width - 200 : width - 400)}" 
            height="30" rx="15" fill="#ffffff" stroke="#dadce0" stroke-width="1"/>
      
      <!-- Icono de candado (HTTPS) -->
      <g transform="translate(${isMobile ? 20 : 75}, ${BROWSER_BAR_HEIGHT - 28})">
        <path d="M4 6V4a4 4 0 118 0v2h1a1 1 0 011 1v7a1 1 0 01-1 1H3a1 1 0 01-1-1V7a1 1 0 011-1h1zm2-2v2h4V4a2 2 0 10-4 0z" 
              fill="#5f6368" transform="scale(0.8)"/>
      </g>
      
      <!-- URL -->
      <text x="${isMobile ? 45 : 100}" y="${BROWSER_BAR_HEIGHT - 15}" 
            font-family="Segoe UI, Arial, sans-serif" font-size="14" fill="#202124">
        ${displayUrl.substring(0, isMobile ? 35 : (isTablet ? 50 : 80))}${displayUrl.length > (isMobile ? 35 : 80) ? '...' : ''}
      </text>
      
      ${!isMobile ? `
      <!-- Botones de navegación (atrás, adelante, refresh) -->
      <g transform="translate(15, ${BROWSER_BAR_HEIGHT - 28})">
        <!-- Atrás -->
        <circle cx="0" cy="7" r="12" fill="transparent"/>
        <path d="M8 7L3 12L8 17" stroke="#5f6368" stroke-width="2" fill="none" transform="scale(0.6) translate(-5, -5)"/>
        
        <!-- Adelante -->
        <circle cx="30" cy="7" r="12" fill="transparent"/>
        <path d="M3 7L8 12L3 17" stroke="#c4c7c9" stroke-width="2" fill="none" transform="translate(25, 0) scale(0.6) translate(-5, -5)"/>
        
        <!-- Refresh -->
        <circle cx="60" cy="7" r="12" fill="transparent"/>
        <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8z" 
              fill="#5f6368" transform="translate(52, -1) scale(0.6)"/>
      </g>
      ` : ''}
    </svg>
  `;
}

/**
 * Combina la barra de navegador con la captura
 */
async function addBrowserBar(page, screenshotBuffer, url, viewport) {
  // Generar SVG de la barra
  const barSVG = generateBrowserBarSVG(url, viewport);
  
  // Usar page.evaluate para combinar imágenes con canvas
  const combinedImage = await page.evaluate(async (params) => {
    const { barSVG, screenshotBase64, barHeight, width, height } = params;
    
    // Crear canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height + barHeight;
    const ctx = canvas.getContext('2d');
    
    // Dibujar barra de navegador
    const barBlob = new Blob([barSVG], { type: 'image/svg+xml' });
    const barUrl = URL.createObjectURL(barBlob);
    const barImg = new Image();
    await new Promise((resolve, reject) => {
      barImg.onload = resolve;
      barImg.onerror = reject;
      barImg.src = barUrl;
    });
    ctx.drawImage(barImg, 0, 0);
    URL.revokeObjectURL(barUrl);
    
    // Dibujar captura
    const screenshotImg = new Image();
    await new Promise((resolve, reject) => {
      screenshotImg.onload = resolve;
      screenshotImg.onerror = reject;
      screenshotImg.src = 'data:image/png;base64,' + screenshotBase64;
    });
    ctx.drawImage(screenshotImg, 0, barHeight);
    
    // Devolver como base64
    return canvas.toDataURL('image/png').split(',')[1];
  }, {
    barSVG,
    screenshotBase64: screenshotBuffer.toString('base64'),
    barHeight: BROWSER_BAR_HEIGHT,
    width: viewport.width,
    height: viewport.height
  });
  
  return Buffer.from(combinedImage, 'base64');
}

/**
 * Espera a que las animaciones terminen
 */
async function waitForAnimations(page, timeout = 5000) {
  try {
    // Esperar a que no haya animaciones CSS en curso
    await page.waitForFunction(() => {
      const animations = document.getAnimations();
      if (animations.length === 0) return true;
      return animations.every(a => a.playState === 'finished' || a.playState === 'idle');
    }, { timeout });
  } catch (e) {
    // Si timeout, al menos esperar un tiempo fijo
    console.log('Animaciones no terminaron, esperando tiempo fijo...');
  }
  
  // Espera adicional de seguridad
  await page.waitForTimeout(2000);
}

/**
 * Cierra popups de cookies comunes
 */
async function closeCookieBanners(page) {
  const selectors = [
    '[class*="cookie"] button[class*="accept"]',
    '[class*="cookie"] button[class*="aceptar"]',
    '[id*="cookie"] button',
    '.cookie-consent button',
    '#cookie-banner button',
    '[class*="consent"] button[class*="accept"]',
    'button[id*="accept-cookies"]',
    '.cc-btn.cc-dismiss',
    '#onetrust-accept-btn-handler'
  ];
  
  for (const selector of selectors) {
    try {
      const button = await page.$(selector);
      if (button) {
        await button.click();
        await page.waitForTimeout(500);
        console.log(`Cookie banner cerrado con: ${selector}`);
        break;
      }
    } catch (e) {
      // Ignorar errores
    }
  }
}

/**
 * Hace scroll a una sección específica
 */
async function scrollToSection(page, section) {
  const scrollPercentages = {
    header: 0,
    content: 0.4,
    footer: 1
  };
  
  const percentage = scrollPercentages[section] || 0;
  
  await page.evaluate(async (pct) => {
    const totalHeight = document.body.scrollHeight - window.innerHeight;
    const targetScroll = totalHeight * pct;
    
    // Scroll suave
    window.scrollTo({
      top: targetScroll,
      behavior: 'instant'
    });
    
    // Esperar a que se estabilice
    await new Promise(r => setTimeout(r, 300));
  }, percentage);
}

/**
 * Captura una página completa
 */
async function capturePageSections(page, url, pageName, outputDir, viewport, addBar = true) {
  const results = [];
  
  console.log(`  📱 Capturando ${pageName} en ${viewport.name}...`);
  
  // Configurar viewport
  await page.setViewport({
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1
  });
  
  // Navegar
  try {
    await page.goto(url, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
  } catch (e) {
    console.log(`  ⚠️ Error cargando ${url}: ${e.message}`);
    return results;
  }
  
  // Cerrar cookies y esperar animaciones
  await closeCookieBanners(page);
  await waitForAnimations(page);
  
  // Capturar cada sección
  for (const section of ['header', 'content', 'footer']) {
    await scrollToSection(page, section);
    await page.waitForTimeout(500);
    
    // Capturar
    let screenshot = await page.screenshot({
      type: 'png',
      clip: {
        x: 0,
        y: 0,
        width: viewport.width,
        height: viewport.height
      }
    });
    
    // Añadir barra de navegador si es necesario
    if (addBar) {
      screenshot = await addBrowserBar(page, screenshot, url, viewport);
    }
    
    // Guardar
    const filename = `${pageName}_${section}.png`;
    const filepath = path.join(outputDir, viewport.name, filename);
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, screenshot);
    
    results.push({
      page: pageName,
      section,
      viewport: viewport.name,
      path: filepath
    });
    
    console.log(`    ✅ ${filename}`);
  }
  
  return results;
}

/**
 * Captura WordPress admin
 */
async function captureWordPress(page, wpUrl, wpUser, wpPass, outputDir) {
  const results = [];
  console.log('  🔐 Capturando WordPress...');
  
  try {
    // Navegar al login
    await page.goto(`${wpUrl}/wp-login.php`, { waitUntil: 'networkidle0' });
    
    // Login
    await page.type('#user_login', wpUser);
    await page.type('#user_pass', wpPass);
    await page.click('#wp-submit');
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    
    // Dashboard
    await page.waitForTimeout(1000);
    let screenshot = await page.screenshot({ type: 'png' });
    let filepath = path.join(outputDir, 'wordpress', 'dashboard.png');
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, screenshot);
    results.push({ page: 'wordpress', section: 'dashboard', path: filepath });
    console.log('    ✅ dashboard.png');
    
    // Páginas
    await page.goto(`${wpUrl}/wp-admin/edit.php?post_type=page`, { waitUntil: 'networkidle0' });
    await page.waitForTimeout(1000);
    screenshot = await page.screenshot({ type: 'png' });
    filepath = path.join(outputDir, 'wordpress', 'paginas.png');
    await fs.writeFile(filepath, screenshot);
    results.push({ page: 'wordpress', section: 'paginas', path: filepath });
    console.log('    ✅ paginas.png');
    
  } catch (e) {
    console.log(`  ⚠️ Error en WordPress: ${e.message}`);
  }
  
  return results;
}

/**
 * Función principal
 */
async function captureWebsite(options) {
  const {
    url_base,
    cliente_nombre,
    wp_url = null,
    wp_user = null,
    wp_pass = null,
    include_browser_bar = true
  } = options;
  
  const startTime = Date.now();
  const outputDir = path.join('/capturas', cliente_nombre);
  const allResults = [];
  const errors = [];
  
  console.log(`\n🚀 Iniciando capturas para: ${cliente_nombre}`);
  console.log(`   URL: ${url_base}\n`);
  
  // Iniciar navegador
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  });
  
  const page = await browser.newPage();
  
  // Páginas a capturar
  const pages = [
    { name: 'inicio', paths: ['/', ''] },
    { name: 'servicios', paths: ['/servicios', '/services', '/nuestros-servicios'] },
    { name: 'contacto', paths: ['/contacto', '/contact', '/contactanos'] }
  ];
  
  // Para cada viewport
  for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
    console.log(`\n📐 Viewport: ${viewportName} (${viewport.width}x${viewport.height})`);
    
    // Para cada página
    for (const pageConfig of pages) {
      let captured = false;
      
      for (const pagePath of pageConfig.paths) {
        if (captured) break;
        
        const fullUrl = url_base.replace(/\/$/, '') + pagePath;
        
        try {
          const results = await capturePageSections(
            page,
            fullUrl,
            pageConfig.name,
            outputDir,
            viewport,
            include_browser_bar
          );
          
          if (results.length > 0) {
            allResults.push(...results);
            captured = true;
          }
        } catch (e) {
          console.log(`  ⚠️ Error en ${fullUrl}: ${e.message}`);
        }
      }
      
      if (!captured) {
        errors.push({
          page: pageConfig.name,
          viewport: viewportName,
          error: 'No se pudo acceder a ninguna variante de URL'
        });
      }
    }
  }
  
  // WordPress (solo desktop)
  if (wp_url && wp_user && wp_pass) {
    await page.setViewport(VIEWPORTS.desktop);
    const wpResults = await captureWordPress(page, wp_url, wp_user, wp_pass, outputDir);
    allResults.push(...wpResults);
  }
  
  await browser.close();
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  console.log(`\n✅ Completado en ${duration}s`);
  console.log(`   Total capturas: ${allResults.length}`);
  console.log(`   Errores: ${errors.length}`);
  
  return {
    success: errors.length === 0,
    archivos: allResults,
    errores: errors,
    tiempo_total: parseFloat(duration),
    output_dir: outputDir
  };
}

// ====================================
// MODO API / WEBHOOK
// ====================================
const express = require('express');
const app = express();
app.use(express.json());

// Endpoint principal
app.post('/capturar', async (req, res) => {
  try {
    const result = await captureWebsite(req.body);
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Endpoint de test rápido
app.get('/test', async (req, res) => {
  const url = req.query.url;
  if (!url) {
    return res.status(400).json({ error: 'Falta parámetro url' });
  }
  
  try {
    const result = await captureWebsite({
      url_base: url,
      cliente_nombre: 'test_' + Date.now(),
      include_browser_bar: true
    });
    
    // Devolver solo las capturas de desktop de inicio
    const testFiles = result.archivos.filter(f => 
      f.viewport === 'desktop' && f.page === 'inicio'
    );
    
    res.json({
      success: result.success,
      archivos: testFiles,
      tiempo: result.tiempo_total
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🖥️  Server corriendo en puerto ${PORT}`);
  console.log(`   POST /capturar - Captura completa`);
  console.log(`   GET /test?url=https://ejemplo.com - Test rápido`);
});

// Para uso directo (CLI)
if (require.main === module && process.argv[2] === '--cli') {
  const url = process.argv[3];
  const nombre = process.argv[4] || 'test';
  
  if (!url) {
    console.log('Uso: node screenshot-kit-digital.js --cli <url> [nombre_cliente]');
    process.exit(1);
  }
  
  captureWebsite({
    url_base: url,
    cliente_nombre: nombre
  }).then(result => {
    console.log(JSON.stringify(result, null, 2));
  });
}

module.exports = { captureWebsite };
