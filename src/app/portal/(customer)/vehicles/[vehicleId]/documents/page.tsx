'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter }         from 'next/navigation'
import Link                             from 'next/link'
import { ChevronRight, Upload, Trash2, Download, CheckCircle, Clock, AlertCircle, FileText, Eye, X } from 'lucide-react'

// ─── Constants ─────────────────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<string, string> = {
  VEHICLE_LICENSE:         'רישיון רכב',
  MANDATORY_INSURANCE:     'ביטוח חובה',
  DRIVER_LICENSE:          'רישיון נהיגה של בעל הרכב',
  COMPREHENSIVE_INSURANCE: 'ביטוח מקיף/צד ג׳',
  POWER_OF_ATTORNEY:       'ייפוי כוח לטסט',
  OTHER:                   'מסמך אחר',
}

const DOC_TYPES_REQUIRED = ['VEHICLE_LICENSE', 'MANDATORY_INSURANCE', 'DRIVER_LICENSE']
const DOC_TYPES_OPTIONAL = ['COMPREHENSIVE_INSURANCE', 'POWER_OF_ATTORNEY', 'OTHER']

// ─── Types ──────────────────────────────────────────────────────────────────

interface VehicleDoc {
  id:               string
  documentType:     string
  originalFileName: string
  mimeType:         string
  fileSize:         number
  issueDate:        string | null
  expiryDate:       string | null
  extractedData:    { issueDate?: string | null; expiryDate?: string | null } | null
  extractionStatus: string
  verifiedAt:       string | null
  verificationNote: string | null
  createdAt:        string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function expiryStatus(expiryDate: string | null): 'none' | 'ok' | 'soon' | 'expired' {
  if (!expiryDate) return 'none'
  const diff = new Date(expiryDate).getTime() - Date.now()
  const days = diff / (1000 * 60 * 60 * 24)
  if (days < 0) return 'expired'
  if (days < 30) return 'soon'
  return 'ok'
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: 'none' | 'ok' | 'soon' | 'expired' | 'missing' }) {
  const colors: Record<string, string> = {
    none:    'bg-slate-300',
    missing: 'bg-slate-300',
    ok:      'bg-emerald-500',
    soon:    'bg-amber-400',
    expired: 'bg-red-500',
  }
  return <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${colors[status] ?? 'bg-slate-300'}`} />
}

// ─── Upload modal ─────────────────────────────────────────────────────────────

function UploadModal({
  vehicleId,
  preselectedType,
  onClose,
  onUploaded,
}: {
  vehicleId:       string
  preselectedType?: string
  onClose:         () => void
  onUploaded:      (doc: VehicleDoc) => void
}) {
  const [docType,    setDocType]    = useState(preselectedType ?? '')
  const [file,       setFile]       = useState<File | null>(null)
  const [issueDate,  setIssueDate]  = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [uploading,  setUploading]  = useState(false)
  const [error,      setError]      = useState('')

  async function upload() {
    if (!docType || !file) { setError('נא לבחור סוג מסמך וקובץ'); return }
    setUploading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file',         file)
      fd.append('documentType', docType)
      if (issueDate)  fd.append('issueDate',  issueDate)
      if (expiryDate) fd.append('expiryDate', expiryDate)

      const res = await fetch(`/api/portal/vehicles/${vehicleId}/documents`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'שגיאה בהעלאה'); return }
      onUploaded(data.document)
      onClose()
    } catch {
      setError('שגיאה בהעלאה. נסה שוב.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-black text-slate-800">העלאת מסמך</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Doc type */}
          <div>
            <label className="block text-sm font-bold text-slate-600 mb-1.5">סוג מסמך</label>
            <select
              value={docType}
              onChange={e => setDocType(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <option value="">— בחר סוג —</option>
              <optgroup label="חובה">
                {DOC_TYPES_REQUIRED.map(t => <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>)}
              </optgroup>
              <optgroup label="אופציונלי">
                {DOC_TYPES_OPTIONAL.map(t => <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>)}
              </optgroup>
            </select>
          </div>

          {/* File picker */}
          <div>
            <label className="block text-sm font-bold text-slate-600 mb-1.5">קובץ (JPG, PNG, PDF)</label>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-6 cursor-pointer hover:border-indigo-300 transition-colors">
              {file ? (
                <p className="text-sm font-semibold text-indigo-600 text-center break-all">{file.name}</p>
              ) : (
                <>
                  <Upload size={28} className="text-slate-300 mb-2" />
                  <p className="text-sm text-slate-500 text-center">צלם, גלריה, או בחר קובץ</p>
                  <p className="text-xs text-slate-400 mt-1">JPG · PNG · PDF · עד 10 MB</p>
                </>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                capture="environment"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </label>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">תאריך הנפקה</label>
              <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">תאריך תפוגה</label>
              <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

          <button
            onClick={upload}
            disabled={uploading}
            className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl disabled:opacity-50"
          >
            {uploading ? 'מעלה…' : 'העלה מסמך'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Extraction review ────────────────────────────────────────────────────────

function ExtractionReview({
  doc,
  vehicleId,
  onConfirmed,
}: {
  doc:        VehicleDoc
  vehicleId:  string
  onConfirmed: (updated: VehicleDoc) => void
}) {
  const [issueDate,  setIssueDate]  = useState(doc.extractedData?.issueDate  ?? doc.issueDate  ?? '')
  const [expiryDate, setExpiryDate] = useState(doc.extractedData?.expiryDate ?? doc.expiryDate ?? '')
  const [saving,     setSaving]     = useState(false)

  async function confirm() {
    setSaving(true)
    const res = await fetch(`/api/portal/vehicles/${vehicleId}/documents/${doc.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ issueDate: issueDate || null, expiryDate: expiryDate || null, extractionStatus: 'COMPLETED' }),
    })
    if (res.ok) {
      const data = await res.json()
      onConfirmed(data.document)
    }
    setSaving(false)
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mt-2">
      <p className="text-sm font-bold text-amber-800 mb-3">
        {doc.extractionStatus === 'COMPLETED' ? '✨ חולצו תאריכים אוטומטית — אנא אשר:' : 'נא למלא את התאריכים:'}
      </p>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs font-bold text-amber-700 mb-1">תאריך הנפקה</label>
          <input type="date" value={issueDate?.slice(0, 10) ?? ''} onChange={e => setIssueDate(e.target.value)}
            className="w-full border border-amber-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300" />
        </div>
        <div>
          <label className="block text-xs font-bold text-amber-700 mb-1">תאריך תפוגה</label>
          <input type="date" value={expiryDate?.slice(0, 10) ?? ''} onChange={e => setExpiryDate(e.target.value)}
            className="w-full border border-amber-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300" />
        </div>
      </div>
      <button onClick={confirm} disabled={saving}
        className="w-full bg-amber-500 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50">
        {saving ? 'שומר…' : 'אשר ושמור'}
      </button>
    </div>
  )
}

// ─── Document card ────────────────────────────────────────────────────────────

function DocCard({
  doc,
  vehicleId,
  onDeleted,
  onUpdated,
}: {
  doc:       VehicleDoc
  vehicleId: string
  onDeleted: (id: string) => void
  onUpdated: (doc: VehicleDoc) => void
}) {
  const [deleting,      setDeleting]      = useState(false)
  const [showExtraction, setShowExtraction] = useState(
    (doc.extractionStatus === 'COMPLETED' || doc.extractionStatus === 'FAILED' || doc.extractionStatus === 'MANUAL') &&
    (!doc.issueDate && !doc.expiryDate)
  )
  const status = expiryStatus(doc.expiryDate)

  async function del() {
    if (!confirm('האם למחוק מסמך זה?')) return
    setDeleting(true)
    await fetch(`/api/portal/vehicles/${vehicleId}/documents/${doc.id}`, { method: 'DELETE' })
    onDeleted(doc.id)
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
          <FileText size={20} className="text-indigo-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-slate-800 text-sm">{DOC_TYPE_LABELS[doc.documentType] ?? doc.documentType}</p>
            {doc.verifiedAt && (
              <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">✓ אומת</span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5 truncate">{doc.originalFileName} · {fmtSize(doc.fileSize)}</p>

          {(doc.issueDate || doc.expiryDate) && (
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {doc.issueDate && (
                <span className="text-xs text-slate-500">הנפקה: {fmtDate(doc.issueDate)}</span>
              )}
              {doc.expiryDate && (
                <span className={`flex items-center gap-1 text-xs font-semibold ${
                  status === 'expired' ? 'text-red-600' : status === 'soon' ? 'text-amber-600' : 'text-emerald-600'
                }`}>
                  <StatusDot status={status} />
                  תפוגה: {fmtDate(doc.expiryDate)}
                  {status === 'expired' && ' (פג תוקף)'}
                  {status === 'soon'    && ' (עומד לפוג)'}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <a
            href={`/api/portal/vehicles/${vehicleId}/documents/${doc.id}/file`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors"
          >
            <Eye size={16} />
          </a>
          <a
            href={`/api/portal/vehicles/${vehicleId}/documents/${doc.id}/file`}
            download={doc.originalFileName}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors"
          >
            <Download size={16} />
          </a>
          <button
            onClick={del}
            disabled={deleting}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-40"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Extraction / date confirmation */}
      {showExtraction && (
        <ExtractionReview
          doc={doc}
          vehicleId={vehicleId}
          onConfirmed={updated => { onUpdated(updated); setShowExtraction(false) }}
        />
      )}

      {/* CTA to fill dates if still empty */}
      {!showExtraction && !doc.issueDate && !doc.expiryDate && (
        <button
          onClick={() => setShowExtraction(true)}
          className="mt-2 w-full text-xs text-indigo-600 font-bold py-2 border border-indigo-100 rounded-xl hover:bg-indigo-50 transition-colors"
        >
          + הוסף תאריכים
        </button>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function VehicleDocumentsPage() {
  const params    = useParams<{ vehicleId: string }>()
  const vehicleId = params.vehicleId

  const [docs,        setDocs]        = useState<VehicleDoc[]>([])
  const [loading,     setLoading]     = useState(true)
  const [showUpload,  setShowUpload]  = useState(false)
  const [uploadType,  setUploadType]  = useState<string | undefined>()

  useEffect(() => {
    fetch(`/api/portal/vehicles/${vehicleId}/documents`)
      .then(r => r.json())
      .then(d => setDocs(d.documents ?? []))
      .finally(() => setLoading(false))
  }, [vehicleId])

  function docForType(type: string): VehicleDoc | undefined {
    return docs.find(d => d.documentType === type)
  }

  function openUpload(type?: string) {
    setUploadType(type)
    setShowUpload(true)
  }

  const allTypes = [...DOC_TYPES_REQUIRED, ...DOC_TYPES_OPTIONAL]
  const docsMap = Object.fromEntries(allTypes.map(t => [t, docForType(t)]))

  const requiredMissing = DOC_TYPES_REQUIRED.filter(t => !docsMap[t]).length

  return (
    <div className="max-w-lg mx-auto pb-10" dir="rtl">

      {/* Hero */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-800 px-5 pt-5 pb-10">
        <Link href={`/portal/vehicles/${vehicleId}`} className="flex items-center gap-1 text-indigo-300 text-sm mb-5">
          <ChevronRight size={16} /> חזרה לרכב
        </Link>
        <p className="text-indigo-400 text-[10px] font-bold uppercase tracking-widest mb-1">מסמכי הרכב</p>
        <h1 className="text-2xl font-black text-white leading-tight">ניהול מסמכים</h1>
        {!loading && requiredMissing > 0 && (
          <p className="text-amber-300 text-sm mt-2">{requiredMissing} מסמכים חובה חסרים</p>
        )}
      </div>

      <div className="px-4 -mt-5 space-y-4">

        {/* Summary row */}
        {!loading && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-4 flex gap-4">
            <div className="text-center flex-1">
              <p className="text-2xl font-black text-slate-800">{docs.length}</p>
              <p className="text-xs text-slate-400">הועלו</p>
            </div>
            <div className="text-center flex-1">
              <p className="text-2xl font-black text-emerald-600">
                {docs.filter(d => expiryStatus(d.expiryDate) === 'ok').length}
              </p>
              <p className="text-xs text-slate-400">בתוקף</p>
            </div>
            <div className="text-center flex-1">
              <p className="text-2xl font-black text-red-500">
                {docs.filter(d => expiryStatus(d.expiryDate) === 'expired').length}
              </p>
              <p className="text-xs text-slate-400">פג תוקף</p>
            </div>
          </div>
        )}

        {loading && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-10 text-center">
            <p className="text-slate-400 text-sm">טוען מסמכים…</p>
          </div>
        )}

        {/* Required docs */}
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">מסמכים חובה</p>
          <div className="space-y-2">
            {DOC_TYPES_REQUIRED.map(type => {
              const doc = docsMap[type]
              if (doc) {
                return (
                  <DocCard
                    key={doc.id}
                    doc={doc}
                    vehicleId={vehicleId}
                    onDeleted={id => setDocs(ds => ds.filter(d => d.id !== id))}
                    onUpdated={u  => setDocs(ds => ds.map(d => d.id === u.id ? u : d))}
                  />
                )
              }
              return (
                <button
                  key={type}
                  onClick={() => openUpload(type)}
                  className="w-full flex items-center gap-3 bg-white border-2 border-dashed border-slate-200 rounded-2xl p-4 text-right hover:border-indigo-300 transition-colors"
                >
                  <StatusDot status="missing" />
                  <span className="flex-1 font-semibold text-slate-500 text-sm">{DOC_TYPE_LABELS[type]}</span>
                  <span className="text-indigo-600 text-xs font-bold whitespace-nowrap">העלה ›</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Optional docs */}
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">מסמכים אופציונליים</p>
          <div className="space-y-2">
            {DOC_TYPES_OPTIONAL.map(type => {
              const doc = docsMap[type]
              if (doc) {
                return (
                  <DocCard
                    key={doc.id}
                    doc={doc}
                    vehicleId={vehicleId}
                    onDeleted={id => setDocs(ds => ds.filter(d => d.id !== id))}
                    onUpdated={u  => setDocs(ds => ds.map(d => d.id === u.id ? u : d))}
                  />
                )
              }
              return (
                <button
                  key={type}
                  onClick={() => openUpload(type)}
                  className="w-full flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl p-4 text-right hover:border-indigo-200 transition-colors"
                >
                  <StatusDot status="missing" />
                  <span className="flex-1 font-semibold text-slate-400 text-sm">{DOC_TYPE_LABELS[type]}</span>
                  <span className="text-indigo-400 text-xs font-bold whitespace-nowrap">העלה ›</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* General upload button */}
        <button
          onClick={() => openUpload(undefined)}
          className="w-full flex items-center gap-3 bg-indigo-600 text-white px-5 py-4 rounded-2xl shadow-lg shadow-indigo-200/50"
        >
          <Upload size={20} />
          <span className="font-bold">העלה מסמך נוסף</span>
        </button>

        {/* Privacy notice */}
        <p className="text-center text-xs text-slate-400 pb-2">
          המסמכים שלך מאוחסנים בצורה מאובטחת ופרטית.
        </p>
      </div>

      {showUpload && (
        <UploadModal
          vehicleId={vehicleId}
          preselectedType={uploadType}
          onClose={() => setShowUpload(false)}
          onUploaded={doc => setDocs(ds => [doc, ...ds.filter(d => d.documentType !== doc.documentType)])}
        />
      )}
    </div>
  )
}
