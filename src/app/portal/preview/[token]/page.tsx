/**
 * /portal/preview/[token]
 *
 * OWNER-only secure customer preview.
 * Validates a short-lived CustomerPreviewToken and renders the customer portal
 * in read-only mode with a prominent admin banner.
 *
 * Auth: token-only (random 32-byte hex, 10-min expiry, created by OWNER API).
 * No customer session is created or modified.
 */
import Link             from 'next/link'
import { prisma }       from '@/lib/prisma'
import { nesherCustomer } from '@/lib/nesher-connector'
import { Car, CalendarPlus, CalendarClock, ChevronLeft, Phone, ShieldAlert } from 'lucide-react'

export const dynamic = 'force-dynamic'

function fmtDate(d: Date | string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('he-IL', { day: '2-digit', month: 'long', year: 'numeric' })
}

interface PageProps { params: { token: string } }

export default async function PreviewPage({ params }: PageProps) {
  const preview = await prisma.customerPreviewToken.findUnique({
    where:   { token: params.token },
    include: {
      customer: {
        include: {
          vehicles:     { orderBy: { updatedAt: 'desc' }, take: 10 },
          quotes:       {
            where:   { status: { in: ['SENT', 'DRAFT'] } },
            orderBy: { createdAt: 'desc' },
            take:    5,
            include: { vehicle: { select: { plate: true, make: true } } },
          },
          appointments: {
            where:   { scheduledAt: { gte: new Date() }, status: { not: 'CANCELLED' } },
            orderBy: { scheduledAt: 'asc' },
            take:    3,
            include: { vehicle: { select: { plate: true, make: true, model: true } } },
          },
        },
      },
    },
  })

  // Expired or not found
  if (!preview || preview.expiresAt < new Date()) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-slate-900 border border-red-800/40 rounded-3xl p-8 max-w-sm w-full text-center">
          <div className="w-14 h-14 bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldAlert size={28} className="text-red-400" />
          </div>
          <p className="text-xl font-black text-white mb-2">טוקן פג תוקף</p>
          <p className="text-slate-400 text-sm">
            {preview ? 'פג תוקף לאחר 10 דקות.' : 'טוקן לא חוקי.'}
          </p>
          <p className="text-slate-500 text-xs mt-3">
            צור טוקן חדש מ<Link href="/dashboard/customer-pilot" className="text-indigo-400 underline">לוח הפיילוט</Link>.
          </p>
        </div>
      </div>
    )
  }

  // Mark as viewed + audit on first open
  if (!preview.viewedAt) {
    await prisma.customerPreviewToken.update({
      where: { token: params.token },
      data:  { viewedAt: new Date() },
    })
    await prisma.auditLog.create({
      data: {
        organizationId: preview.organizationId,
        userId:         preview.createdById,
        action:         'UPDATE',
        entityType:     'CustomerPreviewToken',
        entityId:       preview.customerId,
        entityLabel:    preview.customer.name,
        afterData:      { event: 'preview_viewed', customerName: preview.customer.name },
      },
    })
  }

  const customer      = preview.customer
  const vehicles      = customer.vehicles
  const quotes        = customer.quotes
  const appointments  = customer.appointments
  const nextAppt      = appointments[0] ?? null
  const pendingQuotes = quotes.filter(q => q.status === 'SENT')

  // NESHER fallback for vehicles
  let nesherVehicles: Array<{ car_no: string; car_desc: string | null; last_km: number | null }> = []
  if (vehicles.length === 0 && customer.importSource === 'nesher' && customer.importId) {
    const data = await nesherCustomer(customer.importId)
    nesherVehicles = data?.vehicles ?? []
  }

  const totalVehicles = vehicles.length + nesherVehicles.length
  const org           = await prisma.organization.findUnique({
    where:  { id: preview.organizationId },
    select: { name: true, phone: true, logoUrl: true },
  })

  const minsLeft = Math.max(0, Math.round((preview.expiresAt.getTime() - Date.now()) / 60000))

  return (
    <div className="max-w-lg mx-auto" dir="rtl">

      {/* ── Admin preview banner ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-50 bg-amber-500 px-4 py-2.5 flex items-center gap-3 shadow-lg">
        <ShieldAlert size={18} className="text-amber-900 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-amber-900 font-black text-sm leading-tight">מצב תצוגת מנהל — אינך מחובר כלקוח אמיתי</p>
          <p className="text-amber-800 text-[11px]">מציג: {customer.name} · טוקן פג בעוד ~{minsLeft} דקות · כל הפעולות מושבתות</p>
        </div>
        <Link
          href="/dashboard/customer-pilot"
          className="shrink-0 bg-amber-900/20 border border-amber-800/40 text-amber-900 text-xs font-bold px-2.5 py-1 rounded-lg whitespace-nowrap"
        >
          ← חזור
        </Link>
      </div>

      {/* ── Portal content (read-only) ───────────────────────────────────────── */}
      <div className="relative bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-800 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 80% 60% at 60% 20%, rgba(99,102,241,0.18) 0%, transparent 70%)' }}
        />

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
            <div className="flex items-center gap-1.5 bg-white/10 border border-white/10 text-white/60 text-xs font-semibold px-3 py-2 rounded-xl cursor-not-allowed min-h-[36px]"
                 title="מושבת במצב תצוגה">
              <Phone size={13} /> התקשר
            </div>
          )}
        </div>

        {/* Greeting */}
        <div className="relative z-10 px-5 pt-6 pb-2">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-indigo-400 text-[10px] font-bold uppercase tracking-[0.15em]">פורטל לקוחות</p>
            <span className="bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[9px] font-black px-1.5 py-0.5 rounded-full tracking-wide uppercase">🧪 פיילוט</span>
          </div>
          <h1 className="text-3xl font-black text-white leading-tight">
            שלום, {customer.name.split(' ')[0]}!
          </h1>
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
                <p className="text-lg font-black text-emerald-400">
                  {new Date(nextAppt.scheduledAt).toLocaleDateString('he-IL', { day: '2-digit', month: 'short' })}
                </p>
                <p className="text-indigo-300 text-[11px]">תור הבא</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* Primary CTA — disabled in preview */}
        <div
          className="flex items-center gap-4 w-full bg-slate-300/60 text-slate-500 px-5 py-5 rounded-3xl cursor-not-allowed select-none"
          title="מושבת במצב תצוגת מנהל"
        >
          <div className="w-12 h-12 bg-white/40 rounded-2xl flex items-center justify-center shrink-0">
            <CalendarPlus size={24} />
          </div>
          <div>
            <p className="font-black text-xl leading-tight">קביעת טיפול</p>
            <p className="text-slate-400 text-sm mt-0.5">מושבת במצב תצוגה</p>
          </div>
        </div>

        {/* Pending quotes — read-only */}
        {pendingQuotes.map(q => (
          <div
            key={q.id}
            className="flex items-center gap-4 bg-amber-50 border-2 border-amber-200 px-5 py-4 rounded-3xl opacity-75 cursor-not-allowed"
            title="מושבת במצב תצוגת מנהל"
          >
            <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-2xl shrink-0">📋</div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-amber-800">הצעת מחיר ממתינה לאישורך</p>
              <p className="text-amber-700 text-sm truncate">{q.vehicle?.make} {q.vehicle?.plate} · {q.quoteNumber}</p>
            </div>
          </div>
        ))}

        {/* Vehicles */}
        {(vehicles.length > 0 || nesherVehicles.length > 0) && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">הרכבים שלי</p>
            </div>
            <div className="space-y-2.5">
              {vehicles.map(v => (
                <div
                  key={v.id}
                  className="flex items-center gap-3.5 bg-white rounded-2xl shadow-sm border border-slate-100 p-4"
                >
                  <div className="w-11 h-11 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
                    <Car size={22} className="text-indigo-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 truncate">{v.make} {v.model}</p>
                    <p className="text-slate-500 text-sm">{v.plate}{v.year ? ` · ${v.year}` : ''}</p>
                  </div>
                </div>
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
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Next appointment */}
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

        {/* Contact — disabled in preview */}
        {org?.phone && (
          <div
            className="flex items-center gap-4 w-full bg-white border-2 border-slate-100 text-slate-400 px-5 py-4 rounded-3xl cursor-not-allowed"
            title="מושבת במצב תצוגת מנהל"
          >
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-2xl shrink-0">📞</div>
            <div>
              <p className="font-black text-lg leading-tight text-slate-400">צור קשר עם המוסך</p>
              <p className="text-slate-400 text-sm">{org.phone}</p>
            </div>
          </div>
        )}

        {/* Preview footer */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center mt-2">
          <p className="text-amber-700 text-sm font-bold">תצוגת מנהל — קריאה בלבד</p>
          <p className="text-amber-600 text-xs mt-1">כל הפעולות מושבתות. הטוקן פג בעוד ~{minsLeft} דקות.</p>
          <Link
            href="/dashboard/customer-pilot"
            className="inline-block mt-3 text-indigo-600 text-xs font-bold underline"
          >
            ← חזור ללוח הפיילוט
          </Link>
        </div>

      </div>
    </div>
  )
}
