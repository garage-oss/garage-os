import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Phone, Mail, MapPin, Car, Wrench, Plus, Pencil } from 'lucide-react'
import { getCustomer, calcTotalSpent } from '@/lib/customers'
import { requireOrg } from '@/lib/org'
import { VehicleCard } from '@/components/vehicles/VehicleCard'
import { StatusBadge } from '@/components/work-orders/StatusBadge'
import { DeleteButton } from '@/components/ui/DeleteButton'
import { deleteCustomer } from '@/app/actions/customers'
import { formatCurrency, formatDate, toNum } from '@/lib/utils'

interface Props { params: { id: string } }

const AVATAR_BG = ['bg-indigo-500/20 text-indigo-400', 'bg-emerald-500/20 text-emerald-400', 'bg-amber-500/20 text-amber-400', 'bg-rose-500/20 text-rose-400']

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2)
}

export const dynamic = 'force-dynamic'

export default async function CustomerProfilePage({ params }: Props) {
  const { orgId } = await requireOrg()
  const customer = await getCustomer(orgId, params.id)
  if (!customer) notFound()

  const totalSpent = calcTotalSpent(customer.workOrders)

  return (
    <div className="max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-[#8892a4] mb-6">
        <Link href="/dashboard/customers" className="hover:text-[#e2e8f0] transition-colors">לקוחות</Link>
        <ChevronRight size={14} className="rotate-180" />
        <span className="text-[#e2e8f0]">{customer.name}</span>
      </div>

      {/* Header card */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-6 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold flex-shrink-0 ${AVATAR_BG[customer.name.charCodeAt(0) % AVATAR_BG.length]}`}>
              {getInitials(customer.name)}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{customer.name}</h1>
              <div className="flex flex-wrap gap-3 mt-1.5 text-sm text-[#8892a4]">
                <span className="flex items-center gap-1.5"><Phone size={13} />{customer.phone}</span>
                {customer.email && <span className="flex items-center gap-1.5"><Mail size={13} />{customer.email}</span>}
                {customer.address && <span className="flex items-center gap-1.5"><MapPin size={13} />{customer.address}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/dashboard/customers/${customer.id}/edit`} className="flex items-center gap-1.5 px-3 py-2 text-sm text-[#8892a4] border border-[#2e3147] rounded-lg hover:bg-[#252836] hover:text-[#e2e8f0] transition-all">
              <Pencil size={14} />ערוך
            </Link>
            <DeleteButton
              onDelete={() => deleteCustomer(customer.id)}
              redirectTo="/dashboard/customers"
              label="מחק"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-[#2e3147]">
          {[
            { icon: Car, label: 'רכבים', value: customer._count.vehicles },
            { icon: Wrench, label: 'פקודות עבודה', value: customer._count.workOrders },
            { label: 'סה"כ הוצאות', value: formatCurrency(totalSpent), large: true },
          ].map((s, i) => (
            <div key={i} className="text-center">
              <div className={`font-bold ${s.large ? 'text-[#6366f1] text-lg' : 'text-2xl'}`}>{s.value}</div>
              <div className="text-xs text-[#8892a4] mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      {customer.notes && (
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-4 mb-4">
          <div className="text-xs font-semibold text-[#8892a4] uppercase tracking-wide mb-2">הערות</div>
          <p className="text-sm text-[#8892a4] leading-relaxed">{customer.notes}</p>
        </div>
      )}

      {/* Vehicles */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-[15px]">רכבים ({customer.vehicles.length})</h2>
          <Link href={`/dashboard/vehicles/new?customerId=${customer.id}`} className="flex items-center gap-1.5 text-xs text-[#6366f1] hover:underline">
            <Plus size={13} />הוסף רכב
          </Link>
        </div>
        {customer.vehicles.length === 0 ? (
          <div className="bg-[#1a1d27] border border-[#2e3147] border-dashed rounded-xl p-8 text-center">
            <p className="text-[#8892a4] text-sm mb-3">אין רכבים רשומים ללקוח זה</p>
            <Link href={`/dashboard/vehicles/new?customerId=${customer.id}`} className="text-xs text-[#6366f1] hover:underline">הוסף רכב ראשון</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {customer.vehicles.map(v => (
              <VehicleCard
                key={v.id}
                id={v.id}
                plate={v.plate}
                make={v.make}
                model={v.model}
                year={v.year}
                color={v.color}
                fuelType={v.fuelType}
                transmission={v.transmission}
                mileage={v.mileage}
                workOrderCount={v._count.workOrders}
                size="sm"
              />
            ))}
          </div>
        )}
      </div>

      {/* Work History */}
      <div>
        <h2 className="font-semibold text-[15px] mb-3">היסטוריית שירות ({customer.workOrders.length})</h2>
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
          {customer.workOrders.length === 0 ? (
            <p className="text-sm text-[#8892a4] text-center py-10">אין פקודות עבודה עדיין</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2e3147]">
                    {['מס׳ פקודה', 'רכב', 'תלונה', 'סטטוס', 'תאריך', 'סה״כ'].map(h => (
                      <th key={h} className="text-start px-4 py-3 text-xs font-semibold text-[#8892a4] uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {customer.workOrders.map(wo => (
                    <tr key={wo.id} className="border-b border-[#2e3147] last:border-0 hover:bg-[#252836]/40 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/work-orders/${wo.id}`} className="font-mono text-xs text-[#6366f1] hover:underline font-semibold">{wo.workOrderNumber}</Link>
                      </td>
                      <td className="px-4 py-3 text-[#8892a4] whitespace-nowrap text-xs">{wo.vehicle.make} {wo.vehicle.model} ({wo.vehicle.plate})</td>
                      <td className="px-4 py-3 text-[#8892a4] max-w-[200px] truncate text-xs">{wo.complaint ?? '—'}</td>
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
