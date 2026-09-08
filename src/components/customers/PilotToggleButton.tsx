'use client'

import { useRouter } from 'next/navigation'
import { useState }  from 'react'
import { Rocket, RocketIcon } from 'lucide-react'

interface Props {
  customerId:   string
  pilotEnabled: boolean
}

export function PilotToggleButton({ customerId, pilotEnabled }: Props) {
  const router = useRouter()
  const [loading, setLoading]   = useState(false)
  const [enabled, setEnabled]   = useState(pilotEnabled)

  async function toggle() {
    setLoading(true)
    try {
      const method = enabled ? 'DELETE' : 'POST'
      const res = await fetch(`/api/customers/${customerId}/pilot`, { method })
      if (res.ok) {
        setEnabled(!enabled)
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
        enabled
          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30'
          : 'bg-[#2e3147] text-[#8892a4] border border-[#3a3f55] hover:bg-emerald-500/20 hover:text-emerald-400 hover:border-emerald-500/30'
      }`}
    >
      {enabled ? (
        <>
          <Rocket size={15} className="shrink-0" />
          {loading ? '...' : 'פיילוט פעיל — לחץ להשבית'}
        </>
      ) : (
        <>
          <RocketIcon size={15} className="shrink-0 opacity-40" />
          {loading ? '...' : 'הפעל פיילוט'}
        </>
      )}
    </button>
  )
}
