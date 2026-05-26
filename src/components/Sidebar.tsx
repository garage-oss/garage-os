'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, Users, Car, Wrench, Package, FileText,
  Settings, LogOut, Truck, Brain, Shield, UserCog,
  BarChart2, ClipboardList, Smartphone, Clock,
} from 'lucide-react'
import { signOut } from 'next-auth/react'
import { PlanType, MemberRole } from '@prisma/client'
import { PLAN_LABELS, PLAN_COLORS, ROLE_LABELS, ROLE_COLORS } from '@/lib/org'
import { canAccess, isAdmin, AppModule } from '@/lib/rbac'

interface NavItem {
  href:   string
  label:  string
  icon:   LucideIcon
  exact?: boolean
  module: AppModule
}

const ALL_NAV: NavItem[] = [
  { href: '/dashboard',             label: 'לוח בקרה',     icon: LayoutDashboard, exact: true, module: 'workOrders' },
  { href: '/dashboard/intake',      label: 'קבלת רכב',     icon: ClipboardList,   module: 'intake'     },
  { href: '/dashboard/customers',   label: 'לקוחות',       icon: Users,           module: 'customers'  },
  { href: '/dashboard/vehicles',    label: 'רכבים',        icon: Car,             module: 'vehicles'   },
  { href: '/dashboard/work-orders', label: 'פקודות עבודה', icon: Wrench,          module: 'workOrders' },
  { href: '/dashboard/inventory',   label: 'מלאי',         icon: Package,         module: 'inventory'  },
  { href: '/dashboard/suppliers',   label: 'ספקים',        icon: Truck,           module: 'suppliers'  },
  { href: '/dashboard/quotes',      label: 'הצעות מחיר',  icon: FileText,        module: 'quotes'     },
  { href: '/dashboard/diagnostics', label: 'אבחון AI',     icon: Brain,           module: 'diagnostics'},
  { href: '/dashboard/kpi',         label: 'לוח KPI',      icon: BarChart2,       module: 'kpi'        },
  { href: '/dashboard/staff',       label: 'צוות',         icon: UserCog,         module: 'users'      },
  { href: '/dashboard/audit',       label: 'יומן פעולות',  icon: Shield,          module: 'audit'      },
  { href: '/mobile/jobs',           label: 'מצב טכנאי',    icon: Smartphone,      module: 'mobile'     },
  { href: '/dashboard/clock',       label: 'שעון נוכחות',  icon: Clock,           module: 'clock'      },
]

interface SidebarProps {
  orgName?:    string
  orgPlan?:    PlanType
  memberRole?: MemberRole
  userName?:   string
  userEmail?:  string
}

export default function Sidebar({ orgName, orgPlan, memberRole, userName, userEmail }: SidebarProps) {
  const pathname = usePathname()

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  const planLabel  = orgPlan ? PLAN_LABELS[orgPlan] : null
  const planColor  = orgPlan ? PLAN_COLORS[orgPlan] : ''
  const roleLabel  = memberRole ? ROLE_LABELS[memberRole] : null
  const roleColor  = memberRole ? ROLE_COLORS[memberRole] : ''
  const canManage  = memberRole ? isAdmin(memberRole) : false

  // Filter nav to only accessible modules; always show dashboard
  const visibleNav = ALL_NAV.filter((item) => {
    if (item.href === '/dashboard') return true
    if (!memberRole) return false
    return canAccess(memberRole, item.module)
  })

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
        {visibleNav.map(({ href, label, icon: Icon, exact }) => {
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

      {/* User + Footer */}
      <div className="border-t border-[#2e3147] px-2 py-3 space-y-0.5">
        {/* Current user role badge */}
        {roleLabel && (
          <div className="px-3 py-2 mb-1">
            <div className="text-xs text-[#8892a4] truncate">{userName ?? userEmail ?? 'משתמש'}</div>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 inline-block border ${roleColor}`}>
              {roleLabel}
            </span>
          </div>
        )}

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
