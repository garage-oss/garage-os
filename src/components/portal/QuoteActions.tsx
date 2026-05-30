'use client'

import { useState, useTransition } from 'react'
import { approveQuote, rejectQuote } from '@/app/actions/portal'

export function QuoteActions({ quoteId, workOrderId }: { quoteId: string; workOrderId: string }) {
  const [pending,     startTransition] = useTransition()
  const [choice,      setChoice]       = useState<'approve' | 'reject' | null>(null)
  const [confirmReject, setConfirmReject] = useState(false)

  const [done, setDone] = useState<'approve' | 'reject' | null>(null)

  function handleApprove() {
    setChoice('approve')
    startTransition(async () => {
      await approveQuote(quoteId, workOrderId)
      setDone('approve')
    })
  }

  function handleReject() {
    if (!confirmReject) { setConfirmReject(true); return }
    setChoice('reject')
    startTransition(async () => {
      await rejectQuote(quoteId, workOrderId)
      setDone('reject')
    })
  }

  if (done === 'approve') {
    return (
      <div className="text-center py-2">
        <span className="text-4xl block mb-2">✅</span>
        <p className="font-bold text-emerald-700">ההצעה אושרה בהצלחה!</p>
        <p className="text-sm text-emerald-600 mt-1">הדף יתרענן בקרוב</p>
      </div>
    )
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
        אישור הצעת המחיר
      </button>

      {!confirmReject ? (
        <button
          onClick={handleReject}
          disabled={pending}
          className="w-full flex items-center justify-center gap-2 bg-white text-slate-500 font-semibold text-sm px-6 py-3.5 rounded-2xl border border-slate-200 shadow-sm active:scale-[0.98] transition-transform min-h-[52px] disabled:opacity-50"
        >
          אינני מאשר/ת — לא מעוניין/ת
        </button>
      ) : (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-3">
          <p className="text-sm text-red-700 font-medium text-center">בטוח/ה שברצונך לדחות את ההצעה?</p>
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
              חזרה
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
