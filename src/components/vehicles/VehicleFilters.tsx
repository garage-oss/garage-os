'use client'

import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { useRef } from 'react'
import { FuelType } from '@prisma/client'
import { FUEL_LABELS } from '@/lib/vehicles'

interface Props {
  currentSearch?: string
  currentFuel?: string
  currentInService?: boolean
}

export function VehicleFilters({ currentSearch = '', currentFuel = '', currentInService = false }: Props) {
  const router = useRouter()
  const ref = useRef<HTMLInputElement>(null)

  function buildUrl(overrides: Record<string, string | boolean | undefined>) {
    const base = { q: currentSearch, fuel: currentFuel, inService: currentInService ? 'true' : '' }
    const merged = { ...base, ...overrides }
    const p = new URLSearchParams()
    if (merged.q) p.set('q', merged.q as string)
    if (merged.fuel) p.set('fuel', merged.fuel as string)
    if (merged.inService === 'true') p.set('inService', 'true')
    return `/dashboard/vehicles${p.toString() ? `?${p}` : ''}`
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    router.push(buildUrl({ q: ref.current?.value.trim() || '' }))
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-5">
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative">
          <Search size={14} className="absolute top-1/2 -translate-y-1/2 start-3 text-[#8892a4] pointer-events-none" />
          <input
            ref={ref}
            defaultValue={currentSearch}
            placeholder="חיפוש רכב, לוחית, לקוח..."
            className="bg-[#1a1d27] border border-[#2e3147] text-[#e2e8f0] rounded-lg ps-8 pe-3 py-2 text-sm outline-none focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/20 transition-all placeholder:text-[#8892a4]/60 w-56"
          />
        </div>
        <button type="submit" className="px-3 py-2 bg-[#252836] border border-[#2e3147] rounded-lg text-xs text-[#8892a4] hover:text-[#e2e8f0] transition-all">
          חפש
        </button>
      </form>

      {/* Fuel filter */}
      <div className="flex gap-1 bg-[#1a1d27] border border-[#2e3147] rounded-lg p-1 flex-wrap">
        <button
          onClick={() => router.push(buildUrl({ fuel: '' }))}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${!currentFuel ? 'bg-[#6366f1] text-white' : 'text-[#8892a4] hover:text-[#e2e8f0]'}`}
        >
          כל הדלקים
        </button>
        {(Object.keys(FUEL_LABELS) as FuelType[]).map((k) => (
          <button
            key={k}
            onClick={() => router.push(buildUrl({ fuel: k }))}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${currentFuel === k ? 'bg-[#6366f1] text-white' : 'text-[#8892a4] hover:text-[#e2e8f0]'}`}
          >
            {FUEL_LABELS[k]}
          </button>
        ))}
      </div>

      <button
        onClick={() => router.push(buildUrl({ inService: currentInService ? '' : 'true' }))}
        className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${currentInService ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'border-[#2e3147] text-[#8892a4] hover:text-[#e2e8f0]'}`}
      >
        {currentInService ? '✓ ' : ''}בשירות
      </button>
    </div>
  )
}
