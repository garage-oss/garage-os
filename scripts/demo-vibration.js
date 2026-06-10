/**
 * Demo: Toyota Corolla 2020 — "רעידות בבלימה במהירות גבוהה"
 * Mocks /api/ai-quote and /api/vehicle-lookup for a realistic result screen.
 */
const { chromium } = require('@playwright/test')
const path = require('path')
const fs = require('fs')

// ─── Mock data ────────────────────────────────────────────────────────────────

const VEHICLE = {
  found: true,
  vehicle: {
    plate:   '8523691',
    make:    'Toyota',
    model:   'Corolla',
    year:    2020,
    mileage: 64200,
    color:   'אפור מטאלי',
  },
}

const ANALYSIS = {
  analysisId: 'demo-vibration-2026',
  result: {

    diagnosis:
      'רעידות בזמן בלימה במהירות גבוהה הן סימן קלאסי לרוטורים עקומים או בעלי ' +
      'שחיקה לא אחידה (DTV — Disc Thickness Variation). כשהרוטור אינו שטוח, ' +
      'רפידות הבלמים מכות בבליטות בכל סיבוב ומייצרות רטט שמועבר דרך דוושת הבלם ' +
      'וגלגל ההגה. בקורולה E210 (2020) הרוטורים הקדמיים דקים יחסית לדורות קודמים ' +
      'ורגישים יותר לעיוות תרמי. עם 64,000 ק"מ — גם הרפידות הקדמיות כנראה קרובות ' +
      'לסף החלפה. המלצה: החלפת רוטורים ורפידות קדמיות ובדיקת אחוריים.',

    confidence: 0.93,
    urgency:    'medium',
    safetyWarning: null,

    laborOperations: [
      {
        name:           'החלפת רוטורים ורפידות בלמים קדמיות',
        estimatedHours: 2.0,
        description:    'פירוק גלגלים, קליפרים, דיסקים — התקנת רוטורים ורפידות חדשים, ' +
                        'שטיפת קליפרים, דריכת בלמים',
      },
      {
        name:           'בדיקת רפידות ורוטורים אחוריים',
        estimatedHours: 0.5,
        description:    'מדידת עובי רוטורים אחוריים, בדיקת רפידות — דו"ח כתוב לאישור לקוח',
      },
      {
        name:           'דימום והחלפת נוזל בלמים',
        estimatedHours: 0.5,
        description:    'ניקוז נוזל ישן, מילוי DOT 4 חדש, פריצת אוויר ממערכת',
      },
    ],
    totalLaborHours: 3.0,

    partsRecommended: [
      {
        name:               'רוטור בלמים קדמי — ימין',
        category:           'brakes',
        quantity:           1,
        estimatedPriceILS:  290,
        isOptional:         false,
        notes:              'OEM Toyota או Brembo UV Coated',
      },
      {
        name:               'רוטור בלמים קדמי — שמאל',
        category:           'brakes',
        quantity:           1,
        estimatedPriceILS:  290,
        isOptional:         false,
        notes:              'יש להחליף זוג תמיד ביחד',
      },
      {
        name:               'סט רפידות בלמים קדמיות',
        category:           'brakes',
        quantity:           1,
        estimatedPriceILS:  175,
        isOptional:         false,
        notes:              'Akebono או TRW — מומלץ לא להשתמש ב-budget brands',
      },
      {
        name:               'נוזל בלמים DOT 4',
        category:           'fluid',
        quantity:           1,
        estimatedPriceILS:  48,
        isOptional:         false,
        notes:              'Castrol React DOT 4',
      },
      {
        name:               'סט רפידות בלמים אחוריות',
        category:           'brakes',
        quantity:           1,
        estimatedPriceILS:  145,
        isOptional:         true,
        notes:              'רק אם עובי מתחת ל-3 מ"מ בבדיקה',
      },
    ],

    additionalChecks: [
      'מדוד עובי רוטורים אחוריים — אם מתחת ל-8 מ"מ החלף',
      'בדוק תקינות מנגנון חוצ קליפר קדמי — הידוק לא שווה גורם לעיוות מהיר',
      'בדוק נפיחות גומי של צינורות בלמים גמישים',
      'בדוק מיסבי גלגל קדמיים — גם הם יכולים לייצר רטט דומה',
    ],

    aiNotes:
      'קורולה E210 ידועה בבעיה זו: רוטורים דקים שמועדים לעיוות אחרי בלימות חוזרות ' +
      'או נסיעות בירידות ארוכות. מומלץ מאוד להשתמש ברוטורים OEM Toyota (4351202340) ' +
      'או Brembo UV Coated ולא בחלקי תחליף זולים — רוטורים זולים בקורולה E210 מתעוותים ' +
      'שוב תוך 15,000–20,000 ק"מ. לאחר ההחלפה יש לדרוך בלמים בשיטת Bedding-in.',
  },
}

// ─── Script ───────────────────────────────────────────────────────────────────

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page    = await context.newPage()

  // Route mocks
  await page.route('**/api/vehicle-lookup**', route =>
    route.fulfill({ status: 200, contentType: 'application/json',
                    body: JSON.stringify(VEHICLE) }))

  await page.route('**/api/ai-quote', route =>
    route.request().method() === 'POST'
      ? route.fulfill({ status: 200, contentType: 'application/json',
                        body: JSON.stringify(ANALYSIS) })
      : route.continue())

  const out = path.join(__dirname, '..', 'screenshots', 'demo-vibration')
  fs.mkdirSync(out, { recursive: true })

  try {
    // ── Login ────────────────────────────────────────────────────────────────
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 30000 })
    await page.fill('input[type="email"]',    'owner@garage.com')
    await page.fill('input[type="password"]', 'admin123')
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }),
      page.click('button[type="submit"]'),
    ])

    // ── Navigate ─────────────────────────────────────────────────────────────
    await page.goto('http://localhost:3000/dashboard/ai-quotes',
                    { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(600)

    // ── Fill plate ───────────────────────────────────────────────────────────
    await page.locator('input[inputmode="numeric"]').first().fill('8523691')
    await page.waitForTimeout(800)   // vehicle lookup debounce

    // ── Fill complaint ────────────────────────────────────────────────────────
    await page.locator('textarea[dir="rtl"]').first().fill(
      'יש רעידות בבלימה במהירות גבוהה — בעיקר מעל 80 קמ"ש. ' +
      'הרטט מורגש בדוושת הבלם ובהגה. ברכב 64,000 ק"מ, לא הוחלפו בלמים מאז הרכישה.'
    )
    await page.waitForTimeout(300)

    // Screenshot: form filled + vehicle card
    await page.screenshot({ path: path.join(out, '1-form.png'), fullPage: true })
    console.log('✓ Screenshot 1: form')

    // ── Submit ───────────────────────────────────────────────────────────────
    await page.click('button:has-text("נתח")')

    // Catch analyzing step
    await page.waitForSelector('text=Claude מנתח', { timeout: 5000 }).catch(() => {})
    await page.screenshot({ path: path.join(out, '2-analyzing.png'), fullPage: false })
    console.log('✓ Screenshot 2: analyzing')

    // Wait for result
    await page.waitForSelector('text=תוצאות ניתוח AI', { timeout: 10000 })
    await page.waitForTimeout(400)

    // ── Result: diagnosis card ────────────────────────────────────────────────
    await page.screenshot({ path: path.join(out, '3-result-diagnosis.png'), fullPage: false })
    console.log('✓ Screenshot 3: diagnosis card (viewport)')

    // Scroll down to quote items table
    await page.locator('text=פריטי ההצעה').scrollIntoViewIfNeeded()
    await page.waitForTimeout(250)
    await page.screenshot({ path: path.join(out, '4-result-items.png'), fullPage: false })
    console.log('✓ Screenshot 4: quote items table')

    // Scroll to totals
    await page.locator('text=סה"כ לתשלום').scrollIntoViewIfNeeded()
    await page.waitForTimeout(250)
    await page.screenshot({ path: path.join(out, '5-result-totals.png'), fullPage: false })
    console.log('✓ Screenshot 5: totals + create button')

    // Full page
    await page.screenshot({ path: path.join(out, '6-full-page.png'), fullPage: true })
    console.log('✓ Screenshot 6: full page')

    // ── Verify ───────────────────────────────────────────────────────────────
    const errBoundary = await page.locator('text=שגיאה בטעינת הדף').count()
    if (errBoundary) throw new Error('Error boundary still showing!')

    // Extract totals from DOM
    const totalText = await page.locator('text=סה"כ לתשלום').locator('..').locator('..')
                                .textContent().catch(() => '')

    console.log('\n── Demo results ────────────────────────────────────')
    console.log('  Vehicle:   Toyota Corolla 2020 · 8523691')
    console.log('  Complaint: רעידות בבלימה במהירות גבוהה')
    console.log('  Urgency:   בינוני (Medium)')
    console.log('  Confidence:', await page.locator('text=93%').count() ? '93% ✓' : '?')
    console.log('  Labor ops:',
      await page.locator('[data-type="labor"]').count(),
      '/ Items total:', await page.locator('.divide-y > div').count()
    )

    const subtotalEl = await page.locator('text=סכום לפני מע"מ').locator('..').textContent().catch(() => '')
    console.log('  Totals row:', subtotalEl.trim())
    console.log('────────────────────────────────────────────────────\n')
    console.log('All screenshots saved to screenshots/demo-vibration/')

  } catch (err) {
    console.error('Error:', err.message)
    await page.screenshot({ path: path.join(out, 'error.png'), fullPage: true }).catch(() => {})
    process.exit(1)
  } finally {
    await browser.close()
  }
})()
