import { CheckCircle2, FlaskConical, Wrench, Clock, AlertTriangle, Info } from 'lucide-react'
import type { DiagnosticAIResponse } from '@/lib/diagnostics'

const URGENCY_CONFIG = {
  LOW: { label: 'רגיל', className: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400', dot: 'bg-emerald-400' },
  MEDIUM: { label: 'בינוני', className: 'bg-amber-500/10 border-amber-500/30 text-amber-400', dot: 'bg-amber-400' },
  HIGH: { label: 'דחוף', className: 'bg-orange-500/10 border-orange-500/30 text-orange-400', dot: 'bg-orange-400' },
  CRITICAL: { label: 'קריטי — טפל מיד!', className: 'bg-red-500/10 border-red-500/30 text-red-400', dot: 'bg-red-400' },
}

const DIFFICULTY_LABEL: Record<string, string> = {
  LOW: 'פשוט', MEDIUM: 'בינוני', HIGH: 'מורכב',
}

interface Props {
  data: DiagnosticAIResponse
}

function Section({ icon, title, items, color }: {
  icon: React.ReactNode; title: string; items: string[]; color: string
}) {
  return (
    <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className={color}>{icon}</span>
        <h3 className="font-semibold text-[15px]">{title}</h3>
      </div>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-[#8892a4]">
            <span className={`w-5 h-5 rounded-full ${color} bg-current/10 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5`}>
              {i + 1}
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function DiagnosticResult({ data }: Props) {
  const urgency = URGENCY_CONFIG[data.urgencyLevel] ?? URGENCY_CONFIG.MEDIUM

  return (
    <div className="space-y-4">
      {/* Urgency banner */}
      <div className={`flex items-center gap-3 border rounded-xl px-5 py-4 ${urgency.className}`}>
        <span className={`w-2.5 h-2.5 rounded-full ${urgency.dot} animate-pulse flex-shrink-0`} />
        <div>
          <div className="font-semibold">רמת דחיפות: {urgency.label}</div>
          <div className="flex gap-4 text-xs mt-1 opacity-80">
            <span>רמת קושי: {DIFFICULTY_LABEL[data.estimatedDifficulty] ?? data.estimatedDifficulty}</span>
            <span className="flex items-center gap-1"><Clock size={11} />{data.estimatedTime}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Section
          icon={<AlertTriangle size={16} />}
          title="סיבות אפשריות"
          items={data.possibleCauses}
          color="text-amber-400"
        />
        <Section
          icon={<FlaskConical size={16} />}
          title="בדיקות מומלצות"
          items={data.recommendedTests}
          color="text-blue-400"
        />
        <Section
          icon={<Wrench size={16} />}
          title="תיקונים נפוצים"
          items={data.commonFixes}
          color="text-emerald-400"
        />
      </div>

      {data.additionalNotes && (
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Info size={14} className="text-[#8892a4]" />
            <h3 className="font-semibold text-[15px]">הערות נוספות</h3>
          </div>
          <p className="text-sm text-[#8892a4] leading-relaxed">{data.additionalNotes}</p>
        </div>
      )}
    </div>
  )
}
