'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, Car, Loader2, CheckCircle, CalendarClock, Mic, MicOff } from 'lucide-react'

interface Vehicle { id: string; plate: string; make: string; model: string; year: number; mileage: number | null }
interface LineItem { description: string; quantity: number; unitPrice: number; laborHours: number; discount: number; itemType: string; total: number; isEstimate?: boolean }

const SERVICE_TYPES = [
  { key: 'periodic', label: 'טיפול תקופתי', emoji: '🔧', desc: 'טיפול שוטף, שמן, פילטרים' },
  { key: 'fault',    label: 'תקלה ברכב',    emoji: '⚠️', desc: 'נורת אזהרה, תקלה כלשהי' },
  { key: 'brakes',   label: 'בלמים',         emoji: '🛑', desc: 'רפידות, דיסקים, נוזל' },
  { key: 'ac',       label: 'מזגן',          emoji: '❄️', desc: 'קירור, חימום, ריח' },
  { key: 'other',    label: 'אחר',           emoji: '📌', desc: 'כל נושא אחר' },
]

function fmtILS(n: number): string {
  return n.toLocaleString('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 0 })
}

function generateSlots(): Date[] {
  const slots: Date[] = []
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 1)
  while (slots.length < 30) {
    const day = d.getDay()
    if (day !== 5 && day !== 6) {
      ;[8, 10, 12, 14, 16].forEach(h => {
        const slot = new Date(d)
        slot.setHours(h, 0, 0, 0)
        slots.push(slot)
      })
    }
    d.setDate(d.getDate() + 1)
    if (slots.length >= 30) break
  }
  return slots.slice(0, 25)
}

// ── Voice input hook ──────────────────────────────────────────────────────────
interface SpeechRec {
  lang: string; continuous: boolean; interimResults: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start(): void; stop(): void
}

function useVoiceInput(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(false)
  const recognitionRef            = useRef<SpeechRec | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const w = window as unknown as Record<string, unknown>
    const Ctor = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as (new () => SpeechRec) | undefined
    if (!Ctor) return
    setSupported(true)
    const r = new Ctor()
    r.lang = 'he-IL'
    r.continuous = false
    r.interimResults = false
    r.onresult = (e) => {
      const text = (e.results[0] as ArrayLike<{ transcript: string }>)[0]?.transcript ?? ''
      if (text) onResult(text)
    }
    r.onend  = () => setListening(false)
    r.onerror = () => setListening(false)
    recognitionRef.current = r
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function toggle() {
    const r = recognitionRef.current
    if (!r) return
    if (listening) { r.stop(); setListening(false) }
    else           { r.start(); setListening(true) }
  }

  return { listening, supported, toggle }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BookServiceFlow({ initialVehicles }: { initialVehicles: Vehicle[] }) {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [step,        setStep]        = useState(1)
  const [vehicles]                    = useState<Vehicle[]>(initialVehicles)
  const [vehicle,     setVehicle]     = useState<Vehicle | null>(
    initialVehicles.find(v => v.id === searchParams.get('vehicleId')) ?? null
  )
  const [serviceType, setServiceType] = useState('')
  const [mileage,     setMileage]     = useState(vehicle?.mileage?.toString() ?? '')
  const [complaint,   setComplaint]   = useState('')

  const [generating,  setGenerating]  = useState(false)
  const [quoteItems,  setQuoteItems]  = useState<LineItem[] | null>(null)
  const [quoteTotals, setQuoteTotals] = useState<{ subtotal: number; vatAmount: number; total: number; isDiagnostic: boolean; laborRate: number } | null>(null)
  const [quoteId,     setQuoteId]     = useState<string | null>(null)
  const [bookingId,   setBookingId]   = useState<string | null>(null)

  const [slots,       setSlots]       = useState<Date[]>([])
  const [chosenSlot,  setChosenSlot]  = useState<Date | null>(null)
  const [booking,     setBooking]     = useState(false)
  const [done,        setDone]        = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  const voice = useVoiceInput(text => setComplaint(prev => prev ? prev + ' ' + text : text))

  useEffect(() => { setSlots(generateSlots()) }, [])
  useEffect(() => {
    if (vehicle && step === 1) setStep(2)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function generateQuote(save = false): Promise<{ ok: boolean; savedQuoteId?: string }> {
    if (!vehicle || !serviceType) return { ok: false }
    setGenerating(true); setError(null)
    try {
      const r    = await fetch('/api/portal/bookings/quote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleId: vehicle.id, serviceType, complaint, mileage: parseInt(mileage) || 0, save, bookingId }),
      })
      const data = await r.json()
      if (!r.ok) { setError(data.error ?? 'שגיאה'); return { ok: false } }
      setQuoteItems(data.items)
      setQuoteTotals({ subtotal: data.subtotal, vatAmount: data.vatAmount, total: data.total, isDiagnostic: data.isDiagnostic, laborRate: data.laborRate })
      if (save && data.quoteId) setQuoteId(data.quoteId)
      if (!save) setStep(4)
      return { ok: true, savedQuoteId: save ? data.quoteId : undefined }
    } catch { setError('שגיאת רשת'); return { ok: false } }
    finally   { setGenerating(false) }
  }

  async function createBooking() {
    const r    = await fetch('/api/portal/bookings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vehicleId: vehicle?.id, serviceType, complaint, mileage: parseInt(mileage) || 0 }),
    })
    const data = await r.json()
    if (r.ok) setBookingId(data.bookingId)
    return data.bookingId as string | undefined
  }

  async function goToStep4() {
    if (!bookingId) await createBooking()
    await generateQuote(false)
  }

  async function confirmBooking() {
    if (!chosenSlot) return
    setBooking(true); setError(null)
    try {
      let qid = quoteId
      if (!qid) {
        const res = await generateQuote(true)
        if (!res.ok) return
        qid = res.savedQuoteId ?? null
      }
      let bid = bookingId
      if (!bid) bid = await createBooking() ?? null
      const r = await fetch('/api/portal/appointments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: bid, vehicleId: vehicle?.id, scheduledAt: chosenSlot.toISOString() }),
      })
      if (r.ok) setDone(true)
      else { const d = await r.json(); setError(d.error ?? 'שגיאה') }
    } catch { setError('שגיאת רשת') }
    finally   { setBooking(false) }
  }

  const totalSteps = 5
  const progress   = (step / totalSteps) * 100

  // ── Done screen ───────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="text-center py-10 px-6 space-y-5">
        <CheckCircle size={56} className="mx-auto text-emerald-500" />
        <div>
          <h2 className="text-2xl font-black text-slate-800">הזמנה אושרה!</h2>
          <p className="text-slate-500 mt-1">התור שלך נקלט ומחכה לאישור סופי מהמוסך.</p>
        </div>
        {chosenSlot && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-5 py-4">
            <p className="font-bold text-emerald-800">
              {chosenSlot.toLocaleDateString('he-IL', { weekday: 'long', day: '2-digit', month: 'long' })}
            </p>
            <p className="text-emerald-600">{chosenSlot.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        )}
        {quoteId && (
          <button onClick={() => router.push(`/portal/quotes/${quoteId}`)}
            className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl text-lg">
            צפה בהצעת המחיר
          </button>
        )}
        <button onClick={() => router.push('/portal')} className="text-indigo-600 font-semibold">
          חזרה לדף הבית ›
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-4" dir="rtl">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span>שלב {step} מתוך {totalSteps}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</div>
      )}

      {/* ── Step 1: Choose vehicle ── */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-black text-slate-800">איזה רכב?</h2>
          {vehicles.length === 0 ? (
            <p className="text-slate-500">אין רכבים רשומים. <a href="/portal/vehicles" className="text-indigo-600">הוסף רכב ›</a></p>
          ) : (
            <div className="space-y-3">
              {vehicles.map(v => (
                <button key={v.id} onClick={() => { setVehicle(v); setMileage(v.mileage?.toString() ?? ''); setStep(2) }}
                  className="w-full flex items-center gap-4 bg-white rounded-2xl shadow-sm border-2 border-slate-100 p-5 active:scale-[0.98] transition-all hover:border-indigo-200">
                  <div className="w-14 h-14 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
                    <Car size={28} className="text-indigo-500" />
                  </div>
                  <div className="flex-1 text-right">
                    <p className="font-black text-slate-800 text-lg">{v.make} {v.model}</p>
                    <p className="text-slate-500">{v.plate}{v.year ? ` · ${v.year}` : ''}</p>
                  </div>
                  <ChevronLeft size={22} className="text-slate-300" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: Service type ── */}
      {step === 2 && (
        <div className="space-y-5">
          <button onClick={() => setStep(1)} className="flex items-center gap-1 text-indigo-600 text-sm">
            <ChevronRight size={16} /> {vehicle?.make} {vehicle?.plate}
          </button>
          <h2 className="text-2xl font-black text-slate-800">מה הנושא?</h2>
          <div className="flex flex-col gap-3">
            {SERVICE_TYPES.map(s => (
              <button key={s.key} onClick={() => { setServiceType(s.key); setStep(3) }}
                className="flex items-center gap-4 bg-white rounded-2xl border-2 border-slate-100 p-5 active:scale-[0.98] transition-all hover:border-indigo-200 text-right">
                <span className="text-4xl shrink-0">{s.emoji}</span>
                <div className="flex-1">
                  <p className="font-black text-slate-800 text-lg leading-tight">{s.label}</p>
                  <p className="text-slate-400 text-sm">{s.desc}</p>
                </div>
                <ChevronLeft size={20} className="text-slate-300 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Step 3: Details (mileage + complaint) ── */}
      {step === 3 && (
        <div className="space-y-5">
          <button onClick={() => setStep(2)} className="flex items-center gap-1 text-indigo-600 text-sm">
            <ChevronRight size={16} /> {SERVICE_TYPES.find(s => s.key === serviceType)?.label}
          </button>
          <h2 className="text-2xl font-black text-slate-800">פרטים נוספים</h2>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-bold text-slate-600 block mb-2">קילומטרז׳ נוכחי</label>
              <input type="number" value={mileage} onChange={e => setMileage(e.target.value)}
                placeholder="לדוג׳ 45000" inputMode="numeric"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-lg text-slate-800 focus:outline-none focus:border-indigo-300 focus:bg-white transition-colors" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-bold text-slate-600">תיאור הבעיה <span className="text-slate-400 font-normal">(אופציונלי)</span></label>
                {voice.supported && (
                  <button onClick={voice.toggle}
                    className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${
                      voice.listening
                        ? 'bg-red-50 border-red-200 text-red-600 animate-pulse'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-indigo-200'
                    }`}>
                    {voice.listening ? <><MicOff size={13} /> מפסיק…</> : <><Mic size={13} /> דיקטציה</>}
                  </button>
                )}
              </div>
              {voice.listening && (
                <div className="flex items-center gap-2 text-red-600 text-xs mb-2 font-semibold">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-ping inline-block" />
                  מאזין… דבר/י עכשיו
                </div>
              )}
              <textarea value={complaint} onChange={e => setComplaint(e.target.value)} rows={4}
                placeholder="תאר/י מה מרגישים ברכב, מתי זה קורה..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:border-indigo-300 focus:bg-white transition-colors resize-none text-base" />
            </div>
          </div>

          <button onClick={goToStep4} disabled={generating}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black text-lg py-5 rounded-2xl shadow-md shadow-indigo-200/50 disabled:opacity-60 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
            {generating ? <><Loader2 size={20} className="animate-spin" /> מייצר הצעה…</> : 'הצג הצעת מחיר →'}
          </button>
        </div>
      )}

      {/* ── Step 4: Quote preview ── */}
      {step === 4 && quoteItems && quoteTotals && (
        <div className="space-y-4">
          <button onClick={() => setStep(3)} className="flex items-center gap-1 text-indigo-600 text-sm">
            <ChevronRight size={16} /> חזרה
          </button>
          <h2 className="text-2xl font-black text-slate-800">הצעת מחיר</h2>

          {quoteTotals.isDiagnostic && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 text-sm text-amber-700">
              <p className="font-semibold">הצעה לאבחון בלבד</p>
              <p className="text-xs mt-0.5">לאחר האבחון נציג הצעה מפורטת לתיקון.</p>
            </div>
          )}

          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="divide-y divide-slate-50">
              {quoteItems.map((item, i) => (
                <div key={i} className="px-5 py-3.5 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm leading-tight">
                      {item.description}
                      {item.isEstimate && <span className="text-amber-500 text-[10px] font-bold mr-1">(הערכה)</span>}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {item.itemType !== 'labor'
                        ? `${item.quantity} × ₪${item.unitPrice}`
                        : `${item.laborHours} שעות × ₪${quoteTotals.laborRate}`}
                    </p>
                  </div>
                  <span className="font-bold text-slate-700 text-sm whitespace-nowrap">{fmtILS(item.total)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 px-5 py-4 space-y-1.5 bg-slate-50/60">
              <div className="flex justify-between text-sm text-slate-500">
                <span>לפני מע״מ</span><span className="font-mono">{fmtILS(quoteTotals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-500">
                <span>מע״מ 17%</span><span className="font-mono">{fmtILS(quoteTotals.vatAmount)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200">
                <span className="font-bold text-slate-800">סה״כ לתשלום</span>
                <span className="font-black text-indigo-600 text-xl">{fmtILS(quoteTotals.total)}</span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 text-center">הצעה בתוקף ל-30 יום · אינה כוללת חלקים שיתגלו בבדיקה</p>

          <button onClick={async () => { const r = await generateQuote(true); if (r.ok) setStep(5) }} disabled={generating}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black text-lg py-5 rounded-2xl shadow-md shadow-indigo-200/50 disabled:opacity-60 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
            {generating ? <Loader2 size={20} className="animate-spin" /> : <>אשר הצעה ובחר תור <ChevronLeft size={20} /></>}
          </button>
        </div>
      )}

      {/* ── Step 5: Choose slot ── */}
      {step === 5 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-black text-slate-800">מתי נוח לך?</h2>
          <div className="space-y-3">
            {Object.entries(
              slots.reduce((acc, slot) => {
                const key = slot.toLocaleDateString('he-IL', { weekday: 'long', day: '2-digit', month: 'long' })
                if (!acc[key]) acc[key] = []
                acc[key].push(slot)
                return acc
              }, {} as Record<string, Date[]>)
            ).map(([dateLabel, daySlots]) => (
              <div key={dateLabel} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <p className="px-4 py-3 text-sm font-bold text-slate-600 bg-slate-50/80 border-b border-slate-100">{dateLabel}</p>
                <div className="flex flex-wrap gap-2 px-4 py-3">
                  {daySlots.map(slot => {
                    const isChosen = chosenSlot?.getTime() === slot.getTime()
                    return (
                      <button key={slot.toISOString()} onClick={() => setChosenSlot(slot)}
                        className={`px-5 py-3 rounded-xl text-base font-bold border-2 transition-all active:scale-95 ${
                          isChosen
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200/50'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-200'
                        }`}>
                        {slot.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          <button onClick={confirmBooking} disabled={!chosenSlot || booking}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg py-5 rounded-2xl shadow-md disabled:opacity-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
            {booking ? <Loader2 size={20} className="animate-spin" /> : <><CalendarClock size={20} /> אשר/י תור</>}
          </button>
        </div>
      )}
    </div>
  )
}
