'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, Loader2, Database, ChevronDown, ChevronRight, Wifi } from 'lucide-react'
import type { SourceTable } from '@/lib/migration/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HanesherConfig {
  server:      string   // HANESHER_DB_SERVER — named instance string (optional)
  host:        string
  port:        string
  name:        string
  user:        string
  passwordSet: boolean
  encrypt:     string
  trustCert:   string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function LiveValue({ value, missing = false }: { value: string; missing?: boolean }) {
  if (missing || !value) {
    return <span className="text-xs font-mono text-amber-400/80 italic">(לא הוגדר)</span>
  }
  return <code className="text-xs font-mono text-emerald-300">{value}</code>
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ConnectionSetup({
  configured,
  config,
}: {
  configured: boolean
  config: HanesherConfig
}) {
  const [testing,     setTesting]     = useState(false)
  const [result,      setResult]      = useState<{ ok: boolean; error?: string } | null>(null)
  const [tables,      setTables]      = useState<SourceTable[] | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [tablesError, setTablesError] = useState<string | null>(null)
  const [expanded,    setExpanded]    = useState<string | null>(null)

  async function handleTest() {
    setTesting(true)
    setResult(null)
    try {
      const res  = await fetch('/api/migration/test-connection')
      const json = await res.json()
      setResult(json)
    } catch {
      setResult({ ok: false, error: 'שגיאת רשת' })
    } finally {
      setTesting(false)
    }
  }

  async function handleLoadTables() {
    setLoading(true)
    setTables(null)
    setTablesError(null)
    try {
      const res  = await fetch('/api/migration/tables')
      const json = await res.json()
      if (!res.ok || json.error) {
        setTablesError(json.error ?? `שגיאת שרת ${res.status}`)
        setTables([])
      } else {
        setTables(json.tables ?? [])
      }
    } catch (e) {
      setTablesError(e instanceof Error ? e.message : 'שגיאת רשת')
      setTables([])
    } finally {
      setLoading(false)
    }
  }

  // Rows for the live config table
  const envRows: { name: string; value: string; desc: string; missing?: boolean }[] = [
    ...(config.server ? [{
      name: 'HANESHER_DB_SERVER', value: config.server,
      desc: 'שרת + instance (מנצח על HOST)', missing: false,
    }] : []),
    { name: 'HANESHER_DB_HOST',       value: config.host,        desc: 'IP שרת',                      missing: !config.host && !config.server },
    { name: 'HANESHER_DB_PORT',       value: config.port,        desc: config.server ? 'פורט (לא בשימוש עם instance)' : 'פורט TCP', missing: false },
    { name: 'HANESHER_DB_NAME',       value: config.name,        desc: 'שם מסד הנתונים',              missing: !config.name },
    { name: 'HANESHER_DB_USER',       value: config.user,        desc: 'שם משתמש SQL',                missing: !config.user },
    { name: 'HANESHER_DB_PASSWORD',   value: config.passwordSet ? '••••••••' : '', desc: 'סיסמה', missing: !config.passwordSet },
    { name: 'HANESHER_DB_ENCRYPT',    value: config.encrypt,     desc: 'הצפנה TLS',                   missing: false },
    { name: 'HANESHER_DB_TRUST_CERT', value: config.trustCert,   desc: 'סמוך על תעודה עצמית',         missing: false },
  ]

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Live config card */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2e3147] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database size={16} className="text-[#6366f1]" />
            <h2 className="font-semibold text-white text-sm">הגדרות חיבור נוכחיות (.env)</h2>
          </div>

          {/* Connected badge — shown only after a successful test */}
          {result?.ok && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full">
              <Wifi size={11} />
              מחובר
            </span>
          )}
        </div>

        <div className="divide-y divide-[#2e3147]">
          {envRows.map((row) => (
            <div key={row.name} className="flex items-center gap-4 px-5 py-3">
              <code className="text-xs font-mono text-[#6366f1] bg-[#6366f1]/10 px-2 py-0.5 rounded w-56 shrink-0">
                {row.name}
              </code>
              <span className="text-xs text-[#8892a4] flex-1">{row.desc}</span>
              <LiveValue value={row.value} missing={row.missing} />
            </div>
          ))}
        </div>

        <div className="px-5 py-3 bg-[#0d1117] border-t border-[#2e3147]">
          <p className="text-xs text-[#8892a4]">
            ⚠️ הפרטים מאוחסנים רק ב-.env ולא נשמרים במסד הנתונים. לעולם אל תעלה .env ל-Git.
          </p>
        </div>
      </div>

      {/* Test connection */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-white text-sm">בדיקת חיבור</h2>

        {/* Env-configured status */}
        <div className={`flex items-center gap-2 text-sm rounded-lg px-4 py-2.5 border ${
          configured
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
        }`}>
          {configured ? <CheckCircle size={14} /> : <XCircle size={14} />}
          {configured ? 'כל משתני הסביבה הנדרשים מוגדרים' : 'משתני סביבה חסרים — השלם את .env'}
        </div>

        <button
          onClick={handleTest}
          disabled={!configured || testing}
          className="flex items-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-40 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
        >
          {testing ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
          {testing ? 'מתחבר...' : 'בדוק חיבור'}
        </button>

        {result && (
          <div className={`flex items-start gap-2 rounded-lg px-4 py-3 border text-sm ${
            result.ok
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}>
            {result.ok
              ? <CheckCircle size={15} className="mt-0.5 shrink-0" />
              : <XCircle    size={15} className="mt-0.5 shrink-0" />
            }
            <span>
              {result.ok
                ? `החיבור הצליח! SQL Server מגיב (${config.server || config.host})`
                : result.error
              }
            </span>
          </div>
        )}
      </div>

      {/* Table browser */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2e3147] flex items-center justify-between">
          <h2 className="font-semibold text-white text-sm">טבלאות מקור</h2>
          <button
            onClick={handleLoadTables}
            disabled={!configured || loading}
            className="flex items-center gap-1.5 text-xs text-[#6366f1] hover:underline disabled:opacity-40"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : null}
            {loading ? 'טוען...' : 'טען טבלאות'}
          </button>
        </div>

        {tables === null && !tablesError && (
          <div className="px-5 py-8 text-center text-sm text-[#8892a4]">
            לחץ על &quot;טען טבלאות&quot; לצפייה בטבלאות המקור
          </div>
        )}

        {tablesError && (
          <div className="px-5 py-4">
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-xs text-red-300">
              <XCircle size={13} className="mt-0.5 shrink-0" />
              <span className="font-mono break-all">{tablesError}</span>
            </div>
          </div>
        )}

        {tables !== null && tables.length === 0 && !tablesError && (
          <div className="px-5 py-8 text-center text-sm text-[#8892a4]">לא נמצאו טבלאות</div>
        )}

        {tables !== null && tables.length > 0 && (
          <div className="divide-y divide-[#2e3147] max-h-96 overflow-y-auto">
            {tables.map((t) => {
              const key  = `${t.schema}.${t.name}`
              const open = expanded === key
              return (
                <div key={key}>
                  <button
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[#252836] transition-colors text-start"
                    onClick={() => setExpanded(open ? null : key)}
                  >
                    {open
                      ? <ChevronDown  size={13} className="text-[#6366f1] shrink-0" />
                      : <ChevronRight size={13} className="text-[#8892a4] shrink-0" />
                    }
                    <span className="text-sm text-white font-mono">{t.schema}.{t.name}</span>
                    <span className="text-xs text-[#8892a4] mr-auto">
                      {t.columns.length} עמודות
                      {t.rowCount != null ? ` · ${t.rowCount.toLocaleString()} שורות` : ''}
                    </span>
                  </button>
                  {open && (
                    <div className="bg-[#0d1117] px-5 py-3 grid grid-cols-3 gap-2">
                      {t.columns.map((c) => (
                        <div key={c.name} className="text-xs">
                          <span className="font-mono text-[#6366f1]">{c.name}</span>
                          <span className="text-[#8892a4] ms-1">
                            {c.sqlType}{c.maxLen ? `(${c.maxLen})` : ''}{c.nullable ? '' : ' *'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
