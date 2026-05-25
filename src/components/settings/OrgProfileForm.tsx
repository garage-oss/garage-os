'use client'

import { useState, useTransition } from 'react'
import { Building2, Phone, MapPin, Save, Loader2, Hash, Globe } from 'lucide-react'
import { updateOrgProfile } from '@/app/actions/settings'

interface OrgData {
  name:    string
  phone:   string | null
  address: string | null
  city:    string | null
  vatId:   string | null
  website: string | null
}

export function OrgProfileForm({ org }: { org: OrgData }) {
  const [isPending, startTransition] = useTransition()
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSuccess(false)
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await updateOrgProfile(fd)
      if ('error' in res) setError(res.error)
      else setSuccess(true)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-[#8892a4] mb-1.5">שם המוסך *</label>
          <div className="relative">
            <Building2 size={14} className="absolute top-3 end-3 text-[#8892a4]" />
            <input name="name" defaultValue={org.name} required
              className="w-full bg-[#0f1117] border border-[#2e3147] rounded-lg px-3 py-2.5 pe-8 text-sm focus:outline-none focus:border-[#6366f1] transition-colors" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#8892a4] mb-1.5">טלפון</label>
          <div className="relative">
            <Phone size={14} className="absolute top-3 end-3 text-[#8892a4]" />
            <input name="phone" defaultValue={org.phone ?? ''} dir="ltr"
              className="w-full bg-[#0f1117] border border-[#2e3147] rounded-lg px-3 py-2.5 pe-8 text-sm focus:outline-none focus:border-[#6366f1] transition-colors" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#8892a4] mb-1.5">כתובת</label>
          <input name="address" defaultValue={org.address ?? ''}
            className="w-full bg-[#0f1117] border border-[#2e3147] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#6366f1] transition-colors" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#8892a4] mb-1.5">עיר</label>
          <div className="relative">
            <MapPin size={14} className="absolute top-3 end-3 text-[#8892a4]" />
            <input name="city" defaultValue={org.city ?? ''}
              className="w-full bg-[#0f1117] border border-[#2e3147] rounded-lg px-3 py-2.5 pe-8 text-sm focus:outline-none focus:border-[#6366f1] transition-colors" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#8892a4] mb-1.5">מספר עוסק / ח.פ.</label>
          <div className="relative">
            <Hash size={14} className="absolute top-3 end-3 text-[#8892a4]" />
            <input name="vatId" defaultValue={org.vatId ?? ''} dir="ltr" placeholder="000000000"
              className="w-full bg-[#0f1117] border border-[#2e3147] rounded-lg px-3 py-2.5 pe-8 text-sm focus:outline-none focus:border-[#6366f1] transition-colors" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#8892a4] mb-1.5">אתר אינטרנט</label>
          <div className="relative">
            <Globe size={14} className="absolute top-3 end-3 text-[#8892a4]" />
            <input name="website" defaultValue={org.website ?? ''} dir="ltr" placeholder="https://example.co.il"
              className="w-full bg-[#0f1117] border border-[#2e3147] rounded-lg px-3 py-2.5 pe-8 text-sm focus:outline-none focus:border-[#6366f1] transition-colors" />
          </div>
        </div>
      </div>

      {error   && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">{error}</div>}
      {success && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm rounded-lg px-4 py-3">הפרופיל עודכן בהצלחה ✓</div>}

      <div className="flex justify-end">
        <button type="submit" disabled={isPending}
          className="flex items-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors">
          {isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          שמור שינויים
        </button>
      </div>
    </form>
  )
}
