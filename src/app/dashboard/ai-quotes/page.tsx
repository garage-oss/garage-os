import Link from 'next/link'
import {
  Sparkles, Plus, Clock, CheckCircle2, AlertTriangle,
  TriangleAlert, TrendingUp, FileText,
} from 'lucide-react'
import { requireOrg }    from '@/lib/org'
import { prisma }        from '@/lib/prisma'
import { formatCurrency } from '@/lib/utils'
import { AiQuoteWizard } from '@/components/ai-quote/AiQuoteWizard'

export const dynamic = 'force-dynamic'

const URGENCY_CFG: Record<string, { label: string; color: string; bar: string }> = {
  low:      { label: 'רגיל',   color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25', bar: 'bg-emerald-500' },
  medium:   { label: 'בינוני', color: 'text-amber-400   bg-amber-500/10   border-amber-500/25',   bar: 'bg-amber-500'   },
  high:     { label: 'דחוף',   color: 'text-orange-400  bg-orange-500/10  border-orange-500/25',  bar: 'bg-orange-500'  },
  critical: { label: 'קריטי!', color: 'text-red-400     bg-red-500/10     border-red-500/25',     bar: 'bg-red-500'     },
}

export default async function AiQuotePage() {
  const { orgId } = await requireOrg()

  const [workOrders, analyses] = await Promise.all([
    // Open work orders for WO selector
    prisma.workOrder.findMany({
      where: {
        organizationId: orgId,
        status: { in: ['PENDING', 'IN_PROGRESS', 'WAITING_PARTS'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id:              true,
        workOrderNumber: true,
        vehicle: { select: { plate: true, make: true, model: true } },
      },
    }),
    // Recent AI analyses
    prisma.aiQuoteAnalysis.findMany({
      where:   { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      take:    20,
      select: {
        id:            true,
        vehiclePlate:  true,
        vehicleMake:   true,
        vehicleModel:  true,
        vehicleYear:   true,
        complaintText: true,
        urgency:       true,
        confidence:    true,
        totalEstimate: true,
        totalLaborHours: true,
        quoteId:       true,
        quote: { select: { quoteNumber: true, status: true } },
        createdAt:     true,
      },
    }),
  ])

  const hasApiKey = !!process.env.ANTHROPIC_API_KEY

  // Stats for the history header
  const thisWeek    = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const recentCount = analyses.filter(a => new Date(a.createdAt) >= thisWeek).length
  const pendingConv = analyses.filter(a => !a.quoteId).length

  return (
    <div className="space-y-7">

      {/* ── Page header ────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
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

        {/* Quick stats chip */}
        {analyses.length > 0 && (
          <div className="hidden sm:flex items-center gap-4 text-xs text-[#8892a4] bg-[#1a1d27] border border-[#2e3147] rounded-xl px-4 py-2.5 shrink-0">
            <span className="flex items-center gap-1.5">
              <TrendingUp size={12} className="text-[#6366f1]" />
              <strong className="text-[#e2e8f0]">{recentCount}</strong> השבוע
            </span>
            <span className="w-px h-4 bg-[#2e3147]" />
            <span className="flex items-center gap-1.5">
              <FileText size={12} className="text-amber-400" />
              <strong className="text-[#e2e8f0]">{pendingConv}</strong> ממתינים להצעה
            </span>
          </div>
        )}
      </div>

      {/* ── API key warning ─────────────────────────────────────────────── */}
      {!hasApiKey && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-5 py-4">
          <AlertTriangle size={20} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-300">ANTHROPIC_API_KEY לא מוגדר</p>
            <p className="text-amber-400/80 mt-1">
              הוסף{' '}
              <code className="bg-[#252836] px-1.5 py-0.5 rounded text-xs">ANTHROPIC_API_KEY=sk-ant-...</code>
              {' '}לקובץ{' '}
              <code className="bg-[#252836] px-1.5 py-0.5 rounded text-xs">.env</code>
              {' '}והפעל מחדש את השרת.
            </p>
          </div>
        </div>
      )}

      {/* ── Main grid ───────────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">

        {/* Left: wizard */}
        <div>
          <h2 className="text-xs font-semibold text-[#8892a4] uppercase tracking-widest mb-4">
            ניתוח חדש
          </h2>
          <AiQuoteWizard workOrders={workOrders} />
        </div>

        {/* Right: history */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-[#8892a4] uppercase tracking-widest">
            ניתוחים אחרונים
          </h2>

          {analyses.length === 0 ? (
            <div className="bg-[#1a1d27] border border-dashed border-[#2e3147] rounded-2xl p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#6366f1]/10 flex items-center justify-center mx-auto">
                <Sparkles size={24} className="text-[#6366f1]/50" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#c5cde2]">עדיין לא בוצעו ניתוחים</p>
                <p className="text-xs text-[#4a5270] mt-1">הזן תלונת לקוח מימין כדי להתחיל</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {analyses.map(a => {
                const urg = URGENCY_CFG[a.urgency] ?? URGENCY_CFG.medium
                const pct = Math.round(a.confidence * 100)

                return (
                  <div
                    key={a.id}
                    className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-4 space-y-3 hover:border-[#6366f1]/30 transition-colors"
                  >
                    {/* Vehicle + urgency */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-[#e2e8f0] text-sm truncate">
                          {a.vehicleMake
                            ? `${a.vehicleMake} ${a.vehicleModel ?? ''}${a.vehicleYear ? ` ${a.vehicleYear}` : ''}`
                            : (a.vehiclePlate ?? 'רכב לא מזוהה')}
                        </p>
                        {a.vehiclePlate && (
                          <p className="text-xs text-[#4a5270] font-mono mt-0.5">{a.vehiclePlate}</p>
                        )}
                      </div>
                      <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-md border ${urg.color}`}>
                        {urg.label}
                      </span>
                    </div>

                    {/* Complaint snippet */}
                    <p className="text-xs text-[#8892a4] leading-relaxed line-clamp-2">
                      {a.complaintText}
                    </p>

                    {/* Confidence bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-[#4a5270]">
                        <span>ביטחון</span>
                        <span className="tabular-nums font-semibold">{pct}%</span>
                      </div>
                      <div className="h-1 bg-[#252836] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${urg.bar} opacity-70`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* Footer: status + estimate + time */}
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      {a.quoteId ? (
                        <Link
                          href={`/dashboard/quotes/${a.quoteId}`}
                          className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                          <CheckCircle2 size={12} />
                          {a.quote?.quoteNumber ?? 'הצעה נוצרה'}
                        </Link>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs text-[#4a5270]">
                          <Clock size={12} />
                          טרם הומר
                        </span>
                      )}
                      <div className="flex items-center gap-2 text-right">
                        <span className="text-xs font-bold text-[#6366f1] tabular-nums">
                          {formatCurrency(Number(a.totalEstimate))}
                        </span>
                        <span className="text-[10px] text-[#4a5270] tabular-nums">
                          {new Date(a.createdAt).toLocaleDateString('he-IL', {
                            day: '2-digit', month: 'short',
                            hour: '2-digit', minute: '2-digit',
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
