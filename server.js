/**
 * Script de capturas para justificaciones Kit Digital
 * Incluye: barra de navegador simulada (Chrome Style) + espera de animaciones
 * Soporte n8n: Archivos estáticos y URLs en respuesta.
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;
const express = require('express');

// Configuración de viewports
const VIEWPORTS = {
    desktop: { width: 1920, height: 1080, name: 'desktop' },
    tablet: { width: 768, height: 1024, name: 'tablet' },
    mobile: { width: 375, height: 812, name: 'mobile' }
};

// Altura de la barra de navegador simulada
const BROWSER_BAR_HEIGHT = 80;

/**
 * Genera SVG de barra de navegador estilo Chrome Moderno
 */
function generateBrowserBarSVG(url, viewport) {
    const width = viewport.width;
    const isMobile = viewport.name === 'mobile';
    const isTablet = viewport.name === 'tablet';

    // Simplificar URL para mostrar
    const displayUrl = url.replace(/^https?:\/\//, '').replace(/\/$/, '');

    // Colores Chrome
    const colors = {
        bg: '#dfe1e5',
        tabActive: '#ffffff',
        toolbar: '#ffffff',
        text: '#3c4043',
        textLight: '#5f6368',
        separator: '#dadce0',
        addressBg: '#f1f3f4'
    };

    return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${BROWSER_BAR_HEIGHT}">
      <!-- Fondo general (Tab strip background) -->
      <rect width="${width}" height="${BROWSER_BAR_HEIGHT}" fill="${colors.bg}"/>
      
      <!-- Toolbar Background (White part) -->
      <rect y="40" width="${width}" height="40" fill="${colors.toolbar}"/>
      <line x1="0" y1="80" x2="${width}" y2="80" stroke="${colors.separator}" stroke-width="1"/>

      ${!isMobile ? `
      <!-- Pestaña Activa -->
      <path d="M 0 40 L 0 40 L 7 40 C 7 40 12 40 12 35 L 12 15 C 12 10 16 7 20 7 L 220 7 C 224 7 228 10 228 15 L 228 35 C 228 40 233 40 233 40 L ${width} 40 L ${width} 80 L 0 80 Z" fill="${colors.tabActive}"/>
      
      <!-- Favicon Placeholder -->
      <circle cx="25" cy="24" r="7" fill="${colors.separator}"/>

      <!-- Texto Pestaña -->
      <text x="40" y="28" font-family="Segoe UI, Roboto, Arial, sans-serif" font-size="12" fill="${colors.text}">
        ${displayUrl.substring(0, 25)}${displayUrl.length > 25 ? '...' : ''}
      </text>

      <!-- Botón Cerrar Pestaña (X) -->
      <text x="210" y="28" font-family="Segoe UI, Roboto, Arial, sans-serif" font-size="14" fill="${colors.textLight}">×</text>
      ` : ''}

      <!-- Barra de Direcciones (Pill shape) -->
      <rect x="${isMobile ? 10 : 100}" y="47" 
            width="${isMobile ? width - 20 : (isTablet ? width - 200 : width - 250)}" 
            height="28" rx="14" fill="${colors.addressBg}"/>
      
      <!-- Candado -->
      <g transform="translate(${isMobile ? 22 : 115}, 53)">
        <path d="M4 6V4a4 4 0 118 0v2h1a1 1 0 011 1v7a1 1 0 01-1 1H3a1 1 0 01-1-1V7a1 1 0 011-1h1zm2-2v2h4V4a2 2 0 10-4 0z" 
              fill="${colors.textLight}" transform="scale(0.85)"/>
      </g>
      
      <!-- URL Text -->
      <text x="${isMobile ? 45 : 135}" y="65" 
            font-family="Segoe UI, Roboto, Arial, sans-serif" font-size="13" fill="${colors.text}">
        ${displayUrl}
      </text>
      
      <!-- Botones de Navegación (Solo Desktop/Tablet) -->
      ${!isMobile ? `
      <g transform="translate(15, 52)">
         <!-- Back Arrow -->
         <path d="M 20 10 L 10 20 L 30 20 L 13 20 L 20 30" fill="none" stroke="${colors.textLight}" stroke-width="2" transform="scale(0.5) translate(-10,-10)"/> 
         <!-- Forward Arrow -->
         <path d="M 50 10 L 60 20 L 40 20 L 57 20 L 50 30" fill="none" stroke="${colors.separator}" stroke-width="2" transform="scale(0.5) translate(-10,-10)"/>
         <!-- Reload -->
         <path d="M 90 10 A 10 10 0 1 0 100 20 L 100 15" fill="none" stroke="${colors.textLight}" stroke-width="2" transform="scale(0.5) translate(-10,-10)"/>
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
    await new Promise(r => setTimeout(r, 2000));
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
        '#onetrust-accept-btn-handler',
        '#CybotCookiebotDialog'
    ];

    for (const selector of selectors) {
        try {
            const button = await page.$(selector);
            if (button) {
                await button.click();
                await new Promise(r => setTimeout(r, 500));
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
        await new Promise(r => setTimeout(r, 500));

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
 * Captura WordPress admin y editores
 */
async function captureWordPress(page, wpUrl, wpUser, wpPass, outputDir, targetPages, baseUrl) {
    const results = [];
    console.log('  🔐 Capturando WordPress...');

    try {
        // 1. Login
        await page.goto(`${wpUrl}/wp-login.php`, { waitUntil: 'networkidle0' });

        await page.type('#user_login', wpUser);
        await page.type('#user_pass', wpPass);

        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click('#wp-submit')
        ]);

        // Validar login
        if (page.url().includes('wp-login.php')) {
            throw new Error('Login fallido');
        }

        // 2. Dashboard
        await new Promise(r => setTimeout(r, 1000));
        let screenshot = await page.screenshot({ type: 'png' });
        let filepath = path.join(outputDir, 'wordpress', 'dashboard.png');
        await fs.mkdir(path.dirname(filepath), { recursive: true });
        await fs.writeFile(filepath, screenshot);
        results.push({ page: 'wordpress', section: 'dashboard', path: filepath });
        console.log('    ✅ dashboard.png');

        // 3. Listado de Páginas
        await page.goto(`${wpUrl}/wp-admin/edit.php?post_type=page`, { waitUntil: 'networkidle0' });
        await new Promise(r => setTimeout(r, 1000));
        screenshot = await page.screenshot({ type: 'png' });
        filepath = path.join(outputDir, 'wordpress', 'paginas.png');
        await fs.writeFile(filepath, screenshot);
        results.push({ page: 'wordpress', section: 'paginas', path: filepath });
        console.log('    ✅ paginas.png');

        // 4. Capturar Editores de cada página objetivo (Inicio, Servicios, Contacto)
        if (targetPages && targetPages.length > 0) {
            console.log('    🔍 Buscando editores de páginas...');
            for (const p of targetPages) {
                // Estrategia: Ir a la página frontend (logueado) y buscar el botón de editar en la admin bar
                // Probamos la primera ruta válida
                const pagePath = p.paths[0];
                const frontendUrl = baseUrl.replace(/\/$/, '') + pagePath;

                try {
                    await page.goto(frontendUrl, { waitUntil: 'networkidle0' });

                    // Buscar enlace "Editar página" en admin bar
                    // ID típico: #wp-admin-bar-edit > a
                    const editLinkSelector = '#wp-admin-bar-edit a';
                    const editLink = await page.$(editLinkSelector);

                    if (editLink) {
                        console.log(`      ✏️ Editor encontrado para ${p.name}`);
                        await Promise.all([
                            page.waitForNavigation({ waitUntil: 'networkidle0' }),
                            editLink.click()
                        ]);

                        // Esperar a que cargue el editor (Gutenberg o Classic)
                        // Gutenberg tiene .edit-post-layout, Classic #postdivrich
                        try {
                            await page.waitForSelector('.edit-post-layout, #postdivrich, #editor', { timeout: 10000 });
                        } catch (e) { /* wait a bit anyway */ }

                        await new Promise(r => setTimeout(r, 2000)); // Espera extra para renderizado

                        screenshot = await page.screenshot({ type: 'png' });
                        filepath = path.join(outputDir, 'wordpress', `editor_${p.name}.png`);
                        await fs.writeFile(filepath, screenshot);
                        results.push({ page: 'wordpress', section: `editor_${p.name}`, path: filepath });
                        console.log(`      ✅ editor_${p.name}.png`);
                    } else {
                        console.log(`      ⚠️ No se encontró botón editar para ${p.name} en frontend`);
                    }

                } catch (err) {
                    console.log(`      ❌ Error capturando editor de ${p.name}: ${err.message}`);
                }
            }
        }

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
    const outputDir = path.join(__dirname, 'capturas', cliente_nombre);
    const allResults = [];
    const errors = [];

    console.log(`\n🚀 Iniciando capturas para: ${cliente_nombre}`);
    console.log(`   URL: ${url_base}\n`);

    // Iniciar navegador
    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--window-size=1920,1080' // Importante para que la admin bar se vea desktop
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
        // Pasamos generic pages para que intente capturar el editor de cada una
        const wpResults = await captureWordPress(page, wp_url, wp_user, wp_pass, outputDir, pages, url_base);
        allResults.push(...wpResults);
    }

    await browser.close();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n✅ Completado en ${duration}s`);
    console.log(`   Total capturas: ${allResults.length}`);

    // Agregar URLs locales para acceso via HTTP (para n8n)
    const resultsWithUrls = allResults.map(r => ({
        ...r,
        // Convertir path absoluto a relativo para la URL
        // r.path es C:\...\capturas\Cliente\desktop\img.png
        // Necesitamos /files/Cliente/desktop/img.png
        url_local: `http://localhost:${PORT}/files/${path.relative(path.join(__dirname, 'capturas'), r.path).replace(/\\/g, '/')}`
    }));

    return {
        success: errors.length === 0,
        archivos: resultsWithUrls,
        errores: errors,
        tiempo_total: parseFloat(duration),
        output_dir: outputDir
    };
}

// ====================================
// MODO API / WEBHOOK
// ====================================
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
// Servir carpeta de capturas estáticamente
app.use('/files', express.static(path.join(__dirname, 'capturas')));

// Endpoint principal
app.post('/capturar', async (req, res) => {
    try {
        const result = await captureWebsite(req.body);
        res.json(result);
    } catch (e) {
        console.error(e);
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
            cliente_nombre: 'test_updated_features',
            include_browser_bar: true
        });

        // Devolver solo las capturas de desktop de inicio para visualizar en respuesta (opcional)
        // O simplemente el JSON
        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`🖥️  Server corriendo en puerto ${PORT}`);
    console.log(`   POST /capturar - Captura completa`);
    console.log(`   GET /test?url=https://ejemplo.com - Test rápido`);
    console.log(`   📂 Archivos estáticos en: http://localhost:${PORT}/files/`);
});
