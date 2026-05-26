'use client'

import { useState, useEffect, useCallback } from 'react'
import { clockIn, clockOut } from '@/app/actions/clock'
import { LogIn, LogOut, Clock } from 'lucide-react'

interface ClockWidgetProps {
  initialClockedIn:  boolean
  initialEntryId?:   string
  initialClockInAt?: string  // ISO string
}

function elapsed(from: Date): string {
  const secs = Math.floor((Date.now() - from.getTime()) / 1000)
  const h    = Math.floor(secs / 3600)
  const m    = Math.floor((secs % 3600) / 60)
  const s    = secs % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

export function ClockWidget({
  initialClockedIn,
  initialEntryId,
  initialClockInAt,
}: ClockWidgetProps) {
  const [clockedIn,  setClockedIn]  = useState(initialClockedIn)
  const [entryId,    setEntryId]    = useState(initialEntryId)
  const [clockInAt,  setClockInAt]  = useState<Date | null>(
    initialClockInAt ? new Date(initialClockInAt) : null
  )
  const [elapsed_,   setElapsed]    = useState<string>('00:00:00')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  // Live clock
  useEffect(() => {
    if (!clockedIn || !clockInAt) return
    const id = setInterval(() => setElapsed(elapsed(clockInAt)), 1000)
    return () => clearInterval(id)
  }, [clockedIn, clockInAt])

  const handleClockIn = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await clockIn()
    if (result.error && !result.clockedIn) {
      setError(result.error)
    } else {
      setClockedIn(true)
      setEntryId(result.entryId)
      setClockInAt(new Date())
    }
    setLoading(false)
  }, [])

  const handleClockOut = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await clockOut()
    if (result.error) {
      setError(result.error)
    } else {
      setClockedIn(false)
      setEntryId(undefined)
      setClockInAt(null)
      setElapsed('00:00:00')
    }
    setLoading(false)
  }, [])

  return (
    <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-2.5 h-2.5 rounded-full ${clockedIn ? 'bg-emerald-400 animate-pulse' : 'bg-[#2e3147]'}`} />
        <span className="text-sm font-semibold">
          {clockedIn ? 'במשמרת עכשיו' : 'לא במשמרת'}
        </span>
      </div>

      {clockedIn && (
        <div className="flex items-center gap-2 text-2xl font-mono font-bold text-emerald-400 mb-4">
          <Clock size={20} />
          {elapsed_}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400 mb-3">{error}</p>
      )}

      <button
        onClick={clockedIn ? handleClockOut : handleClockIn}
        disabled={loading}
        className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-colors ${
          clockedIn
            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
            : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
        } disabled:opacity-50`}
      >
        {clockedIn ? <LogOut size={16} /> : <LogIn size={16} />}
        {loading ? 'טוען...' : clockedIn ? 'יציאה מעבודה' : 'כניסה לעבודה'}
      </button>

      {clockedIn && clockInAt && (
        <p className="text-xs text-[#8892a4] mt-2 text-center">
          כניסה: {clockInAt.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  )
}
