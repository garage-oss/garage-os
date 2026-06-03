'use client'

/**
 * PeriodicServicePanel — plate-first periodic service quote.
 *
 * Phases:
 *   plate       → user enters / confirms plate number
 *   looking-up  → /api/vehicle-lookup  (gov.il or any swapped provider)
 *   mileage     → detected vehicle card + mileage input
 *   generating  → /api/periodic-quote
 *   result      → three-section service advisor layout
 *   error       → message + back button
 *
 * No AI involvement. No manual vehicle selection.
 */

import { useState, useEffect, useRef } from 'react'
import { formatCurrency }              from '@/lib/utils'
import {
  CATEGORY_ICONS,
  LABOR_RATE_ILS,
  VAT_RATE,
  groupByPriority,
} from '@/lib/maintenance-schedule'
import type { ScheduleResult, ServiceItem } from '@/lib/maintenance-schedule'
import type { QuoteItemEdit }               from '@/app/actions/quote-request'
import type { PeriodicPortalData }          from '@/lib/periodic-portal'
import {
  Wrench, Gauge, CheckCircle2, AlertTriangle,
  ChevronDown, ChevronUp, Loader2, Info,
  RotateCcw, Plus, X, ShieldAlert, TrendingUp, Search,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Shape returned by /api/vehicle-lookup — mirrors VehicleLookupResult */
interface LookedUpVehicle {
  plate:          string
  make:           string        // "SKODA" — English uppercase, used for schedule matching
  makeHe:         string        // "סקודה"
  model:          string        // "OCTAVIA"
  trim?:          string        // "1.5 TSI", "2.0 GDI"
  year:           number
  fuelType?:      string | null
  engineVolume?:  number | null
  transmission?:  string | null // canonical: "AUTOMATIC"|"MANUAL"|"CVT" — for schedule matching
  gearbox?:       string | null // display: "DSG7", "DCT6", "E-CVT" — shown on vehicle card
  color?:         string | null
}

interface PeriodicQuoteResponse {
  schedule:         ScheduleResult
  usedFuelType:     string | null
  usedTransmission: string | null
  missingFields:    Array<'fuelType' | 'transmission'>
}

export interface PeriodicServicePanelProps {
  initialPlate?:   string    // pre-filled from quote request
  initialMileage?: number    // pre-filled from work order vehicle record
  workOrderId:     string
  canEdit:         boolean
  onConfirm:       (items: QuoteItemEdit[], notes: string, laborHours: number, periodicData: PeriodicPortalData) => void
}

type PanelPhase =
  | { phase: 'plate' }
  | { phase: 'looking-up' }
  | { phase: 'mileage';    vehicle: LookedUpVehicle }
  | { phase: 'generating'; vehicle: LookedUpVehicle }
  | { phase: 'result';     vehicle: LookedUpVehicle; data: PeriodicQuoteResponse }
  | { phase: 'error';      message: string; prevVehicle?: LookedUpVehicle }

// ─── Display maps ─────────────────────────────────────────────────────────────

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

/** English manufacturer names → Hebrew for display */
const MAKE_HE: Record<string, string> = {
  TOYOTA:          'טויוטה',
  KIA:             'קיה',
  HYUNDAI:         'יונדאי',
  SKODA:           'סקודה',
  MAZDA:           'מאזדה',
  NISSAN:          'ניסאן',
  RENAULT:         'רנו',
  SUBARU:          'סובארו',
  FIAT:            'פיאט',
  MERCEDES:        'מרצדס',
  'MERCEDES-BENZ': 'מרצדס',
  DACIA:           'דאציה',
  CITROEN:         'סיטרואן',
  DODGE:           'דודג',
  VOLKSWAGEN:      'פולקסווגן',
  BMW:             'BMW',
  FORD:            'פורד',
  HONDA:           'הונדה',
  MITSUBISHI:      'מיצובישי',
  SEAT:            'סיאט',
  OPEL:            'אופל',
  PEUGEOT:         "פיג׳ו",
  AUDI:            'אאודי',
  VOLVO:           'וולבו',
  SUZUKI:          'סוזוקי',
  CHEVROLET:       'שברולט',
  JEEP:            "ג׳יפ",
  LEXUS:           'לקסוס',
  TESLA:           'טסלה',
  'ALFA ROMEO':    'אלפא רומיאו',
  'ALFA-ROMEO':    'אלפא רומיאו',
  'LAND ROVER':    'לנד רובר',
  MINI:            'MINI',
  PORSCHE:         'פורשה',
  INFINITI:        'אינפיניטי',
  HAVAL:           'האבאל',
  CHERY:           "צ׳רי",
  MG:              'MG',
  CUPRA:           'קופרה',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function r2(n: number) { return Math.round(n * 100) / 100 }

function itemCost(item: ServiceItem): number {
  return r2(item.unitPrice * item.quantity + item.laborHours * LABOR_RATE_ILS)
}

function hebrewMake(make: string): string {
  return MAKE_HE[make.toUpperCase()] ?? make
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

function engineLabel(v: LookedUpVehicle): string {
  if (v.trim) return v.trim
  if (v.engineVolume) return `${(v.engineVolume / 1000).toFixed(1)}L`
  return ''
}

function gearboxLabel(v: LookedUpVehicle): string {
  return v.gearbox ?? (v.transmission ? (TRANS_LABELS[v.transmission] ?? v.transmission) : '') ?? ''
}

/** Client-side preview: estimate which standard interval will be matched for a given km */
const STANDARD_INTERVALS = [15000, 30000, 60000, 90000, 120000]

function predictIntervalLabel(km: number): string {
  const past = STANDARD_INTERVALS.filter(m => m <= km)
  const matched = past.length > 0 ? past[past.length - 1] : STANDARD_INTERVALS[0]
  return `טיפול ${matched.toLocaleString('he-IL')} ק״מ`
}

function formatPlate(raw: string): string {
  const d = raw.replace(/\D/g, '')
  if (d.length === 7) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`
  if (d.length === 8) return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`
  return raw
}

// ─── Vehicle identity card ────────────────────────────────────────────────────

function VehicleCard({
  vehicle,
  onChangePlate,
  compact = false,
}: {
  vehicle: LookedUpVehicle
  onChangePlate: () => void
  compact?: boolean
}) {
  const eng  = engineLabel(vehicle)
  const fuel = vehicle.fuelType ? (FUEL_LABELS[vehicle.fuelType] ?? vehicle.fuelType) : null
  const gear = gearboxLabel(vehicle) || null

  if (compact) {
    return (
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#13161f] border-b border-[#1e2230]">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-sm shrink-0">🚗</span>
          <div className="min-w-0">
            <span className="text-xs font-bold text-[#c5cde2]">
              {hebrewMake(vehicle.make)} {titleCase(vehicle.model)} {vehicle.year}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              {eng  && <span className="text-[10px] text-[#4a5270]">{eng}</span>}
              {fuel && <span className="text-[10px] text-[#4a5270]">· {fuel}</span>}
              {gear && <span className="text-[10px] text-[#4a5270]">· {gear}</span>}
              <span className="text-[10px] text-[#2e3147] font-mono">· {formatPlate(vehicle.plate)}</span>
            </div>
          </div>
        </div>
        <button
          onClick={onChangePlate}
          className="text-[10px] text-[#3a4260] hover:text-[#8892a4] transition-colors shrink-0 mr-1"
        >
          שנה ←
        </button>
      </div>
    )
  }

  return (
    <div className="bg-[#1a1d27] border border-emerald-500/25 rounded-xl px-4 py-3.5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-emerald-500/15 rounded-xl flex items-center justify-center text-lg shrink-0">
          🚗
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-black text-[#e2e8f0] leading-tight">
            {hebrewMake(vehicle.make)} {titleCase(vehicle.model)} {vehicle.year}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {eng && (
              <span className="text-xs font-bold text-[#8892a4] border border-[#2e3147] bg-[#13161f] px-2 py-0.5 rounded-md">
                {eng}
              </span>
            )}
            {gear && (
              <span className="text-xs font-bold text-indigo-400 border border-indigo-500/20 bg-indigo-500/8 px-2 py-0.5 rounded-md">
                {gear}
              </span>
            )}
            {fuel && (
              <span className="text-xs font-bold text-[#8892a4] border border-[#2e3147] bg-[#13161f] px-2 py-0.5 rounded-md">
                {fuel}
              </span>
            )}
            <span className="text-[11px] text-[#3a4260] font-mono border border-[#1e2230] px-2 py-0.5 rounded-md">
              {formatPlate(vehicle.plate)}
            </span>
          </div>
        </div>
        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-full shrink-0 mt-0.5">
          <CheckCircle2 size={9} />
          אומת
        </span>
      </div>
      <button
        onClick={onChangePlate}
        className="mt-2.5 text-[10px] text-[#3a4260] hover:text-[#4a5270] transition-colors"
      >
        ← שנה רכב
      </button>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PeriodicServicePanel({
  initialPlate,
  initialMileage,
  workOrderId: _workOrderId,
  canEdit,
  onConfirm,
}: PeriodicServicePanelProps) {
  // ── Form inputs ─────────────────────────────────────────────────────────────
  const [plate,        setPlate]        = useState(initialPlate ? formatPlate(initialPlate) : '')
  const [mileage,      setMileage]      = useState(initialMileage ? String(initialMileage) : '')
  const [fuelOverride, setFuelOverride] = useState('')   // only when lookup returns no fuelType

  // ── Phase machine ───────────────────────────────────────────────────────────
  const [state,         setState]        = useState<PanelPhase>({ phase: 'plate' })
  const [confirmed,     setConfirmed]    = useState(false)
  const [selectedRec,   setSelectedRec]  = useState<Set<number>>(new Set())
  const [selectedSafe,  setSelectedSafe] = useState<Set<number>>(new Set())
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({})

  // ── Auto-lookup on mount when initialPlate is provided ───────────────────────
  const didAutoLookup = useRef(false)
  useEffect(() => {
    if (!initialPlate || didAutoLookup.current) return
    didAutoLookup.current = true
    const digits = initialPlate.replace(/\D/g, '')
    if (digits.length < 7) return

    setState({ phase: 'looking-up' })
    fetch(`/api/vehicle-lookup?plate=${encodeURIComponent(digits)}`)
      .then(r => r.json())
      .then(json => {
        if (json.found && json.vehicle) {
          setState({ phase: 'mileage', vehicle: json.vehicle as LookedUpVehicle })
        } else {
          setState({ phase: 'plate' }) // plate pre-filled; user can retry manually
        }
      })
      .catch(() => setState({ phase: 'plate' }))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps — run once on mount

  // ── Manual plate lookup ──────────────────────────────────────────────────────
  async function lookupPlate() {
    const digits = plate.replace(/\D/g, '')
    if (digits.length < 7) return

    setState({ phase: 'looking-up' })
    try {
      const res  = await fetch(`/api/vehicle-lookup?plate=${encodeURIComponent(digits)}`)
      const json = await res.json()
      if (!res.ok) {
        setState({ phase: 'error', message: json.error ?? 'שגיאה בחיפוש הרכב' })
        return
      }
      if (!json.found) {
        setState({ phase: 'error', message: 'לא נמצא רכב עם הלוחית הזו — בדוק את המספר' })
        return
      }
      setState({ phase: 'mileage', vehicle: json.vehicle as LookedUpVehicle })
    } catch {
      setState({ phase: 'error', message: 'שגיאת רשת — נסה שוב' })
    }
  }

  // ── Generate quote ──────────────────────────────────────────────────────────
  async function generate() {
    if (state.phase !== 'mileage') return
    const km = parseInt(mileage, 10)
    if (!km || km <= 0) return

    const vehicle = state.vehicle
    const resolvedFuel = vehicle.fuelType || fuelOverride || null
    if (!resolvedFuel) return  // fuel still unknown — selector shown in UI

    setState({ phase: 'generating', vehicle })
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
          vehicleFuelType:     resolvedFuel   || undefined,
          vehicleTransmission: vehicle.transmission || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setState({ phase: 'error', message: json.message ?? 'שגיאה בטעינת לוח הטיפולים', prevVehicle: vehicle })
        return
      }
      setState({ phase: 'result', vehicle, data: json as PeriodicQuoteResponse })
    } catch {
      setState({ phase: 'error', message: 'שגיאת רשת — נסה שוב', prevVehicle: vehicle })
    }
  }

  // ── Fill quote form ─────────────────────────────────────────────────────────
  function handleConfirm() {
    if (state.phase !== 'result') return
    const { data: { schedule }, vehicle } = state
    const groups = groupByPriority(schedule.items)

    const selRecItems  = groups.recommended.filter((_, idx) => selectedRec.has(idx))
    const selSafeItems = groups.safety.filter((_, idx) => selectedSafe.has(idx))
    const allIncluded  = [...groups.required, ...selRecItems, ...selSafeItems]
    const partItems    = allIncluded.filter(i => i.category !== 'INSPECTION')

    const items: QuoteItemEdit[] = partItems.map(i => ({
      description: i.nameHe + (i.notes ? ` — ${i.notes}` : ''),
      quantity:    i.quantity,
      unitPrice:   i.unitPrice,
      total:       r2(i.quantity * i.unitPrice),
    }))

    const totalLaborHours = r2(allIncluded.reduce((s, i) => s + i.laborHours, 0))
    const km = parseInt(mileage, 10)
    const vehicleName = `${hebrewMake(vehicle.make)} ${titleCase(vehicle.model)} ${vehicle.year}`

    const noteLines: string[] = [
      `${schedule.intervalLabel} — ${vehicleName}`,
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
    noteLines.push('', '⚠️ הצעה אוטומטית לפי נתוני רכב וק״מ — כפוף לאימות לפי קוד מנוע והוראות יצרן.')
    if (schedule.scheduleNotes) noteLines.push('', `הערות: ${schedule.scheduleNotes}`)

    const periodicData: PeriodicPortalData = {
      vehicleName:        vehicleName,
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
      initialSafety:      Array.from(selectedSafe),
    }

    onConfirm(items, noteLines.join('\n'), totalLaborHours, periodicData)
    setConfirmed(true)
  }

  // ── Navigation helpers ──────────────────────────────────────────────────────
  function goToMileage() {
    if (state.phase === 'result') {
      setState({ phase: 'mileage', vehicle: state.vehicle })
      setConfirmed(false)
      setSelectedRec(new Set())
      setSelectedSafe(new Set())
      setExpandedNotes({})
    }
  }

  function goToPlate() {
    setState({ phase: 'plate' })
    setConfirmed(false)
    setSelectedRec(new Set())
    setSelectedSafe(new Set())
    setExpandedNotes({})
    setMileage(initialMileage ? String(initialMileage) : '')
    setFuelOverride('')
  }

  // ── Toggle helpers ──────────────────────────────────────────────────────────
  function toggleRec(idx: number) {
    setSelectedRec(prev => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n })
  }
  function toggleSafe(idx: number) {
    setSelectedSafe(prev => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n })
  }
  function toggleNote(key: string) {
    setExpandedNotes(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  const currentVehicle =
    state.phase === 'mileage'    ? state.vehicle :
    state.phase === 'generating' ? state.vehicle :
    state.phase === 'result'     ? state.vehicle :
    null

  return (
    <div className="bg-[#0f1117] border border-[#252836] rounded-2xl overflow-hidden">

      {/* ── Panel header ───────────────────────────────────────────────────── */}
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
            onClick={goToMileage}
            className="flex items-center gap-1 text-xs text-[#4a5270] hover:text-[#8892a4] transition-colors"
          >
            <RotateCcw size={12} />
            עדכן ק״מ
          </button>
        )}
      </div>

      {/* Vehicle identity strip — shown in mileage/generating/result phases */}
      {currentVehicle && state.phase !== 'mileage' && (
        <VehicleCard vehicle={currentVehicle} onChangePlate={goToPlate} compact />
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          PHASE: plate
      ════════════════════════════════════════════════════════════════════════ */}
      {state.phase === 'plate' && (
        <div className="px-5 py-6 space-y-4">
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-bold text-[#8892a4] uppercase tracking-widest">
              <Search size={11} />
              לוחית רישוי
            </label>
            <input
              type="text"
              value={plate}
              onChange={e => setPlate(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && lookupPlate()}
              placeholder="לדוגמה: 123-45-678"
              dir="ltr"
              className="w-full bg-[#1a1d27] border border-[#2e3147] text-[#e2e8f0] rounded-xl px-4 py-3.5 text-base font-mono tracking-widest outline-none text-center focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/15 transition-all placeholder:text-[#2e3147] placeholder:text-sm placeholder:tracking-normal"
              maxLength={10}
            />
          </div>
          <button
            onClick={lookupPlate}
            disabled={plate.replace(/\D/g, '').length < 7}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm py-3.5 rounded-xl transition-colors"
          >
            <Search size={14} />
            זהה רכב לפי לוחית
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          PHASE: looking-up
      ════════════════════════════════════════════════════════════════════════ */}
      {state.phase === 'looking-up' && (
        <div className="px-5 py-10 flex flex-col items-center gap-3">
          <Loader2 size={22} className="text-emerald-400 animate-spin" />
          <p className="text-sm text-[#8892a4]">מחפש ברשומות הרכב...</p>
          <p className="text-xs text-[#2e3147] font-mono">{formatPlate(plate)}</p>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          PHASE: mileage  — detected vehicle card + mileage input
      ════════════════════════════════════════════════════════════════════════ */}
      {state.phase === 'mileage' && (() => {
        const vehicle   = state.vehicle
        const needsFuel = !vehicle.fuelType

        return (
          <div className="px-5 py-5 space-y-5">

            {/* Detected vehicle */}
            <VehicleCard vehicle={vehicle} onChangePlate={goToPlate} />

            {/* Mileage — required */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-bold text-[#c5cde2] uppercase tracking-widest">
                <Gauge size={11} className="text-emerald-400" />
                ק״מ נוכחי
                <span className="text-red-400 font-black">*</span>
              </label>
              <p className="text-[11px] text-[#4a5270] -mt-0.5">
                נדרש לזיהוי אוטומטי של אינטרוול השירות המתאים
              </p>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={mileage}
                  onChange={e => setMileage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !needsFuel && generate()}
                  placeholder="לדוגמה: 60000"
                  className="w-full bg-[#1a1d27] border border-[#2e3147] text-[#e2e8f0] rounded-xl px-4 py-3 text-lg font-mono font-bold outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/15 transition-all placeholder:text-[#2e3147] placeholder:text-sm placeholder:font-normal"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-[#4a5270]">ק״מ</span>
              </div>
              {/* Preview predicted interval as user types */}
              {mileage && parseInt(mileage, 10) > 0 && (
                <p className="text-[11px] text-emerald-400/70 text-left ltr font-mono">
                  יזוהה: {predictIntervalLabel(parseInt(mileage, 10))}
                </p>
              )}
            </div>

            {/* Fuel override — only when lookup returned no fuelType */}
            {needsFuel && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                  <AlertTriangle size={11} />
                  סוג דלק — לא זוהה אוטומטית
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['GASOLINE', 'DIESEL', 'HYBRID', 'ELECTRIC'] as const).map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFuelOverride(f)}
                      className={`py-2.5 rounded-xl text-sm font-bold border transition-all ${
                        fuelOverride === f
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

            {/* CTA */}
            <button
              onClick={generate}
              disabled={!mileage || parseInt(mileage, 10) <= 0 || (needsFuel && !fuelOverride)}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm py-3.5 rounded-xl transition-colors"
            >
              <Wrench size={14} />
              צור הצעת מחיר לטיפול תקופתי
            </button>

            {needsFuel && !fuelOverride && (
              <p className="text-center text-xs text-amber-500/80">בחר סוג דלק כדי להמשיך</p>
            )}
          </div>
        )
      })()}

      {/* ════════════════════════════════════════════════════════════════════════
          PHASE: generating
      ════════════════════════════════════════════════════════════════════════ */}
      {state.phase === 'generating' && (
        <div className="px-5 py-10 flex flex-col items-center gap-3">
          <Loader2 size={22} className="text-emerald-400 animate-spin" />
          <p className="text-sm text-[#8892a4]">מאתר לוח טיפולים מתאים לרכב...</p>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          PHASE: error
      ════════════════════════════════════════════════════════════════════════ */}
      {state.phase === 'error' && (
        <div className="px-5 py-5 space-y-4">
          <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3">
            <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{state.message}</p>
          </div>
          <button
            onClick={() => {
              if (state.prevVehicle) {
                setState({ phase: 'mileage', vehicle: state.prevVehicle })
              } else {
                setState({ phase: 'plate' })
              }
            }}
            className="w-full text-sm text-[#4a5270] hover:text-[#8892a4] transition-colors py-2"
          >
            ← חזרה
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          PHASE: result — three-section service advisor layout
      ════════════════════════════════════════════════════════════════════════ */}
      {state.phase === 'result' && (() => {
        const { schedule, usedFuelType, usedTransmission } = state.data
        const km     = parseInt(mileage, 10)
        const groups = groupByPriority(schedule.items)

        const selRecItems  = groups.recommended.filter((_, idx) => selectedRec.has(idx))
        const selSafeItems = groups.safety.filter((_, idx) => selectedSafe.has(idx))
        const allSelected  = [...selRecItems, ...selSafeItems]

        const additionalParts     = r2(allSelected.reduce((s, i) => s + i.unitPrice * i.quantity, 0))
        const additionalLaborCost = r2(allSelected.reduce((s, i) => s + i.laborHours * LABOR_RATE_ILS, 0))
        const additionalSubtotal  = r2(additionalParts + additionalLaborCost)
        const additionalVat       = r2(additionalSubtotal * VAT_RATE)
        const additionalTotal     = r2(additionalSubtotal + additionalVat)
        const grandSubtotal       = r2(schedule.subtotal + additionalSubtotal)
        const grandVat            = r2(grandSubtotal * VAT_RATE)
        const grandTotal          = r2(grandSubtotal + grandVat)

        return (
          <div className="px-5 pt-4 pb-5 space-y-5">

            {/* ── Interval summary — 3-column card ────────────────────────────── */}
            <div className="bg-[#1a1d27] border border-[#252836] rounded-xl overflow-hidden">
              <div className="grid grid-cols-3 divide-x divide-[#252836] rtl:divide-x-reverse">
                {/* Current mileage */}
                <div className="px-3 py-3 text-center">
                  <p className="text-[9px] font-bold text-[#4a5270] uppercase tracking-widest mb-1.5">ק״מ נוכחי</p>
                  <p className="text-base font-black text-[#c5cde2] tabular-nums leading-tight">
                    {km.toLocaleString('he-IL')}
                  </p>
                </div>
                {/* Matched interval — highlighted */}
                <div className="px-3 py-3 text-center bg-emerald-500/6">
                  <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest mb-1.5">טיפול זוהה</p>
                  <p className="text-base font-black text-emerald-300 tabular-nums leading-tight">
                    {schedule.intervalKm.toLocaleString('he-IL')}
                  </p>
                  {schedule.isGeneric && (
                    <span className="text-[9px] text-amber-400 font-bold">כללי</span>
                  )}
                </div>
                {/* Next interval */}
                <div className="px-3 py-3 text-center">
                  <p className="text-[9px] font-bold text-[#4a5270] uppercase tracking-widest mb-1.5">טיפול הבא</p>
                  {schedule.nextIntervalKm ? (
                    <>
                      <p className="text-base font-black text-[#8892a4] tabular-nums leading-tight">
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
              {/* Footer row — interval label + fuel/trans chips */}
              <div className="px-4 py-2 border-t border-[#252836] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">🔧</span>
                  <p className="text-sm font-black text-[#e2e8f0]">{schedule.intervalLabel}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {usedFuelType && (
                    <span className="text-[10px] text-[#4a5270] bg-[#13161f] border border-[#1e2230] px-2 py-0.5 rounded-md">
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
            </div>

            {/* Match note */}
            {schedule.matchNote && (
              <div className="flex items-start gap-2 bg-amber-500/8 border border-amber-500/20 rounded-xl px-3.5 py-2.5">
                <Info size={13} className="text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300">{schedule.matchNote}</p>
              </div>
            )}

            {/* ── REQUIRED ───────────────────────────────────────────────────── */}
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

            {/* ── RECOMMENDED ────────────────────────────────────────────────── */}
            {groups.recommended.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.12em] flex items-center gap-1.5">
                    💡 מומלץ על ידי יועץ השירות
                  </p>
                  {selectedRec.size > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      <TrendingUp size={9} />
                      +{formatCurrency(r2(selRecItems.reduce((s, i) => s + itemCost(i) * (1 + VAT_RATE), 0)))}
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {groups.recommended.map((item, idx) => (
                    <RecommendedItemRow
                      key={idx}
                      item={item}
                      selected={selectedRec.has(idx)}
                      noteKey={`rec-${idx}`}
                      expanded={!!expandedNotes[`rec-${idx}`]}
                      onToggle={() => toggleRec(idx)}
                      onToggleNote={() => toggleNote(`rec-${idx}`)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── SAFETY ─────────────────────────────────────────────────────── */}
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
                      +{formatCurrency(r2(selSafeItems.reduce((s, i) => s + itemCost(i) * (1 + VAT_RATE), 0)))}
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {groups.safety.map((item, idx) => (
                    <SafetyItemRow
                      key={idx}
                      item={item}
                      selected={selectedSafe.has(idx)}
                      noteKey={`safe-${idx}`}
                      expanded={!!expandedNotes[`safe-${idx}`]}
                      onToggle={() => toggleSafe(idx)}
                      onToggleNote={() => toggleNote(`safe-${idx}`)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── Financial summary ───────────────────────────────────────────── */}
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

            {schedule.scheduleNotes && (
              <div className="bg-[#1a1d27] border border-[#252836] rounded-xl px-4 py-3">
                <p className="text-[10px] font-bold text-[#4a5270] uppercase tracking-[0.12em] mb-1.5">
                  הערות יצרן / טכנאי
                </p>
                <p className="text-xs text-[#8892a4] leading-relaxed">{schedule.scheduleNotes}</p>
              </div>
            )}

            <div className="bg-amber-500/8 border border-amber-500/25 rounded-xl px-4 py-3 flex items-start gap-2.5">
              <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300/90 leading-relaxed">
                <strong className="text-amber-300">הצעה אוטומטית לפי נתוני רכב וק״מ</strong>{' '}
                — כפוף לאימות לפי קוד מנוע והוראות יצרן. יש לאשר לפני שליחה ללקוח.
              </p>
            </div>

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

// ─── Item row sub-components ──────────────────────────────────────────────────

function RequiredItemRow({
  item, noteKey: _noteKey, expanded, onToggleNote,
}: {
  item: ServiceItem; noteKey: string; expanded: boolean; onToggleNote: () => void
}) {
  const icon         = CATEGORY_ICONS[item.category] ?? '🔧'
  const isInspection = item.category === 'INSPECTION'

  return (
    <div className="bg-[#1a1d27] border border-[#252836] rounded-xl">
      <div className="flex items-center gap-3 px-3 py-2.5">
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

function RecommendedItemRow({
  item, selected, noteKey: _noteKey, expanded, onToggle, onToggleNote,
}: {
  item: ServiceItem; selected: boolean; noteKey: string
  expanded: boolean; onToggle: () => void; onToggleNote: () => void
}) {
  const icon = CATEGORY_ICONS[item.category] ?? '🔧'
  const cost = r2(item.unitPrice * item.quantity + item.laborHours * LABOR_RATE_ILS)

  return (
    <div className={`rounded-xl border transition-all ${
      selected ? 'bg-blue-500/8 border-blue-500/30' : 'bg-[#141720] border-[#252836]'
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

function SafetyItemRow({
  item, selected, noteKey: _noteKey, expanded, onToggle, onToggleNote,
}: {
  item: ServiceItem; selected: boolean; noteKey: string
  expanded: boolean; onToggle: () => void; onToggleNote: () => void
}) {
  const icon = CATEGORY_ICONS[item.category] ?? '⚠️'
  const cost = r2(item.unitPrice * item.quantity + item.laborHours * LABOR_RATE_ILS)

  return (
    <div className={`rounded-xl border transition-all ${
      selected ? 'bg-red-500/10 border-red-500/35' : 'bg-[#1a1017] border-red-500/15'
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
