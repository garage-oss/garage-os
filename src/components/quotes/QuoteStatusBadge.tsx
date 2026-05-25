import { QuoteStatus } from '@prisma/client'

const CONFIG: Record<QuoteStatus, { label: string; className: string }> = {
  DRAFT: { label: 'טיוטה', className: 'bg-[#8892a4]/10 text-[#8892a4] border-[#8892a4]/25' },
  SENT: { label: 'נשלחה', className: 'bg-blue-500/10 text-blue-400 border-blue-500/25' },
  APPROVED: { label: 'אושרה', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' },
  REJECTED: { label: 'נדחתה', className: 'bg-red-500/10 text-red-400 border-red-500/25' },
}

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  const { label, className } = CONFIG[status]
  return (
    <span className={`inline-flex items-center text-xs border px-2 py-0.5 rounded-full font-semibold ${className}`}>
      {label}
    </span>
  )
}
