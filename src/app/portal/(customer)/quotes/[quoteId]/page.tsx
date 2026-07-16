import { notFound }               from 'next/navigation'
import Link from 'next/link'
import { requireCustomerSession } from '@/lib/customer-auth'
import { prisma }                 from '@/lib/prisma'
import { CustomerQuoteActions }   from '@/components/portal/CustomerQuoteActions'
import { ChevronRight, Car, FileText, Calendar } from 'lucide-react'

export const dynamic = 'force-dynamic'

const VAT_RATE = parseFloat(process.env.VAT_RATE ?? '0.17')

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—'
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: 'long', year: 'numeric' })
}

function fmtILS(n: number | string | null | undefined): string {
  const v = typeof n === 'string' ? parseFloat(n) : (n ?? 0)
  return v.toLocaleString('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 0 })
}

interface Props { params: { quoteId: string } }

export default async function CustomerQuotePage({ params }: Props) {
  const ctx = await requireCustomerSession()

  const quote = await prisma.quote.findFirst({
    where: { id: params.quoteId, customerId: ctx.customerId, organizationId: ctx.organizationId },
    include: {
      vehicle: { select: { plate: true, make: true, model: true, year: true } },
      items:   { orderBy: { id: 'asc' } },
      portalResponses: { orderBy: { createdAt: 'desc' }, take: 1, select: { action: true } },
    },
  })

  if (!quote) notFound()

  const subtotal   = quote.items.reduce((s, it) => s + parseFloat(it.total.toString()), 0)
  const vatAmount  = Math.round(subtotal * VAT_RATE * 100) / 100
  const total      = subtotal + vatAmount

  const alreadyResponded = ['APPROVED', 'REJECTED'].includes(quote.status) ||
    (quote.portalResponses.length > 0 && ['APPROVED', 'REJECTED'].includes(quote.portalResponses[0].action))

  const isExpired = quote.portalTokenExpiresAt ? quote.portalTokenExpiresAt < new Date() : false

  const STATUS_MAP: Record<string, { label: string; cls: string }> = {
    DRAFT:    { label: 'טיוטה',       cls: 'bg-slate-100 text-slate-600' },
    SENT:     { label: 'ממתין לאישור', cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
    APPROVED: { label: 'אושרה',       cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
    REJECTED: { label: 'נדחתה',       cls: 'bg-red-50 text-red-600 border border-red-200' },
  }
  const badge = STATUS_MAP[quote.status] ?? STATUS_MAP['DRAFT']

  return (
    <div className="max-w-lg mx-auto" dir="rtl">
      {/* Hero */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-800 px-5 pt-5 pb-10">
        <Link href="/portal" className="flex items-center gap-1 text-indigo-300 text-sm mb-4">
          <ChevronRight size={16} /> חזרה לפורטל
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-indigo-400 text-[10px] font-bold uppercase tracking-widest mb-1">הצעת מחיר</p>
            <h1 className="text-3xl font-black text-white">{quote.quoteNumber}</h1>
          </div>
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${badge.cls}`}>{badge.label}</span>
        </div>
        {quote.validUntil && (
          <p className="text-indigo-300/70 text-xs mt-2 flex items-center gap-1.5">
            <Calendar size={12} /> בתוקף עד {fmtDate(quote.validUntil)}
          </p>
        )}
      </div>

      <div className="px-4 -mt-4 space-y-4">
        {/* Vehicle */}
        {quote.vehicle && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
              <Car size={20} className="text-indigo-500" />
            </div>
            <div>
              <p className="font-bold text-slate-800">{quote.vehicle.make} {quote.vehicle.model}</p>
              <p className="text-slate-500 text-sm font-mono">{quote.vehicle.plate}{quote.vehicle.year ? ` · ${quote.vehicle.year}` : ''}</p>
            </div>
          </div>
        )}

        {/* Estimate warning */}
        {quote.isEstimate && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 text-sm text-amber-700">
            <p className="font-semibold">הצעה לאבחון בלבד</p>
            <p className="text-xs mt-0.5">לאחר האבחון נציג הצעה מפורטת לתיקון. הפריטים הם הערכה בלבד.</p>
          </div>
        )}

        {/* Items */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-50">
            <FileText size={15} className="text-indigo-400" />
            <p className="font-bold text-slate-700 text-sm">פירוט ההצעה</p>
          </div>
          <div className="divide-y divide-slate-50">
            {quote.items.map(item => (
              <div key={item.id} className="flex items-center justify-between px-5 py-3.5 gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm truncate">{item.description}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {item.itemType !== 'labor'
                      ? `${item.quantity} × ₪${item.unitPrice}`
                      : `${item.laborHours} שעות עבודה`}
                    {parseFloat(item.discount.toString()) > 0 && ` · הנחה ${item.discount}%`}
                  </p>
                </div>
                <span className="font-bold text-slate-700 text-sm whitespace-nowrap">{fmtILS(item.total.toString())}</span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4 space-y-1.5">
            <div className="flex justify-between text-sm text-slate-500">
              <span>לפני מע״מ</span>
              <span className="font-mono">{fmtILS(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-500">
              <span>מע״מ {Math.round(VAT_RATE * 100)}%</span>
              <span className="font-mono">{fmtILS(vatAmount)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-200">
              <span className="font-bold text-slate-800">סה״כ לתשלום</span>
              <span className="font-black text-indigo-600 text-xl">{fmtILS(total)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {quote.notes && (
          <div className="bg-white rounded-2xl border border-slate-100 px-5 py-4 text-sm text-slate-600">
            <p className="text-xs text-slate-400 font-semibold mb-1">הערות</p>
            <p className="leading-relaxed">{quote.notes}</p>
          </div>
        )}

        {/* Actions */}
        {!isExpired && (
          <CustomerQuoteActions quoteId={quote.id} alreadyResponded={alreadyResponded} currentStatus={quote.status} />
        )}

        {isExpired && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4 text-sm text-amber-700 text-center">
            הצעה זו פגה תוקפה — צור/י קשר עם המוסך.
          </div>
        )}

      </div>
    </div>
  )
}
