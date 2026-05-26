'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Trash2, Save, Eye, Loader2, X, Info,
  Wand2, CheckCircle2, AlertCircle, Hash, Type, Calendar, ToggleLeft,
} from 'lucide-react'
import type {
  MappingPreset, ColumnMapping, TargetEntity,
  SourceTable, SourceColumn, TransformType,
} from '@/lib/migration/types'
import { TARGET_FIELDS, ENTITY_LABELS } from '@/lib/migration/types'

// ─── Styles ───────────────────────────────────────────────────────────────────

const INPUT  = 'w-full bg-[#0d1117] border border-[#2e3147] text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6366f1] placeholder-[#8892a4]'
const SELECT = 'w-full bg-[#0d1117] border border-[#2e3147] text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6366f1]'
const LABEL  = 'block text-xs text-[#8892a4] mb-1 uppercase tracking-wide'

// ─── Transform options ────────────────────────────────────────────────────────

const TRANSFORMS: { value: TransformType; label: string }[] = [
  { value: 'none',          label: 'ללא'                },
  { value: 'trim',          label: 'חיתוך רווחים'       },
  { value: 'uppercase',     label: 'אותיות גדולות'      },
  { value: 'lowercase',     label: 'אותיות קטנות'       },
  { value: 'number',        label: 'המר למספר'          },
  { value: 'date_iso',      label: 'המר לתאריך'         },
  { value: 'fuel_he',       label: 'סוג דלק (עברית)'    },
  { value: 'strip_nondigit', label: 'ספרות בלבד'        },
  { value: 'boolean_yn',    label: 'בוליאן Y/N'         },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ENTITIES = Object.keys(ENTITY_LABELS) as TargetEntity[]

const emptyPreset = (): Omit<MappingPreset, 'id'> => ({
  name:              '',
  sourceTable:       '',
  targetEntity:      'customer',
  columnMappings:    [{ sourceColumn: '', targetField: '', transform: 'none' }],
  filterSql:         '',
  incrementalColumn: '',
})

/** Normalise a column/field name for fuzzy matching: lowercase, strip underscores/spaces/leading _ */
function normalise(s: string) {
  return s.toLowerCase().replace(/^_+/, '').replace(/[_\s]/g, '')
}

/** Best default transform for a given SQL type */
function defaultTransform(sqlType: string): TransformType {
  const t = sqlType.toLowerCase()
  if (['int', 'bigint', 'smallint', 'tinyint', 'decimal', 'numeric', 'float', 'money'].some(x => t.includes(x))) return 'number'
  if (['date', 'datetime', 'timestamp', 'time'].some(x => t.includes(x))) return 'date_iso'
  if (['bit'].some(x => t.includes(x))) return 'boolean_yn'
  return 'trim'
}

/** SQL type category icon */
function TypeIcon({ sqlType }: { sqlType: string }) {
  const t = sqlType.toLowerCase()
  if (['int', 'bigint', 'decimal', 'numeric', 'float', 'money'].some(x => t.includes(x)))
    return <Hash size={10} className="text-blue-400 shrink-0" />
  if (['date', 'datetime', 'timestamp', 'time'].some(x => t.includes(x)))
    return <Calendar size={10} className="text-amber-400 shrink-0" />
  if (['bit'].some(x => t.includes(x)))
    return <ToggleLeft size={10} className="text-purple-400 shrink-0" />
  return <Type size={10} className="text-emerald-400 shrink-0" />
}

// ─── Sub-component: coverage chips ────────────────────────────────────────────

function CoverageChips({
  targetEntity,
  mappings,
}: {
  targetEntity: TargetEntity
  mappings: ColumnMapping[]
}) {
  const fields   = TARGET_FIELDS[targetEntity] ?? []
  const required = fields.filter(f => f.required)
  const mapped   = new Set(mappings.filter(m => m.targetField).map(m => m.targetField))

  if (!required.length) return null

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      <span className="text-xs text-[#8892a4] ml-1">שדות חובה:</span>
      {required.map(f => {
        const ok = mapped.has(f.key)
        return (
          <span
            key={f.key}
            className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${
              ok
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}
          >
            {ok
              ? <CheckCircle2 size={9} />
              : <AlertCircle  size={9} />
            }
            {f.label}
          </span>
        )
      })}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MappingEditor({
  initialPresets,
  reloadKey = 0,
}: {
  initialPresets: MappingPreset[]
  reloadKey?:     number
}) {
  const [presets,        setPresets]        = useState<MappingPreset[]>(initialPresets)
  const [selected,       setSelected]       = useState<MappingPreset | null>(null)
  const [draft,          setDraft]          = useState<Omit<MappingPreset, 'id'>>(emptyPreset())
  const [saving,         setSaving]         = useState(false)
  const [deleting,       setDeleting]       = useState<string | null>(null)
  const [tables,         setTables]         = useState<SourceTable[] | null>(null)
  const [loadingTables,  setLoadingTables]  = useState(false)
  const [tablesError,    setTablesError]    = useState<string | null>(null)
  const [preview,        setPreview]        = useState<Record<string, unknown>[] | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [msg,            setMsg]            = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [autoMapped,     setAutoMapped]     = useState(0)   // how many auto-mappings last run found

  // ── Load tables ──────────────────────────────────────────────────────────

  const loadTables = useCallback(async () => {
    setLoadingTables(true)
    setTablesError(null)
    try {
      const res  = await fetch('/api/migration/tables')
      const json = await res.json()
      if (!res.ok || json.error) {
        setTablesError(json.error ?? `שגיאת שרת ${res.status}`)
        setTables([])
      } else {
        setTables(json.tables ?? [])
        if ((json.tables ?? []).length === 0) {
          setTablesError('לא נמצאו טבלאות — ייתכן שהמשתמש חסר הרשאות או שהמסד ריק')
        }
      }
    } catch (e) {
      setTablesError(e instanceof Error ? e.message : 'שגיאת רשת')
      setTables([])
    } finally {
      setLoadingTables(false)
    }
  }, [])

  // Run on mount; also re-run when the parent bumps reloadKey (e.g. from DebugPanel)
  useEffect(() => { loadTables() }, [loadTables, reloadKey])

  // ── Derived: table info for the currently selected source table ──────────

  const tableInfo: SourceTable | undefined = (tables ?? []).find(
    t => `${t.schema}.${t.name}` === draft.sourceTable,
  )

  // ── Draft helpers ─────────────────────────────────────────────────────────

  function startNew() {
    setSelected(null)
    setDraft(emptyPreset())
    setPreview(null)
    setMsg(null)
    setAutoMapped(0)
  }

  function selectPreset(p: MappingPreset) {
    setSelected(p)
    setDraft({
      name:              p.name,
      sourceTable:       p.sourceTable,
      targetEntity:      p.targetEntity,
      columnMappings:    p.columnMappings,
      filterSql:         p.filterSql         ?? '',
      incrementalColumn: p.incrementalColumn ?? '',
    })
    setPreview(null)
    setMsg(null)
    setAutoMapped(0)
  }

  /** Change target entity — ask before wiping existing mappings */
  function changeEntity(entity: TargetEntity) {
    if (draft.columnMappings.some(m => m.targetField)) {
      if (!confirm('שינוי ישות יעד ימחק את המיפויים הקיימים. להמשיך?')) return
    }
    setDraft(d => ({ ...d, targetEntity: entity, columnMappings: [{ sourceColumn: '', targetField: '', transform: 'none' }] }))
    setAutoMapped(0)
  }

  /** Change source table — clear column mappings (field keys from old table are useless) */
  function changeSourceTable(value: string) {
    if (draft.columnMappings.some(m => m.sourceColumn) && value !== draft.sourceTable) {
      if (!confirm('שינוי טבלת מקור ימחק את המיפויים הקיימים. להמשיך?')) return
    }
    setDraft(d => ({ ...d, sourceTable: value, columnMappings: [{ sourceColumn: '', targetField: '', transform: 'none' }] }))
    setPreview(null)
    setAutoMapped(0)
  }

  function updateMapping(idx: number, field: keyof ColumnMapping, value: string) {
    setDraft(d => {
      const mappings = [...d.columnMappings]
      mappings[idx]  = { ...mappings[idx], [field]: value } as ColumnMapping
      // Auto-pick a smart transform when user selects a source column
      if (field === 'sourceColumn' && tableInfo) {
        const col = tableInfo.columns.find(c => c.name === value)
        if (col && (!mappings[idx].transform || mappings[idx].transform === 'none')) {
          mappings[idx].transform = defaultTransform(col.sqlType)
        }
      }
      return { ...d, columnMappings: mappings }
    })
  }

  function addMapping() {
    setDraft(d => ({
      ...d,
      columnMappings: [...d.columnMappings, { sourceColumn: '', targetField: '', transform: 'none' }],
    }))
  }

  function removeMapping(idx: number) {
    setDraft(d => ({
      ...d,
      columnMappings: d.columnMappings.filter((_, i) => i !== idx),
    }))
  }

  // ── Auto-map ──────────────────────────────────────────────────────────────

  const handleAutoMap = useCallback(() => {
    if (!tableInfo) return

    const targetFields = TARGET_FIELDS[draft.targetEntity] ?? []
    const newMappings: ColumnMapping[] = []

    for (const field of targetFields) {
      const normField = normalise(field.key)
      const match = tableInfo.columns.find(col => {
        const normCol = normalise(col.name)
        return (
          normCol === normField ||
          normCol.endsWith(normField) ||
          normField.endsWith(normCol) ||
          normCol.includes(normField) ||
          normField.includes(normCol)
        )
      })
      if (match) {
        newMappings.push({
          sourceColumn: match.name,
          targetField:  field.key,
          transform:    defaultTransform(match.sqlType),
        })
      }
    }

    setAutoMapped(newMappings.length)
    if (newMappings.length) {
      setDraft(d => ({ ...d, columnMappings: newMappings }))
    }
  }, [tableInfo, draft.targetEntity])

  // ── Preview ────────────────────────────────────────────────────────────────

  async function handlePreview() {
    if (!draft.sourceTable) return
    const [schema, table] = draft.sourceTable.includes('.')
      ? draft.sourceTable.split('.', 2)
      : ['dbo', draft.sourceTable]
    setLoadingPreview(true)
    setPreview(null)
    try {
      const res  = await fetch(
        `/api/migration/preview?schema=${schema}&table=${table}&limit=5&filter=${encodeURIComponent(draft.filterSql ?? '')}`,
      )
      const json = await res.json()
      setPreview(json.rows ?? [])
    } catch {
      setPreview([])
    } finally {
      setLoadingPreview(false)
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!draft.name || !draft.sourceTable || !draft.targetEntity) {
      setMsg({ type: 'err', text: 'יש למלא שם, טבלת מקור וישות יעד' })
      return
    }
    const mappings = draft.columnMappings.filter(m => m.sourceColumn && m.targetField)
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
        setPresets(ps => ps.map(p => p.id === saved.id ? saved : p))
      } else {
        setPresets(ps => [...ps, saved])
      }
      setSelected(saved)
      setMsg({ type: 'ok', text: 'הפריסט נשמר בהצלחה' })
    } catch {
      setMsg({ type: 'err', text: 'שגיאת שמירה' })
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    if (!confirm('למחוק פריסט זה?')) return
    setDeleting(id)
    await fetch(`/api/migration/presets/${id}`, { method: 'DELETE' })
    setPresets(ps => ps.filter(p => p.id !== id))
    if (selected?.id === id) { setSelected(null); setDraft(emptyPreset()) }
    setDeleting(null)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const targetFields = TARGET_FIELDS[draft.targetEntity] ?? []
  const mappedKeys   = new Set(draft.columnMappings.filter(m => m.targetField).map(m => m.targetField))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

      {/* ── Sidebar: preset list ─────────────────────────────────────── */}
      <div className="lg:col-span-1 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-[#8892a4] uppercase tracking-wider">פריסטים</h3>
          <button onClick={startNew} className="flex items-center gap-1 text-xs text-[#6366f1] hover:underline">
            <Plus size={12} />חדש
          </button>
        </div>
        <div className="space-y-1">
          {presets.map(p => (
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
                onClick={e => { e.stopPropagation(); handleDelete(p.id) }}
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

      {/* ── Main editor ──────────────────────────────────────────────── */}
      <div className="lg:col-span-3 space-y-5">

        {/* Basic info */}
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">{selected ? 'ערוך פריסט' : 'פריסט חדש'}</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Name */}
            <div>
              <label className={LABEL}>שם פריסט *</label>
              <input
                className={INPUT}
                value={draft.name}
                onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                placeholder="לקוחות Hanesher"
              />
            </div>

            {/* Target entity */}
            <div>
              <label className={LABEL}>ישות יעד *</label>
              <select
                className={SELECT}
                value={draft.targetEntity}
                onChange={e => changeEntity(e.target.value as TargetEntity)}
              >
                {ENTITIES.map(e => <option key={e} value={e}>{ENTITY_LABELS[e]}</option>)}
              </select>
            </div>

            {/* Source table */}
            <div>
              <label className={LABEL}>טבלת מקור *</label>
              {loadingTables ? (
                <div className="flex items-center gap-2 text-xs text-[#8892a4] py-2">
                  <Loader2 size={12} className="animate-spin" />טוען טבלאות...
                </div>
              ) : tablesError ? (
                <div className="space-y-1.5">
                  <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-300">
                    <AlertCircle size={12} className="mt-0.5 shrink-0" />
                    <span className="font-mono break-all">{tablesError}</span>
                  </div>
                  <button
                    onClick={loadTables}
                    className="text-xs text-[#6366f1] hover:underline"
                  >
                    נסה שוב
                  </button>
                </div>
              ) : (
                <select
                  className={SELECT}
                  value={draft.sourceTable}
                  onChange={e => changeSourceTable(e.target.value)}
                >
                  <option value="">בחר טבלה...</option>
                  {(tables ?? []).map(t => (
                    <option key={`${t.schema}.${t.name}`} value={`${t.schema}.${t.name}`}>
                      {t.schema}.{t.name}{t.rowCount != null ? ` (${t.rowCount.toLocaleString()})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Incremental column */}
            <div>
              <label className={LABEL}>עמודת עדכון (sync מצטבר)</label>
              <input
                className={INPUT}
                value={draft.incrementalColumn ?? ''}
                onChange={e => setDraft(d => ({ ...d, incrementalColumn: e.target.value }))}
                placeholder="UpdatedAt"
              />
            </div>

            {/* Filter SQL */}
            <div className="sm:col-span-2">
              <label className={LABEL}>סינון SQL — WHERE (אופציונלי)</label>
              <input
                className={INPUT}
                value={draft.filterSql ?? ''}
                onChange={e => setDraft(d => ({ ...d, filterSql: e.target.value }))}
                placeholder="IsActive = 1 AND CreatedDate > '2020-01-01'"
              />
            </div>
          </div>

          {/* Preview + coverage */}
          <div className="flex flex-wrap items-center gap-4">
            {draft.sourceTable && (
              <button
                onClick={handlePreview}
                disabled={loadingPreview}
                className="flex items-center gap-1.5 text-xs text-[#6366f1] hover:underline disabled:opacity-40"
              >
                {loadingPreview ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
                תצוגה מקדימה (5 שורות)
              </button>
            )}
          </div>

          {/* Row preview table */}
          {preview && preview.length > 0 && (
            <div className="overflow-x-auto border border-[#2e3147] rounded-lg">
              <table className="min-w-full text-xs">
                <thead className="bg-[#252836]">
                  <tr>
                    {Object.keys(preview[0]).map(col => (
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

        {/* ── Column mappings ─────────────────────────────────────────── */}
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#2e3147] flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-sm font-semibold text-white">מיפוי עמודות</h3>
            <div className="flex items-center gap-3">
              {/* Auto-map button — only when table is selected */}
              {tableInfo && (
                <button
                  onClick={handleAutoMap}
                  className="flex items-center gap-1.5 text-xs bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 px-3 py-1.5 rounded-lg transition-colors"
                  title="מנסה לזהות אוטומטית מיפויים לפי שם עמודה"
                >
                  <Wand2 size={12} />
                  מיפוי אוטומטי
                </button>
              )}
              <button
                onClick={addMapping}
                className="flex items-center gap-1 text-xs text-[#6366f1] hover:underline"
              >
                <Plus size={12} />הוסף שורה
              </button>
            </div>
          </div>

          {/* Auto-map result banner */}
          {autoMapped > 0 && (
            <div className="px-5 py-2.5 bg-amber-500/5 border-b border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
              <Wand2 size={12} />
              זוהו {autoMapped} מיפויים אוטומטיים — בדוק ושמור
            </div>
          )}

          {/* Table header */}
          <div className="grid grid-cols-12 gap-2 px-5 py-2 bg-[#252836] text-xs font-medium text-[#8892a4] uppercase tracking-wide">
            <span className="col-span-4">עמודת מקור</span>
            <span className="col-span-4">שדה יעד</span>
            <span className="col-span-3">טרנספורם</span>
            <span className="col-span-1"></span>
          </div>

          <div className="divide-y divide-[#2e3147]">
            {draft.columnMappings.map((m, idx) => {
              const colInfo: SourceColumn | undefined = tableInfo?.columns.find(c => c.name === m.sourceColumn)
              const fieldDef = targetFields.find(f => f.key === m.targetField)
              const isRequired = fieldDef?.required ?? false
              const rowOk = !isRequired || (m.sourceColumn && m.targetField)

              return (
                <div
                  key={idx}
                  className={`grid grid-cols-12 gap-2 px-5 py-2.5 items-center ${
                    !rowOk ? 'bg-red-500/5' : ''
                  }`}
                >
                  {/* Source column */}
                  <div className="col-span-4">
                    {tableInfo ? (
                      <div className="relative">
                        <select
                          className={`${SELECT} ${colInfo ? 'pe-8' : ''}`}
                          value={m.sourceColumn}
                          onChange={e => updateMapping(idx, 'sourceColumn', e.target.value)}
                        >
                          <option value="">בחר עמודה...</option>
                          {tableInfo.columns.map((c: SourceColumn) => (
                            <option key={c.name} value={c.name}>
                              {c.name} ({c.sqlType}{c.maxLen ? `·${c.maxLen}` : ''}{c.nullable ? '' : ' !'})
                            </option>
                          ))}
                        </select>
                        {colInfo && (
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">
                            <TypeIcon sqlType={colInfo.sqlType} />
                          </span>
                        )}
                      </div>
                    ) : (
                      <input
                        className={INPUT}
                        value={m.sourceColumn}
                        onChange={e => updateMapping(idx, 'sourceColumn', e.target.value)}
                        placeholder="column_name"
                      />
                    )}
                  </div>

                  {/* Target field */}
                  <div className="col-span-4">
                    <select
                      className={`${SELECT} ${
                        isRequired && !m.targetField
                          ? 'border-red-500/50 focus:border-red-400'
                          : m.targetField && mappedKeys.has(m.targetField)
                          ? 'border-emerald-500/30'
                          : ''
                      }`}
                      value={m.targetField}
                      onChange={e => updateMapping(idx, 'targetField', e.target.value)}
                    >
                      <option value="">בחר שדה...</option>
                      {/* Required group */}
                      <optgroup label="שדות חובה">
                        {targetFields.filter(f => f.required).map(f => (
                          <option key={f.key} value={f.key}>{f.label} *</option>
                        ))}
                      </optgroup>
                      {/* Optional group */}
                      <optgroup label="שדות אופציונליים">
                        {targetFields.filter(f => !f.required && f.type !== 'lookup').map(f => (
                          <option key={f.key} value={f.key}>{f.label}</option>
                        ))}
                      </optgroup>
                      {/* Lookup group */}
                      {targetFields.some(f => f.type === 'lookup') && (
                        <optgroup label="🔗 שדות קישור (lookup)">
                          {targetFields.filter(f => f.type === 'lookup').map(f => (
                            <option key={f.key} value={f.key}>{f.label}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>

                  {/* Transform */}
                  <div className="col-span-3">
                    <select
                      className={SELECT}
                      value={m.transform ?? 'none'}
                      onChange={e => updateMapping(idx, 'transform', e.target.value)}
                    >
                      {TRANSFORMS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>

                  {/* Remove */}
                  <div className="col-span-1 flex justify-end">
                    <button
                      onClick={() => removeMapping(idx)}
                      className="text-[#8892a4] hover:text-red-400 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer: coverage + legend */}
          <div className="px-5 py-3 bg-[#0d1117] border-t border-[#2e3147] space-y-2">
            <CoverageChips targetEntity={draft.targetEntity} mappings={draft.columnMappings} />
            <p className="text-xs text-[#8892a4]">
              * = שדה חובה · 🔗 = שדה קישור (lookup) ·{' '}
              <span className="inline-flex items-center gap-0.5"><Hash size={10} className="text-blue-400" /> מספר</span>{' '}
              <span className="inline-flex items-center gap-0.5 mx-1"><Calendar size={10} className="text-amber-400" /> תאריך</span>{' '}
              <span className="inline-flex items-center gap-0.5"><Type size={10} className="text-emerald-400" /> טקסט</span>{' '}
              <span className="inline-flex items-center gap-0.5 mx-1"><ToggleLeft size={10} className="text-purple-400" /> בוליאן</span>
            </p>
          </div>
        </div>

        {/* Lookup-field hint */}
        {targetFields.some(f => f.type === 'lookup') && (
          <div className="flex items-start gap-2 bg-[#1a1d27] border border-[#2e3147] rounded-xl px-4 py-3 text-xs text-[#8892a4]">
            <Info size={13} className="text-amber-400 shrink-0 mt-0.5" />
            <span>
              שדות קישור (lookup) — ערך העמודה ישמש לחיפוש ישות קיימת ב-GarageOS.
              לדוגמה: <code className="text-amber-300">_customer_phone</code> יחפש לקוח לפי מספר טלפון.
              הישות חייבת להיות קיימת לפני הייבוא.
            </span>
          </div>
        )}

        {/* Save / status */}
        {msg && (
          <div className={`text-sm rounded-lg px-4 py-2.5 border ${
            msg.type === 'ok'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}>
            {msg.text}
          </div>
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
