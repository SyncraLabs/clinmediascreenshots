const chromium = require('@sparticuz/chromium');
const puppeteerCore = require('puppeteer-core');

// Fallback for local testing if you have full puppeteer installed
let puppeteerLocal;
try {
    puppeteerLocal = require('puppeteer');
} catch (e) { }

/**
 * Vercel Serverless Function to take a single screenshot
 * Input: JSON body { url, viewport, section, deviceScaleFactor, fullPage }
 * Output: Image (Buffer)
 */
module.exports = async (req, res) => {
    // 1. Parse Input
    const {
        url = 'https://example.com',
        viewport = { width: 1920, height: 1080 }, // or "desktop" string if you want to map it here
        section = 'header', // 'header', 'content', 'footer' or null for fullPage
        deviceScaleFactor = 1,
        fullPage = false,
        addBrowserBar = true
    } = req.body || req.query; // Support GET for quick tests too

    // Normalize URL
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }

    let browser = null;

    try {
        // 2. Launch Browser
        // Check if running on Vercel (AWS Lambda) or Local
        const isVercel = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_VERSION;

        if (isVercel) {
            console.log('Running on Vercel/Lambda');
            try {
                // REQUIRED for Vercel: Disable graphics to avoid libnss3 missing errors
                await chromium.font('https://raw.githack.com/googlei18n/noto-emoji/master/fonts/NotoColorEmoji.ttf');
                chromium.setGraphicsMode = false;

                browser = await puppeteerCore.launch({
                    args: [
                        ...chromium.args,
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-gpu',
                        '--no-zygote'
                    ],
                    defaultViewport: chromium.defaultViewport,
                    executablePath: await chromium.executablePath(),
                    headless: chromium.headless,
                    ignoreHTTPSErrors: true,
                });
            } catch (launchError) {
                console.error('Browser Launch Failed:', launchError);
                throw new Error(`Browser launch failed: ${launchError.message}`);
            }
        } else {
            // Local fallback
            if (puppeteerLocal) {
                browser = await puppeteerLocal.launch({
                    headless: "new",
                    args: ['--no-sandbox', '--disable-setuid-sandbox']
                });
            } else {
                throw new Error('Local Puppeteer not found. Run `npm install puppeteer --save-dev`');
            }
        }

        const page = await browser.newPage();

        // Set Viewport
        // normalize viewport if it came as a string or object
        let width = 1920;
        let height = 1080;

        if (typeof viewport === 'string') {
            try {
                const parsed = JSON.parse(viewport);
                width = parseInt(parsed.width) || 1920;
                height = parseInt(parsed.height) || 1080;
            } catch (e) {
                console.log('Viewport string parsing failed, using defaults');
            }
        } else if (typeof viewport === 'object') {
            width = parseInt(viewport.width) || 1920;
            height = parseInt(viewport.height) || 1080;
        }

        await page.setViewport({
            width,
            height,
            deviceScaleFactor: parseInt(deviceScaleFactor) || 1
        });

        // 3. Navigate
        console.log(`Navigating to ${url}`);
        // Use domcontentloaded for faster response on Vercel
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // 4. Cleanup (Cookies & Animations) - Borrowed from original script
        try {
            await closeCookieBanners(page);
            await waitForAnimations(page);
        } catch (e) { console.log('Cleanup warning:', e.message); }

        // 5. Scroll to Section
        let currentY = 0;
        // Optimization: Skip scrolling for header (0 scroll)
        if (!fullPage && section && section !== 'header') {
            try {
                currentY = await scrollToSection(page, section);
                currentY = Math.max(0, currentY);
            } catch (scrollError) {
                console.log('Scroll failed, defaulting to 0', scrollError);
                currentY = 0;
            }
        }

        // 6. Capture
        console.log(`Taking screenshot at Y=${currentY}...`);
        let screenshotBuffer = await page.screenshot({
            type: 'png',
            fullPage: !!fullPage,
            clip: (!fullPage) ? {
                x: 0,
                y: currentY,
                width: width,
                height: height
            } : undefined
        });

        // 7. Add Browser Bar (optional)
        if (addBrowserBar && !fullPage && req.query.skipBar !== 'true') {
            try {
                screenshotBuffer = await addBrowserBarFn(page, screenshotBuffer, url, { width, height });
            } catch (barError) {
                console.error('Browser bar error:', barError);
                // Continue with original screenshot if bar fails
            }
        }

        // 8. Return Result
        res.setHeader('Content-Type', 'image/png');
        // Cache for 1 day mostly to avoid re-generating same image if parameters are identical
        res.setHeader('Cache-Control', 'public, max-age=86400, mutable');
        res.status(200).send(screenshotBuffer);

    } catch (error) {
        console.error('Screenshot Function Error:', error);
        // Ensure we return JSON for errors so n8n can read the message
        res.status(500).json({
            error: 'Failed to take screenshot',
            message: error.message,
            stack: error.stack,
            details: 'Check Vercel Function Logs for more info'
        });
    } finally {
        if (browser) {
            await browser.close();
        }
    }
};

// --- Helpers ---

// Altura de la barra de navegador simulada
const BROWSER_BAR_HEIGHT = 80;

async function addBrowserBarFn(page, screenshotBuffer, url, viewport) {
    // Basic SVG Generation (simplified for single file)
    const barSVG = generateBrowserBarSVG(url, viewport);

    return await page.evaluate(async (params) => {
        const { barSVG, screenshotBase64, barHeight, width, height } = params;

        try {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height + barHeight;
            const ctx = canvas.getContext('2d');

            // Draw Bar
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

            // Draw Screenshot
            const screenshotImg = new Image();
            await new Promise((resolve, reject) => {
                screenshotImg.onload = resolve;
                screenshotImg.onerror = reject;
                screenshotImg.src = 'data:image/png;base64,' + screenshotBase64;
            });
            ctx.drawImage(screenshotImg, 0, barHeight);

            return canvas.toDataURL('image/png').split(',')[1];
        } catch (e) {
            console.error("Canvas Error", e);
            return screenshotBase64; // Fallback to original if canvas fails
        }
    }, {
        barSVG,
        screenshotBase64: screenshotBuffer.toString('base64'),
        barHeight: BROWSER_BAR_HEIGHT,
        width: viewport.width,
        height: viewport.height
    }).then(base64 => Buffer.from(base64, 'base64'));
}

function generateBrowserBarSVG(url, viewport) {
    const width = viewport.width;
    const isMobile = width < 500; // rough mobile check
    const displayUrl = url.replace(/^https?:\/\//, '').replace(/\/$/, '');

    // Simplified Chrome-like bar
    return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${BROWSER_BAR_HEIGHT}">
      <rect width="${width}" height="${BROWSER_BAR_HEIGHT}" fill="#dfe1e5"/>
      <rect y="40" width="${width}" height="40" fill="#ffffff"/>
      <line x1="0" y1="80" x2="${width}" y2="80" stroke="#dadce0" stroke-width="1"/>
      ${!isMobile ? `
      <path d="M 0 40 L 0 40 L 7 40 C 7 40 12 40 12 35 L 12 15 C 12 10 16 7 20 7 L 220 7 C 224 7 228 10 228 15 L 228 35 C 228 40 233 40 233 40 L ${width} 40 L ${width} 80 L 0 80 Z" fill="#ffffff"/>
      <text x="40" y="28" font-family="Arial" font-size="12" fill="#3c4043">${displayUrl.substring(0, 25)}</text>
      <text x="210" y="28" font-family="Arial" font-size="14" fill="#5f6368">×</text>
      ` : ''}
      <rect x="${isMobile ? 10 : 100}" y="47" width="${isMobile ? width - 20 : width - 250}" height="28" rx="14" fill="#f1f3f4"/>
      <text x="${isMobile ? 45 : 135}" y="65" font-family="Arial" font-size="13" fill="#3c4043">${displayUrl}</text>
    </svg>`;
}

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
                break;
            }
        } catch (e) { }
    }
}

async function waitForAnimations(page) {
    try {
        await page.waitForFunction(() => {
            const animations = document.getAnimations();
            if (animations.length === 0) return true;
            return animations.every(a => a.playState === 'finished' || a.playState === 'idle');
        }, { timeout: 3000 });
    } catch (e) { }
}

async function scrollToSection(page, section) {
    const scrollPercentages = {
        header: 0,
        content: 0.4,
        footer: 1
    };

    const percentage = scrollPercentages[section] || 0;

    // Calculate target Y first
    const targetY = await page.evaluate((pct) => {
        const totalHeight = document.body.scrollHeight - window.innerHeight;
        return totalHeight * pct;
    }, percentage);

    // Scroll to it
    await page.evaluate((y) => {
        window.scrollTo({ top: y, behavior: 'instant' });
    }, targetY);

    await new Promise(r => setTimeout(r, 500));

    return targetY;
}
