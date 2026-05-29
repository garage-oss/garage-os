import { getPortalData } from '@/lib/portal'

export const dynamic = 'force-dynamic'

function isVideo(mimeType: string) {
  return mimeType.startsWith('video/')
}

export default async function MediaPage({ params }: { params: { token: string } }) {
  const wo     = await getPortalData(params.token)
  const media  = wo.media
  const photos = media.filter(m => !isVideo(m.mimeType))
  const videos = media.filter(m => isVideo(m.mimeType))

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">

      <div>
        <h2 className="text-2xl font-bold text-slate-900">תמונות ווידאו</h2>
        <p className="text-slate-500 text-sm mt-1">
          {wo.vehicle.make} {wo.vehicle.model} · {wo.vehicle.plate}
        </p>
      </div>

      {media.length === 0 && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-10 text-center">
          <span className="text-5xl block mb-4">📷</span>
          <p className="font-semibold text-slate-700">אין תמונות עדיין</p>
          <p className="text-sm text-slate-400 mt-1">הטכנאי יוסיף תמונות במהלך הטיפול</p>
        </div>
      )}

      {photos.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
            תמונות ({photos.length})
          </p>
          <div className="grid grid-cols-2 gap-2">
            {photos.map(photo => (
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
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-2xl" />
                <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/50 to-transparent">
                  <p className="text-white text-[10px] truncate">{photo.originalName}</p>
                </div>
                <div className="absolute top-2 left-2 bg-white/90 backdrop-blur rounded-full p-1.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg className="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {videos.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
            וידאו ({videos.length})
          </p>
          <div className="space-y-2">
            {videos.map(video => (
              <div key={video.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <video
                  src={video.url}
                  controls
                  playsInline
                  className="w-full max-h-64 bg-black"
                />
                <div className="px-4 py-3 flex items-center justify-between">
                  <p className="text-sm text-slate-600 truncate">{video.originalName}</p>
                  <p className="text-xs text-slate-400 shrink-0 mr-2">
                    {new Date(video.createdAt).toLocaleDateString('he-IL')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload hint */}
      <p className="text-center text-xs text-slate-400 pb-2">
        התמונות מוצגות כפי שצולמו על-ידי הטכנאי במהלך הטיפול
      </p>

    </div>
  )
}
