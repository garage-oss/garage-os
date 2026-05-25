import { requireOrg } from '@/lib/org'
import { hasPermission } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { getStaffMembers, getTechnicianWorkload } from '@/lib/staff'
import { getOrgInvitations } from '@/lib/org'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/org'
import { Avatar } from '@/components/staff/AvatarUpload'
import { MemberRole } from '@prisma/client'
import Link from 'next/link'
import { Users, Plus, Mail, Clock, Wrench, CheckCircle2, AlertCircle, UserPlus } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function StaffPage() {
  const { orgId, memberRole, userId } = await requireOrg()
  if (!hasPermission(memberRole, 'users', 'read')) redirect('/unauthorized')

  const [staff, workload, invitations] = await Promise.all([
    getStaffMembers(orgId),
    getTechnicianWorkload(orgId),
    hasPermission(memberRole, 'users', 'create') ? getOrgInvitations(orgId) : Promise.resolve([]),
  ])

  const canAdmin = memberRole === 'OWNER' || memberRole === 'MANAGER'

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">ניהול צוות</h1>
          <p className="text-sm text-[#8892a4] mt-0.5">{staff.length} עובדים בארגון</p>
        </div>
        {canAdmin && (
          <Link
            href="/dashboard/settings/team"
            className="flex items-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
          >
            <UserPlus size={16} />הזמן עובד
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Staff list ───────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-3">
          {staff.map((member) => (
            <Link
              key={member.membershipId}
              href={`/dashboard/staff/${member.membershipId}`}
              className="block bg-[#1a1d27] border border-[#2e3147] rounded-xl p-4 hover:border-[#6366f1]/40 transition-all"
            >
              <div className="flex items-center gap-4">
                <Avatar userId={member.userId} name={member.name} avatarUrl={member.avatarUrl} size="md" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[15px]">{member.name}</span>
                    {member.userId === userId && (
                      <span className="text-[10px] bg-[#6366f1]/15 text-[#6366f1] px-1.5 py-0.5 rounded-full font-medium">אתה</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${ROLE_COLORS[member.memberRole as MemberRole]}`}>
                      {ROLE_LABELS[member.memberRole as MemberRole]}
                    </span>
                    {!member.isActive && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold text-[#8892a4] bg-[#8892a4]/10 border border-[#8892a4]/20">מושבת</span>
                    )}
                  </div>
                  <div className="text-sm text-[#8892a4] mt-0.5 flex items-center gap-1">
                    <Mail size={11} />{member.email}
                  </div>
                  {(member.position || member.department) && (
                    <div className="text-xs text-[#8892a4] mt-0.5">{[member.position, member.department].filter(Boolean).join(' · ')}</div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  {member.lastLoginAt ? (
                    <span className="flex items-center gap-1 text-xs text-[#8892a4]">
                      <Clock size={10} />
                      {formatDate(member.lastLoginAt)}
                    </span>
                  ) : (
                    <span className="text-xs text-[#8892a4]">לא התחבר</span>
                  )}
                  {member.isActive ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 size={10} />פעיל</span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-[#8892a4]"><AlertCircle size={10} />מושבת</span>
                  )}
                </div>
              </div>
            </Link>
          ))}

          {/* Pending invitations */}
          {invitations.length > 0 && (
            <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-4">
              <h2 className="text-xs font-semibold text-[#8892a4] uppercase tracking-wide mb-3">הזמנות ממתינות ({invitations.length})</h2>
              <div className="space-y-2">
                {invitations.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between gap-3 py-2 border-b border-[#2e3147] last:border-0">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
                        <Mail size={14} className="text-amber-400" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">{inv.email}</div>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${ROLE_COLORS[inv.role]}`}>{ROLE_LABELS[inv.role]}</span>
                      </div>
                    </div>
                    <span className="text-xs text-[#8892a4]">פג תוקף: {formatDate(inv.expiresAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Technician workload ──────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5">
            <h2 className="text-sm font-semibold text-[#8892a4] uppercase tracking-wide mb-4 flex items-center gap-2">
              <Wrench size={13} />עומס טכנאים
            </h2>
            {workload.length === 0 ? (
              <p className="text-sm text-[#8892a4] text-center py-4">אין פקודות עבודה פתוחות</p>
            ) : (
              <div className="space-y-3">
                {workload.map((tech) => (
                  <div key={tech.name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium truncate">{tech.name}</span>
                      <span className="text-xs text-[#8892a4] flex-shrink-0 ms-2">{tech.total} פ"ע</span>
                    </div>
                    <div className="flex gap-1 h-1.5 rounded-full overflow-hidden bg-[#252836]">
                      {tech.inProgress > 0 && (
                        <div className="bg-[#6366f1] rounded-full" style={{ flex: tech.inProgress }} title={`בטיפול: ${tech.inProgress}`} />
                      )}
                      {tech.pending > 0 && (
                        <div className="bg-amber-500 rounded-full" style={{ flex: tech.pending }} title={`ממתין: ${tech.pending}`} />
                      )}
                      {tech.waitingParts > 0 && (
                        <div className="bg-orange-500 rounded-full" style={{ flex: tech.waitingParts }} title={`ממתין לחלקים: ${tech.waitingParts}`} />
                      )}
                    </div>
                    <div className="flex gap-3 mt-1">
                      {tech.inProgress > 0 && <span className="text-[10px] text-[#6366f1]">בטיפול: {tech.inProgress}</span>}
                      {tech.pending > 0 && <span className="text-[10px] text-amber-400">ממתין: {tech.pending}</span>}
                      {tech.waitingParts > 0 && <span className="text-[10px] text-orange-400">חלקים: {tech.waitingParts}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5">
            <h2 className="text-sm font-semibold text-[#8892a4] uppercase tracking-wide mb-4 flex items-center gap-2">
              <Users size={13} />הרכב הצוות
            </h2>
            <div className="space-y-2">
              {(['OWNER', 'MANAGER', 'SERVICE_ADVISOR', 'TECHNICIAN', 'ACCOUNTANT'] as MemberRole[]).map((role) => {
                const count = staff.filter((s) => s.memberRole === role).length
                if (count === 0) return null
                return (
                  <div key={role} className="flex items-center justify-between">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${ROLE_COLORS[role]}`}>{ROLE_LABELS[role]}</span>
                    <span className="text-sm font-semibold">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
