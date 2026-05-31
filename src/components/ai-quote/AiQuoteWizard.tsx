'use client'
/**
 * AiQuoteWizard — multi-step AI quote wizard.
 *
 * Steps: form → analyzing → result → done
 *
 * UX features:
 *  1. Complaint template chips  — 8 categories, 4×2 grid
 *  2. Drag-and-drop photos      — thumbnails, per-file upload progress
 *  3. Plate lookup              — debounced, vehicle card on hit
 *  4. Stats row (result)        — confidence %, labor hours, parts, urgency
 *  5. Editable items table      — labor-rate recalc, add/remove rows
 *  6. Large "Create Quote" CTA  — shadow + active state
 *  7. Mobile-first layout       — responsive at every breakpoint
 */

import { useState, useRef, useCallback } from 'react'
import {
  Sparkles, Loader2, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronUp, Plus, Trash2, Car, Wrench,
  Package, TriangleAlert, FileText, ExternalLink,
  Upload, X, ImageIcon, Clock, Activity, Zap, Search,
} from 'lucide-react'
import { createQuoteFromAnalysis } from '@/app/actions/ai-quote'
import type { AiQuoteResult, LaborOperation } from '@/lib/ai-quote-engine'
import { formatCurrency } from '@/lib/utils'

// ─── Complaint templates ───────────────────────────────────────────────────────

const TEMPLATES = [
  {
    id:    'brakes',
    emoji: '🛑',
    label: 'בלמים',
    text:  'רעידות חזקות בדוושת הבלם ובהגה בזמן בלימה, בעיקר מעל 80 קמ"ש. נורת ABS דולקת לסירוגין. הרכב מושך לצד אחד בבלימה.',
  },
  {
    id:    'battery',
    emoji: '🔋',
    label: 'מצבר',
    text:  'הרכב מתניע בקושי בבוקר — כמה ניסיונות עד שהמנוע עולה. נורת הסוללה מהבהבת בנסיעה. הרכב כובה פתאום פעם אחת.',
  },
  {
    id:    'ac',
    emoji: '❄️',
    label: 'מזגן',
    text:  'המזגן לא מקרר — יוצא אוויר חמים גם בהגדרת קירור מקסימלית. ריח עובש חזק בהפעלה. לפעמים המזגן לא עולה בכלל.',
  },
  {
    id:    'engine_noise',
    emoji: '🔊',
    label: 'רעש מנוע',
    text:  'רעש חריג מהמנוע — דפיקות/נפקאק בעת האצה. הרעש מתגבר עם עלייה בסל"ד ובולט יותר כשהמנוע קר.',
  },
  {
    id:    'warning_light',
    emoji: '⚠️',
    label: 'נורת אזהרה',
    text:  'נורת Check Engine דולקת ברציפות כשבוע. הרכב נוסע תקין לכאורה אבל הנורה לא כבה. לפעמים מורגש חוסר כוח קל.',
  },
  {
    id:    'no_start',
    emoji: '🚫',
    label: 'לא מתניע',
    text:  'הרכב לא מתניע בכלל — לחיצה על כפתור ההנעה מייצרת קליק בודד אך המנוע לא סובב. אורות הלוח דולקים תקין.',
  },
  {
    id:    'suspension',
    emoji: '🔩',
    label: 'מתלים',
    text:  'רעש חזק ("קלוק") מצד שמאל בנסיעה על מהמורות. ההגה מרגיש "רפוי" וחסר דייקנות. הרכב מתנדנד יתר על המידה.',
  },
  {
    id:    'service',
    emoji: '🛢️',
    label: 'טיפול',
    text:  'טיפול תקופתי — החלפת שמן מנוע + פילטרים. נסעו כ-15,000 ק"מ מהטיפול האחרון. בדוק פילטר אוויר ומגבים.',
  },
] as const

type TemplateId = (typeof TEMPLATES)[number]['id']

// ─── Types ─────────────────────────────────────────────────────────────────────

interface VehicleInfo {
  plate:    string
  make:     string
  model:    string
  year:     number
  mileage?: number
  color?:   string
}

interface UploadingPhoto {
  id:      string
  preview: string
  status:  'uploading' | 'done' | 'error'
  url?:    string
  errMsg?: string
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
  | { name: 'result'; analysisId: string; result: AiQuoteResult }
  | { name: 'done'; quoteId: string; quoteNumber: string; workOrderId: string | null }

// ─── Static config ─────────────────────────────────────────────────────────────

const URGENCY = {
  low:      { label: 'רגיל',   color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  medium:   { label: 'בינוני', color: 'text-amber-400   bg-amber-500/10   border-amber-500/30'   },
  high:     { label: 'דחוף',   color: 'text-orange-400  bg-orange-500/10  border-orange-500/30'  },
  critical: { label: 'קריטי!', color: 'text-red-400     bg-red-500/10     border-red-500/30'     },
} as const

// ─── Helpers ───────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 10) }

function buildItems(result: AiQuoteResult, laborRate: number): EditableItem[] {
  return [
    ...result.laborOperations.map(op => ({
      id:          uid(),
      type:        'labor' as const,
      description: `${op.name} (${op.estimatedHours} ש')`,
      quantity:    1,
      unitPrice:   Math.round(op.estimatedHours * laborRate * 100) / 100,
    })),
    ...result.partsRecommended
      .filter(p => !p.isOptional)
      .map(p => ({
        id:          uid(),
        type:        'part' as const,
        description: p.notes ? `${p.name} — ${p.notes}` : p.name,
        quantity:    p.quantity,
        unitPrice:   p.estimatedPriceILS,
      })),
  ]
}

function calcTotals(items: EditableItem[]) {
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const vat      = Math.round(subtotal * 0.17 * 100) / 100
  return { subtotal, vat, total: Math.round((subtotal + vat) * 100) / 100 }
}

// ─── Micro-components ──────────────────────────────────────────────────────────

function ErrorBanner({ msg, onDismiss }: { msg: string; onDismiss: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
      <span className="flex items-start gap-2 leading-relaxed">
        <AlertTriangle size={15} className="mt-0.5 shrink-0" />
        {msg}
      </span>
      <button onClick={onDismiss} className="shrink-0 hover:text-red-300 transition-colors">✕</button>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

interface Props {
  workOrders: Array<{
    id:              string
    workOrderNumber: string
    vehicle?:        { plate: string; make: string; model: string } | null
  }>
}

export function AiQuoteWizard({ workOrders }: Props) {

  // ── Form state ──────────────────────────────────────────────────────────────
  const [complaint,      setComplaint]      = useState('')
  const [activeTemplate, setActiveTemplate] = useState<TemplateId | null>(null)
  const [plate,          setPlate]          = useState('')
  const [vehicle,        setVehicle]        = useState<VehicleInfo | null>(null)
  const [plateStatus,    setPlateStatus]    = useState<'idle' | 'loading' | 'found' | 'notfound'>('idle')
  const [linkedWoId,     setLinkedWoId]     = useState('')
  const [photos,         setPhotos]         = useState<UploadingPhoto[]>([])
  const [dragCount,      setDragCount]      = useState(0)   // avoids false dragleave on child elements
  const [error,          setError]          = useState('')
  const [showOptional,   setShowOptional]   = useState(false)

  // ── Step + result state ─────────────────────────────────────────────────────
  const [step,      setStep]      = useState<Step>({ name: 'form' })
  const [items,     setItems]     = useState<EditableItem[]>([])
  const [laborRate, setLaborRate] = useState(295)
  const [notes,     setNotes]     = useState('')
  const [creating,  setCreating]  = useState(false)

  const plateTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Plate lookup ────────────────────────────────────────────────────────────
  const lookupPlate = useCallback(async (raw: string) => {
    const clean = raw.replace(/\D/g, '')
    if (clean.length < 7) { setPlateStatus('idle'); setVehicle(null); return }
    setPlateStatus('loading')
    try {
      const res  = await fetch(`/api/vehicle-lookup?plate=${clean}`)
      const data = await res.json() as { found: boolean; vehicle?: VehicleInfo }
      if (data.found && data.vehicle) { setVehicle(data.vehicle); setPlateStatus('found')    }
      else                            { setVehicle(null);          setPlateStatus('notfound') }
    } catch { setPlateStatus('notfound') }
  }, [])

  function handlePlateChange(val: string) {
    setPlate(val)
    if (plateTimer.current) clearTimeout(plateTimer.current)
    plateTimer.current = setTimeout(() => lookupPlate(val), 500)
  }

  // ── Template chips ──────────────────────────────────────────────────────────
  function selectTemplate(t: (typeof TEMPLATES)[number]) {
    if (activeTemplate === t.id) { setActiveTemplate(null); setComplaint('') }
    else                         { setActiveTemplate(t.id); setComplaint(t.text) }
  }

  // ── Photo upload ────────────────────────────────────────────────────────────
  async function uploadFile(file: File) {
    if (!file.type.startsWith('image/')) { setError('ניתן להעלות תמונות בלבד'); return }
    if (file.size > 10 * 1024 * 1024)   { setError('תמונה גדולה מדי — מקסימום 10MB'); return }

    const id      = uid()
    const preview = URL.createObjectURL(file)
    setPhotos(prev => [...prev, { id, preview, status: 'uploading' }])

    try {
      const fd = new FormData()
      fd.append('file', file)
      const res  = await fetch('/api/upload/ai-photo', { method: 'POST', body: fd })
      const data = await res.json() as { url?: string; error?: string }

      setPhotos(prev => prev.map(p => p.id !== id ? p :
        res.ok && data.url
          ? { ...p, status: 'done'  as const, url:    data.url      }
          : { ...p, status: 'error' as const, errMsg: data.error ?? 'שגיאה' }
      ))
    } catch {
      setPhotos(prev => prev.map(p => p.id !== id ? p : { ...p, status: 'error' as const, errMsg: 'שגיאת רשת' }))
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files) return
    Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .slice(0, 5 - photos.length)
      .forEach(uploadFile)
  }

  function removePhoto(id: string) {
    setPhotos(prev => {
      const found = prev.find(p => p.id === id)
      if (found) URL.revokeObjectURL(found.preview)
      return prev.filter(p => p.id !== id)
    })
  }

  // ── Analyze ─────────────────────────────────────────────────────────────────
  async function handleAnalyze() {
    if (!complaint.trim())                         { setError('יש להזין תיאור תקלה'); return }
    if (photos.some(p => p.status === 'uploading')){ setError('המתן לסיום העלאת התמונות'); return }
    setError('')
    setStep({ name: 'analyzing' })

    const linkedWo  = workOrders.find(wo => wo.id === linkedWoId)
    const vMake     = vehicle?.make  ?? linkedWo?.vehicle?.make
    const vModel    = vehicle?.model ?? linkedWo?.vehicle?.model
    const vPlate    = vehicle?.plate ?? linkedWo?.vehicle?.plate ?? plate.replace(/\D/g, '')
    const photoUrls = photos.filter(p => p.status === 'done' && p.url).map(p => p.url!)

    try {
      const res  = await fetch('/api/ai-quote', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          complaintText:  complaint,
          workOrderId:    linkedWoId      || undefined,
          vehiclePlate:   vPlate          || undefined,
          vehicleMake:    vMake           || undefined,
          vehicleModel:   vModel          || undefined,
          vehicleYear:    vehicle?.year,
          vehicleMileage: vehicle?.mileage,
          photoUrls,
        }),
      })
      const data = await res.json() as {
        analysisId?: string; result?: AiQuoteResult
        error?: string; message?: string
      }
      if (!res.ok || data.error) {
        setError(data.message ?? data.error ?? 'שגיאה בניתוח')
        setStep({ name: 'form' })
        return
      }
      setItems(buildItems(data.result!, laborRate))
      setStep({ name: 'result', analysisId: data.analysisId!, result: data.result! })
    } catch {
      setError('שגיאת רשת — בדוק חיבור')
      setStep({ name: 'form' })
    }
  }

  // ── Items editing ───────────────────────────────────────────────────────────
  const updateItem = (id: string, patch: Partial<EditableItem>) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))
  const removeItem = (id: string) =>
    setItems(prev => prev.filter(i => i.id !== id))
  const addRow = () =>
    setItems(prev => [...prev, { id: uid(), type: 'part', description: '', quantity: 1, unitPrice: 0 }])

  // ── Create draft ────────────────────────────────────────────────────────────
  async function handleCreateDraft() {
    if (step.name !== 'result') return
    const valid = items.filter(i => i.description.trim())
    if (!valid.length) { setError('הוסף לפחות פריט אחד'); return }
    setCreating(true)
    const res = await createQuoteFromAnalysis({
      analysisId:  step.analysisId,
      workOrderId: linkedWoId || undefined,
      items:       valid.map(i => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
      laborRate,
      notes:       notes || undefined,
    })
    setCreating(false)
    if (!res.ok) { setError(res.error); return }
    setStep({ name: 'done', quoteId: res.data.quoteId, quoteNumber: res.data.quoteNumber, workOrderId: res.data.workOrderId ?? null })
  }

  function resetForm() {
    setComplaint(''); setActiveTemplate(null); setPlate(''); setVehicle(null)
    setPlateStatus('idle'); setLinkedWoId(''); setPhotos([])
    setItems([]); setNotes(''); setError('')
    setStep({ name: 'form' })
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DONE
  // ─────────────────────────────────────────────────────────────────────────────
  if (step.name === 'done') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-[#1a1d27] border border-emerald-500/30 rounded-2xl p-10 text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 flex items-center justify-center mx-auto">
            <CheckCircle2 size={32} className="text-emerald-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-emerald-400">הצעה נוצרה בהצלחה!</h2>
            <p className="text-[#8892a4] mt-1.5">
              טיוטת הצעה{' '}
              <strong className="text-[#e2e8f0]">{step.quoteNumber}</strong>{' '}
              מוכנה לעריכה ושליחה
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <a
              href={`/dashboard/quotes/${step.quoteId}`}
              className="inline-flex items-center justify-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] text-white font-semibold rounded-xl px-5 py-3 transition-colors"
            >
              <FileText size={18} /> פתח הצעה {step.quoteNumber}
            </a>
            {step.workOrderId && (
              <a
                href={`/dashboard/work-orders/${step.workOrderId}`}
                className="inline-flex items-center justify-center gap-2 bg-[#252836] border border-[#2e3147] hover:border-[#6366f1]/40 text-[#e2e8f0] font-semibold rounded-xl px-5 py-3 transition-colors"
              >
                <ExternalLink size={16} /> פקודת עבודה
              </a>
            )}
            <button
              onClick={resetForm}
              className="inline-flex items-center justify-center gap-2 bg-[#252836] border border-[#2e3147] hover:border-[#6366f1]/40 text-[#e2e8f0] font-semibold rounded-xl px-5 py-3 transition-colors"
            >
              <Sparkles size={16} /> ניתוח חדש
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ANALYZING
  // ─────────────────────────────────────────────────────────────────────────────
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
            <p className="text-[#8892a4] mt-2 text-sm">מזהה תקלות, מעריך שעות עבודה ומחיר חלקים</p>
          </div>
          <div className="space-y-2">
            {['מנתח תיאור התקלה', 'מזהה פעולות עבודה נדרשות', 'מעריך חלקים ומחירים שוק'].map((t, i) => (
              <div key={i} className="flex items-center justify-center gap-2 text-sm text-[#8892a4]">
                <Loader2 size={14} className="animate-spin text-[#6366f1]" />
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RESULT
  // ─────────────────────────────────────────────────────────────────────────────
  if (step.name === 'result') {
    const { result } = step
    const urg        = URGENCY[result.urgency as keyof typeof URGENCY] ?? URGENCY.medium
    const { subtotal, vat, total } = calcTotals(items)
    const pct        = Math.round(result.confidence * 100)
    const confColor  = pct >= 80 ? 'text-emerald-400' : pct >= 60 ? 'text-amber-400' : 'text-orange-400'
    const barColor   = pct >= 80 ? 'bg-emerald-500'   : pct >= 60 ? 'bg-amber-500'   : 'bg-orange-500'
    const mandatoryParts = result.partsRecommended.filter(p => !p.isOptional).length
    const optionalParts  = result.partsRecommended.filter(p => p.isOptional).length

    return (
      <div className="space-y-4 max-w-3xl">
        {error && <ErrorBanner msg={error} onDismiss={() => setError('')} />}

        {/* ── Stats row ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

          {/* Confidence */}
          <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-4 space-y-2">
            <p className="text-[10px] font-semibold text-[#8892a4] uppercase tracking-wider flex items-center gap-1">
              <Activity size={10} /> ביטחון
            </p>
            <p className={`text-2xl font-black tabular-nums leading-none ${confColor}`}>{pct}%</p>
            <div className="h-1 bg-[#2e3147] rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* Labor hours */}
          <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-4 space-y-1.5">
            <p className="text-[10px] font-semibold text-[#8892a4] uppercase tracking-wider flex items-center gap-1">
              <Clock size={10} /> שעות עבודה
            </p>
            <p className="text-2xl font-black text-[#e2e8f0] tabular-nums leading-none">
              {result.totalLaborHours % 1 === 0
                ? result.totalLaborHours
                : result.totalLaborHours.toFixed(1)}
              <span className="text-sm font-normal text-[#8892a4]"> ש'</span>
            </p>
            <p className="text-[10px] text-[#8892a4]">{result.laborOperations.length} פעולות</p>
          </div>

          {/* Parts */}
          <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-4 space-y-1.5">
            <p className="text-[10px] font-semibold text-[#8892a4] uppercase tracking-wider flex items-center gap-1">
              <Package size={10} /> חלקים
            </p>
            <p className="text-2xl font-black text-[#e2e8f0] tabular-nums leading-none">
              {mandatoryParts}
              <span className="text-sm font-normal text-[#8892a4]"> נדרשים</span>
            </p>
            {optionalParts > 0 && (
              <p className="text-[10px] text-[#4a5270]">+{optionalParts} אופציונלי</p>
            )}
          </div>

          {/* Urgency */}
          <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-4 space-y-2">
            <p className="text-[10px] font-semibold text-[#8892a4] uppercase tracking-wider flex items-center gap-1">
              <Zap size={10} /> דחיפות
            </p>
            <span className={`inline-flex items-center gap-1.5 text-sm font-bold px-2.5 py-1 rounded-lg border ${urg.color}`}>
              {result.urgency === 'critical' && <TriangleAlert size={12} />}
              {urg.label}
            </span>
          </div>
        </div>

        {/* ── Diagnosis card ───────────────────────────────────────────── */}
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-2xl p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#6366f1]/15 flex items-center justify-center shrink-0">
              <Sparkles size={18} className="text-[#6366f1]" />
            </div>
            <div>
              <p className="text-xs text-[#8892a4] font-medium uppercase tracking-wide mb-0.5">
                {(vehicle?.plate ?? plate) || 'רכב'}
                {vehicle?.make ? ` · ${vehicle.make} ${vehicle.model ?? ''}` : ''}
              </p>
              <h2 className="text-base font-bold text-[#e2e8f0]">תוצאות ניתוח AI</h2>
            </div>
          </div>

          {/* Safety warning */}
          {result.safetyWarning && (
            <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
              <AlertTriangle size={17} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-300 font-medium leading-relaxed">{result.safetyWarning}</p>
            </div>
          )}

          {/* Diagnosis */}
          <div>
            <p className="text-[10px] font-semibold text-[#8892a4] uppercase tracking-wider mb-2">אבחון</p>
            <p className="text-sm text-[#c5cde2] leading-relaxed">{result.diagnosis}</p>
          </div>

          {/* Additional checks */}
          {result.additionalChecks.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-[#8892a4] uppercase tracking-wider mb-2">
                מומלץ לבדוק גם
              </p>
              <ul className="space-y-1.5">
                {result.additionalChecks.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[#8892a4]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#6366f1]/60 shrink-0 mt-1.5" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Expert notes */}
          {result.aiNotes && (
            <div className="bg-[#252836] rounded-xl px-4 py-3">
              <p className="text-[10px] font-semibold text-[#8892a4] uppercase tracking-wider mb-1.5">
                הערות מומחה
              </p>
              <p className="text-sm text-[#c5cde2] leading-relaxed">{result.aiNotes}</p>
            </div>
          )}
        </div>

        {/* ── Editable quote items ──────────────────────────────────────── */}
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-2xl overflow-hidden">

          {/* Table header */}
          <div className="px-5 py-4 border-b border-[#2e3147] flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <FileText size={17} className="text-[#6366f1]" />
              <h3 className="font-semibold text-[#e2e8f0]">פריטי ההצעה</h3>
              <span className="text-xs text-[#4a5270] bg-[#252836] px-2 py-0.5 rounded-full">
                ניתן לעריכה
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <label className="text-xs text-[#8892a4]">תעריף עבודה</label>
              <input
                type="number"
                value={laborRate}
                min={0}
                onChange={e => {
                  const r = Math.max(0, Number(e.target.value))
                  setLaborRate(r)
                  setItems(prev => prev.map(i => {
                    if (i.type !== 'labor') return i
                    const op = result.laborOperations.find(
                      (op: LaborOperation) => i.description.startsWith(op.name)
                    )
                    return { ...i, unitPrice: Math.round((op?.estimatedHours ?? 1) * r * 100) / 100 }
                  }))
                }}
                className="w-20 bg-[#252836] border border-[#2e3147] rounded-lg px-2 py-1.5 text-sm text-center text-[#e2e8f0] focus:outline-none focus:border-[#6366f1] tabular-nums"
              />
              <span className="text-xs text-[#8892a4]">₪/ש'</span>
            </div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-[#2e3147]/50">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-2 px-4 py-2.5 group">
                {/* Icon */}
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-[#252836]">
                  {item.type === 'labor'
                    ? <Wrench  size={12} className="text-[#6366f1]" />
                    : <Package size={12} className="text-amber-400" />}
                </div>

                {/* Description */}
                <input
                  type="text"
                  value={item.description}
                  onChange={e => updateItem(item.id, { description: e.target.value })}
                  placeholder="תיאור הפריט"
                  dir="rtl"
                  className="flex-1 min-w-0 bg-transparent text-sm text-[#e2e8f0] focus:outline-none placeholder:text-[#4a5270]"
                />

                {/* Qty × Price */}
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number" min={1} value={item.quantity}
                    onChange={e => updateItem(item.id, { quantity: Math.max(1, Number(e.target.value)) })}
                    className="w-11 bg-[#252836] border border-[#2e3147] rounded px-1 py-1 text-xs text-center text-[#e2e8f0] focus:outline-none focus:border-[#6366f1] tabular-nums"
                  />
                  <span className="text-[#4a5270] text-xs">×</span>
                  <input
                    type="number" min={0} step={10} value={item.unitPrice}
                    onChange={e => updateItem(item.id, { unitPrice: Number(e.target.value) })}
                    className="w-20 bg-[#252836] border border-[#2e3147] rounded px-1 py-1 text-xs text-center text-[#e2e8f0] focus:outline-none focus:border-[#6366f1] tabular-nums"
                  />
                  <span className="text-[#4a5270] text-xs">₪</span>
                </div>

                {/* Line total */}
                <span className="w-20 text-sm font-semibold text-[#e2e8f0] text-left tabular-nums shrink-0">
                  {formatCurrency(item.quantity * item.unitPrice)}
                </span>

                {/* Remove */}
                <button
                  onClick={() => removeItem(item.id)}
                  className="p-1.5 rounded-lg hover:bg-red-500/15 text-[#4a5270] hover:text-red-400 transition-colors shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          {/* Add row */}
          <div className="px-5 py-3 border-t border-[#2e3147]">
            <button
              onClick={addRow}
              className="flex items-center gap-1.5 text-sm text-[#6366f1] hover:text-[#818cf8] transition-colors"
            >
              <Plus size={15} /> הוסף שורה
            </button>
          </div>

          {/* Totals */}
          <div className="px-5 py-4 border-t border-[#2e3147] bg-[#252836]/40 space-y-1.5">
            <div className="flex justify-between text-sm text-[#8892a4]">
              <span>סכום לפני מע&quot;מ</span>
              <span className="tabular-nums">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-[#8892a4]">
              <span>מע&quot;מ 17%</span>
              <span className="tabular-nums">{formatCurrency(vat)}</span>
            </div>
            <div className="flex justify-between text-lg font-black text-[#e2e8f0] pt-2 border-t border-[#2e3147]">
              <span>סה&quot;כ לתשלום</span>
              <span className="text-[#6366f1] tabular-nums">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* ── WO link + notes ───────────────────────────────────────────── */}
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-[#e2e8f0] flex items-center gap-2">
            <Car size={16} className="text-[#6366f1]" />
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
            rows={2}
            dir="rtl"
            className="w-full bg-[#252836] border border-[#2e3147] rounded-xl px-3 py-2.5 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#6366f1] resize-none placeholder:text-[#4a5270]"
          />
        </div>

        {/* ── Create Quote CTA ──────────────────────────────────────────── */}
        <div className="flex items-stretch gap-3">
          <button
            onClick={handleCreateDraft}
            disabled={creating}
            className="
              flex-1 flex items-center justify-center gap-3
              bg-[#6366f1] hover:bg-[#4f46e5] active:bg-[#4338ca]
              disabled:opacity-60 disabled:cursor-not-allowed
              text-white font-bold rounded-xl px-6 py-4
              text-base transition-colors
              shadow-lg shadow-[#6366f1]/25
            "
          >
            {creating
              ? <><Loader2 size={20} className="animate-spin" />יוצר טיוטה...</>
              : <><FileText size={20} />צור טיוטת הצעה</>
            }
          </button>
          <button
            onClick={() => setStep({ name: 'form' })}
            className="px-5 bg-[#252836] border border-[#2e3147] hover:border-[#6366f1]/40 text-[#8892a4] hover:text-[#e2e8f0] rounded-xl transition-colors text-sm font-medium"
          >
            ↩ חזור
          </button>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FORM
  // ─────────────────────────────────────────────────────────────────────────────
  const isDragging = dragCount > 0

  return (
    <div className="space-y-4 max-w-2xl">
      {error && <ErrorBanner msg={error} onDismiss={() => setError('')} />}

      {/* ── 1. Vehicle lookup ──────────────────────────────────────────── */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-2xl p-5 space-y-3">
        <h2 className="text-xs font-semibold text-[#8892a4] uppercase tracking-wider flex items-center gap-1.5">
          <Car size={13} /> פרטי הרכב
        </h2>

        {/* Plate input */}
        <div className="relative">
          <input
            type="text"
            value={plate}
            onChange={e => handlePlateChange(e.target.value)}
            placeholder="מספר לוחית רישוי — לדוגמה: 1234567"
            maxLength={9}
            inputMode="numeric"
            className="
              w-full bg-[#252836] border border-[#2e3147] rounded-xl
              px-3 py-3 text-sm text-[#e2e8f0] font-mono
              placeholder:text-[#4a5270] placeholder:font-sans
              focus:outline-none focus:border-[#6366f1] transition-colors
            "
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            {plateStatus === 'loading'  && <Loader2     size={15} className="animate-spin text-[#6366f1]" />}
            {plateStatus === 'found'    && <CheckCircle2 size={15} className="text-emerald-400" />}
            {plateStatus === 'notfound' && <Search       size={15} className="text-[#4a5270]" />}
          </div>
        </div>

        {/* Vehicle card */}
        {vehicle && (
          <div className="flex items-center gap-3 bg-emerald-500/5 border border-emerald-500/25 rounded-xl px-4 py-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
              <Car size={17} className="text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-[#e2e8f0] text-sm">
                {vehicle.make} {vehicle.model} {vehicle.year}
              </p>
              <p className="text-xs text-[#8892a4] mt-0.5 truncate">
                {[
                  vehicle.color,
                  vehicle.mileage ? `${vehicle.mileage.toLocaleString('he-IL')} ק"מ` : null,
                ].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
        )}

        {plateStatus === 'notfound' && plate.length >= 7 && (
          <p className="text-xs text-amber-400/80 flex items-center gap-1.5">
            <AlertTriangle size={12} className="shrink-0" />
            לוחית לא נמצאה — ניתן להמשיך ולרשום ידנית
          </p>
        )}
      </div>

      {/* ── 2. Complaint template chips ────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-[#8892a4] uppercase tracking-wider mb-2.5 px-0.5">
          בחר קטגוריית תקלה
        </p>
        <div className="grid grid-cols-4 gap-2">
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => selectTemplate(t)}
              className={`
                flex flex-col items-center gap-1.5 px-1.5 py-2.5 rounded-xl border
                text-xs font-medium transition-all active:scale-95
                ${activeTemplate === t.id
                  ? 'bg-[#6366f1]/15 border-[#6366f1]/60 text-[#a5b4fc] shadow-sm shadow-[#6366f1]/10'
                  : 'bg-[#1a1d27] border-[#2e3147] text-[#8892a4] hover:border-[#6366f1]/40 hover:text-[#c5cde2]'
                }
              `}
            >
              <span className="text-xl leading-none">{t.emoji}</span>
              <span className="leading-tight text-center">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── 3. Complaint textarea ───────────────────────────────────────── */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-2xl p-5 space-y-3">
        <h2 className="text-xs font-semibold text-[#8892a4] uppercase tracking-wider flex items-center gap-1.5">
          <Wrench size={13} />
          תיאור התקלה
          <span className="text-red-400">*</span>
        </h2>
        <textarea
          value={complaint}
          onChange={e => { setComplaint(e.target.value); if (e.target.value !== activeTemplate) setActiveTemplate(null) }}
          rows={4}
          dir="rtl"
          placeholder="תאר את התקלה בפירוט — ככל שמפורט יותר, הניתוח מדויק יותר"
          className="
            w-full bg-[#252836] border border-[#2e3147] rounded-xl
            px-3 py-2.5 text-sm text-[#e2e8f0]
            focus:outline-none focus:border-[#6366f1]
            resize-none placeholder:text-[#4a5270] leading-relaxed
            transition-colors
          "
        />
        <p className="text-xs text-[#4a5270] text-left tabular-nums">{complaint.length} תווים</p>
      </div>

      {/* ── 4. Drag-and-drop photos ─────────────────────────────────────── */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-2xl p-5 space-y-3">
        <h2 className="text-xs font-semibold text-[#8892a4] uppercase tracking-wider flex items-center gap-2">
          <ImageIcon size={13} />
          תמונות מהרכב
          <span className="font-normal normal-case text-[#4a5270]">אופציונלי · עד 5 תמונות</span>
        </h2>

        {/* Drop zone — hidden when 5 photos already uploaded */}
        {photos.length < 5 && (
          <div
            onDragEnter={e => { e.preventDefault(); setDragCount(n => n + 1) }}
            onDragLeave={()  => setDragCount(n => Math.max(0, n - 1))}
            onDragOver={e  => e.preventDefault()}
            onDrop={e => { e.preventDefault(); setDragCount(0); handleFiles(e.dataTransfer.files) }}
            onClick={() => fileInputRef.current?.click()}
            className={`
              flex flex-col items-center justify-center gap-3
              rounded-xl border-2 border-dashed py-8 cursor-pointer
              transition-all
              ${isDragging
                ? 'border-[#6366f1] bg-[#6366f1]/10 scale-[1.01]'
                : 'border-[#2e3147] hover:border-[#6366f1]/50 hover:bg-[#252836]/60'
              }
            `}
          >
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${isDragging ? 'bg-[#6366f1]/25' : 'bg-[#252836]'}`}>
              <Upload size={20} className={isDragging ? 'text-[#6366f1]' : 'text-[#8892a4]'} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-[#c5cde2]">
                {isDragging ? 'שחרר להוספה' : 'גרור תמונות לכאן'}
              </p>
              <p className="text-xs text-[#4a5270] mt-1">
                או לחץ לבחירה · JPG, PNG, WEBP · עד 10MB לתמונה
              </p>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => { handleFiles(e.target.files); e.target.value = '' }}
        />

        {/* Thumbnails */}
        {photos.length > 0 && (
          <div className="flex flex-wrap gap-2.5">
            {photos.map(p => (
              <div
                key={p.id}
                className="relative w-20 h-20 rounded-xl overflow-hidden border border-[#2e3147] group shrink-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.preview} alt="" className="w-full h-full object-cover" />

                {/* Status overlay */}
                {p.status === 'uploading' && (
                  <div className="absolute inset-0 bg-[#0e1117]/65 flex items-center justify-center">
                    <Loader2 size={20} className="animate-spin text-[#6366f1]" />
                  </div>
                )}
                {p.status === 'error' && (
                  <div className="absolute inset-0 bg-red-900/60 flex flex-col items-center justify-center gap-1 p-1">
                    <AlertTriangle size={16} className="text-red-300" />
                    <p className="text-[9px] text-red-300 text-center leading-tight">{p.errMsg}</p>
                  </div>
                )}
                {p.status === 'done' && (
                  <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow">
                    <CheckCircle2 size={11} className="text-white" />
                  </div>
                )}

                {/* Remove button */}
                <button
                  onClick={() => removePhoto(p.id)}
                  className="
                    absolute top-1 left-1 w-5 h-5 rounded-full
                    bg-[#0e1117]/80 text-white flex items-center justify-center
                    opacity-0 group-hover:opacity-100 transition-opacity
                    hover:bg-red-600
                  "
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 5. Optional: WO selector ───────────────────────────────────── */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowOptional(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 text-sm text-[#8892a4] hover:text-[#e2e8f0] transition-colors"
        >
          <span className="font-medium">שיוך לפקודת עבודה קיימת (אופציונלי)</span>
          {showOptional ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
        {showOptional && (
          <div className="border-t border-[#2e3147] px-5 py-4">
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
        )}
      </div>

      {/* ── 6. Submit ───────────────────────────────────────────────────── */}
      <button
        onClick={handleAnalyze}
        disabled={!complaint.trim()}
        className="
          w-full flex items-center justify-center gap-3
          bg-[#6366f1] hover:bg-[#4f46e5] active:bg-[#4338ca]
          disabled:opacity-40 disabled:cursor-not-allowed
          text-white font-bold rounded-xl px-6 py-4
          text-base transition-colors
          shadow-lg shadow-[#6366f1]/25
        "
      >
        <Sparkles size={22} />
        נתח עם AI וצור הצעת מחיר
      </button>
    </div>
  )
}
