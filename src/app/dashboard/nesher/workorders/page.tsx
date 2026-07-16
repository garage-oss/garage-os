import { redirect }          from 'next/navigation'
import Link                  from 'next/link'
import { requireOrg }        from '@/lib/org'
import { WorkOrdersTable }   from '@/components/nesher/WorkOrdersTable'
import { FileText, Settings } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function NesherWorkOrdersPage() {
  const { memberRole } = await requireOrg()
  if (memberRole !== 'OWNER') redirect('/dashboard')

  const connectorUrl = process.env.NESHER_CONNECTOR_URL ?? 'http://localhost:4000'
  const keySet       = !!(process.env.NESHER_CONNECTOR_API_KEY)

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileText size={20} className="text-[#6366f1]" />
            <h1 className="text-xl font-bold">כרטיסיות עבודה — נשר</h1>
          </div>
          <p className="text-sm text-[#8892a4]">
            נתונים חיים מ-{connectorUrl}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Key status badge */}
          <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
            keySet
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
          }`}>
            {keySet ? '🔑 API Key מוגדר' : '⚠ API Key חסר'}
          </span>
          <Link
            href="/dashboard/settings/integrations/nesher"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a1d27] border border-[#2e3147] text-[#8892a4] text-xs hover:text-[#e2e8f0] hover:border-[#6366f1]/40 transition-all"
          >
            <Settings size={12} /> הגדרות
          </Link>
        </div>
      </div>

      {/* No-key warning */}
      {!keySet && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-4 text-sm text-amber-300 space-y-1">
          <p className="font-semibold">NESHER_CONNECTOR_API_KEY לא מוגדר</p>
          <p className="text-xs text-amber-400/80">
            הוסף לקובץ <code className="bg-amber-500/10 px-1 rounded">.env</code>:
            {' '}<code className="bg-amber-500/10 px-1 rounded">NESHER_CONNECTOR_API_KEY=המפתח_שלך</code>
            {' '}ואתחל את שרת הפיתוח.
          </p>
        </div>
      )}

      {/* Table (client component) */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5">
        <WorkOrdersTable />
      </div>

    </div>
  )
}
