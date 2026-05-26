'use client'

import { WifiOff, RefreshCw } from 'lucide-react'

/**
 * Offline fallback page — served by the service worker when the user navigates
 * to any page while offline.
 */
export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[#0f1117] text-[#e2e8f0] flex items-center justify-center p-6 font-sans">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 rounded-2xl bg-[#1a1d27] border border-[#2e3147]
                        flex items-center justify-center mx-auto mb-6">
          <WifiOff size={36} className="text-[#8892a4]" />
        </div>

        <h1 className="text-2xl font-bold mb-2">אין חיבור לאינטרנט</h1>
        <p className="text-[#8892a4] mb-8 leading-relaxed">
          נראה שאתה לא מחובר לאינטרנט כרגע.
          <br />
          בדוק את החיבור ונסה שנית.
        </p>

        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] text-white
                     text-sm font-medium rounded-xl px-6 py-3 transition-colors mx-auto"
        >
          <RefreshCw size={15} />
          נסה שנית
        </button>

        <p className="text-xs text-[#8892a4]/60 mt-8">
          GarageOS — מערכת ניהול מוסך
        </p>
      </div>
    </div>
  )
}
