import Link from 'next/link'
import { requireCustomerSession } from '@/lib/customer-auth'
import { prisma }                 from '@/lib/prisma'
import { nesherCustomer }         from '@/lib/nesher-connector'
import { Car, CalendarPlus, CalendarClock, ChevronLeft, Phone } from 'lucide-react'

export const dynamic = 'force-dynamic'

function fmtDate(d: Date | string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('he-IL', { day: '2-digit', month: 'long', year: 'numeric' })
}

function fmtCurrency(n: number | string | null): string {
  const v = typeof n === 'string' ? parseFloat(n) : (n ?? 0)
  return v.toLocaleString('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 0 })
}

export default async function CustomerPortalHome() {
  const ctx = await requireCustomerSession()

  const [vehicles, quotes, appointments, org] = await Promise.all([
    prisma.vehicle.findMany({
      where:   { customerId: ctx.customerId, organizationId: ctx.organizationId },
      orderBy: { updatedAt: 'desc' },
      take:    10,
    }),
    prisma.quote.findMany({
      where:   { customerId: ctx.customerId, organizationId: ctx.organizationId, status: { in: ['SENT', 'DRAFT'] } },
      orderBy: { createdAt: 'desc' },
      take:    5,
      include: { vehicle: { select: { plate: true, make: true } } },
    }),
    prisma.appointment.findMany({
      where:   { customerId: ctx.customerId, scheduledAt: { gte: new Date() } },
      orderBy: { scheduledAt: 'asc' },
      take:    3,
      include: { vehicle: { select: { plate: true, make: true, model: true } } },
    }),
    prisma.organization.findUnique({
      where:  { id: ctx.organizationId },
      select: { name: true, phone: true, logoUrl: true },
    }),
  ])

  // If no vehicles in DB and customer is from NESHER, fetch from connector
  let nesherVehicles: Array<{ car_no: string; car_desc: string | null; last_km: number | null; last_visit_dt: string | null; order_count: number }> = []
  if (vehicles.length === 0 && ctx.importSource === 'nesher' && ctx.importId) {
    const data = await nesherCustomer(ctx.importId)
    nesherVehicles = data?.vehicles ?? []
  }

  const pendingQuotes  = quotes.filter(q => q.status === 'SENT')
  const totalVehicles  = vehicles.length + nesherVehicles.length
  const nextAppt       = appointments[0] ?? null

  return (
    <div className="max-w-lg mx-auto">
      {/* Hero */}
      <div className="relative bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-800 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 80% 60% at 60% 20%, rgba(99,102,241,0.18) 0%, transparent 70%)' }} />

        {/* Top bar */}
        <div className="relative z-10 flex items-center justify-between px-5 pt-5">
          <div className="flex items-center gap-2.5">
            {org?.logoUrl ? (
              <img src={org.logoUrl} alt={org.name} className="w-8 h-8 rounded-xl object-cover ring-1 ring-white/20" />
            ) : (
              <div className="w-8 h-8 bg-indigo-500/25 border border-indigo-400/30 rounded-xl flex items-center justify-center">
                <span className="text-indigo-200 font-black text-sm">{org?.name?.charAt(0)}</span>
              </div>
            )}
            <span className="text-white/70 font-semibold text-sm">{org?.name}</span>
          </div>
          {org?.phone && (
            <a href={`tel:${org.phone}`} className="flex items-center gap-1.5 bg-white/10 border border-white/10 text-white text-xs font-semibold px-3 py-2 rounded-xl active:scale-95 min-h-[36px]">
              <Phone size={13} /> התקשר
            </a>
          )}
        </div>

        {/* Greeting */}
        <div className="relative z-10 px-5 pt-6 pb-2">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-indigo-400 text-[10px] font-bold uppercase tracking-[0.15em]">פורטל לקוחות</p>
            <span className="bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[9px] font-black px-1.5 py-0.5 rounded-full tracking-wide uppercase">🧪 פיילוט</span>
          </div>
          <h1 className="text-3xl font-black text-white leading-tight">שלום, {ctx.customerName.split(' ')[0]}!</h1>
          <div className="flex gap-4 mt-4 pb-6">
            <div className="text-center">
              <p className="text-2xl font-black text-white">{totalVehicles}</p>
              <p className="text-indigo-300 text-[11px]">רכבים</p>
            </div>
            {pendingQuotes.length > 0 && (
              <div className="text-center">
                <p className="text-2xl font-black text-amber-400">{pendingQuotes.length}</p>
                <p className="text-indigo-300 text-[11px]">הצעות ממתינות</p>
              </div>
            )}
            {nextAppt && (
              <div className="text-center">
                <p className="text-lg font-black text-emerald-400">{new Date(nextAppt.scheduledAt).toLocaleDateString('he-IL', { day: '2-digit', month: 'short' })}</p>
                <p className="text-indigo-300 text-[11px]">תור הבא</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* Primary CTA */}
        <Link
          href="/portal/book-service"
          className="flex items-center gap-4 w-full bg-gradient-to-l from-indigo-600 to-indigo-500 text-white px-5 py-5 rounded-3xl shadow-xl shadow-indigo-200/60 active:scale-[0.98] transition-transform"
        >
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
            <CalendarPlus size={24} />
          </div>
          <div>
            <p className="font-black text-xl leading-tight">קביעת טיפול</p>
            <p className="text-indigo-200 text-sm mt-0.5">הצעת מחיר אוטומטית ותיאום תור</p>
          </div>
          <ChevronLeft size={22} className="mr-auto opacity-60" />
        </Link>

        {/* Pending quotes alert */}
        {pendingQuotes.map(q => (
          <Link
            key={q.id}
            href={`/portal/quotes/${q.id}`}
            className="flex items-center gap-4 bg-amber-50 border-2 border-amber-200 px-5 py-4 rounded-3xl active:scale-[0.98] transition-transform"
          >
            <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-2xl shrink-0">📋</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute h-full w-full rounded-full bg-amber-500 opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                </span>
                <p className="font-black text-amber-800">הצעת מחיר ממתינה לאישורך</p>
              </div>
              <p className="text-amber-700 text-sm truncate">{q.vehicle?.make} {q.vehicle?.plate} · {q.quoteNumber}</p>
            </div>
            <ChevronLeft size={18} className="text-amber-400 shrink-0" />
          </Link>
        ))}

        {/* Vehicles */}
        {(vehicles.length > 0 || nesherVehicles.length > 0) && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">הרכבים שלי</p>
              <Link href="/portal/vehicles" className="text-indigo-600 text-xs font-bold">הכל ›</Link>
            </div>
            <div className="space-y-2.5">
              {vehicles.map(v => (
                <Link
                  key={v.id}
                  href={`/portal/vehicles/${v.id}`}
                  className="flex items-center gap-3.5 bg-white rounded-2xl shadow-sm border border-slate-100 p-4 active:scale-[0.98] transition-transform"
                >
                  <div className="w-11 h-11 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
                    <Car size={22} className="text-indigo-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 truncate">{v.make} {v.model}</p>
                    <p className="text-slate-500 text-sm">{v.plate}{v.year ? ` · ${v.year}` : ''}{v.mileage ? ` · ${v.mileage.toLocaleString()} ק״מ` : ''}</p>
                  </div>
                  <ChevronLeft size={16} className="text-slate-300 shrink-0" />
                </Link>
              ))}
              {nesherVehicles.map(v => (
                <div key={v.car_no} className="flex items-center gap-3.5 bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
                  <div className="w-11 h-11 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
                    <Car size={22} className="text-indigo-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 truncate">{v.car_desc ?? v.car_no}</p>
                    <p className="text-slate-500 text-sm">{v.car_no}{v.last_km ? ` · ${v.last_km.toLocaleString()} ק״מ` : ''}</p>
                  </div>
                  <Link href={`/portal/book-service?plate=${encodeURIComponent(v.car_no)}`} className="text-indigo-600 text-xs font-bold whitespace-nowrap">
                    קבע טיפול ›
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming appointment */}
        {nextAppt && (
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">התור הבא שלי</p>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center shrink-0">
                  <CalendarClock size={22} className="text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-slate-800">
                    {new Date(nextAppt.scheduledAt).toLocaleDateString('he-IL', { weekday: 'long', day: '2-digit', month: 'long' })}
                  </p>
                  <p className="text-slate-500 text-sm">
                    {new Date(nextAppt.scheduledAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                    {nextAppt.vehicle && ` · ${nextAppt.vehicle.make} ${nextAppt.vehicle.model}`}
                  </p>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${nextAppt.status === 'CONFIRMED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  {nextAppt.status === 'CONFIRMED' ? 'מאושר' : 'ממתין לאישור'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Contact */}
        {org?.phone && (
          <a
            href={`tel:${org.phone}`}
            className="flex items-center gap-4 w-full bg-white border-2 border-slate-100 text-slate-800 px-5 py-4 rounded-3xl shadow-sm active:scale-[0.98] transition-all"
          >
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-2xl shrink-0">📞</div>
            <div>
              <p className="font-black text-lg leading-tight">צור קשר עם המוסך</p>
              <p className="text-slate-500 text-sm">{org.phone}</p>
            </div>
            <ChevronLeft size={18} className="mr-auto text-slate-300" />
          </a>
        )}

        {/* Logout */}
        <form action="/api/portal/auth/logout" method="POST">
          <button type="submit" className="w-full text-slate-400 text-sm py-3 hover:text-slate-600 transition-colors">
            התנתקות
          </button>
        </form>

      </div>
    </div>
  )
}

