/**
 * Auto quote generation engine.
 * Produces a draft Quote from a service type + vehicle info.
 *
 * All prices are ILS before VAT unless stated otherwise.
 * Labor rate: 295 ILS/hr   |   VAT: 17%
 */

import type { QuoteRequestServiceType } from '@prisma/client'

// ─── Constants ────────────────────────────────────────────────────────────────

export const LABOR_RATE_ILS = 295
export const VAT_RATE       = 0.17   // 17%

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AutoPart {
  description: string
  quantity:    number
  unitPrice:   number   // ILS before VAT
  total:       number   // quantity × unitPrice
}

export interface AutoQuoteResult {
  titleHe:     string
  laborHours:  number
  laborRate:   number
  parts:       AutoPart[]
  laborTotal:  number   // laborHours × laborRate
  partsTotal:  number   // sum of parts
  subtotal:    number   // laborTotal + partsTotal
  vat:         number   // subtotal × VAT_RATE
  total:       number   // subtotal + vat
  notes:       string
}

// ─── Service templates ────────────────────────────────────────────────────────

interface Template {
  nameHe:     string
  laborHours: number
  parts:      Omit<AutoPart, 'total'>[]
  notes:      string
}

const TEMPLATES: Record<QuoteRequestServiceType, Template> = {
  PERIODIC_SERVICE: {
    nameHe:     'טיפול תקופתי',
    laborHours: 2.0,
    parts: [
      { description: 'שמן מנוע (5 ליטר)', quantity: 1, unitPrice: 180 },
      { description: 'פילטר שמן',           quantity: 1, unitPrice:  45 },
      { description: 'פילטר אוויר',          quantity: 1, unitPrice:  65 },
    ],
    notes: 'כולל החלפת שמן ופילטרים. ייתכנו חלקים נוספים לאחר בדיקה.',
  },

  BRAKES: {
    nameHe:     'בלמים',
    laborHours: 2.5,
    parts: [
      { description: 'רפידות בלם קדמיות',  quantity: 1, unitPrice: 280 },
      { description: 'רפידות בלם אחוריות', quantity: 1, unitPrice: 240 },
    ],
    notes: 'הצעה ראשונית לרפידות. דיסקים ייכללו אם ידרש לאחר הבדיקה.',
  },

  BATTERY: {
    nameHe:     'מצבר',
    laborHours: 0.5,
    parts: [
      { description: 'מצבר 60Ah', quantity: 1, unitPrice: 480 },
    ],
    notes: 'מחיר המצבר עשוי להשתנות בהתאם לדרישת הרכב הספציפי.',
  },

  TIRES: {
    nameHe:     'צמיגים',
    laborHours: 1.0,
    parts: [
      { description: 'התקנה ואיזון (4 צמיגים)', quantity: 1, unitPrice: 200 },
    ],
    notes: 'מחיר הצמיגים עצמם אינו כלול — תלוי בסוג ובחירת הלקוח.',
  },

  AC: {
    nameHe:     'מזגן',
    laborHours: 1.5,
    parts: [
      { description: 'טעינת גז מזגן R134a', quantity: 1, unitPrice: 120 },
      { description: 'פילטר מזגן (מבית)',    quantity: 1, unitPrice:  80 },
    ],
    notes: 'אם נדרש תיקון נוסף, יימסר לאחר האבחון. ייתכנו עלויות נוספות.',
  },

  CHECK_ENGINE: {
    nameHe:     'נורת מנוע / שגיאה',
    laborHours: 1.0,
    parts: [],
    notes: 'אבחון ממוחשב וזיהוי קודי שגיאה. עלות תיקון תיקבע לאחר האבחון.',
  },

  DIAGNOSTICS: {
    nameHe:     'אבחון מקיף',
    laborHours: 1.5,
    parts: [],
    notes: 'אבחון מלא של כל מערכות הרכב. עלות תיקון תיקבע לאחר האבחון.',
  },

  OTHER: {
    nameHe:     'טיפול כללי',
    laborHours: 1.0,
    parts: [],
    notes: 'הצעה ראשונית כפוף לבדיקת הרכב. הפירוט יעודכן לאחר האבחון.',
  },
}

// ─── Generator ────────────────────────────────────────────────────────────────

export function generateAutoQuote(
  serviceType:  QuoteRequestServiceType,
  _vehicle?:    { make?: string; model?: string; year?: number },
): AutoQuoteResult {
  const tpl = TEMPLATES[serviceType]
  const lr  = LABOR_RATE_ILS

  const parts: AutoPart[] = tpl.parts.map(p => ({
    ...p,
    total: Math.round(p.unitPrice * p.quantity * 100) / 100,
  }))

  const laborTotal = tpl.laborHours * lr
  const partsTotal = parts.reduce((s, p) => s + p.total, 0)
  const subtotal   = laborTotal + partsTotal
  const vat        = Math.round(subtotal * VAT_RATE * 100) / 100
  const total      = Math.round((subtotal + vat) * 100) / 100

  return {
    titleHe:    tpl.nameHe,
    laborHours: tpl.laborHours,
    laborRate:  lr,
    parts,
    laborTotal,
    partsTotal,
    subtotal,
    vat,
    total,
    notes:      tpl.notes,
  }
}

// ─── Hebrew labels ────────────────────────────────────────────────────────────

export const SERVICE_TYPE_LABELS: Record<QuoteRequestServiceType, string> = {
  PERIODIC_SERVICE: 'טיפול תקופתי',
  BRAKES:           'בלמים',
  BATTERY:          'מצבר',
  TIRES:            'צמיגים',
  AC:               'מזגן',
  CHECK_ENGINE:     'נורת מנוע',
  DIAGNOSTICS:      'אבחון מקיף',
  OTHER:            'אחר',
}

export const SERVICE_TYPE_ICONS: Record<QuoteRequestServiceType, string> = {
  PERIODIC_SERVICE: '🔧',
  BRAKES:           '🛑',
  BATTERY:          '🔋',
  TIRES:            '🔄',
  AC:               '❄️',
  CHECK_ENGINE:     '⚠️',
  DIAGNOSTICS:      '🔍',
  OTHER:            '🛠️',
}

export const URGENCY_LABELS: Record<string, string> = {
  LOW:    'נמוכה',
  NORMAL: 'רגילה',
  HIGH:   'דחופה',
}

export const URGENCY_COLORS: Record<string, string> = {
  LOW:    'bg-slate-100 text-slate-600 border-slate-200',
  NORMAL: 'bg-amber-50  text-amber-700  border-amber-200',
  HIGH:   'bg-red-50    text-red-700    border-red-200',
}
