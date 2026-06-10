/**
 * Seed realistic AI Quote analyses for demo / testing.
 *
 * Usage:
 *   node scripts/seed-ai-analyses.js
 *
 * Inserts 6 AiQuoteAnalysis records spanning different vehicles,
 * urgencies, and confidence levels.  Timestamps are spread over the
 * past 12 days so the history panel looks live.
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// ─── Demo records ──────────────────────────────────────────────────────────────

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000)
}

const DEMO_ANALYSES = [

  // 1 — High urgency, ABS + brakes, Toyota Corolla, 11 days ago
  {
    vehiclePlate:  '1234567',
    vehicleMake:   'Toyota',
    vehicleModel:  'Corolla',
    vehicleYear:   2020,
    vehicleMileage: 64200,
    complaintText: 'רעידות חזקות בדוושת הבלם ובהגה בזמן בלימה מעל 80 קמ"ש. נורת ABS דולקת.',
    diagnosis:     'רוטורים קדמיים עקומים (DTV) + חיישן ABS קדמי-שמאלי תקול. בקורולה E210 הרוטורים דקים ורגישים לעיוות תרמי.',
    confidence:    0.91,
    urgency:       'high',
    safetyWarning: 'רכב עם ABS לא תקין ובלמים לא סימטריים — אין לנסוע במהירות גבוהה עד לתיקון.',
    aiNotes:       'מומלץ להחליף שני רוטורים קדמיים ביחד. השתמש ב-OEM Toyota בלבד.',
    laborOperations: [
      { name: 'החלפת רוטורים ורפידות קדמיות', description: 'פירוק קליפרים, דיסקים, התקנת רוטורים ורפידות חדשים', estimatedHours: 2.0 },
      { name: 'בדיקה והחלפת חיישן ABS', description: 'סריקת OBD-II, החלפת חיישן ABS קדמי-שמאלי', estimatedHours: 1.0 },
    ],
    totalLaborHours: 3.0,
    partsRecommended: [
      { name: 'רוטור בלמים קדמי ימין', category: 'brakes', quantity: 1, estimatedPriceILS: 290, isOptional: false },
      { name: 'רוטור בלמים קדמי שמאל', category: 'brakes', quantity: 1, estimatedPriceILS: 290, isOptional: false },
      { name: 'סט רפידות בלמים קדמיות', category: 'brakes', quantity: 1, estimatedPriceILS: 175, isOptional: false },
      { name: 'חיישן ABS קדמי שמאלי', category: 'electrical', quantity: 1, estimatedPriceILS: 220, isOptional: false },
    ],
    additionalChecks: ['בדוק עובי רוטורים אחוריים', 'בדוק נוזל בלמים — אם ישן בצע דימום'],
    laborRateUsed: 295,
    laborTotal:    885,
    partsTotal:    975,
    subtotal:      1860,
    vatAmount:     316.2,
    totalEstimate: 2176.2,
    modelUsed:     'claude-opus-4-5',
    inputTokens:   850,
    outputTokens:  620,
    rawResponse:   {},
    createdAt:     daysAgo(11),
  },

  // 2 — Medium urgency, AC not cooling, Hyundai Tucson, 8 days ago
  {
    vehiclePlate:  '8765432',
    vehicleMake:   'Hyundai',
    vehicleModel:  'Tucson',
    vehicleYear:   2019,
    vehicleMileage: 87000,
    complaintText: 'המזגן לא מקרר — אוויר חמים גם בקירור מקסימלי. ריח עובש חזק בהפעלה.',
    diagnosis:     'אובדן פריאון R-134a (דליפה אפשרית מדחס או אוורור) + פילטר מזגן סתום. הריח מעיד על עובש בתא האוורור.',
    confidence:    0.78,
    urgency:       'medium',
    safetyWarning: null,
    aiNotes:       'לפני מילוי פריאון — בדוק דליפות עם מכשיר UV. אל תמלא ללא איתור מקור הדליפה.',
    laborOperations: [
      { name: 'בדיקת מערכת מזגן + איתור דליפה', description: 'חיבור מד לחץ, בדיקת UV, בדיקת דחס', estimatedHours: 1.0 },
      { name: 'מילוי פריאון R-134a', description: 'ריקון ומילוי גז לפי מפרט יצרן', estimatedHours: 0.5 },
      { name: 'ניקוי תא אוורור ואנטיבקטריאלי', description: 'ריסוס אנטיבקטריאלי + ניקוי אוורור', estimatedHours: 0.5 },
      { name: 'החלפת פילטר מזגן', description: 'פילטר מזגן / אבק', estimatedHours: 0.25 },
    ],
    totalLaborHours: 2.25,
    partsRecommended: [
      { name: 'גז פריאון R-134a (1 ק"ג)', category: 'ac', quantity: 1, estimatedPriceILS: 180, isOptional: false },
      { name: 'פילטר מזגן Hyundai Tucson', category: 'filter', quantity: 1, estimatedPriceILS: 85, isOptional: false },
      { name: 'תכשיר ניקוי אוורור', category: 'other', quantity: 1, estimatedPriceILS: 45, isOptional: false },
    ],
    additionalChecks: ['בדוק רצועת קומפרסור', 'בדוק מפוח מזגן — שמיעת רעש חריג'],
    laborRateUsed: 295,
    laborTotal:    663.75,
    partsTotal:    310,
    subtotal:      973.75,
    vatAmount:     165.54,
    totalEstimate: 1139.29,
    modelUsed:     'claude-opus-4-5',
    inputTokens:   720,
    outputTokens:  540,
    rawResponse:   {},
    createdAt:     daysAgo(8),
  },

  // 3 — Critical urgency, dead battery + no start, Mazda 3, 6 days ago
  {
    vehiclePlate:  '3456789',
    vehicleMake:   'Mazda',
    vehicleModel:  '3',
    vehicleYear:   2018,
    vehicleMileage: 103500,
    complaintText: 'הרכב לא מתניע — קליק בודד ואז שקט. אורות הלוח דולקים חלש. ניסיתי דחיפה אבל לא עזר.',
    diagnosis:     'מצבר מרוקן לחלוטין או מת. עם 103,500 ק"מ ו-6 שנים — מצבר בסוף חייו. קליק יחיד מעיד על מצבר ולא על מצת הזנקה.',
    confidence:    0.95,
    urgency:       'critical',
    safetyWarning: 'רכב לא נסיע — יש צורך בגרירה או טעינת חוץ לפני הגעה למוסך.',
    aiNotes:       'עם 103K ק"מ ומצבר בן 6 שנים — החלפה מיידית. אל תסתפק בטעינה. בדוק גם גנרטור ורצועה.',
    laborOperations: [
      { name: 'בדיקת מצבר וגנרטור', description: 'בדיקת עומס, מתח, זרם טעינה', estimatedHours: 0.5 },
      { name: 'החלפת מצבר', description: 'פינוי ישן, התקנת חדש, איפוס BMS', estimatedHours: 0.5 },
    ],
    totalLaborHours: 1.0,
    partsRecommended: [
      { name: 'מצבר Varta 70Ah', category: 'electrical', quantity: 1, estimatedPriceILS: 480, isOptional: false },
    ],
    additionalChecks: ['בדוק מצת הזנקה (סטרטר)', 'בדוק גנרטור — מתח טעינה 13.8–14.4V', 'בדוק רצועות'],
    laborRateUsed: 295,
    laborTotal:    295,
    partsTotal:    480,
    subtotal:      775,
    vatAmount:     131.75,
    totalEstimate: 906.75,
    modelUsed:     'claude-opus-4-5',
    inputTokens:   680,
    outputTokens:  480,
    rawResponse:   {},
    createdAt:     daysAgo(6),
  },

  // 4 — Low urgency, regular service, Toyota Yaris, 4 days ago
  {
    vehiclePlate:  '5678901',
    vehicleMake:   'Toyota',
    vehicleModel:  'Yaris',
    vehicleYear:   2017,
    vehicleMileage: 92000,
    complaintText: 'טיפול תקופתי — 15,000 ק"מ מהטיפול האחרון. רוצה גם בדיקת רפידות ומגבים.',
    diagnosis:     'טיפול שגרתי סטנדרטי. עם 92,000 ק"מ — מומלץ לבדוק גם פלוגות ורצועת תזמון לפי מפרט יצרן (כל 90K).',
    confidence:    0.99,
    urgency:       'low',
    safetyWarning: null,
    aiNotes:       'ביארס 1.0 לית ל-3 מצתות בלבד. פלוגות NGK מקוריות מומלצות. בדוק תזמון — יצרן ממליץ על 90K.',
    laborOperations: [
      { name: 'טיפול תקופתי — שמן + פילטר', description: 'שמן 5W-30 מלא + פילטר שמן', estimatedHours: 0.5 },
      { name: 'בדיקת רפידות ומגבים', description: 'בדיקת עובי רפידות 4 גלגלים, מגבים קדמי ואחורי', estimatedHours: 0.5 },
    ],
    totalLaborHours: 1.0,
    partsRecommended: [
      { name: 'שמן מנוע 5W-30 (4L)', category: 'fluid', quantity: 1, estimatedPriceILS: 155, isOptional: false },
      { name: 'פילטר שמן Toyota Yaris', category: 'filter', quantity: 1, estimatedPriceILS: 45, isOptional: false },
      { name: 'פילטר אוויר', category: 'filter', quantity: 1, estimatedPriceILS: 75, isOptional: true },
      { name: 'סט מגבים קדמיים', category: 'other', quantity: 1, estimatedPriceILS: 95, isOptional: true },
    ],
    additionalChecks: ['בדוק פלוגות — כל 45K ק"מ', 'בדוק רצועת תזמון — קריטי ב-90K'],
    laborRateUsed: 295,
    laborTotal:    295,
    partsTotal:    200,
    subtotal:      495,
    vatAmount:     84.15,
    totalEstimate: 579.15,
    modelUsed:     'claude-opus-4-5',
    inputTokens:   610,
    outputTokens:  440,
    rawResponse:   {},
    createdAt:     daysAgo(4),
  },

  // 5 — High urgency, suspension noise + steering, Kia Sportage, 2 days ago
  {
    vehiclePlate:  '2345678',
    vehicleMake:   'Kia',
    vehicleModel:  'Sportage',
    vehicleYear:   2021,
    vehicleMileage: 51000,
    complaintText: 'רעש "קלוק" חזק מצד שמאל קדמי על מהמורות. ההגה מרגיש רפוי. הרכב מתנדנד.',
    diagnosis:     'בולם זעזועים קדמי-שמאלי תקול + קצה הגה שמאלי שחוק. שני הממצאים גורמים ביחד לחוסר יציבות ולרעש על מהמורות.',
    confidence:    0.83,
    urgency:       'high',
    safetyWarning: 'בולם זעזועים תקול מסכן יציבות בבלימה חירום ובנסיעה מהירה.',
    aiNotes:       "ספורטאג' 2021 ידוע בבלאי מהיר של קצות הגה בנסיעות שטח. בדוק גם את הצד ימין — לרוב בלאי זוגי.",
    laborOperations: [
      { name: 'החלפת בולם זעזועים קדמי-שמאלי', description: 'פירוק ציר, בולם, כרית, הרכבה ויישור גלגלים', estimatedHours: 2.0 },
      { name: 'החלפת קצה הגה שמאלי', description: 'פירוק וכיוון הגה, התקנת קצה חדש', estimatedHours: 1.0 },
      { name: 'יישור גלגלים 4 ציר', description: 'מדידה ויישור מלא לאחר החלפות', estimatedHours: 0.5 },
    ],
    totalLaborHours: 3.5,
    partsRecommended: [
      { name: 'בולם זעזועים קדמי-שמאלי KYB', category: 'suspension', quantity: 1, estimatedPriceILS: 420, isOptional: false },
      { name: 'קצה הגה שמאלי Kia Sportage', category: 'suspension', quantity: 1, estimatedPriceILS: 185, isOptional: false },
      { name: 'כרית בולם עליונה', category: 'suspension', quantity: 1, estimatedPriceILS: 120, isOptional: true },
    ],
    additionalChecks: ['בדוק קצה הגה ימני — לרוב בלאי זוגי', 'בדוק מיסב גלגל קדמי-שמאלי', 'בדוק שרוול הגה'],
    laborRateUsed: 295,
    laborTotal:    1032.5,
    partsTotal:    605,
    subtotal:      1637.5,
    vatAmount:     278.375,
    totalEstimate: 1915.875,
    modelUsed:     'claude-opus-4-5',
    inputTokens:   790,
    outputTokens:  590,
    rawResponse:   {},
    createdAt:     daysAgo(2),
  },

  // 6 — Medium urgency, Check Engine + rough idle, Honda Civic, today
  {
    vehiclePlate:  '9012345',
    vehicleMake:   'Honda',
    vehicleModel:  'Civic',
    vehicleYear:   2016,
    vehicleMileage: 128000,
    complaintText: 'נורת Check Engine דולקת כשבוע. הרכב רועד בסרלנטי. לפעמים חוסר כוח בהאצה.',
    diagnosis:     'מצת הצתה תקול (P0301/P0303) + קוצבי דלק ישנים. ציוויק 1.5T ידוע ברגישות של מצתות בתדר גבוה. עם 128K — מומלץ לחדש את כל הסט.',
    confidence:    0.86,
    urgency:       'medium',
    safetyWarning: null,
    aiNotes:       'ציוויק 2016 עם טורבו — בדוק גם שמן מנוע (ידוע בדילול שמן). אם יש ריח דלק בשמן — בעיה ידועה ב-1.5T.',
    laborOperations: [
      { name: 'סריקת שגיאות OBD-II', description: 'קריאת קודים, מחיקה ובדיקת Live Data', estimatedHours: 0.5 },
      { name: 'החלפת סט מצתות הצתה', description: 'פירוק כיסוי מנוע, החלפת 4 מצתות NGK', estimatedHours: 1.0 },
    ],
    totalLaborHours: 1.5,
    partsRecommended: [
      { name: 'סט מצתות NGK Iridium (4 יח\')', category: 'engine', quantity: 1, estimatedPriceILS: 240, isOptional: false },
    ],
    additionalChecks: ['בדוק רמת שמן + ריח שמן — בעיית דילול שמן ידועה', 'בדוק קוצבי דלק', 'בדוק פילטר אוויר'],
    laborRateUsed: 295,
    laborTotal:    442.5,
    partsTotal:    240,
    subtotal:      682.5,
    vatAmount:     116.025,
    totalEstimate: 798.525,
    modelUsed:     'claude-opus-4-5',
    inputTokens:   710,
    outputTokens:  530,
    rawResponse:   {},
    createdAt:     daysAgo(0.3),
  },
]

// ─── Runner ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔍  Finding organization…')

  const org = await prisma.organization.findFirst({ select: { id: true, name: true } })
  if (!org) {
    console.error('❌  No organization found. Run the main seed first.')
    process.exit(1)
  }

  console.log(`✓   Org: ${org.name} (${org.id})`)

  // Remove existing demo analyses (identified by our demo plates)
  const demoPLates = DEMO_ANALYSES.map(a => a.vehiclePlate)
  const deleted = await prisma.aiQuoteAnalysis.deleteMany({
    where: { organizationId: org.id, vehiclePlate: { in: demoPLates } },
  })
  if (deleted.count) console.log(`🗑   Removed ${deleted.count} previous demo records`)

  console.log(`📝  Inserting ${DEMO_ANALYSES.length} demo analyses…`)

  for (const [i, a] of DEMO_ANALYSES.entries()) {
    await prisma.aiQuoteAnalysis.create({
      data: {
        organizationId:   org.id,
        vehiclePlate:     a.vehiclePlate,
        vehicleMake:      a.vehicleMake,
        vehicleModel:     a.vehicleModel,
        vehicleYear:      a.vehicleYear,
        vehicleMileage:   a.vehicleMileage,
        complaintText:    a.complaintText,
        photoUrls:        [],
        rawResponse:      a.rawResponse,
        diagnosis:        a.diagnosis,
        confidence:       a.confidence,
        urgency:          a.urgency,
        laborOperations:  a.laborOperations,
        totalLaborHours:  a.totalLaborHours,
        partsRecommended: a.partsRecommended,
        additionalChecks: a.additionalChecks,
        safetyWarning:    a.safetyWarning,
        aiNotes:          a.aiNotes,
        laborRateUsed:    a.laborRateUsed,
        laborTotal:       a.laborTotal,
        partsTotal:       a.partsTotal,
        subtotal:         a.subtotal,
        vatAmount:        a.vatAmount,
        totalEstimate:    a.totalEstimate,
        modelUsed:        a.modelUsed,
        inputTokens:      a.inputTokens,
        outputTokens:     a.outputTokens,
        createdAt:        a.createdAt,
      },
    })
    console.log(`  [${i + 1}/${DEMO_ANALYSES.length}] ${a.vehicleMake} ${a.vehicleModel} — ${a.urgency} — ₪${a.totalEstimate.toLocaleString('he-IL')}`)
  }

  console.log('\n✅  Done! Refresh /dashboard/ai-quotes to see the history panel.')
}

main()
  .catch(e => { console.error('❌ Seed failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
