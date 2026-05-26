'use client'

import { useEffect } from 'react'
import { AlertOctagon, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'
import { captureException } from '@/lib/sentry'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Root error boundary page — catches unhandled errors in the root layout children.
 * Must be a Client Component (Next.js requirement).
 */
export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    captureException(error, { digest: error.digest })
  }, [error])

  return (
    <html lang="he" dir="rtl">
      <body className="min-h-screen bg-[#0f1117] text-[#e2e8f0] flex items-center justify-center p-6
                       font-sans antialiased">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20
                          flex items-center justify-center mx-auto mb-6">
            <AlertOctagon size={40} className="text-red-400" />
          </div>

          <h1 className="text-2xl font-bold mb-2">שגיאה לא צפויה</h1>
          <p className="text-[#8892a4] mb-6 leading-relaxed">
            אירעה שגיאה בטעינת האפליקציה. אנא נסה שנית. אם הבעיה חוזרת, פנה לתמיכה.
          </p>

          {error.digest && (
            <p className="text-xs font-mono text-[#8892a4]/70 mb-6 bg-[#1a1d27] rounded-lg px-3 py-2">
              קוד שגיאה: {error.digest}
            </p>
          )}

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={reset}
              className="flex items-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] text-white
                         text-sm font-medium rounded-xl px-5 py-2.5 transition-colors"
            >
              <RefreshCw size={14} />
              נסה שנית
            </button>
            <Link
              href="/"
              className="flex items-center gap-2 bg-[#1a1d27] border border-[#2e3147]
                         text-sm font-medium rounded-xl px-5 py-2.5 text-[#8892a4]
                         hover:text-[#e2e8f0] transition-colors"
            >
              <Home size={14} />
              דף הבית
            </Link>
          </div>
        </div>
      </body>
    </html>
  )
}
