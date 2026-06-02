'use client'

/**
 * PeriodicServicePanel
 *
 * Replaces the generic AI analysis panel for PERIODIC_SERVICE quote requests.
 *
 * Flow:
 *  1. INPUT  — plate (read-only), mileage input, missing fields (fuel/trans)
 *  2. LOADING — calls /api/periodic-quote
 *  3. RESULT  — structured maintenance quote with items, totals, disclaimer
 *
 * The engine is 100% rule-based. AI does NOT override schedule items.
 */

import { useState }        from 'react'
import { formatCurrency }  from '@/lib/utils'
import {
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  LABOR_RATE_ILS,
  VAT_RATE,
} from '@/lib/maintenance-schedule'
import type { ScheduleResult, ServiceItem } from '@/lib/maintenance-schedule'
import type { QuoteItemEdit }               from '@/app/actions/quote-request'
import {
  Wrench,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Info,
  RotateCcw,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Vehicle {
  plate:         string
  make:          string
  model:         string
  year:          number
  engine?:       string | null
  fuelType?:     string | null
  transmission?: string | null
  mileage?:      number | null
}

interface PeriodicQuoteResponse {
  schedule:         ScheduleResult
  usedFuelType:     string | null
  usedTransmission: string | null
  missingFields:    Array<'fuelType' | 'transmission'>
}

export interface PeriodicServicePanelProps {
  vehicle:     Vehicle
  workOrderId: string
  canEdit:     boolean
  onConfirm:   (items: QuoteItemEdit[], notes: string, laborHours: number) => void
}

type PanelState =
  | { phase: 'input' }
  | { phase: 'loading' }
  | { phase: 'result'; data: PeriodicQuoteResponse }
  | { phase: 'error'; message: string }

// ─── Hebrew label maps ────────────────────────────────────────────────────────

const FUEL_LABELS: Record<string, string> = {
  GASOLINE: 'בנזין',
  DIESEL:   'דיזל',
  HYBRID:   'היברידי',
  ELECTRIC: 'חשמלי',
  LPG:      'גז',
}

const TRANS_LABELS: Record<string, string> = {
  MANUAL:    'ידני',
  AUTOMATIC: 'אוטומט',
  CVT:       'CVT',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PeriodicServicePanel({
  vehicle,
  workOrderId,
  canEdit,
  onConfirm,
}: PeriodicServicePanelProps) {
  // ── Form state ──────────────────────────────────────────────────────────────
  const [mileage,     setMileage]      = useState(vehicle.mileage ? String(vehicle.mileage) : '')
  const [fuelType,    setFuelType]     = useState(vehicle.fuelType     ?? '')
  const [transmission, setTransmission] = useState(vehicle.transmission ?? '')

  // ── Panel state ─────────────────────────────────────────────────────────────
  const [state,       setState]        = useState<PanelState>({ phase: 'input' })
  const [optExpanded, setOptExpanded]  = useState<Record<number, boolean>>({})
  const [confirmed,   setConfirmed]    = useState(false)

  // ── Field visibility ────────────────────────────────────────────────────────
  const needsFuel  = !vehicle.fuelType
  const needsTrans = !vehicle.transmission

  // ── Generate quote ──────────────────────────────────────────────────────────
  async function generate() {
    const km = parseInt(mileage, 10)
    if (!km || km < 0) return

    setState({ phase: 'loading' })

    try {
      const res = await fetch('/api/periodic-quote', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehiclePlate:        vehicle.plate,
          vehicleMake:         vehicle.make,
          vehicleModel:        vehicle.model,
          vehicleYear:         vehicle.year,
          vehicleMileage:      km,
          vehicleFuelType:     fuelType     || undefined,
          vehicleTransmission: transmission || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setState({ phase: 'error', message: json.message ?? 'שגיאה בטעינת לוח הטיפולים' })
        return
      }
      setState({ phase: 'result', data: json as PeriodicQuoteResponse })
    } catch {
      setState({ phase: 'error', message: 'שגיאת רשת — נסה שוב' })
    }
  }

  // ── Fill quote form ─────────────────────────────────────────────────────────
  function handleConfirm() {
    if (state.phase !== 'result') return
    const { schedule } = state.data

    const items: QuoteItemEdit[] = schedule.items
      .filter(i => i.required && i.category !== 'INSPECTION')
      .map(i => ({
        description: i.nameHe + (i.notes ? ` — ${i.notes}` : ''),
        quantity:    i.quantity,
        unitPrice:   i.unitPrice,
        total:       Math.round(i.quantity * i.unitPrice * 100) / 100,
      }))

    const optItems = schedule.items.filter(i => !i.required && i.category !== 'INSPECTION')

    const noteLines: string[] = [
      `${schedule.intervalLabel} — ${vehicle.make} ${vehicle.model} ${vehicle.year}`,
      '',
      'פירוט עבודה:',
      ...schedule.items
        .filter(i => i.required)
        .map(i => `• ${i.nameHe} — ${i.laborHours} שע׳`),
    ]

    if (optItems.length > 0) {
      noteLines.push('', 'פריטים אופציונליים (לא נכללו במחיר):')
      optItems.forEach(i => noteLines.push(`• ${i.nameHe}${i.notes ? ` — ${i.notes}` : ''}`))
    }

    noteLines.push(
      '',
      '⚠️ הצעה אוטומטית לפי נתוני רכב וק״מ — כפוף לאימות לפי קוד מנוע והוראות יצרן.',
    )

    if (schedule.scheduleNotes) {
      noteLines.push('', `הערות: ${schedule.scheduleNotes}`)
    }

    onConfirm(items, noteLines.join('\n'), schedule.requiredLaborHours)
    setConfirmed(true)
  }

  function reset() {
    setState({ phase: 'input' })
    setConfirmed(false)
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="bg-[#0f1117] border border-[#252836] rounded-2xl overflow-hidden">

      {/* ── Panel header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e2230]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <Wrench size={13} className="text-emerald-400" />
          </div>
          <span className="text-sm font-bold text-[#e2e8f0]">הצעה אוטומטית — טיפול תקופתי</span>
          {state.phase === 'result' && (
            <span className="flex items-center gap-1 text-[10px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full font-bold border border-emerald-500/20">
              <CheckCircle2 size={9} />
              {state.data.schedule.isGeneric ? 'כללי' : 'ספציפי לרכב'}
            </span>
          )}
        </div>
        {state.phase === 'result' && (
          <button
            onClick={reset}
            className="flex items-center gap-1 text-xs text-[#4a5270] hover:text-[#8892a4] transition-colors"
          >
            <RotateCcw size={12} />
            עדכן ק״מ
          </button>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          PHASE 1: INPUT
      ════════════════════════════════════════════════════════════════════════ */}
      {state.phase === 'input' && (
        <div className="px-5 py-5 space-y-5">

          {/* Vehicle card */}
          <div className="bg-[#1a1d27] border border-[#252836] rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 bg-[#252836] rounded-lg flex items-center justify-center text-base">
              🚗
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#e2e8f0]">
                {vehicle.make} {vehicle.model} {vehicle.year}
              </p>
              <p className="text-xs text-[#4a5270] font-mono mt-0.5">{vehicle.plate}</p>
            </div>
            {vehicle.fuelType && (
              <span className="text-[10px] font-bold text-[#8892a4] border border-[#2e3147] px-2 py-0.5 rounded-md shrink-0">
                {FUEL_LABELS[vehicle.fuelType] ?? vehicle.fuelType}
              </span>
            )}
          </div>

          {/* Mileage */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-bold text-[#8892a4] uppercase tracking-widest">
              <Gauge size={11} />
              ק״מ נוכחי
            </label>
            <div className="relative">
              <input
                type="number"
                min={0}
                step={1000}
                value={mileage}
                onChange={e => setMileage(e.target.value)}
                placeholder="לדוגמה: 60000"
                className="w-full bg-[#1a1d27] border border-[#2e3147] text-[#e2e8f0] rounded-xl px-4 py-3 text-sm font-mono outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/15 transition-all placeholder:text-[#2e3147]"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-[#4a5270]">ק״מ</span>
            </div>
          </div>

          {/* Missing: fuel type */}
          {needsFuel && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                <AlertTriangle size={11} />
                סוג דלק — לא ידוע ברכב
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['GASOLINE', 'DIESEL', 'HYBRID', 'ELECTRIC'] as const).map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFuelType(f)}
                    className={`py-2.5 rounded-xl text-sm font-bold border transition-all ${
                      fuelType === f
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                        : 'bg-[#1a1d27] border-[#2e3147] text-[#8892a4] hover:border-[#4a5270]'
                    }`}
                  >
                    {FUEL_LABELS[f]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Missing: transmission (optional — improves matching) */}
          {needsTrans && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#4a5270] uppercase tracking-widest flex items-center gap-1.5">
                <Info size={11} />
                תיבת הילוכים (אופציונלי)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['AUTOMATIC', 'MANUAL', 'CVT'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTransmission(prev => prev === t ? '' : t)}
                    className={`py-2.5 rounded-xl text-sm font-bold border transition-all ${
                      transmission === t
                        ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                        : 'bg-[#1a1d27] border-[#2e3147] text-[#8892a4] hover:border-[#4a5270]'
                    }`}
                  >
                    {TRANS_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <button
            onClick={generate}
            disabled={!mileage || parseInt(mileage, 10) <= 0 || (needsFuel && !fuelType)}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm py-3.5 rounded-xl transition-colors"
          >
            <Wrench size={14} />
            צור הצעת מחיר לטיפול תקופתי
          </button>

          {needsFuel && !fuelType && (
            <p className="text-center text-xs text-amber-500/80">
              בחר סוג דלק כדי להמשיך
            </p>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          PHASE 2: LOADING
      ════════════════════════════════════════════════════════════════════════ */}
      {state.phase === 'loading' && (
        <div className="px-5 py-10 flex flex-col items-center gap-3">
          <Loader2 size={22} className="text-emerald-400 animate-spin" />
          <p className="text-sm text-[#8892a4]">מאתר לוח טיפולים מתאים לרכב...</p>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          PHASE 3: ERROR
      ════════════════════════════════════════════════════════════════════════ */}
      {state.phase === 'error' && (
        <div className="px-5 py-5 space-y-4">
          <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3">
            <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{state.message}</p>
          </div>
          <button
            onClick={reset}
            className="w-full text-sm text-[#4a5270] hover:text-[#8892a4] transition-colors py-2"
          >
            ← חזרה
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          PHASE 4: RESULT
      ════════════════════════════════════════════════════════════════════════ */}
      {state.phase === 'result' && (() => {
        const { schedule, usedFuelType, usedTransmission } = state.data
        const km = parseInt(mileage, 10)

        return (
          <div className="px-5 pt-4 pb-5 space-y-5">

            {/* ── Service badge ───────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🔧</span>
                <div>
                  <p className="text-base font-black text-[#e2e8f0]">{schedule.intervalLabel}</p>
                  <p className="text-xs text-[#4a5270] mt-0.5">
                    ק״מ נוכחי: {km.toLocaleString('he-IL')}
                    {usedFuelType && ` · ${FUEL_LABELS[usedFuelType] ?? usedFuelType}`}
                    {usedTransmission && ` · ${TRANS_LABELS[usedTransmission] ?? usedTransmission}`}
                  </p>
                </div>
              </div>

              {/* Generic warning badge */}
              {schedule.isGeneric && (
                <span className="text-[10px] font-bold text-amber-400 border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 rounded-full shrink-0">
                  לוח כללי
                </span>
              )}
            </div>

            {/* Match note (if partial match) */}
            {schedule.matchNote && (
              <div className="flex items-start gap-2 bg-amber-500/8 border border-amber-500/20 rounded-xl px-3.5 py-2.5">
                <Info size={13} className="text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300">{schedule.matchNote}</p>
              </div>
            )}

            {/* ── Items table ─────────────────────────────────────────────── */}
            <div>
              <p className="text-[10px] font-bold text-[#4a5270] uppercase tracking-[0.12em] mb-2.5">
                פריטי הטיפול
              </p>
              <div className="space-y-1.5">
                {schedule.items.map((item, idx) => (
                  <ItemRow
                    key={idx}
                    item={item}
                    laborRate={LABOR_RATE_ILS}
                    expanded={!!optExpanded[idx]}
                    onToggle={() => setOptExpanded(p => ({ ...p, [idx]: !p[idx] }))}
                  />
                ))}
              </div>
            </div>

            {/* ── Labor summary ────────────────────────────────────────────── */}
            <div className="bg-[#1a1d27] border border-[#252836] rounded-xl px-4 py-3 space-y-1.5">
              <p className="text-[10px] font-bold text-[#4a5270] uppercase tracking-[0.12em] mb-2">
                סיכום עלויות
              </p>

              <div className="flex justify-between text-xs text-[#8892a4]">
                <span>עבודה ({schedule.requiredLaborHours} שע׳ × ₪{LABOR_RATE_ILS})</span>
                <span className="font-mono">{formatCurrency(schedule.laborTotal)}</span>
              </div>
              <div className="flex justify-between text-xs text-[#8892a4]">
                <span>חלקים</span>
                <span className="font-mono">{formatCurrency(schedule.partsTotal)}</span>
              </div>
              <div className="flex justify-between text-xs text-[#8892a4] border-t border-[#252836] pt-1.5 mt-1.5">
                <span>לפני מע״מ</span>
                <span className="font-mono">{formatCurrency(schedule.subtotal)}</span>
              </div>
              <div className="flex justify-between text-xs text-[#8892a4]">
                <span>מע״מ 17%</span>
                <span className="font-mono">{formatCurrency(schedule.vat)}</span>
              </div>
              <div className="flex justify-between font-black text-sm text-emerald-400 border-t border-[#252836] pt-2 mt-1">
                <span>סה״כ כולל מע״מ</span>
                <span className="font-mono">{formatCurrency(schedule.total)}</span>
              </div>
            </div>

            {/* ── Schedule notes ───────────────────────────────────────────── */}
            {schedule.scheduleNotes && (
              <div className="bg-[#1a1d27] border border-[#252836] rounded-xl px-4 py-3">
                <p className="text-[10px] font-bold text-[#4a5270] uppercase tracking-[0.12em] mb-1.5">
                  הערות יצרן / טכנאי
                </p>
                <p className="text-xs text-[#8892a4] leading-relaxed">{schedule.scheduleNotes}</p>
              </div>
            )}

            {/* ── Disclaimer ──────────────────────────────────────────────── */}
            <div className="bg-amber-500/8 border border-amber-500/25 rounded-xl px-4 py-3 flex items-start gap-2.5">
              <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300/90 leading-relaxed">
                <strong className="text-amber-300">הצעה אוטומטית לפי נתוני רכב וק״מ</strong>{' '}
                — כפוף לאימות לפי קוד מנוע והוראות יצרן. יש לאשר לפני שליחה ללקוח.
              </p>
            </div>

            {/* ── CTA ─────────────────────────────────────────────────────── */}
            {canEdit && (
              <div className="pt-1">
                {!confirmed ? (
                  <button
                    onClick={handleConfirm}
                    className="w-full flex items-center justify-center gap-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base py-4 rounded-xl transition-colors active:scale-[0.98] shadow-lg shadow-emerald-900/30"
                  >
                    <CheckCircle2 size={16} />
                    מלא טופס הצעת מחיר עם פריטים אלה
                  </button>
                ) : (
                  <div className="text-center space-y-1">
                    <p className="text-sm text-emerald-400 font-bold">✓ טופס ההצעה מולא — ערוך לפי הצורך</p>
                    <button
                      onClick={handleConfirm}
                      className="text-xs text-[#4a5270] hover:text-[#8892a4] transition-colors"
                    >
                      ↺ מלא מחדש
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>
        )
      })()}

    </div>
  )
}

// ─── ItemRow sub-component ────────────────────────────────────────────────────

function ItemRow({
  item,
  laborRate,
  expanded,
  onToggle,
}: {
  item:      ServiceItem
  laborRate: number
  expanded:  boolean
  onToggle:  () => void
}) {
  const icon  = CATEGORY_ICONS[item.category]  ?? '🔧'
  const label = CATEGORY_LABELS[item.category] ?? item.category
  const isInspection = item.category === 'INSPECTION'

  return (
    <div
      className={`rounded-xl border transition-colors ${
        item.required
          ? 'bg-[#1a1d27] border-[#252836]'
          : 'bg-[#141720] border-dashed border-[#252836]'
      }`}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className="text-base shrink-0 w-6 text-center">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className={`text-sm truncate ${item.required ? 'text-[#c5cde2]' : 'text-[#4a5270]'}`}>
              {item.nameHe}
            </p>
            {!item.required && (
              <span className="text-[9px] font-bold text-amber-500/70 border border-amber-500/25 px-1.5 py-0.5 rounded-md shrink-0">
                אופציונלי
              </span>
            )}
          </div>
          {isInspection && item.laborHours > 0 && (
            <p className="text-[10px] text-[#4a5270] mt-0.5">
              כולל {item.laborHours} שע׳ בדיקה
            </p>
          )}
        </div>

        {/* Price + hours */}
        <div className="flex items-center gap-2 shrink-0">
          {item.laborHours > 0 && !isInspection && (
            <span className="text-[10px] text-indigo-400 font-mono bg-indigo-500/10 px-1.5 py-0.5 rounded-md">
              {item.laborHours}שע׳
            </span>
          )}
          {!isInspection && (
            <span className={`text-xs font-mono font-bold ${item.required ? 'text-[#8892a4]' : 'text-[#4a5270]'}`}>
              {item.unitPrice > 0 ? `₪${(item.unitPrice * item.quantity).toLocaleString('he-IL')}` : '—'}
            </span>
          )}
        </div>

        {/* Toggle for notes */}
        {item.notes && (
          <button
            onClick={onToggle}
            className="text-[#2e3147] hover:text-[#4a5270] transition-colors shrink-0"
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}
      </div>

      {/* Notes drawer */}
      {item.notes && expanded && (
        <div className="px-3 pb-3 pt-0 border-t border-[#1e2230]">
          <p className="text-xs text-[#4a5270] leading-relaxed mt-2">{item.notes}</p>
        </div>
      )}
    </div>
  )
}
