import Link from 'next/link'
import { Car, Fuel, Settings2, Gauge } from 'lucide-react'
import { FuelType, Transmission } from '@prisma/client'
import { FUEL_LABELS, TRANSMISSION_LABELS } from '@/lib/vehicles'

interface Props {
  id: string
  plate: string
  make: string
  model: string
  year: number
  color?: string | null
  fuelType?: FuelType | null
  transmission?: Transmission | null
  mileage?: number | null
  workOrderCount: number
  customerName?: string
  size?: 'sm' | 'md'
}

export function VehicleCard({
  id, plate, make, model, year, color, fuelType, transmission,
  mileage, workOrderCount, customerName, size = 'md',
}: Props) {
  const specs = [
    fuelType && FUEL_LABELS[fuelType],
    transmission && TRANSMISSION_LABELS[transmission],
    color,
  ].filter(Boolean)

  if (size === 'sm') {
    return (
      <Link
        href={`/dashboard/vehicles/${id}`}
        className="flex items-center gap-3 p-3 bg-[#252836] border border-[#2e3147] rounded-xl hover:border-[#6366f1]/40 hover:bg-[#252836]/80 transition-all group"
      >
        <div className="w-8 h-8 rounded-lg bg-[#6366f1]/15 flex items-center justify-center flex-shrink-0">
          <Car size={15} className="text-[#6366f1]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm truncate">{make} {model} {year}</div>
          <div className="text-xs text-[#8892a4] font-mono">{plate}</div>
        </div>
        <div className="text-xs text-[#8892a4] shrink-0">{workOrderCount} טיפולים</div>
      </Link>
    )
  }

  return (
    <Link
      href={`/dashboard/vehicles/${id}`}
      className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5 hover:border-[#6366f1]/40 hover:shadow-lg hover:shadow-[#6366f1]/5 transition-all group flex flex-col gap-3"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-xl bg-[#6366f1]/15 flex items-center justify-center flex-shrink-0">
          <Car size={18} className="text-[#6366f1]" />
        </div>
        <span className="text-xs font-mono text-[#6366f1] font-semibold bg-[#6366f1]/10 px-2 py-1 rounded-lg">
          {plate}
        </span>
      </div>

      {/* Name */}
      <div>
        <div className="font-bold text-[15px] group-hover:text-[#6366f1] transition-colors">
          {make} {model}
        </div>
        <div className="text-sm text-[#8892a4]">{year}</div>
      </div>

      {/* Specs */}
      {specs.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {specs.map((s) => (
            <span key={s} className="text-xs bg-[#252836] border border-[#2e3147] text-[#8892a4] px-2 py-0.5 rounded-md">
              {s}
            </span>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-[#2e3147]">
        <div className="flex items-center gap-1.5 text-xs text-[#8892a4]">
          <Gauge size={12} />
          {mileage ? `${mileage.toLocaleString('he-IL')} ק"מ` : '—'}
        </div>
        <div className="text-xs text-[#8892a4]">{workOrderCount} טיפולים</div>
      </div>

      {customerName && (
        <div className="text-xs text-[#8892a4] border-t border-[#2e3147] pt-2">
          בעלים: <span className="text-[#e2e8f0]">{customerName}</span>
        </div>
      )}
    </Link>
  )
}
