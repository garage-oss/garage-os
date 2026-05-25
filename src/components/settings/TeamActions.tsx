'use client'

import { useState, useTransition } from 'react'
import { MoreHorizontal, Trash2, ShieldCheck, Loader2 } from 'lucide-react'
import { removeMember, revokeInvitation, updateMemberRole } from '@/app/actions/settings'
import { MemberRole } from '@prisma/client'
import { ROLE_LABELS } from '@/lib/org'

interface Props {
  memberId?: string
  currentRole?: MemberRole
  invitationId?: string
  isInvitation?: boolean
}

const ASSIGNABLE_ROLES: MemberRole[] = ['MANAGER', 'SERVICE_ADVISOR', 'TECHNICIAN', 'ACCOUNTANT']

export function TeamActions({ memberId, currentRole, invitationId, isInvitation }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleRemove() {
    setOpen(false)
    startTransition(async () => {
      if (isInvitation && invitationId) await revokeInvitation(invitationId)
      else if (memberId) await removeMember(memberId)
    })
  }

  function handleRoleChange(role: MemberRole) {
    setOpen(false)
    if (!memberId) return
    startTransition(async () => { await updateMemberRole(memberId, role) })
  }

  if (isPending) return <Loader2 size={14} className="animate-spin text-[#8892a4]" />

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="p-1.5 rounded-lg text-[#8892a4] hover:text-[#e2e8f0] hover:bg-[#2e3147] transition-all"
      >
        <MoreHorizontal size={14} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute end-0 top-8 z-20 bg-[#1a1d27] border border-[#2e3147] rounded-xl shadow-xl py-1 min-w-[160px]">
            {!isInvitation && currentRole && ASSIGNABLE_ROLES.filter((r) => r !== currentRole).map((role) => (
              <button
                key={role}
                onClick={() => handleRoleChange(role)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#8892a4] hover:bg-[#252836] hover:text-[#e2e8f0] transition-colors text-start"
              >
                <ShieldCheck size={13} />
                שנה ל-{ROLE_LABELS[role]}
              </button>
            ))}
            <button
              onClick={handleRemove}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors text-start"
            >
              <Trash2 size={13} />
              {isInvitation ? 'בטל הזמנה' : 'הסר מהצוות'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
