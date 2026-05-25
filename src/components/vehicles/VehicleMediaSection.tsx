'use client'

import { useState, useEffect, useCallback } from 'react'
import { Paperclip, Loader2 } from 'lucide-react'
import { FileUploader } from '@/components/media/FileUploader'
import { MediaGallery, type MediaItem } from '@/components/media/MediaGallery'

interface Props { vehicleId: string }

export function VehicleMediaSection({ vehicleId }: Props) {
  const [media, setMedia] = useState<MediaItem[]>([])
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/vehicles/${vehicleId}/media`)
    if (res.ok) setMedia(await res.json())
    setLoaded(true)
  }, [vehicleId])

  useEffect(() => { load() }, [load])

  return (
    <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden mb-4">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-[#2e3147]">
        <Paperclip size={14} className="text-[#8892a4]" />
        <span className="font-semibold text-[15px]">קבצי מדיה ({media.length})</span>
      </div>
      <div className="p-5 space-y-4">
        <FileUploader entityType="vehicle" entityId={vehicleId} onUpload={load} />
        {!loaded ? (
          <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-[#8892a4]" /></div>
        ) : (
          <MediaGallery
            files={media}
            onDelete={(id) => setMedia((prev) => prev.filter((f) => f.id !== id))}
          />
        )}
      </div>
    </div>
  )
}
