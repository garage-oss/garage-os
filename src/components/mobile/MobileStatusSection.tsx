'use client'

import { useState, useTransition } from 'react'
import { WorkOrderStatus } from '@prisma/client'
import { updateWorkOrderStatus } from '@/app/actions/work-orders'
import { Loader2, CheckCircle2 } from 'lucide-react'

interface Props {
  workOrderId:   string
  currentStatus: WorkOrderStatus
}

const STATUSES: { value: WorkOrderStatus; label: string; color: string }[] = [
  { value: 'PENDING',       label: 'ממתין',          color: 'border-amber-400/40 text-amber-400 bg-amber-400/10' },
  { value: 'IN_PROGRESS',   label: 'בטיפול',         color: 'border-[#6366f1]/40 text-[#6366f1] bg-[#6366f1]/10' },
  { value: 'WAITING_PARTS', label: 'ממתין לחלקים',   color: 'border-orange-400/40 text-orange-400 bg-orange-400/10' },
  { value: 'COMPLETED',     label: 'הושלם ✓',        color: 'border-emerald-400/40 text-emerald-400 bg-emerald-400/10' },
]

export function MobileStatusSection({ workOrderId, currentStatus }: Props) {
  const [status,    setStatus]  = useState(currentStatus)
  const [expanded,  setExpanded] = useState(false)
  const [isPending, start]      = useTransition()

  async function handleChange(next: WorkOrderStatus) {
    if (next === status) { setExpanded(false); return }
    start(async () => {
      await updateWorkOrderStatus(workOrderId, next)
      setStatus(next)
      setExpanded(false)
    })
  }

  const current = STATUSES.find((s) => s.value === status)

  return (
    <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CheckCircle2 size={15} className="text-[#8892a4]" />
          שינוי סטטוס
        </div>
        <span className={`text-xs border px-2 py-0.5 rounded-full font-semibold ${current?.color ?? ''}`}>
          {current?.label ?? status}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 grid grid-cols-2 gap-2">
          {STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => handleChange(s.value)}
              disabled={isPending}
              className={[
                'py-3 rounded-xl border text-sm font-semibold transition-all active:scale-95 disabled:opacity-50',
                s.value === status
                  ? s.color
                  : 'border-[#2e3147] text-[#8892a4] hover:border-[#3e4157]',
              ].join(' ')}
            >
              {isPending && s.value !== status ? (
                <Loader2 size={14} className="animate-spin mx-auto" />
              ) : s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
