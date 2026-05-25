'use client'

import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { useRef } from 'react'

interface Props { currentSearch?: string }

export function CustomerFilters({ currentSearch = '' }: Props) {
  const router = useRouter()
  const ref = useRef<HTMLInputElement>(null)

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = ref.current?.value.trim() || ''
    router.push(q ? `/dashboard/customers?q=${encodeURIComponent(q)}` : '/dashboard/customers')
  }

  return (
    <form onSubmit={handleSearch} className="flex gap-2 mb-4 max-w-sm">
      <div className="relative flex-1">
        <Search size={14} className="absolute top-1/2 -translate-y-1/2 start-3 text-[#8892a4] pointer-events-none" />
        <input
          ref={ref}
          type="text"
          defaultValue={currentSearch}
          placeholder="חיפוש לפי שם, טלפון, אימייל..."
          className="w-full bg-[#1a1d27] border border-[#2e3147] text-[#e2e8f0] rounded-lg ps-8 pe-3 py-2 text-sm outline-none focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/20 transition-all placeholder:text-[#8892a4]/60"
        />
      </div>
      <button type="submit" className="px-3 py-2 bg-[#252836] border border-[#2e3147] rounded-lg text-xs text-[#8892a4] hover:text-[#e2e8f0] transition-all">
        חפש
      </button>
      {currentSearch && (
        <button type="button" onClick={() => router.push('/dashboard/customers')} className="px-3 py-2 bg-[#252836] border border-[#2e3147] rounded-lg text-xs text-[#8892a4] hover:text-[#e2e8f0] transition-all">
          נקה
        </button>
      )}
    </form>
  )
}
