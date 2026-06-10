/**
 * Screenshots the improved AI Quote page with demo data.
 * Captures: history panel, form with templates + vehicle,
 * and the result screen via mock API.
 */
const { chromium } = require('@playwright/test')
const path = require('path')
const fs   = require('fs')

const MOCK_VEHICLE = {
  found: true,
  vehicle: { plate: '8523691', make: 'Toyota', model: 'Corolla', year: 2020, mileage: 64200, color: 'אפור מטאלי' },
}

const MOCK_ANALYSIS = {
  analysisId: 'ux-demo-2026',
  result: {
    diagnosis:
      'רעידות בזמן בלימה במהירות גבוהה — סימן קלאסי לרוטורים עקומים (DTV). ' +
      'בקורולה E210 הרוטורים דקים ורגישים לעיוות תרמי. עם 64,200 ק"מ — רפידות קרובות לסף החלפה.',
    confidence: 0.93,
    urgency:    'medium',
    safetyWarning: null,
    laborOperations: [
      { name: 'החלפת רוטורים ורפידות קדמיות', estimatedHours: 2.0, description: '' },
      { name: 'בדיקת מתלים אחוריים',           estimatedHours: 0.5, description: '' },
      { name: 'דימום נוזל בלמים',               estimatedHours: 0.5, description: '' },
    ],
    totalLaborHours: 3.0,
    partsRecommended: [
      { name: 'רוטור בלמים קדמי ימין',    category: 'brakes', quantity: 1, estimatedPriceILS: 290, isOptional: false, notes: 'OEM Toyota' },
      { name: 'רוטור בלמים קדמי שמאל',    category: 'brakes', quantity: 1, estimatedPriceILS: 290, isOptional: false },
      { name: 'סט רפידות בלמים קדמיות',   category: 'brakes', quantity: 1, estimatedPriceILS: 175, isOptional: false, notes: 'Akebono' },
      { name: 'נוזל בלמים DOT 4',          category: 'fluid',  quantity: 1, estimatedPriceILS:  48, isOptional: false },
      { name: 'סט רפידות אחוריות',         category: 'brakes', quantity: 1, estimatedPriceILS: 145, isOptional: true },
    ],
    additionalChecks: [
      'מדוד עובי רוטורים אחוריים — אם מתחת ל-8 מ"מ החלף',
      'בדוק תקינות קליפרים — הידוק לא שווה גורם לעיוות',
    ],
    aiNotes:
      'קורולה E210 ידועה ברוטורים דקים. מומלץ OEM Toyota — רוטורים זולים מתעוותים שוב תוך 15,000 ק"מ.',
  },
}

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page    = await context.newPage()

  await page.route('**/api/vehicle-lookup**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_VEHICLE) }))
  await page.route('**/api/ai-quote', r =>
    r.request().method() === 'POST'
      ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ANALYSIS) })
      : r.continue())

  const out = path.join(__dirname, '..', 'screenshots', 'new-ux')
  fs.mkdirSync(out, { recursive: true })

  // ── Login ──────────────────────────────────────────────────────────────────
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 30000 })
  await page.fill('input[type="email"]',    'owner@garage.com')
  await page.fill('input[type="password"]', 'admin123')
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }),
    page.click('button[type="submit"]'),
  ])

  await page.goto('http://localhost:3000/dashboard/ai-quotes', { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(600)

  // ── 1. Full page with history panel ────────────────────────────────────────
  await page.screenshot({ path: path.join(out, '1-full-with-history.png'), fullPage: true })
  console.log('✓ 1-full-with-history')

  // ── 2. Zoom: history panel cards ───────────────────────────────────────────
  const historyPanel = await page.locator('text=ניתוחים אחרונים').locator('..').boundingBox()
  if (historyPanel) {
    await page.screenshot({
      path: path.join(out, '2-history-panel.png'),
      clip: { x: historyPanel.x - 8, y: historyPanel.y - 8, width: historyPanel.width + 16, height: Math.min(historyPanel.height + 16, 820) },
    })
    console.log('✓ 2-history-panel (clipped)')
  }

  // ── 3. Form: click "בלמים" template ───────────────────────────────────────
  await page.click('button:has-text("בלמים")')
  await page.waitForTimeout(200)
  // Fill plate
  await page.locator('input[inputmode="numeric"]').first().fill('8523691')
  await page.waitForTimeout(800)

  await page.screenshot({ path: path.join(out, '3-form-template-selected.png'), fullPage: false })
  console.log('✓ 3-form-template-selected')

  // ── 4. Submit → result ─────────────────────────────────────────────────────
  await page.click('button:has-text("נתח")')
  await page.waitForSelector('text=תוצאות ניתוח AI', { timeout: 10000 })
  await page.waitForTimeout(400)

  await page.screenshot({ path: path.join(out, '4-result-stats-row.png'), fullPage: false })
  console.log('✓ 4-result-stats-row')

  // ── 5. Scroll to items table ───────────────────────────────────────────────
  await page.locator('text=פריטי ההצעה').scrollIntoViewIfNeeded()
  await page.waitForTimeout(200)
  await page.screenshot({ path: path.join(out, '5-result-items-table.png'), fullPage: false })
  console.log('✓ 5-result-items-table')

  // ── 6. Full result page ────────────────────────────────────────────────────
  await page.screenshot({ path: path.join(out, '6-result-full.png'), fullPage: true })
  console.log('✓ 6-result-full')

  await browser.close()
  console.log('\nAll screenshots → screenshots/new-ux/')
})()
