'use client'

import { useState, useEffect } from 'react'
import Link                    from 'next/link'
import { X }                   from 'lucide-react'

const SNOOZE_KEY   = 'doc_reminder_snoozed_until'
const DISMISS_KEY  = 'doc_reminder_dismissed'

interface Props {
  vehicleId: string
}

export default function DocReminderBanner({ vehicleId }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      const dismissed  = localStorage.getItem(DISMISS_KEY)
      if (dismissed === 'true') return

      const snoozedStr = localStorage.getItem(SNOOZE_KEY)
      if (snoozedStr) {
        const snoozedUntil = new Date(snoozedStr)
        if (snoozedUntil > new Date()) return
      }

      setVisible(true)
    } catch { /* localStorage unavailable */ }
  }, [])

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, 'true') } catch { /* */ }
    setVisible(false)
  }

  function snooze(days: number) {
    try {
      const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
      localStorage.setItem(SNOOZE_KEY, until.toISOString())
    } catch { /* */ }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="bg-indigo-50 border-2 border-indigo-100 rounded-3xl p-5 relative">
      <button onClick={dismiss} className="absolute top-3 left-3 text-indigo-300 hover:text-indigo-500">
        <X size={18} />
      </button>

      <div className="flex items-start gap-3 mb-4">
        <span className="text-2xl shrink-0">📄</span>
        <div>
          <p className="font-black text-indigo-900 text-base leading-tight">כדאי להשלים את מסמכי הרכב</p>
          <p className="text-indigo-700 text-sm mt-1">
            שמור את מסמכי הרכב שלך במקום אחד ותקבל תזכורות לפני פקיעת תוקף.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Link
          href={`/portal/vehicles/${vehicleId}/documents`}
          className="w-full text-center bg-indigo-600 text-white font-bold py-3 rounded-2xl text-sm"
        >
          העלאת מסמכים
        </Link>
        <div className="flex gap-2">
          <button
            onClick={() => snooze(30)}
            className="flex-1 text-center bg-white border border-indigo-200 text-indigo-600 font-semibold py-2.5 rounded-xl text-sm"
          >
            תזכירו לי אחר כך
          </button>
          <button
            onClick={dismiss}
            className="flex-1 text-center text-indigo-400 font-semibold py-2.5 rounded-xl text-sm"
          >
            לא עכשיו
          </button>
        </div>
      </div>
    </div>
  )
}
