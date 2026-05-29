'use client'

import Link         from 'next/link'
import { usePathname } from 'next/navigation'

interface Tab {
  href:  string
  icon:  string
  label: string
  exact?: boolean
}

export function PortalBottomNav({ token, hasQuote, hasPay, hasQuoteRequest }: {
  token:           string
  hasQuote:        boolean
  hasPay:          boolean
  hasQuoteRequest: boolean
}) {
  const pathname = usePathname()
  const base     = `/portal/${token}`

  const tabs: Tab[] = [
    { href: base,                          icon: '🏠', label: 'בית',      exact: true },
    { href: `${base}/timeline`,            icon: '📊', label: 'סטטוס'                  },
    { href: `${base}/media`,               icon: '📷', label: 'תמונות'                 },
    ...(hasQuote        ? [{ href: `${base}/quote`,         icon: '📋', label: 'הצעה'    }] : []),
    ...(hasPay          ? [{ href: `${base}/pay`,           icon: '💳', label: 'תשלום'   }] : []),
    ...(hasQuoteRequest ? [{ href: `${base}/request-quote`, icon: '📝', label: 'בקשה'    }] : []),
    { href: `${base}/history`,             icon: '🕓', label: 'היסטוריה'              },
  ]

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-slate-200 z-50 safe-bottom">
      <div className="flex">
        {tabs.map(tab => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href)

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`
                flex-1 flex flex-col items-center justify-center gap-0.5
                py-2.5 min-h-[56px] text-center transition-colors
                ${active
                  ? 'text-indigo-600'
                  : 'text-slate-400 hover:text-slate-600 active:bg-slate-50'
                }
              `}
            >
              <span className={`text-xl leading-none transition-transform ${active ? 'scale-110' : ''}`}>
                {tab.icon}
              </span>
              <span className={`text-[10px] font-semibold leading-none mt-0.5 ${active ? 'text-indigo-600' : ''}`}>
                {tab.label}
              </span>
              {active && (
                <span className="absolute bottom-1 w-4 h-0.5 bg-indigo-600 rounded-full" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
