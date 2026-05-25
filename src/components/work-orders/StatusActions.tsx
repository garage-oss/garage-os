'use client'

import { useTransition } from 'react'
import { WorkOrderStatus } from '@prisma/client'
import { updateWorkOrderStatus } from '@/app/actions/work-orders'
import { Loader2 } from 'lucide-react'

const OPTIONS: { value: WorkOrderStatus; label: string; ring: string }[] = [
  { value: 'PENDING', label: 'ממתין', ring: 'ring-amber-500/50 text-amber-400 border-amber-500/40 hover:bg-amber-500/10' },
  { value: 'IN_PROGRESS', label: 'בטיפול', ring: 'ring-indigo-500/50 text-indigo-400 border-indigo-500/40 hover:bg-indigo-500/10' },
  { value: 'WAITING_PARTS', label: 'ממתין לחלקים', ring: 'ring-orange-500/50 text-orange-400 border-orange-500/40 hover:bg-orange-500/10' },
  { value: 'COMPLETED', label: 'הושלם', ring: 'ring-emerald-500/50 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10' },
  { value: 'CANCELLED', label: 'בוטל', ring: 'ring-red-500/50 text-red-400 border-red-500/40 hover:bg-red-500/10' },
]

interface Props {
  workOrderId: string
  currentStatus: WorkOrderStatus
}

export function StatusActions({ workOrderId, currentStatus }: Props) {
  const [isPending, startTransition] = useTransition()

  function handle(status: WorkOrderStatus) {
    if (status === currentStatus) return
    startTransition(() => { updateWorkOrderStatus(workOrderId, status) })
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-muted font-medium">עדכן סטטוס:</span>
      {isPending && <Loader2 size={13} className="animate-spin text-muted" />}
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => handle(opt.value)}
          disabled={isPending}
          className={[
            'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all disabled:cursor-not-allowed',
            opt.ring,
            opt.value === currentStatus
              ? 'ring-2 opacity-100'
              : 'opacity-50 hover:opacity-90',
          ].join(' ')}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
