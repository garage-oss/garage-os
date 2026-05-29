'use client'

import { useState, useTransition } from 'react'
import { approveQuote, rejectQuote } from '@/app/actions/portal'

export function QuoteActions({ quoteId, workOrderId }: { quoteId: string; workOrderId: string }) {
  const [pending,     startTransition] = useTransition()
  const [choice,      setChoice]       = useState<'approve' | 'reject' | null>(null)
  const [confirmReject, setConfirmReject] = useState(false)

  function handleApprove() {
    setChoice('approve')
    startTransition(() => approveQuote(quoteId, workOrderId))
  }

  function handleReject() {
    if (!confirmReject) { setConfirmReject(true); return }
    setChoice('reject')
    startTransition(() => rejectQuote(quoteId, workOrderId))
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleApprove}
        disabled={pending}
        className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white font-bold text-base px-6 py-4 rounded-2xl shadow-md shadow-emerald-200 active:scale-[0.98] transition-transform min-h-[60px] disabled:opacity-50"
      >
        {pending && choice === 'approve' ? (
          <span className="animate-spin text-xl">⌛</span>
        ) : (
          <span className="text-xl">✅</span>
        )}
        אני מאשר/ת את ההצעה
      </button>

      {!confirmReject ? (
        <button
          onClick={handleReject}
          disabled={pending}
          className="w-full flex items-center justify-center gap-2 bg-white text-slate-600 font-semibold text-sm px-6 py-3.5 rounded-2xl border border-slate-200 shadow-sm active:scale-[0.98] transition-transform min-h-[52px] disabled:opacity-50"
        >
          דחיית ההצעה
        </button>
      ) : (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-3">
          <p className="text-sm text-red-700 font-medium text-center">האם אתה בטוח שברצונך לדחות את ההצעה?</p>
          <div className="flex gap-2">
            <button
              onClick={handleReject}
              disabled={pending}
              className="flex-1 bg-red-600 text-white font-bold text-sm px-4 py-3 rounded-xl active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              {pending && choice === 'reject' ? '...' : 'כן, דחה'}
            </button>
            <button
              onClick={() => setConfirmReject(false)}
              className="flex-1 bg-white text-slate-600 font-semibold text-sm px-4 py-3 rounded-xl border border-slate-200"
            >
              ביטול
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
