'use client'

import { useTransition } from 'react'
import { QuoteStatus } from '@prisma/client'
import { updateQuoteStatus } from '@/app/actions/quotes'

interface Props {
  quoteId: string
  currentStatus: QuoteStatus
}

const TRANSITIONS: Record<QuoteStatus, { next: QuoteStatus; label: string; className: string }[]> = {
  DRAFT: [
    { next: 'SENT', label: 'סמן כנשלחה', className: 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20' },
    { next: 'REJECTED', label: 'בטל הצעה', className: 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20' },
  ],
  SENT: [
    { next: 'APPROVED', label: 'אשר הצעה', className: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20' },
    { next: 'REJECTED', label: 'דחה הצעה', className: 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20' },
  ],
  APPROVED: [
    { next: 'DRAFT', label: 'החזר לטיוטה', className: 'bg-[#252836] border-[#2e3147] text-[#8892a4] hover:bg-[#2e3147]' },
  ],
  REJECTED: [
    { next: 'DRAFT', label: 'החזר לטיוטה', className: 'bg-[#252836] border-[#2e3147] text-[#8892a4] hover:bg-[#2e3147]' },
  ],
}

export function QuoteStatusActions({ quoteId, currentStatus }: Props) {
  const [isPending, startTransition] = useTransition()
  const actions = TRANSITIONS[currentStatus]

  if (!actions.length) return null

  return (
    <div className="flex gap-2 flex-wrap">
      {actions.map((a) => (
        <button
          key={a.next}
          onClick={() => startTransition(() => updateQuoteStatus(quoteId, a.next))}
          disabled={isPending}
          className={`px-3 py-2 text-sm font-medium border rounded-lg transition-all disabled:opacity-50 ${a.className}`}
        >
          {isPending ? '...' : a.label}
        </button>
      ))}
    </div>
  )
}
