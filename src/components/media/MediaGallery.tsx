'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  X, Trash2, ZoomIn, Play, ChevronLeft, ChevronRight,
  ImageIcon, Download, Loader2,
} from 'lucide-react'
import { formatFileSize } from '@/lib/media'

// ─── Types ────────────────────────────────────────────────────────────────────

export type MediaItem = {
  id: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  url: string
  phase: string | null
  createdAt: string
}

type NormalizedPhase = 'before' | 'during' | 'after' | 'general'
type FilterTab = 'all' | NormalizedPhase

interface Props {
  files: MediaItem[]
  onDelete?: (id: string) => void
}

// ─── Phase config ─────────────────────────────────────────────────────────────

const PHASE_CONFIG: Record<NormalizedPhase, {
  label: string
  dot: string
  activeBadge: string
}> = {
  before:  { label: 'לפני תיקון',  dot: 'bg-blue-400',    activeBadge: 'bg-blue-500/15 border-blue-500/40 text-blue-400' },
  during:  { label: 'במהלך תיקון', dot: 'bg-amber-400',   activeBadge: 'bg-amber-500/15 border-amber-500/40 text-amber-400' },
  after:   { label: 'אחרי תיקון',  dot: 'bg-emerald-400', activeBadge: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400' },
  general: { label: 'כללי',         dot: 'bg-[#8892a4]',   activeBadge: 'bg-[#252836] border-[#4e5470] text-[#e2e8f0]' },
}

const PHASE_ORDER: NormalizedPhase[] = ['before', 'during', 'after', 'general']

function normPhase(p: string | null): NormalizedPhase {
  if (p === 'before' || p === 'during' || p === 'after') return p
  return 'general'
}

// ─── Gallery ─────────────────────────────────────────────────────────────────

export function MediaGallery({ files, onDelete }: Props) {
  const [filter,      setFilter]      = useState<FilterTab>('all')
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const [deleting,    setDeleting]    = useState<string | null>(null)

  // Flat ordered list used by lightbox navigation
  const visibleFiles: MediaItem[] =
    filter === 'all'
      ? [...files].sort((a, b) => {
          const ai = PHASE_ORDER.indexOf(normPhase(a.phase))
          const bi = PHASE_ORDER.indexOf(normPhase(b.phase))
          return ai !== bi
            ? ai - bi
            : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        })
      : files.filter((f) => normPhase(f.phase) === filter)

  // Per-phase buckets for grouped ("all") view
  const byPhase = PHASE_ORDER.reduce<Record<NormalizedPhase, MediaItem[]>>(
    (acc, p) => { acc[p] = files.filter((f) => normPhase(f.phase) === p); return acc },
    { before: [], during: [], after: [], general: [] }
  )

  const phasesPresent = PHASE_ORDER.filter((p) => byPhase[p].length > 0)

  // Keyboard handler for lightbox
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (lightboxIdx === null) return
      if (e.key === 'Escape')      setLightboxIdx(null)
      if (e.key === 'ArrowRight')  setLightboxIdx((i) => i !== null ? Math.max(i - 1, 0) : null)
      if (e.key === 'ArrowLeft')   setLightboxIdx((i) => i !== null ? Math.min(i + 1, visibleFiles.length - 1) : null)
    },
    [lightboxIdx, visibleFiles.length]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [handleKey])

  async function handleDelete(file: MediaItem) {
    if (!onDelete) return
    setDeleting(file.id)
    try {
      const res = await fetch(`/api/media/${file.id}`, { method: 'DELETE' })
      if (res.ok) {
        if (lightboxIdx !== null) setLightboxIdx(null)
        onDelete(file.id)
      }
    } finally {
      setDeleting(null)
    }
  }

  function openLightbox(file: MediaItem) {
    const idx = visibleFiles.findIndex((f) => f.id === file.id)
    setLightboxIdx(idx >= 0 ? idx : null)
  }

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (files.length === 0) {
    return (
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-2xl p-12">
        <div className="flex flex-col items-center gap-3">
          <div className="h-16 w-16 rounded-2xl bg-[#252836] border border-[#2e3147] flex items-center justify-center">
            <ImageIcon size={28} className="text-[#3e4357]" />
          </div>
          <p className="text-[13px] font-medium text-[#8892a4]">אין מדיה עדיין</p>
          <p className="text-[11px] text-[#4a5568]">העלה תמונות וסרטונים מהאזור למעלה</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-2xl overflow-hidden">
        {/* ── Filter tabs ── */}
        <div className="flex items-center gap-1.5 px-5 py-3 border-b border-[#2e3147] overflow-x-auto scrollbar-none">
          {/* All */}
          <button
            onClick={() => setFilter('all')}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border whitespace-nowrap transition-all shrink-0',
              filter === 'all'
                ? 'bg-[#6366f1]/15 border-[#6366f1]/40 text-[#6366f1]'
                : 'bg-transparent border-[#2e3147] text-[#8892a4] hover:border-[#4e5470] hover:text-[#e2e8f0]',
            ].join(' ')}
          >
            כולם
            <span className="opacity-60 tabular-nums">{files.length}</span>
          </button>

          {phasesPresent.map((p) => {
            const cfg = PHASE_CONFIG[p]
            return (
              <button
                key={p}
                onClick={() => setFilter(p)}
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border whitespace-nowrap transition-all shrink-0',
                  filter === p
                    ? cfg.activeBadge
                    : 'bg-transparent border-[#2e3147] text-[#8892a4] hover:border-[#4e5470] hover:text-[#e2e8f0]',
                ].join(' ')}
              >
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                {cfg.label}
                <span className="opacity-60 tabular-nums">{byPhase[p].length}</span>
              </button>
            )
          })}
        </div>

        {/* ── Content ── */}
        <div className="p-4 sm:p-5">
          {filter === 'all' ? (
            <div className="space-y-6">
              {phasesPresent.map((p) => (
                <PhaseSection
                  key={p}
                  phase={p}
                  files={byPhase[p]}
                  onDelete={onDelete ? handleDelete : undefined}
                  onOpen={openLightbox}
                  deleting={deleting}
                />
              ))}
            </div>
          ) : (
            <MediaGrid
              files={visibleFiles}
              onDelete={onDelete ? handleDelete : undefined}
              onOpen={openLightbox}
              deleting={deleting}
            />
          )}
        </div>
      </div>

      {/* ── Lightbox ── */}
      {lightboxIdx !== null && visibleFiles[lightboxIdx] && (
        <Lightbox
          item={visibleFiles[lightboxIdx]}
          total={visibleFiles.length}
          index={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onPrev={() => setLightboxIdx((i) => Math.max((i ?? 0) - 1, 0))}
          onNext={() => setLightboxIdx((i) => Math.min((i ?? 0) + 1, visibleFiles.length - 1))}
          onDelete={onDelete ? handleDelete : undefined}
          deleting={deleting}
        />
      )}
    </>
  )
}

// ─── Phase section ────────────────────────────────────────────────────────────

function PhaseSection({
  phase, files, onDelete, onOpen, deleting,
}: {
  phase: NormalizedPhase
  files: MediaItem[]
  onDelete?: (f: MediaItem) => void
  onOpen: (f: MediaItem) => void
  deleting: string | null
}) {
  const { label, dot } = PHASE_CONFIG[phase]
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-3">
        <span className={`h-2 w-2 rounded-full ${dot} shrink-0`} />
        <span className="text-[10px] font-bold text-[#8892a4] uppercase tracking-widest">{label}</span>
        <span className="text-[10px] text-[#4a5568] tabular-nums">{files.length}</span>
        <div className="flex-1 h-px bg-[#2e3147]" />
      </div>
      <MediaGrid files={files} onDelete={onDelete} onOpen={onOpen} deleting={deleting} />
    </div>
  )
}

// ─── Media grid ───────────────────────────────────────────────────────────────

function MediaGrid({
  files, onDelete, onOpen, deleting,
}: {
  files: MediaItem[]
  onDelete?: (f: MediaItem) => void
  onOpen: (f: MediaItem) => void
  deleting: string | null
}) {
  const grid  = files.filter((f) => f.mimeType.startsWith('image/') || f.mimeType.startsWith('video/'))
  const other = files.filter((f) => !f.mimeType.startsWith('image/') && !f.mimeType.startsWith('video/'))

  return (
    <div className="space-y-2">
      {grid.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 sm:gap-2">
          {grid.map((f) => (
            <MediaCell
              key={f.id}
              file={f}
              onOpen={onOpen}
              onDelete={onDelete}
              deleting={deleting}
            />
          ))}
        </div>
      )}
      {other.length > 0 && (
        <div className="space-y-1.5 mt-2">
          {other.map((f) => (
            <OtherFileRow
              key={f.id}
              file={f}
              onDelete={onDelete ? () => onDelete(f) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Grid cell ────────────────────────────────────────────────────────────────

function MediaCell({ file, onOpen, onDelete, deleting }: {
  file: MediaItem
  onOpen: (f: MediaItem) => void
  onDelete?: (f: MediaItem) => void
  deleting: string | null
}) {
  const isVid  = file.mimeType.startsWith('video/')
  const isBusy = deleting === file.id

  return (
    <div
      className="relative group aspect-square rounded-xl overflow-hidden bg-[#252836] cursor-pointer"
      onClick={() => onOpen(file)}
    >
      {isVid ? (
        <>
          <video
            src={file.url}
            preload="metadata"
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          {/* Always-visible play overlay */}
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <div className="h-9 w-9 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg">
              <Play size={14} className="text-[#0f1117] ms-0.5" fill="currentColor" />
            </div>
          </div>
        </>
      ) : (
        <img
          src={file.url}
          alt={file.originalName}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
        <button
          className="p-2 rounded-lg bg-white/15 hover:bg-white/30 transition-colors backdrop-blur-sm"
          onClick={(e) => { e.stopPropagation(); onOpen(file) }}
          aria-label="הגדל"
        >
          {isVid
            ? <Play size={14} className="text-white" fill="currentColor" />
            : <ZoomIn size={14} className="text-white" />
          }
        </button>
        {onDelete && (
          <button
            className="p-2 rounded-lg bg-red-500/60 hover:bg-red-500/80 transition-colors backdrop-blur-sm"
            onClick={(e) => { e.stopPropagation(); onDelete(file) }}
            disabled={isBusy}
            aria-label="מחק"
          >
            {isBusy
              ? <Loader2 size={14} className="text-white animate-spin" />
              : <Trash2 size={14} className="text-white" />
            }
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Other-file row (PDFs, audio, etc.) ──────────────────────────────────────

function OtherFileRow({ file, onDelete }: {
  file: MediaItem
  onDelete?: () => void
}) {
  return (
    <div className="flex items-center gap-3 bg-[#252836] border border-[#2e3147] rounded-xl px-3.5 py-3">
      <div className="h-9 w-9 rounded-lg bg-[#1a1d27] border border-[#2e3147] flex items-center justify-center shrink-0">
        <span className="text-[9px] font-mono font-bold text-[#8892a4] uppercase">
          {file.originalName.split('.').pop()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-[#e2e8f0] truncate">{file.originalName}</p>
        <p className="text-[10px] text-[#8892a4]">{formatFileSize(file.size)}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <a
          href={file.url}
          download={file.originalName}
          className="p-1.5 text-[#8892a4] hover:text-[#e2e8f0] transition-colors rounded-lg hover:bg-[#2e3147]"
          onClick={(e) => e.stopPropagation()}
          aria-label="הורד"
        >
          <Download size={14} />
        </a>
        {onDelete && (
          <button
            onClick={onDelete}
            className="p-1.5 text-[#8892a4] hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10"
            aria-label="מחק"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Lightbox ────────────────────────────────────────────────────────────────

function Lightbox({
  item, total, index, onClose, onPrev, onNext, onDelete, deleting,
}: {
  item: MediaItem
  total: number
  index: number
  onClose: () => void
  onPrev: () => void
  onNext: () => void
  onDelete?: (f: MediaItem) => void
  deleting: string | null
}) {
  const isVid  = item.mimeType.startsWith('video/')
  const cfg    = PHASE_CONFIG[normPhase(item.phase)]
  const isBusy = deleting === item.id

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col"
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
          <span className="text-[11px] text-white/60 font-medium">{cfg.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-white/30 tabular-nums">{index + 1} / {total}</span>
          {onDelete && (
            <button
              onClick={() => onDelete(item)}
              disabled={isBusy}
              className="p-2 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
              aria-label="מחק"
            >
              {isBusy
                ? <Loader2 size={15} className="animate-spin" />
                : <Trash2 size={15} />
              }
            </button>
          )}
          <a
            href={item.url}
            download={item.originalName}
            className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all"
            onClick={(e) => e.stopPropagation()}
            aria-label="הורד"
          >
            <Download size={15} />
          </a>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all"
            aria-label="סגור"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Media */}
      <div
        className="flex-1 flex items-center justify-center px-4 min-h-0"
        onClick={(e) => e.stopPropagation()}
      >
        {isVid ? (
          <video
            key={item.id}
            src={item.url}
            controls
            autoPlay
            playsInline
            className="max-w-full max-h-full rounded-2xl shadow-2xl"
          />
        ) : (
          <img
            key={item.id}
            src={item.url}
            alt={item.originalName}
            className="max-w-full max-h-full rounded-2xl object-contain shadow-2xl"
          />
        )}
      </div>

      {/* Navigation bar — dir="ltr" keeps prev/next in universal positions */}
      <div
        dir="ltr"
        className="flex items-center justify-between px-4 py-4 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onPrev}
          disabled={index === 0}
          className="p-2.5 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
          aria-label="הקודם"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="text-center px-3 min-w-0">
          <p className="text-[12px] font-medium text-white/70 truncate max-w-[220px]">
            {item.originalName}
          </p>
          <p className="text-[10px] text-white/30 mt-0.5">{formatFileSize(item.size)}</p>
        </div>
        <button
          onClick={onNext}
          disabled={index === total - 1}
          className="p-2.5 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
          aria-label="הבא"
        >
          <ChevronRight size={22} />
        </button>
      </div>
    </div>
  )
}
