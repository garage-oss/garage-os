import { requireOrg } from '@/lib/org'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, RotateCcw, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { RollbackButton } from '@/components/migration/RollbackButton'

export default async function BatchDetailPage({ params }: { params: { batchId: string } }) {
  const ctx = await requireOrg()

  const batch = await prisma.migrationBatch.findFirst({
    where: { id: params.batchId, organizationId: ctx.orgId },
    include: {
      logs: {
        orderBy: { createdAt: 'desc' },
        take:    500,
      },
    },
  })
  if (!batch) notFound()

  const actionColor: Record<string, string> = {
    CREATED:      'text-emerald-400',
    SKIPPED:      'text-[#8892a4]',
    FAILED:       'text-red-400',
    ROLLED_BACK:  'text-amber-400',
    UPDATED:      'text-[#6366f1]',
  }
  const actionLabel: Record<string, string> = {
    CREATED: 'נוצר', SKIPPED: 'קיים', FAILED: 'שגיאה', ROLLED_BACK: 'בוטל', UPDATED: 'עודכן',
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back */}
      <Link href="/dashboard/migration/import" className="flex items-center gap-1.5 text-sm text-[#8892a4] hover:text-white transition-colors">
        <ArrowRight size={14} />חזרה לייבוא
      </Link>

      {/* Header */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <BatchBadge status={batch.status} isDryRun={batch.isDryRun} />
              {batch.isIncremental && <span className="text-xs px-2 py-0.5 rounded-full bg-[#6366f1]/10 text-[#6366f1] border border-[#6366f1]/20">מצטבר</span>}
            </div>
            <p className="text-white font-semibold">{(batch.presetsUsed as string[]).join(', ')}</p>
            <p className="text-xs text-[#8892a4]">
              {batch.userName} ·{' '}
              {new Date(batch.createdAt).toLocaleDateString('he-IL', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          {!batch.isDryRun && !batch.rolledBack && batch.status === 'COMPLETED' && batch.imported > 0 && (
            <RollbackButton batchId={batch.id} />
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mt-5">
          {[
            { label: 'סה"כ', value: batch.totalRows, color: 'text-white' },
            { label: 'נוצרו', value: batch.imported, color: 'text-emerald-400' },
            { label: 'קיימים', value: batch.skipped, color: 'text-[#8892a4]' },
            { label: 'שגיאות', value: batch.failed, color: 'text-red-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[#252836] rounded-xl p-3 text-center">
              <p className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</p>
              <p className="text-xs text-[#8892a4] mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Log entries */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#2e3147] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">לוג ייבוא</h3>
          <span className="text-xs text-[#8892a4]">{batch.logs.length} רשומות (עד 500)</span>
        </div>
        <div className="divide-y divide-[#2e3147] max-h-[32rem] overflow-y-auto">
          {batch.logs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 px-5 py-2.5 hover:bg-[#252836] transition-colors">
              <span className={`text-xs font-medium w-16 shrink-0 pt-0.5 ${actionColor[log.action] ?? 'text-[#8892a4]'}`}>
                {actionLabel[log.action] ?? log.action}
              </span>
              <span className="text-xs text-[#6366f1] w-20 shrink-0 pt-0.5">{log.entity}</span>
              <span className="text-xs text-[#8892a4] w-28 shrink-0 pt-0.5 font-mono truncate">{log.sourceId ?? '—'}</span>
              <span className="text-xs text-white flex-1 truncate">{log.message ?? '—'}</span>
              <span className="text-xs text-[#8892a4] shrink-0">
                {new Date(log.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          ))}
          {batch.logs.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-[#8892a4]">אין רשומות לוג</div>
          )}
        </div>
      </div>
    </div>
  )
}

function BatchBadge({ status, isDryRun }: { status: string; isDryRun: boolean }) {
  if (isDryRun) return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">dry-run</span>
  const cfg: Record<string, string> = {
    COMPLETED:   'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    FAILED:      'bg-red-500/10 text-red-400 border-red-500/20',
    ROLLED_BACK: 'bg-[#8892a4]/10 text-[#8892a4] border-[#8892a4]/20',
    RUNNING:     'bg-[#6366f1]/10 text-[#6366f1] border-[#6366f1]/20',
  }
  const lbl: Record<string, string> = { COMPLETED: 'הושלם', FAILED: 'נכשל', ROLLED_BACK: 'בוטל', RUNNING: 'רץ', PENDING: 'ממתין' }
  return <span className={`text-xs px-2 py-0.5 rounded-full border ${cfg[status] ?? cfg.RUNNING}`}>{lbl[status] ?? status}</span>
}
