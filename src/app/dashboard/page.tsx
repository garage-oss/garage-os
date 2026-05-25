import Link from 'next/link'
import { getDashboardStats } from '@/lib/work-orders'
import { getRecentCustomers } from '@/lib/customers'
import { getVehiclesInService } from '@/lib/vehicles'
import { StatusBadge } from '@/components/work-orders/StatusBadge'
import { VehicleCard } from '@/components/vehicles/VehicleCard'
import { formatCurrency, formatDate, toNum } from '@/lib/utils'
import { Car, Users, Wrench } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const [
    { active, waitingParts, completedToday, pending, recentWorkOrders },
    recentCustomers,
    vehiclesInService,
  ] = await Promise.all([
    getDashboardStats(),
    getRecentCustomers(5),
    getVehiclesInService(),
  ])

  const stats = [
    { label: 'בטיפול כעת', value: active, sub: 'פקודות פעילות', accent: '#6366f1' },
    { label: 'ממתין לחלקים', value: waitingParts, sub: 'רכבים מחכים', accent: '#f97316' },
    { label: 'הושלמו היום', value: completedToday, sub: 'טיפולים הושלמו', accent: '#10b981' },
    { label: 'ממתינות לטיפול', value: pending, sub: 'פקודות חדשות', accent: '#f59e0b' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">לוח בקרה</h1>
          <p className="text-sm text-[#8892a4] mt-0.5">ברוך הבא ל-GarageOS</p>
        </div>
        <Link href="/dashboard/work-orders/new" className="flex items-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors">
          + פקודה חדשה
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {stats.map((s) => (
          <div key={s.label} className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5 relative overflow-hidden">
            <div className="absolute top-0 start-0 end-0 h-[3px] rounded-t-xl" style={{ background: s.accent }} />
            <div className="text-xs text-[#8892a4] uppercase tracking-wide mb-1.5">{s.label}</div>
            <div className="text-3xl font-bold leading-none mb-1.5">{s.value}</div>
            <div className="text-xs text-[#8892a4]">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Work Orders */}
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e3147]">
            <div className="flex items-center gap-2 font-semibold text-[15px]">
              <Wrench size={15} className="text-[#8892a4]" />פקודות אחרונות
            </div>
            <Link href="/dashboard/work-orders" className="text-xs text-[#6366f1] hover:underline">הצג הכל</Link>
          </div>
          {recentWorkOrders.length === 0 ? (
            <p className="text-sm text-[#8892a4] text-center py-10">אין פקודות עבודה</p>
          ) : (
            <div className="divide-y divide-[#2e3147]">
              {recentWorkOrders.map(wo => (
                <div key={wo.id} className="flex items-center justify-between px-5 py-3 hover:bg-[#252836]/40 transition-colors">
                  <div className="min-w-0">
                    <Link href={`/dashboard/work-orders/${wo.id}`} className="font-mono text-xs text-[#6366f1] hover:underline font-semibold">{wo.workOrderNumber}</Link>
                    <div className="text-sm font-medium truncate">{wo.customer.name}</div>
                    <div className="text-xs text-[#8892a4] truncate">{wo.vehicle.make} {wo.vehicle.model} — {wo.vehicle.plate}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0 ms-3">
                    <StatusBadge status={wo.status} />
                    <span className="text-xs font-semibold">{formatCurrency(toNum(wo.totalPrice))}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Customers */}
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e3147]">
            <div className="flex items-center gap-2 font-semibold text-[15px]">
              <Users size={15} className="text-[#8892a4]" />לקוחות אחרונים
            </div>
            <Link href="/dashboard/customers" className="text-xs text-[#6366f1] hover:underline">הצג הכל</Link>
          </div>
          {recentCustomers.length === 0 ? (
            <p className="text-sm text-[#8892a4] text-center py-10">אין לקוחות</p>
          ) : (
            <div className="divide-y divide-[#2e3147]">
              {recentCustomers.map(c => (
                <div key={c.id} className="flex items-center justify-between px-5 py-3 hover:bg-[#252836]/40 transition-colors">
                  <div>
                    <Link href={`/dashboard/customers/${c.id}`} className="font-semibold text-sm hover:text-[#6366f1] transition-colors">{c.name}</Link>
                    <div className="text-xs text-[#8892a4]">{c.phone}</div>
                  </div>
                  <div className="flex gap-3 text-xs text-[#8892a4]">
                    <span className="flex items-center gap-1"><Car size={11} />{c._count.vehicles}</span>
                    <span className="flex items-center gap-1"><Wrench size={11} />{c._count.workOrders}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Vehicles in Service */}
      {vehiclesInService.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 font-semibold text-[15px]">
              <Car size={15} className="text-[#8892a4]" />רכבים בשירות ({vehiclesInService.length})
            </div>
            <Link href="/dashboard/vehicles?inService=true" className="text-xs text-[#6366f1] hover:underline">הצג הכל</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {vehiclesInService.slice(0, 4).map(v => (
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
                workOrderCount={v.workOrders.length}
                customerName={v.customer.name}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
