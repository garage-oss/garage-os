import Link from 'next/link'
import { getQuotes } from '@/lib/quotes'
import { QuoteStatusBadge } from '@/components/quotes/QuoteStatusBadge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { QuoteStatus } from '@prisma/client'
import { FileText, Plus, Car } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface PageProps { searchParams: { status?: string; q?: string } }

const STATUS_TABS: { label: string; value: string }[] = [
  { label: 'הכל', value: '' },
  { label: 'טיוטה', value: 'DRAFT' },
  { label: 'נשלחה', value: 'SENT' },
  { label: 'אושרה', value: 'APPROVED' },
  { label: 'נדחתה', value: 'REJECTED' },
]

export default async function QuotesPage({ searchParams }: PageProps) {
  const quotes = await getQuotes({
    status: searchParams.status as QuoteStatus | undefined,
    search: searchParams.q,
  })

  const activeStatus = searchParams.status ?? ''

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold">הצעות מחיר</h1>
          <p className="text-sm text-[#8892a4] mt-0.5">{quotes.length} הצעות</p>
        </div>
        <Link
          href="/dashboard/quotes/new"
          className="flex items-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
        >
          <Plus size={16} />הצעה חדשה
        </Link>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex bg-[#1a1d27] border border-[#2e3147] rounded-lg p-1 gap-1">
          {STATUS_TABS.map((tab) => (
            <Link
              key={tab.value}
              href={`/dashboard/quotes${tab.value ? `?status=${tab.value}` : ''}`}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeStatus === tab.value
                  ? 'bg-[#6366f1] text-white'
                  : 'text-[#8892a4] hover:text-[#e2e8f0]'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        <form>
          {searchParams.status && <input type="hidden" name="status" value={searchParams.status} />}
          <input
            name="q"
            defaultValue={searchParams.q}
            placeholder="חיפוש לפי מספר הצעה או לקוח..."
            className="bg-[#1a1d27] border border-[#2e3147] rounded-lg px-3 py-2 text-sm text-[#e2e8f0] placeholder-[#4a5568] focus:outline-none focus:border-[#6366f1] min-w-[240px]"
          />
        </form>
      </div>

      {quotes.length === 0 ? (
        <div className="bg-[#1a1d27] border border-[#2e3147] border-dashed rounded-xl p-16 text-center">
          <FileText size={32} className="text-[#8892a4] mx-auto mb-3" />
          <p className="text-[#8892a4]">אין הצעות מחיר</p>
        </div>
      ) : (
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
          <div className="divide-y divide-[#2e3147]">
            {quotes.map((q) => (
              <div key={q.id} className="flex items-center justify-between px-5 py-4 hover:bg-[#252836]/40 transition-colors">
                <div className="min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <Link href={`/dashboard/quotes/${q.id}`} className="font-mono text-xs text-[#6366f1] hover:underline font-semibold">
                      {q.quoteNumber}
                    </Link>
                    <QuoteStatusBadge status={q.status} />
                  </div>
                  <div className="font-semibold text-sm">
                    <Link href={`/dashboard/customers/${q.customer.id}`} className="hover:text-[#6366f1] transition-colors">
                      {q.customer.name}
                    </Link>
                  </div>
                  {q.vehicle && (
                    <div className="flex items-center gap-1 text-xs text-[#8892a4] mt-0.5">
                      <Car size={11} />{q.vehicle.make} {q.vehicle.model} — {q.vehicle.plate}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0 ms-4">
                  <span className="font-bold text-sm text-[#6366f1]">{formatCurrency(q.totalPrice)}</span>
                  <span className="text-xs text-[#8892a4]">{formatDate(q.createdAt)}</span>
                  {q.validUntil && (
                    <span className="text-xs text-[#8892a4]">תוקף: {formatDate(q.validUntil)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
