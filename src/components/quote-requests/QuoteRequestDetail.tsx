'use client'

import { useState, useTransition } from 'react'
import { useRouter }               from 'next/navigation'
import {
  sendQuoteToCustomer,
  cancelQuoteRequest,
  type QuoteItemEdit,
} from '@/app/actions/quote-request'
import { formatCurrency }       from '@/lib/utils'
import { SERVICE_TYPE_LABELS }  from '@/lib/quote-engine'
import {
  Trash2, Plus, Sparkles,
  ChevronDown, ChevronUp,
  AlertTriangle, Zap, Clock,
  Package, Activity, CheckCircle2,
  Wrench, Gauge,
} from 'lucide-react'
import { PartsRecommendationPanel }  from './PartsRecommendationPanel'
import { PeriodicMileageModal }      from './PeriodicMileageModal'
import type { PeriodicPortalData }   from '@/lib/periodic-portal'

// ─── AI types ─────────────────────────────────────────────────────────────────

interface AiResult {
  diagnosis:        string
  confidence:       number
  urgency:          'low' | 'medium' | 'high' | 'critical'
  laborOperations:  Array<{ name: string; estimatedHours: number; description: string }>
  totalLaborHours:  number
  partsRecommended: Array<{
    name:              string
    category:          string
    quantity:          number
    estimatedPriceILS: number
    isOptional:        boolean
    notes?:            string
  }>
  additionalChecks: string[]
  safetyWarning:    string | null
  aiNotes:          string
}

type AiState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; result: AiResult; analysisId: string; isMock: boolean }
  | { status: 'error'; message: string }

const URGENCY_CFG: Record<string, { label: string; bg: string; text: string; bar: string }> = {
  low:      { label: 'נמוכה',   bg: 'bg-slate-500/15',  text: 'text-slate-400',  bar: 'bg-slate-500'  },
  medium:   { label: 'בינונית', bg: 'bg-amber-500/15',  text: 'text-amber-400',  bar: 'bg-amber-500'  },
  high:     { label: 'גבוהה',   bg: 'bg-orange-500/15', text: 'text-orange-400', bar: 'bg-orange-500' },
  critical: { label: 'קריטית',  bg: 'bg-red-500/15',    text: 'text-red-400',    bar: 'bg-red-500'    },
}

// ─── Component types ───────────────────────────────────────────────────────────

export interface QuoteDetailData {
  requestId:   string
  status:      string
  serviceType: string
  urgency:     string
  description: string | null
  createdAt:   Date
  customer:  { name: string; phone: string }
  vehicle: {
    make:          string
    model:         string
    plate:         string
    year:          number
    color?:        string | null
    engine?:       string | null
    fuelType?:     string | null
    transmission?: string | null
    mileage?:      number | null
  }
  workOrder: { workOrderNumber: string; id: string }
  quote: {
    id:          string
    quoteNumber: string
    status:      string
    laborHours:  number
    laborRate:   number
    totalPrice:  number
    notes:       string | null
    isEstimate:  boolean
    items: Array<{
      id:          string
      description: string
      quantity:    number
      unitPrice:   number
      total:       number
    }>
  } | null
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function QuoteRequestDetail({ data }: { data: QuoteDetailData }) {
  const router             = useRouter()
  const [pending, start]   = useTransition()

  // ── Quote form state ────────────────────────────────────────────────────────
  const initial = data.quote
  const [laborHours, setLaborHours] = useState(initial?.laborHours ?? 1)
  const [laborRate,  setLaborRate]  = useState(initial?.laborRate  ?? 295)
  const [notes,      setNotes]      = useState(initial?.notes ?? '')
  const [validDays,  setValidDays]  = useState(14)
  const [items,      setItems]      = useState<QuoteItemEdit[]>(
    (initial?.items ?? []).map(i => ({
      description: i.description,
      quantity:    i.quantity,
      unitPrice:   i.unitPrice,
      total:       i.total,
    })),
  )
  const [error,      setError]      = useState<string | null>(null)
  const [success,    setSuccess]    = useState(false)
  const [showCancel, setShowCancel] = useState(false)

  // ── AI state ────────────────────────────────────────────────────────────────
  const [ai,           setAi]           = useState<AiState>({ status: 'idle' })
  const [aiExpanded,   setAiExpanded]   = useState(true)
  const [showPartsPanel, setShowPartsPanel] = useState(false)

  // ── Form fill tracking ──────────────────────────────────────────────────────
  // 'ai'       → form was populated from AI analysis / supplier panel
  // 'schedule' → form was populated from structured maintenance schedule (periodic only)
  // null       → form has not been auto-populated yet
  const [filledSource,       setFilledSource]      = useState<null | 'ai' | 'schedule'>(null)
  const [periodicPortalData, setPeriodicPortalData] = useState<PeriodicPortalData | null>(null)
  const [periodicIsFallback, setPeriodicIsFallback] = useState(false)

  // ── Periodic service modal ──────────────────────────────────────────────────
  // Auto-open the mileage modal on first render for PERIODIC_SERVICE requests
  // that haven't been filled yet and are still editable.
  const isPeriodic     = data.serviceType === 'PERIODIC_SERVICE'
  const canEditStatus  = data.status === 'REVIEWING' || data.status === 'PENDING'
  const [showPeriodicModal, setShowPeriodicModal] = useState(
    isPeriodic && canEditStatus,
  )

  // ── Totals ──────────────────────────────────────────────────────────────────
  const VAT_RATE   = 0.17
  const partsTotal = items.reduce((s, i) => s + i.total, 0)
  const laborTotal = laborHours * laborRate
  const subtotal   = laborTotal + partsTotal
  const vat        = Math.round(subtotal * VAT_RATE * 100) / 100
  const total      = Math.round((subtotal + vat) * 100) / 100

  // ── Item helpers ────────────────────────────────────────────────────────────
  function addItem() {
    setItems(prev => [...prev, { description: '', quantity: 1, unitPrice: 0, total: 0 }])
  }
  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }
  function updateItem(idx: number, field: keyof QuoteItemEdit, value: string) {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item
      const updated = { ...item, [field]: field === 'description' ? value : parseFloat(value) || 0 }
      updated.total = Math.round(updated.quantity * updated.unitPrice * 100) / 100
      return updated
    }))
  }

  // ── AI analysis ─────────────────────────────────────────────────────────────
  async function runAiAnalysis() {
    // Hard guard: AI analysis is never used for periodic service.
    // The structured maintenance schedule engine handles that path exclusively.
    if (data.serviceType === 'PERIODIC_SERVICE') return

    setAi({ status: 'loading' })
    const serviceLabel =
      SERVICE_TYPE_LABELS[data.serviceType as keyof typeof SERVICE_TYPE_LABELS] ?? data.serviceType
    const complaintText = [serviceLabel, data.description].filter(Boolean).join('\n')

    try {
      const res = await fetch('/api/ai-quote', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          complaintText,
          serviceType:  data.serviceType,       // sent so the server can enforce the same guard
          vehicleMake:  data.vehicle.make,
          vehicleModel: data.vehicle.model,
          vehicleYear:  data.vehicle.year,
          vehiclePlate: data.vehicle.plate,
          workOrderId:  data.workOrder.id,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setAi({ status: 'error', message: json.message ?? 'שגיאה לא ידועה' }); return }
      setAi({ status: 'done', result: json.result, analysisId: json.analysisId, isMock: json.isMock ?? false })
      // Auto-advance straight to supplier selection — one click does the full workflow
      setAiExpanded(false)
      setShowPartsPanel(true)
    } catch {
      setAi({ status: 'error', message: 'שגיאת רשת — נסה שוב' })
    }
  }

  // ── Fill form from AI ────────────────────────────────────────────────────────
  function fillFromAi(result: AiResult) {
    setLaborHours(result.totalLaborHours)
    setLaborRate(295)

    const newItems: QuoteItemEdit[] = result.partsRecommended.map(p => ({
      description:
        p.name +
        (p.notes ? ` — ${p.notes}` : '') +
        (p.isOptional ? ' [אופציונלי]' : ''),
      quantity:  p.quantity,
      unitPrice: p.estimatedPriceILS,
      total:     Math.round(p.quantity * p.estimatedPriceILS * 100) / 100,
    }))
    setItems(newItems)

    // Build notes from AI
    const opLines = result.laborOperations
      .map(op => `• ${op.name} — ${op.estimatedHours} שעות`)
      .join('\n')
    const notesParts = [`פעולות עבודה:\n${opLines}`]
    if (result.aiNotes) notesParts.push('', `הערות AI:\n${result.aiNotes}`)
    setNotes(notesParts.join('\n'))
    setFilledSource('ai')
  }

  // ── Fill form from periodic service schedule ────────────────────────────────
  // Source is the MaintenanceSchedule DB — no AI involved.
  function fillFromPeriodic(
    items:          QuoteItemEdit[],
    scheduleNotes:  string,
    schedLaborHours: number,
    periodicData:   PeriodicPortalData,
    isFallback:     boolean = false,
  ) {
    setItems(items)
    setLaborHours(schedLaborHours)
    setLaborRate(295)
    setNotes(scheduleNotes)
    setFilledSource('schedule')   // ← explicitly NOT 'ai'
    setPeriodicPortalData(periodicData)
    setPeriodicIsFallback(isFallback)
    setShowPeriodicModal(false)   // close the modal
  }

  // ── Fill form from selected supplier parts (called by PartsRecommendationPanel) ──
  function fillFromParts(items: QuoteItemEdit[], partsNotes: string) {
    setItems(items)
    if (ai.status === 'done') {
      setLaborHours(ai.result.totalLaborHours)
      setLaborRate(295)
      const opLines = ai.result.laborOperations
        .map(op => `• ${op.name} — ${op.estimatedHours} שעות`)
        .join('\n')
      setNotes(`פעולות עבודה:\n${opLines}\n\n${partsNotes}`)
    } else {
      setNotes(partsNotes)
    }
    setFilledSource('ai')
    setShowPartsPanel(false)
  }

  // ── Send handlers ────────────────────────────────────────────────────────────
  function handleSend() {
    if (!data.quote) { setError('אין הצעת מחיר משויכת'); return }
    setError(null)
    start(async () => {
      const res = await sendQuoteToCustomer(data.requestId, {
        laborHours, laborRate, notes, validDays, items,
        periodicData: periodicPortalData ?? undefined,
      })
      if ('error' in res) { setError(String(res)); return }
      setSuccess(true)
      router.refresh()
    })
  }

  function handleCancel() {
    start(async () => {
      await cancelQuoteRequest(data.requestId)
      router.push('/dashboard/quote-requests')
    })
  }

  const canEdit = data.status === 'REVIEWING' || data.status === 'PENDING'
  const isSent  = data.status === 'SENT'

  // WhatsApp message
  const waText = `שלום ${data.customer.name},\n\nהצעת המחיר עבור ${data.vehicle.make} ${data.vehicle.model} (${data.vehicle.plate}) מוכנה.\n\nסך הכל: ${formatCurrency(total)}\n\nלצפייה ואישור היכנס לפורטל.`
  const waLink = data.customer.phone
    ? `https://wa.me/972${data.customer.phone.replace(/^0/, '').replace(/\D/g, '')}?text=${encodeURIComponent(waText)}`
    : null

  // ─── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ════════════════════════════════════════════════════════════
          PERIODIC SERVICE — mileage modal + applied banner
          (replaces AI panel for PERIODIC_SERVICE requests)
      ════════════════════════════════════════════════════════════ */}
      {isPeriodic && (
        <>
          {/* Applied banner — shown after the modal confirms */}
          {filledSource === 'schedule' && periodicPortalData && (
            <div className={`border rounded-2xl overflow-hidden ${
              periodicIsFallback
                ? 'bg-amber-500/8 border-amber-500/25'
                : 'bg-emerald-500/8 border-emerald-500/25'
            }`}>
              <div className="flex items-center justify-between px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🔧</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black text-[#e2e8f0]">{periodicPortalData.intervalLabel}</p>
                      {periodicIsFallback ? (
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                          הצעת בסיס
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 rounded-full">
                          הוראות יצרן
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#4a5270] mt-0.5">
                      {periodicPortalData.vehicleName} · {periodicPortalData.mileage.toLocaleString('he-IL')} ק״מ
                    </p>
                  </div>
                </div>
                {canEdit && (
                  <button
                    onClick={() => setShowPeriodicModal(true)}
                    className="text-xs text-[#4a5270] hover:text-[#8892a4] border border-[#252836] px-3 py-1.5 rounded-lg transition-colors"
                  >
                    עדכן ק״מ
                  </button>
                )}
              </div>
              {periodicIsFallback && (
                <div className="px-5 pb-3.5 flex items-start gap-2">
                  <AlertTriangle size={12} className="text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-300/80 leading-relaxed">
                    לא נמצאו הוראות יצרן מלאות — נוצרה הצעת בסיס לבדיקה ואישור יועץ שירות.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Open-modal button — shown before first confirmation */}
          {filledSource !== 'schedule' && canEdit && (
            <div className="bg-[#0f1117] border border-[#252836] rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e2230]">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <Wrench size={13} className="text-emerald-400" />
                  </div>
                  <span className="text-sm font-bold text-[#e2e8f0]">הצעה אוטומטית — טיפול תקופתי</span>
                </div>
              </div>
              <div className="px-5 py-5 text-center space-y-4">
                <p className="text-sm text-[#4a5270]">
                  הזן ק״מ נוכחי לזיהוי אוטומטי של אינטרוול השירות ויצירת הצעה
                </p>
                <button
                  onClick={() => setShowPeriodicModal(true)}
                  className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm px-6 py-3 rounded-xl transition-colors"
                >
                  <Gauge size={14} />
                  הזן קילומטראז׳ נוכחי
                </button>
              </div>
            </div>
          )}

          {/* The modal itself */}
          {showPeriodicModal && (
            <PeriodicMileageModal
              plate={data.vehicle.plate}
              make={data.vehicle.make}
              model={data.vehicle.model}
              year={data.vehicle.year}
              fuelType={data.vehicle.fuelType}
              transmission={data.vehicle.transmission}
              initialMileage={data.vehicle.mileage ?? undefined}
              onConfirm={fillFromPeriodic}
              onClose={() => setShowPeriodicModal(false)}
            />
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════
          AI ANALYSIS PANEL (non-periodic service types)
      ════════════════════════════════════════════════════════════ */}
      {data.serviceType !== 'PERIODIC_SERVICE' && (
      <div className="bg-[#0f1117] border border-[#252836] rounded-2xl overflow-hidden">

        {/* ── Panel header ─────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e2230]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#6366f1]/20 flex items-center justify-center">
              <Sparkles size={13} className="text-[#6366f1]" />
            </div>
            <span className="text-sm font-bold text-[#e2e8f0]">ניתוח AI</span>
            {ai.status === 'done' && (
              <span className="flex items-center gap-1 text-[10px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full font-bold border border-emerald-500/20">
                <CheckCircle2 size={9} />
                הושלם
              </span>
            )}
            {ai.status === 'done' && ai.isMock && (
              <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full font-bold border border-amber-500/20">
                🎭 הדגמה
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {ai.status === 'idle' && (
              <button
                onClick={runAiAnalysis}
                className="flex items-center gap-1.5 bg-[#6366f1] hover:bg-[#5558e8] text-white text-xs font-bold px-3.5 py-2 rounded-lg transition-colors"
              >
                <Zap size={11} />
                נתח עם AI וצור הצעת מחיר
              </button>
            )}
            {ai.status === 'error' && (
              <button
                onClick={runAiAnalysis}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
              >
                נסה שוב
              </button>
            )}
            {ai.status === 'done' && (
              <button
                onClick={() => setAiExpanded(p => !p)}
                className="text-[#4a5270] hover:text-[#8892a4] transition-colors p-0.5"
              >
                {aiExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            )}
          </div>
        </div>

        {/* ── Idle prompt ──────────────────────────────────────── */}
        {ai.status === 'idle' && (
          <div className="px-5 py-6 text-center space-y-2">
            <p className="text-sm text-[#8892a4]">הפעל ניתוח AI לקבלת אבחון, עבודות וחלקים</p>
            <p className="text-xs text-[#2e3147]">
              {data.vehicle.make} {data.vehicle.model} {data.vehicle.year} · {data.vehicle.plate}
            </p>
          </div>
        )}

        {/* ── Loading ───────────────────────────────────────────── */}
        {ai.status === 'loading' && (
          <div className="px-5 py-8 flex flex-col items-center gap-3">
            <div className="flex gap-1.5">
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="w-2 h-2 bg-[#6366f1] rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.12}s` }}
                />
              ))}
            </div>
            <p className="text-sm text-[#8892a4]">מנתח תקלה ומכין הצעת מחיר...</p>
          </div>
        )}

        {/* ── Error ────────────────────────────────────────────── */}
        {ai.status === 'error' && (
          <div className="px-5 py-4 flex items-center gap-3">
            <AlertTriangle size={15} className="text-red-400 shrink-0" />
            <p className="text-sm text-red-400 flex-1">{ai.message}</p>
          </div>
        )}

        {/* ── Results ──────────────────────────────────────────── */}
        {ai.status === 'done' && aiExpanded && (() => {
          const r   = ai.result
          const urg = URGENCY_CFG[r.urgency] ?? URGENCY_CFG.medium
          const pct = Math.round(r.confidence * 100)
          const confColor =
            pct >= 90 ? 'text-emerald-400' :
            pct >= 75 ? 'text-indigo-400'  :
                        'text-amber-400'
          const confBar =
            pct >= 90 ? 'bg-emerald-500' :
            pct >= 75 ? 'bg-indigo-500'  :
                        'bg-amber-500'

          return (
            <div className="px-5 pt-4 pb-5 space-y-5">

              {/* ── Stats row ─────────────────────────────────── */}
              <div className="grid grid-cols-4 gap-2">

                <div className="bg-[#1a1d27] border border-[#252836] rounded-xl p-3 space-y-2">
                  <Activity size={13} className={`${confColor} mx-auto`} />
                  <p className={`text-lg font-black tabular-nums text-center ${confColor}`}>{pct}%</p>
                  <div className="h-1 bg-[#252836] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${confBar}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] text-[#4a5270] text-center">ביטחון</p>
                </div>

                <div className="bg-[#1a1d27] border border-[#252836] rounded-xl p-3 space-y-1 flex flex-col items-center justify-center">
                  <Clock size={13} className="text-[#4a5270]" />
                  <p className="text-lg font-black text-[#e2e8f0] tabular-nums">{r.totalLaborHours}</p>
                  <p className="text-[10px] text-[#4a5270]">שעות עבודה</p>
                </div>

                <div className="bg-[#1a1d27] border border-[#252836] rounded-xl p-3 space-y-1 flex flex-col items-center justify-center">
                  <Package size={13} className="text-[#4a5270]" />
                  <p className="text-lg font-black text-[#e2e8f0] tabular-nums">{r.partsRecommended.length}</p>
                  <p className="text-[10px] text-[#4a5270]">חלקים</p>
                </div>

                <div className={`border border-[#252836] rounded-xl p-3 flex flex-col items-center justify-center gap-1 ${urg.bg}`}>
                  <p className={`text-sm font-black ${urg.text}`}>{urg.label}</p>
                  <div className={`h-1.5 w-8 rounded-full ${urg.bar} opacity-60`} />
                  <p className="text-[10px] text-[#4a5270]">רמת סיכון</p>
                </div>

              </div>

              {/* ── Safety warning ────────────────────────────── */}
              {r.safetyWarning && (
                <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/25 rounded-xl px-3.5 py-3">
                  <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-300 leading-relaxed">{r.safetyWarning}</p>
                </div>
              )}

              {/* ── Diagnosis ─────────────────────────────────── */}
              <div>
                <p className="text-[10px] font-bold text-[#4a5270] uppercase tracking-[0.12em] mb-2">
                  אבחון משוער
                </p>
                <p className="text-sm text-[#c5cde2] leading-relaxed">{r.diagnosis}</p>
              </div>

              {/* ── Labor operations ──────────────────────────── */}
              <div>
                <p className="text-[10px] font-bold text-[#4a5270] uppercase tracking-[0.12em] mb-2">
                  פעולות עבודה מומלצות
                </p>
                <div className="space-y-1.5">
                  {r.laborOperations.map((op, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-[#1a1d27] border border-[#252836] rounded-lg px-3 py-2.5 gap-3"
                    >
                      <span className="text-sm text-[#c5cde2] flex-1 min-w-0 truncate">{op.name}</span>
                      <span className="text-xs font-mono text-indigo-400 shrink-0 bg-indigo-500/10 px-2 py-0.5 rounded-md">
                        {op.estimatedHours} שע׳
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-3 py-1">
                    <span className="text-xs text-[#4a5270]">סה"כ שעות</span>
                    <span className="text-xs font-black text-indigo-400 font-mono">{r.totalLaborHours} שע׳ × ₪295 = {formatCurrency(r.totalLaborHours * 295)}</span>
                  </div>
                </div>
              </div>

              {/* ── Parts ─────────────────────────────────────── */}
              <div>
                <p className="text-[10px] font-bold text-[#4a5270] uppercase tracking-[0.12em] mb-2">
                  חלקים מומלצים
                </p>
                <div className="space-y-1.5">
                  {r.partsRecommended.map((p, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${
                        p.isOptional
                          ? 'border border-dashed border-[#252836] bg-[#141720]'
                          : 'bg-[#1a1d27] border border-[#252836]'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#c5cde2] truncate">{p.name}</p>
                        {p.notes && (
                          <p className="text-[10px] text-[#4a5270] mt-0.5">{p.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {p.isOptional && (
                          <span className="text-[9px] font-bold text-[#4a5270] border border-[#2e3147] px-1.5 py-0.5 rounded-md">
                            אופציונלי
                          </span>
                        )}
                        <span className="text-[11px] text-[#4a5270]">×{p.quantity}</span>
                        <span className="text-xs font-mono text-[#8892a4] font-semibold">
                          ₪{p.estimatedPriceILS.toLocaleString('he-IL')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Additional checks ─────────────────────────── */}
              {r.additionalChecks.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-[#4a5270] uppercase tracking-[0.12em] mb-2">
                    בדיקות נוספות בזמן הטיפול
                  </p>
                  <ul className="space-y-1.5">
                    {r.additionalChecks.map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-[#8892a4]">
                        <span className="text-[#4a5270] shrink-0 mt-0.5">›</span>
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ── AI Notes ──────────────────────────────────── */}
              {r.aiNotes && (
                <div className="bg-[#1a1d27] border border-[#252836] rounded-xl px-4 py-3">
                  <p className="text-[10px] font-bold text-[#4a5270] uppercase tracking-[0.12em] mb-1.5">
                    הערות ממנוע ה-AI
                  </p>
                  <p className="text-xs text-[#8892a4] leading-relaxed">{r.aiNotes}</p>
                </div>
              )}

              {/* ── Parts recommendation CTA ───────────────────── */}
              {canEdit && (
                <div className="pt-1 space-y-2">
                  <button
                    onClick={() => { setAiExpanded(false); setShowPartsPanel(true) }}
                    className="w-full flex items-center justify-center gap-2.5 bg-[#6366f1] hover:bg-[#5558e8] text-white font-black text-base py-4 rounded-xl transition-colors active:scale-[0.98] shadow-lg shadow-[#6366f1]/25"
                  >
                    <Package size={16} />
                    {filledSource === 'ai' ? '↺ ערוך בחירת חלקים וספקים' : 'בחר ספקים וצור הצעת מחיר'}
                  </button>
                  {filledSource === 'ai' && (
                    <p className="text-center text-xs text-emerald-500">
                      ✓ חלקים ועבודה מולאו — ערוך לפי הצורך לפני שליחה ללקוח
                    </p>
                  )}
                </div>
              )}

            </div>
          )
        })()}

      </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          PARTS RECOMMENDATION PANEL (shown after AI analysis)
      ════════════════════════════════════════════════════════════ */}
      {showPartsPanel && ai.status === 'done' && (
        <PartsRecommendationPanel
          parts={ai.result.partsRecommended}
          laborHours={ai.result.totalLaborHours}
          laborRate={295}
          onConfirm={fillFromParts}
          onCancel={() => { setShowPartsPanel(false); setAiExpanded(true) }}
        />
      )}

      {/* ════════════════════════════════════════════════════════════
          QUOTE FORM
      ════════════════════════════════════════════════════════════ */}

      {/* Success banner */}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4 flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <div>
            <p className="font-bold text-emerald-700">הצעת המחיר נשלחה ללקוח!</p>
            <p className="text-sm text-emerald-600">הלקוח יוכל לאשר או לדחות דרך הפורטל</p>
          </div>
        </div>
      )}

      {/* Sent state */}
      {isSent && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-5 py-4 flex items-center gap-3">
          <span className="text-2xl">📨</span>
          <p className="font-semibold text-indigo-700">ההצעה נשלחה — ממתין לתגובת הלקוח</p>
        </div>
      )}

      {/* ── Labor ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">שכר עבודה</p>
          {filledSource === 'ai' && (
            <span className="text-[10px] text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
              ✨ מולא מ-AI
            </span>
          )}
          {filledSource === 'schedule' && (
            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              📋 לוח טיפולים
            </span>
          )}
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-slate-500 mb-1 block">שעות</label>
            <input
              type="number" min={0} step={0.5}
              value={laborHours}
              onChange={e => setLaborHours(parseFloat(e.target.value) || 0)}
              disabled={!canEdit}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-slate-500 mb-1 block">תעריף (₪/שעה)</label>
            <input
              type="number" min={0} step={5}
              value={laborRate}
              onChange={e => setLaborRate(parseFloat(e.target.value) || 0)}
              disabled={!canEdit}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-slate-500 mb-1 block">סה&quot;כ</label>
            <div className="border border-slate-100 bg-slate-50 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700">
              {formatCurrency(laborTotal)}
            </div>
          </div>
        </div>

        {/* Labor operations breakdown — shown only for AI-filled (not schedule-filled) */}
        {filledSource === 'ai' && ai.status === 'done' && ai.result.laborOperations.length > 0 && (
          <div className="pt-2 border-t border-slate-50 space-y-1">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1.5">
              פירוט פעולות
            </p>
            {ai.result.laborOperations.map((op, i) => (
              <div key={i} className="flex items-center justify-between text-xs text-slate-500">
                <span>{op.name}</span>
                <span className="font-mono text-slate-400 shrink-0">{op.estimatedHours} שע׳</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Parts table ────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">חלקים ושירותים</p>
            {filledSource === 'ai' && (
              <span className="text-[10px] text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                ✨ מולא מ-AI
              </span>
            )}
            {filledSource === 'schedule' && (
              <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                📋 לוח טיפולים
              </span>
            )}
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              <Plus size={14} />
              הוסף שורה
            </button>
          )}
        </div>

        {items.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-3">
            אין חלקים — לחץ &quot;הוסף שורה&quot; או הפעל AI
          </p>
        )}

        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_60px_80px_80px_32px] gap-2 items-center">
              <input
                type="text"
                value={item.description}
                onChange={e => updateItem(idx, 'description', e.target.value)}
                placeholder="תיאור"
                disabled={!canEdit}
                className="border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-300 disabled:bg-slate-50"
              />
              <input
                type="number" min={1}
                value={item.quantity}
                onChange={e => updateItem(idx, 'quantity', e.target.value)}
                disabled={!canEdit}
                className="border border-slate-200 rounded-lg px-2 py-2 text-xs text-center font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-300 disabled:bg-slate-50"
              />
              <input
                type="number" min={0} step={1}
                value={item.unitPrice}
                onChange={e => updateItem(idx, 'unitPrice', e.target.value)}
                disabled={!canEdit}
                className="border border-slate-200 rounded-lg px-2 py-2 text-xs text-center font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-300 disabled:bg-slate-50"
              />
              <div className="text-xs font-bold text-slate-700 text-center">
                {formatCurrency(item.total)}
              </div>
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="text-slate-300 hover:text-red-400 transition-colors flex items-center justify-center"
                >
                  <Trash2 size={14} />
                </button>
              ) : <div />}
            </div>
          ))}
        </div>

        {items.length > 0 && (
          <div className="grid grid-cols-[1fr_60px_80px_80px_32px] gap-2 text-[10px] text-slate-400">
            <span>תיאור</span>
            <span className="text-center">כמות</span>
            <span className="text-center">מחיר יח׳</span>
            <span className="text-center">סה&quot;כ</span>
            <span />
          </div>
        )}
      </div>

      {/* ── Notes ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">
          הערות ותנאים
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          disabled={!canEdit}
          rows={4}
          placeholder="הערות, תנאים, אחריות..."
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-slate-50"
        />
      </div>

      {/* ── Totals ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
        <div className="flex justify-between text-sm text-slate-500">
          <span>עבודה</span><span className="font-mono">{formatCurrency(laborTotal)}</span>
        </div>
        <div className="flex justify-between text-sm text-slate-500">
          <span>חלקים</span><span className="font-mono">{formatCurrency(partsTotal)}</span>
        </div>
        <div className="flex justify-between text-sm text-slate-500 pt-2 border-t border-slate-100">
          <span>סכום לפני מע&quot;מ</span><span className="font-mono">{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm text-slate-500">
          <span>מע&quot;מ 17%</span><span className="font-mono">{formatCurrency(vat)}</span>
        </div>
        <div className="flex justify-between font-black text-lg text-indigo-600 pt-2 border-t border-slate-100">
          <span>סה&quot;כ כולל מע&quot;מ</span><span>{formatCurrency(total)}</span>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 flex items-start gap-2 mt-2">
          <span className="text-sm shrink-0">⚠️</span>
          <p className="text-xs text-amber-700">
            {data.serviceType === 'PERIODIC_SERVICE'
              ? <><strong>הצעה אוטומטית לפי נתוני רכב וק״מ</strong> — כפוף לאימות לפי קוד מנוע והוראות יצרן.</>
              : <><strong>הצעה אוטומטית — הערכה בלבד.</strong> יש לאשר ולעדכן לפני שליחה ללקוח.</>
            }
          </p>
        </div>
      </div>

      {/* ── Validity ───────────────────────────────────────────── */}
      {canEdit && (
        <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4 flex items-center gap-3">
          <label className="text-sm text-slate-600 shrink-0">תוקף ההצעה:</label>
          <select
            value={validDays}
            onChange={e => setValidDays(parseInt(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-300"
          >
            <option value={7}>7 ימים</option>
            <option value={14}>14 ימים</option>
            <option value={30}>30 ימים</option>
          </select>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Send / cancel ──────────────────────────────────────── */}
      {canEdit && !success && (
        <div className="space-y-3">
          <button
            type="button"
            disabled={pending}
            onClick={handleSend}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white font-black text-base px-6 py-4 rounded-2xl shadow-md shadow-emerald-200 active:scale-[0.98] transition-transform min-h-[60px] disabled:opacity-50"
          >
            {pending ? '...' : '📨 אשר ושלח ללקוח'}
          </button>

          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-green-600 text-white font-bold text-sm px-6 py-3.5 rounded-2xl active:scale-[0.98] transition-transform min-h-[52px]"
            >
              <span className="text-lg">💬</span>
              שלח הודעה בווטסאפ
            </a>
          )}

          {!showCancel ? (
            <button
              type="button"
              onClick={() => setShowCancel(true)}
              className="w-full text-slate-400 text-sm py-2 hover:text-red-500 transition-colors"
            >
              ביטול הבקשה
            </button>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-3">
              <p className="text-sm text-red-700 font-medium text-center">לבטל את בקשת הצעת המחיר?</p>
              <div className="flex gap-2">
                <button
                  onClick={handleCancel}
                  disabled={pending}
                  className="flex-1 bg-red-600 text-white font-bold text-sm px-4 py-2.5 rounded-xl disabled:opacity-50"
                >
                  כן, בטל
                </button>
                <button
                  onClick={() => setShowCancel(false)}
                  className="flex-1 bg-white text-slate-600 font-semibold text-sm px-4 py-2.5 rounded-xl border border-slate-200"
                >
                  חזרה
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* WhatsApp reminder after sent */}
      {isSent && waLink && (
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 bg-green-600 text-white font-bold text-sm px-6 py-4 rounded-2xl active:scale-[0.98] transition-transform min-h-[56px]"
        >
          <span className="text-lg">💬</span>
          שלח תזכורת בווטסאפ
        </a>
      )}

    </div>
  )
}
