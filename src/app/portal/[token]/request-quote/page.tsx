import { getPortalData }       from '@/lib/portal'
import { QuoteRequestForm }    from '@/components/portal/QuoteRequestForm'
import { SERVICE_TYPE_LABELS, SERVICE_TYPE_ICONS, URGENCY_LABELS } from '@/lib/quote-engine'
import Link                    from 'next/link'

export const dynamic = 'force-dynamic'

const STATUS_CONFIG = {
  PENDING:   { icon: '⏳', title: 'הבקשה התקבלה',                  body: 'הצעת המחיר נוצרת אוטומטית...', style: 'bg-amber-50 border-amber-200 text-amber-700'   },
  REVIEWING: { icon: '🔍', title: 'הצעת המחיר בהכנה',              body: 'המוסך בודק ומשלים את הפרטים',  style: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
  SENT:      { icon: '📋', title: 'הצעת המחיר מוכנה לאישורך!',      body: 'לחץ לצפייה ואישור',            style: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  RESOLVED:  { icon: '✅', title: 'הבקשה טופלה',                   body: 'הצעת המחיר הושלמה',            style: 'bg-slate-50 border-slate-200 text-slate-600'    },
  CANCELLED: { icon: '❌', title: 'הבקשה בוטלה',                   body: 'צור קשר עם המוסך לפרטים',      style: 'bg-slate-50 border-slate-200 text-slate-600'    },
}

export default async function RequestQuotePage({ params }: { params: { token: string } }) {
  const wo = await getPortalData(params.token)
  const qr = wo.quoteRequest ?? null

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-5 pb-2">

      <div>
        <h2 className="text-2xl font-bold text-slate-900">בקשת הצעת מחיר</h2>
        <p className="text-slate-500 text-sm mt-1">
          {wo.vehicle.make} {wo.vehicle.model} · {wo.vehicle.plate}
        </p>
      </div>

      {/* Existing request — show status */}
      {qr && (() => {
        const st = STATUS_CONFIG[qr.status]
        return (
          <div className="space-y-4">
            {/* Status banner */}
            <div className={`flex items-start gap-4 rounded-3xl border p-5 ${st.style}`}>
              <span className="text-4xl shrink-0">{st.icon}</span>
              <div>
                <p className="font-bold text-lg leading-tight">{st.title}</p>
                <p className="text-sm opacity-75 mt-1">{st.body}</p>
              </div>
            </div>

            {/* Request details card */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 space-y-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">פרטי הבקשה</p>

              <div className="flex items-center gap-3">
                <span className="text-2xl">{SERVICE_TYPE_ICONS[qr.serviceType]}</span>
                <div>
                  <p className="font-semibold text-slate-800">{SERVICE_TYPE_LABELS[qr.serviceType]}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    דחיפות: {URGENCY_LABELS[qr.urgency]}
                  </p>
                </div>
              </div>

              {qr.description && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-sm text-slate-600 leading-relaxed">{qr.description}</p>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-50">
                <span>הוגשה בתאריך</span>
                <span>{new Date(qr.createdAt).toLocaleDateString('he-IL', {
                  day: '2-digit', month: 'long', year: 'numeric',
                })}</span>
              </div>
            </div>

            {/* CTA when sent */}
            {qr.status === 'SENT' && wo.quote && (
              <Link
                href={`/portal/${params.token}/quote`}
                className="flex items-center justify-between bg-emerald-600 text-white px-5 py-4 rounded-2xl shadow-md shadow-emerald-200 active:scale-[0.98] transition-transform min-h-[64px]"
              >
                <div>
                  <p className="font-bold text-base">📋 הצעת המחיר מחכה לך</p>
                  <p className="text-emerald-100 text-sm">לחץ לצפייה ואישור</p>
                </div>
                <span className="text-2xl opacity-60">‹</span>
              </Link>
            )}
          </div>
        )
      })()}

      {/* No existing request — show form */}
      {!qr && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5">
          <QuoteRequestForm token={params.token} />
        </div>
      )}

    </div>
  )
}
