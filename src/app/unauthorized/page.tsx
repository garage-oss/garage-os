import Link from 'next/link'
import { ShieldOff, ArrowRight } from 'lucide-react'

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-[#13151f] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-3xl bg-red-500/10 flex items-center justify-center mx-auto mb-6">
          <ShieldOff size={36} className="text-red-400" />
        </div>
        <h1 className="text-3xl font-bold mb-2">גישה נדחתה</h1>
        <p className="text-[#8892a4] mb-2">אין לך הרשאה לגשת לדף זה.</p>
        <p className="text-sm text-[#8892a4] mb-8">
          אם לדעתך זו טעות, פנה לבעלים או מנהל הארגון שלך.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] text-white font-semibold rounded-xl px-6 py-3 transition-colors"
          >
            <ArrowRight size={16} className="rotate-180" />
            חזרה ללוח הבקרה
          </Link>
          <Link
            href="/dashboard/settings/team"
            className="flex items-center justify-center gap-2 bg-[#1a1d27] hover:bg-[#252836] border border-[#2e3147] text-[#e2e8f0] font-semibold rounded-xl px-6 py-3 transition-colors"
          >
            צור קשר עם המנהל
          </Link>
        </div>
        <p className="text-xs text-[#4a5065] mt-8">שגיאה 403 — Forbidden</p>
      </div>
    </div>
  )
}
