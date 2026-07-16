import Link from 'next/link'
import { requireCustomerSession } from '@/lib/customer-auth'
import { prisma }                 from '@/lib/prisma'
import { CalendarPlus, CalendarClock, CheckCircle, Clock, XCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

function fmtDateTime(d: Date): string {
  return d.toLocaleDateString('he-IL', { weekday: 'long', day: '2-digit', month: 'long' }) +
    ' · ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
}

const STATUS: Record<string, { label: string; icon: typeof Clock; cls: string }> = {
  PENDING_CONFIRMATION: { label: 'ממתין לאישור', icon: Clock,         cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  CONFIRMED:            { label: 'מאושר',         icon: CheckCircle,  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CANCELLED:            { label: 'בוטל',          icon: XCircle,      cls: 'bg-red-50 text-red-600 border-red-200' },
}

export default async function AppointmentsPage() {
  const ctx = await requireCustomerSession()

  const now = new Date()
  const [upcoming, past] = await Promise.all([
    prisma.appointment.findMany({
      where:   { customerId: ctx.customerId, scheduledAt: { gte: now } },
      orderBy: { scheduledAt: 'asc' },
      include: { vehicle: { select: { plate: true, make: true, model: true } } },
    }),
    prisma.appointment.findMany({
      where:   { customerId: ctx.customerId, scheduledAt: { lt: now } },
      orderBy: { scheduledAt: 'desc' },
      take:    10,
      include: { vehicle: { select: { plate: true, make: true, model: true } } },
    }),
  ])

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-4" dir="rtl">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-black text-slate-800">התורים שלי</h1>
        <Link
          href="/portal/book-service"
          className="flex items-center gap-1.5 bg-indigo-600 text-white text-sm font-bold px-4 py-2.5 rounded-2xl shadow-md shadow-indigo-200/50"
        >
          <CalendarPlus size={16} /> תור חדש
        </Link>
      </div>

      {upcoming.length === 0 && past.length === 0 && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-10 text-center">
          <CalendarClock size={40} className="mx-auto text-slate-200 mb-3" />
          <p className="text-slate-500">אין תורים עדיין</p>
          <Link href="/portal/book-service" className="mt-4 inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-bold px-5 py-3 rounded-2xl">
            קבע/י תור ראשון
          </Link>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="space-y-3 mb-6">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">תורים קרובים</p>
          {upcoming.map(appt => {
            const st = STATUS[appt.status] ?? STATUS['PENDING_CONFIRMATION']
            return (
              <div key={appt.id} className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-black text-slate-800 text-lg leading-tight">
                      {new Date(appt.scheduledAt).toLocaleDateString('he-IL', { weekday: 'long', day: '2-digit', month: 'long' })}
                    </p>
                    <p className="text-indigo-600 font-bold text-sm mt-0.5">
                      {new Date(appt.scheduledAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                      {appt.durationMinutes && ` · ${appt.durationMinutes} דק׳`}
                    </p>
                    {appt.vehicle && (
                      <p className="text-slate-500 text-sm mt-1">{appt.vehicle.make} {appt.vehicle.model} · {appt.vehicle.plate}</p>
                    )}
                    {appt.notes && <p className="text-slate-400 text-xs mt-1">{appt.notes}</p>}
                  </div>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border whitespace-nowrap shrink-0 ${st.cls}`}>
                    {st.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {past.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">תורים קודמים</p>
          {past.map(appt => (
            <div key={appt.id} className="flex items-center gap-3 bg-white rounded-2xl border border-slate-100 px-4 py-3 opacity-70">
              <CalendarClock size={16} className="text-slate-300 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-600 truncate">{fmtDateTime(new Date(appt.scheduledAt))}</p>
                {appt.vehicle && <p className="text-xs text-slate-400">{appt.vehicle.plate}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
