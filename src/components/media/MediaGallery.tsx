'use client'

import { useState } from 'react'
import { X, Trash2, Download, FileText, Music, Video, ZoomIn } from 'lucide-react'
import { formatFileSize } from '@/lib/media'

export type MediaItem = {
  id: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  url: string
  createdAt: string
}

interface Props {
  files: MediaItem[]
  onDelete?: (id: string) => void
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith('video/')) return <Video size={24} className="text-blue-400" />
  if (mimeType.startsWith('audio/')) return <Music size={24} className="text-purple-400" />
  if (mimeType === 'application/pdf') return <FileText size={24} className="text-red-400" />
  return <FileText size={24} className="text-[#8892a4]" />
}

export function MediaGallery({ files, onDelete }: Props) {
  const [lightbox, setLightbox] = useState<MediaItem | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  if (files.length === 0) return (
    <p className="text-sm text-[#8892a4] text-center py-8">אין קבצים מצורפים</p>
  )

  async function handleDelete(file: MediaItem) {
    if (!onDelete) return
    setDeleting(file.id)
    try {
      const res = await fetch(`/api/media/${file.id}`, { method: 'DELETE' })
      if (res.ok) onDelete(file.id)
    } finally {
      setDeleting(null)
    }
  }

  const images = files.filter((f) => f.mimeType.startsWith('image/'))
  const others = files.filter((f) => !f.mimeType.startsWith('image/'))

  return (
    <>
      {/* Image grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
          {images.map((f) => (
            <div key={f.id} className="relative group aspect-square rounded-lg overflow-hidden bg-[#252836]">
              <img src={f.url} alt={f.originalName} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  onClick={() => setLightbox(f)}
                  className="p-1.5 bg-white/20 rounded-lg hover:bg-white/40 transition-colors"
                >
                  <ZoomIn size={14} className="text-white" />
                </button>
                {onDelete && (
                  <button
                    onClick={() => handleDelete(f)}
                    disabled={deleting === f.id}
                    className="p-1.5 bg-red-500/60 rounded-lg hover:bg-red-500/80 transition-colors"
                  >
                    <Trash2 size={14} className="text-white" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Other files list */}
      {others.length > 0 && (
        <div className="space-y-2">
          {others.map((f) => (
            <div key={f.id} className="flex items-center gap-3 bg-[#252836] rounded-lg px-4 py-3">
              <FileIcon mimeType={f.mimeType} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{f.originalName}</div>
                <div className="text-xs text-[#8892a4]">{formatFileSize(f.size)}</div>
                {f.mimeType.startsWith('audio/') && (
                  <audio src={f.url} controls className="mt-2 h-8 w-full" />
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <a
                  href={f.url}
                  download={f.originalName}
                  className="p-1.5 text-[#8892a4] hover:text-[#e2e8f0] transition-colors"
                >
                  <Download size={15} />
                </a>
                {onDelete && (
                  <button
                    onClick={() => handleDelete(f)}
                    disabled={deleting === f.id}
                    className="p-1.5 text-[#8892a4] hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 end-4 text-white/70 hover:text-white"
            onClick={() => setLightbox(null)}
          >
            <X size={28} />
          </button>
          <img
            src={lightbox.url}
            alt={lightbox.originalName}
            className="max-w-full max-h-[90vh] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-4 start-1/2 -translate-x-1/2 text-white/60 text-xs">
            {lightbox.originalName}
          </div>
        </div>
      )}
    </>
  )
}
