/**
 * Playwright script — shows the AI Quote result screen with a mocked API response.
 * Uses route interception so no ANTHROPIC_API_KEY is required.
 */
const { chromium } = require('@playwright/test')
const path = require('path')
const fs = require('fs')

const MOCK_ANALYSIS_RESPONSE = {
  analysisId: 'mock-demo-123456',
  result: {
    diagnosis:
      'נורת ABS דולקת יחד עם תופעת משיכה שמאלה בזמן בלימה מצביעה בסבירות גבוהה על ' +
      'שחיקת רפידות בלמים קדמיות וכשל בחיישן ABS קדמי-שמאלי. רפידות שחוקות גורמות ' +
      'לפעולת בלמים לא סימטרית ומסבירות את המשיכה. חיישן ABS תקול מונע את פעולת מערכת ' +
      'ה-ABS בגלגל הפגוע ומפעיל את נורת האזהרה בלוח.',
    confidence: 0.88,
    urgency: 'high',
    safetyWarning:
      'רכב עם בלמים לא סימטריים ו-ABS לא תקין מסכן בטיחות. אין לנסוע במהירות גבוהה או בגשם עד לתיקון.',
    laborOperations: [
      {
        name: 'החלפת רפידות בלמים קדמיות',
        estimatedHours: 1.5,
        description: 'פירוק קליפרים, בדיקת דיסקים, התקנת רפידות חדשות + שמן בלמים',
      },
      {
        name: 'בדיקה והחלפת חיישן ABS קדמי-שמאלי',
        estimatedHours: 1.0,
        description: 'סריקת שגיאות OBD-II, בדיקת חיישן עם מולטימטר, החלפה והחזרת קוד',
      },
    ],
    totalLaborHours: 2.5,
    partsRecommended: [
      {
        name: 'סט רפידות בלמים קדמיות',
        category: 'brakes',
        quantity: 1,
        estimatedPriceILS: 180,
        isOptional: false,
        notes: 'מומלץ Brembo או TRW',
      },
      {
        name: 'חיישן ABS קדמי-שמאלי',
        category: 'brakes',
        quantity: 1,
        estimatedPriceILS: 220,
        isOptional: false,
        notes: 'התאמה לפי מספר שלדה',
      },
      {
        name: 'נוזל בלמים DOT 4',
        category: 'fluid',
        quantity: 1,
        estimatedPriceILS: 45,
        isOptional: true,
        notes: 'אם מתחת לרמה המינימלית',
      },
    ],
    additionalChecks: [
      'בדוק עובי דיסקים קדמיים — אם מתחת ל-22 מ"מ יש להחליף',
      'בדוק רפידות אחוריות (לרוב מתבלות מהר יותר בסובארו)',
      'בדוק אם יש דליפת נוזל בלמים מהקליפר השמאלי',
    ],
    aiNotes:
      'בעיות ABS בשילוב עם בלמים שחוקים נפוצות בטויוטה קורולה 2019-2020 בגלל חיישני ' +
      'ABS הרגישים לחלודה. מומלץ להחליף את שני חיישני ABS הקדמיים ביחד אם הרכב מעל ' +
      '80,000 ק"מ כדי למנוע תקלה חוזרת בעתיד הקרוב.',
  },
}

const MOCK_VEHICLE_RESPONSE = {
  found: true,
  vehicle: {
    plate: '1234567',
    make: 'Toyota',
    model: 'Corolla',
    year: 2019,
    mileage: 87500,
    color: 'לבן פנינה',
  },
}

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  // ── Route mocks ──────────────────────────────────────────────────────────────
  await page.route('**/api/vehicle-lookup**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_VEHICLE_RESPONSE),
    })
  })

  await page.route('**/api/ai-quote', route => {
    if (route.request().method() === 'POST') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ANALYSIS_RESPONSE),
      })
    } else {
      route.continue()
    }
  })

  const outDir = path.join(__dirname, '..', 'screenshots')
  fs.mkdirSync(outDir, { recursive: true })

  try {
    // ── Login ──────────────────────────────────────────────────────────────────
    console.log('Logging in…')
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 30000 })
    await page.fill('input[type="email"], input[name="email"]', 'owner@garage.com')
    await page.fill('input[type="password"], input[name="password"]', 'admin123')
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }),
      page.click('button[type="submit"]'),
    ])
    console.log('Logged in, URL:', page.url())

    // ── Navigate to ai-quotes ──────────────────────────────────────────────────
    await page.goto('http://localhost:3000/dashboard/ai-quotes', {
      waitUntil: 'networkidle',
      timeout: 30000,
    })
    await page.waitForTimeout(800)
    console.log('On ai-quotes page')

    // ── Screenshot: form step ──────────────────────────────────────────────────
    await page.screenshot({ path: path.join(outDir, '01-form.png'), fullPage: true })
    console.log('Screenshot 1: form')

    // ── Fill plate (triggers vehicle lookup mock) ──────────────────────────────
    const plateInput = page.locator('input[inputmode="numeric"]').first()
    await plateInput.fill('1234567')
    await page.waitForTimeout(700)  // debounce fires after 500ms

    // ── Fill complaint ─────────────────────────────────────────────────────────
    const textarea = page.locator('textarea[dir="rtl"]').first()
    await textarea.fill(
      'נורת ABS דולקת בלוח מגע חודש. בנוסף, בזמן בלימה חזקה הרכב מושך שמאלה. ' +
      'ניסיתי לאפס את נורת האזהרה אבל היא חוזרת מיד. שמעתי גם רעש שריטה קל מצד שמאל.'
    )
    await page.waitForTimeout(300)

    // ── Screenshot: form filled ────────────────────────────────────────────────
    await page.screenshot({ path: path.join(outDir, '02-form-filled.png'), fullPage: true })
    console.log('Screenshot 2: form filled with vehicle lookup')

    // ── Submit ────────────────────────────────────────────────────────────────
    console.log('Submitting for analysis…')
    await page.click('button:has-text("נתח")')

    // Wait for "analyzing" step to appear briefly, then result step
    await page.waitForSelector('text=Claude מנתח', { timeout: 5000 }).catch(() => {})

    // ── Screenshot: analyzing ─────────────────────────────────────────────────
    await page.screenshot({ path: path.join(outDir, '03-analyzing.png'), fullPage: true })
    console.log('Screenshot 3: analyzing spinner')

    // Wait for result step (analysis completes quickly with mock)
    await page.waitForSelector('text=תוצאות ניתוח AI', { timeout: 10000 })
    await page.waitForTimeout(500)

    // ── Screenshot: result (top) ──────────────────────────────────────────────
    await page.screenshot({ path: path.join(outDir, '04-result-top.png'), fullPage: false })
    console.log('Screenshot 4: result screen (viewport)')

    // Full-page result screenshot
    await page.screenshot({ path: path.join(outDir, '05-result-full.png'), fullPage: true })
    console.log('Screenshot 5: result screen (full page)')

    // Scroll to totals section
    await page.locator('text=סה"כ לתשלום').scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)
    await page.screenshot({ path: path.join(outDir, '06-result-totals.png'), fullPage: false })
    console.log('Screenshot 6: totals section')

    // ── Verify no error boundary ───────────────────────────────────────────────
    const errBoundary = await page.locator('text=שגיאה בטעינת הדף').count()
    if (errBoundary > 0) {
      console.error('ERROR: Error boundary found!')
      process.exit(1)
    }

    // Print summary
    const diagnosis = await page.locator('text=נורת ABS').first().textContent().catch(() => '')
    const safetyWarning = await page.locator('text=רכב עם בלמים').count()
    const confidence = await page.locator('text=88%').count()

    console.log('\n✓ Result screen loaded successfully')
    console.log('  Safety warning banner:', safetyWarning > 0 ? '✓ visible' : '✗ not found')
    console.log('  Confidence meter 88%:', confidence > 0 ? '✓ visible' : '✗ not found')
    console.log('  Diagnosis text:', diagnosis ? '✓ present' : '✗ empty')

    const urgencyBadge = await page.locator('text=דחוף').count()
    console.log('  Urgency badge "דחוף":', urgencyBadge > 0 ? '✓ visible' : '✗ not found')

  } catch (err) {
    console.error('Script error:', err.message)
    await page.screenshot({ path: path.join(outDir, 'error-mock.png'), fullPage: true }).catch(() => {})
    process.exit(1)
  } finally {
    await browser.close()
  }
})()
