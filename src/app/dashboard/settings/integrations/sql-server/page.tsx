/**
 * Settings > Integrations > SQL Server
 *
 * Server component: loads current config (if any) and passes it to the
 * client-side form.  OWNER role required.
 */

import { redirect }              from 'next/navigation'
import Link                      from 'next/link'
import { requireOrg }            from '@/lib/org'
import { getConfig }             from '@/lib/sql-server-integration'
import { SqlServerIntegrationForm } from '@/components/settings/SqlServerIntegrationForm'
import {
  Building2, Users, CreditCard, Plug,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function SqlServerIntegrationPage() {
  const { orgId, memberRole } = await requireOrg()

  if (memberRole !== 'OWNER') redirect('/dashboard/settings')

  const config = await getConfig(orgId)

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">הגדרות</h1>
        <p className="text-sm text-[#8892a4] mt-0.5">ניהול פרופיל המוסך והצוות</p>
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { href: '/dashboard/settings',                              label: 'פרופיל',       icon: Building2, active: false },
          { href: '/dashboard/settings/team',                         label: 'צוות',         icon: Users,     active: false },
          { href: '/dashboard/settings/billing',                      label: 'תכנית',        icon: CreditCard,active: false },
          { href: '/dashboard/settings/integrations/sql-server',      label: 'אינטגרציות',   icon: Plug,      active: true  },
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

      {/* Integrations sub-nav */}
      <div className="flex gap-2 mb-6 border-b border-[#2e3147] pb-3">
        <Link
          href="/dashboard/settings/integrations/sql-server"
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[#6366f1]/10 border border-[#6366f1]/30 text-[#6366f1]"
        >
          SQL Server
        </Link>
        <Link
          href="/dashboard/settings/integrations/nesher"
          className="px-3 py-1.5 rounded-lg text-sm text-[#8892a4] hover:text-[#e2e8f0] hover:bg-[#252836] transition-all"
        >
          נשר SQL Import
        </Link>
      </div>

      {/* SQL Server form */}
      <SqlServerIntegrationForm initialConfig={config} />
    </div>
  )
}
