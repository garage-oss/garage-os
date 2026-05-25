import { requireOrg } from '@/lib/org'
import { hasPermission } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { getAuditLogs, countAuditLogs, ENTITY_TYPE_LABELS, ACTION_LABELS, ACTION_COLORS } from '@/lib/audit'
import { AuditTimeline } from '@/components/audit/AuditTimeline'
import { AuditAction } from '@prisma/client'
import { Shield, ChevronRight, ChevronLeft } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 30

interface SearchParams {
  entityType?: string
  action?: string
  page?: string
}

interface Props {
  searchParams: SearchParams
}

const ENTITY_TYPES = Object.keys(ENTITY_TYPE_LABELS) as string[]

export default async function AuditPage({ searchParams }: Props) {
  const { orgId, memberRole } = await requireOrg()
  if (!hasPermission(memberRole, 'audit', 'read')) redirect('/unauthorized')

  const entityType = searchParams.entityType || ''
  const action     = (searchParams.action as AuditAction) || undefined
  const page       = Math.max(1, parseInt(searchParams.page ?? '1'))
  const skip       = (page - 1) * PAGE_SIZE

  const [entries, total] = await Promise.all([
    getAuditLogs(orgId, { entityType: entityType || undefined, action, take: PAGE_SIZE, skip }),
    countAuditLogs(orgId, { entityType: entityType || undefined, action }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  function buildUrl(params: Partial<SearchParams>) {
    const p = new URLSearchParams({ entityType, action: action ?? '', page: String(page), ...params })
    return `/dashboard/audit?${p}`
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[#6366f1]/15 flex items-center justify-center">
          <Shield size={20} className="text-[#6366f1]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">יומן פעולות</h1>
          <p className="text-sm text-[#8892a4] mt-0.5">{total.toLocaleString()} פעולות מתועדות</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Entity type filter */}
        <div className="flex flex-wrap gap-1.5">
          <Link
            href={buildUrl({ entityType: '', page: '1' })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!entityType ? 'bg-[#6366f1] text-white' : 'bg-[#252836] text-[#8892a4] hover:text-[#e2e8f0]'}`}
          >
            הכל
          </Link>
          {ENTITY_TYPES.map((et) => (
            <Link
              key={et}
              href={buildUrl({ entityType: et, page: '1' })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${entityType === et ? 'bg-[#6366f1] text-white' : 'bg-[#252836] text-[#8892a4] hover:text-[#e2e8f0]'}`}
            >
              {ENTITY_TYPE_LABELS[et]}
            </Link>
          ))}
        </div>
      </div>

      {/* Action type filter */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        <Link
          href={buildUrl({ action: '', page: '1' })}
          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${!action ? 'bg-[#252836] text-[#e2e8f0]' : 'text-[#8892a4] hover:text-[#e2e8f0]'}`}
        >
          כל הפעולות
        </Link>
        {(Object.keys(ACTION_LABELS) as AuditAction[]).map((a) => (
          <Link
            key={a}
            href={buildUrl({ action: a, page: '1' })}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${action === a ? ACTION_COLORS[a] : 'text-[#8892a4] hover:text-[#e2e8f0]'}`}
          >
            {ACTION_LABELS[a]}
          </Link>
        ))}
      </div>

      {/* Timeline */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5">
        {entries.length === 0 ? (
          <div className="text-center py-12">
            <Shield size={32} className="text-[#2e3147] mx-auto mb-3" />
            <p className="text-[#8892a4]">לא נמצאו פעולות</p>
          </div>
        ) : (
          <AuditTimeline entries={entries} />
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-5">
          <span className="text-sm text-[#8892a4]">עמוד {page} מתוך {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={buildUrl({ page: String(page - 1) })} className="flex items-center gap-1 px-3 py-2 bg-[#252836] rounded-lg text-sm text-[#8892a4] hover:text-[#e2e8f0] transition-colors">
                <ChevronRight size={14} />הקודם
              </Link>
            )}
            {page < totalPages && (
              <Link href={buildUrl({ page: String(page + 1) })} className="flex items-center gap-1 px-3 py-2 bg-[#252836] rounded-lg text-sm text-[#8892a4] hover:text-[#e2e8f0] transition-colors">
                הבא<ChevronLeft size={14} />
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
