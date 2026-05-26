'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'

export function PayrollExport() {
  const today   = new Date()
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString().slice(0, 10)
  const todayStr = today.toISOString().slice(0, 10)

  const [from,    setFrom]    = useState(firstOfMonth)
  const [to,      setTo]      = useState(todayStr)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function handleExport() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/export/payroll?from=${from}&to=${to}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? `שגיאה ${res.status}`)
        return
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `payroll_${from}_${to}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5">
      <h3 className="font-semibold mb-4">ייצוא נתוני שכר</h3>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs text-[#8892a4] mb-1">מתאריך</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full bg-[#12141f] border border-[#2e3147] rounded-lg px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-[#8892a4] mb-1">עד תאריך</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full bg-[#12141f] border border-[#2e3147] rounded-lg px-3 py-2 text-sm text-white"
          />
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-400 mb-3">{error}</p>
      )}

      <button
        onClick={handleExport}
        disabled={loading || !from || !to}
        className="w-full flex items-center justify-center gap-2 bg-[#6366f1] hover:bg-[#5558e3] text-white rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
      >
        {loading
          ? <><Loader2 size={16} className="animate-spin" /> מייצא...</>
          : <><Download size={16} /> ייצא CSV</>
        }
      </button>

      <p className="text-xs text-[#8892a4] mt-3">
        מכיל: שעות נוכחות, שעות עבודה בפועל לפי פקודות עבודה, הפרש לעובד.
      </p>
    </div>
  )
}
