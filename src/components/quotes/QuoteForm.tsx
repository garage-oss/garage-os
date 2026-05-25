'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createQuote, updateQuote } from '@/app/actions/quotes'
import { Plus, Trash2 } from 'lucide-react'

type Customer = { id: string; name: string; phone: string }
type Vehicle = { id: string; make: string; model: string; plate: string; customerId: string }
type LineItem = { description: string; quantity: number; unitPrice: number }

interface QuoteData {
  id: string
  laborHours: number
  laborRate: number
  notes: string | null
  validUntil: Date | null
  customerId: string
  vehicleId: string | null
  items: { description: string; quantity: number; unitPrice: number }[]
}

interface Props {
  customers: Customer[]
  vehicles: Vehicle[]
  mode: 'create' | 'edit'
  quote?: QuoteData
  defaultCustomerId?: string
}

export function QuoteForm({ customers, vehicles, mode, quote, defaultCustomerId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const [customerId, setCustomerId] = useState(quote?.customerId ?? defaultCustomerId ?? '')
  const [vehicleId, setVehicleId] = useState(quote?.vehicleId ?? '')
  const [laborHours, setLaborHours] = useState(quote?.laborHours ?? 1)
  const [laborRate, setLaborRate] = useState(quote?.laborRate ?? 150)
  const [items, setItems] = useState<LineItem[]>(
    quote?.items?.length ? quote.items : [{ description: '', quantity: 1, unitPrice: 0 }]
  )

  const customerVehicles = vehicles.filter((v) => v.customerId === customerId)

  useEffect(() => {
    if (!customerVehicles.find((v) => v.id === vehicleId)) {
      setVehicleId('')
    }
  }, [customerId]) // eslint-disable-line react-hooks/exhaustive-deps

  const partsTotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const laborTotal = laborHours * laborRate
  const total = partsTotal + laborTotal

  function addItem() {
    setItems([...items, { description: '', quantity: 1, unitPrice: 0 }])
  }

  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, field: keyof LineItem, value: string | number) {
    setItems(items.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    if (!customerId) { setError('יש לבחור לקוח'); return }
    if (items.some((i) => !i.description.trim())) { setError('יש למלא תיאור לכל הפריטים'); return }

    const formData = new FormData(e.currentTarget)
    formData.set('customerId', customerId)
    formData.set('vehicleId', vehicleId)
    formData.set('laborHours', String(laborHours))
    formData.set('laborRate', String(laborRate))
    formData.set('items', JSON.stringify(items))

    startTransition(async () => {
      const result = mode === 'create'
        ? await createQuote(formData)
        : await updateQuote(quote!.id, formData)
      if ('error' in result) {
        setError(result.error)
      } else {
        router.push(`/dashboard/quotes/${result.id}`)
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-3xl">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Customer & Vehicle */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-[#8892a4] uppercase tracking-wide">לקוח ורכב</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[#8892a4] mb-1.5">לקוח *</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
              className="w-full bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2.5 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#6366f1]"
            >
              <option value="">בחר לקוח</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#8892a4] mb-1.5">רכב</label>
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              disabled={!customerId}
              className="w-full bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2.5 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#6366f1] disabled:opacity-50"
            >
              <option value="">ללא רכב</option>
              {customerVehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.make} {v.model} — {v.plate}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[#8892a4] mb-1.5">תוקף הצעה</label>
            <input
              name="validUntil"
              type="date"
              defaultValue={quote?.validUntil ? new Date(quote.validUntil).toISOString().split('T')[0] : ''}
              className="w-full bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2.5 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#6366f1]"
            />
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e3147]">
          <h2 className="text-sm font-semibold text-[#8892a4] uppercase tracking-wide">פריטים ועבודה</h2>
          <button
            type="button"
            onClick={addItem}
            className="flex items-center gap-1.5 text-xs text-[#6366f1] hover:text-[#4f46e5] transition-colors"
          >
            <Plus size={13} />הוסף פריט
          </button>
        </div>

        <div className="divide-y divide-[#2e3147]">
          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_80px_100px_36px] gap-3 px-5 py-3 items-center">
              <input
                type="text"
                value={item.description}
                onChange={(e) => updateItem(idx, 'description', e.target.value)}
                placeholder="תיאור פריט / עבודה"
                className="bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2 text-sm text-[#e2e8f0] placeholder-[#4a5568] focus:outline-none focus:border-[#6366f1]"
              />
              <input
                type="number"
                min={1}
                value={item.quantity}
                onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                className="bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2 text-sm text-[#e2e8f0] text-center focus:outline-none focus:border-[#6366f1]"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                value={item.unitPrice}
                onChange={(e) => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                className="bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2 text-sm text-[#e2e8f0] text-center focus:outline-none focus:border-[#6366f1]"
              />
              <button
                type="button"
                onClick={() => removeItem(idx)}
                disabled={items.length === 1}
                className="text-[#8892a4] hover:text-red-400 transition-colors disabled:opacity-30"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-[1fr_80px_100px_36px] gap-3 px-5 py-2 border-t border-[#2e3147] bg-[#252836]/40">
          <span className="text-xs text-[#8892a4]">כותרת</span>
          <span className="text-xs text-[#8892a4] text-center">כמות</span>
          <span className="text-xs text-[#8892a4] text-center">מחיר יח׳ (₪)</span>
          <span />
        </div>
      </div>

      {/* Labor */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-[#8892a4] uppercase tracking-wide">שכר עבודה</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[#8892a4] mb-1.5">שעות עבודה</label>
            <input
              type="number"
              min={0}
              step="0.5"
              value={laborHours}
              onChange={(e) => setLaborHours(parseFloat(e.target.value) || 0)}
              className="w-full bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2.5 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#6366f1]"
            />
          </div>
          <div>
            <label className="block text-xs text-[#8892a4] mb-1.5">תעריף שעה (₪)</label>
            <input
              type="number"
              min={0}
              step="10"
              value={laborRate}
              onChange={(e) => setLaborRate(parseFloat(e.target.value) || 0)}
              className="w-full bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2.5 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#6366f1]"
            />
          </div>
        </div>
      </div>

      {/* Totals */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5 space-y-2">
        <div className="flex justify-between text-sm text-[#8892a4]">
          <span>חלקים</span><span>₪{partsTotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-[#8892a4]">
          <span>עבודה ({laborHours} ש׳ × ₪{laborRate})</span>
          <span>₪{laborTotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-bold text-lg border-t border-[#2e3147] pt-2 mt-2">
          <span>סה"כ</span><span className="text-[#6366f1]">₪{total.toFixed(2)}</span>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5">
        <label className="block text-xs text-[#8892a4] mb-1.5">הערות</label>
        <textarea
          name="notes"
          defaultValue={quote?.notes ?? ''}
          rows={3}
          placeholder="הערות ותנאים לצרף להצעה..."
          className="w-full bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2.5 text-sm text-[#e2e8f0] placeholder-[#4a5568] focus:outline-none focus:border-[#6366f1] resize-none"
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-60 text-white text-sm font-medium rounded-lg px-6 py-2.5 transition-colors"
        >
          {isPending ? 'שומר...' : mode === 'create' ? 'צור הצעת מחיר' : 'שמור שינויים'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-[#8892a4] hover:text-[#e2e8f0] px-4 py-2.5 transition-colors"
        >
          ביטול
        </button>
      </div>
    </form>
  )
}
