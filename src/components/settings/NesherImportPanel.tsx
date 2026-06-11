'use client'

import { useState, useCallback } from 'react'
import {
  Wifi, WifiOff, RefreshCw, Database, Users, Car, FileText,
  ChevronDown, ChevronUp, PlayCircle, CheckCircle2, XCircle,
  Loader2, AlertTriangle, Eye, BarChart2,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatusData {
  configured: boolean
  connected:  boolean
  error?:     string
  counts?: {
    ca_clients: number
    ca_cars:    number
    ca_cards:   number
  }
  imported?: {
    customers:  number
    vehicles:   number
    workOrders: number
  }
}

interface PreviewData {
  table:   string
  columns: string[]
  rows:    Record<string, unknown>[]
}

interface EntityStats {
  would_create: number
  would_update: number
  would_skip:   number
  errors:       number
}

interface DryRunResult {
  dryRun:     true
  durationMs: number
  stats: {
    customers:  EntityStats
    vehicles:   EntityStats
    workOrders: EntityStats
  }
  samples: {
    customers:  Record<string, unknown>[]
    vehicles:   Record<string, unknown>[]
    workOrders: Record<string, unknown>[]
  }
  errors: string[]
}

type PreviewTable = 'ca_clients' | 'ca_cars' | 'ca_cards'

type RunState =
  | { phase: 'idle' }
  | { phase: 'running' }
  | { phase: 'done'; result: DryRunResult }
  | { phase: 'error'; error: string }

// ─── Component ────────────────────────────────────────────────────────────────

export function NesherImportPanel() {
  // Connection state
  const [status,        setStatus]        = useState<StatusData | null>(null)
  const [statusLoading, setStatusLoading] = useState(false)

  // Preview state
  const [activeTab,     setActiveTab]     = useState<PreviewTable>('ca_clients')
  const [preview,       setPreview]       = useState<Record<PreviewTable, PreviewData | null>>({
    ca_clients: null,
    ca_cars:    null,
    ca_cards:   null,
  })
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewOpen,    setPreviewOpen]    = useState(false)

  // Dry-run state
  const [runState,   setRunState]   = useState<RunState>({ phase: 'idle' })
  const [dryRunOpen, setDryRunOpen] = useState(false)

  // ── Actions ──────────────────────────────────────────────────────────────────

  const testConnection = useCallback(async () => {
    setStatusLoading(true)
    try {
      const r = await fetch('/api/nesher/status')
      setStatus(await r.json())
    } catch {
      setStatus({ configured: false, connected: false, error: 'שגיאת רשת' })
    } finally {
      setStatusLoading(false)
    }
  }, [])

  const loadPreview = useCallback(async (table: PreviewTable) => {
    if (preview[table]) return   // already loaded
    setPreviewLoading(true)
    try {
      const r = await fetch(`/api/nesher/preview?table=${table}`)
      const data = await r.json()
      setPreview(prev => ({ ...prev, [table]: data }))
    } catch {
      setPreview(prev => ({ ...prev, [table]: { table, columns: [], rows: [] } }))
    } finally {
      setPreviewLoading(false)
    }
  }, [preview])

  const handleTabChange = (tab: PreviewTable) => {
    setActiveTab(tab)
    loadPreview(tab)
  }

  const openPreview = () => {
    setPreviewOpen(true)
    loadPreview(activeTab)
  }

  const runDryRun = async () => {
    setRunState({ phase: 'running' })
    try {
      const r = await fetch('/api/nesher/import', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ dryRun: true }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error ?? 'שגיאה לא ידועה')
      setRunState({ phase: 'done', result: data })
      setDryRunOpen(true)
    } catch (e) {
      setRunState({ phase: 'error', error: e instanceof Error ? e.message : String(e) })
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── 1. Connection card ─────────────────────────────────────────────── */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Database size={16} className="text-[#6366f1]" />
            <span className="font-semibold text-sm">חיבור ל-NESHER SQL Server</span>
          </div>
          <button
            onClick={testConnection}
            disabled={statusLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#6366f1]/10 border border-[#6366f1]/30 text-[#6366f1] text-xs font-medium hover:bg-[#6366f1]/20 transition-all disabled:opacity-50"
          >
            {statusLoading
              ? <Loader2 size={13} className="animate-spin" />
              : <RefreshCw size={13} />}
            בדוק חיבור
          </button>
        </div>

        {/* Status badge */}
        {status ? (
          <ConnectionStatus status={status} />
        ) : (
          <p className="text-xs text-[#8892a4]">לחץ "בדוק חיבור" כדי לאמת את פרטי ה-SQL Server.</p>
        )}

        {/* Counts grid */}
        {status?.connected && status.counts && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            <CountCard icon={<Users size={14} />}    label="לקוחות (ca_clients)"  source={status.counts.ca_clients} imported={status.imported?.customers ?? 0} />
            <CountCard icon={<Car size={14} />}      label="רכבים (ca_cars)"      source={status.counts.ca_cars}    imported={status.imported?.vehicles ?? 0}  />
            <CountCard icon={<FileText size={14} />} label="כרטיסיות (ca_cards)"  source={status.counts.ca_cards}   imported={status.imported?.workOrders ?? 0} />
          </div>
        )}
      </div>

      {/* ── 2. Preview section ─────────────────────────────────────────────── */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
        <button
          onClick={() => previewOpen ? setPreviewOpen(false) : openPreview()}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#252836] transition-all"
        >
          <div className="flex items-center gap-2">
            <Eye size={15} className="text-[#6366f1]" />
            <span className="font-semibold text-sm">תצוגה מקדימה — 20 שורות ראשונות</span>
          </div>
          {previewOpen ? <ChevronUp size={15} className="text-[#8892a4]" /> : <ChevronDown size={15} className="text-[#8892a4]" />}
        </button>

        {previewOpen && (
          <div className="border-t border-[#2e3147]">
            {/* Tab bar */}
            <div className="flex gap-1 px-4 pt-3 pb-0">
              {([
                { key: 'ca_clients' as PreviewTable, label: 'לקוחות', icon: <Users size={12} /> },
                { key: 'ca_cars'    as PreviewTable, label: 'רכבים',  icon: <Car size={12} /> },
                { key: 'ca_cards'   as PreviewTable, label: 'כרטיסיות', icon: <FileText size={12} /> },
              ]).map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => handleTabChange(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-xs font-medium border-b-2 transition-all ${
                    activeTab === key
                      ? 'text-[#6366f1] border-[#6366f1]'
                      : 'text-[#8892a4] border-transparent hover:text-[#e2e8f0]'
                  }`}
                >
                  {icon}{label}
                </button>
              ))}
            </div>

            {/* Table */}
            <div className="p-4 pt-2">
              {previewLoading && !preview[activeTab] ? (
                <div className="flex items-center gap-2 text-[#8892a4] text-xs py-6 justify-center">
                  <Loader2 size={14} className="animate-spin" /> טוען...
                </div>
              ) : preview[activeTab]?.rows.length === 0 ? (
                <p className="text-xs text-[#8892a4] py-4 text-center">אין נתונים</p>
              ) : preview[activeTab] ? (
                <PreviewTable data={preview[activeTab]!} />
              ) : (
                <p className="text-xs text-[#8892a4] py-4 text-center">לחץ על הטאב כדי לטעון</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── 3. Dry-run section ─────────────────────────────────────────────── */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <BarChart2 size={15} className="text-[#6366f1]" />
            <span className="font-semibold text-sm">בדיקת ייבוא (Dry Run)</span>
            <span className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
              ללא כתיבה לבסיס הנתונים
            </span>
          </div>
          <button
            onClick={runDryRun}
            disabled={runState.phase === 'running'}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#6366f1] text-white text-xs font-medium hover:bg-[#5558e0] transition-all disabled:opacity-50"
          >
            {runState.phase === 'running'
              ? <><Loader2 size={13} className="animate-spin" /> מריץ...</>
              : <><PlayCircle size={13} /> הרץ Dry Run</>}
          </button>
        </div>

        {/* Results */}
        {runState.phase === 'error' && (
          <div className="border-t border-[#2e3147] px-5 py-4">
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <XCircle size={14} /> {runState.error}
            </div>
          </div>
        )}

        {runState.phase === 'done' && (
          <div className="border-t border-[#2e3147]">
            <button
              onClick={() => setDryRunOpen(o => !o)}
              className="w-full flex items-center justify-between px-5 py-3 hover:bg-[#252836] transition-all"
            >
              <div className="flex items-center gap-2 text-xs text-[#8892a4]">
                <CheckCircle2 size={13} className="text-emerald-400" />
                הושלם ב-{(runState.result.durationMs / 1000).toFixed(1)}שנ׳
              </div>
              {dryRunOpen ? <ChevronUp size={13} className="text-[#8892a4]" /> : <ChevronDown size={13} className="text-[#8892a4]" />}
            </button>

            {dryRunOpen && <DryRunResults result={runState.result} />}
          </div>
        )}
      </div>

    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ConnectionStatus({ status }: { status: StatusData }) {
  if (!status.configured) {
    return (
      <div className="flex items-center gap-2 text-amber-400 text-xs">
        <AlertTriangle size={13} />
        <span>לא מוגדר — הגדר HANESHER_DB_* ב-.env ובהגדרות Vercel</span>
      </div>
    )
  }
  if (!status.connected) {
    return (
      <div className="flex items-start gap-2 text-red-400 text-xs">
        <WifiOff size={13} className="mt-0.5 shrink-0" />
        <span>חיבור נכשל: {status.error}</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 text-emerald-400 text-xs">
      <Wifi size={13} />
      <span>מחובר בהצלחה</span>
    </div>
  )
}

function CountCard({
  icon, label, source, imported,
}: {
  icon: React.ReactNode
  label: string
  source: number
  imported: number
}) {
  const pct = source > 0 ? Math.round((imported / source) * 100) : 0
  return (
    <div className="bg-[#252836] rounded-xl p-3 space-y-1.5">
      <div className="flex items-center gap-1.5 text-[#8892a4] text-xs">{icon}{label}</div>
      <div className="text-lg font-bold">{source.toLocaleString()}</div>
      <div className="text-xs text-[#8892a4]">
        יובאו: <span className="text-emerald-400 font-medium">{imported.toLocaleString()}</span>
        {source > 0 && <span className="text-[#5a6279] ml-1">({pct}%)</span>}
      </div>
      {source > 0 && (
        <div className="h-1 bg-[#1a1d27] rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}

function PreviewTable({ data }: { data: PreviewData }) {
  const { columns, rows } = data
  if (!columns.length) return <p className="text-xs text-[#8892a4] py-4 text-center">אין נתונים</p>

  return (
    <div className="overflow-x-auto rounded-lg border border-[#2e3147]">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[#252836] border-b border-[#2e3147]">
            {columns.map(col => (
              <th key={col} className="px-3 py-2 text-left font-medium text-[#8892a4] whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[#2e3147] hover:bg-[#252836]/50">
              {columns.map(col => (
                <td key={col} className="px-3 py-2 text-[#c8d0e0] whitespace-nowrap max-w-[200px] truncate">
                  {row[col] == null ? (
                    <span className="text-[#5a6279]">NULL</span>
                  ) : row[col] instanceof Date ? (
                    (row[col] as Date).toLocaleDateString('he-IL')
                  ) : (
                    String(row[col])
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DryRunResults({ result }: { result: DryRunResult }) {
  const entityRows = [
    { label: 'לקוחות',    stats: result.stats.customers,  samples: result.samples.customers },
    { label: 'רכבים',     stats: result.stats.vehicles,   samples: result.samples.vehicles },
    { label: 'כרטיסיות', stats: result.stats.workOrders, samples: result.samples.workOrders },
  ]

  return (
    <div className="px-5 pb-5 space-y-4">

      {/* Stats table */}
      <div className="overflow-x-auto rounded-lg border border-[#2e3147]">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#252836] border-b border-[#2e3147]">
              <th className="px-4 py-2 text-right font-medium text-[#8892a4]">ישות</th>
              <th className="px-4 py-2 text-center font-medium text-emerald-400">ייצירה</th>
              <th className="px-4 py-2 text-center font-medium text-blue-400">עדכון</th>
              <th className="px-4 py-2 text-center font-medium text-[#8892a4]">דילוג</th>
              <th className="px-4 py-2 text-center font-medium text-red-400">שגיאות</th>
            </tr>
          </thead>
          <tbody>
            {entityRows.map(({ label, stats }) => (
              <tr key={label} className="border-b border-[#2e3147] last:border-0">
                <td className="px-4 py-2.5 font-medium">{label}</td>
                <td className="px-4 py-2.5 text-center text-emerald-400 font-mono">{stats.would_create.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-center text-blue-400 font-mono">{stats.would_update.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-center text-[#8892a4] font-mono">{stats.would_skip.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-center text-red-400 font-mono">{stats.errors.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sample records */}
      {entityRows.map(({ label, samples }) =>
        samples.length > 0 ? (
          <div key={label}>
            <p className="text-xs font-medium text-[#8892a4] mb-2">דוגמאות — {label} שיוצרו</p>
            <div className="space-y-1.5">
              {samples.map((s, i) => (
                <SampleRow key={i} data={s as Record<string, unknown>} />
              ))}
            </div>
          </div>
        ) : null
      )}

      {/* Errors */}
      {result.errors.length > 0 && (
        <div>
          <p className="text-xs font-medium text-red-400 mb-2">שגיאות ({result.errors.length})</p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {result.errors.map((e, i) => (
              <p key={i} className="text-xs text-red-300 bg-red-500/5 border border-red-500/10 rounded px-3 py-1.5">{e}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SampleRow({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, v]) => v != null && v !== '')
  return (
    <div className="bg-[#252836] rounded-lg px-3 py-2 flex flex-wrap gap-x-4 gap-y-1">
      {entries.slice(0, 6).map(([k, v]) => (
        <span key={k} className="text-xs">
          <span className="text-[#5a6279]">{k}: </span>
          <span className="text-[#c8d0e0]">{String(v)}</span>
        </span>
      ))}
    </div>
  )
}
