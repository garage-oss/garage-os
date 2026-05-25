import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Car, User, Gauge, Fuel, Settings2, Pencil } from 'lucide-react'
import { getVehicle, FUEL_LABELS, TRANSMISSION_LABELS } from '@/lib/vehicles'
import { StatusBadge } from '@/components/work-orders/StatusBadge'
import { DeleteButton } from '@/components/ui/DeleteButton'
import { VehicleMediaSection } from '@/components/vehicles/VehicleMediaSection'
import { deleteVehicle } from '@/app/actions/vehicles'
import { formatCurrency, formatDate, toNum } from '@/lib/utils'

interface Props { params: { id: string } }

export const dynamic = 'force-dynamic'

function Spec({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs text-[#8892a4] mb-0.5">{label}</div>
      <div className="text-sm font-medium">{value ?? '—'}</div>
    </div>
  )
}

export default async function VehicleProfilePage({ params }: Props) {
  const vehicle = await getVehicle(params.id)
  if (!vehicle) notFound()

  const totalSpent = vehicle.workOrders.reduce((s, wo) => s + toNum(wo.totalPrice), 0)
  const isInService = vehicle.workOrders.some(wo => ['IN_PROGRESS', 'WAITING_PARTS', 'PENDING'].includes(wo.status))

  return (
    <div className="max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-[#8892a4] mb-6">
        <Link href="/dashboard/vehicles" className="hover:text-[#e2e8f0] transition-colors">רכבים</Link>
        <ChevronRight size={14} className="rotate-180" />
        <span className="text-[#e2e8f0] font-mono">{vehicle.plate}</span>
      </div>

      {/* Header */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-6 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#6366f1]/15 flex items-center justify-center flex-shrink-0">
              <Car size={26} className="text-[#6366f1]" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold">{vehicle.make} {vehicle.model} {vehicle.year}</h1>
                {isInService && (
                  <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2 py-1 rounded-full font-semibold">בשירות</span>
                )}
              </div>
              <div className="font-mono text-[#6366f1] text-lg font-semibold mt-0.5">{vehicle.plate}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/dashboard/vehicles/${vehicle.id}/edit`} className="flex items-center gap-1.5 px-3 py-2 text-sm text-[#8892a4] border border-[#2e3147] rounded-lg hover:bg-[#252836] hover:text-[#e2e8f0] transition-all">
              <Pencil size={14} />ערוך
            </Link>
            <DeleteButton
              onDelete={() => deleteVehicle(vehicle.id)}
              redirectTo="/dashboard/vehicles"
              label="מחק"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-[#2e3147]">
          <div className="text-center">
            <div className="text-2xl font-bold">{vehicle.workOrders.length}</div>
            <div className="text-xs text-[#8892a4] mt-0.5">טיפולים</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{vehicle.mileage ? vehicle.mileage.toLocaleString('he-IL') : '—'}</div>
            <div className="text-xs text-[#8892a4] mt-0.5">ק"מ</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-[#6366f1]">{formatCurrency(totalSpent)}</div>
            <div className="text-xs text-[#8892a4] mt-0.5">הוצאות סה"כ</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {/* Owner */}
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <User size={14} className="text-[#8892a4]" />
            <span className="text-xs font-semibold text-[#8892a4] uppercase tracking-wide">בעלים</span>
          </div>
          <Link href={`/dashboard/customers/${vehicle.customer.id}`} className="font-semibold hover:text-[#6366f1] transition-colors">
            {vehicle.customer.name}
          </Link>
          <div className="text-sm text-[#8892a4] mt-1">{vehicle.customer.phone}</div>
          {vehicle.customer.email && <div className="text-sm text-[#8892a4]">{vehicle.customer.email}</div>}
        </div>

        {/* Specs */}
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Settings2 size={14} className="text-[#8892a4]" />
            <span className="text-xs font-semibold text-[#8892a4] uppercase tracking-wide">מפרט טכני</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Spec label="מנוע" value={vehicle.engine} />
            <Spec label="דלק" value={vehicle.fuelType ? FUEL_LABELS[vehicle.fuelType] : null} />
            <Spec label="הילוכים" value={vehicle.transmission ? TRANSMISSION_LABELS[vehicle.transmission] : null} />
            <Spec label="צבע" value={vehicle.color} />
          </div>
          {vehicle.vin && (
            <div className="mt-3 pt-3 border-t border-[#2e3147]">
              <div className="text-xs text-[#8892a4] mb-0.5">מספר שלדה (VIN)</div>
              <div className="text-xs font-mono text-[#e2e8f0]">{vehicle.vin}</div>
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      {vehicle.notes && (
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-4 mb-4">
          <div className="text-xs font-semibold text-[#8892a4] uppercase tracking-wide mb-2">הערות</div>
          <p className="text-sm text-[#8892a4] leading-relaxed">{vehicle.notes}</p>
        </div>
      )}

      {/* Media Gallery */}
      <VehicleMediaSection vehicleId={vehicle.id} />

      {/* Service History */}
      <div>
        <h2 className="font-semibold text-[15px] mb-3">היסטוריית שירות ({vehicle.workOrders.length})</h2>
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
          {vehicle.workOrders.length === 0 ? (
            <p className="text-sm text-[#8892a4] text-center py-10">אין פקודות עבודה עדיין</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2e3147]">
                    {['מס׳ פקודה', 'תלונה', 'אבחון', 'טכנאי', 'סטטוס', 'תאריך', 'סה״כ'].map(h => (
                      <th key={h} className="text-start px-4 py-3 text-xs font-semibold text-[#8892a4] uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vehicle.workOrders.map(wo => (
                    <tr key={wo.id} className="border-b border-[#2e3147] last:border-0 hover:bg-[#252836]/40 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/work-orders/${wo.id}`} className="font-mono text-xs text-[#6366f1] hover:underline font-semibold">{wo.workOrderNumber}</Link>
                      </td>
                      <td className="px-4 py-3 text-[#8892a4] max-w-[160px] truncate text-xs">{wo.complaint ?? '—'}</td>
                      <td className="px-4 py-3 text-[#8892a4] max-w-[160px] truncate text-xs">{wo.diagnosis ?? '—'}</td>
                      <td className="px-4 py-3 text-[#8892a4] whitespace-nowrap text-xs">{wo.assignedTechnician ?? '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={wo.status} /></td>
                      <td className="px-4 py-3 text-[#8892a4] whitespace-nowrap text-xs">{formatDate(wo.createdAt)}</td>
                      <td className="px-4 py-3 font-semibold whitespace-nowrap">{formatCurrency(toNum(wo.totalPrice))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
