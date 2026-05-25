'use client'

import { useState, useTransition } from 'react'
import { MemberRole } from '@prisma/client'
import { updateStaffProfile, changeStaffRole, toggleStaffActive, removeStaffMember } from '@/app/actions/staff'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/org'
import { isAdmin as checkAdmin } from '@/lib/rbac'
import { Save, UserX, UserCheck, Trash2, ChevronDown, Loader2 } from 'lucide-react'

interface StaffFormProps {
  membershipId: string
  currentUserId: string
  viewerRole:   MemberRole
  staff: {
    userId:       string
    memberRole:   string
    isActive:     boolean
    name:         string
    email:        string
    phone:        string | null
    department:   string | null
    position:     string | null
  }
  onSuccess?: () => void
}

const ALL_ROLES: MemberRole[] = ['OWNER', 'MANAGER', 'TECHNICIAN', 'SERVICE_ADVISOR', 'ACCOUNTANT']

export function StaffForm({ membershipId, currentUserId, viewerRole, staff, onSuccess }: StaffFormProps) {
  const [pending, startTransition] = useTransition()
  const [roleDropdown, setRoleDropdown] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const isSelf   = staff.userId === currentUserId
  const canAdmin = checkAdmin(viewerRole)
  const isOwner  = staff.memberRole === 'OWNER'

  function showMsg(type: 'success' | 'error', text: string) {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 3000)
  }

  async function handleProfileSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await updateStaffProfile(membershipId, formData)
      if ('error' in res) showMsg('error', res.error)
      else { showMsg('success', 'הפרופיל עודכן בהצלחה'); onSuccess?.() }
    })
  }

  async function handleRoleChange(role: MemberRole) {
    setRoleDropdown(false)
    startTransition(async () => {
      const res = await changeStaffRole(membershipId, role)
      if ('error' in res) showMsg('error', res.error)
      else showMsg('success', 'התפקיד עודכן בהצלחה')
    })
  }

  async function handleToggleActive() {
    startTransition(async () => {
      const res = await toggleStaffActive(membershipId, !staff.isActive)
      if ('error' in res) showMsg('error', res.error)
      else showMsg('success', staff.isActive ? 'המשתמש הושבת' : 'המשתמש הופעל')
    })
  }

  async function handleRemove() {
    if (!confirm(`האם למחוק את ${staff.name} מהצוות?`)) return
    startTransition(async () => {
      const res = await removeStaffMember(membershipId)
      if ('error' in res) showMsg('error', res.error)
      else { showMsg('success', 'העובד הוסר מהצוות'); onSuccess?.() }
    })
  }

  return (
    <div className="space-y-5">
      {/* Toast */}
      {msg && (
        <div className={`px-4 py-3 rounded-lg text-sm font-medium ${msg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
          {msg.text}
        </div>
      )}

      {/* Profile form */}
      <form onSubmit={handleProfileSave} className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-[#8892a4] uppercase tracking-wide mb-4">פרטי פרופיל</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[#8892a4] mb-1.5">שם מלא *</label>
            <input name="name" defaultValue={staff.name} required className="w-full bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#6366f1]" />
          </div>
          <div>
            <label className="block text-xs text-[#8892a4] mb-1.5">טלפון</label>
            <input name="phone" defaultValue={staff.phone ?? ''} dir="ltr" className="w-full bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#6366f1]" />
          </div>
          <div>
            <label className="block text-xs text-[#8892a4] mb-1.5">מחלקה</label>
            <input name="department" defaultValue={staff.department ?? ''} className="w-full bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#6366f1]" />
          </div>
          <div>
            <label className="block text-xs text-[#8892a4] mb-1.5">תפקיד / תואר</label>
            <input name="position" defaultValue={staff.position ?? ''} className="w-full bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#6366f1]" />
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button type="submit" disabled={pending} className="flex items-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors">
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            שמור שינויים
          </button>
        </div>
      </form>

      {/* Role & status — admins only */}
      {canAdmin && !isSelf && (
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#8892a4] uppercase tracking-wide mb-4">הרשאות וסטטוס</h3>
          <div className="flex flex-wrap items-center gap-3">
            {/* Role picker */}
            {!isOwner && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setRoleDropdown(!roleDropdown)}
                  className="flex items-center gap-2 bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2.5 text-sm hover:border-[#6366f1]/50 transition-colors"
                >
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${ROLE_COLORS[staff.memberRole as MemberRole]}`}>
                    {ROLE_LABELS[staff.memberRole as MemberRole]}
                  </span>
                  <ChevronDown size={14} className="text-[#8892a4]" />
                </button>
                {roleDropdown && (
                  <div className="absolute top-full mt-1 start-0 bg-[#1a1d27] border border-[#2e3147] rounded-xl shadow-xl z-20 min-w-[160px] py-1">
                    {ALL_ROLES.filter((r) => r !== 'OWNER').map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => handleRoleChange(r)}
                        className={`w-full text-start px-3 py-2 text-sm flex items-center gap-2 hover:bg-[#252836] transition-colors ${r === staff.memberRole ? 'text-[#6366f1]' : ''}`}
                      >
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${ROLE_COLORS[r]}`}>{ROLE_LABELS[r]}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Active toggle */}
            {!isOwner && (
              <button
                type="button"
                onClick={handleToggleActive}
                disabled={pending}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50 ${staff.isActive ? 'text-orange-400 border-orange-500/20 hover:bg-orange-500/10' : 'text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10'}`}
              >
                {staff.isActive ? <><UserX size={14} />השבת גישה</> : <><UserCheck size={14} />הפעל גישה</>}
              </button>
            )}

            {/* Remove */}
            {!isOwner && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={pending}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-colors disabled:opacity-50 ms-auto"
              >
                <Trash2 size={14} />הסר מהצוות
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
