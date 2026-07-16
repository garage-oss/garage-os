'use client'

import { useState, useTransition } from 'react'
import { CheckCircle, XCircle, Phone, Loader2, AlertCircle, MessageSquare } from 'lucide-react'
import { useRouter } from 'next/navigation'

type Action = 'APPROVED' | 'REJECTED' | 'CALL_REQUESTED'

interface Props {
  quoteId:          string
  alreadyResponded: boolean
  currentStatus:    string
}

export function CustomerQuoteActions({ quoteId, alreadyResponded, currentStatus }: Props) {
  const router             = useRouter()
  const [pending, startTr] = useTransition()
  const [chosen,  setChosen]  = useState<Action | null>(null)
  const [comment, setComment] = useState('')
  const [showComment, setShowComment] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  if (alreadyResponded) {
    const STATUS: Record<string, { text: string; cls: string }> = {
      APPROVED: { text: 'ההצעה אושרה — תודה! ניצור קשר לאישור תור.',   cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
      REJECTED: { text: 'ההצעה נדחתה. ניצור קשר אם יש שינוי.',          cls: 'text-red-600    bg-red-50    border-red-200'     },
      default:  { text: 'קיבלנו את בקשתך — ניצור קשר בהקדם.',           cls: 'text-slate-700  bg-slate-50  border-slate-200'   },
    }
    const s = STATUS[currentStatus] ?? STATUS['default']
    return (
      <div className={`rounded-2xl border px-5 py-4 text-sm font-medium text-center ${s.cls}`}>
        {s.text}
      </div>
    )
  }

  async function act(action: Action) {
    setChosen(action)
    setError(null)
    startTr(async () => {
      try {
        const r = await fetch(`/api/portal/quotes/${quoteId}/respond`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, comment }),
        })
        const body = await r.json()
        if (!r.ok) { setError(body.error ?? 'שגיאה'); setChosen(null); return }
        router.refresh()
      } catch {
        setError('שגיאת רשת — נסה שוב')
        setChosen(null)
      }
    })
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 border border-red-100">
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {showComment && (
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={2}
          placeholder="הוסף/י הערה (אופציונלי)…"
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-indigo-300 resize-none"
        />
      )}

      <div className="flex flex-col gap-2.5">
        <button
          onClick={() => act('APPROVED')}
          disabled={pending}
          className="flex items-center justify-center gap-2.5 w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-base shadow-md shadow-emerald-200/50 disabled:opacity-60 active:scale-[0.98] transition-all"
        >
          {pending && chosen === 'APPROVED' ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
          אשר/י הצעה
        </button>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => act('REJECTED')}
            disabled={pending}
            className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white border-2 border-red-200 text-red-600 font-semibold text-sm disabled:opacity-60 active:scale-[0.97] transition-all"
          >
            {pending && chosen === 'REJECTED' ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
            דחה הצעה
          </button>
          <button
            onClick={() => act('CALL_REQUESTED')}
            disabled={pending}
            className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white border-2 border-slate-200 text-slate-700 font-semibold text-sm disabled:opacity-60 active:scale-[0.97] transition-all"
          >
            {pending && chosen === 'CALL_REQUESTED' ? <Loader2 size={16} className="animate-spin" /> : <Phone size={16} />}
            בקש שיחה
          </button>
        </div>

        <button
          onClick={() => setShowComment(c => !c)}
          className="flex items-center justify-center gap-1.5 text-slate-400 text-xs hover:text-slate-600 transition-colors"
        >
          <MessageSquare size={13} />
          {showComment ? 'הסתר הערה' : 'הוסף הערה'}
        </button>
      </div>
    </div>
  )
}
