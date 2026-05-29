import Link              from 'next/link'
import { getPortalData } from '@/lib/portal'
import { formatCurrency, toNum } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function PortalPayPage({ params }: { params: { token: string } }) {
  const wo   = await getPortalData(params.token)
  const link = wo.paymentLinks[0] ?? null

  const paid    = !!link?.paidAt
  const expired = link?.expiresAt ? link.expiresAt < new Date() : false

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">

      <div>
        <h2 className="text-2xl font-bold text-slate-900">תשלום</h2>
        <p className="text-slate-500 text-sm mt-1">
          {wo.vehicle.make} {wo.vehicle.model} · {wo.vehicle.plate}
        </p>
      </div>

      {/* No payment link */}
      {!link && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-10 text-center">
          <span className="text-5xl block mb-4">💳</span>
          <p className="font-semibold text-slate-700">אין קישור תשלום פעיל</p>
          <p className="text-sm text-slate-400 mt-1">המוסך ישלח קישור תשלום בסיום העבודה</p>
        </div>
      )}

      {/* Paid state */}
      {link && paid && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-8 text-center space-y-3">
          <span className="text-6xl block">✅</span>
          <p className="font-black text-emerald-700 text-2xl">{formatCurrency(toNum(link.amount))}</p>
          <p className="font-bold text-emerald-700">שולם בהצלחה!</p>
          <p className="text-sm text-emerald-600">
            {link.paidAt?.toLocaleDateString('he-IL', {
              day: '2-digit', month: 'long', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </p>
        </div>
      )}

      {/* Expired state */}
      {link && !paid && expired && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 text-center space-y-3">
          <span className="text-5xl block">⏰</span>
          <p className="font-bold text-slate-700 text-lg">קישור התשלום פג תוקף</p>
          <p className="text-sm text-slate-500">צור קשר עם המוסך לקבלת קישור חדש</p>
          {wo.organization.phone && (
            <a
              href={`tel:${wo.organization.phone}`}
              className="inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-bold px-5 py-3 rounded-xl shadow-md shadow-indigo-200"
            >
              📞 {wo.organization.phone}
            </a>
          )}
        </div>
      )}

      {/* Active payment */}
      {link && !paid && !expired && (
        <>
          {/* Amount card */}
          <div className="bg-indigo-600 rounded-3xl shadow-xl shadow-indigo-200 p-8 text-center text-white space-y-2">
            <p className="text-indigo-200 text-sm font-medium uppercase tracking-widest">סכום לתשלום</p>
            <p className="font-black text-5xl">{formatCurrency(toNum(link.amount))}</p>
            {link.description && (
              <p className="text-indigo-200 text-sm mt-2">{link.description}</p>
            )}
          </div>

          {/* Details */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">פקודת עבודה</span>
              <span className="font-mono font-bold text-indigo-600">{wo.workOrderNumber}</span>
            </div>
            {link.expiresAt && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">בתוקף עד</span>
                <span className="font-medium text-slate-700">
                  {link.expiresAt.toLocaleDateString('he-IL')}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">המוסך</span>
              <span className="font-medium text-slate-700">{wo.organization.name}</span>
            </div>
          </div>

          {/* Pay button — links to the existing /pay/[token] page */}
          <Link
            href={`/pay/${link.token}`}
            className="flex items-center justify-center gap-3 w-full bg-emerald-600 text-white font-black text-lg px-6 py-5 rounded-2xl shadow-lg shadow-emerald-200 active:scale-[0.98] transition-transform min-h-[68px]"
          >
            <span className="text-2xl">💳</span>
            שלם עכשיו
          </Link>

          <p className="text-center text-xs text-slate-400">
            תשלום מאובטח · מועבר ישירות למוסך
          </p>
        </>
      )}

    </div>
  )
}
