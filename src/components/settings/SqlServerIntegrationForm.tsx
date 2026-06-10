'use client'

/**
 * SQL Server Integration Form
 *
 * Settings > Integrations > SQL Server
 *
 * Fields: Server, Database, Username, Password
 * Actions: Save, Test Connection, Delete
 *
 * Security: password field always starts empty; the server returns
 * `passwordSet: boolean` only — the actual value never reaches the browser.
 */

import { useState } from 'react'
import {
  Server, Database, User, Lock, Plug, CheckCircle2,
  XCircle, Loader2, Trash2, Save, AlertTriangle, Info,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import type { SqlServerConfigPublic } from '@/lib/sql-server-integration'
import {
  ENTITY_MAPPINGS,
  SYNC_ENTITY_LABELS,
  SYNC_ENTITY_ICONS,
  type SyncEntity,
} from '@/lib/sql-server-mapping'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  initialConfig: SqlServerConfigPublic | null
}

type TestState =
  | { phase: 'idle' }
  | { phase: 'testing' }
  | { phase: 'ok';   latencyMs: number }
  | { phase: 'fail'; error: string }

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

// ─── Component ────────────────────────────────────────────────────────────────

export function SqlServerIntegrationForm({ initialConfig }: Props) {
  const [config, setConfig] = useState<SqlServerConfigPublic | null>(initialConfig)

  // Form state
  const [server,    setServer]    = useState(initialConfig?.server   ?? '')
  const [database,  setDatabase]  = useState(initialConfig?.database ?? '')
  const [username,  setUsername]  = useState(initialConfig?.username ?? '')
  const [password,  setPassword]  = useState('')   // always empty on load
  const [port,      setPort]      = useState(String(initialConfig?.port ?? 1433))
  const [encrypt,   setEncrypt]   = useState(initialConfig?.encrypt   ?? false)
  const [trustCert, setTrustCert] = useState(initialConfig?.trustCert ?? true)

  // UI state
  const [testState, setTestState]   = useState<TestState>({ phase: 'idle' })
  const [saveState, setSaveState]   = useState<SaveState>('idle')
  const [saveError, setSaveError]   = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [expandedEntity, setExpandedEntity] = useState<SyncEntity | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isDirty = (
    server   !== (config?.server   ?? '') ||
    database !== (config?.database ?? '') ||
    username !== (config?.username ?? '') ||
    password !== '' ||
    port     !== String(config?.port ?? 1433) ||
    encrypt  !== (config?.encrypt   ?? false) ||
    trustCert !== (config?.trustCert ?? true)
  )

  const isConfigured = !!config?.passwordSet

  // ── Test Connection ────────────────────────────────────────────────────────

  async function handleTest() {
    if (!server.trim() || !database.trim() || !username.trim() || !password.trim()) {
      setTestState({ phase: 'fail', error: 'יש למלא את כל השדות לפני בדיקת החיבור' })
      return
    }

    setTestState({ phase: 'testing' })
    try {
      const res  = await fetch('/api/integrations/sql-server/test', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ server, database, username, password, port: Number(port), encrypt, trustCert }),
      })
      const data = await res.json() as { ok: boolean; latencyMs?: number; error?: string }
      if (data.ok) {
        setTestState({ phase: 'ok', latencyMs: data.latencyMs ?? 0 })
      } else {
        setTestState({ phase: 'fail', error: data.error ?? 'החיבור נכשל' })
      }
    } catch {
      setTestState({ phase: 'fail', error: 'שגיאת רשת — לא ניתן להגיע לשרת' })
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!server.trim() || !database.trim() || !username.trim() || !password.trim()) {
      setSaveError('יש למלא את כל שדות החובה')
      return
    }

    setSaveState('saving')
    setSaveError(null)
    try {
      const res  = await fetch('/api/integrations/sql-server', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ server, database, username, password, port: Number(port), encrypt, trustCert }),
      })
      const data = await res.json() as { config?: SqlServerConfigPublic; error?: string }
      if (!res.ok || !data.config) {
        throw new Error(data.error ?? 'שמירה נכשלה')
      }
      setConfig(data.config)
      setPassword('')        // clear — don't keep plaintext in state
      setTestState({ phase: 'idle' })
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2500)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'שגיאה לא צפויה')
      setSaveState('error')
      setTimeout(() => setSaveState('idle'), 3000)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    await fetch('/api/integrations/sql-server', { method: 'DELETE' })
    setConfig(null)
    setServer(''); setDatabase(''); setUsername(''); setPassword('')
    setPort('1433'); setEncrypt(false); setTrustCert(true)
    setTestState({ phase: 'idle' })
    setConfirmDelete(false)
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Header card */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-6">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#6366f1]/10 border border-[#6366f1]/20 rounded-xl flex items-center justify-center">
              <Server size={18} className="text-[#6366f1]" />
            </div>
            <div>
              <h2 className="font-semibold">חיבור SQL Server</h2>
              <p className="text-xs text-[#8892a4] mt-0.5">
                הגדר חיבור למסד נתונים חיצוני לסנכרון נתוני מוסך
              </p>
            </div>
          </div>
          {isConfigured && (
            <StatusBadge
              ok={config?.lastTestOk ?? null}
              lastTested={config?.lastTestedAt ?? null}
            />
          )}
        </div>

        {/* ── Form fields ──────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Server */}
          <Field
            icon={<Server size={14} className="text-[#8892a4]" />}
            label="שרת (Server)"
            hint='כתובת IP, FQDN, או HOST\INSTANCE — לדוגמה: 192.168.1.10 או 192.168.1.10\SQLEXPRESS'
          >
            <input
              dir="ltr"
              value={server}
              onChange={e => { setServer(e.target.value); setTestState({ phase: 'idle' }) }}
              placeholder="192.168.1.10 או srv\SQLEXPRESS"
              className="input-base font-mono text-sm"
            />
          </Field>

          {/* Database */}
          <Field
            icon={<Database size={14} className="text-[#8892a4]" />}
            label="מסד נתונים (Database)"
          >
            <input
              dir="ltr"
              value={database}
              onChange={e => { setDatabase(e.target.value); setTestState({ phase: 'idle' }) }}
              placeholder="GarageDB"
              className="input-base font-mono text-sm"
            />
          </Field>

          {/* Username */}
          <Field
            icon={<User size={14} className="text-[#8892a4]" />}
            label="שם משתמש (Username)"
          >
            <input
              dir="ltr"
              value={username}
              onChange={e => { setUsername(e.target.value); setTestState({ phase: 'idle' }) }}
              placeholder="sa"
              className="input-base font-mono text-sm"
              autoComplete="username"
            />
          </Field>

          {/* Password */}
          <Field
            icon={<Lock size={14} className="text-[#8892a4]" />}
            label="סיסמה (Password)"
            hint={config?.passwordSet && !password ? '••••••••  (שמורה — הזן מחדש כדי לשנות)' : undefined}
          >
            <input
              dir="ltr"
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setTestState({ phase: 'idle' }) }}
              placeholder={config?.passwordSet ? '••••••••' : 'סיסמת SQL Server'}
              className="input-base font-mono text-sm"
              autoComplete="current-password"
            />
          </Field>

          {/* Advanced toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(v => !v)}
            className="flex items-center gap-1.5 text-xs text-[#8892a4] hover:text-[#e2e8f0] transition-colors"
          >
            {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            הגדרות מתקדמות
          </button>

          {showAdvanced && (
            <div className="border border-[#2e3147] rounded-xl p-4 space-y-4 bg-[#13151f]">
              {/* Port */}
              <Field
                icon={<Server size={13} className="text-[#8892a4]" />}
                label="פורט (Port)"
                hint="ברירת מחדל: 1433. מוסתר בעת שימוש ב-named instance."
              >
                <input
                  dir="ltr"
                  type="number"
                  min={1} max={65535}
                  value={port}
                  onChange={e => setPort(e.target.value)}
                  className="input-base font-mono text-sm w-32"
                />
              </Field>

              {/* Encrypt */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={encrypt}
                  onChange={e => setEncrypt(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#6366f1]"
                />
                <span className="text-sm">הצפן את החיבור (TLS)</span>
              </label>

              {/* Trust cert */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={trustCert}
                  onChange={e => setTrustCert(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#6366f1]"
                />
                <span className="text-sm">
                  סמוך על אישור SSL עצמי-חתום
                  <span className="text-xs text-[#8892a4] mr-1">(מומלץ ברשת פנימית)</span>
                </span>
              </label>
            </div>
          )}
        </div>

        {/* ── Test result banner ───────────────────────────────────────── */}
        {testState.phase !== 'idle' && (
          <div className={`mt-4 px-4 py-3 rounded-xl text-sm flex items-start gap-2.5 ${
            testState.phase === 'testing' ? 'bg-[#252836] text-[#8892a4]' :
            testState.phase === 'ok'      ? 'bg-emerald-900/20 border border-emerald-700/30 text-emerald-400' :
            'bg-red-900/20 border border-red-700/30 text-red-400'
          }`}>
            {testState.phase === 'testing' && <Loader2 size={16} className="mt-0.5 flex-shrink-0 animate-spin" />}
            {testState.phase === 'ok'      && <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />}
            {testState.phase === 'fail'    && <XCircle      size={16} className="mt-0.5 flex-shrink-0" />}
            <span>
              {testState.phase === 'testing' && 'בודק חיבור…'}
              {testState.phase === 'ok'      && `החיבור הצליח — זמן תגובה: ${testState.latencyMs}ms`}
              {testState.phase === 'fail'    && testState.error}
            </span>
          </div>
        )}

        {/* ── Save error ───────────────────────────────────────────────── */}
        {saveError && (
          <div className="mt-3 px-4 py-3 rounded-xl text-sm flex items-center gap-2 bg-red-900/20 border border-red-700/30 text-red-400">
            <AlertTriangle size={15} />
            {saveError}
          </div>
        )}

        {/* ── Actions ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mt-5 pt-4 border-t border-[#2e3147] flex-wrap">

          {/* Test Connection */}
          <button
            type="button"
            onClick={handleTest}
            disabled={testState.phase === 'testing'}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#252836] border border-[#2e3147] text-[#e2e8f0] hover:bg-[#2e3147] transition-colors disabled:opacity-50"
          >
            {testState.phase === 'testing'
              ? <Loader2 size={14} className="animate-spin" />
              : <Plug size={14} />
            }
            בדוק חיבור
          </button>

          {/* Save */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saveState === 'saving' || (!isDirty && isConfigured)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
              saveState === 'saved'
                ? 'bg-emerald-600/20 border border-emerald-600/30 text-emerald-400'
                : 'bg-[#6366f1] hover:bg-[#5558e3] text-white'
            }`}
          >
            {saveState === 'saving' && <Loader2 size={14} className="animate-spin" />}
            {saveState === 'saved'  && <CheckCircle2 size={14} />}
            {saveState === 'idle' || saveState === 'error'
              ? <Save size={14} />
              : null
            }
            {saveState === 'saving' ? 'שומר…' : saveState === 'saved' ? 'נשמר' : 'שמור הגדרות'}
          </button>

          {/* Delete */}
          {isConfigured && (
            <button
              type="button"
              onClick={handleDelete}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors mr-auto ${
                confirmDelete
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-transparent border border-red-700/40 text-red-500 hover:bg-red-900/20'
              }`}
            >
              <Trash2 size={14} />
              {confirmDelete ? 'לחץ שוב לאישור מחיקה' : 'מחק הגדרות'}
            </button>
          )}
        </div>
      </div>

      {/* ── Read-only info banner ─────────────────────────────────────── */}
      <div className="flex items-start gap-3 px-4 py-3 bg-amber-900/10 border border-amber-700/25 rounded-xl text-sm text-amber-400/80">
        <Info size={15} className="mt-0.5 flex-shrink-0" />
        <div>
          <span className="font-semibold">מצב read-only: </span>
          החיבור ל-SQL Server הוא לקריאה בלבד — GarageOS לא יכתוב נתונים
          למסד הנתונים החיצוני ללא הפעלה מפורשת.
        </div>
      </div>

      {/* ── Mapping tables ────────────────────────────────────────────── */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2e3147]">
          <h3 className="font-semibold text-sm">טבלאות מיפוי</h3>
          <p className="text-xs text-[#8892a4] mt-0.5">
            שדות GarageOS שניתן למפות לעמודות ב-SQL Server
          </p>
        </div>

        <div className="divide-y divide-[#2e3147]">
          {(Object.keys(ENTITY_MAPPINGS) as SyncEntity[]).map(entity => (
            <EntityMappingRow
              key={entity}
              entity={entity}
              expanded={expandedEntity === entity}
              onToggle={() => setExpandedEntity(expandedEntity === entity ? null : entity)}
            />
          ))}
        </div>
      </div>

    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({
  icon, label, hint, children,
}: {
  icon:      React.ReactNode
  label:     string
  hint?:     string
  children:  React.ReactNode
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-medium text-[#8892a4] mb-1.5">
        {icon}
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-[#8892a4]/70 mt-1">{hint}</p>}
    </div>
  )
}

function StatusBadge({
  ok, lastTested,
}: {
  ok:          boolean | null
  lastTested:  Date | null
}) {
  if (ok === null) {
    return (
      <span className="text-xs px-2.5 py-1 rounded-full bg-[#252836] border border-[#2e3147] text-[#8892a4]">
        לא נבדק
      </span>
    )
  }
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
        ok
          ? 'bg-emerald-900/30 border border-emerald-700/30 text-emerald-400'
          : 'bg-red-900/30 border border-red-700/30 text-red-400'
      }`}>
        {ok ? '● מחובר' : '● לא זמין'}
      </span>
      {lastTested && (
        <span className="text-[10px] text-[#8892a4]">
          {new Date(lastTested).toLocaleString('he-IL')}
        </span>
      )}
    </div>
  )
}

function EntityMappingRow({
  entity, expanded, onToggle,
}: {
  entity:   SyncEntity
  expanded: boolean
  onToggle: () => void
}) {
  const fields = ENTITY_MAPPINGS[entity]
  const keyField    = fields.find(f => f.isKey)
  const requiredCnt = fields.filter(f => f.required).length

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-[#252836] transition-colors text-right"
      >
        <span className="text-lg w-7 text-center">{SYNC_ENTITY_ICONS[entity]}</span>
        <div className="flex-1 min-w-0 text-right">
          <div className="text-sm font-medium">{SYNC_ENTITY_LABELS[entity]}</div>
          <div className="text-xs text-[#8892a4] mt-0.5">
            {fields.length} שדות · {requiredCnt} חובה
            {keyField && ` · מפתח: ${keyField.label}`}
          </div>
        </div>
        {expanded ? <ChevronUp size={14} className="text-[#8892a4] flex-shrink-0" /> : <ChevronDown size={14} className="text-[#8892a4] flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="px-5 pb-4 bg-[#13151f]">
          <div className="rounded-xl border border-[#2e3147] overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#2e3147] bg-[#1a1d27]">
                  <th className="text-right px-3 py-2 text-[#8892a4] font-medium w-1/3">שדה GarageOS</th>
                  <th className="text-right px-3 py-2 text-[#8892a4] font-medium w-1/4">סוג</th>
                  <th className="text-right px-3 py-2 text-[#8892a4] font-medium">הערות</th>
                  <th className="text-center px-3 py-2 text-[#8892a4] font-medium w-16">חובה</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2e3147]">
                {fields.map(field => (
                  <tr key={field.key} className="hover:bg-[#1a1d27] transition-colors">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <code className="font-mono text-[#a5b4fc]">{field.key}</code>
                        {field.isKey && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-amber-900/30 border border-amber-700/30 text-amber-400 font-semibold">
                            KEY
                          </span>
                        )}
                      </div>
                      <div className="text-[#8892a4] mt-0.5">{field.label}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <TypeBadge type={field.type} />
                    </td>
                    <td className="px-3 py-2.5 text-[#8892a4]">
                      {field.hint ?? (field.lookupEntity ? `קישור ל-${SYNC_ENTITY_LABELS[field.lookupEntity]}` : '')}
                      {field.enumValues && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {field.enumValues.map(v => (
                            <code key={v} className="text-[9px] px-1 py-0.5 rounded bg-[#252836] text-[#8892a4] font-mono">{v}</code>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {field.required
                        ? <CheckCircle2 size={13} className="text-emerald-500 mx-auto" />
                        : <span className="text-[#4a5170]">—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    string:   'bg-blue-900/30 border-blue-700/30 text-blue-400',
    number:   'bg-purple-900/30 border-purple-700/30 text-purple-400',
    currency: 'bg-purple-900/30 border-purple-700/30 text-purple-400',
    date:     'bg-orange-900/30 border-orange-700/30 text-orange-400',
    boolean:  'bg-teal-900/30 border-teal-700/30 text-teal-400',
    enum:     'bg-amber-900/30 border-amber-700/30 text-amber-400',
    phone:    'bg-blue-900/30 border-blue-700/30 text-blue-400',
    lookup:   'bg-rose-900/30 border-rose-700/30 text-rose-400',
  }
  const cls = map[type] ?? 'bg-[#252836] border-[#2e3147] text-[#8892a4]'
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-mono font-semibold uppercase tracking-wide ${cls}`}>
      {type}
    </span>
  )
}
