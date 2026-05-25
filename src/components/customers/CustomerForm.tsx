'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createCustomer, updateCustomer } from '@/app/actions/customers'

interface CustomerData {
  id: string
  name: string
  phone: string
  email: string | null
  address: string | null
  notes: string | null
}

interface Props {
  mode?: 'create' | 'edit'
  customer?: CustomerData
}

const INPUT =
  'w-full bg-[#252836] border border-[#2e3147] text-[#e2e8f0] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/20 transition-all placeholder:text-[#8892a4]/60'
const LABEL = 'block text-xs font-medium text-[#8892a4] mb-1.5 uppercase tracking-wide'
const SECTION = 'bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5'

export function CustomerForm({ mode = 'create', customer }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result =
        mode === 'edit' && customer
          ? await updateCustomer(customer.id, fd)
          : await createCustomer(fd)
      if ('error' in result) {
        setError(result.error)
      } else {
        router.push(`/dashboard/customers/${result.id}`)
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      {/* Contact */}
      <div className={SECTION}>
        <h3 className="text-xs font-semibold text-[#8892a4] uppercase tracking-wider mb-4">פרטי קשר</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>שם מלא *</label>
            <input name="name" required defaultValue={customer?.name} placeholder="ישראל ישראלי" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>טלפון *</label>
            <input name="phone" required defaultValue={customer?.phone} placeholder="050-0000000" className={INPUT} />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL}>אימייל</label>
            <input name="email" type="email" defaultValue={customer?.email ?? ''} placeholder="example@gmail.com" className={INPUT} />
          </div>
        </div>
      </div>

      {/* Address */}
      <div className={SECTION}>
        <h3 className="text-xs font-semibold text-[#8892a4] uppercase tracking-wider mb-4">כתובת</h3>
        <div>
          <label className={LABEL}>כתובת מגורים</label>
          <input name="address" defaultValue={customer?.address ?? ''} placeholder="רחוב הרצל 1, תל אביב" className={INPUT} />
        </div>
      </div>

      {/* Notes */}
      <div className={SECTION}>
        <h3 className="text-xs font-semibold text-[#8892a4] uppercase tracking-wider mb-4">הערות</h3>
        <div>
          <label className={LABEL}>הערות פנימיות</label>
          <textarea name="notes" rows={3} defaultValue={customer?.notes ?? ''} placeholder="הערות על הלקוח..." className={`${INPUT} resize-y`} />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5">{error}</p>
      )}

      <div className="flex items-center justify-between pt-1">
        <button type="button" onClick={() => router.back()} className="px-4 py-2.5 rounded-lg text-sm text-[#8892a4] border border-[#2e3147] hover:bg-[#252836] hover:text-[#e2e8f0] transition-all">
          ביטול
        </button>
        <button type="submit" disabled={isPending} className="flex items-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-50 text-white font-medium rounded-lg px-6 py-2.5 text-sm transition-colors">
          {isPending ? <><Loader2 size={15} className="animate-spin" />{mode === 'edit' ? 'שומר...' : 'יוצר...'}</> : mode === 'edit' ? 'שמור שינויים' : 'הוסף לקוח'}
        </button>
      </div>
    </form>
  )
}
