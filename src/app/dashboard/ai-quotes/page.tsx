import Link from 'next/link'
import { Sparkles, Plus, Clock, CheckCircle2, AlertTriangle, TriangleAlert } from 'lucide-react'
import { requireOrg } from '@/lib/org'
import { prisma } from '@/lib/prisma'
import { formatCurrency } from '@/lib/utils'
import { AiQuoteWizard } from '@/components/ai-quote/AiQuoteWizard'

export const dynamic = 'force-dynamic'

const URGENCY_CONFIG: Record<string, { label: string; color: string }> = {
  low:      { label: 'רגיל',   color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  medium:   { label: 'בינוני', color: 'text-amber-400   bg-amber-500/10   border-amber-500/25'   },
  high:     { label: 'דחוף',   color: 'text-orange-400  bg-orange-500/10  border-orange-500/25'  },
  critical: { label: 'קריטי!', color: 'text-red-400     bg-red-500/10     border-red-500/25'     },
}

export default async function AiQuotePage() {
  const { orgId } = await requireOrg()

  // Fetch open work orders for WO selector
  const workOrders = await prisma.workOrder.findMany({
    where: {
      organizationId: orgId,
      status: { in: ['PENDING', 'IN_PROGRESS', 'WAITING_PARTS'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id:              true,
      workOrderNumber: true,
      vehicle: {
        select: { plate: true, make: true, model: true },
      },
    },
  })

  // Fetch recent AI analyses
  const analyses = await prisma.aiQuoteAnalysis.findMany({
    where:   { organizationId: orgId },
    orderBy: { createdAt: 'desc' },
    take:    20,
    select: {
      id:            true,
      vehiclePlate:  true,
      vehicleMake:   true,
      vehicleModel:  true,
      complaintText: true,
      urgency:       true,
      confidence:    true,
      totalEstimate: true,
      quoteId:       true,
      quote:         { select: { quoteNumber: true, status: true } },
      createdAt:     true,
    },
  })

  const hasApiKey = !!process.env.ANTHROPIC_API_KEY

  return (
    <div className="space-y-7">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#6366f1]/15 flex items-center justify-center">
            <Sparkles size={20} className="text-[#6366f1]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">הצעת מחיר AI</h1>
            <p className="text-sm text-[#8892a4] mt-0.5">
              מנוע ציטוט חכם — הזן תלונה, קבל אבחון + הצעה תוך שניות
            </p>
          </div>
        </div>
      </div>

      {/* API key warning */}
      {!hasApiKey && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-5 py-4">
          <AlertTriangle size={20} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-300">ANTHROPIC_API_KEY לא מוגדר</p>
            <p className="text-amber-400/80 mt-1">
              הוסף <code className="bg-[#252836] px-1.5 py-0.5 rounded text-xs">ANTHROPIC_API_KEY=sk-ant-...</code> לקובץ{' '}
              <code className="bg-[#252836] px-1.5 py-0.5 rounded text-xs">.env</code> והפעל מחדש את השרת.
            </p>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">

        {/* Left: Wizard */}
        <div>
          <h2 className="text-xs font-semibold text-[#8892a4] uppercase tracking-widest mb-4">
            ניתוח חדש
          </h2>
          <AiQuoteWizard workOrders={workOrders} />
        </div>

        {/* Right: History */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-[#8892a4] uppercase tracking-widest">
            ניתוחים אחרונים
          </h2>

          {analyses.length === 0 ? (
            <div className="bg-[#1a1d27] border border-[#2e3147] rounded-2xl p-8 text-center">
              <Sparkles size={28} className="text-[#6366f1]/40 mx-auto mb-3" />
              <p className="text-sm text-[#8892a4]">עדיין לא בוצעו ניתוחים</p>
            </div>
          ) : (
            <div className="space-y-2">
              {analyses.map(a => {
                const urg = URGENCY_CONFIG[a.urgency] ?? URGENCY_CONFIG.medium
                return (
                  <div
                    key={a.id}
                    className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-4 space-y-2.5 hover:border-[#6366f1]/30 transition-colors"
                  >
                    {/* Vehicle + urgency */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-[#e2e8f0] text-sm truncate">
                          {a.vehicleMake
                            ? `${a.vehicleMake} ${a.vehicleModel ?? ''}`
                            : (a.vehiclePlate ?? 'רכב לא מזוהה')}
                        </p>
                        {a.vehiclePlate && (
                          <p className="text-xs text-[#8892a4] font-mono mt-0.5">{a.vehiclePlate}</p>
                        )}
                      </div>
                      <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded border ${urg.color}`}>
                        {urg.label}
                      </span>
                    </div>

                    {/* Complaint snippet */}
                    <p className="text-xs text-[#8892a4] leading-relaxed line-clamp-2">
                      {a.complaintText}
                    </p>

                    {/* Footer */}
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <div className="flex items-center gap-2">
                        {a.quoteId ? (
                          <Link
                            href={`/dashboard/quotes/${a.quoteId}`}
                            className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                          >
                            <CheckCircle2 size={12} />
                            {a.quote?.quoteNumber ?? 'הצעה נוצרה'}
                          </Link>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-[#4a5270]">
                            <Clock size={12} />
                            טרם הומר לטיוטה
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-right">
                        <span className="text-xs font-bold text-[#6366f1] tabular-nums">
                          {formatCurrency(Number(a.totalEstimate))}
                        </span>
                        <span className="text-[10px] text-[#4a5270]">
                          {new Date(a.createdAt).toLocaleDateString('he-IL', {
                            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
