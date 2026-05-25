'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createVehicle, updateVehicle } from '@/app/actions/vehicles'
import { FuelType, Transmission } from '@prisma/client'
import { FUEL_LABELS, TRANSMISSION_LABELS } from '@/lib/vehicles'

interface Customer { id: string; name: string; phone: string }

interface VehicleData {
  id: string; customerId: string; plate: string; make: string; model: string; year: number
  color: string | null; vin: string | null; engine: string | null
  fuelType: FuelType | null; transmission: Transmission | null; mileage: number | null; notes: string | null
}

interface Props {
  customers: Customer[]
  mode?: 'create' | 'edit'
  vehicle?: VehicleData
  defaultCustomerId?: string
}

const INPUT = 'w-full bg-[#252836] border border-[#2e3147] text-[#e2e8f0] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/20 transition-all placeholder:text-[#8892a4]/60'
const LABEL = 'block text-xs font-medium text-[#8892a4] mb-1.5 uppercase tracking-wide'
const SECTION = 'bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5'

const currentYear = new Date().getFullYear()

export function VehicleForm({ customers, mode = 'create', vehicle, defaultCustomerId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result =
        mode === 'edit' && vehicle
          ? await updateVehicle(vehicle.id, fd)
          : await createVehicle(fd)
      if ('error' in result) {
        setError(result.error)
      } else {
        router.push(`/dashboard/vehicles/${result.id}`)
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      {/* Owner */}
      <div className={SECTION}>
        <h3 className="text-xs font-semibold text-[#8892a4] uppercase tracking-wider mb-4">בעלים</h3>
        {mode === 'edit' ? (
          <div className="text-sm text-[#e2e8f0]">
            {customers.find(c => c.id === vehicle?.customerId)?.name ?? '—'}
            <input type="hidden" name="customerId" value={vehicle?.customerId} />
          </div>
        ) : (
          <div>
            <label className={LABEL}>לקוח *</label>
            <select name="customerId" required defaultValue={defaultCustomerId ?? ''} className={INPUT}>
              <option value="">בחר לקוח...</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Identity */}
      <div className={SECTION}>
        <h3 className="text-xs font-semibold text-[#8892a4] uppercase tracking-wider mb-4">פרטי רכב</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>לוחית רישוי *</label>
            <input name="plate" required defaultValue={vehicle?.plate} placeholder="123-45-678" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>יצרן *</label>
            <input name="make" required defaultValue={vehicle?.make} placeholder="Toyota" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>דגם *</label>
            <input name="model" required defaultValue={vehicle?.model} placeholder="Corolla" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>שנת ייצור *</label>
            <input name="year" type="number" required defaultValue={vehicle?.year ?? currentYear} min={1980} max={currentYear + 1} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>צבע</label>
            <input name="color" defaultValue={vehicle?.color ?? ''} placeholder="לבן" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>קילומטראז&#39;</label>
            <input name="mileage" type="number" defaultValue={vehicle?.mileage ?? ''} min={0} step={100} placeholder="45000" className={INPUT} />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL}>מספר שלדה (VIN)</label>
            <input name="vin" defaultValue={vehicle?.vin ?? ''} placeholder="WBAVB13556KX00000" className={INPUT} />
          </div>
        </div>
      </div>

      {/* Technical */}
      <div className={SECTION}>
        <h3 className="text-xs font-semibold text-[#8892a4] uppercase tracking-wider mb-4">מפרט טכני</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={LABEL}>מנוע</label>
            <input name="engine" defaultValue={vehicle?.engine ?? ''} placeholder="2.0L" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>סוג דלק</label>
            <select name="fuelType" defaultValue={vehicle?.fuelType ?? ''} className={INPUT}>
              <option value="">בחר...</option>
              {(Object.keys(FUEL_LABELS) as FuelType[]).map(k => (
                <option key={k} value={k}>{FUEL_LABELS[k]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>תיבת הילוכים</label>
            <select name="transmission" defaultValue={vehicle?.transmission ?? ''} className={INPUT}>
              <option value="">בחר...</option>
              {(Object.keys(TRANSMISSION_LABELS)).map(k => (
                <option key={k} value={k}>{TRANSMISSION_LABELS[k]}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className={SECTION}>
        <h3 className="text-xs font-semibold text-[#8892a4] uppercase tracking-wider mb-4">הערות</h3>
        <textarea name="notes" rows={2} defaultValue={vehicle?.notes ?? ''} placeholder="הערות על הרכב..." className={`${INPUT} resize-y`} />
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5">{error}</p>
      )}

      <div className="flex items-center justify-between pt-1">
        <button type="button" onClick={() => router.back()} className="px-4 py-2.5 rounded-lg text-sm text-[#8892a4] border border-[#2e3147] hover:bg-[#252836] hover:text-[#e2e8f0] transition-all">
          ביטול
        </button>
        <button type="submit" disabled={isPending} className="flex items-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-50 text-white font-medium rounded-lg px-6 py-2.5 text-sm transition-colors">
          {isPending ? <><Loader2 size={15} className="animate-spin" />{mode === 'edit' ? 'שומר...' : 'יוצר...'}</> : mode === 'edit' ? 'שמור שינויים' : 'הוסף רכב'}
        </button>
      </div>
    </form>
  )
}
