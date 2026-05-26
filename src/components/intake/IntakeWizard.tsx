'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, User, Car, MessageSquare, Check, Loader2, ChevronRight, ChevronLeft, X, Phone, Camera, Plus, CheckCircle } from 'lucide-react'
import { SignaturePad } from './SignaturePad'
import { VoiceRecorder } from '@/components/mobile/VoiceRecorder'
import { createWorkOrder } from '@/app/actions/work-orders'
import type { VehicleLookupResult } from '@/lib/vehicle-lookup'
import { FuelType } from '@prisma/client'

interface FoundVehicle {
  id: string; plate: string; make: string; model: string; year: number; color: string | null; mileage: number | null
}
interface FoundCustomer {
  id: string; name: string; phone: string; email: string | null
}
interface SearchResult {
  vehicle:  FoundVehicle | null
  customer: FoundCustomer | null
  matches:  { vehicle: Omit<FoundVehicle, 'color' | 'mileage'>; customer: FoundCustomer }[]
}

interface TechMember {
  name: string
  userId: string
}

interface Props {
  technicians: TechMember[]
  orgTechRate: number
}

type Step = 1 | 2 | 3 | 4 | 5

const STEPS = [
  { n: 1, label: 'חיפוש רכב' },
  { n: 2, label: 'פרטי לקוח' },
  { n: 3, label: 'תלונה' },
  { n: 4, label: 'חתימה' },
  { n: 5, label: 'שיוך' },
]

const INPUT_CLS = 'w-full bg-[#252836] border border-[#2e3147] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#6366f1]'

export function IntakeWizard({ technicians, orgTechRate }: Props) {
  const router  = useRouter()
  const [step,  setStep]  = useState<Step>(1)
  const [error, setError] = useState<string | null>(null)
  const [isPending, start] = useTransition()

  // Step 1: plate search
  const [plateInput,     setPlateInput]     = useState('')
  const [searching,      setSearching]      = useState(false)
  const [searchResult,   setSearchResult]   = useState<SearchResult | null>(null)
  const [createNew,      setCreateNew]      = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Gov API lookup state (step 1 only, for new-vehicle flow)
  const [govLookup, setGovLookup] = useState<VehicleLookupResult | null>(null)
  const [govSearching, setGovSearching] = useState(false)

  // Step 2: customer / vehicle details
  const [customerId,    setCustomerId]    = useState<string | null>(null)
  const [vehicleId,     setVehicleId]     = useState<string | null>(null)
  const [customerName,  setCustomerName]  = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [vehicleMake,   setVehicleMake]   = useState('')
  const [vehicleModel,  setVehicleModel]  = useState('')
  const [vehicleYear,   setVehicleYear]   = useState('')
  const [vehicleFuelType, setVehicleFuelType] = useState<FuelType | ''>('')
  const [vehicleEngine, setVehicleEngine] = useState('')
  const [mileage,       setMileage]       = useState('')
  const [licensePic,    setLicensePic]    = useState<File | null>(null)
  const licenseRef = useRef<HTMLInputElement>(null)

  // Step 3: complaint
  const [complaint,  setComplaint]  = useState('')

  // Step 4: signature
  const [sigDataUrl, setSigDataUrl] = useState<string | null>(null)

  // Step 5: assign + submit
  const [techName,   setTechName]   = useState('')
  const [laborRate,  setLaborRate]  = useState(String(orgTechRate))

  // ── Plate search (DB) ─────────────────────────────────────────────────────

  function handlePlateInput(val: string) {
    setPlateInput(val)
    setGovLookup(null)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (val.length < 2) { setSearchResult(null); return }
    setSearching(true)
    searchTimer.current = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/vehicles/search?plate=${encodeURIComponent(val)}`)
        const data = await res.json() as SearchResult
        setSearchResult(data)

        // If not found in our DB and plate has 7-8 digits → try gov API
        if (!data.vehicle && !data.matches.length) {
          const digits = val.replace(/\D/g, '')
          if (digits.length >= 7) {
            triggerGovLookup(val)
          }
        }
      } finally {
        setSearching(false)
      }
    }, 350)
  }

  async function triggerGovLookup(plate: string) {
    setGovSearching(true)
    try {
      const res  = await fetch(`/api/vehicle-lookup?plate=${encodeURIComponent(plate)}`)
      const json = await res.json()
      if (json.found) {
        setGovLookup(json.vehicle as VehicleLookupResult)
      }
    } catch {
      // silently ignore — user can still fill manually
    } finally {
      setGovSearching(false)
    }
  }

  function applyGovLookup() {
    if (!govLookup) return
    if (govLookup.make)  setVehicleMake(govLookup.make)
    if (govLookup.model) setVehicleModel(govLookup.model)
    if (govLookup.year)  setVehicleYear(String(govLookup.year))
    if (govLookup.fuelType) setVehicleFuelType(govLookup.fuelType)
    if (govLookup.engineVolume) {
      const litres = (govLookup.engineVolume / 1000).toFixed(1)
      setVehicleEngine(`${litres}L`)
    }
  }

  function selectVehicle(v: FoundVehicle, c: FoundCustomer) {
    setCustomerId(c.id)
    setVehicleId(v.id)
    setCustomerName(c.name)
    setCustomerPhone(c.phone)
    setVehicleMake(v.make)
    setVehicleModel(v.model)
    setVehicleYear(String(v.year))
    setMileage(v.mileage ? String(v.mileage) : '')
    setPlateInput(v.plate)
    setCreateNew(false)
    setSearchResult(null)
    setGovLookup(null)
    setStep(2)
  }

  function startNewVehicle() {
    setCustomerId(null)
    setVehicleId(null)
    setCustomerName('')
    setCustomerPhone('')
    setCreateNew(true)
    setSearchResult(null)

    // Apply gov lookup if available
    if (govLookup) {
      setVehicleMake(govLookup.make  ?? '')
      setVehicleModel(govLookup.model ?? '')
      setVehicleYear(govLookup.year  ? String(govLookup.year) : String(new Date().getFullYear()))
      setVehicleFuelType(govLookup.fuelType ?? '')
      if (govLookup.engineVolume) {
        setVehicleEngine(`${(govLookup.engineVolume / 1000).toFixed(1)}L`)
      }
    } else {
      setVehicleMake('')
      setVehicleModel('')
      setVehicleYear(String(new Date().getFullYear()))
      setVehicleFuelType('')
      setVehicleEngine('')
    }
    setMileage('')
    setStep(2)
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setError(null)
    start(async () => {
      let finalCustomerId = customerId
      let finalVehicleId  = vehicleId

      if (!finalCustomerId || !finalVehicleId) {
        try {
          const newCust = await fetch('/api/intake/customer', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ name: customerName, phone: customerPhone }),
          })
          if (!newCust.ok) { setError('שגיאה ביצירת לקוח'); return }
          const custData = await newCust.json() as { id: string }
          finalCustomerId = custData.id

          const newVeh = await fetch('/api/intake/vehicle', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              customerId: finalCustomerId,
              plate:      plateInput,
              make:       vehicleMake,
              model:      vehicleModel,
              year:       parseInt(vehicleYear) || new Date().getFullYear(),
              mileage:    mileage ? parseInt(mileage) : undefined,
              fuelType:   vehicleFuelType || undefined,
              engine:     vehicleEngine   || undefined,
            }),
          })
          if (!newVeh.ok) { setError('שגיאה ביצירת רכב'); return }
          const vehData = await newVeh.json() as { id: string }
          finalVehicleId = vehData.id
        } catch {
          setError('שגיאה ביצירת לקוח / רכב')
          return
        }
      }

      const fd = new FormData()
      fd.set('customerId',         finalCustomerId!)
      fd.set('vehicleId',          finalVehicleId!)
      fd.set('complaint',          complaint.trim())
      fd.set('assignedTechnician', techName)
      fd.set('laborRate',          laborRate)
      if (mileage) fd.set('mileage', mileage)

      const res = await createWorkOrder(fd)
      if ('error' in res) { setError(res.error); return }

      if (sigDataUrl && res.id) {
        await fetch('/api/intake/signature', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ workOrderId: res.id, dataUrl: sigDataUrl }),
        }).catch(() => {})
      }

      router.push(`/dashboard/work-orders/${res.id}`)
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-[#8892a4]">
          {STEPS.map((s) => (
            <span key={s.n} className={`font-medium transition-colors ${step >= s.n ? 'text-white' : ''} ${step === s.n ? 'text-[#6366f1] font-bold' : ''}`}>
              {s.n === step ? s.label : s.n < step ? '✓' : `${s.n}`}
            </span>
          ))}
        </div>
        <div className="h-1.5 bg-[#2e3147] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#6366f1] rounded-full transition-all duration-300"
            style={{ width: `${((step - 1) / 4) * 100}%` }}
          />
        </div>
      </div>

      {/* ── Step 1: Plate Search ── */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold">חיפוש לפי לוחית רישוי</h2>
          <div className="relative">
            <Search size={16} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-[#8892a4]" />
            <input
              type="text"
              value={plateInput}
              onChange={(e) => handlePlateInput(e.target.value.toUpperCase())}
              placeholder="הזן מספר רישוי..."
              className="w-full bg-[#1a1d27] border border-[#2e3147] rounded-xl ps-10 pe-4 py-3.5 text-lg font-mono font-bold tracking-widest focus:outline-none focus:border-[#6366f1] placeholder-[#8892a4] uppercase"
              autoFocus
            />
            {(searching || govSearching) && (
              <Loader2 size={16} className="absolute end-3.5 top-1/2 -translate-y-1/2 animate-spin text-[#8892a4]" />
            )}
          </div>

          {/* Gov API result banner */}
          {govLookup && !searchResult?.vehicle && (
            <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <CheckCircle size={15} className="text-emerald-400 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-white">
                    {govLookup.make} {govLookup.model} {govLookup.year}
                  </p>
                  {govLookup.trim && (
                    <p className="text-xs text-[#8892a4]">{govLookup.trim}</p>
                  )}
                </div>
              </div>
              <span className="text-xs text-emerald-400 font-medium">מרשם הרכב</span>
            </div>
          )}

          {/* DB Search results */}
          {searchResult && (
            <div className="space-y-2">
              {searchResult.vehicle && searchResult.customer && (
                <button
                  onClick={() => selectVehicle(searchResult.vehicle!, searchResult.customer!)}
                  className="w-full bg-[#1a1d27] border border-[#6366f1]/40 rounded-xl p-4 text-start hover:border-[#6366f1] transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-mono font-bold text-[#6366f1] text-lg">{searchResult.vehicle.plate}</div>
                      <div className="text-sm text-white mt-0.5">{searchResult.vehicle.year} {searchResult.vehicle.make} {searchResult.vehicle.model}</div>
                      <div className="flex items-center gap-1.5 mt-2 text-sm text-[#8892a4]">
                        <User size={13} />{searchResult.customer.name}
                        <Phone size={11} className="ms-1" />{searchResult.customer.phone}
                      </div>
                    </div>
                    <ChevronLeft size={18} className="text-[#6366f1] mt-1" />
                  </div>
                </button>
              )}
              {searchResult.matches.map((m) => (
                <button
                  key={m.vehicle.id}
                  onClick={() => selectVehicle({ ...m.vehicle, color: null, mileage: null }, m.customer)}
                  className="w-full bg-[#1a1d27] border border-[#2e3147] rounded-xl p-4 text-start hover:border-[#3e4157] transition-colors"
                >
                  <div className="font-mono font-bold text-sm">{m.vehicle.plate}</div>
                  <div className="text-xs text-[#8892a4] mt-0.5">{m.vehicle.year} {m.vehicle.make} {m.vehicle.model} — {m.customer.name}</div>
                </button>
              ))}
              {!searchResult.vehicle && !searchResult.matches.length && !govLookup && (
                <div className="text-sm text-[#8892a4] text-center py-2">לוחית רישוי לא נמצאה</div>
              )}
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[#2e3147]" />
            <span className="text-xs text-[#8892a4]">או</span>
            <div className="flex-1 h-px bg-[#2e3147]" />
          </div>
          <button
            onClick={startNewVehicle}
            className="w-full flex items-center justify-center gap-2 bg-[#1a1d27] hover:bg-[#252836] border border-[#2e3147] text-sm text-white py-3 rounded-xl transition-colors"
          >
            <Plus size={16} className="text-[#6366f1]" />
            {govLookup ? `הוסף: ${govLookup.make} ${govLookup.model}` : 'לקוח / רכב חדש'}
          </button>
        </div>
      )}

      {/* ── Step 2: Customer / Vehicle ── */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold">פרטי לקוח ורכב</h2>

          <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#8892a4] mb-1">
              <User size={14} />לקוח
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#8892a4] mb-1 block">שם מלא *</label>
                <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="ישראל ישראלי" className={INPUT_CLS} readOnly={!!customerId} />
              </div>
              <div>
                <label className="text-xs text-[#8892a4] mb-1 block">טלפון *</label>
                <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="050-0000000" type="tel" className={INPUT_CLS} readOnly={!!customerId} />
              </div>
            </div>
          </div>

          <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#8892a4]">
                <Car size={14} />רכב
              </div>
              {/* Show "filled from registry" badge when gov lookup was applied */}
              {govLookup && !vehicleId && (
                <span className="flex items-center gap-1 text-xs text-emerald-400">
                  <CheckCircle size={11} />מרשם רכב
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-[#8892a4] mb-1 block">לוחית רישוי *</label>
                <input
                  value={plateInput}
                  onChange={(e) => setPlateInput(e.target.value.toUpperCase())}
                  className={`${INPUT_CLS} font-mono font-bold tracking-widest uppercase`}
                  readOnly={!!vehicleId}
                />
              </div>
              <div>
                <label className="text-xs text-[#8892a4] mb-1 block">יצרן</label>
                <input value={vehicleMake} onChange={(e) => setVehicleMake(e.target.value)} placeholder="Toyota" className={INPUT_CLS} readOnly={!!vehicleId} />
              </div>
              <div>
                <label className="text-xs text-[#8892a4] mb-1 block">דגם</label>
                <input value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} placeholder="Corolla" className={INPUT_CLS} readOnly={!!vehicleId} />
              </div>
              <div>
                <label className="text-xs text-[#8892a4] mb-1 block">שנה</label>
                <input value={vehicleYear} onChange={(e) => setVehicleYear(e.target.value)} type="number" min="1990" max="2030" className={INPUT_CLS} readOnly={!!vehicleId} />
              </div>
              <div>
                <label className="text-xs text-[#8892a4] mb-1 block">קילומטראז׳</label>
                <input value={mileage} onChange={(e) => setMileage(e.target.value)} type="number" placeholder="85000" className={INPUT_CLS} />
              </div>
              {/* Engine + fuel type — shown for new vehicles */}
              {!vehicleId && (
                <>
                  <div>
                    <label className="text-xs text-[#8892a4] mb-1 block">מנוע</label>
                    <input value={vehicleEngine} onChange={(e) => setVehicleEngine(e.target.value)} placeholder="2.0L" className={INPUT_CLS} />
                  </div>
                  <div>
                    <label className="text-xs text-[#8892a4] mb-1 block">סוג דלק</label>
                    <select value={vehicleFuelType} onChange={(e) => setVehicleFuelType(e.target.value as FuelType | '')} className={INPUT_CLS}>
                      <option value="">בחר...</option>
                      <option value="GASOLINE">בנזין</option>
                      <option value="DIESEL">דיזל</option>
                      <option value="HYBRID">היברידי</option>
                      <option value="ELECTRIC">חשמל</option>
                      <option value="LPG">גז</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* License plate photo */}
            <div>
              <label className="text-xs text-[#8892a4] mb-1.5 block">צילום לוחית (אופציונלי)</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => licenseRef.current?.click()}
                  className="flex items-center gap-2 bg-[#252836] hover:bg-[#2e3147] border border-[#2e3147] text-xs text-white px-3 py-2 rounded-lg transition-colors"
                >
                  <Camera size={13} />
                  {licensePic ? licensePic.name : 'צלם לוחית'}
                </button>
                {licensePic && (
                  <button onClick={() => setLicensePic(null)} className="text-[#8892a4] hover:text-red-400">
                    <X size={14} />
                  </button>
                )}
              </div>
              <input ref={licenseRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setLicensePic(e.target.files?.[0] ?? null)} />
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="flex items-center gap-1.5 text-sm text-[#8892a4] hover:text-white py-3 px-4 rounded-xl border border-[#2e3147] transition-colors">
              <ChevronRight size={16} />חזור
            </button>
            <button
              onClick={() => {
                if (!customerName.trim() || !customerPhone.trim() || !plateInput.trim()) { setError('יש למלא שם, טלפון ולוחית'); return }
                setError(null); setStep(3)
              }}
              className="flex-1 flex items-center justify-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] text-white font-semibold py-3 rounded-xl text-sm transition-colors"
            >
              המשך <ChevronLeft size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Complaint ── */}
      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold">תלונת לקוח</h2>
          <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#8892a4] mb-1">
              <MessageSquare size={14} />תיאור הבעיה
            </div>
            <textarea
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              placeholder="תאר את הבעיה המדווחת על ידי הלקוח..."
              rows={4}
              className="w-full bg-[#252836] border border-[#2e3147] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#8892a4] focus:outline-none focus:border-[#6366f1] resize-none"
              autoFocus
            />
            <div className="flex items-center gap-3">
              <VoiceRecorder onTranscript={(t) => setComplaint((prev) => prev ? `${prev}\n${t}` : t)} />
              <span className="text-xs text-[#8892a4]">הקלט קול → תיאור יתווסף אוטומטית</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="flex items-center gap-1.5 text-sm text-[#8892a4] hover:text-white py-3 px-4 rounded-xl border border-[#2e3147] transition-colors">
              <ChevronRight size={16} />חזור
            </button>
            <button
              onClick={() => { if (!complaint.trim()) { setError('יש להזין תלונה'); return }; setError(null); setStep(4) }}
              className="flex-1 flex items-center justify-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] text-white font-semibold py-3 rounded-xl text-sm transition-colors"
            >
              המשך <ChevronLeft size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Signature ── */}
      {step === 4 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold">חתימת לקוח</h2>
          <p className="text-sm text-[#8892a4]">הלקוח מאשר בחתימתו את הכנסת הרכב לטיפול.</p>
          <SignaturePad onCapture={setSigDataUrl} />
          <div className="flex gap-3">
            <button onClick={() => setStep(3)} className="flex items-center gap-1.5 text-sm text-[#8892a4] hover:text-white py-3 px-4 rounded-xl border border-[#2e3147] transition-colors">
              <ChevronRight size={16} />חזור
            </button>
            <button
              onClick={() => { setError(null); setStep(5) }}
              className="flex-1 flex items-center justify-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] text-white font-semibold py-3 rounded-xl text-sm transition-colors"
            >
              {sigDataUrl ? 'המשך' : 'דלג על חתימה'} <ChevronLeft size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 5: Assign + Submit ── */}
      {step === 5 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold">שיוך טכנאי ופתיחה</h2>

          <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-4 space-y-3">
            <div>
              <label className="text-xs text-[#8892a4] mb-1.5 block">טכנאי אחראי</label>
              <select
                value={techName}
                onChange={(e) => setTechName(e.target.value)}
                className="w-full bg-[#252836] border border-[#2e3147] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#6366f1]"
              >
                <option value="">— לא שויך —</option>
                {technicians.map((t) => (
                  <option key={t.userId} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#8892a4] mb-1.5 block">תעריף עבודה לשעה (₪)</label>
              <input
                type="number"
                value={laborRate}
                onChange={(e) => setLaborRate(e.target.value)}
                min="0"
                className="w-full bg-[#252836] border border-[#2e3147] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#6366f1]"
              />
            </div>
          </div>

          {/* Summary */}
          <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-4 space-y-2 text-sm">
            <div className="text-xs font-semibold text-[#8892a4] uppercase tracking-wide mb-2">סיכום קבלה</div>
            <div className="flex justify-between"><span className="text-[#8892a4]">לוחית</span><span className="font-mono font-bold">{plateInput}</span></div>
            <div className="flex justify-between"><span className="text-[#8892a4]">רכב</span><span>{vehicleMake} {vehicleModel} {vehicleYear}</span></div>
            <div className="flex justify-between"><span className="text-[#8892a4]">לקוח</span><span>{customerName}</span></div>
            <div className="flex justify-between truncate"><span className="text-[#8892a4]">תלונה</span><span className="truncate ms-2 max-w-[200px]">{complaint.slice(0, 40)}{complaint.length > 40 ? '…' : ''}</span></div>
            {sigDataUrl && <div className="flex justify-between"><span className="text-[#8892a4]">חתימה</span><span className="text-emerald-400">✓ צולם</span></div>}
          </div>

          {error && <p className="text-sm text-red-400 text-center">{error}</p>}

          <div className="flex gap-3">
            <button onClick={() => setStep(4)} className="flex items-center gap-1.5 text-sm text-[#8892a4] hover:text-white py-3 px-4 rounded-xl border border-[#2e3147] transition-colors">
              <ChevronRight size={16} />חזור
            </button>
            <button
              onClick={handleSubmit}
              disabled={isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-colors"
            >
              {isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              פתח פקודת עבודה
            </button>
          </div>
        </div>
      )}

      {/* Global error */}
      {error && step !== 5 && (
        <p className="text-sm text-red-400 text-center bg-red-500/10 border border-red-500/20 rounded-xl py-2">{error}</p>
      )}
    </div>
  )
}
