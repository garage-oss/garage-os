'use client'

import { useEffect }                         from 'react'
import { AlertTriangle, RefreshCw, LayoutDashboard } from 'lucide-react'
import Link                                  from 'next/link'
import { captureException }                  from '@/lib/sentry'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Dashboard-scoped error boundary — only catches errors that happen inside
 * the /dashboard route segment. The Sidebar and TopBar remain visible.
 */
export default function DashboardError({ error, reset }: Props) {
  useEffect(() => {
    captureException(error, { scope: 'dashboard', digest: error.digest })
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center gap-5">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20
                      flex items-center justify-center">
        <AlertTriangle size={30} className="text-red-400" />
      </div>

      <div>
        <h1 className="text-xl font-bold mb-1.5">שגיאה בטעינת הדף</h1>
        <p className="text-sm text-[#8892a4] max-w-sm leading-relaxed">
          אירעה שגיאה בטעינת התוכן. ניתן לנסות שנית או לחזור ללוח הבקרה.
        </p>
      </div>

      {error.digest && (
        <p className="text-xs font-mono text-[#8892a4]/70 bg-[#252836] rounded-lg px-3 py-1.5">
          {error.digest}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="flex items-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] text-white
                     text-sm font-medium rounded-xl px-4 py-2.5 transition-colors"
        >
          <RefreshCw size={14} />
          נסה שנית
        </button>
        <Link
          href="/dashboard"
          className="flex items-center gap-2 bg-[#1a1d27] border border-[#2e3147]
                     text-sm text-[#8892a4] hover:text-[#e2e8f0] font-medium
                     rounded-xl px-4 py-2.5 transition-colors"
        >
          <LayoutDashboard size={14} />
          לוח בקרה
        </Link>
      </div>
    </div>
  )
}
