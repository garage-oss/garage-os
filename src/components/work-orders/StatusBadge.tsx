import { WorkOrderStatus } from '@prisma/client'

const config: Record<WorkOrderStatus, { label: string; className: string }> = {
  PENDING: {
    label: 'ממתין',
    className: 'bg-amber-500/10 text-amber-400 border border-amber-500/25',
  },
  IN_PROGRESS: {
    label: 'בטיפול',
    className: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/25',
  },
  WAITING_PARTS: {
    label: 'ממתין לחלקים',
    className: 'bg-orange-500/10 text-orange-400 border border-orange-500/25',
  },
  COMPLETED: {
    label: 'הושלם',
    className: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25',
  },
  CANCELLED: {
    label: 'בוטל',
    className: 'bg-red-500/10 text-red-400 border border-red-500/25',
  },
}

export function StatusBadge({ status }: { status: WorkOrderStatus }) {
  const { label, className } = config[status]
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide whitespace-nowrap ${className}`}
    >
      {label}
    </span>
  )
}
