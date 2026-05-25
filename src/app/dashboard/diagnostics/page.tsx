import Link from 'next/link'
import { getDiagnosticSessions } from '@/lib/diagnostics'
import { Brain, Plus, Car, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const URGENCY_CONFIG = {
  LOW: { label: 'רגיל', className: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  MEDIUM: { label: 'בינוני', className: 'text-amber-400 bg-amber-500/10 border-amber-500/25' },
  HIGH: { label: 'דחוף', className: 'text-orange-400 bg-orange-500/10 border-orange-500/25' },
  CRITICAL: { label: 'קריטי', className: 'text-red-400 bg-red-500/10 border-red-500/25' },
}

export default async function DiagnosticsPage() {
  const sessions = await getDiagnosticSessions()

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold">אבחון AI</h1>
          <p className="text-sm text-[#8892a4] mt-0.5">{sessions.length} אבחונים בוצעו</p>
        </div>
        <Link
          href="/dashboard/diagnostics/new"
          className="flex items-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
        >
          <Brain size={16} />אבחון חדש
        </Link>
      </div>

      {/* Promo banner if no sessions */}
      {sessions.length === 0 ? (
        <div className="bg-gradient-to-br from-[#6366f1]/10 to-[#252836] border border-[#6366f1]/20 rounded-2xl p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#6366f1]/15 flex items-center justify-center mx-auto mb-4">
            <Brain size={32} className="text-[#6366f1]" />
          </div>
          <h2 className="text-xl font-bold mb-2">מנוע אבחון חכם</h2>
          <p className="text-[#8892a4] mb-6 max-w-md mx-auto">
            הזן תלונת לקוח, קודי OBD ותסמינים — ה-AI ינתח ויספק סיבות אפשריות, בדיקות מומלצות ותיקונים נפוצים.
          </p>
          <Link
            href="/dashboard/diagnostics/new"
            className="inline-flex items-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] text-white font-semibold rounded-xl px-6 py-3 transition-colors"
          >
            <Brain size={18} />התחל אבחון ראשון
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => {
            const urgencyConf = URGENCY_CONFIG[s.urgency]
            return (
              <Link
                key={s.id}
                href={`/dashboard/diagnostics/${s.id}`}
                className="block bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5 hover:border-[#6366f1]/40 transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className={`text-xs border px-2 py-0.5 rounded-full font-semibold ${urgencyConf.className}`}>
                        {urgencyConf.label}
                      </span>
                      {s.vehicle && (
                        <span className="flex items-center gap-1 text-xs text-[#8892a4]">
                          <Car size={11} />{s.vehicle.make} {s.vehicle.model} — {s.vehicle.plate}
                        </span>
                      )}
                      {s.workOrder && (
                        <span className="text-xs font-mono text-[#6366f1]">{s.workOrder.workOrderNumber}</span>
                      )}
                    </div>
                    <p className="text-sm font-medium line-clamp-2">{s.complaint}</p>
                    {s.obdCodes && (
                      <p className="text-xs font-mono text-[#8892a4] mt-1">{s.obdCodes}</p>
                    )}
                    {s.aiResponse && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {s.aiResponse.possibleCauses.slice(0, 2).map((c, i) => (
                          <span key={i} className="text-xs bg-[#252836] border border-[#2e3147] rounded-full px-2 py-0.5 text-[#8892a4]">
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-xs text-[#8892a4]">{formatDate(s.createdAt)}</span>
                    {s.aiResponse ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-400">
                        <CheckCircle2 size={11} />נותח
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-[#8892a4]">
                        <Clock size={11} />ממתין
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
