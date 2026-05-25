'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

interface Props {
  categories: string[]
  currentSearch?: string
  currentCategory?: string
  currentLowStock?: boolean
}

export function InventoryFilters({ categories, currentSearch, currentCategory, currentLowStock }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  function push(params: Record<string, string | boolean | undefined>) {
    const sp = new URLSearchParams()
    if (params.q) sp.set('q', params.q as string)
    if (params.category) sp.set('category', params.category as string)
    if (params.lowStock) sp.set('lowStock', 'true')
    startTransition(() => router.push(`/dashboard/inventory?${sp.toString()}`))
  }

  return (
    <div className="flex flex-wrap gap-3 mb-5">
      <input
        type="text"
        placeholder="חיפוש לפי שם, מק״ט, יצרן..."
        defaultValue={currentSearch}
        onChange={(e) => push({ q: e.target.value || undefined, category: currentCategory, lowStock: currentLowStock })}
        className="bg-[#1a1d27] border border-[#2e3147] rounded-lg px-3 py-2 text-sm text-[#e2e8f0] placeholder-[#4a5568] focus:outline-none focus:border-[#6366f1] min-w-[220px]"
      />
      <select
        defaultValue={currentCategory ?? ''}
        onChange={(e) => push({ q: currentSearch, category: e.target.value || undefined, lowStock: currentLowStock })}
        className="bg-[#1a1d27] border border-[#2e3147] rounded-lg px-3 py-2 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#6366f1]"
      >
        <option value="">כל הקטגוריות</option>
        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <button
        onClick={() => push({ q: currentSearch, category: currentCategory, lowStock: !currentLowStock || undefined })}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all ${
          currentLowStock
            ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
            : 'bg-[#1a1d27] border-[#2e3147] text-[#8892a4] hover:border-[#6366f1] hover:text-[#e2e8f0]'
        }`}
      >
        מלאי נמוך בלבד
      </button>
    </div>
  )
}
