'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Loader2, WifiOff, SearchX, Search, RefreshCw, FileText,
} from 'lucide-react'
import type { NesherWorkOrder } from '@/app/api/nesher/workorders/route'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(raw: string | null | undefined): string {
  if (!raw) return '—'
  const d = new Date(raw)
  if (isNaN(d.getTime())) return raw
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtNum(raw: number | null | undefined): string {
  if (raw == null) return '—'
  return Number(raw).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function calcTotal(row: NesherWorkOrder): number {
  if (row.total != null) return Number(row.total)
  return (Number(row.part_tot ?? 0) + Number(row.work_tot ?? 0))
}

// ─── Types ────────────────────────────────────────────────────────────────────

type LoadState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; rows: NesherWorkOrder[] }

// ─── Component ───────────────────────────────────────────────────────────────

export function WorkOrdersTable() {
  const [state,   setState]   = useState<LoadState>({ phase: 'loading' })
  const [search,  setSearch]  = useState('')
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    setState({ phase: 'loading' })
    try {
      const r = await fetch('/api/nesher/workorders?limit=100')
      const body = await r.json()
      if (!r.ok) {
        setState({ phase: 'error', message: body.error ?? `שגיאה ${r.status}` })
      } else {
        // Connector may return { rows } or { data } depending on version
        const rows = body.rows ?? body.data ?? []
        setState({ phase: 'ready', rows })
      }
    } catch {
      setState({ phase: 'error', message: 'לא ניתן להגיע לשרת. נסה שוב.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    if (state.phase !== 'ready') return []
    if (!search.trim()) return state.rows
    const q = search.trim().toLowerCase()
    return state.rows.filter(r =>
      (r.card_no  ?? '').toLowerCase().includes(q) ||
      (r.car_no   ?? '').toLowerCase().includes(q) ||
      (r.cli_name ?? '').toLowerCase().includes(q),
    )
  }, [state, search])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div dir="rtl" className="space-y-4">

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5a6279]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="חיפוש לפי מ׳ כרטיס, רכב או לקוח…"
            className="w-full bg-[#252836] border border-[#2e3147] rounded-lg pr-9 pl-3 py-2 text-sm placeholder:text-[#5a6279] text-[#e2e8f0] focus:outline-none focus:border-[#6366f1]/60 transition-colors"
          />
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#252836] border border-[#2e3147] text-[#8892a4] hover:text-[#e2e8f0] hover:border-[#6366f1]/40 text-sm transition-all disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          רענן
        </button>
        {state.phase === 'ready' && (
          <span className="text-xs text-[#5a6279]">
            {filtered.length.toLocaleString()}
            {search ? ` מתוך ${state.rows.length.toLocaleString()}` : ''} כרטיסיות
          </span>
        )}
      </div>

      {/* States */}
      {state.phase === 'loading' && (
        <div className="flex flex-col items-center justify-center py-20 text-[#5a6279] gap-3">
          <Loader2 size={28} className="animate-spin" />
          <span className="text-sm">טוען כרטיסיות מה-Connector…</span>
        </div>
      )}

      {state.phase === 'error' && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <WifiOff size={32} className="text-red-400" />
          <p className="text-sm font-medium text-red-300">שגיאת התחברות</p>
          <p className="text-xs text-[#8892a4] max-w-md text-center">{state.message}</p>
          <button
            onClick={load}
            className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs hover:bg-red-500/20 transition-all"
          >
            <RefreshCw size={12} /> נסה שוב
          </button>
        </div>
      )}

      {state.phase === 'ready' && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-[#5a6279]">
          <SearchX size={28} />
          <p className="text-sm">
            {search ? 'לא נמצאו תוצאות לחיפוש' : 'אין כרטיסיות להצגה'}
          </p>
          {search && (
            <button onClick={() => setSearch('')} className="text-xs text-[#6366f1] hover:underline">
              נקה חיפוש
            </button>
          )}
        </div>
      )}

      {/* Table */}
      {state.phase === 'ready' && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-[#2e3147]">
          <table className="w-full text-sm min-w-[960px]">
            <thead>
              <tr className="bg-[#252836] border-b border-[#2e3147]">
                {[
                  'מספר כרטיס',
                  'תאריך פתיחה',
                  'מספר רכב',
                  'שם לקוח',
                  'תיאור רכב',
                  'תלונת לקוח',
                  'מחיר שעה',
                  'סך חלקים',
                  'סך עבודה',
                  'סך כולל',
                ].map(col => (
                  <th
                    key={col}
                    className="px-3 py-2.5 text-right text-xs font-semibold text-[#8892a4] whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const total = calcTotal(row)
                return (
                  <tr
                    key={row.card_id ?? `row-${i}`}
                    className="border-b border-[#2e3147] last:border-0 hover:bg-[#252836]/60 transition-colors"
                  >
                    <td className="px-3 py-2.5 font-mono text-[#6366f1] whitespace-nowrap font-medium">
                      {row.card_no ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-[#8892a4] whitespace-nowrap text-xs">
                      {fmtDate(row.open_dt)}
                    </td>
                    <td className="px-3 py-2.5 font-mono whitespace-nowrap text-[#c8d0e0]">
                      {row.car_no ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-[#e2e8f0] max-w-[160px] truncate">
                      {row.cli_name ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-[#8892a4] max-w-[140px] truncate text-xs">
                      {row.car_desc ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-[#c8d0e0] max-w-[180px] truncate text-xs">
                      {row.cli_comp1 ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-left font-mono text-[#8892a4] text-xs whitespace-nowrap">
                      {fmtNum(row.tarif)}
                    </td>
                    <td className="px-3 py-2.5 text-left font-mono text-[#c8d0e0] text-xs whitespace-nowrap">
                      {fmtNum(row.part_tot)}
                    </td>
                    <td className="px-3 py-2.5 text-left font-mono text-[#c8d0e0] text-xs whitespace-nowrap">
                      {fmtNum(row.work_tot)}
                    </td>
                    <td className="px-3 py-2.5 text-left font-mono font-semibold whitespace-nowrap text-xs"
                      style={{ color: total > 0 ? '#34d399' : '#5a6279' }}
                    >
                      {fmtNum(total)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
