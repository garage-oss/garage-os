'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Search, RefreshCw, Loader2, WifiOff, Users, Car, Wrench, ChevronLeft } from 'lucide-react'
import Link from 'next/link'

export interface NesherCustomer {
  cli_no:        number
  cli_name:      string
  cli_type:      string | null
  cli_email:     string | null
  phone:         string | null
  last_visit_dt: string | null
  order_count:   number
  vehicle_count: number
}

type State =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; rows: NesherCustomer[] }

const AVATAR = ['bg-indigo-500/20 text-indigo-400', 'bg-emerald-500/20 text-emerald-400', 'bg-amber-500/20 text-amber-400', 'bg-rose-500/20 text-rose-400', 'bg-cyan-500/20 text-cyan-400']

function initials(name: string) {
  return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function fmtDate(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function NesherCustomersTable() {
  const [state,   setState]   = useState<State>({ phase: 'loading' })
  const [search,  setSearch]  = useState('')
  const [query,   setQuery]   = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (q: string) => {
    setLoading(true)
    setState({ phase: 'loading' })
    try {
      const r    = await fetch(`/api/nesher/customers?search=${encodeURIComponent(q)}&limit=100`)
      const body = await r.json()
      if (!r.ok) setState({ phase: 'error', message: body.error ?? `שגיאה ${r.status}` })
      else        setState({ phase: 'ready', rows: body.rows ?? body.data ?? [] })
    } catch {
      setState({ phase: 'error', message: 'לא ניתן להגיע לקונקטור' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load('') }, [load])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { if (query !== search) { setSearch(query); load(query) } }, 400)
    return () => clearTimeout(t)
  }, [query, search, load])

  const rows = state.phase === 'ready' ? state.rows : []

  return (
    <div dir="rtl" className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5a6279]" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="שם לקוח, מספר לקוח, לוחית רישוי, טלפון…"
            className="w-full bg-[#252836] border border-[#2e3147] rounded-lg pr-9 pl-3 py-2 text-sm placeholder:text-[#5a6279] text-[#e2e8f0] focus:outline-none focus:border-[#6366f1]/60 transition-colors"
          />
        </div>
        <button
          onClick={() => load(query)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#252836] border border-[#2e3147] text-[#8892a4] hover:text-[#e2e8f0] text-sm disabled:opacity-50 transition-all"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> רענן
        </button>
        {state.phase === 'ready' && (
          <span className="text-xs text-[#5a6279]">{rows.length.toLocaleString()} לקוחות</span>
        )}
      </div>

      {/* Loading */}
      {state.phase === 'loading' && (
        <div className="flex flex-col items-center justify-center py-20 text-[#5a6279] gap-3">
          <Loader2 size={28} className="animate-spin" />
          <span className="text-sm">טוען לקוחות מ-NESHER…</span>
        </div>
      )}

      {/* Error */}
      {state.phase === 'error' && (
        <div className="flex flex-col items-center gap-3 py-16">
          <WifiOff size={32} className="text-red-400" />
          <p className="text-sm text-red-300">{state.message}</p>
          <button onClick={() => load(query)} className="text-xs text-[#6366f1] hover:underline">נסה שוב</button>
        </div>
      )}

      {/* Table */}
      {state.phase === 'ready' && rows.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-[#5a6279]">
          <Users size={28} />
          <p className="text-sm">לא נמצאו לקוחות</p>
        </div>
      )}

      {state.phase === 'ready' && rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-[#2e3147]">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="bg-[#252836] border-b border-[#2e3147]">
                {['לקוח', 'מספר', 'סוג', 'טלפון', 'רכבים', 'הזמנות', 'ביקור אחרון', ''].map(h => (
                  <th key={h} className="px-3 py-2.5 text-right text-xs font-semibold text-[#8892a4] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((c, i) => (
                <tr key={c.cli_no} className="border-b border-[#2e3147] last:border-0 hover:bg-[#252836]/60 transition-colors">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${AVATAR[i % AVATAR.length]}`}>
                        {initials(c.cli_name)}
                      </div>
                      <Link href={`/dashboard/nesher/customers/${c.cli_no}`} className="font-medium hover:text-[#6366f1] transition-colors">
                        {c.cli_name}
                      </Link>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-[#6366f1]">{c.cli_no}</td>
                  <td className="px-3 py-2.5 text-xs text-[#8892a4]">{c.cli_type ?? '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-[#8892a4] dir-ltr">{c.phone ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-1 text-xs text-[#8892a4]"><Car size={11} />{c.vehicle_count}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-1 text-xs text-[#8892a4]"><Wrench size={11} />{c.order_count}</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-[#8892a4] whitespace-nowrap">{fmtDate(c.last_visit_dt)}</td>
                  <td className="px-3 py-2.5">
                    <Link href={`/dashboard/nesher/customers/${c.cli_no}`} className="flex items-center gap-1 text-xs text-[#6366f1] hover:underline whitespace-nowrap">
                      פרטים <ChevronLeft size={11} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
