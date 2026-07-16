'use client'

import Link            from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Car, CalendarPlus, CalendarClock, Phone } from 'lucide-react'
import { toWhatsAppUrl } from '@/lib/sms'

function WaIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.978-1.305A9.956 9.956 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.946 7.946 0 0 1-4.054-1.107l-.29-.173-3.005.787.803-2.926-.19-.3A7.952 7.952 0 0 1 4 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/>
    </svg>
  )
}

const NAV = [
  { href: '/portal',              icon: Home,          label: 'בית'         },
  { href: '/portal/vehicles',     icon: Car,           label: 'רכבים'       },
  { href: '/portal/book-service', icon: CalendarPlus,  label: 'קביעת טיפול' },
  { href: '/portal/appointments', icon: CalendarClock, label: 'תורים'       },
]

export function CustomerPortalNav({ orgName, orgPhone }: { orgName: string; orgPhone: string | null }) {
  const path = usePathname()

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-slate-100"
      dir="rtl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Contact strip */}
      {orgPhone && (
        <div className="flex items-center justify-center gap-3 py-2 border-b border-slate-50 bg-slate-50/70">
          <a
            href={`tel:${orgPhone}`}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 px-4 py-2 rounded-full shadow-sm active:scale-95 transition-transform"
          >
            <Phone size={12} /> חייג
          </a>
          <a
            href={toWhatsAppUrl(orgPhone)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-full shadow-sm active:scale-95 transition-transform"
          >
            <WaIcon /> וואטסאפ
          </a>
        </div>
      )}

      {/* Page tabs */}
      <div className="flex items-stretch divide-x divide-x-reverse divide-slate-100">
        {NAV.map(item => {
          const active = path === item.href || (item.href !== '/portal' && path.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[58px] active:bg-slate-50 transition-colors ${
                active ? 'text-indigo-600' : 'text-slate-400'
              }`}
            >
              <item.icon size={22} strokeWidth={active ? 2.5 : 2} />
              <span className={`text-[10px] font-semibold leading-none ${active ? 'text-indigo-600' : 'text-slate-400'}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
