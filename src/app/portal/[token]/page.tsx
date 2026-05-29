import Link                from 'next/link'
import { getPortalData, STATUS_CONFIG, type WOStatus } from '@/lib/portal'
import { StatusStepper }  from '@/components/portal/StatusStepper'
import { formatCurrency, toNum } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const FUEL_HE: Record<string, string> = {
  GASOLINE: 'בנזין', DIESEL: 'דיזל', HYBRID: 'היברידי',
  ELECTRIC: 'חשמלי', LPG: 'גז',
}

const STATUS_BG: Record<string, string> = {
  amber:   'bg-amber-50   border-amber-200   text-amber-700',
  indigo:  'bg-indigo-50  border-indigo-200  text-indigo-700',
  orange:  'bg-orange-50  border-orange-200  text-orange-700',
  emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  red:     'bg-red-50     border-red-200     text-red-700',
}

const STATUS_DOT: Record<string, string> = {
  amber:   'bg-amber-500',
  indigo:  'bg-indigo-500',
  orange:  'bg-orange-500',
  emerald: 'bg-emerald-500',
  red:     'bg-red-500',
}

export default async function PortalHomePage({ params }: { params: { token: string } }) {
  const wo  = await getPortalData(params.token)
  const st  = STATUS_CONFIG[wo.status as WOStatus]
  const v   = wo.vehicle
  const org = wo.organization

  const pendingQuote   = wo.quote?.status === 'SENT'
  const unpaidPayment  = wo.paymentLinks[0] && !wo.paymentLinks[0].paidAt
  const customerNotes  = wo.techNotes
  const totalPrice     = toNum(wo.totalPrice)

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">

      {/* ── Garage header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {org.logoUrl ? (
            <img src={org.logoUrl} alt={org.name} className="w-12 h-12 rounded-2xl object-cover shadow-sm" />
          ) : (
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-md shadow-indigo-200">
              <span className="text-white font-black text-xl">
                {org.name.charAt(0)}
              </span>
            </div>
          )}
          <div>
            <h1 className="font-bold text-slate-900 text-lg leading-tight">{org.name}</h1>
            {org.city && <p className="text-xs text-slate-500">{org.city}</p>}
          </div>
        </div>
        {org.phone && (
          <a
            href={`tel:${org.phone}`}
            className="flex items-center gap-1.5 bg-indigo-600 text-white text-sm font-semibold px-4 py-2.5 rounded-2xl shadow-md shadow-indigo-200 active:scale-95 transition-transform min-h-[44px]"
          >
            <span>📞</span>
            <span>התקשר</span>
          </a>
        )}
      </div>

      {/* ── Status hero card ───────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Status banner */}
        <div className={`flex items-center gap-3 px-5 py-4 border-b ${STATUS_BG[st.color]}`}>
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[st.color]} ${wo.status !== 'COMPLETED' && wo.status !== 'CANCELLED' ? 'animate-pulse' : ''}`} />
          <div className="flex-1">
            <p className={`font-bold text-lg leading-tight`}>{st.label}</p>
            <p className="text-sm opacity-75 mt-0.5">{st.description}</p>
          </div>
        </div>

        {/* Progress stepper */}
        <div className="px-5 py-5">
          <StatusStepper status={wo.status as WOStatus} />
        </div>
      </div>

      {/* ── Vehicle card ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">הרכב שלך</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold text-slate-900">{v.make} {v.model}</p>
            <p className="text-slate-500 text-sm mt-0.5">{v.year}{v.fuelType ? ` · ${FUEL_HE[v.fuelType] ?? v.fuelType}` : ''}{v.color ? ` · ${v.color}` : ''}</p>
          </div>
          <div className="text-left">
            <div className="bg-indigo-600 text-white font-mono font-bold text-sm px-3 py-1.5 rounded-xl shadow-md shadow-indigo-200">
              {v.plate}
            </div>
            {v.mileage && (
              <p className="text-xs text-slate-400 text-center mt-1">{v.mileage.toLocaleString('he-IL')} ק"מ</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Action CTAs ────────────────────────────────────────────────── */}
      {(pendingQuote || unpaidPayment) && (
        <div className="space-y-3">
          {pendingQuote && (
            <Link
              href={`/portal/${params.token}/quote`}
              className="flex items-center justify-between bg-amber-500 text-white px-5 py-4 rounded-2xl shadow-md shadow-amber-200 active:scale-[0.98] transition-transform min-h-[64px]"
            >
              <div>
                <p className="font-bold text-base">📋 הצעת מחיר ממתינה לאישורך</p>
                <p className="text-amber-100 text-sm">לחץ לצפייה ואישור</p>
              </div>
              <span className="text-2xl opacity-60">‹</span>
            </Link>
          )}
          {unpaidPayment && (
            <Link
              href={`/portal/${params.token}/pay`}
              className="flex items-center justify-between bg-indigo-600 text-white px-5 py-4 rounded-2xl shadow-md shadow-indigo-200 active:scale-[0.98] transition-transform min-h-[64px]"
            >
              <div>
                <p className="font-bold text-base">💳 סכום לתשלום</p>
                <p className="text-indigo-200 text-sm">{formatCurrency(toNum(wo.paymentLinks[0].amount))}</p>
              </div>
              <span className="text-2xl opacity-60">‹</span>
            </Link>
          )}
        </div>
      )}

      {/* ── Work order info ────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 space-y-3">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">פרטי הטיפול</p>

        {wo.complaint && (
          <div>
            <p className="text-xs text-slate-400 mb-1">תלונה</p>
            <p className="text-slate-800 text-sm leading-relaxed">{wo.complaint}</p>
          </div>
        )}
        {wo.diagnosis && (
          <div>
            <p className="text-xs text-slate-400 mb-1">אבחון</p>
            <p className="text-slate-800 text-sm leading-relaxed">{wo.diagnosis}</p>
          </div>
        )}

        <div className="flex items-center justify-between text-sm pt-1 border-t border-slate-100">
          <span className="text-slate-500">פקודה מס׳</span>
          <span className="font-mono font-bold text-indigo-600">{wo.workOrderNumber}</span>
        </div>

        {wo.assignedTechnician && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">טכנאי</span>
            <span className="font-semibold text-slate-700">{wo.assignedTechnician}</span>
          </div>
        )}

        {wo.receivedAt && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">תאריך קבלה</span>
            <span className="text-slate-700">{new Date(wo.receivedAt).toLocaleDateString('he-IL')}</span>
          </div>
        )}

        {totalPrice > 0 && (
          <div className="flex items-center justify-between text-sm pt-1 border-t border-slate-100">
            <span className="font-bold text-slate-700">עלות משוערת</span>
            <span className="font-bold text-indigo-600 text-base">{formatCurrency(totalPrice)}</span>
          </div>
        )}
      </div>

      {/* ── Technician notes (customer-visible) ───────────────────────── */}
      {customerNotes.length > 0 && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 space-y-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">עדכון מהטכנאי</p>
          {customerNotes.map(note => (
            <div key={note.id} className="flex gap-3">
              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center shrink-0 text-sm">🔧</div>
              <div>
                <p className="text-slate-800 text-sm leading-relaxed">{note.content}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {new Date(note.createdAt).toLocaleDateString('he-IL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Quick links ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href={`/portal/${params.token}/media`}
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col items-center gap-2 active:scale-95 transition-transform"
        >
          <span className="text-3xl">📷</span>
          <span className="text-sm font-semibold text-slate-700">תמונות ווידאו</span>
          {wo.media.length > 0 && (
            <span className="text-xs text-slate-400">{wo.media.length} קבצים</span>
          )}
        </Link>
        <Link
          href={`/portal/${params.token}/history`}
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col items-center gap-2 active:scale-95 transition-transform"
        >
          <span className="text-3xl">🕓</span>
          <span className="text-sm font-semibold text-slate-700">היסטוריית שירות</span>
        </Link>
      </div>

    </div>
  )
}
