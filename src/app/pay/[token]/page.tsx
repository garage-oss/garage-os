import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { formatCurrency } from '@/lib/utils'
import { CheckCircle2, CreditCard, Clock, AlertTriangle } from 'lucide-react'
import { PayButton } from './PayButton'

export const dynamic = 'force-dynamic'

export default async function PayPage({ params }: { params: { token: string } }) {
  const link = await prisma.paymentLink.findUnique({
    where: { token: params.token },
    include: {
      organization: { select: { name: true, phone: true } },
      workOrder:    { select: { workOrderNumber: true, complaint: true } },
    },
  })

  if (!link) notFound()

  const expired  = link.expiresAt ? link.expiresAt < new Date() : false
  const paid     = !!link.paidAt
  const amount   = Number(link.amount)

  return (
    <html lang="he" dir="rtl">
      <body className="bg-[#0f1117] text-white min-h-screen flex items-center justify-center p-4 font-sans antialiased">
        <div className="w-full max-w-sm space-y-5">
          {/* Logo / garage name */}
          <div className="text-center">
            <div className="w-14 h-14 bg-[#6366f1]/15 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <CreditCard size={26} className="text-[#6366f1]" />
            </div>
            <h1 className="text-xl font-bold">{link.organization.name}</h1>
            {link.organization.phone && (
              <a href={`tel:${link.organization.phone}`} className="text-sm text-[#8892a4] hover:text-white">
                {link.organization.phone}
              </a>
            )}
          </div>

          {/* Payment card */}
          <div className="bg-[#1a1d27] border border-[#2e3147] rounded-2xl overflow-hidden">
            {/* Status banner */}
            {paid ? (
              <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-5 py-3 flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                <CheckCircle2 size={16} />
                התשלום בוצע בהצלחה!
              </div>
            ) : expired ? (
              <div className="bg-red-500/10 border-b border-red-500/20 px-5 py-3 flex items-center gap-2 text-red-400 font-semibold text-sm">
                <AlertTriangle size={16} />
                קישור התשלום פג תוקף
              </div>
            ) : null}

            <div className="p-5 space-y-4">
              {/* Amount */}
              <div className="text-center">
                <div className="text-[11px] text-[#8892a4] uppercase tracking-widest mb-1">סכום לתשלום</div>
                <div className="text-4xl font-bold text-[#6366f1]">{formatCurrency(amount)}</div>
              </div>

              {/* Details */}
              {link.description && (
                <div className="bg-[#252836] rounded-xl px-4 py-3 text-sm text-[#a8b4c8] text-center">
                  {link.description}
                </div>
              )}

              {link.workOrder && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#8892a4]">פקודת עבודה</span>
                  <span className="font-mono font-bold text-[#6366f1]">{link.workOrder.workOrderNumber}</span>
                </div>
              )}

              {link.expiresAt && !paid && !expired && (
                <div className="flex items-center gap-2 text-xs text-amber-400">
                  <Clock size={12} />
                  בתוקף עד {link.expiresAt.toLocaleDateString('he-IL')}
                </div>
              )}

              {/* Pay button or paid state */}
              {!paid && !expired && (
                <PayButton token={params.token} />
              )}

              {paid && (
                <div className="text-center text-sm text-[#8892a4]">
                  שולם ב-{link.paidAt?.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>
          </div>

          <p className="text-center text-[11px] text-[#8892a4]">
            Powered by GarageOS
          </p>
        </div>
      </body>
    </html>
  )
}
