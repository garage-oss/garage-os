const { chromium } = require('@playwright/test')
const path = require('path')
const fs = require('fs')

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
  })
  const page = await context.newPage()

  // Capture any console errors
  const consoleErrors = []
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })

  try {
    // ── Step 1: Load login page ──────────────────────────────────────────────
    console.log('Navigating to login…')
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 30000 })

    // ── Step 2: Fill credentials ─────────────────────────────────────────────
    console.log('Filling credentials…')
    await page.fill('input[type="email"], input[name="email"], input[placeholder*="mail" i]', 'owner@garage.com')
    await page.fill('input[type="password"], input[name="password"]', 'admin123')

    // ── Step 3: Submit ───────────────────────────────────────────────────────
    console.log('Submitting…')
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }),
      page.click('button[type="submit"]'),
    ])
    console.log('After login URL:', page.url())

    // ── Step 4: Navigate to ai-quotes ────────────────────────────────────────
    console.log('Navigating to /dashboard/ai-quotes…')
    await page.goto('http://localhost:3000/dashboard/ai-quotes', {
      waitUntil: 'networkidle',
      timeout: 30000,
    })
    console.log('Current URL:', page.url())

    // Wait for page content to settle
    await page.waitForTimeout(1500)

    // ── Step 5: Screenshot ───────────────────────────────────────────────────
    const outDir = path.join(__dirname, '..', 'screenshots')
    fs.mkdirSync(outDir, { recursive: true })
    const screenshotPath = path.join(outDir, 'ai-quotes-page.png')
    await page.screenshot({ path: screenshotPath, fullPage: true })
    console.log('Screenshot saved:', screenshotPath)

    // ── Step 6: Check for error boundary ────────────────────────────────────
    const errorBoundaryText = await page.locator('text=שגיאה בטעינת הדף').count()
    if (errorBoundaryText > 0) {
      console.error('ERROR: Error boundary is still showing!')
      process.exit(1)
    } else {
      console.log('✓ No error boundary — page loaded successfully')
    }

    // ── Step 7: Check for AI warning banner ─────────────────────────────────
    const warningBanner = await page.locator('text=ANTHROPIC_API_KEY').count()
    if (warningBanner > 0) {
      console.log('⚠ Amber warning banner present (ANTHROPIC_API_KEY not set — expected)')
    }

    // Print page title / heading for verification
    const h1 = await page.locator('h1').first().textContent().catch(() => '(no h1)')
    console.log('Page heading:', h1)

    if (consoleErrors.length > 0) {
      console.log('Console errors:', consoleErrors.join('\n'))
    }

  } catch (err) {
    console.error('Script error:', err.message)
    // Take error screenshot
    const errPath = path.join(__dirname, '..', 'screenshots', 'ai-quotes-error.png')
    fs.mkdirSync(path.dirname(errPath), { recursive: true })
    await page.screenshot({ path: errPath, fullPage: true }).catch(() => {})
    process.exit(1)
  } finally {
    await browser.close()
  }
})()
