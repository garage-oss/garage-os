'use client'

import { useState, useTransition } from 'react'
import { adjustStock } from '@/app/actions/parts'
import { MovementType } from '@prisma/client'

interface Props {
  partId: string
  currentQty: number
  onClose: () => void
}

export function StockAdjustModal({ partId, currentQty, onClose }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [type, setType] = useState<MovementType>('IN')
  const [qty, setQty] = useState(1)
  const [reason, setReason] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const result = await adjustStock(partId, type, qty, reason)
      if ('error' in result) {
        setError(result.error)
      } else {
        onClose()
      }
    })
  }

  const preview = type === 'IN'
    ? currentQty + qty
    : type === 'OUT'
    ? currentQty - qty
    : currentQty + qty

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-semibold text-lg mb-4">עדכון מלאי</h2>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-[#8892a4] mb-1.5">סוג תנועה</label>
            <div className="grid grid-cols-3 gap-2">
              {(['IN', 'OUT', 'ADJUSTMENT'] as MovementType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`py-2 rounded-lg text-sm font-medium border transition-all ${
                    type === t
                      ? t === 'IN'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                        : t === 'OUT'
                        ? 'bg-red-500/15 border-red-500/40 text-red-400'
                        : 'bg-[#6366f1]/15 border-[#6366f1]/40 text-[#6366f1]'
                      : 'bg-[#252836] border-[#2e3147] text-[#8892a4]'
                  }`}
                >
                  {t === 'IN' ? 'כניסה' : t === 'OUT' ? 'יציאה' : 'תיקון'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#8892a4] mb-1.5">
              כמות {type === 'ADJUSTMENT' ? '(+ להוספה, - להפחתה)' : ''}
            </label>
            <input
              type="number"
              min={type === 'ADJUSTMENT' ? undefined : 1}
              value={qty}
              onChange={(e) => setQty(parseInt(e.target.value) || 0)}
              className="w-full bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2.5 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#6366f1]"
            />
          </div>

          <div>
            <label className="block text-xs text-[#8892a4] mb-1.5">סיבה</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="קבלת סחורה, שימוש בפקודה..."
              className="w-full bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2.5 text-sm text-[#e2e8f0] placeholder-[#4a5568] focus:outline-none focus:border-[#6366f1]"
            />
          </div>

          <div className="bg-[#252836] rounded-lg px-4 py-3 text-sm">
            <span className="text-[#8892a4]">יתרה לאחר:</span>
            <span className="font-bold text-lg ms-2">{preview}</span>
            <span className="text-[#8892a4] text-xs ms-1">יח׳</span>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-60 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
            >
              {isPending ? 'מעדכן...' : 'עדכן מלאי'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm text-[#8892a4] hover:text-[#e2e8f0] transition-colors"
            >
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
