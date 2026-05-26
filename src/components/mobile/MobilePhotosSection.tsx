'use client'

import { useState, useRef, useTransition } from 'react'
import { Camera, ImagePlus, X, Loader2, ChevronRight } from 'lucide-react'

interface MediaItem {
  id:           string
  url:          string
  originalName: string
  mimeType:     string
}

interface Props {
  workOrderId:  string
  initialMedia: MediaItem[]
}

export function MobilePhotosSection({ workOrderId, initialMedia }: Props) {
  const [media,      setMedia]     = useState(initialMedia)
  const [expanded,   setExpanded]  = useState(false)
  const [uploading,  setUploading] = useState(false)
  const [preview,    setPreview]   = useState<string | null>(null)
  const [error,      setError]     = useState<string | null>(null)
  const fileRef  = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  const images = media.filter((m) => m.mimeType.startsWith('image/'))

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setError(null)
    setUploading(true)

    for (const file of Array.from(files)) {
      if (file.size > 20 * 1024 * 1024) {
        setError('קובץ גדול מ-20MB')
        continue
      }
      try {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('workOrderId', workOrderId)
        const res = await fetch('/api/media/upload', { method: 'POST', body: fd })
        if (!res.ok) throw new Error('שגיאת העלאה')
        const data = await res.json() as { id: string; url: string; originalName: string; mimeType: string }
        setMedia((prev) => [data, ...prev])
      } catch {
        setError('שגיאה בהעלאת התמונה')
      }
    }
    setUploading(false)
  }

  return (
    <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-[#2e3147]"
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Camera size={15} className="text-[#8892a4]" />
          תמונות
        </div>
        <span className="text-xs text-[#8892a4]">{images.length} תמונות {expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="p-4 space-y-3">
          {/* Upload buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => cameraRef.current?.click()}
              className="flex items-center justify-center gap-2 bg-[#252836] hover:bg-[#2e3147] border border-[#2e3147] text-sm text-white py-3 rounded-xl transition-colors"
            >
              <Camera size={16} className="text-[#6366f1]" />
              צלם עכשיו
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center justify-center gap-2 bg-[#252836] hover:bg-[#2e3147] border border-[#2e3147] text-sm text-white py-3 rounded-xl transition-colors"
            >
              <ImagePlus size={16} className="text-[#8892a4]" />
              בחר מהגלריה
            </button>
          </div>

          {/* Hidden inputs */}
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          <input ref={fileRef}   type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />

          {uploading && (
            <div className="flex items-center justify-center gap-2 text-sm text-[#8892a4] py-2">
              <Loader2 size={14} className="animate-spin" />
              מעלה...
            </div>
          )}
          {error && <p className="text-xs text-red-400 text-center">{error}</p>}

          {/* Image grid */}
          {images.length > 0 ? (
            <div className="grid grid-cols-3 gap-1.5">
              {images.map((img) => (
                <button
                  key={img.id}
                  onClick={() => setPreview(img.url)}
                  className="aspect-square rounded-lg overflow-hidden bg-[#252836]"
                >
                  <img src={img.url} alt={img.originalName} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#8892a4] text-center py-3">אין תמונות עדיין</p>
          )}
        </div>
      )}

      {/* Full-screen preview */}
      {preview && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          <button className="absolute top-4 end-4 text-white bg-black/50 rounded-full p-2">
            <X size={20} />
          </button>
          <img src={preview} alt="" className="max-h-[90vh] max-w-full rounded-xl object-contain" />
        </div>
      )}
    </div>
  )
}
