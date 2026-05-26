import { requireOrg } from '@/lib/org'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { hanesherConfigured } from '@/lib/mssql'
import { CheckCircle, XCircle, ArrowLeft, AlertTriangle, Users, Car, Package, Wrench, FileText, Tag } from 'lucide-react'

export default async function MigrationOverviewPage() {
  const ctx = await requireOrg()

  const configured = hanesherConfigured()

  const batches = await prisma.migrationBatch.findMany({
    where:   { organizationId: ctx.orgId },
    orderBy: { createdAt: 'desc' },
    take:    10,
    select: {
      id: true, status: true, isDryRun: true, isIncremental: true,
      totalRows: true, imported: true, skipped: true, failed: true,
      rolledBack: true, startedAt: true, completedAt: true,
      createdAt: true, userName: true, presetsUsed: true,
    },
  })

  const presetCount = await prisma.migrationPreset.count({
    where: { organizationId: ctx.orgId },
  })

  const STEPS = [
    { n: 1, href: '/dashboard/migration/setup',   title: 'הגדר חיבור',   desc: 'הוסף HANESHER_DB_* ל-.env ובדוק חיבור', done: configured },
    { n: 2, href: '/dashboard/migration/mapping',  title: 'מפה עמודות',   desc: 'בחר טבלאות מקור ומפה לשדות GarageOS', done: presetCount > 0 },
    { n: 3, href: '/dashboard/migration/import',   title: 'הרץ ייבוא',    desc: 'Dry-run קודם, אחר כך ייבוא אמיתי', done: batches.some(b => !b.isDryRun && b.status === 'COMPLETED') },
  ]

  return (
    <div className="space-y-6">
      {/* Connection banner */}
      <div className={`flex items-center gap-3 rounded-xl border px-5 py-4 ${
        configured
          ? 'bg-emerald-500/10 border-emerald-500/30'
          : 'bg-amber-500/10 border-amber-500/30'
      }`}>
        {configured
          ? <CheckCircle size={18} className="text-emerald-400 shrink-0" />
          : <AlertTriangle size={18} className="text-amber-400 shrink-0" />
        }
        <div>
          <p className={`text-sm font-semibold ${configured ? 'text-emerald-300' : 'text-amber-300'}`}>
            {configured ? 'פרטי ה-SQL Server מוגדרים' : 'פרטי ה-SQL Server לא הוגדרו'}
          </p>
          <p className="text-xs text-[#8892a4] mt-0.5">
            {configured
              ? 'HANESHER_DB_* נמצאים ב-.env'
              : 'הוסף HANESHER_DB_HOST, HANESHER_DB_NAME, HANESHER_DB_USER, HANESHER_DB_PASSWORD ל-.env'
            }
          </p>
        </div>
        <Link href="/dashboard/migration/setup" className="mr-auto text-xs text-[#6366f1] hover:underline flex items-center gap-1">
          פרטים <ArrowLeft size={12} />
        </Link>
      </div>

      {/* 3-step guide */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {STEPS.map((s) => (
          <Link
            key={s.n}
            href={s.href}
            className="group relative bg-[#1a1d27] border border-[#2e3147] hover:border-[#6366f1]/60 rounded-xl p-5 transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                s.done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[#6366f1]/20 text-[#6366f1]'
              }`}>
                {s.done ? '✓' : s.n}
              </span>
              <ArrowLeft size={14} className="text-[#8892a4] group-hover:text-[#6366f1] transition-colors" />
            </div>
            <h3 className="font-semibold text-white text-sm">{s.title}</h3>
            <p className="text-xs text-[#8892a4] mt-1">{s.desc}</p>
          </Link>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'פריסטים שמורים', value: presetCount, icon: Tag },
          { label: 'ייבואים שבוצעו', value: batches.filter(b => !b.isDryRun && b.status === 'COMPLETED').length, icon: CheckCircle },
          { label: 'dry-runs', value: batches.filter(b => b.isDryRun).length, icon: AlertTriangle },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-4 flex items-center gap-3">
            <Icon size={18} className="text-[#6366f1] shrink-0" />
            <div>
              <p className="text-xl font-bold text-white">{value}</p>
              <p className="text-xs text-[#8892a4]">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent batches */}
      {batches.length > 0 && (
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#2e3147]">
            <h3 className="text-sm font-semibold text-white">ריצות אחרונות</h3>
          </div>
          <div className="divide-y divide-[#2e3147]">
            {batches.map((b) => (
              <Link
                key={b.id}
                href={`/dashboard/migration/batch/${b.id}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-[#252836] transition-colors"
              >
                <StatusBadge status={b.status} isDryRun={b.isDryRun} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">
                    {(b.presetsUsed as string[]).join(', ')}
                  </p>
                  <p className="text-xs text-[#8892a4]">
                    {b.userName} · {new Date(b.createdAt).toLocaleDateString('he-IL')}
                  </p>
                </div>
                <div className="text-xs text-[#8892a4] text-end shrink-0">
                  <p className="text-emerald-400">{b.imported} נוצרו</p>
                  <p>{b.skipped} קיימים · {b.failed} שגיאות</p>
                </div>
                <ArrowLeft size={14} className="text-[#8892a4]" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status, isDryRun }: { status: string; isDryRun: boolean }) {
  if (isDryRun) return (
    <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
      dry-run
    </span>
  )
  const map: Record<string, string> = {
    COMPLETED:   'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    FAILED:      'bg-red-500/10 text-red-400 border-red-500/20',
    ROLLED_BACK: 'bg-[#8892a4]/10 text-[#8892a4] border-[#8892a4]/20',
    RUNNING:     'bg-[#6366f1]/10 text-[#6366f1] border-[#6366f1]/20',
    PENDING:     'bg-[#8892a4]/10 text-[#8892a4] border-[#8892a4]/20',
  }
  const labels: Record<string, string> = {
    COMPLETED: 'הושלם', FAILED: 'נכשל', ROLLED_BACK: 'בוטל', RUNNING: 'רץ', PENDING: 'ממתין',
  }
  return (
    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border ${map[status] ?? map.PENDING}`}>
      {labels[status] ?? status}
    </span>
  )
}
