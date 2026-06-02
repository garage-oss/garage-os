'use client'

/**
 * PeriodicServicePanel
 *
 * Replaces the generic AI analysis panel for PERIODIC_SERVICE quote requests.
 *
 * Flow:
 *  1. INPUT   — plate (read-only), mileage input, optional fuel/trans selectors
 *  2. LOADING — calls /api/periodic-quote
 *  3. RESULT  — three-section service advisor layout:
 *               ✅ REQUIRED     — manufacturer mandated, always included
 *               💡 RECOMMENDED  — advisor upsell, one-click add, revenue counter
 *               ⚠️  SAFETY       — safety-critical findings, red-badge items
 *
 * The engine is 100% rule-based. AI does NOT generate or override schedule items.
 */

import { useState }        from 'react'
import { formatCurrency }  from '@/lib/utils'
import {
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  LABOR_RATE_ILS,
  VAT_RATE,
  groupByPriority,
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
  Plus,
  X,
  ShieldAlert,
  TrendingUp,
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

// ─── Local helpers ────────────────────────────────────────────────────────────

function r2(n: number) { return Math.round(n * 100) / 100 }

function itemCost(item: ServiceItem): number {
  return r2(item.unitPrice * item.quantity + item.laborHours * LABOR_RATE_ILS)
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PeriodicServicePanel({
  vehicle,
  workOrderId,
  canEdit,
  onConfirm,
}: PeriodicServicePanelProps) {
  // ── Form state ──────────────────────────────────────────────────────────────
  const [mileage,      setMileage]      = useState(vehicle.mileage ? String(vehicle.mileage) : '')
  const [fuelType,     setFuelType]     = useState(vehicle.fuelType     ?? '')
  const [transmission, setTransmission] = useState(vehicle.transmission ?? '')

  // ── Panel state ─────────────────────────────────────────────────────────────
  const [state,         setState]        = useState<PanelState>({ phase: 'input' })
  const [confirmed,     setConfirmed]    = useState(false)
  const [selectedRec,   setSelectedRec]  = useState<Set<number>>(new Set())
  const [selectedSafe,  setSelectedSafe] = useState<Set<number>>(new Set())
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({})

  // ── Field visibility ────────────────────────────────────────────────────────
  const needsFuel  = !vehicle.fuelType
  const needsTrans = !vehicle.transmission

  // ── Toggle helpers ──────────────────────────────────────────────────────────
  function toggleRec(idx: number) {
    setSelectedRec(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  function toggleSafe(idx: number) {
    setSelectedSafe(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  function toggleNote(key: string) {
    setExpandedNotes(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // ── Generate quote ──────────────────────────────────────────────────────────
  async function generate() {
    const km = parseInt(mileage, 10)
    if (!km || km < 0) return

    setState({ phase: 'loading' })
    setSelectedRec(new Set())
    setSelectedSafe(new Set())
    setExpandedNotes({})

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
    const groups = groupByPriority(schedule.items)

    const selRecItems  = groups.recommended.filter((_, idx) => selectedRec.has(idx))
    const selSafeItems = groups.safety.filter((_, idx) => selectedSafe.has(idx))

    // All items that are being included (required always, selected optional)
    const allIncluded = [...groups.required, ...selRecItems, ...selSafeItems]

    // Line items exclude INSPECTION (labor-only service)
    const partItems = allIncluded.filter(i => i.category !== 'INSPECTION')

    const items: QuoteItemEdit[] = partItems.map(i => ({
      description: i.nameHe + (i.notes ? ` — ${i.notes}` : ''),
      quantity:    i.quantity,
      unitPrice:   i.unitPrice,
      total:       r2(i.quantity * i.unitPrice),
    }))

    // Total labor including inspection hours
    const totalLaborHours = r2(allIncluded.reduce((s, i) => s + i.laborHours, 0))

    // Build work notes
    const km = parseInt(mileage, 10)
    const noteLines: string[] = [
      `${schedule.intervalLabel} — ${vehicle.make} ${vehicle.model} ${vehicle.year}`,
      `ק״מ נוכחי: ${km.toLocaleString('he-IL')}`,
      '',
      'פריטים נדרשים (לפי יצרן):',
      ...groups.required.map(i => `• ${i.nameHe} — ${i.laborHours} שע׳`),
    ]

    if (selRecItems.length > 0) {
      noteLines.push('', 'פריטים מומלצים שנוספו:')
      selRecItems.forEach(i => noteLines.push(`• ${i.nameHe}${i.notes ? ` — ${i.notes}` : ''}`))
    }

    if (selSafeItems.length > 0) {
      noteLines.push('', 'התראות בטיחות שנבחרו:')
      selSafeItems.forEach(i => noteLines.push(`• ${i.nameHe}${i.notes ? ` — ${i.notes}` : ''}`))
    }

    noteLines.push(
      '',
      '⚠️ הצעה אוטומטית לפי נתוני רכב וק״מ — כפוף לאימות לפי קוד מנוע והוראות יצרן.',
    )

    if (schedule.scheduleNotes) {
      noteLines.push('', `הערות: ${schedule.scheduleNotes}`)
    }

    onConfirm(items, noteLines.join('\n'), totalLaborHours)
    setConfirmed(true)
  }

  function reset() {
    setState({ phase: 'input' })
    setConfirmed(false)
    setSelectedRec(new Set())
    setSelectedSafe(new Set())
    setExpandedNotes({})
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
          PHASE 4: RESULT — THREE-SECTION SERVICE ADVISOR LAYOUT
      ════════════════════════════════════════════════════════════════════════ */}
      {state.phase === 'result' && (() => {
        const { schedule, usedFuelType, usedTransmission } = state.data
        const km     = parseInt(mileage, 10)
        const groups = groupByPriority(schedule.items)

        // Compute additional cost for selected optional items
        const selRecItems  = groups.recommended.filter((_, idx) => selectedRec.has(idx))
        const selSafeItems = groups.safety.filter((_, idx) => selectedSafe.has(idx))
        const allSelected  = [...selRecItems, ...selSafeItems]

        const additionalParts     = r2(allSelected.reduce((s, i) => s + i.unitPrice * i.quantity, 0))
        const additionalLaborCost = r2(allSelected.reduce((s, i) => s + i.laborHours * LABOR_RATE_ILS, 0))
        const additionalSubtotal  = r2(additionalParts + additionalLaborCost)
        const additionalVat       = r2(additionalSubtotal * VAT_RATE)
        const additionalTotal     = r2(additionalSubtotal + additionalVat)

        const grandSubtotal = r2(schedule.subtotal + additionalSubtotal)
        const grandVat      = r2(grandSubtotal * VAT_RATE)
        const grandTotal    = r2(grandSubtotal + grandVat)

        return (
          <div className="px-5 pt-4 pb-5 space-y-5">

            {/* ── Service badge ──────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🔧</span>
                <div>
                  <p className="text-base font-black text-[#e2e8f0]">{schedule.intervalLabel}</p>
                  <p className="text-xs text-[#4a5270] mt-0.5">
                    ק״מ נוכחי: {km.toLocaleString('he-IL')}
                    {usedFuelType     && ` · ${FUEL_LABELS[usedFuelType]  ?? usedFuelType}`}
                    {usedTransmission && ` · ${TRANS_LABELS[usedTransmission] ?? usedTransmission}`}
                  </p>
                </div>
              </div>
              {schedule.isGeneric && (
                <span className="text-[10px] font-bold text-amber-400 border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 rounded-full shrink-0">
                  לוח כללי
                </span>
              )}
            </div>

            {/* Match note */}
            {schedule.matchNote && (
              <div className="flex items-start gap-2 bg-amber-500/8 border border-amber-500/20 rounded-xl px-3.5 py-2.5">
                <Info size={13} className="text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300">{schedule.matchNote}</p>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                SECTION 1 — REQUIRED (manufacturer mandated)
            ══════════════════════════════════════════════════════════════ */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.12em] flex items-center gap-1.5">
                  <CheckCircle2 size={11} />
                  נדרש על ידי יצרן
                </p>
                <span className="text-[10px] text-[#4a5270] font-mono">
                  בסיס: {formatCurrency(schedule.total)}
                </span>
              </div>

              <div className="space-y-1.5">
                {groups.required.map((item, idx) => (
                  <RequiredItemRow
                    key={idx}
                    item={item}
                    noteKey={`req-${idx}`}
                    expanded={!!expandedNotes[`req-${idx}`]}
                    onToggleNote={() => toggleNote(`req-${idx}`)}
                  />
                ))}
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                SECTION 2 — RECOMMENDED (advisor upsell)
            ══════════════════════════════════════════════════════════════ */}
            {groups.recommended.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.12em] flex items-center gap-1.5">
                    💡 מומלץ על ידי יועץ השירות
                  </p>
                  {selectedRec.size > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      <TrendingUp size={9} />
                      +{formatCurrency(r2([...selRecItems].reduce((s, i) => s + itemCost(i) * (1 + VAT_RATE), 0)))}
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  {groups.recommended.map((item, idx) => {
                    const isSelected = selectedRec.has(idx)
                    return (
                      <RecommendedItemRow
                        key={idx}
                        item={item}
                        selected={isSelected}
                        noteKey={`rec-${idx}`}
                        expanded={!!expandedNotes[`rec-${idx}`]}
                        onToggle={() => toggleRec(idx)}
                        onToggleNote={() => toggleNote(`rec-${idx}`)}
                      />
                    )
                  })}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                SECTION 3 — SAFETY (red-badge items)
            ══════════════════════════════════════════════════════════════ */}
            {groups.safety.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-[0.12em] flex items-center gap-1.5">
                    <ShieldAlert size={11} />
                    התראות בטיחות
                  </p>
                  {selectedSafe.size > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      <TrendingUp size={9} />
                      +{formatCurrency(r2([...selSafeItems].reduce((s, i) => s + itemCost(i) * (1 + VAT_RATE), 0)))}
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  {groups.safety.map((item, idx) => {
                    const isSelected = selectedSafe.has(idx)
                    return (
                      <SafetyItemRow
                        key={idx}
                        item={item}
                        selected={isSelected}
                        noteKey={`safe-${idx}`}
                        expanded={!!expandedNotes[`safe-${idx}`]}
                        onToggle={() => toggleSafe(idx)}
                        onToggleNote={() => toggleNote(`safe-${idx}`)}
                      />
                    )
                  })}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                FINANCIAL SUMMARY
            ══════════════════════════════════════════════════════════════ */}
            <div className="bg-[#1a1d27] border border-[#252836] rounded-xl px-4 py-3 space-y-1.5">
              <p className="text-[10px] font-bold text-[#4a5270] uppercase tracking-[0.12em] mb-2">
                סיכום עלויות
              </p>

              <div className="flex justify-between text-xs text-[#8892a4]">
                <span>עבודה ({schedule.requiredLaborHours} שע׳ × ₪{LABOR_RATE_ILS})</span>
                <span className="font-mono">{formatCurrency(schedule.laborTotal)}</span>
              </div>
              <div className="flex justify-between text-xs text-[#8892a4]">
                <span>חלקים (נדרשים)</span>
                <span className="font-mono">{formatCurrency(schedule.partsTotal)}</span>
              </div>

              {additionalSubtotal > 0 && (
                <>
                  <div className="border-t border-[#252836] mt-1.5 pt-1.5" />
                  <div className="flex justify-between text-xs text-emerald-400">
                    <span className="flex items-center gap-1">
                      <TrendingUp size={10} />
                      תוספות שנבחרו ({allSelected.length} פריטים)
                    </span>
                    <span className="font-mono font-bold">+{formatCurrency(additionalSubtotal)}</span>
                  </div>
                </>
              )}

              <div className="flex justify-between text-xs text-[#8892a4] border-t border-[#252836] pt-1.5 mt-1.5">
                <span>לפני מע״מ</span>
                <span className="font-mono">{formatCurrency(grandSubtotal)}</span>
              </div>
              <div className="flex justify-between text-xs text-[#8892a4]">
                <span>מע״מ 17%</span>
                <span className="font-mono">{formatCurrency(grandVat)}</span>
              </div>
              <div className="flex justify-between font-black text-sm text-emerald-400 border-t border-[#252836] pt-2 mt-1">
                <span>סה״כ כולל מע״מ</span>
                <span className="font-mono">{formatCurrency(grandTotal)}</span>
              </div>

              {additionalTotal > 0 && (
                <div className="flex justify-between text-[10px] text-emerald-500/70 pt-0.5">
                  <span>מתוכם הכנסה נוספת</span>
                  <span className="font-mono">+{formatCurrency(additionalTotal)}</span>
                </div>
              )}
            </div>

            {/* ── Schedule notes ─────────────────────────────────────────── */}
            {schedule.scheduleNotes && (
              <div className="bg-[#1a1d27] border border-[#252836] rounded-xl px-4 py-3">
                <p className="text-[10px] font-bold text-[#4a5270] uppercase tracking-[0.12em] mb-1.5">
                  הערות יצרן / טכנאי
                </p>
                <p className="text-xs text-[#8892a4] leading-relaxed">{schedule.scheduleNotes}</p>
              </div>
            )}

            {/* ── Disclaimer ─────────────────────────────────────────────── */}
            <div className="bg-amber-500/8 border border-amber-500/25 rounded-xl px-4 py-3 flex items-start gap-2.5">
              <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300/90 leading-relaxed">
                <strong className="text-amber-300">הצעה אוטומטית לפי נתוני רכב וק״מ</strong>{' '}
                — כפוף לאימות לפי קוד מנוע והוראות יצרן. יש לאשר לפני שליחה ללקוח.
              </p>
            </div>

            {/* ── CTA ────────────────────────────────────────────────────── */}
            {canEdit && (
              <div className="pt-1">
                {!confirmed ? (
                  <button
                    onClick={handleConfirm}
                    className="w-full flex items-center justify-center gap-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base py-4 rounded-xl transition-colors active:scale-[0.98] shadow-lg shadow-emerald-900/30"
                  >
                    <CheckCircle2 size={16} />
                    מלא טופס הצעת מחיר עם פריטים אלה
                    {allSelected.length > 0 && (
                      <span className="text-emerald-200 font-normal text-sm">
                        ({groups.required.length + allSelected.length} פריטים)
                      </span>
                    )}
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

// ─── Section-specific item row components ─────────────────────────────────────

/** Required item — always selected, green checkmark */
function RequiredItemRow({
  item, noteKey, expanded, onToggleNote,
}: {
  item: ServiceItem; noteKey: string; expanded: boolean; onToggleNote: () => void
}) {
  const icon  = CATEGORY_ICONS[item.category]  ?? '🔧'
  const isInspection = item.category === 'INSPECTION'

  return (
    <div className="bg-[#1a1d27] border border-[#252836] rounded-xl">
      <div className="flex items-center gap-3 px-3 py-2.5">
        {/* Check indicator */}
        <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
        <span className="text-base shrink-0 w-5 text-center">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[#c5cde2] truncate">{item.nameHe}</p>
          {isInspection && item.laborHours > 0 && (
            <p className="text-[10px] text-[#4a5270] mt-0.5">כולל {item.laborHours} שע׳ בדיקה</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {item.laborHours > 0 && !isInspection && (
            <span className="text-[10px] text-indigo-400 font-mono bg-indigo-500/10 px-1.5 py-0.5 rounded-md">
              {item.laborHours}שע׳
            </span>
          )}
          {!isInspection && (
            <span className="text-xs font-mono font-bold text-[#8892a4]">
              {item.unitPrice > 0 ? `₪${(item.unitPrice * item.quantity).toLocaleString('he-IL')}` : '—'}
            </span>
          )}
          {item.notes && (
            <button onClick={onToggleNote} className="text-[#2e3147] hover:text-[#4a5270] transition-colors">
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
        </div>
      </div>
      {item.notes && expanded && (
        <div className="px-3 pb-3 pt-0 border-t border-[#1e2230]">
          <p className="text-xs text-[#4a5270] leading-relaxed mt-2">{item.notes}</p>
        </div>
      )}
    </div>
  )
}

/** Recommended item — toggleable with + / ✓ button */
function RecommendedItemRow({
  item, selected, noteKey, expanded, onToggle, onToggleNote,
}: {
  item: ServiceItem; selected: boolean; noteKey: string
  expanded: boolean; onToggle: () => void; onToggleNote: () => void
}) {
  const icon  = CATEGORY_ICONS[item.category] ?? '🔧'
  const cost  = r2(item.unitPrice * item.quantity + item.laborHours * LABOR_RATE_ILS)

  return (
    <div className={`rounded-xl border transition-all ${
      selected
        ? 'bg-blue-500/8 border-blue-500/30'
        : 'bg-[#141720] border-[#252836]'
    }`}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className="text-base shrink-0 w-5 text-center">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm truncate ${selected ? 'text-[#c5cde2]' : 'text-[#4a5270]'}`}>
            {item.nameHe}
          </p>
          {cost > 0 && (
            <p className="text-[10px] text-[#3a4260] mt-0.5">
              {item.laborHours > 0 && `${item.laborHours} שע׳ + `}
              ₪{(item.unitPrice * item.quantity).toLocaleString('he-IL')} חלקים
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {cost > 0 && (
            <span className={`text-xs font-mono font-bold ${selected ? 'text-blue-300' : 'text-[#3a4260]'}`}>
              ₪{cost.toLocaleString('he-IL')}
            </span>
          )}
          {item.notes && (
            <button onClick={onToggleNote} className="text-[#2e3147] hover:text-[#4a5270] transition-colors">
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
          <button
            onClick={onToggle}
            className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
              selected
                ? 'bg-blue-500/20 border-blue-500/40 text-blue-300 hover:bg-red-500/15 hover:border-red-500/30 hover:text-red-400'
                : 'bg-[#1e2230] border-[#2e3147] text-[#4a5270] hover:bg-blue-500/15 hover:border-blue-500/30 hover:text-blue-300'
            }`}
          >
            {selected ? <X size={10} /> : <Plus size={10} />}
            {selected ? 'הסר' : 'הוסף'}
          </button>
        </div>
      </div>
      {item.notes && expanded && (
        <div className="px-3 pb-3 pt-0 border-t border-[#1e2230]">
          <p className="text-xs text-[#4a5270] leading-relaxed mt-2">{item.notes}</p>
        </div>
      )}
    </div>
  )
}

/** Safety item — red warning badge, click to add */
function SafetyItemRow({
  item, selected, noteKey, expanded, onToggle, onToggleNote,
}: {
  item: ServiceItem; selected: boolean; noteKey: string
  expanded: boolean; onToggle: () => void; onToggleNote: () => void
}) {
  const icon = CATEGORY_ICONS[item.category] ?? '⚠️'
  const cost = r2(item.unitPrice * item.quantity + item.laborHours * LABOR_RATE_ILS)

  return (
    <div className={`rounded-xl border transition-all ${
      selected
        ? 'bg-red-500/10 border-red-500/35'
        : 'bg-[#1a1017] border-red-500/15'
    }`}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <AlertTriangle size={14} className="text-red-400 shrink-0" />
        <span className="text-base shrink-0 w-5 text-center">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm truncate ${selected ? 'text-red-200' : 'text-red-400/80'}`}>
            {item.nameHe}
          </p>
          {cost > 0 && (
            <p className="text-[10px] text-red-500/50 mt-0.5">
              {item.unitPrice > 0
                ? `₪${(item.unitPrice * item.quantity).toLocaleString('he-IL')} חלקים`
                : 'נדרשת בדיקה פיזית'}
              {item.laborHours > 0 && ` + ${item.laborHours} שע׳`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {cost > 0 && (
            <span className={`text-xs font-mono font-bold ${selected ? 'text-red-300' : 'text-red-500/50'}`}>
              {item.unitPrice > 0 ? `₪${cost.toLocaleString('he-IL')}` : '—'}
            </span>
          )}
          {item.notes && (
            <button onClick={onToggleNote} className="text-red-500/30 hover:text-red-400/70 transition-colors">
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
          <button
            onClick={onToggle}
            className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
              selected
                ? 'bg-red-500/20 border-red-500/40 text-red-300 hover:bg-[#1a1d27] hover:border-[#2e3147] hover:text-[#4a5270]'
                : 'bg-red-500/10 border-red-500/25 text-red-400 hover:bg-red-500/20 hover:border-red-500/40'
            }`}
          >
            {selected ? <X size={10} /> : <Plus size={10} />}
            {selected ? 'הסר' : 'הוסף'}
          </button>
        </div>
      </div>
      {item.notes && expanded && (
        <div className="px-3 pb-3 pt-0 border-t border-red-500/10">
          <p className="text-xs text-red-400/60 leading-relaxed mt-2">{item.notes}</p>
        </div>
      )}
    </div>
  )
}
