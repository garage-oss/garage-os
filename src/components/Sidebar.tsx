'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Car, Wrench, Package, FileText, Settings, LogOut, Truck } from 'lucide-react'
import { signOut } from 'next-auth/react'

const navItems = [
  { href: '/dashboard', label: 'לוח בקרה', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/customers', label: 'לקוחות', icon: Users },
  { href: '/dashboard/vehicles', label: 'רכבים', icon: Car },
  { href: '/dashboard/work-orders', label: 'פקודות עבודה', icon: Wrench },
  { href: '/dashboard/inventory', label: 'מלאי', icon: Package },
  { href: '/dashboard/suppliers', label: 'ספקים', icon: Truck },
  { href: '/dashboard/quotes', label: 'הצעות מחיר', icon: FileText },
]

export default function Sidebar() {
  const pathname = usePathname()

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  return (
    <aside className="fixed inset-y-0 start-0 w-[220px] bg-surface border-e border-[#2e3147] flex flex-col z-50">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-[#2e3147]">
        <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center font-black text-white text-lg flex-shrink-0">
          G
        </div>
        <div>
          <div className="font-bold text-[15px] leading-tight">GarageOS</div>
          <div className="text-[11px] text-muted">ניהול מוסך</div>
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
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-muted hover:bg-[#252836] hover:text-text-base transition-all"
        >
          <Settings size={16} className="flex-shrink-0" />
          הגדרות
        </Link>
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
