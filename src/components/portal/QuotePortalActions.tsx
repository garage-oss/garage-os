'use client'

import { useState, useTransition } from 'react'
import { CheckCircle, XCircle, Phone, Loader2, AlertCircle } from 'lucide-react'
import { respondToQuote } from '@/app/actions/quote-portal'

type Action = 'APPROVED' | 'REJECTED' | 'CALL_REQUESTED'

interface Props {
  token:           string
  alreadyResponded: boolean
  currentStatus:   string
}

export function QuotePortalActions({ token, alreadyResponded, currentStatus }: Props) {
  const [pending, startTransition] = useTransition()
  const [chosen,  setChosen]       = useState<Action | null>(null)
  const [error,   setError]        = useState<string | null>(null)

  if (alreadyResponded) {
    const MAP: Record<string, { label: string; cls: string }> = {
      APPROVED: { label: 'ההצעה אושרה — תודה!',          cls: 'text-emerald-400' },
      REJECTED: { label: 'ההצעה נדחתה',                  cls: 'text-red-400'     },
      default:  { label: 'קיבלנו את בקשתך, ניצור קשר!', cls: 'text-amber-400'   },
    }
    const m = MAP[currentStatus] ?? MAP['default']
    return (
      <div className="flex items-center gap-2 justify-center py-4">
        <CheckCircle size={18} className={m.cls} />
        <span className={`text-sm font-medium ${m.cls}`}>{m.label}</span>
      </div>
    )
  }

  async function act(action: Action) {
    setChosen(action)
    setError(null)
    startTransition(async () => {
      try {
        await respondToQuote(token, action)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'שגיאה, נסה שוב'
        setError(msg)
        setChosen(null)
      }
    })
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-300 bg-red-500/10 rounded-xl px-4 py-3">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => act('APPROVED')}
          disabled={pending}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm disabled:opacity-60 transition-colors"
        >
          {pending && chosen === 'APPROVED'
            ? <Loader2 size={16} className="animate-spin" />
            : <CheckCircle size={16} />}
          אשר הצעה
        </button>
        <button
          onClick={() => act('REJECTED')}
          disabled={pending}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 font-semibold text-sm disabled:opacity-60 transition-colors"
        >
          {pending && chosen === 'REJECTED'
            ? <Loader2 size={16} className="animate-spin" />
            : <XCircle size={16} />}
          דחה הצעה
        </button>
        <button
          onClick={() => act('CALL_REQUESTED')}
          disabled={pending}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#252836] hover:bg-[#2e3147] border border-[#2e3147] text-[#8892a4] hover:text-[#e2e8f0] font-medium text-sm disabled:opacity-60 transition-colors"
        >
          {pending && chosen === 'CALL_REQUESTED'
            ? <Loader2 size={16} className="animate-spin" />
            : <Phone size={16} />}
          בקש שיחה
        </button>
      </div>
    </div>
  )
}
