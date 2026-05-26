'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, Loader2, Database, ChevronDown, ChevronRight } from 'lucide-react'
import type { SourceTable } from '@/lib/migration/types'

const ENV_VARS = [
  { name: 'HANESHER_DB_HOST',      example: '192.168.1.10',  desc: 'שם שרת / IP'         },
  { name: 'HANESHER_DB_PORT',      example: '1433',          desc: 'פורט (ברירת מחדל 1433)' },
  { name: 'HANESHER_DB_NAME',      example: 'HanesherDB',    desc: 'שם מסד הנתונים'       },
  { name: 'HANESHER_DB_USER',      example: 'sa',            desc: 'שם משתמש SQL'          },
  { name: 'HANESHER_DB_PASSWORD',  example: '***',           desc: 'סיסמה'                 },
  { name: 'HANESHER_DB_ENCRYPT',   example: 'false',         desc: 'הצפנה TLS (אופציונלי)' },
  { name: 'HANESHER_DB_TRUST_CERT',example: 'true',          desc: 'סמוך על תעודה עצמית'   },
]

export function ConnectionSetup({ configured }: { configured: boolean }) {
  const [testing,  setTesting]  = useState(false)
  const [result,   setResult]   = useState<{ ok: boolean; error?: string } | null>(null)
  const [tables,   setTables]   = useState<SourceTable[] | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

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
    try {
      const res  = await fetch('/api/migration/tables')
      const json = await res.json()
      setTables(json.tables ?? [])
    } catch {
      setTables([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Env vars instructions */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2e3147] flex items-center gap-2">
          <Database size={16} className="text-[#6366f1]" />
          <h2 className="font-semibold text-white text-sm">משתני סביבה נדרשים (.env)</h2>
        </div>
        <div className="divide-y divide-[#2e3147]">
          {ENV_VARS.map((v) => (
            <div key={v.name} className="flex items-center gap-4 px-5 py-3">
              <code className="text-xs font-mono text-[#6366f1] bg-[#6366f1]/10 px-2 py-0.5 rounded w-52 shrink-0">
                {v.name}
              </code>
              <span className="text-xs text-[#8892a4] flex-1">{v.desc}</span>
              <code className="text-xs font-mono text-[#8892a4]">{v.example}</code>
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

        <div className={`flex items-center gap-2 text-sm rounded-lg px-4 py-2.5 border ${
          configured
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
        }`}>
          {configured
            ? <CheckCircle size={14} />
            : <XCircle size={14} />
          }
          {configured ? 'משתני סביבה מוגדרים' : 'משתני סביבה חסרים'}
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
            {result.ok ? <CheckCircle size={15} className="mt-0.5 shrink-0" /> : <XCircle size={15} className="mt-0.5 shrink-0" />}
            <span>{result.ok ? 'החיבור הצליח! SQL Server מגיב.' : result.error}</span>
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

        {tables === null && (
          <div className="px-5 py-8 text-center text-sm text-[#8892a4]">
            לחץ על "טען טבלאות" לצפייה בטבלאות המקור
          </div>
        )}

        {tables !== null && tables.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-[#8892a4]">לא נמצאו טבלאות</div>
        )}

        {tables !== null && tables.length > 0 && (
          <div className="divide-y divide-[#2e3147] max-h-96 overflow-y-auto">
            {tables.map((t) => {
              const key = `${t.schema}.${t.name}`
              const open = expanded === key
              return (
                <div key={key}>
                  <button
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[#252836] transition-colors text-start"
                    onClick={() => setExpanded(open ? null : key)}
                  >
                    {open ? <ChevronDown size={13} className="text-[#6366f1] shrink-0" /> : <ChevronRight size={13} className="text-[#8892a4] shrink-0" />}
                    <span className="text-sm text-white font-mono">{t.schema}.{t.name}</span>
                    <span className="text-xs text-[#8892a4] mr-auto">{t.columns.length} עמודות{t.rowCount != null ? ` · ${t.rowCount.toLocaleString()} שורות` : ''}</span>
                  </button>
                  {open && (
                    <div className="bg-[#0d1117] px-5 py-3 grid grid-cols-3 gap-2">
                      {t.columns.map((c) => (
                        <div key={c.name} className="text-xs">
                          <span className="font-mono text-[#6366f1]">{c.name}</span>
                          <span className="text-[#8892a4] ms-1">{c.sqlType}{c.maxLen ? `(${c.maxLen})` : ''}{c.nullable ? '' : '*'}</span>
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
