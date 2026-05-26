import { requireOrg } from '@/lib/org'
import { prisma } from '@/lib/prisma'
import { canAccess } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { ClockWidget } from '@/components/clock/ClockWidget'
import { PayrollExport } from '@/components/staff/PayrollExport'
import { Clock, TrendingUp } from 'lucide-react'

export const dynamic = 'force-dynamic'

function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} דק׳`
  if (m === 0) return `${h} שע׳`
  return `${h}:${String(m).padStart(2, '0')} שע׳`
}

export default async function ClockPage() {
  const { orgId, userId, memberRole } = await requireOrg()

  if (!canAccess(memberRole, 'clock')) {
    redirect('/unauthorized')
  }

  const isManager = memberRole === 'OWNER' || memberRole === 'MANAGER'

  // Current user clock status
  const openEntry = await prisma.clockEntry.findFirst({
    where: { organizationId: orgId, userId, clockedOutAt: null },
    orderBy: { clockedInAt: 'desc' },
  })

  // This week's entries for current user
  const startOfWeek = new Date()
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
  startOfWeek.setHours(0, 0, 0, 0)

  const weekEntries = await prisma.clockEntry.findMany({
    where: {
      organizationId: orgId,
      userId,
      clockedInAt: { gte: startOfWeek },
    },
    orderBy: { clockedInAt: 'desc' },
  })

  const totalWeekMinutes = weekEntries
    .filter((e) => e.clockedOutAt)
    .reduce((sum, e) => {
      const mins = Math.round(
        (e.clockedOutAt!.getTime() - e.clockedInAt.getTime()) / 60000
      ) - e.breakMinutes
      return sum + Math.max(0, mins)
    }, 0)

  // Technician utilization: labor minutes this week
  const weekTimeEntries = await prisma.timeEntry.findMany({
    where: {
      workOrder: { organizationId: orgId },
      techId: userId,
      startedAt: { gte: startOfWeek },
      finishedAt: { not: null },
    },
  })
  const weekLaborMinutes = weekTimeEntries.reduce((s, e) => s + e.durationMin, 0)
  const utilization = totalWeekMinutes > 0
    ? Math.round((weekLaborMinutes / totalWeekMinutes) * 100)
    : 0

  // Manager view: all staff today
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const todayEntries = isManager
    ? await prisma.clockEntry.findMany({
        where: { organizationId: orgId, clockedInAt: { gte: todayStart } },
        include: { user: { select: { name: true, avatarUrl: true } } },
        orderBy: { clockedInAt: 'desc' },
      })
    : []

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Clock size={20} className="text-[#6366f1]" />
          שעון נוכחות
        </h1>
        <p className="text-sm text-[#8892a4] mt-0.5">מעקב שעות עבודה ומשמרות</p>
      </div>

      {/* Clock in/out widget */}
      <ClockWidget
        initialClockedIn={!!openEntry}
        initialEntryId={openEntry?.id}
        initialClockInAt={openEntry?.clockedInAt.toISOString()}
      />

      {/* Weekly summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-4 text-center">
          <div className="text-xl font-bold text-[#6366f1]">
            {fmtDuration(totalWeekMinutes)}
          </div>
          <div className="text-[11px] text-[#8892a4] mt-1">שעות השבוע</div>
        </div>
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-4 text-center">
          <div className="text-xl font-bold text-emerald-400">
            {fmtDuration(weekLaborMinutes)}
          </div>
          <div className="text-[11px] text-[#8892a4] mt-1">שעות עבודה</div>
        </div>
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-4 text-center">
          <div className={`text-xl font-bold ${
            utilization >= 75 ? 'text-emerald-400'
            : utilization >= 50 ? 'text-amber-400'
            : 'text-red-400'
          }`}>
            {utilization}%
          </div>
          <div className="text-[11px] text-[#8892a4] mt-1">ניצולת</div>
        </div>
      </div>

      {/* This week's entries */}
      {weekEntries.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[#8892a4] uppercase tracking-wide mb-3 flex items-center gap-2">
            <TrendingUp size={13} />
            השבוע הנוכחי
          </h2>
          <div className="space-y-2">
            {weekEntries.map((entry) => {
              const mins = entry.clockedOutAt
                ? Math.max(0, Math.round(
                    (entry.clockedOutAt.getTime() - entry.clockedInAt.getTime()) / 60000
                  ) - entry.breakMinutes)
                : null
              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between bg-[#1a1d27] border border-[#2e3147] rounded-xl px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-medium">
                      {entry.clockedInAt.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric' })}
                    </div>
                    <div className="text-xs text-[#8892a4]">
                      {entry.clockedInAt.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                      {' → '}
                      {entry.clockedOutAt
                        ? entry.clockedOutAt.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
                        : 'עדיין עובד'}
                    </div>
                  </div>
                  {mins !== null ? (
                    <span className="text-sm font-semibold text-emerald-400">
                      {fmtDuration(mins)}
                    </span>
                  ) : (
                    <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
                      פעיל
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Manager: today's staff clock entries */}
      {isManager && todayEntries.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[#8892a4] uppercase tracking-wide mb-3">
            צוות היום
          </h2>
          <div className="space-y-2">
            {todayEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 bg-[#1a1d27] border border-[#2e3147] rounded-xl px-4 py-3"
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${entry.clockedOutAt ? 'bg-[#2e3147]' : 'bg-emerald-400 animate-pulse'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{entry.user.name}</div>
                  <div className="text-xs text-[#8892a4]">
                    {entry.clockedInAt.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                    {entry.clockedOutAt && ` – ${entry.clockedOutAt.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`}
                  </div>
                </div>
                <div className="text-xs">
                  {!entry.clockedOutAt ? (
                    <span className="text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">נוכח</span>
                  ) : (
                    <span className="text-[#8892a4]">
                      {fmtDuration(Math.max(0, Math.round(
                        (entry.clockedOutAt.getTime() - entry.clockedInAt.getTime()) / 60000
                      )))}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manager: payroll export */}
      {isManager && <PayrollExport />}
    </div>
  )
}
