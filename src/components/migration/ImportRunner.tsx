'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Play, AlertTriangle, CheckCircle, XCircle, Loader2, RotateCcw, ChevronRight, Info
} from 'lucide-react'
import type { MappingPreset } from '@/lib/migration/types'
import { ENTITY_LABELS } from '@/lib/migration/types'
import type { BatchSummary } from '@/lib/migration/types'

type BatchRow = {
  id: string; status: string; isDryRun: boolean; isIncremental: boolean
  presetsUsed: unknown; totalRows: number; imported: number; skipped: number
  failed: number; rolledBack: boolean; startedAt: unknown; completedAt: unknown
  createdAt: Date | string; userName: string | null
}

export function ImportRunner({
  presets,
  initialBatches,
}: {
  presets: MappingPreset[]
  initialBatches: BatchRow[]
}) {
  const router = useRouter()
  const [selectedIds,   setSelectedIds]   = useState<string[]>([])
  const [isDryRun,      setIsDryRun]      = useState(true)
  const [isIncremental, setIsIncremental] = useState(false)
  const [lastSyncAt,    setLastSyncAt]    = useState('')
  const [running,       setRunning]       = useState(false)
  const [summary,       setSummary]       = useState<BatchSummary | null>(null)
  const [error,         setError]         = useState<string | null>(null)
  const [batches,       setBatches]       = useState<BatchRow[]>(initialBatches)
  const [rollingBack,   setRollingBack]   = useState<string | null>(null)

  function togglePreset(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  async function handleRun() {
    if (!selectedIds.length) { setError('בחר לפחות פריסט אחד'); return }
    setRunning(true)
    setError(null)
    setSummary(null)

    try {
      const res = await fetch('/api/migration/run', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          presetIds: selectedIds,
          isDryRun,
          isIncremental,
          lastSyncAt: lastSyncAt || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error); return }
      setSummary(json.summary)

      // Refresh batches list from server
      const bRes  = await fetch('/api/migration/batches')
      const bJson = await bRes.json()
      setBatches(bJson.batches ?? [])
    } catch {
      setError('שגיאת רשת')
    } finally {
      setRunning(false)
    }
  }

  async function handleRollback(batchId: string) {
    if (!confirm('לבטל את כל הרשומות שנוצרו בייבוא זה?')) return
    setRollingBack(batchId)
    try {
      const res = await fetch(`/api/migration/batches/${batchId}/rollback`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { alert(json.error); return }
      const bRes  = await fetch('/api/migration/batches')
      const bJson = await bRes.json()
      setBatches(bJson.batches ?? [])
      router.refresh()
    } finally {
      setRollingBack(null)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Config panel */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5 space-y-5">
        <h2 className="font-semibold text-white text-sm">הגדרות ייבוא</h2>

        {/* Preset selection */}
        <div>
          <label className="block text-xs text-[#8892a4] uppercase tracking-wide mb-2">פריסטים להרצה *</label>
          {presets.length === 0 ? (
            <p className="text-sm text-[#8892a4]">אין פריסטים — <a href="/dashboard/migration/mapping" className="text-[#6366f1] hover:underline">צור פריסט תחילה</a></p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {presets.map((p) => (
                <label key={p.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedIds.includes(p.id)
                    ? 'bg-[#6366f1]/10 border-[#6366f1]/50'
                    : 'bg-[#252836] border-[#2e3147] hover:border-[#3e4157]'
                }`}>
                  <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => togglePreset(p.id)} className="accent-[#6366f1]" />
                  <div>
                    <p className="text-sm text-white font-medium">{p.name}</p>
                    <p className="text-xs text-[#8892a4]">{ENTITY_LABELS[p.targetEntity]} ← {p.sourceTable}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Dry run toggle */}
          <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
            isDryRun
              ? 'bg-amber-500/10 border-amber-500/30'
              : 'bg-[#252836] border-[#2e3147] hover:border-[#3e4157]'
          }`}>
            <input type="checkbox" checked={isDryRun} onChange={(e) => setIsDryRun(e.target.checked)} className="accent-amber-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-white flex items-center gap-1.5">
                <AlertTriangle size={13} className="text-amber-400" />Dry-run
              </p>
              <p className="text-xs text-[#8892a4] mt-0.5">בדוק מה יקרה ללא שינויים אמיתיים. מומלץ תמיד להריץ תחילה.</p>
            </div>
          </label>

          {/* Incremental toggle */}
          <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
            isIncremental
              ? 'bg-[#6366f1]/10 border-[#6366f1]/30'
              : 'bg-[#252836] border-[#2e3147] hover:border-[#3e4157]'
          }`}>
            <input type="checkbox" checked={isIncremental} onChange={(e) => setIsIncremental(e.target.checked)} className="accent-[#6366f1] mt-0.5" />
            <div>
              <p className="text-sm font-medium text-white flex items-center gap-1.5">
                <RotateCcw size={13} className="text-[#6366f1]" />סינכרון מצטבר
              </p>
              <p className="text-xs text-[#8892a4] mt-0.5">ייבא רק שורות חדשות/מעודכנות מאז תאריך הסינכרון האחרון.</p>
            </div>
          </label>
        </div>

        {isIncremental && (
          <div>
            <label className="block text-xs text-[#8892a4] uppercase tracking-wide mb-1">תאריך סינכרון אחרון</label>
            <input
              type="datetime-local"
              value={lastSyncAt}
              onChange={(e) => setLastSyncAt(e.target.value)}
              className="bg-[#0d1117] border border-[#2e3147] text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6366f1]"
            />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-300 rounded-lg px-4 py-3 text-sm">
            <XCircle size={14} />{error}
          </div>
        )}

        <button
          onClick={handleRun}
          disabled={running || !presets.length}
          className={`flex items-center gap-2 text-white font-semibold px-8 py-3 rounded-xl text-sm transition-colors disabled:opacity-40 ${
            isDryRun
              ? 'bg-amber-500 hover:bg-amber-600'
              : 'bg-emerald-500 hover:bg-emerald-600'
          }`}
        >
          {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          {running ? 'מייבא...' : isDryRun ? 'הרץ Dry-run' : 'הרץ ייבוא אמיתי'}
        </button>

        {!isDryRun && (
          <p className="text-xs text-amber-400 flex items-center gap-1.5">
            <Info size={12} />ייבוא אמיתי — שינויים ייכתבו למסד הנתונים. ניתן לבטל לאחר מכן.
          </p>
        )}
      </div>

      {/* Result summary */}
      {summary && (
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
          <div className={`px-5 py-4 border-b border-[#2e3147] flex items-center gap-3 ${
            summary.isDryRun ? 'bg-amber-500/10' : 'bg-emerald-500/10'
          }`}>
            {summary.isDryRun
              ? <AlertTriangle size={16} className="text-amber-400" />
              : <CheckCircle size={16} className="text-emerald-400" />
            }
            <h3 className="font-semibold text-white text-sm">
              {summary.isDryRun ? 'תוצאות Dry-run' : 'ייבוא הושלם'}
            </h3>
            <span className="text-xs text-[#8892a4] mr-auto">batch: {summary.batchId.slice(0, 8)}…</span>
          </div>
          <div className="grid grid-cols-4 divide-x divide-[#2e3147]">
            {[
              { label: 'סה"כ שורות', value: summary.total,    color: 'text-white'        },
              { label: 'יוצרו',       value: summary.imported, color: 'text-emerald-400'  },
              { label: 'קיימים',      value: summary.skipped,  color: 'text-[#8892a4]'    },
              { label: 'שגיאות',      value: summary.failed,   color: 'text-red-400'      },
            ].map(({ label, value, color }) => (
              <div key={label} className="px-5 py-4 text-center">
                <p className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</p>
                <p className="text-xs text-[#8892a4] mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          {/* Errors */}
          {summary.results.filter(r => r.action === 'failed').length > 0 && (
            <div className="border-t border-[#2e3147] px-5 py-3 max-h-48 overflow-y-auto space-y-1">
              {summary.results.filter(r => r.action === 'failed').slice(0, 50).map((r, i) => (
                <p key={i} className="text-xs text-red-400">
                  [{r.entity}] {r.sourceId}: {r.message}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* History table */}
      {batches.length > 0 && (
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#2e3147]">
            <h3 className="text-sm font-semibold text-white">היסטוריית ייבוא</h3>
          </div>
          <div className="divide-y divide-[#2e3147]">
            {batches.map((b) => {
              const presetNames = (b.presetsUsed as string[]).join(', ')
              return (
                <div key={b.id} className="flex items-center gap-4 px-5 py-3.5">
                  <BatchStatusBadge status={b.status} isDryRun={b.isDryRun} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{presetNames}</p>
                    <p className="text-xs text-[#8892a4]">
                      {b.userName} · {new Date(b.createdAt).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {b.isIncremental ? ' · מצטבר' : ''}
                    </p>
                  </div>
                  <div className="text-xs text-end shrink-0">
                    <p><span className="text-emerald-400">{b.imported}</span> נוצרו</p>
                    <p className="text-[#8892a4]">{b.skipped} קיים · {b.failed > 0 ? <span className="text-red-400">{b.failed}</span> : b.failed} שגיאות</p>
                  </div>
                  {/* Rollback */}
                  {!b.isDryRun && !b.rolledBack && b.status === 'COMPLETED' && b.imported > 0 && (
                    <button
                      onClick={() => handleRollback(b.id)}
                      disabled={rollingBack === b.id}
                      title="בטל ייבוא"
                      className="text-[#8892a4] hover:text-red-400 transition-colors p-1"
                    >
                      {rollingBack === b.id ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                    </button>
                  )}
                  <a href={`/dashboard/migration/batch/${b.id}`} className="text-[#8892a4] hover:text-[#6366f1] p-1">
                    <ChevronRight size={14} />
                  </a>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function BatchStatusBadge({ status, isDryRun }: { status: string; isDryRun: boolean }) {
  if (isDryRun) return (
    <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 whitespace-nowrap">dry-run</span>
  )
  const cfg: Record<string, string> = {
    COMPLETED:   'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    FAILED:      'bg-red-500/10 text-red-400 border-red-500/20',
    ROLLED_BACK: 'bg-[#8892a4]/10 text-[#8892a4] border-[#8892a4]/20',
    RUNNING:     'bg-[#6366f1]/10 text-[#6366f1] border-[#6366f1]/20',
  }
  const label: Record<string, string> = { COMPLETED: 'הושלם', FAILED: 'נכשל', ROLLED_BACK: 'בוטל', RUNNING: 'רץ', PENDING: 'ממתין' }
  return (
    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${cfg[status] ?? cfg.RUNNING}`}>
      {label[status] ?? status}
    </span>
  )
}
