import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { QuotePortalActions } from '@/components/portal/QuotePortalActions'
import { Car, User, FileText, Calendar, CheckCircle, Clock, XCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface Props {
  params: { token: string }
}

const VAT_RATE = parseFloat(process.env.VAT_RATE ?? '0.17')

function fmtILS(n: number | string | null | undefined): string {
  const v = typeof n === 'string' ? parseFloat(n) : (n ?? 0)
  return v.toLocaleString('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 2 })
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—'
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function StatusBadge({ status }: { status: string }) {
  const CFG: Record<string, { icon: typeof Clock; label: string; cls: string }> = {
    DRAFT:   { icon: Clock,         label: 'טיוטה',    cls: 'bg-[#252836] text-[#8892a4] border-[#2e3147]' },
    SENT:    { icon: FileText,      label: 'ממתין',    cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    APPROVED:{ icon: CheckCircle,   label: 'אושרה',    cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    REJECTED:{ icon: XCircle,       label: 'נדחתה',    cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
  }
  const c = CFG[status] ?? CFG['DRAFT']
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${c.cls}`}>
      <c.icon size={12} />
      {c.label}
    </span>
  )
}

export default async function QuotePortalPage({ params }: Props) {
  const quote = await prisma.quote.findUnique({
    where:  { portalToken: params.token },
    include: {
      customer: { select: { name: true, phone: true } },
      vehicle:  { select: { plate: true, make: true, model: true, year: true } },
      items:    { orderBy: { id: 'asc' } },
      organization: { select: { name: true } },
      portalResponses: { orderBy: { createdAt: 'desc' }, take: 1, select: { action: true } },
    },
  })

  if (!quote) notFound()

  const isExpired = quote.portalTokenExpiresAt ? quote.portalTokenExpiresAt < new Date() : false

  const alreadyResponded =
    quote.status === 'APPROVED' ||
    quote.status === 'REJECTED' ||
    (quote.portalResponses.length > 0 &&
      ['APPROVED', 'REJECTED'].includes(quote.portalResponses[0].action))

  const subtotal   = parseFloat(quote.items.reduce((s, it) => s + parseFloat(it.total.toString()), 0).toFixed(2))
  const vatAmount  = Math.round(subtotal * VAT_RATE * 100) / 100
  const total      = subtotal + vatAmount

  return (
    <div className="min-h-screen bg-[#0f1117] text-[#e2e8f0]" dir="rtl">
      {/* Top bar */}
      <header className="border-b border-[#1a1d27] bg-[#0f1117]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="font-bold text-[#6366f1] text-sm">{quote.organization.name}</span>
          <StatusBadge status={quote.status} />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Heading */}
        <div>
          <h1 className="text-2xl font-black">הצעת מחיר {quote.quoteNumber}</h1>
          {quote.validUntil && (
            <p className="text-sm text-[#8892a4] mt-1 flex items-center gap-1.5">
              <Calendar size={13} /> בתוקף עד {fmtDate(quote.validUntil)}
            </p>
          )}
        </div>

        {/* Expired notice */}
        {isExpired && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-4 text-sm text-amber-300">
            <p className="font-semibold">הקישור פג תוקף</p>
            <p className="text-xs text-amber-400/80 mt-0.5">צור קשר עם המוסך לקבלת הצעה מעודכנת.</p>
          </div>
        )}

        {/* Customer + Vehicle cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-4">
            <p className="text-xs text-[#5a6279] mb-2 flex items-center gap-1.5"><User size={11} /> לקוח</p>
            <p className="font-semibold">{quote.customer.name}</p>
            {quote.customer.phone && <p className="text-xs text-[#8892a4] mt-0.5">{quote.customer.phone}</p>}
          </div>
          {quote.vehicle && (
            <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-4">
              <p className="text-xs text-[#5a6279] mb-2 flex items-center gap-1.5"><Car size={11} /> רכב</p>
              <p className="font-semibold font-mono">{quote.vehicle.plate}</p>
              <p className="text-xs text-[#8892a4] mt-0.5">
                {[quote.vehicle.make, quote.vehicle.model, quote.vehicle.year ? String(quote.vehicle.year) : null].filter(Boolean).join(' ')}
              </p>
            </div>
          )}
        </div>

        {/* Quote items */}
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[#2e3147] font-semibold text-sm flex items-center gap-2">
            <FileText size={14} className="text-[#6366f1]" /> פירוט ההצעה
          </div>

          <div className="divide-y divide-[#2e3147]">
            {quote.items.map(item => (
              <div key={item.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div className="flex-1 min-w-0 ml-3">
                  <p className="font-medium truncate">{item.description}</p>
                  <p className="text-xs text-[#5a6279] mt-0.5">
                    {item.itemType !== 'labor'
                      ? `${item.quantity} × ${fmtILS(item.unitPrice.toString())}`
                      : `${item.laborHours.toString()} שעות עבודה`}
                    {parseFloat(item.discount.toString()) > 0 && ` · הנחה ${item.discount}%`}
                  </p>
                </div>
                <span className="font-semibold tabular-nums text-emerald-400 whitespace-nowrap">{fmtILS(item.total.toString())}</span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-t border-[#2e3147] bg-[#252836]/60 px-5 py-4 space-y-1.5">
            <div className="flex justify-between text-sm text-[#8892a4]">
              <span>סכום לפני מע״מ</span>
              <span className="font-mono tabular-nums">{fmtILS(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-[#8892a4]">
              <span>מע״מ {Math.round(VAT_RATE * 100)}%</span>
              <span className="font-mono tabular-nums">{fmtILS(vatAmount)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-[#2e3147]">
              <span className="font-bold">סה״כ לתשלום</span>
              <span className="font-black text-[#6366f1] text-lg tabular-nums">{fmtILS(total)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {quote.notes && (
          <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl px-5 py-4 text-sm text-[#8892a4]">
            <p className="text-xs text-[#5a6279] mb-1">הערות</p>
            <p className="whitespace-pre-wrap">{quote.notes}</p>
          </div>
        )}

        {/* Actions */}
        {!isExpired && (
          <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl px-5 py-5">
            <p className="text-sm font-semibold mb-4 text-center">
              {alreadyResponded ? 'תגובתך התקבלה' : 'האם לאשר את ההצעה?'}
            </p>
            <QuotePortalActions
              token={params.token}
              alreadyResponded={alreadyResponded}
              currentStatus={quote.status}
            />
          </div>
        )}

        <p className="text-center text-xs text-[#3a3f52] pb-4">
          מופעל על ידי GarageOS · הצעה {quote.quoteNumber}
        </p>
      </main>
    </div>
  )
}
