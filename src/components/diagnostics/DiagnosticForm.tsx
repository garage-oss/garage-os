'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Brain, Loader2, AlertCircle } from 'lucide-react'

type Vehicle = { id: string; make: string; model: string; plate: string; year: number }

interface Props {
  vehicles: Vehicle[]
  defaultVehicleId?: string
  defaultWorkOrderId?: string
  defaultComplaint?: string
}

const COMMON_SYMPTOMS = [
  'נורת בקרת מנוע דולקת', 'רעש חריג', 'רעידות בהגה', 'צריכת דלק גבוהה',
  'קושי בהתנעה', 'אובדן הספק', 'עשן מהתגרית', 'ריח חריג',
  'בלמים רועשים', 'מיזוג לא קר', 'אורות לא תקינים', 'גיר תקוע',
]

export function DiagnosticForm({ vehicles, defaultVehicleId, defaultWorkOrderId, defaultComplaint }: Props) {
  const router = useRouter()
  const [vehicleId, setVehicleId] = useState(defaultVehicleId ?? '')
  const [complaint, setComplaint] = useState(defaultComplaint ?? '')
  const [obdCodes, setObdCodes] = useState('')
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  function toggleSymptom(s: string) {
    setSelectedSymptoms((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!complaint.trim()) { setError('יש להזין תיאור תקלה'); return }
    setError('')
    setIsLoading(true)

    const vehicle = vehicles.find((v) => v.id === vehicleId)
    const vehicleInfo = vehicle ? `${vehicle.make} ${vehicle.model} ${vehicle.year} — ${vehicle.plate}` : undefined

    try {
      const res = await fetch('/api/diagnostics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          complaint,
          obdCodes: obdCodes || null,
          symptoms: selectedSymptoms.length ? selectedSymptoms.join(', ') : null,
          vehicleId: vehicleId || null,
          vehicleInfo,
          workOrderId: defaultWorkOrderId || null,
        }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        router.push(`/dashboard/diagnostics/${data.id}`)
      }
    } catch {
      setError('שגיאת רשת — בדוק חיבור')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      {error && (
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />{error}
        </div>
      )}

      {/* Vehicle */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-[#8892a4] uppercase tracking-wide">פרטי רכב</h2>
        <select
          value={vehicleId}
          onChange={(e) => setVehicleId(e.target.value)}
          className="w-full bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2.5 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#6366f1]"
        >
          <option value="">בחר רכב (אופציונלי)</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>{v.make} {v.model} {v.year} — {v.plate}</option>
          ))}
        </select>
      </div>

      {/* Complaint */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-[#8892a4] uppercase tracking-wide">תלונת לקוח *</h2>
        <textarea
          value={complaint}
          onChange={(e) => setComplaint(e.target.value)}
          required
          rows={4}
          placeholder="תאר את התקלה בפרטים ככל האפשר — מתי זה קורה, כמה זמן, בנסיבות אילו..."
          className="w-full bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2.5 text-sm text-[#e2e8f0] placeholder-[#4a5568] focus:outline-none focus:border-[#6366f1] resize-none"
        />
      </div>

      {/* OBD Codes */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-[#8892a4] uppercase tracking-wide">קודי שגיאה (OBD)</h2>
        <input
          type="text"
          value={obdCodes}
          onChange={(e) => setObdCodes(e.target.value)}
          placeholder="P0300, P0301, P0420... (הפרד בפסיקים)"
          className="w-full bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2.5 text-sm text-[#e2e8f0] placeholder-[#4a5568] focus:outline-none focus:border-[#6366f1] font-mono"
        />
      </div>

      {/* Symptoms */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-[#8892a4] uppercase tracking-wide">תסמינים (סמן הכל שרלוונטי)</h2>
        <div className="grid grid-cols-2 gap-2">
          {COMMON_SYMPTOMS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleSymptom(s)}
              className={`text-start px-3 py-2 rounded-lg text-sm border transition-all ${
                selectedSymptoms.includes(s)
                  ? 'bg-[#6366f1]/15 border-[#6366f1]/40 text-[#6366f1]'
                  : 'bg-[#252836] border-[#2e3147] text-[#8892a4] hover:border-[#6366f1]/30 hover:text-[#e2e8f0]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading || !complaint.trim()}
        className="w-full flex items-center justify-center gap-3 bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-60 text-white font-semibold rounded-xl py-3.5 transition-colors"
      >
        {isLoading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            מנתח עם AI... (עד 30 שניות)
          </>
        ) : (
          <>
            <Brain size={18} />
            הפעל אבחון AI
          </>
        )}
      </button>
    </form>
  )
}
