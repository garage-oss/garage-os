import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, FileText, User, Car, Pencil } from 'lucide-react'
import { getQuote } from '@/lib/quotes'
import { requireOrg } from '@/lib/org'
import { QuoteStatusBadge } from '@/components/quotes/QuoteStatusBadge'
import { QuoteStatusActions } from '@/components/quotes/QuoteStatusActions'
import { DeleteButton } from '@/components/ui/DeleteButton'
import { PrintButton } from '@/components/ui/PrintButton'
import { deleteQuote } from '@/app/actions/quotes'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Props { params: { id: string } }

export const dynamic = 'force-dynamic'

export default async function QuoteDetailPage({ params }: Props) {
  const { orgId } = await requireOrg()
  const quote = await getQuote(orgId, params.id)
  if (!quote) notFound()

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-1.5 text-sm text-[#8892a4] mb-6">
        <Link href="/dashboard/quotes" className="hover:text-[#e2e8f0] transition-colors">הצעות מחיר</Link>
        <ChevronRight size={14} className="rotate-180" />
        <span className="text-[#e2e8f0] font-mono">{quote.quoteNumber}</span>
      </div>

      {/* Header */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-6 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#6366f1]/15 flex items-center justify-center flex-shrink-0">
              <FileText size={26} className="text-[#6366f1]" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold font-mono">{quote.quoteNumber}</h1>
                <QuoteStatusBadge status={quote.status} />
              </div>
              <div className="text-sm text-[#8892a4] mt-0.5">
                נוצרה: {formatDate(quote.createdAt)}
                {quote.validUntil && ` · תוקף עד: ${formatDate(quote.validUntil)}`}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <QuoteStatusActions quoteId={quote.id} currentStatus={quote.status} />
            <Link
              href={`/dashboard/quotes/${quote.id}/edit`}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-[#8892a4] border border-[#2e3147] rounded-lg hover:bg-[#252836] hover:text-[#e2e8f0] transition-all"
            >
              <Pencil size={14} />ערוך
            </Link>
            <PrintButton />
            <DeleteButton
              onDelete={() => deleteQuote(quote.id)}
              redirectTo="/dashboard/quotes"
              label="מחק"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {/* Customer */}
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <User size={14} className="text-[#8892a4]" />
            <span className="text-xs font-semibold text-[#8892a4] uppercase tracking-wide">לקוח</span>
          </div>
          <Link href={`/dashboard/customers/${quote.customer.id}`} className="font-semibold hover:text-[#6366f1] transition-colors">
            {quote.customer.name}
          </Link>
          <div className="text-sm text-[#8892a4] mt-1">{quote.customer.phone}</div>
        </div>

        {/* Vehicle */}
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Car size={14} className="text-[#8892a4]" />
            <span className="text-xs font-semibold text-[#8892a4] uppercase tracking-wide">רכב</span>
          </div>
          {quote.vehicle ? (
            <>
              <Link href={`/dashboard/vehicles/${quote.vehicle.id}`} className="font-semibold hover:text-[#6366f1] transition-colors">
                {quote.vehicle.make} {quote.vehicle.model} {quote.vehicle.year}
              </Link>
              <div className="font-mono text-[#6366f1] text-sm mt-1">{quote.vehicle.plate}</div>
            </>
          ) : (
            <span className="text-sm text-[#8892a4]">לא צוין רכב</span>
          )}
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden mb-4">
        <div className="px-5 py-4 border-b border-[#2e3147]">
          <h2 className="font-semibold text-[15px]">פריטים</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2e3147]">
                <th className="text-start px-5 py-3 text-xs font-semibold text-[#8892a4] uppercase tracking-wide">תיאור</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-[#8892a4] uppercase tracking-wide w-20">כמות</th>
                <th className="text-end px-4 py-3 text-xs font-semibold text-[#8892a4] uppercase tracking-wide w-32">מחיר יח׳</th>
                <th className="text-end px-5 py-3 text-xs font-semibold text-[#8892a4] uppercase tracking-wide w-32">סה"כ</th>
              </tr>
            </thead>
            <tbody>
              {quote.items.map((item) => (
                <tr key={item.id} className="border-b border-[#2e3147] last:border-0">
                  <td className="px-5 py-3">{item.description}</td>
                  <td className="px-4 py-3 text-center text-[#8892a4]">{item.quantity}</td>
                  <td className="px-4 py-3 text-end">{formatCurrency(item.unitPrice)}</td>
                  <td className="px-5 py-3 text-end font-semibold">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totals */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5 mb-4">
        <div className="max-w-xs ms-auto space-y-2">
          <div className="flex justify-between text-sm text-[#8892a4]">
            <span>חלקים</span>
            <span>{formatCurrency(quote.partsTotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-[#8892a4]">
            <span>עבודה ({quote.laborHours} ש׳ × ₪{quote.laborRate})</span>
            <span>{formatCurrency(quote.laborHours * quote.laborRate)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg border-t border-[#2e3147] pt-2 mt-2">
            <span>סה"כ לתשלום</span>
            <span className="text-[#6366f1]">{formatCurrency(quote.totalPrice)}</span>
          </div>
        </div>
      </div>

      {quote.notes && (
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5">
          <div className="text-xs font-semibold text-[#8892a4] uppercase tracking-wide mb-2">הערות ותנאים</div>
          <p className="text-sm text-[#8892a4] leading-relaxed whitespace-pre-line">{quote.notes}</p>
        </div>
      )}
    </div>
  )
}
