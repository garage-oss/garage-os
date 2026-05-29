'use client'

import { useState, useTransition } from 'react'
import { useRouter }               from 'next/navigation'
import { sendQuoteToCustomer, cancelQuoteRequest, type QuoteItemEdit } from '@/app/actions/quote-request'
import { formatCurrency } from '@/lib/utils'
import { Trash2, Plus }   from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface QuoteDetailData {
  requestId:   string
  status:      string
  serviceType: string
  urgency:     string
  description: string | null
  createdAt:   Date
  customer: { name: string; phone: string }
  vehicle:  { make: string; model: string; plate: string; year: number }
  workOrder: { workOrderNumber: string; id: string }
  quote: {
    id:         string
    quoteNumber: string
    status:      string
    laborHours:  number
    laborRate:   number
    totalPrice:  number
    notes:       string | null
    isEstimate:  boolean
    items: Array<{
      id:          string
      description: string
      quantity:    number
      unitPrice:   number
      total:       number
    }>
  } | null
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function QuoteRequestDetail({ data }: { data: QuoteDetailData }) {
  const router  = useRouter()
  const [pending, start] = useTransition()

  const initial = data.quote
  const [laborHours, setLaborHours] = useState(initial?.laborHours ?? 1)
  const [laborRate,  setLaborRate]  = useState(initial?.laborRate  ?? 295)
  const [notes,      setNotes]      = useState(initial?.notes ?? '')
  const [validDays,  setValidDays]  = useState(14)
  const [items,      setItems]      = useState<QuoteItemEdit[]>(
    (initial?.items ?? []).map(i => ({
      description: i.description,
      quantity:    i.quantity,
      unitPrice:   i.unitPrice,
      total:       i.total,
    }))
  )

  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showCancel, setShowCancel] = useState(false)

  const VAT_RATE   = 0.17
  const partsTotal = items.reduce((s, i) => s + i.total, 0)
  const laborTotal = laborHours * laborRate
  const subtotal   = laborTotal + partsTotal
  const vat        = Math.round(subtotal * VAT_RATE * 100) / 100
  const total      = Math.round((subtotal + vat) * 100) / 100

  function addItem() {
    setItems(prev => [...prev, { description: '', quantity: 1, unitPrice: 0, total: 0 }])
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, field: keyof QuoteItemEdit, value: string) {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item
      const updated = { ...item, [field]: field === 'description' ? value : parseFloat(value) || 0 }
      updated.total = Math.round(updated.quantity * updated.unitPrice * 100) / 100
      return updated
    }))
  }

  function handleSend() {
    if (!data.quote) { setError('אין הצעת מחיר משויכת'); return }
    setError(null)
    start(async () => {
      const res = await sendQuoteToCustomer(data.requestId, { laborHours, laborRate, notes, validDays, items })
      if ('error' in res) { setError(String(res)); return }
      setSuccess(true)
      router.refresh()
    })
  }

  function handleCancel() {
    start(async () => {
      await cancelQuoteRequest(data.requestId)
      router.push('/dashboard/quote-requests')
    })
  }

  const canEdit = data.status === 'REVIEWING' || data.status === 'PENDING'
  const isSent  = data.status === 'SENT'

  // WhatsApp message
  const waText = `שלום ${data.customer.name},\n\nהצעת המחיר עבור ${data.vehicle.make} ${data.vehicle.model} (${data.vehicle.plate}) מוכנה.\n\nסך הכל: ${formatCurrency(total)}\n\nלצפייה ואישור היכנס לפורטל.`
  const waLink = data.customer.phone
    ? `https://wa.me/972${data.customer.phone.replace(/^0/, '').replace(/\D/g, '')}?text=${encodeURIComponent(waText)}`
    : null

  return (
    <div className="space-y-6">

      {/* Success banner */}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4 flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <div>
            <p className="font-bold text-emerald-700">הצעת המחיר נשלחה ללקוח!</p>
            <p className="text-sm text-emerald-600">הלקוח יוכל לאשר או לדחות דרך הפורטל</p>
          </div>
        </div>
      )}

      {/* Sent state — read-only with WhatsApp */}
      {isSent && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-5 py-4 flex items-center gap-3">
          <span className="text-2xl">📨</span>
          <p className="font-semibold text-indigo-700">ההצעה נשלחה — ממתין לתגובת הלקוח</p>
        </div>
      )}

      {/* Labor row */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">שכר עבודה</p>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-slate-500 mb-1 block">שעות</label>
            <input
              type="number" min={0} step={0.5}
              value={laborHours}
              onChange={e => setLaborHours(parseFloat(e.target.value) || 0)}
              disabled={!canEdit}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-slate-500 mb-1 block">תעריף (₪/שעה)</label>
            <input
              type="number" min={0} step={5}
              value={laborRate}
              onChange={e => setLaborRate(parseFloat(e.target.value) || 0)}
              disabled={!canEdit}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-slate-500 mb-1 block">סה"כ</label>
            <div className="border border-slate-100 bg-slate-50 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700">
              {formatCurrency(laborTotal)}
            </div>
          </div>
        </div>
      </div>

      {/* Parts */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">חלקים ושירותים</p>
          {canEdit && (
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              <Plus size={14} />
              הוסף שורה
            </button>
          )}
        </div>

        {items.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-3">אין חלקים — לחץ &quot;הוסף שורה&quot;</p>
        )}

        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_60px_80px_80px_32px] gap-2 items-center">
              <input
                type="text"
                value={item.description}
                onChange={e => updateItem(idx, 'description', e.target.value)}
                placeholder="תיאור"
                disabled={!canEdit}
                className="border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-300 disabled:bg-slate-50"
              />
              <input
                type="number" min={1}
                value={item.quantity}
                onChange={e => updateItem(idx, 'quantity', e.target.value)}
                disabled={!canEdit}
                className="border border-slate-200 rounded-lg px-2 py-2 text-xs text-center font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-300 disabled:bg-slate-50"
              />
              <input
                type="number" min={0} step={1}
                value={item.unitPrice}
                onChange={e => updateItem(idx, 'unitPrice', e.target.value)}
                disabled={!canEdit}
                className="border border-slate-200 rounded-lg px-2 py-2 text-xs text-center font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-300 disabled:bg-slate-50"
              />
              <div className="text-xs font-bold text-slate-700 text-center">
                {formatCurrency(item.total)}
              </div>
              {canEdit ? (
                <button type="button" onClick={() => removeItem(idx)} className="text-slate-300 hover:text-red-400 transition-colors flex items-center justify-center">
                  <Trash2 size={14} />
                </button>
              ) : <div />}
            </div>
          ))}
        </div>

        {/* Column headers */}
        {items.length > 0 && (
          <div className="grid grid-cols-[1fr_60px_80px_80px_32px] gap-2 text-[10px] text-slate-400">
            <span>תיאור</span><span className="text-center">כמות</span>
            <span className="text-center">מחיר יח׳</span><span className="text-center">סה"כ</span><span />
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">
          הערות ותנאים
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          disabled={!canEdit}
          rows={3}
          placeholder="הערות, תנאים, אחריות..."
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-slate-50"
        />
      </div>

      {/* Totals */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
        <div className="flex justify-between text-sm text-slate-500">
          <span>עבודה</span><span className="font-mono">{formatCurrency(laborTotal)}</span>
        </div>
        <div className="flex justify-between text-sm text-slate-500">
          <span>חלקים</span><span className="font-mono">{formatCurrency(partsTotal)}</span>
        </div>
        <div className="flex justify-between text-sm text-slate-500 pt-2 border-t border-slate-100">
          <span>סכום לפני מע"מ</span><span className="font-mono">{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm text-slate-500">
          <span>מע"מ 17%</span><span className="font-mono">{formatCurrency(vat)}</span>
        </div>
        <div className="flex justify-between font-black text-lg text-indigo-600 pt-2 border-t border-slate-100">
          <span>סה"כ כולל מע"מ</span><span>{formatCurrency(total)}</span>
        </div>

        {/* Auto-estimate disclaimer */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 flex items-start gap-2 mt-2">
          <span className="text-sm shrink-0">⚠️</span>
          <p className="text-xs text-amber-700">
            <strong>הצעה אוטומטית — הערכה בלבד.</strong> יש לאשר ולעדכן לפני שליחה ללקוח.
          </p>
        </div>
      </div>

      {/* Validity */}
      {canEdit && (
        <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4 flex items-center gap-3">
          <label className="text-sm text-slate-600 shrink-0">תוקף ההצעה:</label>
          <select
            value={validDays}
            onChange={e => setValidDays(parseInt(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-300"
          >
            <option value={7}>7 ימים</option>
            <option value={14}>14 ימים</option>
            <option value={30}>30 ימים</option>
          </select>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Actions */}
      {canEdit && !success && (
        <div className="space-y-3">
          <button
            type="button"
            disabled={pending}
            onClick={handleSend}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white font-black text-base px-6 py-4 rounded-2xl shadow-md shadow-emerald-200 active:scale-[0.98] transition-transform min-h-[60px] disabled:opacity-50"
          >
            {pending ? '...' : '📨 אשר ושלח ללקוח'}
          </button>

          {/* WhatsApp button (shows after sending) */}
          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-green-600 text-white font-bold text-sm px-6 py-3.5 rounded-2xl active:scale-[0.98] transition-transform min-h-[52px]"
            >
              <span className="text-lg">💬</span>
              שלח הודעה בווטסאפ
            </a>
          )}

          {/* Cancel */}
          {!showCancel ? (
            <button
              type="button"
              onClick={() => setShowCancel(true)}
              className="w-full text-slate-400 text-sm py-2 hover:text-red-500 transition-colors"
            >
              ביטול הבקשה
            </button>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-3">
              <p className="text-sm text-red-700 font-medium text-center">לבטל את בקשת הצעת המחיר?</p>
              <div className="flex gap-2">
                <button onClick={handleCancel} disabled={pending} className="flex-1 bg-red-600 text-white font-bold text-sm px-4 py-2.5 rounded-xl disabled:opacity-50">
                  כן, בטל
                </button>
                <button onClick={() => setShowCancel(false)} className="flex-1 bg-white text-slate-600 font-semibold text-sm px-4 py-2.5 rounded-xl border border-slate-200">
                  חזרה
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* WhatsApp send after already sent */}
      {isSent && waLink && (
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 bg-green-600 text-white font-bold text-sm px-6 py-4 rounded-2xl active:scale-[0.98] transition-transform min-h-[56px]"
        >
          <span className="text-lg">💬</span>
          שלח תזכורת בווטסאפ
        </a>
      )}

    </div>
  )
}
