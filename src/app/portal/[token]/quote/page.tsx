import { notFound }       from 'next/navigation'
import { getPortalData }  from '@/lib/portal'
import { QuoteActions }   from '@/components/portal/QuoteActions'
import { formatCurrency, toNum } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const QUOTE_STATUS: Record<string, { icon: string; label: string; style: string }> = {
  DRAFT:    { icon: '📝', label: 'טיוטה',           style: 'bg-slate-50   border-slate-200   text-slate-600'   },
  SENT:     { icon: '⏳', label: 'ממתינה לאישורך',  style: 'bg-amber-50   border-amber-200   text-amber-700'   },
  APPROVED: { icon: '✅', label: 'אושרה — תודה!',   style: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  REJECTED: { icon: '❌', label: 'נדחתה',            style: 'bg-red-50     border-red-200     text-red-700'     },
}

export default async function QuotePage({ params }: { params: { token: string } }) {
  const wo = await getPortalData(params.token)
  if (!wo.quote) notFound()

  const q          = wo.quote
  const qst        = QUOTE_STATUS[q.status] ?? QUOTE_STATUS.SENT
  const laborTotal = toNum(q.laborHours) * toNum(q.laborRate)
  const canAct     = q.status === 'SENT'

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">

      <div>
        <h2 className="text-2xl font-bold text-slate-900">הצעת מחיר</h2>
        <p className="text-slate-500 text-sm mt-1">
          {wo.vehicle.make} {wo.vehicle.model} · {wo.vehicle.plate}
        </p>
      </div>

      {/* Status banner */}
      <div className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border font-semibold ${qst.style}`}>
        <span className="text-xl">{qst.icon}</span>
        <div>
          <p className="font-bold">{qst.label}</p>
          <p className="text-xs opacity-75 font-normal">הצעה מס׳ {q.quoteNumber}</p>
        </div>
        {q.validUntil && (
          <p className="mr-auto text-xs opacity-60 font-normal">
            בתוקף עד {new Date(q.validUntil).toLocaleDateString('he-IL')}
          </p>
        )}
      </div>

      {/* Line items */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <p className="font-bold text-slate-900">פירוט עבודה וחלקים</p>
        </div>

        <div className="divide-y divide-slate-50">
          {q.items.map(item => (
            <div key={item.id} className="flex items-center justify-between px-5 py-3.5">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800">{item.description}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {item.quantity} יח׳ × {formatCurrency(toNum(item.unitPrice))}
                </p>
              </div>
              <p className="font-bold text-slate-900 text-sm">{formatCurrency(toNum(item.total))}</p>
            </div>
          ))}

          {laborTotal > 0 && (
            <div className="flex items-center justify-between px-5 py-3.5">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800">שכר עבודה</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {toNum(q.laborHours)} שעות × ₪{toNum(q.laborRate)}
                </p>
              </div>
              <p className="font-bold text-slate-900 text-sm">{formatCurrency(laborTotal)}</p>
            </div>
          )}
        </div>

        {/* Total */}
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <p className="font-bold text-slate-900 text-base">סה"כ לתשלום</p>
            <p className="font-black text-indigo-600 text-2xl">{formatCurrency(toNum(q.totalPrice))}</p>
          </div>
        </div>
      </div>

      {/* Notes */}
      {q.notes && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">הערות ותנאים</p>
          <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{q.notes}</p>
        </div>
      )}

      {/* Action buttons */}
      {canAct && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 space-y-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">תגובתך</p>
          <QuoteActions quoteId={q.id} workOrderId={wo.id} />
        </div>
      )}

      {q.status === 'APPROVED' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-5 text-center">
          <span className="text-4xl block mb-2">🎉</span>
          <p className="font-bold text-emerald-700 text-lg">ההצעה אושרה!</p>
          <p className="text-sm text-emerald-600 mt-1">תודה — נמשיך בעבודה בהקדם</p>
        </div>
      )}

      {q.status === 'REJECTED' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-5 text-center">
          <p className="font-semibold text-slate-700">ההצעה נדחתה</p>
          <p className="text-sm text-slate-500 mt-1">צור קשר עם המוסך לתיאום</p>
          {wo.organization.phone && (
            <a
              href={`tel:${wo.organization.phone}`}
              className="inline-flex items-center gap-2 mt-3 bg-indigo-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl"
            >
              📞 {wo.organization.phone}
            </a>
          )}
        </div>
      )}

    </div>
  )
}
