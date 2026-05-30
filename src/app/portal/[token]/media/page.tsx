import { getPortalData } from '@/lib/portal'

export const dynamic = 'force-dynamic'

type NormalizedPhase = 'before' | 'during' | 'after' | 'general'

const PHASE_CONFIG: Record<NormalizedPhase, {
  label:       string
  emoji:       string
  labelColor:  string
  dotColor:    string
  bgColor:     string
}> = {
  before:  { label: 'לפני הטיפול',  emoji: '🔍', labelColor: 'text-blue-700',   dotColor: 'bg-blue-400',   bgColor: 'bg-blue-50'   },
  during:  { label: 'במהלך הטיפול', emoji: '🔧', labelColor: 'text-amber-700',  dotColor: 'bg-amber-400',  bgColor: 'bg-amber-50'  },
  after:   { label: 'אחרי הטיפול',  emoji: '✅', labelColor: 'text-emerald-700',dotColor: 'bg-emerald-400',bgColor: 'bg-emerald-50' },
  general: { label: 'תמונות',        emoji: '📷', labelColor: 'text-slate-600',  dotColor: 'bg-slate-300',  bgColor: 'bg-slate-50'  },
}

const PHASE_ORDER: NormalizedPhase[] = ['before', 'during', 'after', 'general']

function normPhase(p: string | null): NormalizedPhase {
  if (p === 'before' || p === 'during' || p === 'after') return p
  return 'general'
}

interface MediaFile {
  id:           string
  url:          string
  originalName: string
  mimeType:     string
  size:         number
  phase:        string | null
  createdAt:    string | Date
}

export default async function MediaPage({ params }: { params: { token: string } }) {
  const wo    = await getPortalData(params.token)
  const media = wo.media as unknown as MediaFile[]

  const photos = media.filter(m => !m.mimeType.startsWith('video/'))
  const videos = media.filter(m =>  m.mimeType.startsWith('video/'))

  const byPhase = PHASE_ORDER.reduce<Record<NormalizedPhase, MediaFile[]>>(
    (acc, p) => { acc[p] = photos.filter(m => normPhase(m.phase) === p); return acc },
    { before: [], during: [], after: [], general: [] }
  )
  const phasesPresent = PHASE_ORDER.filter(p => byPhase[p].length > 0)
  const totalCount    = media.length

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-8 space-y-6">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">תמונות ווידאו</h2>
          <p className="text-slate-400 text-sm mt-1">
            {wo.vehicle.make} {wo.vehicle.model} · {wo.vehicle.plate}
          </p>
        </div>
        {totalCount > 0 && (
          <span className="text-sm font-semibold text-slate-400 mb-0.5">
            {totalCount} קבצים
          </span>
        )}
      </div>

      {/* Empty state */}
      {media.length === 0 && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-12 text-center">
          <span className="text-5xl block mb-4">📷</span>
          <p className="font-semibold text-slate-700">אין תמונות עדיין</p>
          <p className="text-sm text-slate-400 mt-1">
            הטכנאי יוסיף תמונות במהלך הטיפול
          </p>
        </div>
      )}

      {/* Photo sections by phase */}
      {phasesPresent.map(phase => {
        const cfg   = PHASE_CONFIG[phase]
        const files = byPhase[phase]
        return (
          <div key={phase} className="space-y-3">
            {/* Phase header — larger and more visible */}
            <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl ${cfg.bgColor}`}>
              <span className="text-base">{cfg.emoji}</span>
              <span className={`text-sm font-bold ${cfg.labelColor}`}>{cfg.label}</span>
              <span className={`text-xs font-semibold ${cfg.labelColor} opacity-60`}>({files.length})</span>
            </div>

            {/* Photo grid — 2 columns on mobile, 3 on tablet */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {files.map(photo => (
                <a
                  key={photo.id}
                  href={photo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative aspect-square bg-slate-100 rounded-2xl overflow-hidden shadow-sm active:scale-95 transition-transform"
                >
                  <img
                    src={photo.url}
                    alt={photo.originalName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  {/* Bottom gradient — ALWAYS visible on mobile (not hover-only) */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                    <p className="text-white text-[10px] truncate">{photo.originalName}</p>
                    <p className="text-white/70 text-[9px] tabular-nums mt-0.5">
                      {new Date(photo.createdAt).toLocaleDateString('he-IL', {
                        day: '2-digit', month: '2-digit',
                      })}
                    </p>
                  </div>
                  {/* Open-in-new-tab hint — always show on mobile via opacity */}
                  <div className="absolute top-2 end-2 h-6 w-6 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <svg className="w-3 h-3 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )
      })}

      {/* Videos section */}
      {videos.length > 0 && (
        <div className="space-y-3">
          {/* Phase header consistent with photos */}
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-50">
            <span className="text-base">🎥</span>
            <span className="text-sm font-bold text-slate-600">וידאו</span>
            <span className="text-xs font-semibold text-slate-400">({videos.length})</span>
          </div>

          <div className="space-y-3">
            {videos.map(video => (
              <div
                key={video.id}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
              >
                <video
                  src={video.url}
                  controls
                  playsInline
                  preload="metadata"
                  className="w-full max-h-72 bg-black block"
                />
                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <p className="text-[13px] text-slate-600 font-medium truncate min-w-0">
                    {video.originalName}
                  </p>
                  <p className="text-[11px] text-slate-400 shrink-0 tabular-nums">
                    {new Date(video.createdAt).toLocaleDateString('he-IL', {
                      day: '2-digit', month: 'short',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insurance hint */}
      {media.length > 0 && (
        <div className="bg-slate-50 rounded-2xl border border-slate-100 px-4 py-3 flex items-start gap-2.5">
          <span className="text-base shrink-0 mt-0.5">💡</span>
          <p className="text-xs text-slate-500 leading-relaxed">
            לשמירת תמונה: לחץ לחיצה ממושכת על התמונה ← &quot;שמור תמונה&quot;
          </p>
        </div>
      )}

    </div>
  )
}
