import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Mail, Phone, Building2, Briefcase, Clock, Calendar } from 'lucide-react'
import { requireOrg, ROLE_LABELS, ROLE_COLORS } from '@/lib/org'
import { hasPermission } from '@/lib/rbac'
import { getStaffMember } from '@/lib/staff'
import { getAuditLogs } from '@/lib/audit'
import { AvatarUpload } from '@/components/staff/AvatarUpload'
import { StaffForm } from '@/components/staff/StaffForm'
import { AuditTimeline } from '@/components/audit/AuditTimeline'
import { MemberRole } from '@prisma/client'
import { formatDate } from '@/lib/utils'

interface Props { params: { id: string } }

export const dynamic = 'force-dynamic'

export default async function StaffDetailPage({ params }: Props) {
  const { orgId, memberRole, userId } = await requireOrg()
  if (!hasPermission(memberRole, 'users', 'read')) redirect('/unauthorized')

  const member = await getStaffMember(orgId, params.id)
  if (!member) notFound()

  // Non-admins can only view their own profile
  const canAdmin = memberRole === 'OWNER' || memberRole === 'MANAGER'
  if (!canAdmin && member.userId !== userId) redirect('/unauthorized')

  const recentActivity = canAdmin
    ? await getAuditLogs(orgId, { userId: member.userId, take: 10 })
    : []

  return (
    <div className="max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-[#8892a4] mb-6">
        <Link href="/dashboard/staff" className="hover:text-[#e2e8f0] transition-colors">צוות</Link>
        <ChevronRight size={14} className="rotate-180" />
        <span className="text-[#e2e8f0]">{member.name}</span>
      </div>

      {/* Profile header */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-6 mb-4">
        <div className="flex items-start gap-5">
          <AvatarUpload
            userId={member.userId}
            name={member.name}
            avatarUrl={member.avatarUrl}
            size="lg"
            readonly={!canAdmin && member.userId !== userId}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">{member.name}</h1>
              {member.userId === userId && (
                <span className="text-xs bg-[#6366f1]/15 text-[#6366f1] px-2 py-0.5 rounded-full font-medium">אתה</span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${ROLE_COLORS[member.memberRole as MemberRole]}`}>
                {ROLE_LABELS[member.memberRole as MemberRole]}
              </span>
              {!member.isActive && (
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold text-[#8892a4] bg-[#8892a4]/10 border border-[#8892a4]/20">מושבת</span>
              )}
            </div>
            {member.position && <p className="text-[#8892a4] text-sm mt-0.5">{member.position}{member.department ? ` · ${member.department}` : ''}</p>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <div className="flex items-center gap-2 text-sm text-[#8892a4]">
                <Mail size={14} className="flex-shrink-0" />{member.email}
              </div>
              {member.phone && (
                <div className="flex items-center gap-2 text-sm text-[#8892a4]">
                  <Phone size={14} className="flex-shrink-0" />{member.phone}
                </div>
              )}
              {member.lastLoginAt && (
                <div className="flex items-center gap-2 text-sm text-[#8892a4]">
                  <Clock size={14} className="flex-shrink-0" />התחברות אחרונה: {formatDate(member.lastLoginAt)}
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-[#8892a4]">
                <Calendar size={14} className="flex-shrink-0" />הצטרף: {formatDate(member.joinedAt ?? member.createdAt)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit form */}
      <div className="mb-6">
        <StaffForm
          membershipId={params.id}
          currentUserId={userId}
          viewerRole={memberRole}
          staff={{
            userId:     member.userId,
            memberRole: member.memberRole,
            isActive:   member.isActive,
            name:       member.name,
            email:      member.email,
            phone:      member.phone,
            department: member.department,
            position:   member.position,
          }}
        />
      </div>

      {/* Recent activity (admins only) */}
      {canAdmin && recentActivity.length > 0 && (
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[#8892a4] uppercase tracking-wide mb-4">פעילות אחרונה</h2>
          <AuditTimeline entries={recentActivity} compact />
        </div>
      )}
    </div>
  )
}
