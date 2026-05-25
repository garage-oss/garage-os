'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'

interface Props {
  onDelete: () => Promise<{ error?: string }>
  redirectTo?: string
  label?: string
}

export function DeleteButton({ onDelete, redirectTo, label = 'מחק' }: Props) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handle() {
    if (!confirm('האם למחוק? פעולה זו אינה הפיכה.')) return
    startTransition(async () => {
      const res = await onDelete()
      if (res.error) {
        alert(res.error)
      } else if (redirectTo) {
        router.push(redirectTo)
      }
    })
  }

  return (
    <button
      onClick={handle}
      disabled={isPending}
      className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-all disabled:opacity-50"
    >
      {isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
      {label}
    </button>
  )
}
