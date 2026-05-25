'use client'

import { useState, useRef } from 'react'
import { Camera, Loader2 } from 'lucide-react'

interface AvatarUploadProps {
  userId:    string
  name:      string
  avatarUrl: string | null
  size?:     'sm' | 'md' | 'lg'
  onUpload?: (url: string) => void
  readonly?: boolean
}

const SIZE_MAP = {
  sm: { wrapper: 'w-10 h-10', text: 'text-sm', icon: 12 },
  md: { wrapper: 'w-16 h-16', text: 'text-xl',  icon: 16 },
  lg: { wrapper: 'w-24 h-24', text: 'text-3xl',  icon: 20 },
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

const AVATAR_COLORS = [
  'bg-[#6366f1]', 'bg-emerald-500', 'bg-amber-500',
  'bg-pink-500',  'bg-sky-500',     'bg-orange-500',
]

function colorFor(str: string) {
  let hash = 0
  for (const c of str) hash = c.charCodeAt(0) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function AvatarUpload({ userId, name, avatarUrl, size = 'md', onUpload, readonly }: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(avatarUrl)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const sz = SIZE_MAP[size]
  const bg = colorFor(userId)

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) { setError('יש לבחור קובץ תמונה'); return }
    if (file.size > 2 * 1024 * 1024) { setError('גודל מקסימלי: 2MB'); return }

    setError(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('userId', userId)
      const res = await fetch('/api/avatar', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setPreviewUrl(data.avatarUrl)
      onUpload?.(data.avatarUrl)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'שגיאה בהעלאה')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative group">
        <div className={`${sz.wrapper} rounded-2xl flex items-center justify-center overflow-hidden ${!previewUrl ? bg : ''} flex-shrink-0`}>
          {previewUrl ? (
            <img src={previewUrl} alt={name} className="w-full h-full object-cover" />
          ) : (
            <span className={`font-bold text-white ${sz.text}`}>{initials(name)}</span>
          )}
        </div>
        {!readonly && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          >
            {uploading ? <Loader2 size={sz.icon} className="text-white animate-spin" /> : <Camera size={sz.icon} className="text-white" />}
          </button>
        )}
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

// ── Static avatar display (no upload) ────────────────────────────────────────

export function Avatar({ name, avatarUrl, size = 'md', userId }: Omit<AvatarUploadProps, 'onUpload' | 'readonly'> & { userId: string }) {
  const sz = SIZE_MAP[size]
  const bg = colorFor(userId)

  return (
    <div className={`${sz.wrapper} rounded-2xl flex items-center justify-center overflow-hidden ${!avatarUrl ? bg : ''} flex-shrink-0`}>
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className={`font-bold text-white ${sz.text}`}>{initials(name)}</span>
      )}
    </div>
  )
}
