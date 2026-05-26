'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Bug, RefreshCw, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, AlertTriangle, Loader2, Database,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DebugContext {
  current_db:     string
  system_user:    string
  user_name:      string
  default_schema: string
  server_name:    string
}

interface SysTable {
  schema_name?: string   // sys.tables path
  table_name?:  string
  TABLE_SCHEMA?: string  // INFORMATION_SCHEMA path
  TABLE_NAME?:   string
}

interface DebugResult {
  context?:           DebugContext
  context_error?:     string
  info_schema_count?: number
  info_schema_error?: string
  info_schema_tables?: SysTable[]
  sys_tables_count?:  number
  sys_tables_error?:  string
  sys_tables?:        SysTable[]
  explicit_db_count?: number
  explicit_db_error?: string
  explicit_db_tables?: SysTable[]
  permissions?:       { is_sysadmin: number; db_owner: number }
  permissions_error?: string
  error?:             string
}

// ─── Sub-helpers ──────────────────────────────────────────────────────────────

function StatusDot({ ok, warn }: { ok?: boolean; warn?: boolean }) {
  if (ok)   return <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
  if (warn) return <AlertTriangle size={13} className="text-amber-400 shrink-0" />
  return       <XCircle       size={13} className="text-red-400 shrink-0" />
}

function Row({ label, value, ok, warn }: { label: string; value: React.ReactNode; ok?: boolean; warn?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-[#2e3147] last:border-0">
      <StatusDot ok={ok} warn={warn} />
      <span className="text-xs text-[#8892a4] w-40 shrink-0">{label}</span>
      <span className="text-xs font-mono text-white break-all">{value}</span>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DebugPanel({ onTablesReady }: { onTablesReady?: () => void }) {
  const [open,    setOpen]    = useState(true)
  const [loading, setLoading] = useState(false)
  const [data,    setData]    = useState<DebugResult | null>(null)
  const [ran,     setRan]     = useState(false)

  const run = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/migration/debug-tables')
      const json = await res.json() as DebugResult
      setData(json)
      setRan(true)

      // If sys.tables has tables but the caller's table list is empty, notify it
      if ((json.sys_tables_count ?? 0) > 0 && onTablesReady) {
        onTablesReady()
      }
    } catch (e) {
      setData({ error: e instanceof Error ? e.message : 'שגיאת רשת' })
    } finally {
      setLoading(false)
    }
  }, [onTablesReady])

  // Auto-run once on mount
  useEffect(() => { run() }, [run])

  const sysCount  = data?.sys_tables_count  ?? 0
  const infoCount = data?.info_schema_count ?? 0
  const ctx       = data?.context

  return (
    <div className="bg-[#0d1117] border border-amber-500/30 rounded-xl overflow-hidden text-sm">

      {/* Header */}
      <button
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-amber-500/5 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <Bug size={14} className="text-amber-400 shrink-0" />
        <span className="font-medium text-amber-300 flex-1 text-start text-xs">
          אבחון חיבור SQL Server
        </span>
        {loading && <Loader2 size={12} className="animate-spin text-amber-400" />}
        {!loading && ran && (
          <span className={`text-xs px-2 py-0.5 rounded-full border ${
            sysCount > 0
              ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
              : 'text-red-300 bg-red-500/10 border-red-500/30'
          }`}>
            {sysCount > 0 ? `${sysCount} טבלאות` : 'אין טבלאות'}
          </span>
        )}
        {open ? <ChevronUp size={13} className="text-[#8892a4]" /> : <ChevronDown size={13} className="text-[#8892a4]" />}
      </button>

      {open && (
        <div className="border-t border-amber-500/20">

          {/* Loading state */}
          {loading && (
            <div className="flex items-center gap-2 px-4 py-6 text-xs text-[#8892a4]">
              <Loader2 size={13} className="animate-spin" />
              מריץ שאילתות אבחון...
            </div>
          )}

          {/* Error / not configured */}
          {!loading && data?.error && (
            <div className="px-4 py-4 text-xs text-red-300 font-mono">{data.error}</div>
          )}

          {/* Results */}
          {!loading && data && !data.error && (
            <div className="px-4 py-3 space-y-4">

              {/* ── Connection context ─────────────────────────────────── */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Database size={12} className="text-[#6366f1]" />
                  <span className="text-xs font-semibold text-white uppercase tracking-wide">הקשר חיבור</span>
                </div>
                <div className="bg-[#1a1d27] rounded-lg px-3 divide-y divide-[#2e3147]">
                  {ctx ? (
                    <>
                      <Row label="מסד נתונים פעיל"   value={ctx.current_db}     ok={true} />
                      <Row label="SYSTEM_USER"       value={ctx.system_user}    ok={!!ctx.system_user} />
                      <Row label="USER_NAME()"       value={ctx.user_name}      ok={!!ctx.user_name} />
                      <Row label="SCHEMA_NAME()"     value={ctx.default_schema} ok={!!ctx.default_schema} />
                      <Row label="שרת"               value={ctx.server_name}    ok={!!ctx.server_name} />
                    </>
                  ) : (
                    <div className="py-2 text-xs text-red-300">{data.context_error ?? 'לא זמין'}</div>
                  )}
                </div>
              </div>

              {/* ── Table counts ───────────────────────────────────────── */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Database size={12} className="text-[#6366f1]" />
                  <span className="text-xs font-semibold text-white uppercase tracking-wide">ספירת טבלאות</span>
                </div>
                <div className="bg-[#1a1d27] rounded-lg px-3 divide-y divide-[#2e3147]">
                  <Row
                    label="INFORMATION_SCHEMA"
                    value={data.info_schema_error
                      ? <span className="text-red-300">{data.info_schema_error}</span>
                      : String(infoCount)
                    }
                    ok={infoCount > 0}
                    warn={infoCount === 0 && !data.info_schema_error}
                  />
                  <Row
                    label="sys.tables"
                    value={data.sys_tables_error
                      ? <span className="text-red-300">{data.sys_tables_error}</span>
                      : String(sysCount)
                    }
                    ok={sysCount > 0}
                    warn={false}
                  />
                  <Row
                    label="[DB].INFORMATION_SCHEMA"
                    value={data.explicit_db_error
                      ? <span className="text-red-300">{data.explicit_db_error}</span>
                      : String(data.explicit_db_count ?? 0)
                    }
                    ok={(data.explicit_db_count ?? 0) > 0}
                    warn={(data.explicit_db_count ?? 0) === 0 && !data.explicit_db_error}
                  />
                  {data.permissions && (
                    <Row
                      label="הרשאות"
                      value={`sysadmin: ${data.permissions.is_sysadmin ? '✓' : '✗'}  db_owner: ${data.permissions.db_owner ? '✓' : '✗'}`}
                      ok={!!(data.permissions.is_sysadmin || data.permissions.db_owner)}
                    />
                  )}
                </div>
              </div>

              {/* ── First 20 tables from sys.tables ────────────────────── */}
              {sysCount > 0 && data.sys_tables && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Database size={12} className="text-[#6366f1]" />
                    <span className="text-xs font-semibold text-white uppercase tracking-wide">
                      טבלאות מ-sys.tables (ראשונות {Math.min(sysCount, 20)})
                    </span>
                  </div>
                  <div className="bg-[#1a1d27] rounded-lg overflow-hidden">
                    <div className="max-h-48 overflow-y-auto divide-y divide-[#2e3147]">
                      {data.sys_tables.map((t, i) => {
                        const schema = t.schema_name ?? t.TABLE_SCHEMA ?? 'dbo'
                        const name   = t.table_name  ?? t.TABLE_NAME  ?? '?'
                        return (
                          <div key={i} className="flex items-center gap-2 px-3 py-1.5">
                            <span className="text-xs text-[#8892a4] w-14 shrink-0">{schema}</span>
                            <span className="text-xs font-mono text-white">{name}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Warning: INFORMATION_SCHEMA empty but sys.tables has data ── */}
              {infoCount === 0 && sysCount > 0 && (
                <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2.5 text-xs text-amber-300">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span>
                    INFORMATION_SCHEMA ריקה אך sys.tables מחזירה {sysCount} טבלאות.
                    המיפוי משתמש בנתיב sys.tables באופן אוטומטי.
                  </span>
                </div>
              )}

              {/* ── Nothing found anywhere ─────────────────────────────── */}
              {infoCount === 0 && sysCount === 0 && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5 text-xs text-red-300">
                  <XCircle size={13} className="mt-0.5 shrink-0" />
                  <span>
                    לא נמצאו טבלאות בשום שאילתה.{' '}
                    {ctx && `מחובר ל: ${ctx.current_db} בתור ${ctx.system_user}.`}{' '}
                    בדוק שה-DB הנכון מוגדר ב-HANESHER_DB_NAME.
                  </span>
                </div>
              )}

              {/* ── Reload button ──────────────────────────────────────── */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={run}
                  disabled={loading}
                  className="flex items-center gap-1.5 text-xs text-amber-400 hover:underline disabled:opacity-40"
                >
                  <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
                  רענן אבחון
                </button>
                {sysCount > 0 && onTablesReady && (
                  <button
                    onClick={onTablesReady}
                    className="flex items-center gap-1.5 text-xs text-[#6366f1] hover:underline"
                  >
                    <RefreshCw size={11} />
                    טען טבלאות למיפוי
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
