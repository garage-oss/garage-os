'use client'

import { useState, useRef } from 'react'
import { Upload, X, CheckCircle, AlertCircle, Loader2, ImageIcon, Video } from 'lucide-react'

type MediaPhase = 'before' | 'during' | 'after' | 'general'
type EntityType = 'workOrder' | 'vehicle' | 'quote'

interface Props {
  entityType: EntityType
  entityId: string
  onUpload: () => void
}

interface QueueFile {
  file: File
  phase: MediaPhase
  preview?: string
  status: 'uploading' | 'done' | 'error'
  error?: string
}

const PHASES: {
  id: MediaPhase
  label: string
  short: string
  activeClass: string
}[] = [
  {
    id:          'before',
    label:       'לפני תיקון',
    short:       'לפני',
    activeClass: 'bg-blue-500/15 border-blue-500/40 text-blue-400',
  },
  {
    id:          'during',
    label:       'במהלך תיקון',
    short:       'במהלך',
    activeClass: 'bg-amber-500/15 border-amber-500/40 text-amber-400',
  },
  {
    id:          'after',
    label:       'אחרי תיקון',
    short:       'אחרי',
    activeClass: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400',
  },
  {
    id:          'general',
    label:       'כללי',
    short:       'כללי',
    activeClass: 'bg-[#252836] border-[#4e5470] text-[#e2e8f0]',
  },
]

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm', 'video/quicktime',
]
const MAX_MB = 20

export function FileUploader({ entityType, entityId, onUpload }: Props) {
  const [phase,      setPhase]      = useState<MediaPhase>('before')
  const [queue,      setQueue]      = useState<QueueFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function processFiles(raw: File[]) {
    const currentPhase = phase  // capture at call time

    const items: QueueFile[] = raw.map((file): QueueFile => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return { file, phase: currentPhase, status: 'error', error: 'סוג לא נתמך' }
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        return { file, phase: currentPhase, status: 'error', error: `מקס׳ ${MAX_MB}MB` }
      }
      return {
        file, phase: currentPhase, status: 'uploading',
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      }
    })

    setQueue((prev) => [...prev, ...items])

    for (const item of items.filter((i) => i.status === 'uploading')) {
      const fd = new FormData()
      fd.append('file', item.file)
      fd.append('entityType', entityType)
      fd.append('entityId', entityId)
      if (item.phase !== 'general') fd.append('phase', item.phase)

      try {
        const res  = await fetch('/api/upload', { method: 'POST', body: fd })
        const data = await res.json()
        setQueue((prev) =>
          prev.map((q) =>
            q.file === item.file
              ? { ...q, status: data.error ? ('error' as const) : ('done' as const), error: data.error }
              : q
          )
        )
        if (!data.error) onUpload()
      } catch {
        setQueue((prev) =>
          prev.map((q) =>
            q.file === item.file ? { ...q, status: 'error' as const, error: 'שגיאת רשת' } : q
          )
        )
      }
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    processFiles(Array.from(e.dataTransfer.files))
  }

  const hasDone  = queue.some((q) => q.status === 'done')
  const hasItems = queue.length > 0

  return (
    <div className="bg-[#1a1d27] border border-[#2e3147] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#2e3147]">
        <div className="flex items-center gap-2">
          <Upload size={13} className="text-[#6366f1]" />
          <span className="text-[13px] font-semibold text-[#e2e8f0]">העלאת מדיה</span>
        </div>
        {hasItems && (
          <button
            onClick={() => setQueue([])}
            className="text-[11px] text-[#8892a4] hover:text-[#e2e8f0] transition-colors"
          >
            נקה רשימה
          </button>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Phase selector */}
        <div>
          <p className="text-[10px] font-bold text-[#8892a4] uppercase tracking-widest mb-2.5">
            שלב תיקון
          </p>
          <div className="flex flex-wrap gap-2">
            {PHASES.map((p) => (
              <button
                key={p.id}
                onClick={() => setPhase(p.id)}
                className={[
                  'px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-all',
                  phase === p.id
                    ? p.activeClass
                    : 'bg-transparent border-[#2e3147] text-[#8892a4] hover:border-[#4e5470] hover:text-[#e2e8f0]',
                ].join(' ')}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Drop zone */}
        <div
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => inputRef.current?.click()}
          className={[
            'relative border-2 border-dashed rounded-2xl py-10 text-center cursor-pointer transition-all select-none',
            isDragging
              ? 'border-[#6366f1] bg-[#6366f1]/5 scale-[1.01]'
              : 'border-[#2e3147] hover:border-[#6366f1]/50 hover:bg-[#252836]/50',
          ].join(' ')}
        >
          <div className="flex justify-center gap-3 mb-3">
            <div className="h-11 w-11 rounded-xl bg-[#252836] border border-[#2e3147] flex items-center justify-center">
              <ImageIcon size={18} className="text-[#6366f1]" />
            </div>
            <div className="h-11 w-11 rounded-xl bg-[#252836] border border-[#2e3147] flex items-center justify-center">
              <Video size={18} className="text-[#6366f1]" />
            </div>
          </div>
          <p className="text-[13px] font-semibold text-[#e2e8f0]">
            {isDragging ? 'שחרר להעלאה' : 'גרור קבצים לכאן'}
          </p>
          <p className="text-[12px] text-[#8892a4] mt-1">
            או <span className="text-[#6366f1] underline underline-offset-2">לחץ לבחירה</span> מהמכשיר
          </p>
          <p className="text-[10px] text-[#4a5568] mt-2">
            JPG · PNG · WebP · MP4 · WebM &nbsp;·&nbsp; עד {MAX_MB}MB
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ALLOWED_TYPES.join(',')}
            className="hidden"
            onChange={(e) => {
              processFiles(Array.from(e.target.files ?? []))
              e.target.value = ''  // allow re-selecting same file
            }}
          />
        </div>

        {/* Upload queue */}
        {hasItems && (
          <div className="space-y-2">
            {queue.map((item, i) => {
              const phaseInfo = PHASES.find((p) => p.id === item.phase)
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 bg-[#252836] border border-[#2e3147] rounded-xl px-3 py-2.5"
                >
                  {/* Thumbnail */}
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-[#1a1d27] border border-[#2e3147]">
                    {item.preview ? (
                      <img src={item.preview} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video size={15} className="text-[#8892a4]" />
                      </div>
                    )}
                    {item.status === 'uploading' && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <Loader2 size={14} className="text-white animate-spin" />
                      </div>
                    )}
                    {item.status === 'done' && (
                      <div className="absolute inset-0 bg-emerald-500/70 flex items-center justify-center">
                        <CheckCircle size={14} className="text-white" />
                      </div>
                    )}
                  </div>

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-[#e2e8f0] truncate leading-snug">
                      {item.file.name}
                    </p>
                    <p className="text-[10px] text-[#8892a4] mt-0.5">
                      {(item.file.size / (1024 * 1024)).toFixed(1)} MB
                      {item.phase !== 'general' && phaseInfo && (
                        <> · <span className="text-[#6366f1]">{phaseInfo.label}</span></>
                      )}
                    </p>
                  </div>

                  {/* Status indicator */}
                  <div className="shrink-0 flex items-center gap-1.5">
                    {item.status === 'done' && (
                      <span className="flex items-center gap-1 text-emerald-400 text-[10px] font-medium">
                        <CheckCircle size={13} />הועלה
                      </span>
                    )}
                    {item.status === 'error' && (
                      <span className="flex items-center gap-1 text-red-400">
                        <AlertCircle size={13} className="shrink-0" />
                        <span className="text-[10px] max-w-[80px] truncate">{item.error}</span>
                      </span>
                    )}
                    {item.status !== 'uploading' && (
                      <button
                        onClick={() => setQueue((prev) => prev.filter((_, j) => j !== i))}
                        className="p-1 text-[#8892a4] hover:text-[#e2e8f0] transition-colors rounded"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}

            {hasDone && (
              <button
                onClick={() => setQueue((prev) => prev.filter((q) => q.status !== 'done'))}
                className="w-full text-[11px] text-[#4a5568] hover:text-[#8892a4] py-1 transition-colors"
              >
                נקה קבצים שהועלו
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
