'use client'

import { useState, useEffect, useTransition, useRef, useCallback } from 'react'
import { Play, Pause, StopCircle, Clock } from 'lucide-react'
import { startTimer, pauseTimer, resumeTimer, finishTimer } from '@/app/actions/time-entries'
import { WorkOrderStatus } from '@prisma/client'

interface Props {
  workOrderId:        string
  activeEntryId:      string | null
  activeStartedAt:    string | null
  activePausedAt:     string | null
  activeDurationMin:  number
  totalMinutes:       number
  workOrderStatus:    WorkOrderStatus
}

function pad(n: number) { return String(n).padStart(2, '0') }

function formatSecs(totalSecs: number) {
  const h = Math.floor(totalSecs / 3600)
  const m = Math.floor((totalSecs % 3600) / 60)
  const s = totalSecs % 60
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

export function MobileTimerSection({
  workOrderId,
  activeEntryId: initialEntryId,
  activeStartedAt: initialStartedAt,
  activePausedAt: initialPausedAt,
  activeDurationMin: initialDurMin,
  totalMinutes,
  workOrderStatus,
}: Props) {
  const [entryId,     setEntryId]    = useState(initialEntryId)
  const [startedAt,   setStartedAt]  = useState(initialStartedAt ? new Date(initialStartedAt) : null)
  const [isPaused,    setIsPaused]   = useState(!!initialPausedAt)
  const [durMin,      setDurMin]     = useState(initialDurMin)
  const [elapsed,     setElapsed]    = useState(0)   // seconds of current segment
  const [totalMin,    setTotalMin]   = useState(totalMinutes)
  const [isPending,   startTransition] = useTransition()
  const [error,       setError]      = useState<string | null>(null)
  const [finishNote,  setFinishNote] = useState('')
  const [showFinish,  setShowFinish] = useState(false)
  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null)

  // Tick while running
  const startTick = useCallback((from: Date, accumMin: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      const secs = Math.floor((Date.now() - from.getTime()) / 1000)
      setElapsed(secs)
      setTotalMin(accumMin + Math.floor(secs / 60))
    }, 1000)
  }, [])

  useEffect(() => {
    if (startedAt && !isPaused) {
      startTick(startedAt, durMin)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [startedAt, isPaused, durMin, startTick])

  const isRunning   = !!entryId && !isPaused
  const isActive    = !!entryId
  const isCompleted = workOrderStatus === 'COMPLETED'

  async function handleStart() {
    setError(null)
    startTransition(async () => {
      const res = await startTimer(workOrderId)
      if ('error' in res) { setError(res.error); return }
      const now = new Date()
      setEntryId(res.entryId)
      setStartedAt(now)
      setIsPaused(false)
      setDurMin(0)
      startTick(now, 0)
    })
  }

  async function handlePause() {
    if (!entryId) return
    setError(null)
    if (intervalRef.current) clearInterval(intervalRef.current)
    startTransition(async () => {
      const res = await pauseTimer(entryId)
      if (res.error) { setError(res.error); return }
      setIsPaused(true)
      setDurMin((prev) => prev + Math.floor(elapsed / 60))
    })
  }

  async function handleResume() {
    if (!entryId) return
    setError(null)
    startTransition(async () => {
      const res = await resumeTimer(entryId)
      if ('error' in res) { setError(res.error); return }
      const now = new Date()
      setEntryId(res.entryId)
      setStartedAt(now)
      setIsPaused(false)
      setElapsed(0)
      startTick(now, durMin)
    })
  }

  async function handleFinish() {
    if (!entryId) return
    setError(null)
    if (intervalRef.current) clearInterval(intervalRef.current)
    startTransition(async () => {
      const res = await finishTimer(entryId, finishNote || undefined)
      if (res.error) { setError(res.error); return }
      setEntryId(null)
      setStartedAt(null)
      setIsPaused(false)
      setShowFinish(false)
      setFinishNote('')
    })
  }

  const displaySecs = isRunning ? elapsed : durMin * 60

  return (
    <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2e3147]">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Clock size={15} className="text-[#8892a4]" />
          <span>מעקב זמן</span>
        </div>
        <div className="text-xs text-[#8892a4]">
          סה״כ: <span className="font-mono text-white font-semibold">{pad(Math.floor(totalMin/60))}:{pad(totalMin%60)}</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Big timer display */}
        <div className="text-center">
          <div className={`text-4xl font-mono font-bold tabular-nums transition-colors ${isRunning ? 'text-[#6366f1]' : isPaused ? 'text-amber-400' : 'text-[#8892a4]'}`}>
            {formatSecs(displaySecs)}
          </div>
          <div className="text-xs text-[#8892a4] mt-1">
            {isRunning ? 'פועל...' : isPaused ? 'מושהה' : 'לא פועל'}
          </div>
        </div>

        {/* Controls */}
        {!isCompleted && (
          <div className="flex gap-3 justify-center">
            {!isActive && (
              <button
                onClick={handleStart}
                disabled={isPending}
                className="flex-1 flex items-center justify-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
              >
                <Play size={16} />
                התחל
              </button>
            )}

            {isActive && !isPaused && (
              <button
                onClick={handlePause}
                disabled={isPending}
                className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
              >
                <Pause size={16} />
                השהה
              </button>
            )}

            {isActive && isPaused && (
              <button
                onClick={handleResume}
                disabled={isPending}
                className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
              >
                <Play size={16} />
                המשך
              </button>
            )}

            {isActive && (
              <button
                onClick={() => setShowFinish(true)}
                disabled={isPending}
                className="flex-1 flex items-center justify-center gap-2 bg-[#1a1d27] hover:bg-[#252836] border border-[#2e3147] text-[#8892a4] hover:text-red-400 hover:border-red-400/30 font-semibold py-3 rounded-xl transition-colors text-sm"
              >
                <StopCircle size={16} />
                סיים
              </button>
            )}
          </div>
        )}

        {/* Finish confirmation */}
        {showFinish && (
          <div className="space-y-3">
            <textarea
              value={finishNote}
              onChange={(e) => setFinishNote(e.target.value)}
              placeholder="הוסף הערה (אופציונלי)..."
              rows={2}
              className="w-full bg-[#252836] border border-[#2e3147] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#8892a4] focus:outline-none focus:border-[#6366f1] resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={handleFinish}
                disabled={isPending}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
              >
                אשר סיום
              </button>
              <button
                onClick={() => setShowFinish(false)}
                className="flex-1 bg-[#252836] hover:bg-[#2e3147] text-[#8892a4] font-semibold py-2.5 rounded-xl text-sm transition-colors"
              >
                ביטול
              </button>
            </div>
          </div>
        )}

        {error && <p className="text-xs text-red-400 text-center">{error}</p>}
      </div>
    </div>
  )
}
