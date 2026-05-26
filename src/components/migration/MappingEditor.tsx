'use client'

import { useState, useEffect } from 'react'
import {
  Plus, Trash2, Save, Eye, Loader2, ChevronDown, X, Info
} from 'lucide-react'
import type { MappingPreset, ColumnMapping, TargetEntity, SourceTable, TransformType } from '@/lib/migration/types'
import { TARGET_FIELDS, ENTITY_LABELS } from '@/lib/migration/types'

const INPUT = 'w-full bg-[#0d1117] border border-[#2e3147] text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6366f1] placeholder-[#8892a4]'
const SELECT = 'w-full bg-[#0d1117] border border-[#2e3147] text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6366f1]'
const LABEL  = 'block text-xs text-[#8892a4] mb-1 uppercase tracking-wide'

const TRANSFORMS: { value: TransformType; label: string }[] = [
  { value: 'none',         label: 'ללא'                },
  { value: 'trim',         label: 'חיתוך רווחים'       },
  { value: 'uppercase',    label: 'אותיות גדולות'      },
  { value: 'lowercase',    label: 'אותיות קטנות'       },
  { value: 'number',       label: 'המר למספר'          },
  { value: 'date_iso',     label: 'המר לתאריך'         },
  { value: 'fuel_he',      label: 'סוג דלק (עברית)'    },
  { value: 'strip_nondigit', label: 'ספרות בלבד'       },
  { value: 'boolean_yn',   label: 'בוליאן Y/N'         },
]

const ENTITIES = Object.keys(ENTITY_LABELS) as TargetEntity[]

const emptyPreset = (): Omit<MappingPreset, 'id'> => ({
  name:           '',
  sourceTable:    '',
  targetEntity:   'customer',
  columnMappings: [{ sourceColumn: '', targetField: '', transform: 'none' }],
  filterSql:      '',
  incrementalColumn: '',
})

export function MappingEditor({ initialPresets }: { initialPresets: MappingPreset[] }) {
  const [presets,   setPresets]   = useState<MappingPreset[]>(initialPresets)
  const [selected,  setSelected]  = useState<MappingPreset | null>(null)
  const [draft,     setDraft]     = useState<Omit<MappingPreset, 'id'>>(emptyPreset())
  const [saving,    setSaving]    = useState(false)
  const [deleting,  setDeleting]  = useState<string | null>(null)
  const [tables,    setTables]    = useState<SourceTable[] | null>(null)
  const [loadingTables, setLoadingTables] = useState(false)
  const [preview,   setPreview]   = useState<Record<string, unknown>[] | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [msg,       setMsg]       = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Load tables once
  useEffect(() => {
    setLoadingTables(true)
    fetch('/api/migration/tables')
      .then((r) => r.json())
      .then((j) => setTables(j.tables ?? []))
      .catch(() => setTables([]))
      .finally(() => setLoadingTables(false))
  }, [])

  function startNew() {
    setSelected(null)
    setDraft(emptyPreset())
    setPreview(null)
  }

  function selectPreset(p: MappingPreset) {
    setSelected(p)
    setDraft({
      name:              p.name,
      sourceTable:       p.sourceTable,
      targetEntity:      p.targetEntity,
      columnMappings:    p.columnMappings,
      filterSql:         p.filterSql ?? '',
      incrementalColumn: p.incrementalColumn ?? '',
    })
    setPreview(null)
  }

  function updateMapping(idx: number, field: keyof ColumnMapping, value: string) {
    setDraft((d) => {
      const mappings = [...d.columnMappings]
      mappings[idx] = { ...mappings[idx], [field]: value } as ColumnMapping
      return { ...d, columnMappings: mappings }
    })
  }

  function addMapping() {
    setDraft((d) => ({
      ...d,
      columnMappings: [...d.columnMappings, { sourceColumn: '', targetField: '', transform: 'none' }],
    }))
  }

  function removeMapping(idx: number) {
    setDraft((d) => ({
      ...d,
      columnMappings: d.columnMappings.filter((_, i) => i !== idx),
    }))
  }

  async function handlePreview() {
    if (!draft.sourceTable) return
    const [schema, table] = draft.sourceTable.includes('.')
      ? draft.sourceTable.split('.', 2)
      : ['dbo', draft.sourceTable]
    setLoadingPreview(true)
    setPreview(null)
    try {
      const res  = await fetch(`/api/migration/preview?schema=${schema}&table=${table}&limit=5&filter=${encodeURIComponent(draft.filterSql ?? '')}`)
      const json = await res.json()
      setPreview(json.rows ?? [])
    } catch {
      setPreview([])
    } finally {
      setLoadingPreview(false)
    }
  }

  async function handleSave() {
    if (!draft.name || !draft.sourceTable || !draft.targetEntity) {
      setMsg({ type: 'err', text: 'יש למלא שם, טבלת מקור וישות יעד' })
      return
    }
    const mappings = draft.columnMappings.filter((m) => m.sourceColumn && m.targetField)
    if (!mappings.length) {
      setMsg({ type: 'err', text: 'יש להגדיר לפחות מיפוי אחד' })
      return
    }

    setSaving(true)
    setMsg(null)
    try {
      const body = { ...draft, columnMappings: mappings, ...(selected ? { id: selected.id } : {}) }
      const res  = await fetch('/api/migration/presets', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) { setMsg({ type: 'err', text: json.error }); return }

      const saved = json.preset as MappingPreset
      if (selected) {
        setPresets((ps) => ps.map((p) => p.id === saved.id ? saved : p))
      } else {
        setPresets((ps) => [...ps, saved])
      }
      setSelected(saved)
      setMsg({ type: 'ok', text: 'הפריסט נשמר בהצלחה' })
    } catch {
      setMsg({ type: 'err', text: 'שגיאת שמירה' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('למחוק פריסט זה?')) return
    setDeleting(id)
    await fetch(`/api/migration/presets/${id}`, { method: 'DELETE' })
    setPresets((ps) => ps.filter((p) => p.id !== id))
    if (selected?.id === id) { setSelected(null); setDraft(emptyPreset()) }
    setDeleting(null)
  }

  const targetFields = TARGET_FIELDS[draft.targetEntity] ?? []

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

      {/* Sidebar: preset list */}
      <div className="lg:col-span-1 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-[#8892a4] uppercase tracking-wider">פריסטים</h3>
          <button onClick={startNew} className="flex items-center gap-1 text-xs text-[#6366f1] hover:underline">
            <Plus size={12} />חדש
          </button>
        </div>
        <div className="space-y-1">
          {presets.map((p) => (
            <div
              key={p.id}
              className={`flex items-center gap-2 rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                selected?.id === p.id
                  ? 'bg-[#6366f1]/20 border border-[#6366f1]/40'
                  : 'bg-[#1a1d27] border border-[#2e3147] hover:border-[#3e4157]'
              }`}
              onClick={() => selectPreset(p)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{p.name}</p>
                <p className="text-xs text-[#8892a4] truncate">{ENTITY_LABELS[p.targetEntity]}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(p.id) }}
                className="text-[#8892a4] hover:text-red-400 transition-colors p-0.5"
              >
                {deleting === p.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              </button>
            </div>
          ))}
          {presets.length === 0 && (
            <p className="text-xs text-[#8892a4] text-center py-4">אין פריסטים עדיין</p>
          )}
        </div>
      </div>

      {/* Main editor */}
      <div className="lg:col-span-3 space-y-5">

        {/* Basic info */}
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">{selected ? 'ערוך פריסט' : 'פריסט חדש'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>שם פריסט *</label>
              <input className={INPUT} value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="לקוחות Hanesher" />
            </div>
            <div>
              <label className={LABEL}>ישות יעד *</label>
              <select className={SELECT} value={draft.targetEntity} onChange={(e) => setDraft((d) => ({ ...d, targetEntity: e.target.value as TargetEntity }))}>
                {ENTITIES.map((e) => <option key={e} value={e}>{ENTITY_LABELS[e]}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>טבלת מקור *</label>
              {loadingTables ? (
                <div className="flex items-center gap-2 text-xs text-[#8892a4] py-2"><Loader2 size={12} className="animate-spin" />טוען...</div>
              ) : (
                <select className={SELECT} value={draft.sourceTable} onChange={(e) => setDraft((d) => ({ ...d, sourceTable: e.target.value }))}>
                  <option value="">בחר טבלה...</option>
                  {(tables ?? []).map((t) => (
                    <option key={`${t.schema}.${t.name}`} value={`${t.schema}.${t.name}`}>
                      {t.schema}.{t.name}{t.rowCount != null ? ` (${t.rowCount.toLocaleString()})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className={LABEL}>עמודת עדכון (לsync מצטבר)</label>
              <input className={INPUT} value={draft.incrementalColumn ?? ''} onChange={(e) => setDraft((d) => ({ ...d, incrementalColumn: e.target.value }))} placeholder="updated_at" />
            </div>
            <div className="sm:col-span-2">
              <label className={LABEL}>סינון SQL (WHERE — אופציונלי)</label>
              <input className={INPUT} value={draft.filterSql ?? ''} onChange={(e) => setDraft((d) => ({ ...d, filterSql: e.target.value }))} placeholder="IsActive = 1 AND CreatedDate > '2020-01-01'" />
            </div>
          </div>

          {/* Preview button */}
          {draft.sourceTable && (
            <button onClick={handlePreview} disabled={loadingPreview} className="flex items-center gap-1.5 text-xs text-[#6366f1] hover:underline disabled:opacity-40">
              {loadingPreview ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
              תצוגה מקדימה (5 שורות)
            </button>
          )}

          {/* Row preview table */}
          {preview && preview.length > 0 && (
            <div className="overflow-x-auto border border-[#2e3147] rounded-lg">
              <table className="min-w-full text-xs">
                <thead className="bg-[#252836]">
                  <tr>
                    {Object.keys(preview[0]).map((col) => (
                      <th key={col} className="px-3 py-2 text-start font-mono text-[#8892a4] whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2e3147]">
                  {preview.map((row, i) => (
                    <tr key={i} className="hover:bg-[#252836]">
                      {Object.values(row).map((val, j) => (
                        <td key={j} className="px-3 py-1.5 text-[#e2e8f0] whitespace-nowrap max-w-xs truncate">
                          {val == null ? <span className="text-[#8892a4]">NULL</span> : String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {preview && preview.length === 0 && (
            <p className="text-xs text-[#8892a4]">אין שורות להצגה</p>
          )}
        </div>

        {/* Column mappings */}
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#2e3147] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">מיפוי עמודות</h3>
            <button onClick={addMapping} className="flex items-center gap-1 text-xs text-[#6366f1] hover:underline">
              <Plus size={12} />הוסף שורה
            </button>
          </div>

          {/* Header */}
          <div className="grid grid-cols-12 gap-2 px-5 py-2 bg-[#252836] text-xs font-medium text-[#8892a4] uppercase tracking-wide">
            <span className="col-span-4">עמודת מקור</span>
            <span className="col-span-4">שדה יעד</span>
            <span className="col-span-3">טרנספורם</span>
            <span className="col-span-1"></span>
          </div>

          <div className="divide-y divide-[#2e3147]">
            {draft.columnMappings.map((m, idx) => {
              // Get source columns from the selected table
              const tableInfo = (tables ?? []).find(
                (t) => `${t.schema}.${t.name}` === draft.sourceTable,
              )
              return (
                <div key={idx} className="grid grid-cols-12 gap-2 px-5 py-2.5 items-center">
                  {/* Source column */}
                  <div className="col-span-4">
                    {tableInfo ? (
                      <select
                        className={SELECT}
                        value={m.sourceColumn}
                        onChange={(e) => updateMapping(idx, 'sourceColumn', e.target.value)}
                      >
                        <option value="">בחר עמודה...</option>
                        {tableInfo.columns.map((c) => (
                          <option key={c.name} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    ) : (
                      <input className={INPUT} value={m.sourceColumn} onChange={(e) => updateMapping(idx, 'sourceColumn', e.target.value)} placeholder="column_name" />
                    )}
                  </div>

                  {/* Target field */}
                  <div className="col-span-4">
                    <select
                      className={SELECT}
                      value={m.targetField}
                      onChange={(e) => updateMapping(idx, 'targetField', e.target.value)}
                    >
                      <option value="">בחר שדה...</option>
                      {targetFields.map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label}{f.required ? ' *' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Transform */}
                  <div className="col-span-3">
                    <select
                      className={SELECT}
                      value={m.transform ?? 'none'}
                      onChange={(e) => updateMapping(idx, 'transform', e.target.value)}
                    >
                      {TRANSFORMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>

                  {/* Remove */}
                  <div className="col-span-1 flex justify-end">
                    <button onClick={() => removeMapping(idx)} className="text-[#8892a4] hover:text-red-400 transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Required fields guide */}
          <div className="px-5 py-3 bg-[#0d1117] border-t border-[#2e3147]">
            <div className="flex flex-wrap gap-2">
              {targetFields.filter(f => f.required).map((f) => (
                <span key={f.key} className="text-xs bg-[#6366f1]/10 text-[#6366f1] px-2 py-0.5 rounded border border-[#6366f1]/20">
                  {f.key} *
                </span>
              ))}
              {targetFields.filter(f => f.type === 'lookup').map((f) => (
                <span key={f.key} className="text-xs bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
                  <Info size={10} />{f.key}
                </span>
              ))}
            </div>
            <p className="text-xs text-[#8892a4] mt-1.5">* = שדה חובה · 🔗 = שדה קישור (lookup)</p>
          </div>
        </div>

        {/* Save / status */}
        {msg && (
          <div className={`text-sm rounded-lg px-4 py-2.5 border ${
            msg.type === 'ok'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}>{msg.text}</div>
        )}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-40 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'שומר...' : 'שמור פריסט'}
          </button>
        </div>
      </div>
    </div>
  )
}
