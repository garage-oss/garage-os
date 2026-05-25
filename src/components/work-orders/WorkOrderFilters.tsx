'use client'

import { useRouter } from 'next/navigation'
import { WorkOrderStatus } from '@prisma/client'
import { Search } from 'lucide-react'
import { useRef } from 'react'

const STATUS_TABS: { value: string; label: string }[] = [
  { value: '', label: 'הכל' },
  { value: 'PENDING', label: 'ממתינות' },
  { value: 'IN_PROGRESS', label: 'בטיפול' },
  { value: 'WAITING_PARTS', label: 'ממתין לחלקים' },
  { value: 'COMPLETED', label: 'הושלמו' },
  { value: 'CANCELLED', label: 'בוטלו' },
]

interface Props {
  currentStatus?: string
  currentSearch?: string
}

export function WorkOrderFilters({ currentStatus = '', currentSearch = '' }: Props) {
  const router = useRouter()
  const searchRef = useRef<HTMLInputElement>(null)

  function buildUrl(status: string, search: string) {
    const p = new URLSearchParams()
    if (status) p.set('status', status)
    if (search) p.set('q', search)
    return `/dashboard/work-orders${p.toString() ? `?${p}` : ''}`
  }

  function handleStatus(status: string) {
    router.push(buildUrl(status, currentSearch))
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = searchRef.current?.value.trim() || ''
    router.push(buildUrl(currentStatus, q))
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-4">
      {/* Status tabs */}
      <div className="flex gap-1 bg-surface border border-[#2e3147] rounded-lg p-1 flex-wrap">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleStatus(tab.value)}
            className={[
              'px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap',
              currentStatus === tab.value
                ? 'bg-primary text-white'
                : 'text-muted hover:text-text-base hover:bg-[#252836]',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 flex-1 sm:max-w-xs">
        <div className="relative flex-1">
          <Search size={14} className="absolute top-1/2 -translate-y-1/2 start-3 text-muted pointer-events-none" />
          <input
            ref={searchRef}
            type="text"
            defaultValue={currentSearch}
            placeholder="חיפוש לפי לקוח, רכב, מס' פקודה..."
            className="w-full bg-surface border border-[#2e3147] text-text-base rounded-lg ps-8 pe-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted/60"
          />
        </div>
        <button
          type="submit"
          className="px-3 py-2 bg-[#252836] border border-[#2e3147] rounded-lg text-xs text-muted hover:text-text-base transition-all"
        >
          חפש
        </button>
      </form>
    </div>
  )
}
