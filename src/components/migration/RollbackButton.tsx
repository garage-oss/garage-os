'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCcw, Loader2 } from 'lucide-react'

export function RollbackButton({ batchId }: { batchId: string }) {
  const router  = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleRollback() {
    if (!confirm('לבטל את כל הרשומות שנוצרו בייבוא זה? פעולה זו אינה הפיכה.')) return
    setLoading(true)
    try {
      const res  = await fetch(`/api/migration/batches/${batchId}/rollback`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { alert(json.error); return }
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleRollback}
      disabled={loading}
      className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-40"
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
      {loading ? 'מבטל...' : 'בטל ייבוא'}
    </button>
  )
}
