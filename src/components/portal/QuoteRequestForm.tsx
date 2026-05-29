'use client'

import { useState, useTransition } from 'react'
import { useRouter }               from 'next/navigation'
import { submitQuoteRequest }      from '@/app/actions/quote-request'
import {
  SERVICE_TYPE_LABELS,
  SERVICE_TYPE_ICONS,
  URGENCY_LABELS,
} from '@/lib/quote-engine'
import type { QuoteRequestServiceType, QuoteRequestUrgency } from '@prisma/client'

const SERVICE_TYPES: QuoteRequestServiceType[] = [
  'PERIODIC_SERVICE', 'BRAKES', 'BATTERY', 'TIRES',
  'AC', 'CHECK_ENGINE', 'DIAGNOSTICS', 'OTHER',
]

const URGENCIES: QuoteRequestUrgency[] = ['LOW', 'NORMAL', 'HIGH']

const URGENCY_STYLE: Record<QuoteRequestUrgency, { idle: string; active: string }> = {
  LOW:    { idle: 'border-slate-200 text-slate-500',   active: 'border-slate-500 bg-slate-100 text-slate-700 font-bold' },
  NORMAL: { idle: 'border-amber-200 text-amber-600',   active: 'border-amber-500 bg-amber-50  text-amber-700  font-bold' },
  HIGH:   { idle: 'border-red-200   text-red-500',     active: 'border-red-500   bg-red-50    text-red-700    font-bold' },
}

export function QuoteRequestForm({ token }: { token: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  const [serviceType,  setServiceType]  = useState<QuoteRequestServiceType | null>(null)
  const [urgency,      setUrgency]      = useState<QuoteRequestUrgency>('NORMAL')
  const [description,  setDescription]  = useState('')
  const [error,        setError]        = useState<string | null>(null)

  async function handleSubmit() {
    if (!serviceType) { setError('יש לבחור סוג שירות'); return }
    setError(null)
    start(async () => {
      const res = await submitQuoteRequest(token, serviceType, urgency, description || null)
      if ('error' in res) { setError(res.error ?? 'שגיאה לא ידועה'); return }
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">

      {/* Service type */}
      <div>
        <p className="text-sm font-bold text-slate-600 mb-3">סוג השירות</p>
        <div className="grid grid-cols-2 gap-2.5">
          {SERVICE_TYPES.map(st => {
            const active = serviceType === st
            return (
              <button
                key={st}
                type="button"
                onClick={() => setServiceType(st)}
                className={`
                  flex flex-col items-center justify-center gap-1.5 p-4 rounded-2xl border-2
                  transition-all active:scale-95 min-h-[88px]
                  ${active
                    ? 'border-indigo-500 bg-indigo-50 shadow-md shadow-indigo-100'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                  }
                `}
              >
                <span className="text-2xl leading-none">{SERVICE_TYPE_ICONS[st]}</span>
                <span className={`text-xs font-semibold text-center leading-tight ${active ? 'text-indigo-700' : 'text-slate-600'}`}>
                  {SERVICE_TYPE_LABELS[st]}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Urgency */}
      <div>
        <p className="text-sm font-bold text-slate-600 mb-3">דחיפות</p>
        <div className="flex gap-2">
          {URGENCIES.map(u => {
            const active = urgency === u
            const style  = URGENCY_STYLE[u]
            return (
              <button
                key={u}
                type="button"
                onClick={() => setUrgency(u)}
                className={`
                  flex-1 py-3 px-2 rounded-xl border-2 text-sm text-center
                  transition-all active:scale-95 min-h-[48px]
                  ${active ? style.active : style.idle}
                `}
              >
                {URGENCY_LABELS[u]}
              </button>
            )
          })}
        </div>
      </div>

      {/* Description */}
      <div>
        <p className="text-sm font-bold text-slate-600 mb-2">תיאור הבעיה (אופציונלי)</p>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={4}
          placeholder="תאר את הבעיה, הצלילים, המצב..."
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
        />
      </div>

      {/* WhatsApp photo hint */}
      <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-start gap-2.5">
        <span className="text-lg shrink-0 mt-0.5">📱</span>
        <p className="text-sm text-green-700">
          לצירוף תמונות או וידאו — שלח אותן <strong>בווטסאפ</strong> ישירות לאחר הגשת הבקשה
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="button"
        disabled={pending || !serviceType}
        onClick={handleSubmit}
        className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white font-black text-lg px-6 py-5 rounded-2xl shadow-lg shadow-indigo-200 active:scale-[0.98] transition-transform min-h-[68px] disabled:opacity-50"
      >
        {pending ? (
          <span className="animate-spin text-xl">⌛</span>
        ) : (
          <span className="text-2xl">📋</span>
        )}
        {pending ? 'שולח בקשה...' : 'שלח בקשה להצעת מחיר'}
      </button>

      <p className="text-center text-xs text-slate-400">
        הצעת המחיר תיווצר אוטומטית ותועבר לאישור המוסך לפני שתישלח אליך
      </p>

    </div>
  )
}
