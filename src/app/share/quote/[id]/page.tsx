import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { formatCurrency, formatDate } from '@/lib/utils'
import { toNum } from '@/lib/utils'

interface Props { params: { id: string } }

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'טיוטה', color: '#8892a4' },
  SENT: { label: 'ממתינה לאישורך', color: '#6366f1' },
  APPROVED: { label: 'אושרה — תודה!', color: '#10b981' },
  REJECTED: { label: 'נדחתה', color: '#ef4444' },
}

export default async function ShareQuotePage({ params }: Props) {
  const quote = await prisma.quote.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      vehicle: true,
      items: { orderBy: { id: 'asc' } },
    },
  })

  if (!quote) notFound()

  const st = STATUS_CONFIG[quote.status] ?? STATUS_CONFIG.SENT
  const laborTotal = toNum(quote.laborHours) * toNum(quote.laborRate)

  return (
    <div className="min-h-screen bg-[#0f1117] text-[#e2e8f0] py-10 px-4" dir="rtl">
      <div className="max-w-lg mx-auto">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-[#6366f1] rounded-xl flex items-center justify-center font-black text-white text-lg">G</div>
          <div>
            <div className="font-bold text-lg">GarageOS</div>
            <div className="text-xs text-[#8892a4]">הצעת מחיר</div>
          </div>
        </div>

        {/* Status */}
        <div className="rounded-2xl p-5 mb-5 border" style={{ background: st.color + '15', borderColor: st.color + '40' }}>
          <div className="font-bold text-xl mb-1" style={{ color: st.color }}>{st.label}</div>
          <div className="text-sm text-[#8892a4]">הצעה מס׳ {quote.quoteNumber}</div>
          {quote.validUntil && (
            <div className="text-sm text-[#8892a4] mt-1">בתוקף עד: {formatDate(quote.validUntil)}</div>
          )}
        </div>

        {/* Customer + Vehicle */}
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5 mb-4">
          <div className="text-xs text-[#8892a4] uppercase tracking-wide font-semibold mb-3">פרטי לקוח ורכב</div>
          <div className="font-semibold">{quote.customer.name}</div>
          {quote.vehicle && (
            <div className="mt-2 text-sm">
              <span>{quote.vehicle.make} {quote.vehicle.model} {quote.vehicle.year}</span>
              <span className="font-mono text-[#6366f1] ms-2">{quote.vehicle.plate}</span>
            </div>
          )}
        </div>

        {/* Items table */}
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden mb-4">
          <div className="px-5 py-4 border-b border-[#2e3147]">
            <h2 className="font-semibold">פירוט עבודה וחלקים</h2>
          </div>
          <div className="divide-y divide-[#2e3147]">
            {quote.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <div>{item.description}</div>
                  <div className="text-xs text-[#8892a4]">× {item.quantity} × {formatCurrency(toNum(item.unitPrice))}</div>
                </div>
                <div className="font-semibold">{formatCurrency(toNum(item.total))}</div>
              </div>
            ))}
            {laborTotal > 0 && (
              <div className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <div>שכר עבודה</div>
                  <div className="text-xs text-[#8892a4]">{toNum(quote.laborHours)} שעות × ₪{toNum(quote.laborRate)}</div>
                </div>
                <div className="font-semibold">{formatCurrency(laborTotal)}</div>
              </div>
            )}
          </div>
          <div className="px-5 py-4 border-t border-[#2e3147] flex justify-between font-bold text-lg">
            <span>סה"כ לתשלום</span>
            <span className="text-[#6366f1]">{formatCurrency(toNum(quote.totalPrice))}</span>
          </div>
        </div>

        {/* Notes */}
        {quote.notes && (
          <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5 mb-5">
            <div className="text-xs text-[#8892a4] uppercase tracking-wide font-semibold mb-2">הערות ותנאים</div>
            <p className="text-sm text-[#8892a4] leading-relaxed whitespace-pre-line">{quote.notes}</p>
          </div>
        )}

        {quote.status === 'SENT' && (
          <div className="bg-[#6366f1]/10 border border-[#6366f1]/30 rounded-xl p-5 text-center">
            <p className="text-sm text-[#8892a4] mb-1">לאישור ההצעה — צור קשר עם המוסך</p>
            <p className="font-semibold text-[#e2e8f0]">נשמח לשמוע ממך! 🙏</p>
          </div>
        )}

        <p className="text-center text-xs text-[#8892a4] mt-6">
          הצעה הופקה ב-{formatDate(quote.createdAt)} · GarageOS
        </p>
      </div>
    </div>
  )
}
