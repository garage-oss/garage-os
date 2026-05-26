'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Search, CheckCircle } from 'lucide-react'
import { createWorkOrder, updateWorkOrder } from '@/app/actions/work-orders'
import type { VehicleLookupResult } from '@/lib/vehicle-lookup'

interface Customer { id: string; name: string; phone: string }
interface Vehicle { id: string; plate: string; make: string; model: string; year: number; customerId: string }

interface WorkOrderData {
  id: string
  customerId: string
  vehicleId: string
  complaint: string | null
  diagnosis: string | null
  assignedTechnician: string | null
  laborHours: number
  laborRate: number
  mileage: number | null
  notes: string | null
}

interface Props {
  customers: Customer[]
  vehicles: Vehicle[]
  mode?: 'create' | 'edit'
  workOrder?: WorkOrderData
}

const INPUT =
  'w-full bg-[#252836] border border-[#2e3147] text-[#e2e8f0] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/20 transition-all placeholder:text-[#8892a4]/60'

const LABEL = 'block text-xs font-medium text-muted mb-1.5 uppercase tracking-wide'

export function WorkOrderForm({ customers, vehicles, mode = 'create', workOrder }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState(workOrder?.customerId ?? '')
  const [selectedVehicleId,  setSelectedVehicleId]  = useState(workOrder?.vehicleId  ?? '')
  const [laborHours, setLaborHours] = useState(workOrder?.laborHours ?? 0)
  const [laborRate,  setLaborRate]  = useState(workOrder?.laborRate  ?? 150)

  // Plate quick-search (create mode only)
  const [plateSearch,    setPlateSearch]    = useState('')
  const [plateSearching, setPlateSearching] = useState(false)
  const [govLookup,      setGovLookup]      = useState<VehicleLookupResult | null>(null)
  const [govSearching,   setGovSearching]   = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const filteredVehicles = vehicles.filter((v) => v.customerId === selectedCustomerId)
  const laborTotal = laborHours * laborRate

  function fmt(n: number) {
    return `₪${n.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  // ── Plate quick-search ────────────────────────────────────────────────────

  function handlePlateSearch(val: string) {
    setPlateSearch(val)
    setGovLookup(null)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (val.length < 2) return

    setPlateSearching(true)
    searchTimer.current = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/vehicles/search?plate=${encodeURIComponent(val)}`)
        const data = await res.json() as {
          vehicle: { id: string; customerId?: string } | null
          customer: { id: string } | null
          matches: { vehicle: { id: string }; customer: { id: string } }[]
        }

        // Auto-select if exact match
        if (data.vehicle && data.customer) {
          setSelectedCustomerId(data.customer.id)
          setSelectedVehicleId(data.vehicle.id)
        } else if (data.matches.length === 1) {
          setSelectedCustomerId(data.matches[0].customer.id)
          setSelectedVehicleId(data.matches[0].vehicle.id)
        } else {
          // Not in DB — try gov API if plate has 7-8 digits
          const digits = val.replace(/\D/g, '')
          if (digits.length >= 7) {
            triggerGovLookup(val)
          }
        }
      } finally {
        setPlateSearching(false)
      }
    }, 400)
  }

  async function triggerGovLookup(plate: string) {
    setGovSearching(true)
    try {
      const res  = await fetch(`/api/vehicle-lookup?plate=${encodeURIComponent(plate)}`)
      const json = await res.json()
      if (json.found) setGovLookup(json.vehicle as VehicleLookupResult)
    } catch {
      // non-fatal
    } finally {
      setGovSearching(false)
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result =
        mode === 'edit' && workOrder
          ? await updateWorkOrder(workOrder.id, formData)
          : await createWorkOrder(formData)

      if ('error' in result) {
        setError(result.error)
      } else {
        router.push(`/dashboard/work-orders/${result.id}`)
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* ── Plate Quick-Search (create mode only) ─────────── */}
      {mode === 'create' && (
        <section className="bg-surface border border-[#2e3147] rounded-xl p-6">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">חיפוש מהיר לפי לוחית</h3>
          <div className="relative">
            <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-[#8892a4]" />
            <input
              type="text"
              value={plateSearch}
              onChange={(e) => handlePlateSearch(e.target.value.toUpperCase())}
              placeholder="הקלד לוחית לחיפוש אוטומטי..."
              className={`${INPUT} ps-9 font-mono tracking-widest uppercase`}
            />
            {(plateSearching || govSearching) && (
              <Loader2 size={14} className="absolute end-3 top-1/2 -translate-y-1/2 animate-spin text-[#8892a4]" />
            )}
          </div>
          {govLookup && (
            <div className="flex items-center gap-2 mt-2 text-xs text-emerald-400">
              <CheckCircle size={13} />
              <span>
                <strong>{govLookup.make} {govLookup.model} {govLookup.year}</strong>
                {govLookup.trim ? ` — ${govLookup.trim}` : ''}
                {' '}(מרשם הרכב — יש להוסיף את הרכב למערכת תחילה)
              </span>
            </div>
          )}
          {selectedVehicleId && (
            <p className="mt-2 text-xs text-[#6366f1]">✓ רכב נבחר אוטומטית</p>
          )}
        </section>
      )}

      {/* ── Vehicle & Customer ─────────────────────────────── */}
      <section className="bg-surface border border-[#2e3147] rounded-xl p-6">
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">רכב ולקוח</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Customer */}
          <div>
            <label className={LABEL}>לקוח *</label>
            <select
              name="customerId"
              required
              value={selectedCustomerId}
              onChange={(e) => { setSelectedCustomerId(e.target.value); setSelectedVehicleId('') }}
              className={INPUT}
            >
              <option value="">בחר לקוח...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.phone}
                </option>
              ))}
            </select>
          </div>

          {/* Vehicle */}
          <div>
            <label className={LABEL}>רכב *</label>
            <select
              name="vehicleId"
              required
              disabled={!selectedCustomerId}
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className={`${INPUT} disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <option value="">בחר רכב...</option>
              {filteredVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.make} {v.model} {v.year} — {v.plate}
                </option>
              ))}
            </select>
            {selectedCustomerId && filteredVehicles.length === 0 && (
              <p className="text-xs text-muted mt-1">אין רכבים רשומים ללקוח זה</p>
            )}
          </div>

          {/* Mileage */}
          <div>
            <label className={LABEL}>קילומטראז&#39;</label>
            <input
              type="number"
              name="mileage"
              defaultValue={workOrder?.mileage ?? ''}
              min={0}
              step={100}
              placeholder="לדוגמה: 45000"
              className={INPUT}
            />
          </div>

          {/* Technician */}
          <div>
            <label className={LABEL}>טכנאי אחראי</label>
            <input
              type="text"
              name="assignedTechnician"
              defaultValue={workOrder?.assignedTechnician ?? ''}
              placeholder="שם הטכנאי"
              className={INPUT}
            />
          </div>
        </div>
      </section>

      {/* ── Complaint & Diagnosis ──────────────────────────── */}
      <section className="bg-surface border border-[#2e3147] rounded-xl p-6">
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">תלונה ואבחון</h3>
        <div className="space-y-4">
          <div>
            <label className={LABEL}>תלונת לקוח *</label>
            <textarea
              name="complaint"
              required
              defaultValue={workOrder?.complaint ?? ''}
              rows={3}
              placeholder="תאר את התלונה שדווחה על ידי הלקוח..."
              className={`${INPUT} resize-y`}
            />
          </div>
          <div>
            <label className={LABEL}>אבחון טכנאי</label>
            <textarea
              name="diagnosis"
              defaultValue={workOrder?.diagnosis ?? ''}
              rows={3}
              placeholder="ממצאי הטכנאי ומהות העבודה הנדרשת..."
              className={`${INPUT} resize-y`}
            />
          </div>
          <div>
            <label className={LABEL}>הערות נוספות</label>
            <textarea
              name="notes"
              defaultValue={workOrder?.notes ?? ''}
              rows={2}
              placeholder="הערות כלליות..."
              className={`${INPUT} resize-y`}
            />
          </div>
        </div>
      </section>

      {/* ── Labor ─────────────────────────────────────────── */}
      <section className="bg-surface border border-[#2e3147] rounded-xl p-6">
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">פרטי עבודה</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={LABEL}>שעות עבודה</label>
            <input
              type="number"
              name="laborHours"
              value={laborHours}
              onChange={(e) => setLaborHours(parseFloat(e.target.value) || 0)}
              min={0}
              step={0.5}
              className={INPUT}
            />
          </div>
          <div>
            <label className={LABEL}>תעריף לשעה (₪)</label>
            <input
              type="number"
              name="laborRate"
              value={laborRate}
              onChange={(e) => setLaborRate(parseFloat(e.target.value) || 0)}
              min={0}
              step={10}
              className={INPUT}
            />
          </div>
          <div>
            <label className={LABEL}>סה&#34;כ עבודה</label>
            <div className="w-full bg-bg border border-[#2e3147] rounded-lg px-3 py-2.5 text-sm text-[#6366f1] font-bold">
              {fmt(laborTotal)}
            </div>
          </div>
        </div>
      </section>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5">
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2.5 rounded-lg text-sm text-muted hover:text-[#e2e8f0] border border-[#2e3147] hover:bg-[#252836] transition-all"
        >
          ביטול
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg px-6 py-2.5 text-sm transition-colors"
        >
          {isPending ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              {mode === 'edit' ? 'שומר...' : 'יוצר...'}
            </>
          ) : mode === 'edit' ? (
            'שמור שינויים'
          ) : (
            'צור פקודת עבודה'
          )}
        </button>
      </div>
    </form>
  )
}
