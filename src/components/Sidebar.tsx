'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, Car, Wrench, Package, FileText,
  Settings, LogOut, Truck, Brain, ChevronUp,
} from 'lucide-react'
import { signOut } from 'next-auth/react'
import { PlanType, MemberRole } from '@prisma/client'
import { PLAN_LABELS, PLAN_COLORS } from '@/lib/org'

const navItems = [
  { href: '/dashboard', label: 'לוח בקרה', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/customers', label: 'לקוחות', icon: Users },
  { href: '/dashboard/vehicles', label: 'רכבים', icon: Car },
  { href: '/dashboard/work-orders', label: 'פקודות עבודה', icon: Wrench },
  { href: '/dashboard/inventory', label: 'מלאי', icon: Package },
  { href: '/dashboard/suppliers', label: 'ספקים', icon: Truck },
  { href: '/dashboard/quotes', label: 'הצעות מחיר', icon: FileText },
  { href: '/dashboard/diagnostics', label: 'אבחון AI', icon: Brain },
]

interface SidebarProps {
  orgName?: string
  orgPlan?: PlanType
  memberRole?: MemberRole
}

export default function Sidebar({ orgName, orgPlan, memberRole }: SidebarProps) {
  const pathname = usePathname()

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  const planLabel = orgPlan ? PLAN_LABELS[orgPlan] : null
  const planColor = orgPlan ? PLAN_COLORS[orgPlan] : ''
  const canManage = memberRole === 'OWNER' || memberRole === 'ADMIN'

  return (
    <aside className="fixed inset-y-0 start-0 w-[220px] bg-surface border-e border-[#2e3147] flex flex-col z-50">
      {/* Org Header */}
      <div className="px-4 py-4 border-b border-[#2e3147]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center font-black text-white text-lg flex-shrink-0">
            {orgName ? orgName[0] : 'G'}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-[14px] leading-tight truncate">{orgName ?? 'GarageOS'}</div>
            {planLabel && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 inline-block ${planColor}`}>
                {planLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact)
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                active
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted hover:bg-[#252836] hover:text-text-base',
              ].join(' ')}
            >
              <Icon size={16} className="flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-[#2e3147] px-2 py-3 space-y-0.5">
        {canManage && (
          <Link
            href="/dashboard/settings"
            className={[
              'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
              isActive('/dashboard/settings')
                ? 'bg-primary/15 text-primary'
                : 'text-muted hover:bg-[#252836] hover:text-text-base',
            ].join(' ')}
          >
            <Settings size={16} className="flex-shrink-0" />
            הגדרות
          </Link>
        )}
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-muted hover:bg-[#252836] hover:text-danger transition-all"
        >
          <LogOut size={16} className="flex-shrink-0" />
          יציאה
        </button>
      </div>
    </aside>
  )
}
