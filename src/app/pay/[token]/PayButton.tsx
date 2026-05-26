'use client'

import { useState, useTransition } from 'react'
import { markPaymentPaid } from '@/app/actions/payments'
import { CreditCard, Check, Loader2 } from 'lucide-react'

export function PayButton({ token }: { token: string }) {
  const [done,      setDone]    = useState(false)
  const [error,     setError]   = useState<string | null>(null)
  const [isPending, start]      = useTransition()

  async function handlePay() {
    setError(null)
    start(async () => {
      const res = await markPaymentPaid(token)
      if (res.error) { setError(res.error); return }
      setDone(true)
    })
  }

  if (done) {
    return (
      <div className="flex items-center justify-center gap-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold py-3.5 rounded-xl text-sm">
        <Check size={18} />
        תשלום אושר!
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handlePay}
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-50 text-white font-bold py-4 rounded-xl text-base transition-colors"
      >
        {isPending ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}
        {isPending ? 'מעבד...' : 'שלם עכשיו'}
      </button>
      {error && <p className="text-xs text-red-400 text-center">{error}</p>}
      <p className="text-[10px] text-[#8892a4] text-center">
        * בלחיצה על שלם, אתה מאשר ביצוע התשלום
      </p>
    </div>
  )
}
