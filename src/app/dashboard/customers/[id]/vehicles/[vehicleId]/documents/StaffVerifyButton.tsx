'use client'

import { useRouter } from 'next/navigation'
import { useState }  from 'react'

interface Props {
  vehicleId:       string
  docId:           string
  alreadyVerified: boolean
}

export function StaffVerifyButton({ vehicleId, docId, alreadyVerified }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [verified, setVerified] = useState(alreadyVerified)

  if (verified) {
    return <span className="text-emerald-600 text-xs font-bold px-3 py-1.5 bg-emerald-50 rounded-lg">אומת ✓</span>
  }

  async function handleVerify() {
    setLoading(true)
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/documents/${docId}/verify`, { method: 'POST' })
      if (res.ok) {
        setVerified(true)
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleVerify}
      disabled={loading}
      className="text-xs font-bold text-white bg-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? '...' : 'אמת'}
    </button>
  )
}
