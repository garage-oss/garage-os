'use client'

/**
 * SessionTimeout — client-side session expiry handler.
 *
 * Monitors user activity and shows a warning modal N minutes before the session
 * expires. If the user doesn't respond, logs them out automatically.
 *
 * Reads SESSION_TIMEOUT_MINUTES from NEXT_PUBLIC_SESSION_TIMEOUT (set in
 * next.config via env) or defaults to 480 minutes (8 hours).
 *
 * Usage: Mount once in the dashboard layout.
 * <SessionTimeout />
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { signOut } from 'next-auth/react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

const TIMEOUT_MS = (
  typeof process !== 'undefined' &&
  process.env.NEXT_PUBLIC_SESSION_TIMEOUT
    ? parseInt(process.env.NEXT_PUBLIC_SESSION_TIMEOUT, 10)
    : 480
) * 60 * 1000

const WARNING_BEFORE_MS = 5 * 60 * 1000   // Show warning 5 min before expiry
const ACTIVITY_EVENTS   = ['mousedown', 'keydown', 'touchstart', 'scroll']

export function SessionTimeout() {
  const [showWarning, setShowWarning] = useState(false)
  const [countdown,  setCountdown]   = useState(300)   // seconds
  const lastActive  = useRef(Date.now())
  const warningTimer = useRef<ReturnType<typeof setTimeout>>()
  const logoutTimer  = useRef<ReturnType<typeof setTimeout>>()
  const countdownInterval = useRef<ReturnType<typeof setInterval>>()

  const resetTimers = useCallback(() => {
    lastActive.current = Date.now()
    setShowWarning(false)
    clearTimeout(warningTimer.current)
    clearTimeout(logoutTimer.current)
    clearInterval(countdownInterval.current)

    warningTimer.current = setTimeout(() => {
      setShowWarning(true)
      setCountdown(Math.floor(WARNING_BEFORE_MS / 1000))

      countdownInterval.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval.current)
            return 0
          }
          return prev - 1
        })
      }, 1000)

      logoutTimer.current = setTimeout(() => {
        signOut({ callbackUrl: '/login?reason=timeout' })
      }, WARNING_BEFORE_MS)
    }, TIMEOUT_MS - WARNING_BEFORE_MS)
  }, [])

  useEffect(() => {
    resetTimers()

    const handler = () => resetTimers()
    ACTIVITY_EVENTS.forEach((e) => document.addEventListener(e, handler, { passive: true }))

    return () => {
      ACTIVITY_EVENTS.forEach((e) => document.removeEventListener(e, handler))
      clearTimeout(warningTimer.current)
      clearTimeout(logoutTimer.current)
      clearInterval(countdownInterval.current)
    }
  }, [resetTimers])

  if (!showWarning) return null

  const minutes = Math.floor(countdown / 60)
  const seconds = countdown % 60
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1a1d27] border border-amber-500/30 rounded-2xl p-6 max-w-sm mx-4 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <AlertTriangle size={20} className="text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">הפגישה עומדת לפוג</h3>
            <p className="text-xs text-[#8892a4]">תצא מהמערכת אוטומטית</p>
          </div>
        </div>

        <div className="text-center mb-5">
          <div className="text-4xl font-mono font-bold text-amber-400">{timeStr}</div>
          <p className="text-sm text-[#8892a4] mt-1">דקות עד לניתוק</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={resetTimers}
            className="flex-1 flex items-center justify-center gap-2 bg-[#6366f1] hover:bg-[#5558e3] text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
          >
            <RefreshCw size={14} />
            המשך פגישה
          </button>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex-1 bg-[#2e3147] hover:bg-[#363a55] text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
          >
            התנתק
          </button>
        </div>
      </div>
    </div>
  )
}
