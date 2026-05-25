import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Brain, Car, Wrench, Plus } from 'lucide-react'
import { getDiagnosticSession } from '@/lib/diagnostics'
import { DiagnosticResult } from '@/components/diagnostics/DiagnosticResult'
import { formatDate } from '@/lib/utils'

interface Props { params: { id: string } }

export const dynamic = 'force-dynamic'

const URGENCY_LABEL: Record<string, string> = {
  LOW: 'רגיל', MEDIUM: 'בינוני', HIGH: 'דחוף', CRITICAL: 'קריטי',
}

export default async function DiagnosticSessionPage({ params }: Props) {
  const session = await getDiagnosticSession(params.id)
  if (!session) notFound()

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-1.5 text-sm text-[#8892a4] mb-6">
        <Link href="/dashboard/diagnostics" className="hover:text-[#e2e8f0] transition-colors">אבחון AI</Link>
        <ChevronRight size={14} className="rotate-180" />
        <span className="text-[#e2e8f0]">{formatDate(session.createdAt)}</span>
      </div>

      {/* Header */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-6 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#6366f1]/15 flex items-center justify-center flex-shrink-0">
              <Brain size={26} className="text-[#6366f1]" />
            </div>
            <div>
              <h1 className="text-xl font-bold">דוח אבחון</h1>
              <div className="text-sm text-[#8892a4] mt-0.5">{formatDate(session.createdAt)}</div>
            </div>
          </div>
          <Link
            href={`/dashboard/diagnostics/new?${new URLSearchParams({
              ...(session.vehicle ? { vehicleId: session.vehicle.id } : {}),
              ...(session.workOrder ? { workOrderId: session.workOrder.id } : {}),
            })}`}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-[#8892a4] border border-[#2e3147] rounded-lg hover:bg-[#252836] hover:text-[#e2e8f0] transition-all"
          >
            <Plus size={14} />אבחון חדש
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5 pt-5 border-t border-[#2e3147]">
          {session.vehicle && (
            <div>
              <div className="flex items-center gap-1.5 text-xs text-[#8892a4] mb-1">
                <Car size={11} />רכב
              </div>
              <Link href={`/dashboard/vehicles/${session.vehicle.id}`} className="text-sm font-medium hover:text-[#6366f1] transition-colors">
                {session.vehicle.make} {session.vehicle.model} {session.vehicle.year}
              </Link>
              <div className="text-xs font-mono text-[#6366f1]">{session.vehicle.plate}</div>
            </div>
          )}
          {session.workOrder && (
            <div>
              <div className="flex items-center gap-1.5 text-xs text-[#8892a4] mb-1">
                <Wrench size={11} />פקודת עבודה
              </div>
              <Link href={`/dashboard/work-orders/${session.workOrder.id}`} className="text-sm font-mono text-[#6366f1] hover:underline">
                {session.workOrder.workOrderNumber}
              </Link>
            </div>
          )}
          <div>
            <div className="text-xs text-[#8892a4] mb-1">רמת דחיפות</div>
            <div className="text-sm font-semibold">{URGENCY_LABEL[session.urgency] ?? session.urgency}</div>
          </div>
        </div>
      </div>

      {/* Input summary */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5 mb-4 space-y-3">
        <h2 className="text-sm font-semibold text-[#8892a4] uppercase tracking-wide">קלט הבקשה</h2>
        <div>
          <div className="text-xs text-[#8892a4] mb-1">תלונת לקוח</div>
          <p className="text-sm leading-relaxed">{session.complaint}</p>
        </div>
        {session.obdCodes && (
          <div>
            <div className="text-xs text-[#8892a4] mb-1">קודי OBD</div>
            <p className="text-sm font-mono text-amber-400">{session.obdCodes}</p>
          </div>
        )}
        {session.symptoms && (
          <div>
            <div className="text-xs text-[#8892a4] mb-1">תסמינים</div>
            <p className="text-sm text-[#8892a4]">{session.symptoms}</p>
          </div>
        )}
      </div>

      {/* AI Result */}
      {session.aiResponse ? (
        <>
          <h2 className="font-semibold text-[15px] mb-3 flex items-center gap-2">
            <Brain size={15} className="text-[#6366f1]" />תוצאות אבחון AI
          </h2>
          <DiagnosticResult data={session.aiResponse} />
        </>
      ) : (
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-10 text-center">
          <p className="text-[#8892a4]">האבחון עדיין לא הושלם</p>
        </div>
      )}
    </div>
  )
}
