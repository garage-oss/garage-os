'use client'

import { useState, useTransition } from 'react'
import { Mail, UserPlus, Loader2 } from 'lucide-react'
import { inviteMember } from '@/app/actions/settings'

const ROLES = [
  { value: 'ADMIN', label: 'מנהל' },
  { value: 'TECHNICIAN', label: 'טכנאי' },
  { value: 'VIEWER', label: 'צפייה בלבד' },
]

export function InviteForm() {
  const [isPending, startTransition] = useTransition()
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSuccess(null)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const email = fd.get('email') as string
    startTransition(async () => {
      const res = await inviteMember(fd)
      if ('error' in res) {
        setError(res.error)
      } else {
        setSuccess(`הזמנה נשלחה ל-${email}`)
        ;(e.target as HTMLFormElement).reset()
      }
    })
  }

  return (
    <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <UserPlus size={15} className="text-[#8892a4]" />
        <h2 className="font-semibold">הזמן חבר צוות</h2>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#8892a4] mb-1.5">כתובת אימייל</label>
            <div className="relative">
              <Mail size={14} className="absolute top-3 end-3 text-[#8892a4]" />
              <input
                name="email"
                type="email"
                required
                placeholder="tech@garage.co.il"
                className="w-full bg-[#0f1117] border border-[#2e3147] rounded-lg px-3 py-2.5 pe-8 text-sm focus:outline-none focus:border-[#6366f1] transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#8892a4] mb-1.5">תפקיד</label>
            <select
              name="role"
              defaultValue="TECHNICIAN"
              className="w-full bg-[#0f1117] border border-[#2e3147] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#6366f1] transition-colors"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-3 py-2.5">{error}</div>}
        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm rounded-lg px-3 py-2.5">
            {success} — שתף את קישור ההזמנה
          </div>
        )}

        <div className="flex justify-end">
          <button type="submit" disabled={isPending}
            className="flex items-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors">
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
            שלח הזמנה
          </button>
        </div>
      </form>
    </div>
  )
}
