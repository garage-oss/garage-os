/**
 * Mock AI Analysis — deterministic scenarios for demo / no-API-key mode.
 *
 * getMockAnalysis(complaintText, laborRate) detects the service type from
 * Hebrew keywords in the first line of complaintText and returns a full
 * AiQuoteResult with all cost fields computed.
 *
 * Scenarios:
 *   BRAKES · PERIODIC_SERVICE · BATTERY · TIRES · AC · CHECK_ENGINE · DIAGNOSTICS · OTHER
 */

import type { AiQuoteResult } from './ai-quote-engine'

// ─── Config ───────────────────────────────────────────────────────────────────

export const MOCK_DELAY_MS = 1800   // simulate AI thinking time (ms)

// ─── Scenario type ────────────────────────────────────────────────────────────

type PartCat = 'brakes' | 'engine' | 'suspension' | 'electrical' | 'ac' | 'tires' | 'fluid' | 'filter' | 'body' | 'other'

interface Scenario {
  diagnosis:       string
  confidence:      number
  urgency:         'low' | 'medium' | 'high' | 'critical'
  laborOperations: Array<{ name: string; estimatedHours: number; description: string }>
  totalLaborHours: number
  partsRecommended: Array<{
    name:              string
    category:          PartCat
    quantity:          number
    estimatedPriceILS: number
    isOptional:        boolean
    notes?:            string
  }>
  additionalChecks: string[]
  safetyWarning:   string | null
  aiNotes:         string
}

// ─── 8 mock scenarios ─────────────────────────────────────────────────────────

const SCENARIOS: Record<string, Scenario> = {

  // ── Brakes (user-supplied example) ──────────────────────────────────────────
  BRAKES: {
    diagnosis:      'דיסקים קדמיים עקומים + רפידות שחוקות — מגע לא אחיד גורם לרעידות בהגה בעת בלימה',
    confidence:     0.88,
    urgency:        'high',
    laborOperations: [
      { name: 'הסרת גלגלים קדמיים',     estimatedHours: 0.25, description: 'פירוק גלגלי קדמיים לגישה למנגנון הבלם' },
      { name: 'החלפת דיסקי בלם קדמיים', estimatedHours: 0.75, description: 'הסרת דיסקים ישנים והתקנת חדשים מקוריים' },
      { name: 'החלפת רפידות קדמיות',    estimatedHours: 0.50, description: 'החלפת ערכת רפידות עם כיוון קליפרים' },
    ],
    totalLaborHours: 1.5,
    partsRecommended: [
      { name: 'דיסקי בלם קדמיים', category: 'brakes', quantity: 2, estimatedPriceILS: 350, isOptional: false, notes: 'מומלץ להחליף שניהם יחד' },
      { name: 'ערכת רפידות קדמיות', category: 'brakes', quantity: 1, estimatedPriceILS: 280, isOptional: false },
      { name: 'נוזל בלמים DOT 4 (500 מ"ל)', category: 'fluid', quantity: 1, estimatedPriceILS: 45, isOptional: true, notes: 'מומלץ לחידוש בכל החלפת בלמים' },
    ],
    additionalChecks: [
      'בדיקת עובי דיסקים ורפידות אחוריים',
      'בדיקת צינורות בלמים הידראוליים לדליפות',
      'בדיקת קליפרים קדמיים לתקינות',
    ],
    safetyWarning: 'בלמים פגומים מהווים סכנת חיים — מומלץ להגביל נסיעה עד לסיום התיקון',
    aiNotes: 'רעידות בהגה בעת בלימה הן סימן קלאסי לדיסקים עקומים. מומלץ להחליף גם את הרפידות האחוריות בביקור הבא בהתאם למצאן.',
  },

  // ── Periodic service ─────────────────────────────────────────────────────────
  PERIODIC_SERVICE: {
    diagnosis:      'טיפול תקופתי סטנדרטי — שמן מנוע וצמיגות מחייבים החלפה, פילטרים בחינה',
    confidence:     0.95,
    urgency:        'low',
    laborOperations: [
      { name: 'החלפת שמן ופילטר שמן',              estimatedHours: 0.5,  description: 'שמן מנוע + פילטר שמן' },
      { name: 'בדיקה ובמידת הצורך החלפת פילטרים', estimatedHours: 0.5,  description: 'פילטר אוויר, מזגן, דלק' },
      { name: 'בדיקת מערכות בלמים, נוזלים, בטיחות', estimatedHours: 1.0, description: 'בדיקה ויזואלית מקיפה' },
    ],
    totalLaborHours: 2.0,
    partsRecommended: [
      { name: "שמן מנוע 5W-30 (5 ל')", category: 'fluid',  quantity: 5, estimatedPriceILS: 38,  isOptional: false },
      { name: 'פילטר שמן',              category: 'filter', quantity: 1, estimatedPriceILS: 45,  isOptional: false },
      { name: 'פילטר אוויר מנוע',       category: 'filter', quantity: 1, estimatedPriceILS: 65,  isOptional: false },
      { name: 'פילטר מזגן (מבית)',       category: 'filter', quantity: 1, estimatedPriceILS: 80,  isOptional: true,  notes: 'מומלץ להחליף מדי שנה' },
    ],
    additionalChecks: [
      'בדיקת עובי רפידות בלם',
      'בדיקת לחץ ועיצוב צמיגים',
      'בדיקת נוזל קירור וקרן',
      'בדיקת מצבר ומחלד',
    ],
    safetyWarning: null,
    aiNotes: 'בטיפול תקופתי מומלץ לבדוק גם את מצב הצמיגים ורצועת ה-Timing לפי יצרן.',
  },

  // ── Battery ──────────────────────────────────────────────────────────────────
  BATTERY: {
    diagnosis:      'מצבר חלש — קיבולת ירודה (כ-42% מהקיבולת המקורית), עלול לגרום לקשיי הגת בקור',
    confidence:     0.91,
    urgency:        'medium',
    laborOperations: [
      { name: 'בדיקת מצבר ומחלד (בדיקת עומס)', estimatedHours: 0.25, description: 'בדיקת מתח ועומס עם טסטר מצבר' },
      { name: 'החלפת מצבר',                    estimatedHours: 0.25, description: 'ניתוק, החלפה, חיבור, כיוון זרם' },
    ],
    totalLaborHours: 0.5,
    partsRecommended: [
      { name: 'מצבר Bosch S4 60Ah',    category: 'electrical', quantity: 1, estimatedPriceILS: 580, isOptional: false },
      { name: 'ממסר / ביטחון ראשי 80A', category: 'electrical', quantity: 1, estimatedPriceILS: 95,  isOptional: true,  notes: 'לבדיקה בזמן פירוק' },
    ],
    additionalChecks: [
      'בדיקת מצב המחלד (אלטרנטור)',
      'בדיקת חיבורי חשמל ראשיים',
      'בדיקת מתח אחרי 15 דקות הפעלה',
    ],
    safetyWarning: null,
    aiNotes: 'אם לאחר החלפת המצבר הרכב עדיין מתקשה לנסוע — יש לבדוק את המחלד.',
  },

  // ── Tires ────────────────────────────────────────────────────────────────────
  TIRES: {
    diagnosis:      'צמיגים קדמיים שחוקים (עומק < 2 מ"מ) + שחיקה לא אחידה — מעיד על כיוון גלגלים לקוי',
    confidence:     0.93,
    urgency:        'high',
    laborOperations: [
      { name: 'פירוק, החלפה ואיזון 4 צמיגים', estimatedHours: 1.0, description: 'כולל איזון דינמי' },
      { name: 'כיוון גלגלים',                 estimatedHours: 0.5, description: 'כיוון 4 גלגלים במחשב' },
    ],
    totalLaborHours: 1.5,
    partsRecommended: [
      { name: 'התקנה ואיזון (4 צמיגים)',  category: 'tires', quantity: 1, estimatedPriceILS: 200, isOptional: false, notes: 'אינו כולל את הצמיגים עצמם' },
      { name: 'כיוון גלגלים',             category: 'tires', quantity: 1, estimatedPriceILS: 180, isOptional: false },
      { name: 'שסתומי אוויר (TPMS)',       category: 'tires', quantity: 4, estimatedPriceILS: 18,  isOptional: true },
    ],
    additionalChecks: [
      'בדיקת גלגל רזרבי ולחץ',
      'בדיקת מצב מתלים קדמיים',
      'בדיקת לחץ לאחר 50 ק"מ',
    ],
    safetyWarning: 'צמיגים שחוקים מסכנים חיים במיוחד בגשם — יש להחליף לפני הנסיעה הבאה בגשם',
    aiNotes: 'שחיקה לא אחידה תחזור גם על הצמיגים החדשים אם כיוון הגלגלים לא יתוקן מיד.',
  },

  // ── AC (air conditioning) ────────────────────────────────────────────────────
  AC: {
    diagnosis:      'דליפת גז קלה ממערכת המזגן + פילטר מזגן מבית סתום — קירור חלש וריח לא נעים',
    confidence:     0.82,
    urgency:        'medium',
    laborOperations: [
      { name: 'בדיקת לחץ מערכת מזגן',    estimatedHours: 0.5,  description: 'בדיקת לחצים High/Low ואיתור דליפות' },
      { name: 'טעינת גז מזגן R134a',      estimatedHours: 0.75, description: 'טעינה על-פי מפרט יצרן' },
      { name: 'החלפת פילטר מזגן מבית',   estimatedHours: 0.25, description: 'פירוק לוח מכוונים + החלפה' },
    ],
    totalLaborHours: 1.5,
    partsRecommended: [
      { name: "גז מזגן R134a (500 ג')",  category: 'ac',     quantity: 1, estimatedPriceILS: 160, isOptional: false },
      { name: 'פילטר מזגן מבית',         category: 'filter', quantity: 1, estimatedPriceILS: 85,  isOptional: false },
      { name: 'צינור גמיש HP (אם נמצאה דליפה)', category: 'ac', quantity: 1, estimatedPriceILS: 220, isOptional: true, notes: 'להחלפה רק אם איתור מציין צינור' },
    ],
    additionalChecks: [
      'בדיקת קומפרסור — רעש ולחץ',
      'בדיקת קונדנסר לסתימות',
      'בדיקת לחץ לאחר שעת הפעלה',
    ],
    safetyWarning: null,
    aiNotes: 'אם הקירור אינו חוזר לאחר טעינת גז — ייתכן שהקומפרסור תקול ויש לבדוק אותו בנפרד.',
  },

  // ── Check engine light ────────────────────────────────────────────────────────
  CHECK_ENGINE: {
    diagnosis:      'קוד שגיאה P0141 — חיישן חמצן 2 (Downstream, אחרי קטליזטור) פגום',
    confidence:     0.79,
    urgency:        'medium',
    laborOperations: [
      { name: 'אבחון קודי שגיאה (OBD2)',  estimatedHours: 0.5,  description: 'סריקה עם מחשב אבחון מקצועי' },
      { name: 'בדיקת חיישני חמצן',        estimatedHours: 0.5,  description: 'בדיקת ריאקטיביות וזמני תגובה' },
      { name: 'החלפת חיישן חמצן O2',      estimatedHours: 1.0,  description: 'פירוק מהצינור, השחלת חיישן חדש' },
    ],
    totalLaborHours: 2.0,
    partsRecommended: [
      { name: 'חיישן חמצן O2 (Downstream)', category: 'engine', quantity: 1, estimatedPriceILS: 320,  isOptional: false },
      { name: 'קטליזטור',                   category: 'engine', quantity: 1, estimatedPriceILS: 1800, isOptional: true,  notes: 'לבדיקה בלבד אם שגיאה חוזרת' },
    ],
    additionalChecks: [
      'בדיקת חיישן חמצן Upstream (לפני קטליזטור)',
      'בדיקת ריצה חלקה לאחר איפוס שגיאות',
      'בדיקת זרם אוויר MAF',
    ],
    safetyWarning: null,
    aiNotes: 'אם הנורה חוזרת לאחר 200 ק"מ — יש לבדוק את יעילות הקטליזטור עצמו (קוד P0420).',
  },

  // ── Diagnostics / suspension ─────────────────────────────────────────────────
  DIAGNOSTICS: {
    diagnosis:      'בלאי שוקים קדמיים + מנחים עקומים — גורמים לרעש "קנקנוק" ולסטיית כיוון בנהיגה מהירה',
    confidence:     0.84,
    urgency:        'high',
    laborOperations: [
      { name: 'בדיקת מתלים, מנחים, כדורים', estimatedHours: 0.5,  description: 'בדיקה ויזואלית ובדיקת משחק' },
      { name: 'החלפת שוקים קדמיים',          estimatedHours: 1.5,  description: 'פירוק, החלפה, הידוק טורקים' },
      { name: 'כיוון גלגלים לאחר החלפה',     estimatedHours: 0.5,  description: 'כיוון 4 גלגלים במחשב' },
    ],
    totalLaborHours: 2.5,
    partsRecommended: [
      { name: 'שוק קדמי שמאל', category: 'suspension', quantity: 1, estimatedPriceILS: 420, isOptional: false },
      { name: 'שוק קדמי ימין', category: 'suspension', quantity: 1, estimatedPriceILS: 420, isOptional: false },
      { name: 'מסב גלגל קדמי', category: 'suspension', quantity: 2, estimatedPriceILS: 280, isOptional: true, notes: 'מומלץ לבדוק בפירוק' },
    ],
    additionalChecks: [
      'בדיקת שוקים אחוריים לבלאי',
      'בדיקת כדורי היגוי (Ball Joints)',
      'בדיקת רצועות מייצבות (Sway Bar)',
    ],
    safetyWarning: 'שוקים תקולים פוגעים ביציבות הרכב בנסיעה מהירה ובבלימה חירום',
    aiNotes: 'אם לאחר החלפת השוקים ישנו עדיין רעש — יש לבדוק מסבים ומנחי קפיץ עליון.',
  },

  // ── Other / general ──────────────────────────────────────────────────────────
  OTHER: {
    diagnosis:      'בדיקה כללית נדרשת — מספר תקלות שוליות זוהו לפי תיאור הלקוח',
    confidence:     0.70,
    urgency:        'low',
    laborOperations: [
      { name: 'בדיקה כללית מקיפה של הרכב', estimatedHours: 1.5, description: 'בדיקת כל מערכות הרכב ותעדוף תיקונים' },
    ],
    totalLaborHours: 1.5,
    partsRecommended: [
      { name: 'חומרי ניקוי ושימון', category: 'other', quantity: 1, estimatedPriceILS: 50, isOptional: true, notes: 'לפי צורך' },
    ],
    additionalChecks: [
      'בדיקת כל אורות חיצוניים ופנימיים',
      'בדיקת ניגובי שמשה',
      'בדיקת תא מנוע — נוזלים, חיבורים, בלאי',
    ],
    safetyWarning: null,
    aiNotes: 'לאחר הבדיקה הכללית נוכל לספק הצעת מחיר מפורטת ומדויקת.',
  },
}

// ─── Keyword detection ────────────────────────────────────────────────────────

function detectScenario(complaintText: string): Scenario {
  const t = complaintText.toLowerCase()

  if (t.includes('בלמים') || t.includes('רפידות') || t.includes('דיסק') || t.includes('בלם'))
    return SCENARIOS.BRAKES

  if (t.includes('טיפול תקופתי') || t.includes('החלפת שמן') || t.includes('service'))
    return SCENARIOS.PERIODIC_SERVICE

  if (t.includes('מצבר') || t.includes('battery'))
    return SCENARIOS.BATTERY

  if (t.includes('צמיג') || t.includes('tires'))
    return SCENARIOS.TIRES

  if (t.includes('מזגן') || t.includes('ac ') || t.includes(' ac') || t.includes('air'))
    return SCENARIOS.AC

  if (t.includes('נורת מנוע') || t.includes('check engine') || t.includes('שגיאה') || t.includes('obd'))
    return SCENARIOS.CHECK_ENGINE

  if (t.includes('אבחון') || t.includes('שוקים') || t.includes('מתלים') || t.includes('suspension'))
    return SCENARIOS.DIAGNOSTICS

  return SCENARIOS.OTHER
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function getMockAnalysis(complaintText: string, laborRate: number): AiQuoteResult {
  const scenario = detectScenario(complaintText)

  const laborTotal    = Math.round(scenario.totalLaborHours * laborRate * 100) / 100
  const partsTotal    = scenario.partsRecommended.reduce(
    (sum, p) => sum + p.estimatedPriceILS * p.quantity, 0,
  )
  const subtotal      = laborTotal + partsTotal
  const vatAmount     = Math.round(subtotal * 0.17 * 100) / 100
  const totalEstimate = Math.round((subtotal + vatAmount) * 100) / 100

  return {
    // Core AI fields
    diagnosis:        scenario.diagnosis,
    confidence:       scenario.confidence,
    urgency:          scenario.urgency,
    laborOperations:  scenario.laborOperations,
    totalLaborHours:  scenario.totalLaborHours,
    partsRecommended: scenario.partsRecommended,
    additionalChecks: scenario.additionalChecks,
    safetyWarning:    scenario.safetyWarning,
    aiNotes:          scenario.aiNotes,
    // Cost totals
    laborRateUsed:  laborRate,
    laborTotal,
    partsTotal,
    subtotal,
    vatAmount,
    totalEstimate,
    // Metadata
    modelUsed:    'mock-v1',
    inputTokens:  0,
    outputTokens: 0,
    rawResponse:  { mock: true },
  }
}
