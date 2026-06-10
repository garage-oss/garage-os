import { requireOrg, getOrgMembers, getOrgInvitations, ROLE_LABELS, ROLE_COLORS } from '@/lib/org'
import { isAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Users, CreditCard, Building2, Copy, Plug } from 'lucide-react'
import { InviteForm } from '@/components/settings/InviteForm'
import { TeamActions } from '@/components/settings/TeamActions'

export const dynamic = 'force-dynamic'

export default async function TeamPage() {
  const { orgId, memberRole, userId } = await requireOrg()

  const [members, invitations] = await Promise.all([
    getOrgMembers(orgId),
    getOrgInvitations(orgId),
  ])

  const canManage = isAdmin(memberRole)
  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">הגדרות</h1>
        <p className="text-sm text-[#8892a4] mt-0.5">ניהול פרופיל המוסך והצוות</p>
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { href: '/dashboard/settings',                          label: 'פרופיל',      icon: Building2 },
          { href: '/dashboard/settings/team',                     label: 'צוות',        icon: Users,     active: true },
          { href: '/dashboard/settings/billing',                  label: 'תכנית',       icon: CreditCard },
          { href: '/dashboard/settings/integrations/sql-server',  label: 'אינטגרציות',  icon: Plug },
        ].map(({ href, label, icon: Icon, active }) => (
          <Link key={href} href={href}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
              active
                ? 'bg-[#6366f1]/10 border-[#6366f1]/30 text-[#6366f1]'
                : 'bg-[#1a1d27] border-[#2e3147] text-[#8892a4] hover:text-[#e2e8f0] hover:bg-[#252836]'
            }`}>
            <Icon size={15} />{label}
          </Link>
        ))}
      </div>

      {/* Members */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden mb-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e3147]">
          <div>
            <h2 className="font-semibold">חברי הצוות</h2>
            <p className="text-xs text-[#8892a4] mt-0.5">{members.length} משתמשים פעילים</p>
          </div>
        </div>
        <div className="divide-y divide-[#2e3147]">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between px-5 py-3.5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#6366f1]/20 flex items-center justify-center text-[#6366f1] text-xs font-bold">
                  {m.user.name[0]}
                </div>
                <div>
                  <div className="text-sm font-medium">{m.user.name}</div>
                  <div className="text-xs text-[#8892a4]">{m.user.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[m.role]}`}>
                  {ROLE_LABELS[m.role]}
                </span>
                {canManage && m.userId !== userId && m.role !== 'OWNER' && (
                  <TeamActions memberId={m.id} currentRole={m.role} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden mb-4">
          <div className="px-5 py-4 border-b border-[#2e3147]">
            <h2 className="font-semibold">הזמנות ממתינות</h2>
          </div>
          <div className="divide-y divide-[#2e3147]">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-5 py-3.5">
                <div>
                  <div className="text-sm">{inv.email}</div>
                  <div className="text-xs text-[#8892a4]">
                    {ROLE_LABELS[inv.role]} · פג תוקף {new Date(inv.expiresAt).toLocaleDateString('he-IL')}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CopyInviteLink url={`${baseUrl}/invite/${inv.token}`} />
                  {canManage && <TeamActions invitationId={inv.id} isInvitation />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite form */}
      {canManage && <InviteForm />}
    </div>
  )
}

function CopyInviteLink({ url }: { url: string }) {
  return (
    <span className="text-xs text-[#8892a4] font-mono truncate max-w-[140px] hidden sm:block">{url}</span>
  )
}
