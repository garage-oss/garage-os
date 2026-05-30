'use client'
/**
 * AiQuoteWizard — full multi-step client component.
 *
 * Steps:
 *  1. form     → plate lookup + complaint + optional photos
 *  2. analyzing→ spinner while Claude processes
 *  3. result   → editable quote table + create draft button
 *  4. done     → success with link to quote
 */

import { useState, useRef, useCallback } from 'react'
import {
  Sparkles, Search, Loader2, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronUp, Plus, Trash2, Car, Wrench,
  Package, TriangleAlert, FileText, ExternalLink,
} from 'lucide-react'
import { createQuoteFromAnalysis } from '@/app/actions/ai-quote'
import type { AiQuoteResult, LaborOperation, PartRecommendation } from '@/lib/ai-quote-engine'
import { formatCurrency } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface VehicleInfo {
  plate:  string
  make:   string
  model:  string
  year:   number
  mileage?: number
  color?: string
}

interface EditableItem {
  id:          string
  type:        'labor' | 'part'
  description: string
  quantity:    number
  unitPrice:   number
}

type Step =
  | { name: 'form' }
  | { name: 'analyzing' }
  | { name: 'result'; analysisId: string; result: AiQuoteResult; items: EditableItem[] }
  | { name: 'done'; quoteId: string; quoteNumber: string; workOrderId: string | null }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const URGENCY_CONFIG = {
  low:      { label: 'רגיל',    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  medium:   { label: 'בינוני',  color: 'text-amber-400   bg-amber-500/10   border-amber-500/30'   },
  high:     { label: 'דחוף',    color: 'text-orange-400  bg-orange-500/10  border-orange-500/30'  },
  critical: { label: 'קריטי!',  color: 'text-red-400     bg-red-500/10     border-red-500/30'     },
}

const PART_CAT_HE: Record<string, string> = {
  brakes: 'בלמים', engine: 'מנוע', suspension: 'מתלים', electrical: 'חשמל',
  ac: 'מזגן', tires: 'צמיגים', fluid: 'נוזלים', filter: 'פילטרים',
  body: 'מרכב', other: 'כללי',
}

function uid() { return Math.random().toString(36).slice(2, 10) }

function buildEditableItems(result: AiQuoteResult, laborRate: number): EditableItem[] {
  const labor: EditableItem[] = result.laborOperations.map(op => ({
    id:          uid(),
    type:        'labor' as const,
    description: `${op.name} (${op.estimatedHours} ש')`,
    quantity:    1,
    unitPrice:   Math.round(op.estimatedHours * laborRate * 100) / 100,
  }))

  const parts: EditableItem[] = result.partsRecommended
    .filter(p => !p.isOptional)
    .map(p => ({
      id:          uid(),
      type:        'part' as const,
      description: p.notes ? `${p.name} — ${p.notes}` : p.name,
      quantity:    p.quantity,
      unitPrice:   p.estimatedPriceILS,
    }))

  return [...labor, ...parts]
}

function calcTotals(items: EditableItem[]) {
  const subtotal  = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const vat       = Math.round(subtotal * 0.17 * 100) / 100
  const total     = Math.round((subtotal + vat) * 100) / 100
  return { subtotal, vat, total }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ConfidenceMeter({ value }: { value: number }) {
  const pct  = Math.round(value * 100)
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-orange-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-[#2e3147] rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-[#e2e8f0] tabular-nums w-9 text-left">{pct}%</span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  workOrders: Array<{ id: string; workOrderNumber: string; vehicle?: { plate: string; make: string; model: string } | null }>
}

export function AiQuoteWizard({ workOrders }: Props) {
  // Form state
  const [complaint,   setComplaint]   = useState('')
  const [plate,       setPlate]       = useState('')
  const [vehicle,     setVehicle]     = useState<VehicleInfo | null>(null)
  const [plateStatus, setPlateStatus] = useState<'idle' | 'loading' | 'found' | 'notfound'>('idle')
  const [linkedWoId,  setLinkedWoId]  = useState('')
  const [photos,      setPhotos]      = useState<string[]>([])
  const [photoInput,  setPhotoInput]  = useState('')
  const [error,       setError]       = useState('')
  const [showOptional, setShowOptional] = useState(false)

  // Step state
  const [step, setStep] = useState<Step>({ name: 'form' })

  // Result editing
  const [items,    setItems]    = useState<EditableItem[]>([])
  const [laborRate, setLaborRate] = useState(295)
  const [notes,    setNotes]    = useState('')
  const [creating, setCreating] = useState(false)

  const plateRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Plate lookup ────────────────────────────────────────────────────────────
  const lookupPlate = useCallback(async (value: string) => {
    const clean = value.replace(/[^0-9]/g, '')
    if (clean.length < 7) { setPlateStatus('idle'); setVehicle(null); return }
    setPlateStatus('loading')
    try {
      const res  = await fetch(`/api/vehicle-lookup?plate=${clean}`)
      const data = await res.json() as { found: boolean; vehicle?: VehicleInfo }
      if (data.found && data.vehicle) {
        setVehicle(data.vehicle)
        setPlateStatus('found')
      } else {
        setVehicle(null)
        setPlateStatus('notfound')
      }
    } catch {
      setPlateStatus('notfound')
    }
  }, [])

  function handlePlateChange(val: string) {
    setPlate(val)
    if (plateRef.current) clearTimeout(plateRef.current)
    plateRef.current = setTimeout(() => lookupPlate(val), 500)
  }

  // ── Photo URL add ──────────────────────────────────────────────────────────
  function addPhotoUrl() {
    const url = photoInput.trim()
    if (!url || photos.includes(url)) return
    setPhotos(prev => [...prev, url])
    setPhotoInput('')
  }

  // ── Analyse ────────────────────────────────────────────────────────────────
  async function handleAnalyze() {
    if (!complaint.trim()) { setError('יש להזין תיאור תקלה'); return }
    setError('')
    setStep({ name: 'analyzing' })

    // If WO is linked, pull vehicle from it
    const linkedWo = workOrders.find(wo => wo.id === linkedWoId)
    const vMake    = vehicle?.make  ?? linkedWo?.vehicle?.make
    const vModel   = vehicle?.model ?? linkedWo?.vehicle?.model
    const vPlate   = vehicle?.plate ?? linkedWo?.vehicle?.plate ?? plate.replace(/[^0-9]/g, '')

    try {
      const res  = await fetch('/api/ai-quote', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          complaintText:   complaint,
          workOrderId:     linkedWoId || undefined,
          vehiclePlate:    vPlate  || undefined,
          vehicleMake:     vMake   || undefined,
          vehicleModel:    vModel  || undefined,
          vehicleYear:     vehicle?.year,
          vehicleMileage:  vehicle?.mileage,
          photoUrls:       photos,
        }),
      })

      const data = await res.json() as {
        analysisId?: string
        result?:     AiQuoteResult
        error?:      string
        message?:    string
      }

      if (!res.ok || data.error) {
        setError(data.message ?? data.error ?? 'שגיאה בניתוח')
        setStep({ name: 'form' })
        return
      }

      const result  = data.result!
      const editItems = buildEditableItems(result, laborRate)
      setItems(editItems)
      setStep({ name: 'result', analysisId: data.analysisId!, result, items: editItems })
    } catch {
      setError('שגיאת רשת — בדוק חיבור')
      setStep({ name: 'form' })
    }
  }

  // ── Item editing ───────────────────────────────────────────────────────────
  function updateItem(id: string, patch: Partial<EditableItem>) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  function addRow() {
    setItems(prev => [...prev, { id: uid(), type: 'part', description: '', quantity: 1, unitPrice: 0 }])
  }

  // ── Create draft ──────────────────────────────────────────────────────────
  async function handleCreateDraft() {
    if (step.name !== 'result') return
    const validItems = items.filter(i => i.description.trim())
    if (!validItems.length) { setError('הוסף לפחות פריט אחד'); return }

    setCreating(true)
    const res = await createQuoteFromAnalysis({
      analysisId:  step.analysisId,
      workOrderId: linkedWoId || undefined,
      items:       validItems.map(i => ({
        description: i.description,
        quantity:    i.quantity,
        unitPrice:   i.unitPrice,
      })),
      laborRate,
      notes: notes || undefined,
    })
    setCreating(false)

    if (!res.ok) {
      setError(res.error)
      return
    }

    setStep({
      name:        'done',
      quoteId:     res.data.quoteId,
      quoteNumber: res.data.quoteNumber,
      workOrderId: res.data.workOrderId ?? null,
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  // ── DONE ──────────────────────────────────────────────────────────────────
  if (step.name === 'done') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-[#1a1d27] border border-emerald-500/30 rounded-2xl p-10 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 flex items-center justify-center mx-auto">
            <CheckCircle2 size={32} className="text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-emerald-400">הצעה נוצרה בהצלחה!</h2>
          <p className="text-[#8892a4]">טיוטת הצעה {step.quoteNumber} מוכנה לעריכה ושליחה</p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <a
              href={`/dashboard/quotes/${step.quoteId}`}
              className="inline-flex items-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] text-white font-semibold rounded-xl px-5 py-3 transition-colors"
            >
              <FileText size={18} />
              פתח הצעה {step.quoteNumber}
            </a>
            {step.workOrderId && (
              <a
                href={`/dashboard/work-orders/${step.workOrderId}`}
                className="inline-flex items-center gap-2 bg-[#252836] border border-[#2e3147] hover:border-[#6366f1]/40 text-[#e2e8f0] font-semibold rounded-xl px-5 py-3 transition-colors"
              >
                <ExternalLink size={16} />
                פקודת עבודה
              </a>
            )}
            <button
              onClick={() => {
                setStep({ name: 'form' })
                setComplaint(''); setPlate(''); setVehicle(null)
                setPlateStatus('idle'); setLinkedWoId(''); setPhotos([])
                setItems([]); setNotes(''); setError('')
              }}
              className="inline-flex items-center gap-2 bg-[#252836] border border-[#2e3147] hover:border-[#6366f1]/40 text-[#e2e8f0] font-semibold rounded-xl px-5 py-3 transition-colors"
            >
              <Sparkles size={16} />
              ניתוח חדש
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── ANALYZING ─────────────────────────────────────────────────────────────
  if (step.name === 'analyzing') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-2xl p-16 text-center space-y-6">
          <div className="relative mx-auto w-20 h-20">
            <div className="absolute inset-0 rounded-full bg-[#6366f1]/20 animate-ping" />
            <div className="relative w-20 h-20 rounded-full bg-[#6366f1]/15 flex items-center justify-center">
              <Sparkles size={36} className="text-[#6366f1] animate-pulse" />
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#e2e8f0]">Claude מנתח את התקלה...</h2>
            <p className="text-[#8892a4] mt-2 text-sm">
              מזהה תקלות אפשריות, מעריך עבודה ומחפש חלקים נדרשים
            </p>
          </div>
          <div className="space-y-2 text-sm text-[#8892a4]">
            {['מנתח תיאור התקלה', 'מזהה פעולות עבודה נדרשות', 'מעריך חלקים ומחירים'].map((t, i) => (
              <div key={i} className="flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin text-[#6366f1]" />
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── RESULT ────────────────────────────────────────────────────────────────
  if (step.name === 'result') {
    const { result } = step
    const urgConf    = URGENCY_CONFIG[result.urgency] ?? URGENCY_CONFIG.medium
    const { subtotal, vat, total } = calcTotals(items)

    return (
      <div className="space-y-5 max-w-3xl">
        {error && <ErrorBanner msg={error} onDismiss={() => setError('')} />}

        {/* Analysis header */}
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-2xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#6366f1]/15 flex items-center justify-center shrink-0">
                <Sparkles size={20} className="text-[#6366f1]" />
              </div>
              <div>
                <p className="text-xs text-[#8892a4] font-medium uppercase tracking-wide mb-0.5">
                  {(vehicle?.plate ?? plate) || 'רכב'}
                  {vehicle?.make ? ` · ${vehicle.make} ${vehicle.model ?? ''}` : ''}
                </p>
                <h2 className="text-base font-bold text-[#e2e8f0]">תוצאות ניתוח AI</h2>
              </div>
            </div>
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg border ${urgConf.color}`}>
              {result.urgency === 'critical' && <TriangleAlert size={12} />}
              {urgConf.label}
            </span>
          </div>

          {/* Safety warning */}
          {result.safetyWarning && (
            <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
              <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-300 font-medium">{result.safetyWarning}</p>
            </div>
          )}

          {/* Diagnosis */}
          <div>
            <p className="text-xs text-[#8892a4] font-semibold uppercase tracking-wide mb-2">אבחון</p>
            <p className="text-[#c5cde2] text-sm leading-relaxed">{result.diagnosis}</p>
          </div>

          {/* Confidence */}
          <div>
            <p className="text-xs text-[#8892a4] mb-1.5">רמת ביטחון</p>
            <ConfidenceMeter value={result.confidence} />
          </div>

          {/* Additional checks */}
          {result.additionalChecks.length > 0 && (
            <div>
              <p className="text-xs text-[#8892a4] font-semibold uppercase tracking-wide mb-2">מומלץ לבדוק גם</p>
              <ul className="space-y-1">
                {result.additionalChecks.map((c, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-[#8892a4]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#6366f1]/60 shrink-0" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.aiNotes && (
            <div className="bg-[#252836] rounded-xl px-4 py-3">
              <p className="text-xs text-[#8892a4] font-semibold mb-1">הערות מומחה</p>
              <p className="text-sm text-[#c5cde2]">{result.aiNotes}</p>
            </div>
          )}
        </div>

        {/* Editable quote items */}
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2e3147] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <FileText size={18} className="text-[#6366f1]" />
              <h3 className="font-semibold text-[#e2e8f0]">פריטי ההצעה</h3>
              <span className="text-xs text-[#8892a4]">(ניתן לעריכה)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#8892a4]">תעריף עבודה</span>
              <input
                type="number"
                value={laborRate}
                onChange={e => {
                  const r = Math.max(0, Number(e.target.value))
                  setLaborRate(r)
                  // Recalculate labor items
                  setItems(prev => prev.map(i =>
                    i.type === 'labor'
                      ? { ...i, unitPrice: Math.round((result.laborOperations.find(
                          op => i.description.startsWith(op.name)
                        )?.estimatedHours ?? 1) * r * 100) / 100 }
                      : i
                  ))
                }}
                className="w-20 bg-[#252836] border border-[#2e3147] rounded-lg px-2 py-1 text-sm text-center text-[#e2e8f0] focus:outline-none focus:border-[#6366f1]"
              />
              <span className="text-xs text-[#8892a4]">₪/ש'</span>
            </div>
          </div>

          {/* Items table */}
          <div className="divide-y divide-[#2e3147]/60">
            {items.map((item, idx) => (
              <div key={item.id} className="flex items-center gap-2 px-4 py-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-[#252836]">
                  {item.type === 'labor'
                    ? <Wrench size={13} className="text-[#6366f1]" />
                    : <Package size={13} className="text-amber-400" />}
                </div>

                <input
                  type="text"
                  value={item.description}
                  onChange={e => updateItem(item.id, { description: e.target.value })}
                  placeholder="תיאור הפריט"
                  className="flex-1 min-w-0 bg-transparent text-sm text-[#e2e8f0] focus:outline-none placeholder:text-[#4a5270]"
                  dir="rtl"
                />

                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={e => updateItem(item.id, { quantity: Math.max(1, Number(e.target.value)) })}
                    className="w-12 bg-[#252836] border border-[#2e3147] rounded px-1.5 py-1 text-xs text-center text-[#e2e8f0] focus:outline-none"
                  />
                  <span className="text-[#4a5270] text-xs">×</span>
                  <input
                    type="number"
                    min={0}
                    step={10}
                    value={item.unitPrice}
                    onChange={e => updateItem(item.id, { unitPrice: Number(e.target.value) })}
                    className="w-20 bg-[#252836] border border-[#2e3147] rounded px-1.5 py-1 text-xs text-center text-[#e2e8f0] focus:outline-none"
                  />
                  <span className="text-[#4a5270] text-xs w-3">₪</span>
                </div>

                <span className="w-20 text-sm font-semibold text-[#e2e8f0] text-left tabular-nums shrink-0">
                  {formatCurrency(item.quantity * item.unitPrice)}
                </span>

                <button
                  onClick={() => removeItem(item.id)}
                  className="p-1.5 rounded hover:bg-red-500/15 text-[#4a5270] hover:text-red-400 transition-colors shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Add row */}
          <div className="px-5 py-3 border-t border-[#2e3147]">
            <button
              onClick={addRow}
              className="flex items-center gap-2 text-sm text-[#6366f1] hover:text-[#818cf8] transition-colors"
            >
              <Plus size={16} />
              הוסף שורה
            </button>
          </div>

          {/* Totals */}
          <div className="px-5 py-4 border-t border-[#2e3147] bg-[#252836]/50 space-y-1.5">
            <div className="flex justify-between text-sm text-[#8892a4]">
              <span>סכום לפני מע&quot;מ</span>
              <span className="tabular-nums">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-[#8892a4]">
              <span>מע&quot;מ 17%</span>
              <span className="tabular-nums">{formatCurrency(vat)}</span>
            </div>
            <div className="flex justify-between text-base font-black text-[#e2e8f0] pt-1 border-t border-[#2e3147]">
              <span>סה&quot;כ לתשלום</span>
              <span className="text-[#6366f1] tabular-nums">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* Work order + notes */}
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-2xl p-5 space-y-4">
          <h3 className="font-semibold text-[#e2e8f0] flex items-center gap-2">
            <Car size={18} className="text-[#6366f1]" />
            שיוך לפקודת עבודה
          </h3>

          <select
            value={linkedWoId}
            onChange={e => setLinkedWoId(e.target.value)}
            className="w-full bg-[#252836] border border-[#2e3147] rounded-xl px-3 py-2.5 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#6366f1]"
          >
            <option value="">ללא שיוך לפ&quot;ע (יצור הצעה עצמאית)</option>
            {workOrders.map(wo => (
              <option key={wo.id} value={wo.id}>
                {wo.workOrderNumber}
                {wo.vehicle ? ` — ${wo.vehicle.make} ${wo.vehicle.model} ${wo.vehicle.plate}` : ''}
              </option>
            ))}
          </select>

          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="הערות נוספות להצעה (אופציונלי)"
            rows={3}
            dir="rtl"
            className="w-full bg-[#252836] border border-[#2e3147] rounded-xl px-3 py-2.5 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#6366f1] resize-none placeholder:text-[#4a5270]"
          />
        </div>

        {/* Create button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleCreateDraft}
            disabled={creating}
            className="flex-1 flex items-center justify-center gap-2.5 bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-60 text-white font-bold rounded-xl px-6 py-4 transition-colors text-base"
          >
            {creating ? <Loader2 size={20} className="animate-spin" /> : <FileText size={20} />}
            {creating ? 'יוצר טיוטה...' : 'צור טיוטת הצעה'}
          </button>
          <button
            onClick={() => setStep({ name: 'form' })}
            className="px-5 py-4 bg-[#252836] border border-[#2e3147] hover:border-[#6366f1]/40 text-[#8892a4] rounded-xl transition-colors text-sm font-medium"
          >
            ↩ חזור
          </button>
        </div>
      </div>
    )
  }

  // ── FORM ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 max-w-2xl">
      {error && <ErrorBanner msg={error} onDismiss={() => setError('')} />}

      {/* Vehicle input */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-[#8892a4] uppercase tracking-wide flex items-center gap-2">
          <Car size={15} />
          פרטי הרכב
        </h2>

        {/* Plate number */}
        <div className="relative">
          <label className="block text-xs text-[#8892a4] mb-1.5">מספר לוחית רישוי</label>
          <div className="relative">
            <input
              type="text"
              value={plate}
              onChange={e => handlePlateChange(e.target.value)}
              placeholder="לדוגמה: 1234567"
              maxLength={9}
              inputMode="numeric"
              className="w-full bg-[#252836] border border-[#2e3147] rounded-xl px-3 py-2.5 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#6366f1] font-mono placeholder:text-[#4a5270]"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              {plateStatus === 'loading' && <Loader2 size={16} className="animate-spin text-[#6366f1]" />}
              {plateStatus === 'found'   && <CheckCircle2 size={16} className="text-emerald-400" />}
              {plateStatus === 'notfound'&& <Search size={16} className="text-[#4a5270]" />}
            </div>
          </div>
        </div>

        {/* Vehicle card */}
        {vehicle && (
          <div className="flex items-center gap-3 bg-[#252836] border border-emerald-500/20 rounded-xl px-4 py-3">
            <Car size={18} className="text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold text-[#e2e8f0]">
                {vehicle.make} {vehicle.model} {vehicle.year}
              </p>
              <p className="text-xs text-[#8892a4] mt-0.5">
                {vehicle.color && `${vehicle.color} · `}
                {vehicle.mileage ? `${vehicle.mileage.toLocaleString('he-IL')} ק"מ` : ''}
              </p>
            </div>
          </div>
        )}
        {plateStatus === 'notfound' && plate.length >= 7 && (
          <p className="text-xs text-amber-400">לוחית לא נמצאה ברישומי ממשלה — ניתן להמשיך ידנית</p>
        )}
      </div>

      {/* Complaint */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-[#8892a4] uppercase tracking-wide flex items-center gap-2">
          <Wrench size={15} />
          תיאור התקלה *
        </h2>
        <textarea
          value={complaint}
          onChange={e => setComplaint(e.target.value)}
          required
          rows={5}
          dir="rtl"
          placeholder="תאר את התקלה בפירוט. לדוגמה: רעש חריג בבלמים הקדמיים בזמן בלימה, הרכב מושך שמאלה, נורת ABS דולקת."
          className="w-full bg-[#252836] border border-[#2e3147] rounded-xl px-3 py-2.5 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#6366f1] resize-none placeholder:text-[#4a5270] leading-relaxed"
        />
        <p className="text-xs text-[#4a5270]">{complaint.length} תווים · ככל שמפורט יותר — הניתוח מדויק יותר</p>
      </div>

      {/* Optional: WO + photos */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowOptional(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-sm text-[#8892a4] hover:text-[#e2e8f0] transition-colors"
        >
          <span className="font-medium">אפשרויות נוספות — שיוך ל״פ + תמונות</span>
          {showOptional ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showOptional && (
          <div className="border-t border-[#2e3147] px-5 py-4 space-y-4">
            {/* Work order selector */}
            <div>
              <label className="block text-xs text-[#8892a4] mb-1.5">שייך לפקודת עבודה קיימת</label>
              <select
                value={linkedWoId}
                onChange={e => setLinkedWoId(e.target.value)}
                className="w-full bg-[#252836] border border-[#2e3147] rounded-xl px-3 py-2.5 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#6366f1]"
              >
                <option value="">בחר פקודת עבודה (אופציונלי)</option>
                {workOrders.map(wo => (
                  <option key={wo.id} value={wo.id}>
                    {wo.workOrderNumber}
                    {wo.vehicle ? ` — ${wo.vehicle.make} ${wo.vehicle.model} ${wo.vehicle.plate}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Photo URLs */}
            <div>
              <label className="block text-xs text-[#8892a4] mb-1.5">תמונות מהרכב (URL)</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={photoInput}
                  onChange={e => setPhotoInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addPhotoUrl())}
                  placeholder="https://... הדבק קישור לתמונה"
                  className="flex-1 bg-[#252836] border border-[#2e3147] rounded-xl px-3 py-2.5 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#6366f1] placeholder:text-[#4a5270]"
                />
                <button
                  type="button"
                  onClick={addPhotoUrl}
                  className="px-4 py-2.5 bg-[#252836] border border-[#2e3147] hover:border-[#6366f1]/60 text-[#8892a4] rounded-xl transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
              {photos.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {photos.map(url => (
                    <div key={url} className="flex items-center gap-1.5 bg-[#252836] rounded-lg px-3 py-1.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="w-6 h-6 rounded object-cover" onError={e => (e.currentTarget.style.display='none')} />
                      <span className="text-xs text-[#8892a4] max-w-[120px] truncate">{url.split('/').pop()}</span>
                      <button onClick={() => setPhotos(p => p.filter(u => u !== url))} className="text-[#4a5270] hover:text-red-400">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Submit */}
      <button
        onClick={handleAnalyze}
        disabled={!complaint.trim()}
        className="w-full flex items-center justify-center gap-3 bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl px-6 py-4 transition-colors text-base"
      >
        <Sparkles size={22} />
        נתח עם AI וצור הצעת מחיר
      </button>
    </div>
  )
}

// ─── Error banner ──────────────────────────────────────────────────────────────
function ErrorBanner({ msg, onDismiss }: { msg: string; onDismiss: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
      <div className="flex items-start gap-2">
        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
        <span>{msg}</span>
      </div>
      <button onClick={onDismiss} className="text-red-500 hover:text-red-300 shrink-0">✕</button>
    </div>
  )
}
