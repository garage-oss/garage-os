import Link              from 'next/link'
import { getPortalData } from '@/lib/portal'
import { formatCurrency, toNum } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function PortalPayPage({ params }: { params: { token: string } }) {
  const wo   = await getPortalData(params.token)
  const link = wo.paymentLinks[0] ?? null

  const paid    = !!link?.paidAt
  const expired = link?.expiresAt ? link.expiresAt < new Date() : false

  const waPhone = wo.organization.phone
    ? `972${wo.organization.phone.replace(/^0/, '').replace(/\D/g, '')}`
    : null

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">

      <div>
        <h2 className="text-2xl font-bold text-slate-900">תשלום</h2>
        <p className="text-slate-500 text-sm mt-1">
          {wo.vehicle.make} {wo.vehicle.model} · {wo.vehicle.plate}
        </p>
      </div>

      {/* ── No payment link ─────────────────────────────────────────────── */}
      {!link && (
        <div className="space-y-3">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-10 text-center space-y-3">
            <span className="text-5xl block">💳</span>
            <p className="font-semibold text-slate-700">עדיין אין קישור תשלום</p>
            <p className="text-sm text-slate-400 leading-relaxed">
              קישור לתשלום יישלח אליך בסיום העבודה
            </p>
          </div>
          {/* Guide customer to check car status instead of waiting */}
          <Link
            href={`/portal/${params.token}/timeline`}
            className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-sm active:scale-[0.98] transition-transform min-h-[60px]"
          >
            <div>
              <p className="font-bold text-slate-800">📊 ראה מצב הטיפול</p>
              <p className="text-sm text-slate-400">עקוב אחר ההתקדמות בזמן אמת</p>
            </div>
            <span className="text-slate-300 text-xl">›</span>
          </Link>
        </div>
      )}

      {/* ── Paid ────────────────────────────────────────────────────────── */}
      {link && paid && (
        <div className="space-y-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-8 text-center space-y-3">
            <span className="text-6xl block">✅</span>
            <p className="font-black text-emerald-700 text-3xl tabular-nums">{formatCurrency(toNum(link.amount))}</p>
            <p className="font-bold text-emerald-700 text-lg">שולם בהצלחה!</p>
            <p className="text-sm text-emerald-600">
              {link.paidAt?.toLocaleDateString('he-IL', {
                day: '2-digit', month: 'long', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
          </div>

          {/* Receipt-like card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">פרטי תשלום</p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">עבור</span>
              <span className="font-semibold text-slate-700">{wo.vehicle.make} {wo.vehicle.model}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">מוסך</span>
              <span className="font-semibold text-slate-700">{wo.organization.name}</span>
            </div>
            {link.description && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">תיאור</span>
                <span className="font-semibold text-slate-700 text-right max-w-[60%]">{link.description}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-100">
              <span className="text-slate-400 text-xs">שמור תשלום זה כאסמכתא</span>
              <span className="text-xs text-slate-400 font-mono">#{link.token.slice(-6).toUpperCase()}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Expired ─────────────────────────────────────────────────────── */}
      {link && !paid && expired && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 text-center space-y-4">
          <span className="text-5xl block">⏰</span>
          <div>
            <p className="font-bold text-slate-700 text-lg">קישור התשלום פג תוקף</p>
            <p className="text-sm text-slate-500 mt-1">צור קשר איתנו לקבלת קישור חדש</p>
          </div>
          <div className="space-y-2.5">
            {wo.organization.phone && (
              <a
                href={`tel:${wo.organization.phone}`}
                className="flex items-center justify-center gap-2 bg-indigo-600 text-white text-sm font-semibold px-5 py-3.5 rounded-xl min-h-[52px]"
              >
                📞 התקשר אלינו
              </a>
            )}
            {waPhone && (
              <a
                href={`https://wa.me/${waPhone}?text=${encodeURIComponent('שלום, קישור התשלום שלי פג תוקף. אשמח לקבל קישור חדש.')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-green-600 text-white text-sm font-semibold px-5 py-3.5 rounded-xl min-h-[52px]"
              >
                💬 שלח הודעה בווטסאפ
              </a>
            )}
          </div>
        </div>
      )}

      {/* ── Active payment ───────────────────────────────────────────────── */}
      {link && !paid && !expired && (
        <>
          {/* Amount hero */}
          <div className="bg-indigo-600 rounded-3xl shadow-xl shadow-indigo-200 p-8 text-center text-white space-y-2">
            <p className="text-indigo-300 text-xs font-semibold uppercase tracking-widest">סכום לתשלום</p>
            <p className="font-black text-5xl tabular-nums">{formatCurrency(toNum(link.amount))}</p>
            {link.description && (
              <p className="text-indigo-200 text-sm mt-1 leading-relaxed">{link.description}</p>
            )}
          </div>

          {/* Details — customer-friendly labels (no WO number) */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">עבור</span>
              <span className="font-semibold text-slate-700">{wo.vehicle.make} {wo.vehicle.model}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">מוסך</span>
              <span className="font-semibold text-slate-700">{wo.organization.name}</span>
            </div>
            {link.expiresAt && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">בתוקף עד</span>
                <span className="font-medium text-slate-700">
                  {link.expiresAt.toLocaleDateString('he-IL', { day: '2-digit', month: 'long', year: 'numeric' })}
                </span>
              </div>
            )}
          </div>

          {/* Pay button */}
          <Link
            href={`/pay/${link.token}`}
            className="flex items-center justify-center gap-3 w-full bg-emerald-600 text-white font-black text-lg px-6 py-5 rounded-2xl shadow-lg shadow-emerald-200 active:scale-[0.98] transition-transform min-h-[68px]"
          >
            <span className="text-2xl">💳</span>
            שלם עכשיו
          </Link>

          {/* Trust note — more visible */}
          <div className="flex items-center justify-center gap-2 text-slate-500 text-sm">
            <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>תשלום מאובטח · מועבר ישירות ל{wo.organization.name}</span>
          </div>
        </>
      )}

    </div>
  )
}
