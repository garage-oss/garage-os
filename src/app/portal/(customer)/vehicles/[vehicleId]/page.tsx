import Link from 'next/link'
import { notFound }               from 'next/navigation'
import { requireCustomerSession } from '@/lib/customer-auth'
import { prisma }                 from '@/lib/prisma'
import { nesherVehicleHistory }   from '@/lib/nesher-connector'
import { ChevronRight }           from 'lucide-react'

export const dynamic = 'force-dynamic'

const FUEL_HE: Record<string, string> = {
  GASOLINE: 'בנזין', DIESEL: 'דיזל', HYBRID: 'היברידי', ELECTRIC: 'חשמלי', LPG: 'גז',
}

function fmtDate(d: Date | string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtCurrency(n: number | string | null): string {
  if (n == null) return '—'
  const v = typeof n === 'string' ? parseFloat(n) : n
  return v.toLocaleString('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 0 })
}

interface Props { params: { vehicleId: string } }

export default async function VehicleDetailPage({ params }: Props) {
  const ctx = await requireCustomerSession()

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: params.vehicleId, customerId: ctx.customerId, organizationId: ctx.organizationId },
  })
  if (!vehicle) notFound()

  const workOrders = await prisma.workOrder.findMany({
    where:   { vehicleId: vehicle.id, organizationId: ctx.organizationId },
    orderBy: { createdAt: 'desc' },
    take:    20,
    select: {
      id: true, workOrderNumber: true, complaint: true,
      mileage: true, totalPrice: true, completedAt: true, createdAt: true,
    },
  })

  const nesherHistory = vehicle.importSource === 'nesher'
    ? await nesherVehicleHistory(vehicle.plate)
    : null

  const quotes = await prisma.quote.findMany({
    where:   { vehicleId: vehicle.id, organizationId: ctx.organizationId },
    orderBy: { createdAt: 'desc' },
    take:    5,
    select:  { id: true, quoteNumber: true, status: true, totalPrice: true, createdAt: true },
  })

  const hasHistory      = workOrders.length > 0 || (nesherHistory && nesherHistory.length > 0)
  // Show vehicle documents only when storage is configured (S3 in prod, local in dev)
  const vehicleDocsEnabled = process.env.STORAGE_PROVIDER === 's3' || process.env.NODE_ENV !== 'production'

  return (
    <div className="max-w-lg mx-auto" dir="rtl">

      {/* Hero */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-800 px-5 pt-5 pb-10">
        <Link href="/portal/vehicles" className="flex items-center gap-1 text-indigo-300 text-sm mb-5">
          <ChevronRight size={16} /> הרכבים שלי
        </Link>
        <p className="text-indigo-400 text-[10px] font-bold uppercase tracking-widest mb-1">הרכב שלי</p>
        <h1 className="text-3xl font-black text-white leading-tight">{vehicle.make} {vehicle.model}</h1>
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <span className="bg-white/10 border border-white/15 text-white font-mono font-bold text-sm px-3.5 py-1.5 rounded-xl">{vehicle.plate}</span>
          {vehicle.year      && <span className="text-indigo-300/80 text-sm">{vehicle.year}</span>}
          {vehicle.fuelType  && <span className="text-indigo-300/80 text-sm">{FUEL_HE[vehicle.fuelType] ?? vehicle.fuelType}</span>}
          {vehicle.mileage   && <span className="text-indigo-300/80 text-sm">{vehicle.mileage.toLocaleString()} ק״מ</span>}
        </div>
      </div>

      <div className="px-4 -mt-5 space-y-4">

        {/* 3 large action buttons */}
        <div className="flex flex-col gap-3">
          <Link
            href={`/portal/book-service?vehicleId=${vehicle.id}`}
            className="flex items-center gap-4 bg-indigo-600 text-white px-5 py-5 rounded-2xl shadow-lg shadow-indigo-200/50 active:scale-[0.98] transition-transform"
          >
            <span className="text-3xl shrink-0">🔧</span>
            <div>
              <p className="font-black text-lg leading-tight">קביעת טיפול</p>
              <p className="text-indigo-200 text-sm">הצעת מחיר + תיאום תור</p>
            </div>
          </Link>

          <Link
            href="#history"
            scroll
            className="flex items-center gap-4 bg-white border-2 border-slate-100 text-slate-800 px-5 py-5 rounded-2xl shadow-sm active:scale-[0.98] transition-transform"
          >
            <span className="text-3xl shrink-0">📋</span>
            <div>
              <p className="font-black text-lg leading-tight">היסטוריית טיפולים</p>
              <p className="text-slate-500 text-sm">{(workOrders.length + (nesherHistory?.length ?? 0))} רשומות</p>
            </div>
          </Link>

          <Link
            href="#quotes"
            scroll
            className="flex items-center gap-4 bg-white border-2 border-slate-100 text-slate-800 px-5 py-5 rounded-2xl shadow-sm active:scale-[0.98] transition-transform"
          >
            <span className="text-3xl shrink-0">💰</span>
            <div>
              <p className="font-black text-lg leading-tight">הצעות מחיר</p>
              <p className="text-slate-500 text-sm">{quotes.length} הצעות</p>
            </div>
          </Link>

          {vehicleDocsEnabled && (
            <Link
              href={`/portal/vehicles/${vehicle.id}/documents`}
              className="flex items-center gap-4 bg-white border-2 border-slate-100 text-slate-800 px-5 py-5 rounded-2xl shadow-sm active:scale-[0.98] transition-transform"
            >
              <span className="text-3xl shrink-0">📄</span>
              <div>
                <p className="font-black text-lg leading-tight">מסמכי הרכב</p>
                <p className="text-slate-500 text-sm">רישיון, ביטוח ומסמכים נוספים</p>
              </div>
            </Link>
          )}
        </div>

        {/* Service history */}
        <div id="history">
          {nesherHistory && nesherHistory.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">היסטוריית שירות</p>
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="divide-y divide-slate-50">
                  {nesherHistory.slice(0, 15).map((row, i) => (
                    <div key={i} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 text-sm leading-snug">
                            {row.cli_comp1 || 'טיפול שוטף'}
                          </p>
                          <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-400">
                            <span>{fmtDate(row.open_dt)}</span>
                            {row.card_km != null && <span>{row.card_km.toLocaleString()} ק״מ</span>}
                            {row.card_no && <span className="font-mono">#{row.card_no}</span>}
                          </div>
                        </div>
                        {row.total > 0 && (
                          <span className="font-bold text-emerald-600 text-sm whitespace-nowrap shrink-0">
                            {fmtCurrency(row.total)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {workOrders.length > 0 && (
            <div className="mb-4">
              {!nesherHistory && <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">היסטוריית שירות</p>}
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="divide-y divide-slate-50">
                  {workOrders.map(wo => (
                    <div key={wo.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 text-sm leading-snug">
                            {wo.complaint || 'טיפול שוטף'}
                          </p>
                          <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-400">
                            <span>{fmtDate(wo.completedAt ?? wo.createdAt)}</span>
                            {wo.mileage && <span>{wo.mileage.toLocaleString()} ק״מ</span>}
                            <span className="font-mono">#{wo.workOrderNumber}</span>
                          </div>
                        </div>
                        {parseFloat(wo.totalPrice?.toString() ?? '0') > 0 && (
                          <span className="font-bold text-emerald-600 text-sm whitespace-nowrap shrink-0">
                            {fmtCurrency(wo.totalPrice?.toString() ?? null)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!hasHistory && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-10 text-center">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-slate-500 text-sm">אין היסטוריית שירות עדיין</p>
            </div>
          )}
        </div>

        {/* Quotes */}
        {quotes.length > 0 && (
          <div id="quotes">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">הצעות מחיר</p>
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="divide-y divide-slate-50">
                {quotes.map(q => (
                  <Link key={q.id} href={`/portal/quotes/${q.id}`} className="flex items-center justify-between px-5 py-4 active:bg-slate-50 transition-colors">
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{q.quoteNumber}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{fmtDate(q.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        q.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' :
                        q.status === 'REJECTED' ? 'bg-red-50 text-red-600' :
                        q.status === 'SENT'     ? 'bg-amber-50 text-amber-700' :
                                                  'bg-slate-50 text-slate-500'
                      }`}>
                        {q.status === 'APPROVED' ? 'אושרה' : q.status === 'REJECTED' ? 'נדחתה' : q.status === 'SENT' ? 'ממתינה' : 'טיוטה'}
                      </span>
                      <p className="font-bold text-slate-700 text-sm mt-1">{fmtCurrency(q.totalPrice?.toString() ?? null)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
