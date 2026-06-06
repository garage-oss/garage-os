'use client'

/**
 * PeriodicMileageModal
 *
 * Modal-first periodic service workflow.
 *
 * Vehicle plate / make / model / year are already known from the work order
 * and passed as props — the advisor only needs to enter current mileage.
 *
 * Flow:
 *   input   → advisor enters mileage (plate shown read-only)
 *   loading → POST /api/periodic-quote
 *   result  → vehicle card + source badge + interval summary + items + cost
 *   error   → message + retry
 *
 * Sources:
 *   "הוראות יצרן"  — exact or model-level DB match (isGeneric: false)
 *   "הצעת בסיס"    — DB generic or hardcoded fallback (isGeneric/isFallback)
 *
 * On confirm → calls onConfirm(items, notes, laborHours, periodicData, isFallback)
 */

import { useState } from 'react'
import {
  X, Gauge, Wrench, CheckCircle2, AlertTriangle,
  Loader2, Plus, Minus,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { LABOR_RATE_ILS, VAT_RATE, CATEGORY_ICONS, groupByPriority } from '@/lib/maintenance-schedule'
import type { ScheduleResult, ServiceItem } from '@/lib/maintenance-schedule'
import type { QuoteItemEdit } from '@/app/actions/quote-request'
import type { PeriodicPortalData } from '@/lib/periodic-portal'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PeriodicQuoteResponse {
  schedule:         ScheduleResult
  usedFuelType:     string | null
  usedTransmission: string | null
  missingFields:    Array<'fuelType' | 'transmission'>
}

export interface PeriodicMileageModalProps {
  /** Vehicle info from the work order — all pre-known */
  plate:          string
  make:           string
  model:          string
  year:           number
  fuelType?:      string | null
  transmission?:  string | null
  initialMileage?: number

  onConfirm: (
    items:        QuoteItemEdit[],
    notes:        string,
    laborHours:   number,
    periodicData: PeriodicPortalData,
    isFallback:   boolean,
  ) => void
  onClose: () => void
}

type ModalPhase =
  | { phase: 'input' }
  | { phase: 'loading' }
  | { phase: 'result'; data: PeriodicQuoteResponse; mileage: number }
  | { phase: 'error'; message: string }

// ─── Display maps ─────────────────────────────────────────────────────────────

const FUEL_LABELS: Record<string, string> = {
  GASOLINE: 'בנזין', DIESEL: 'דיזל', HYBRID: 'היברידי', ELECTRIC: 'חשמלי', LPG: 'גז',
}
const TRANS_LABELS: Record<string, string> = {
  MANUAL: 'ידני', AUTOMATIC: 'אוטומט', CVT: 'CVT',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function r2(n: number): number { return Math.round(n * 100) / 100 }

function itemCost(item: ServiceItem): number {
  return r2(item.unitPrice * item.quantity + item.laborHours * LABOR_RATE_ILS)
}

function formatPlate(raw: string): string {
  const d = raw.replace(/\D/g, '')
  if (d.length === 7) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`
  if (d.length === 8) return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`
  return raw
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ItemRow({ item, selected, onToggle, canToggle }: {
  item: ServiceItem; selected: boolean; onToggle?: () => void; canToggle: boolean
}) {
  const icon = CATEGORY_ICONS[item.category] ?? '🔧'
  const cost = itemCost(item)

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-default ${
        canToggle ? 'cursor-pointer' : ''
      } ${
        selected
          ? canToggle
            ? 'bg-indigo-500/10 border border-indigo-500/30'
            : 'bg-[#1a1d27] border border-[#252836]'
          : 'bg-[#14161e] border border-[#1e2230] opacity-60'
      }`}
      onClick={canToggle ? onToggle : undefined}
    >
      {canToggle ? (
        <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
          selected ? 'border-indigo-500 bg-indigo-500' : 'border-[#3a4260] bg-transparent'
        }`}>
          {selected && <span className="text-white text-[9px] font-black">✓</span>}
        </span>
      ) : (
        <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
      )}
      <span className="text-base shrink-0 w-5 text-center">{icon}</span>
      <span className={`flex-1 text-sm ${selected ? 'text-[#c5cde2]' : 'text-[#4a5270]'}`}>
        {item.nameHe}
      </span>
      {cost > 0 ? (
        <span className={`text-sm font-mono font-bold shrink-0 ${selected ? 'text-[#e2e8f0]' : 'text-[#3a4260]'}`}>
          {formatCurrency(cost)}
        </span>
      ) : (
        <span className="text-xs text-[#3a4260] shrink-0">כלול</span>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PeriodicMileageModal({
  plate, make, model, year, fuelType, transmission, initialMileage,
  onConfirm, onClose,
}: PeriodicMileageModalProps) {
  const [mileage,     setMileage]     = useState(initialMileage ? String(initialMileage) : '')
  const [phase,       setPhase]       = useState<ModalPhase>({ phase: 'input' })
  const [selectedRec, setSelectedRec] = useState<Set<number>>(new Set())
  const [selSafe,     setSelSafe]     = useState<Set<number>>(new Set())

  // ── Submit mileage → fetch schedule ──────────────────────────────────────────
  async function generate() {
    const km = parseInt(mileage, 10)
    if (!km || km <= 0) return

    setPhase({ phase: 'loading' })
    setSelectedRec(new Set())
    setSelSafe(new Set())

    try {
      const res = await fetch('/api/periodic-quote', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehiclePlate:        plate.replace(/\D/g, ''),
          vehicleMake:         make,
          vehicleModel:        model,
          vehicleYear:         year,
          vehicleMileage:      km,
          vehicleFuelType:     fuelType   || undefined,
          vehicleTransmission: transmission || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setPhase({ phase: 'error', message: json.message ?? 'שגיאה בטעינת לוח הטיפולים' })
        return
      }
      const data = json as PeriodicQuoteResponse

      // Auto-select all recommended + safety items (advisor can deselect)
      const groups = groupByPriority(data.schedule.items)
      setSelectedRec(new Set(groups.recommended.map((_, i) => i)))
      setSelSafe(new Set(groups.safety.map((_, i) => i)))

      setPhase({ phase: 'result', data, mileage: km })
    } catch {
      setPhase({ phase: 'error', message: 'שגיאת רשת — נסה שוב' })
    }
  }

  // ── Confirm → build QuoteItemEdit[] + PeriodicPortalData + call parent ────────
  function handleConfirm() {
    if (phase.phase !== 'result') return
    const { data, mileage: km } = phase
    const { schedule } = data
    const groups = groupByPriority(schedule.items)

    const selRecItems  = groups.recommended.filter((_, i) => selectedRec.has(i))
    const selSafeItems = groups.safety.filter((_, i) => selSafe.has(i))
    const allIncluded  = [...groups.required, ...selRecItems, ...selSafeItems]
    const partItems    = allIncluded.filter(i => i.category !== 'INSPECTION' && i.unitPrice > 0)

    const items: QuoteItemEdit[] = partItems.map(i => ({
      description: i.nameHe + (i.notes ? ` — ${i.notes}` : ''),
      quantity:    i.quantity,
      unitPrice:   i.unitPrice,
      total:       r2(i.quantity * i.unitPrice),
    }))

    const totalLaborHours = r2(allIncluded.reduce((s, i) => s + i.laborHours, 0))
    const vehicleName = `${make} ${titleCase(model)} ${year}`

    const noteLines: string[] = [
      schedule.isFallback
        ? `טיפול תקופתי — ${vehicleName}`
        : `${schedule.intervalLabel} — ${vehicleName}`,
      `ק״מ נוכחי: ${km.toLocaleString('he-IL')}`,
    ]
    if (schedule.isFallback) {
      noteLines.push('', '⚠️ הצעת בסיס — לא נמצאו הוראות יצרן מלאות. יש לאמת ולערוך לפני שליחה ללקוח.')
    } else {
      noteLines.push('', 'פריטים נדרשים (לפי יצרן):')
      groups.required.forEach(i => noteLines.push(`• ${i.nameHe}`))
      if (selRecItems.length > 0) {
        noteLines.push('', 'פריטים מומלצים שנוספו:')
        selRecItems.forEach(i => noteLines.push(`• ${i.nameHe}`))
      }
      if (selSafeItems.length > 0) {
        noteLines.push('', 'התראות בטיחות שנבחרו:')
        selSafeItems.forEach(i => noteLines.push(`• ${i.nameHe}`))
      }
    }
    noteLines.push('', '⚠️ הצעה אוטומטית לפי נתוני רכב וק״מ — כפוף לאישור יועץ שירות לפני שליחה ללקוח.')

    const periodicData: PeriodicPortalData = {
      vehicleName,
      mileage:            km,
      intervalLabel:      schedule.intervalLabel,
      laborRate:          LABOR_RATE_ILS,
      required:           groups.required.map(i => ({
        nameHe: i.nameHe, unitPrice: i.unitPrice, quantity: i.quantity,
        laborHours: i.laborHours, category: i.category, notes: i.notes,
      })),
      recommended:        groups.recommended.map(i => ({
        nameHe: i.nameHe, unitPrice: i.unitPrice, quantity: i.quantity,
        laborHours: i.laborHours, category: i.category, notes: i.notes,
      })),
      safety:             groups.safety.map(i => ({
        nameHe: i.nameHe, unitPrice: i.unitPrice, quantity: i.quantity,
        laborHours: i.laborHours, category: i.category, notes: i.notes,
      })),
      initialRecommended: Array.from(selectedRec),
      initialSafety:      Array.from(selSafe),
    }

    onConfirm(items, noteLines.join('\n'), totalLaborHours, periodicData, schedule.isFallback ?? false)
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const vehicleLabel = `${make} ${titleCase(model)} ${year}`
  const km = phase.phase === 'result' ? phase.mileage : parseInt(mileage, 10) || 0

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="relative z-10 w-full sm:max-w-lg bg-[#0d0f17] border border-[#252836] rounded-t-3xl sm:rounded-2xl overflow-hidden flex flex-col max-h-[92vh]">

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2230] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
              <Wrench size={14} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-black text-[#e2e8f0]">טיפול תקופתי</p>
              <p className="text-[11px] text-[#4a5270] mt-0.5">{vehicleLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {/* Plate chip */}
            <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-lg">
              {formatPlate(plate)}
            </span>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-[#1a1d27] border border-[#252836] flex items-center justify-center text-[#4a5270] hover:text-[#8892a4] hover:border-[#3a4260] transition-colors"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* ── Scrollable body ──────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* ════ PHASE: input ════════════════════════════════════════════════════ */}
          {phase.phase === 'input' && (
            <div className="px-5 py-6 space-y-5">

              {/* Vehicle info strip */}
              <div className="flex items-center gap-3 bg-[#1a1d27] border border-[#252836] rounded-xl px-4 py-3">
                <span className="text-2xl">🚗</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-[#e2e8f0]">{vehicleLabel}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {fuelType && (
                      <span className="text-[10px] text-[#4a5270] bg-[#13161f] border border-[#1e2230] px-2 py-0.5 rounded-md">
                        {FUEL_LABELS[fuelType] ?? fuelType}
                      </span>
                    )}
                    {transmission && (
                      <span className="text-[10px] text-indigo-400 bg-indigo-500/8 border border-indigo-500/20 px-2 py-0.5 rounded-md">
                        {TRANS_LABELS[transmission] ?? transmission}
                      </span>
                    )}
                  </div>
                </div>
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-full shrink-0">
                  <CheckCircle2 size={9} />
                  אומת
                </span>
              </div>

              {/* Mileage input */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-xs font-bold text-[#c5cde2] uppercase tracking-widest">
                  <Gauge size={11} className="text-emerald-400" />
                  ק״מ נוכחי
                  <span className="text-red-400 font-black text-sm">*</span>
                </label>
                <p className="text-[11px] text-[#4a5270]">
                  נדרש לזיהוי אוטומטי של אינטרוול השירות המתאים
                </p>
                <div className="relative">
                  <input
                    type="number"
                    min={1000}
                    step={1000}
                    value={mileage}
                    onChange={e => setMileage(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && generate()}
                    placeholder="לדוגמה: 61500"
                    autoFocus
                    className="w-full bg-[#1a1d27] border border-[#2e3147] text-[#e2e8f0] rounded-xl px-4 py-3.5 text-2xl font-mono font-black text-center outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/15 transition-all placeholder:text-[#2e3147] placeholder:text-base placeholder:font-normal"
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-[#3a4260] pointer-events-none">
                    ק״מ
                  </span>
                </div>
              </div>

              <button
                onClick={generate}
                disabled={!mileage || parseInt(mileage, 10) < 1000}
                className="w-full flex items-center justify-center gap-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-base py-4 rounded-xl transition-colors"
              >
                <Wrench size={16} />
                זהה אינטרוול שירות וצור הצעה
              </button>
            </div>
          )}

          {/* ════ PHASE: loading ══════════════════════════════════════════════════ */}
          {phase.phase === 'loading' && (
            <div className="px-5 py-16 flex flex-col items-center gap-4">
              <Loader2 size={28} className="text-emerald-400 animate-spin" />
              <div className="text-center">
                <p className="text-sm font-bold text-[#c5cde2]">מאתר לוח שירות...</p>
                <p className="text-xs text-[#4a5270] mt-1">
                  {vehicleLabel} · {km.toLocaleString('he-IL')} ק״מ
                </p>
              </div>
            </div>
          )}

          {/* ════ PHASE: result ═══════════════════════════════════════════════════ */}
          {phase.phase === 'result' && (() => {
            const { data, mileage: km } = phase
            const { schedule, usedFuelType, usedTransmission } = data
            const groups       = groupByPriority(schedule.items)
            const isFallback   = schedule.isFallback ?? false
            const isManufacturer = !schedule.isGeneric

            const selRecItems  = groups.recommended.filter((_, i) => selectedRec.has(i))
            const selSafeItems = groups.safety.filter((_, i) => selSafe.has(i))
            const allSelected  = [...selRecItems, ...selSafeItems]

            const reqSubtotal   = r2(groups.required.reduce((s, i) => s + itemCost(i), 0))
            const addlSubtotal  = r2(allSelected.reduce((s, i) => s + itemCost(i), 0))
            const subtotal      = r2(reqSubtotal + addlSubtotal)
            const vatAmount     = r2(subtotal * VAT_RATE)
            const total         = r2(subtotal + vatAmount)

            return (
              <div className="px-5 py-5 space-y-4">

                {/* ── Source badge ─────────────────────────────────────────── */}
                <div className="flex items-center justify-between">
                  {isManufacturer ? (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 bg-emerald-500/12 border border-emerald-500/30 px-3 py-1.5 rounded-full">
                      <CheckCircle2 size={11} />
                      הוראות יצרן
                    </span>
                  ) : isFallback ? (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-amber-300 bg-amber-500/12 border border-amber-500/30 px-3 py-1.5 rounded-full">
                      <AlertTriangle size={11} />
                      הצעת בסיס
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-amber-300 bg-amber-500/12 border border-amber-500/30 px-3 py-1.5 rounded-full">
                      <AlertTriangle size={11} />
                      הוראות יצרן — כלליות
                    </span>
                  )}
                  <button
                    onClick={() => setPhase({ phase: 'input' })}
                    className="text-xs text-[#3a4260] hover:text-[#6a7290] transition-colors"
                  >
                    ← עדכן ק״מ
                  </button>
                </div>

                {/* ── Fallback warning ─────────────────────────────────────── */}
                {(isFallback || schedule.isGeneric) && schedule.matchNote && (
                  <div className="flex items-start gap-2.5 bg-amber-500/8 border border-amber-500/25 rounded-xl px-4 py-3">
                    <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-300/90 leading-relaxed">{schedule.matchNote}</p>
                  </div>
                )}

                {/* ── 3-column interval summary ────────────────────────────── */}
                <div className="bg-[#1a1d27] border border-[#252836] rounded-xl overflow-hidden">
                  <div className="grid grid-cols-3 divide-x divide-[#252836] rtl:divide-x-reverse">
                    <div className="px-3 py-3 text-center">
                      <p className="text-[9px] font-bold text-[#4a5270] uppercase tracking-widest mb-1.5">ק״מ נוכחי</p>
                      <p className="text-base font-black text-[#c5cde2] tabular-nums">
                        {km.toLocaleString('he-IL')}
                      </p>
                    </div>
                    <div className="px-3 py-3 text-center bg-emerald-500/6">
                      <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest mb-1.5">טיפול זוהה</p>
                      {isFallback ? (
                        <p className="text-xs font-bold text-amber-400">בסיסי</p>
                      ) : (
                        <p className="text-base font-black text-emerald-300 tabular-nums">
                          {schedule.intervalKm.toLocaleString('he-IL')}
                        </p>
                      )}
                    </div>
                    <div className="px-3 py-3 text-center">
                      <p className="text-[9px] font-bold text-[#4a5270] uppercase tracking-widest mb-1.5">טיפול הבא</p>
                      {schedule.nextIntervalKm ? (
                        <>
                          <p className="text-base font-black text-[#8892a4] tabular-nums">
                            {schedule.nextIntervalKm.toLocaleString('he-IL')}
                          </p>
                          <p className="text-[9px] text-[#3a4260] mt-0.5">
                            +{(schedule.nextIntervalKm - schedule.intervalKm).toLocaleString('he-IL')} ק״מ
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-[#3a4260]">—</p>
                      )}
                    </div>
                  </div>
                  <div className="px-4 py-2 border-t border-[#252836] flex items-center gap-2">
                    <span className="text-base">🔧</span>
                    <p className="text-sm font-black text-[#e2e8f0]">{schedule.intervalLabel}</p>
                    {usedFuelType && (
                      <span className="text-[10px] text-[#4a5270] bg-[#13161f] border border-[#1e2230] px-2 py-0.5 rounded-md ml-auto">
                        {FUEL_LABELS[usedFuelType] ?? usedFuelType}
                      </span>
                    )}
                    {usedTransmission && (
                      <span className="text-[10px] text-indigo-400 bg-indigo-500/8 border border-indigo-500/20 px-2 py-0.5 rounded-md">
                        {TRANS_LABELS[usedTransmission] ?? usedTransmission}
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Required items ───────────────────────────────────────── */}
                {groups.required.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.12em] flex items-center gap-1.5">
                      <CheckCircle2 size={10} />
                      נדרש
                    </p>
                    {groups.required.map((item, i) => (
                      <ItemRow key={i} item={item} selected canToggle={false} />
                    ))}
                  </div>
                )}

                {/* ── Recommended items ────────────────────────────────────── */}
                {groups.recommended.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.12em]">
                        💡 מומלץ
                      </p>
                      <p className="text-[10px] text-[#3a4260]">לחץ להוסיף / להסיר</p>
                    </div>
                    {groups.recommended.map((item, i) => (
                      <ItemRow
                        key={i}
                        item={item}
                        selected={selectedRec.has(i)}
                        onToggle={() => setSelectedRec(prev => {
                          const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n
                        })}
                        canToggle
                      />
                    ))}
                  </div>
                )}

                {/* ── Safety items ─────────────────────────────────────────── */}
                {groups.safety.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold text-red-400 uppercase tracking-[0.12em] flex items-center gap-1.5">
                        <AlertTriangle size={10} />
                        בטיחות
                      </p>
                      <p className="text-[10px] text-[#3a4260]">מומלץ לטפל בדחיפות</p>
                    </div>
                    {groups.safety.map((item, i) => (
                      <ItemRow
                        key={i}
                        item={item}
                        selected={selSafe.has(i)}
                        onToggle={() => setSelSafe(prev => {
                          const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n
                        })}
                        canToggle
                      />
                    ))}
                  </div>
                )}

                {/* ── Cost breakdown ───────────────────────────────────────── */}
                <div className="bg-[#1a1d27] border border-[#252836] rounded-xl px-4 py-3 space-y-1.5">
                  <div className="flex justify-between text-xs text-[#8892a4]">
                    <span>לפני מע״מ</span>
                    <span className="font-mono">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-[#8892a4]">
                    <span>מע״מ 17%</span>
                    <span className="font-mono">{formatCurrency(vatAmount)}</span>
                  </div>
                  <div className="flex justify-between font-black text-sm text-emerald-400 border-t border-[#252836] pt-2 mt-1">
                    <span>סה״כ כולל מע״מ</span>
                    <span className="font-mono">{formatCurrency(total)}</span>
                  </div>
                </div>

              </div>
            )
          })()}

          {/* ════ PHASE: error ════════════════════════════════════════════════════ */}
          {phase.phase === 'error' && (
            <div className="px-5 py-8 space-y-4">
              <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3.5">
                <AlertTriangle size={15} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{phase.message}</p>
              </div>
              <button
                onClick={() => setPhase({ phase: 'input' })}
                className="w-full text-sm text-[#4a5270] hover:text-[#8892a4] transition-colors py-2"
              >
                ← חזרה
              </button>
            </div>
          )}

        </div>

        {/* ── Sticky footer ────────────────────────────────────────────────────── */}
        {phase.phase === 'result' && (
          <div className="px-5 py-4 border-t border-[#1e2230] bg-[#0d0f17] shrink-0 space-y-2.5">
            <button
              onClick={handleConfirm}
              className="w-full flex items-center justify-center gap-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base py-4 rounded-xl transition-colors active:scale-[0.98] shadow-lg shadow-emerald-900/30"
            >
              <CheckCircle2 size={16} />
              מלא טופס הצעת מחיר
            </button>
            <button
              onClick={onClose}
              className="w-full text-sm text-[#3a4260] hover:text-[#6a7290] transition-colors py-1"
            >
              ביטול
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
