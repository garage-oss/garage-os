'use client'

import { useState, useTransition } from 'react'
import { Wrench, Building2, Phone, MapPin, ArrowLeft, Loader2 } from 'lucide-react'
import { createOrganization } from '@/app/actions/onboarding'

export default function OnboardingPage() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createOrganization(fd)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="w-full max-w-md">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-[#6366f1] rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Wrench size={28} className="text-white" />
        </div>
        <h1 className="text-3xl font-black">ברוך הבא ל-GarageOS</h1>
        <p className="text-[#8892a4] mt-2">בוא ניצור את פרופיל המוסך שלך</p>
      </div>

      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-2xl p-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Garage name */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              שם המוסך <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Building2 size={16} className="absolute top-3 end-3 text-[#8892a4]" />
              <input
                name="name"
                type="text"
                required
                placeholder="מוסך ישראל בע״מ"
                autoFocus
                className="w-full bg-[#0f1117] border border-[#2e3147] rounded-lg px-3 py-2.5 pe-9 text-sm focus:outline-none focus:border-[#6366f1] transition-colors"
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium mb-1.5">טלפון</label>
            <div className="relative">
              <Phone size={16} className="absolute top-3 end-3 text-[#8892a4]" />
              <input
                name="phone"
                type="tel"
                placeholder="03-1234567"
                className="w-full bg-[#0f1117] border border-[#2e3147] rounded-lg px-3 py-2.5 pe-9 text-sm focus:outline-none focus:border-[#6366f1] transition-colors"
              />
            </div>
          </div>

          {/* City */}
          <div>
            <label className="block text-sm font-medium mb-1.5">עיר</label>
            <div className="relative">
              <MapPin size={16} className="absolute top-3 end-3 text-[#8892a4]" />
              <input
                name="city"
                type="text"
                placeholder="תל אביב"
                className="w-full bg-[#0f1117] border border-[#2e3147] rounded-lg px-3 py-2.5 pe-9 text-sm focus:outline-none focus:border-[#6366f1] transition-colors"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-3 transition-colors"
          >
            {isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                <ArrowLeft size={16} />
                צור מוסך והתחל
              </>
            )}
          </button>
        </form>
      </div>

      <p className="text-center text-xs text-[#8892a4] mt-6">
        תוכנית חינמית · עד 3 משתמשים · עד 50 לקוחות
      </p>
    </div>
  )
}
