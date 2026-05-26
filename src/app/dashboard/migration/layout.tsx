import { requireOrg } from '@/lib/org'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Database, Settings2, Map, Play, History } from 'lucide-react'

const NAV = [
  { href: '/dashboard/migration',         label: 'סקירה',          icon: Database  },
  { href: '/dashboard/migration/setup',   label: 'חיבור ומקור',    icon: Settings2 },
  { href: '/dashboard/migration/mapping', label: 'מיפוי עמודות',   icon: Map       },
  { href: '/dashboard/migration/import',  label: 'הרצת ייבוא',     icon: Play      },
]

export default async function MigrationLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrg()
  if (ctx.memberRole !== 'OWNER') redirect('/unauthorized')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-[#6366f1]/10 border border-[#6366f1]/20">
          <Database size={20} className="text-[#6366f1]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">מחבר Hanesher SQL</h1>
          <p className="text-xs text-[#8892a4]">ייבוא נתונים ממסד הנתונים הקיים ל-GarageOS</p>
        </div>
      </div>

      {/* Sub-nav */}
      <nav className="flex items-center gap-1 border-b border-[#2e3147] pb-0">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-[#8892a4] hover:text-white border-b-2 border-transparent hover:border-[#6366f1]/50 transition-all -mb-px"
          >
            <Icon size={14} />
            {label}
          </Link>
        ))}
        <Link
          href="/dashboard/migration/import"
          className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-[#8892a4] hover:text-white border-b-2 border-transparent hover:border-[#6366f1]/50 transition-all -mb-px ms-auto"
        >
          <History size={14} />היסטוריה
        </Link>
      </nav>

      <div>{children}</div>
    </div>
  )
}
