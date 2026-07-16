import Link from 'next/link'
import { requireCustomerSession } from '@/lib/customer-auth'
import { prisma }                 from '@/lib/prisma'
import { nesherCustomer }         from '@/lib/nesher-connector'
import { Car, ChevronLeft, CalendarPlus } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function VehiclesPage() {
  const ctx = await requireCustomerSession()

  const vehicles = await prisma.vehicle.findMany({
    where:   { customerId: ctx.customerId, organizationId: ctx.organizationId },
    orderBy: { updatedAt: 'desc' },
  })

  // Supplement with NESHER vehicles if no local records
  let nesherVehicles: Array<{ car_no: string; car_desc: string | null; last_km: number | null; last_visit_dt: string | null; order_count: number }> = []
  if (vehicles.length === 0 && ctx.importSource === 'nesher' && ctx.importId) {
    const data = await nesherCustomer(ctx.importId)
    nesherVehicles = data?.vehicles ?? []
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-4" dir="rtl">
      <h1 className="text-2xl font-black text-slate-800 mb-5">הרכבים שלי</h1>

      {vehicles.length === 0 && nesherVehicles.length === 0 && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-10 text-center">
          <Car size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500">אין רכבים רשומים עדיין</p>
          <Link href="/portal/book-service" className="mt-4 inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-bold px-5 py-3 rounded-2xl">
            <CalendarPlus size={16} /> קביעת טיפול ראשון
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {vehicles.map(v => (
          <Link
            key={v.id}
            href={`/portal/vehicles/${v.id}`}
            className="flex items-center gap-4 bg-white rounded-3xl shadow-sm border border-slate-100 p-5 active:scale-[0.98] transition-transform"
          >
            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center shrink-0">
              <Car size={28} className="text-indigo-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-slate-800 text-lg truncate">{v.make} {v.model}</p>
              <p className="font-mono text-slate-500 text-sm">{v.plate}</p>
              <div className="flex gap-3 mt-1 text-xs text-slate-400">
                {v.year && <span>{v.year}</span>}
                {v.color && <span>{v.color}</span>}
                {v.mileage && <span>{v.mileage.toLocaleString()} ק״מ</span>}
              </div>
            </div>
            <ChevronLeft size={20} className="text-slate-300 shrink-0" />
          </Link>
        ))}

        {nesherVehicles.map(v => (
          <Link
            key={v.car_no}
            href={`/portal/book-service?plate=${encodeURIComponent(v.car_no)}`}
            className="flex items-center gap-4 bg-white rounded-3xl shadow-sm border border-slate-100 p-5 active:scale-[0.98] transition-transform"
          >
            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center shrink-0">
              <Car size={28} className="text-indigo-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-slate-800 text-lg truncate">{v.car_desc ?? v.car_no}</p>
              <p className="font-mono text-slate-500 text-sm">{v.car_no}</p>
              <div className="flex gap-3 mt-1 text-xs text-slate-400">
                {v.last_km && <span>{v.last_km.toLocaleString()} ק״מ</span>}
                {v.order_count > 0 && <span>{v.order_count} טיפולים</span>}
              </div>
            </div>
            <div className="shrink-0 text-center">
              <span className="text-[10px] text-indigo-500 font-bold bg-indigo-50 px-2 py-1 rounded-lg block">מנשר</span>
              <ChevronLeft size={16} className="text-slate-300 mt-1 mx-auto" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
