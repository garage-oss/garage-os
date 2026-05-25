'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

type EntityType = 'workOrder' | 'vehicle' | 'quote'

interface Props {
  entityType: EntityType
  entityId: string
  onUpload: () => void
}

type FileState = {
  file: File
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
  preview?: string
}

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm', 'video/quicktime',
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm',
  'application/pdf',
]
const MAX_MB = 20

export function FileUploader({ entityType, entityId, onUpload }: Props) {
  const [files, setFiles] = useState<FileState[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function addFiles(raw: File[]) {
    const newFiles: FileState[] = raw.map((file) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return { file, status: 'error', error: `סוג לא נתמך (${file.type.split('/')[1]})` }
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        return { file, status: 'error', error: `גדול מדי (מקס׳ ${MAX_MB}MB)` }
      }
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
      return { file, status: 'pending', preview }
    })
    setFiles((prev) => [...prev, ...newFiles])
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    addFiles(Array.from(e.dataTransfer.files))
  }

  async function uploadAll() {
    const pending = files.filter((f) => f.status === 'pending')
    if (!pending.length) return

    setFiles((prev) => prev.map((f) => (f.status === 'pending' ? { ...f, status: 'uploading' } : f)))

    for (const fileState of pending) {
      const fd = new FormData()
      fd.append('file', fileState.file)
      fd.append('entityType', entityType)
      fd.append('entityId', entityId)

      try {
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        const data = await res.json()
        setFiles((prev) =>
          prev.map((f) =>
            f.file === fileState.file
              ? { ...f, status: data.error ? 'error' : 'done', error: data.error }
              : f
          )
        )
        if (!data.error) onUpload()
      } catch {
        setFiles((prev) =>
          prev.map((f) =>
            f.file === fileState.file ? { ...f, status: 'error', error: 'שגיאת רשת' } : f
          )
        )
      }
    }
  }

  const pendingCount = files.filter((f) => f.status === 'pending').length

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-[#6366f1] bg-[#6366f1]/10'
            : 'border-[#2e3147] hover:border-[#6366f1]/50 hover:bg-[#252836]/40'
        }`}
      >
        <Upload size={28} className="mx-auto mb-2 text-[#8892a4]" />
        <p className="text-sm font-medium text-[#e2e8f0]">גרור קבצים לכאן, או לחץ לבחירה</p>
        <p className="text-xs text-[#8892a4] mt-1">תמונות, סרטונים, שמע, PDF · מקס׳ {MAX_MB}MB</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept={ALLOWED_TYPES.join(',')}
          onChange={(e) => addFiles(Array.from(e.target.files ?? []))}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-3 bg-[#252836] rounded-lg px-3 py-2">
              {f.preview ? (
                <img src={f.preview} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded bg-[#2e3147] flex items-center justify-center flex-shrink-0 text-xs text-[#8892a4] uppercase font-mono">
                  {f.file.name.split('.').pop()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{f.file.name}</div>
                <div className="text-xs text-[#8892a4]">{(f.file.size / 1024).toFixed(0)} KB</div>
              </div>
              <div className="flex-shrink-0">
                {f.status === 'uploading' && <Loader2 size={16} className="text-[#6366f1] animate-spin" />}
                {f.status === 'done' && <CheckCircle size={16} className="text-emerald-400" />}
                {f.status === 'error' && (
                  <div className="flex items-center gap-1">
                    <AlertCircle size={14} className="text-red-400" />
                    <span className="text-xs text-red-400">{f.error}</span>
                  </div>
                )}
                {f.status === 'pending' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setFiles((prev) => prev.filter((_, j) => j !== i)) }}
                    className="text-[#8892a4] hover:text-red-400 transition-colors"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}

          {pendingCount > 0 && (
            <button
              onClick={uploadAll}
              className="w-full bg-[#6366f1] hover:bg-[#4f46e5] text-white text-sm font-medium rounded-lg py-2.5 transition-colors"
            >
              העלה {pendingCount} קבצ{pendingCount === 1 ? '' : 'ים'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
