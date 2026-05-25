'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'
import { acceptInvitation } from '@/app/actions/settings'

export function AcceptInviteButton({ token }: { token: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function handleAccept() {
    startTransition(async () => {
      const res = await acceptInvitation(token)
      if (res.error) {
        setError(res.error)
      } else {
        router.push('/dashboard')
      }
    })
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">{error}</div>
      )}
      <button
        onClick={handleAccept}
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-3 transition-colors"
      >
        {isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
        קבל הזמנה והצטרף לצוות
      </button>
    </div>
  )
}
