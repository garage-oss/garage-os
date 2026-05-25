'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createPart, updatePart } from '@/app/actions/parts'

type Supplier = { id: string; name: string }

interface PartData {
  id: string
  sku: string
  name: string
  category: string | null
  manufacturer: string | null
  supplierId: string | null
  costPrice: number
  salePrice: number
  quantity: number
  minQuantity: number
  location: string | null
  notes: string | null
}

interface Props {
  suppliers: Supplier[]
  mode: 'create' | 'edit'
  part?: PartData
}

const CATEGORIES = ['פילטרים', 'בלמים', 'שמנים', 'מצתים', 'מנוע', 'חיישנים', 'מיזוג אוויר', 'גוף רכב', 'חשמל', 'אחר']

export function PartForm({ suppliers, mode, part }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = mode === 'create'
        ? await createPart(formData)
        : await updatePart(part!.id, formData)
      if ('error' in result) {
        setError(result.error)
      } else {
        router.push(`/dashboard/inventory/${result.id}`)
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-[#8892a4] uppercase tracking-wide">פרטי חלק</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[#8892a4] mb-1.5">מק"ט (SKU) *</label>
            <input
              name="sku"
              defaultValue={part?.sku}
              required
              placeholder="FLT-OIL-001"
              className="w-full bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2.5 text-sm text-[#e2e8f0] placeholder-[#4a5568] focus:outline-none focus:border-[#6366f1] font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-[#8892a4] mb-1.5">שם החלק *</label>
            <input
              name="name"
              defaultValue={part?.name}
              required
              placeholder="פילטר שמן — יוניברסל"
              className="w-full bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2.5 text-sm text-[#e2e8f0] placeholder-[#4a5568] focus:outline-none focus:border-[#6366f1]"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[#8892a4] mb-1.5">קטגוריה</label>
            <select
              name="category"
              defaultValue={part?.category ?? ''}
              className="w-full bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2.5 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#6366f1]"
            >
              <option value="">בחר קטגוריה</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#8892a4] mb-1.5">יצרן</label>
            <input
              name="manufacturer"
              defaultValue={part?.manufacturer ?? ''}
              placeholder="Bosch, NGK, Gates..."
              className="w-full bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2.5 text-sm text-[#e2e8f0] placeholder-[#4a5568] focus:outline-none focus:border-[#6366f1]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-[#8892a4] mb-1.5">ספק</label>
          <select
            name="supplierId"
            defaultValue={part?.supplierId ?? ''}
            className="w-full bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2.5 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#6366f1]"
          >
            <option value="">ללא ספק</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-[#8892a4] uppercase tracking-wide">מחיר ומלאי</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[#8892a4] mb-1.5">מחיר עלות (₪) *</label>
            <input
              name="costPrice"
              type="number"
              step="0.01"
              min="0"
              defaultValue={part?.costPrice}
              required
              placeholder="0.00"
              className="w-full bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2.5 text-sm text-[#e2e8f0] placeholder-[#4a5568] focus:outline-none focus:border-[#6366f1]"
            />
          </div>
          <div>
            <label className="block text-xs text-[#8892a4] mb-1.5">מחיר מכירה (₪) *</label>
            <input
              name="salePrice"
              type="number"
              step="0.01"
              min="0"
              defaultValue={part?.salePrice}
              required
              placeholder="0.00"
              className="w-full bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2.5 text-sm text-[#e2e8f0] placeholder-[#4a5568] focus:outline-none focus:border-[#6366f1]"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[#8892a4] mb-1.5">כמות במלאי</label>
            <input
              name="quantity"
              type="number"
              min="0"
              defaultValue={mode === 'edit' ? part?.quantity : 0}
              disabled={mode === 'edit'}
              className="w-full bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2.5 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#6366f1] disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {mode === 'edit' && <p className="text-xs text-[#8892a4] mt-1">לשינוי מלאי השתמש בכפתור "עדכון מלאי"</p>}
          </div>
          <div>
            <label className="block text-xs text-[#8892a4] mb-1.5">מלאי מינימלי</label>
            <input
              name="minQuantity"
              type="number"
              min="0"
              defaultValue={part?.minQuantity ?? 5}
              className="w-full bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2.5 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#6366f1]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-[#8892a4] mb-1.5">מיקום במחסן</label>
          <input
            name="location"
            defaultValue={part?.location ?? ''}
            placeholder="מדף A1, מחסן שמנים..."
            className="w-full bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2.5 text-sm text-[#e2e8f0] placeholder-[#4a5568] focus:outline-none focus:border-[#6366f1]"
          />
        </div>
      </div>

      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5">
        <label className="block text-xs text-[#8892a4] mb-1.5">הערות</label>
        <textarea
          name="notes"
          defaultValue={part?.notes ?? ''}
          rows={3}
          placeholder="פרטים נוספים על החלק..."
          className="w-full bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2.5 text-sm text-[#e2e8f0] placeholder-[#4a5568] focus:outline-none focus:border-[#6366f1] resize-none"
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-60 text-white text-sm font-medium rounded-lg px-6 py-2.5 transition-colors"
        >
          {isPending ? 'שומר...' : mode === 'create' ? 'הוסף חלק' : 'שמור שינויים'}
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
