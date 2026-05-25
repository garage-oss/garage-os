'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createSupplier, updateSupplier } from '@/app/actions/suppliers'

interface SupplierData {
  id: string
  name: string
  contactName: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
}

interface Props {
  mode: 'create' | 'edit'
  supplier?: SupplierData
}

export function SupplierForm({ mode, supplier }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = mode === 'create'
        ? await createSupplier(formData)
        : await updateSupplier(supplier!.id, formData)
      if ('error' in result) {
        setError(result.error)
      } else {
        router.push(`/dashboard/suppliers/${result.id}`)
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
        <h2 className="text-sm font-semibold text-[#8892a4] uppercase tracking-wide">פרטי ספק</h2>
        <div>
          <label className="block text-xs text-[#8892a4] mb-1.5">שם הספק *</label>
          <input
            name="name"
            defaultValue={supplier?.name}
            required
            placeholder="טכנו-חלקים בע&quot;מ"
            className="w-full bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2.5 text-sm text-[#e2e8f0] placeholder-[#4a5568] focus:outline-none focus:border-[#6366f1]"
          />
        </div>
        <div>
          <label className="block text-xs text-[#8892a4] mb-1.5">איש קשר</label>
          <input
            name="contactName"
            defaultValue={supplier?.contactName ?? ''}
            placeholder="שם מלא"
            className="w-full bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2.5 text-sm text-[#e2e8f0] placeholder-[#4a5568] focus:outline-none focus:border-[#6366f1]"
          />
        </div>
      </div>

      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-[#8892a4] uppercase tracking-wide">פרטי התקשרות</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[#8892a4] mb-1.5">טלפון</label>
            <input
              name="phone"
              defaultValue={supplier?.phone ?? ''}
              placeholder="03-5551234"
              className="w-full bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2.5 text-sm text-[#e2e8f0] placeholder-[#4a5568] focus:outline-none focus:border-[#6366f1]"
            />
          </div>
          <div>
            <label className="block text-xs text-[#8892a4] mb-1.5">אימייל</label>
            <input
              name="email"
              type="email"
              defaultValue={supplier?.email ?? ''}
              placeholder="orders@supplier.co.il"
              className="w-full bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2.5 text-sm text-[#e2e8f0] placeholder-[#4a5568] focus:outline-none focus:border-[#6366f1]"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-[#8892a4] mb-1.5">כתובת</label>
          <input
            name="address"
            defaultValue={supplier?.address ?? ''}
            placeholder="רחוב המסחר 7, אשדוד"
            className="w-full bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2.5 text-sm text-[#e2e8f0] placeholder-[#4a5568] focus:outline-none focus:border-[#6366f1]"
          />
        </div>
      </div>

      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5">
        <label className="block text-xs text-[#8892a4] mb-1.5">הערות</label>
        <textarea
          name="notes"
          defaultValue={supplier?.notes ?? ''}
          rows={3}
          placeholder="תנאי אשראי, זמני אספקה, הערות מיוחדות..."
          className="w-full bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2.5 text-sm text-[#e2e8f0] placeholder-[#4a5568] focus:outline-none focus:border-[#6366f1] resize-none"
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-60 text-white text-sm font-medium rounded-lg px-6 py-2.5 transition-colors"
        >
          {isPending ? 'שומר...' : mode === 'create' ? 'הוסף ספק' : 'שמור שינויים'}
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
