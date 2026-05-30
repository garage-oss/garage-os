import { notFound }       from 'next/navigation'
import Link               from 'next/link'
import { getPortalData }  from '@/lib/portal'
import { QuoteActions }   from '@/components/portal/QuoteActions'
import { formatCurrency, toNum } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const QUOTE_STATUS: Record<string, { icon: string; label: string; style: string }> = {
  DRAFT:    { icon: '⏳', label: 'הצעת המחיר בהכנה',   style: 'bg-slate-50   border-slate-200   text-slate-600'   },
  SENT:     { icon: '📋', label: 'ממתינה לאישורך',      style: 'bg-amber-50   border-amber-200   text-amber-700'   },
  APPROVED: { icon: '✅', label: 'אושרה — תודה!',       style: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  REJECTED: { icon: '❌', label: 'נדחתה',                style: 'bg-red-50     border-red-200     text-red-700'     },
}

export default async function QuotePage({ params }: { params: { token: string } }) {
  const wo = await getPortalData(params.token)
  if (!wo.quote) notFound()

  const q          = wo.quote
  const qst        = QUOTE_STATUS[q.status] ?? QUOTE_STATUS.SENT
  const laborTotal = toNum(q.laborHours) * toNum(q.laborRate)
  const partsTotal = toNum(q.partsTotal)
  const subtotal   = laborTotal + partsTotal
  const vatAmount  = Math.round(subtotal * 0.17 * 100) / 100
  const total      = toNum(q.totalPrice)
  const canAct     = q.status === 'SENT'

  // Don't show full quote details while still a draft — garage hasn't sent it yet
  if (q.status === 'DRAFT') {
    return (
      <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">הצעת מחיר</h2>
          <p className="text-slate-500 text-sm mt-1">
            {wo.vehicle.make} {wo.vehicle.model} · {wo.vehicle.plate}
          </p>
        </div>
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-10 text-center space-y-3">
          <span className="text-5xl block">🔍</span>
          <p className="font-bold text-slate-700 text-lg">הצעת המחיר בהכנה</p>
          <p className="text-sm text-slate-400 leading-relaxed">
            הצוות שלנו בודק את הרכב ומכין הצעה מותאמת אישית.<br />
            נשלח אליך הודעה ברגע שהיא מוכנה.
          </p>
          <Link
            href={`/portal/${params.token}/timeline`}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-semibold px-5 py-3 rounded-xl mt-2"
          >
            📊 ראה מצב טיפול
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">

      <div>
        <h2 className="text-2xl font-bold text-slate-900">הצעת מחיר</h2>
        <p className="text-slate-500 text-sm mt-1">
          {wo.vehicle.make} {wo.vehicle.model} · {wo.vehicle.plate}
        </p>
      </div>

      {/* Status banner — no quote number shown to customer */}
      <div className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border font-semibold ${qst.style}`}>
        <span className="text-xl">{qst.icon}</span>
        <div className="flex-1">
          <p className="font-bold">{qst.label}</p>
          {q.validUntil && q.status === 'SENT' && (
            <p className="text-xs opacity-70 font-normal mt-0.5">
              בתוקף עד {new Date(q.validUntil).toLocaleDateString('he-IL')}
            </p>
          )}
        </div>
      </div>

      {/* Line items */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <p className="font-bold text-slate-900">פירוט עבודה וחלקים</p>
        </div>

        <div className="divide-y divide-slate-50">
          {q.items.map(item => (
            <div key={item.id} className="flex items-center justify-between px-5 py-3.5">
              <div className="flex-1 min-w-0 ml-3">
                <p className="text-sm font-medium text-slate-800">{item.description}</p>
                <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                  {item.quantity} יח׳ × {formatCurrency(toNum(item.unitPrice))}
                </p>
              </div>
              <p className="font-bold text-slate-900 text-sm shrink-0">{formatCurrency(toNum(item.total))}</p>
            </div>
          ))}

          {laborTotal > 0 && (
            <div className="flex items-center justify-between px-5 py-3.5">
              <div className="flex-1 min-w-0 ml-3">
                <p className="text-sm font-medium text-slate-800">שכר עבודה</p>
                <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                  {toNum(q.laborHours)} שעות × {formatCurrency(toNum(q.laborRate))} לשעה
                </p>
              </div>
              <p className="font-bold text-slate-900 text-sm shrink-0">{formatCurrency(laborTotal)}</p>
            </div>
          )}
        </div>

        {/* VAT breakdown + total */}
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50 space-y-2">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>סכום לפני מע״מ</span>
            <span className="font-mono tabular-nums">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>מע״מ 17%</span>
            <span className="font-mono tabular-nums">{formatCurrency(vatAmount)}</span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
            <p className="font-bold text-slate-900 text-base">סה״כ לתשלום</p>
            <p className="font-black text-indigo-600 text-2xl tabular-nums">{formatCurrency(total)}</p>
          </div>
        </div>
      </div>

      {/* Estimate disclaimer */}
      {q.isEstimate && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-start gap-2.5">
          <span className="text-lg shrink-0 mt-0.5">⚠️</span>
          <p className="text-sm text-amber-700 leading-relaxed">
            <strong>הצעה ראשונית — הערכה בלבד.</strong> המחיר הסופי יאושר לאחר בדיקת הרכב ועשוי להשתנות.
          </p>
        </div>
      )}

      {/* Notes */}
      {q.notes && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">הערות</p>
          <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{q.notes}</p>
        </div>
      )}

      {/* Action buttons */}
      {canAct && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 space-y-3">
          <p className="text-sm font-bold text-slate-700">האם לאשר את הצעת המחיר?</p>
          <QuoteActions quoteId={q.id} workOrderId={wo.id} />
        </div>
      )}

      {/* Post-approval — guidance on what happens next */}
      {q.status === 'APPROVED' && (
        <div className="space-y-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 text-center space-y-2">
            <span className="text-5xl block">🎉</span>
            <p className="font-bold text-emerald-700 text-xl">ההצעה אושרה!</p>
            <p className="text-sm text-emerald-600">תודה — הטכנאי יתחיל בטיפול בהקדם</p>
          </div>
          <Link
            href={`/portal/${params.token}/timeline`}
            className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-sm active:scale-[0.98] transition-transform min-h-[60px]"
          >
            <div>
              <p className="font-bold text-slate-800">📊 עקוב אחר הטיפול</p>
              <p className="text-sm text-slate-400">ראה את התקדמות הרכב בזמן אמת</p>
            </div>
            <span className="text-slate-300 text-xl">›</span>
          </Link>
        </div>
      )}

      {/* Post-rejection — helpful guidance */}
      {q.status === 'REJECTED' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4">
          <div className="text-center">
            <span className="text-4xl block mb-2">🤝</span>
            <p className="font-semibold text-slate-700 text-lg">ההצעה נדחתה</p>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
              צור קשר איתנו — נשמח למצוא פתרון מתאים עבורך
            </p>
          </div>
          <div className="space-y-2">
            {wo.organization.phone && (
              <a
                href={`tel:${wo.organization.phone}`}
                className="flex items-center justify-center gap-2 bg-indigo-600 text-white text-sm font-semibold px-5 py-3.5 rounded-xl min-h-[52px]"
              >
                📞 התקשר אלינו
              </a>
            )}
            {wo.organization.phone && (
              <a
                href={`https://wa.me/972${wo.organization.phone.replace(/^0/, '').replace(/\D/g, '')}`}
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

    </div>
  )
}
