import { requireOrg, PLAN_LABELS, PLAN_COLORS } from '@/lib/org'
import { isAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { OrgProfileForm } from '@/components/settings/OrgProfileForm'
import { Users, CreditCard, Building2, Hash, Globe, Plug } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const { orgId, memberRole } = await requireOrg()

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true, phone: true, address: true, city: true, vatId: true, website: true, plan: true, createdAt: true, slug: true },
  })

  if (!org) return null

  const canEdit = isAdmin(memberRole)

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">הגדרות</h1>
        <p className="text-sm text-[#8892a4] mt-0.5">ניהול פרופיל המוסך והצוות</p>
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { href: '/dashboard/settings',                            label: 'פרופיל',      icon: Building2, active: true  },
          { href: '/dashboard/settings/team',                       label: 'צוות',        icon: Users,     active: false },
          { href: '/dashboard/settings/billing',                    label: 'תכנית',       icon: CreditCard,active: false },
          { href: '/dashboard/settings/integrations/sql-server',    label: 'אינטגרציות',  icon: Plug,      active: false },
        ].map(({ href, label, icon: Icon, active }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
              active
                ? 'bg-[#6366f1]/10 border-[#6366f1]/30 text-[#6366f1]'
                : 'bg-[#1a1d27] border-[#2e3147] text-[#8892a4] hover:text-[#e2e8f0] hover:bg-[#252836]'
            }`}
          >
            <Icon size={15} />{label}
          </Link>
        ))}
      </div>

      {/* Profile card */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-6 mb-4">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-semibold">פרופיל המוסך</h2>
            <p className="text-xs text-[#8892a4] mt-0.5">פרטים שיוצגו ללקוחות ובמסמכים</p>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${PLAN_COLORS[org.plan]}`}>
            {PLAN_LABELS[org.plan]}
          </span>
        </div>

        {canEdit ? (
          <OrgProfileForm org={org} />
        ) : (
          <div className="space-y-3 text-sm">
            <div><span className="text-[#8892a4]">שם: </span>{org.name}</div>
            {org.phone   && <div><span className="text-[#8892a4]">טלפון: </span>{org.phone}</div>}
            {org.city    && <div><span className="text-[#8892a4]">עיר: </span>{org.city}</div>}
            {org.vatId   && <div className="flex items-center gap-1.5"><Hash size={12} className="text-[#8892a4]" /><span className="text-[#8892a4]">עוסק: </span>{org.vatId}</div>}
            {org.website && <div className="flex items-center gap-1.5"><Globe size={12} className="text-[#8892a4]" /><a href={org.website} className="text-[#6366f1] hover:underline" target="_blank" rel="noreferrer">{org.website}</a></div>}
          </div>
        )}
      </div>

      {/* Org meta */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-4">
        <div className="text-xs text-[#8892a4] mb-2 font-semibold uppercase tracking-wide">מידע מערכת</div>
        <div className="space-y-1.5 text-sm text-[#8892a4]">
          <div className="flex justify-between">
            <span>מזהה מוסך</span>
            <span className="font-mono text-xs">{org.slug}</span>
          </div>
          <div className="flex justify-between">
            <span>חבר מאז</span>
            <span>{new Date(org.createdAt).toLocaleDateString('he-IL')}</span>
          </div>
          <div className="flex justify-between">
            <span>תכנית</span>
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${PLAN_COLORS[org.plan]}`}>{PLAN_LABELS[org.plan]}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
