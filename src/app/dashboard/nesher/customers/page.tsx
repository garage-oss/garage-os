import { FileText, Settings, Users } from 'lucide-react'
import Link from 'next/link'
import { requireOrg } from '@/lib/org'
import { NesherCustomersTable } from '@/components/nesher/NesherCustomersTable'

export const dynamic = 'force-dynamic'

export default async function NesherCustomersPage() {
  const { memberRole } = await requireOrg()
  if (memberRole !== 'OWNER' && memberRole !== 'MANAGER') {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-[#8892a4] text-sm">נדרשת הרשאת מנהל</p>
      </div>
    )
  }

  const connectorUrl = process.env.NESHER_CONNECTOR_URL ?? 'http://localhost:4000'
  const keySet       = !!(process.env.NESHER_CONNECTOR_API_KEY)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users size={20} className="text-[#6366f1]" />
            <h1 className="text-xl font-bold">לקוחות נשר</h1>
          </div>
          <p className="text-sm text-[#8892a4]">נתונים חיים מ-{connectorUrl}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${keySet ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
            {keySet ? '🔑 API Key מוגדר' : '⚠ API Key חסר'}
          </span>
          <Link href="/dashboard/settings/integrations/nesher" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a1d27] border border-[#2e3147] text-[#8892a4] text-xs hover:text-[#e2e8f0] hover:border-[#6366f1]/40 transition-all">
            <Settings size={12} /> הגדרות
          </Link>
        </div>
      </div>

      {!keySet && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-4 text-sm text-amber-300">
          <p className="font-semibold">NESHER_CONNECTOR_API_KEY לא מוגדר</p>
          <p className="text-xs text-amber-400/80 mt-1">הוסף את המפתח ל-.env.local ואתחל מחדש את השרת.</p>
        </div>
      )}

      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5">
        <NesherCustomersTable />
      </div>
    </div>
  )
}
