import { requireOrg } from '@/lib/org'
import { prisma } from '@/lib/prisma'
import { WorkOrderStatus } from '@prisma/client'
import { MobileJobCard } from '@/components/mobile/MobileJobCard'
import { Wrench, CheckCircle2, ClipboardList } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function MobileJobsPage() {
  const { orgId, userId, memberRole } = await requireOrg()

  // Fetch current user's name for matching assignedTechnician string
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
  const myName = me?.name ?? ''

  // All active work orders: if technician, filter to assigned; managers see all
  const isManager = memberRole === 'OWNER' || memberRole === 'MANAGER'
  const OPEN_STATUSES = ['PENDING', 'IN_PROGRESS', 'WAITING_PARTS'] as WorkOrderStatus[]
  const techFilter = isManager
    ? undefined
    : [
        { assignedTechnicianId: userId },
        { assignedTechnician:   { equals: myName, mode: 'insensitive' as const } },
      ]

  const [openJobs, completedToday] = await Promise.all([
    prisma.workOrder.findMany({
      where: {
        organizationId: orgId,
        status:         { in: OPEN_STATUSES },
        ...(techFilter ? { OR: techFilter } : {}),
      },
      include: {
        customer:    { select: { name: true, phone: true } },
        vehicle:     { select: { plate: true, make: true, model: true, year: true } },
        timeEntries: {
          where:   { techId: userId, finishedAt: null },
          orderBy: { startedAt: 'desc' },
          take:    1,
        },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.workOrder.count({
      where: {
        organizationId: orgId,
        status:         'COMPLETED',
        updatedAt:      { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        ...(techFilter ? { OR: techFilter } : {}),
      },
    }),
  ])

  const active = openJobs.filter((j) => j.status === 'IN_PROGRESS')

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">משימות שלי</h1>
        <p className="text-sm text-[#8892a4] mt-0.5">שלום, {me?.name}</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-[#6366f1]">{active.length}</div>
          <div className="text-[10px] text-[#8892a4] mt-0.5">פעיל</div>
        </div>
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-amber-400">{openJobs.length}</div>
          <div className="text-[10px] text-[#8892a4] mt-0.5">פתוח</div>
        </div>
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-emerald-400">{completedToday}</div>
          <div className="text-[10px] text-[#8892a4] mt-0.5">הושלמו היום</div>
        </div>
      </div>

      {/* Active job (first one if any) */}
      {active.length > 0 && (
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 mb-2 uppercase tracking-wide">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            בטיפול עכשיו
          </div>
          {active.slice(0, 1).map((job) => (
            <MobileJobCard
              key={job.id}
              job={{
                id:              job.id,
                workOrderNumber: job.workOrderNumber,
                status:          job.status,
                complaint:       job.complaint,
                assignedTechnician: job.assignedTechnician,
                customer:        job.customer,
                vehicle:         job.vehicle,
                createdAt:       job.createdAt.toISOString(),
              }}
              activeEntryId={job.timeEntries[0]?.id ?? null}
              highlight
            />
          ))}
        </div>
      )}

      {/* All open jobs */}
      {openJobs.length > 0 ? (
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#8892a4] mb-2 uppercase tracking-wide">
            <ClipboardList size={12} />
            כל המשימות ({openJobs.length})
          </div>
          <div className="space-y-3">
            {openJobs.map((job) => (
              <MobileJobCard
                key={job.id}
                job={{
                  id:              job.id,
                  workOrderNumber: job.workOrderNumber,
                  status:          job.status,
                  complaint:       job.complaint,
                  assignedTechnician: job.assignedTechnician,
                  customer:        job.customer,
                  vehicle:         job.vehicle,
                  createdAt:       job.createdAt.toISOString(),
                }}
                activeEntryId={job.timeEntries[0]?.id ?? null}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-4">
            <CheckCircle2 size={28} className="text-emerald-400" />
          </div>
          <div className="font-semibold text-lg">אין משימות פתוחות</div>
          <div className="text-sm text-[#8892a4] mt-1.5">כל המשימות הושלמו 🎉</div>
          <Link href="/dashboard/work-orders" className="mt-5 text-sm text-[#6366f1] hover:underline flex items-center gap-1.5">
            <Wrench size={14} />
            כל פקודות העבודה
          </Link>
        </div>
      )}
    </div>
  )
}
