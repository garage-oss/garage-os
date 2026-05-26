import { requireOrg } from '@/lib/org'
import { canAccess } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import {
  getKPISummary, getMonthlyRevenue, getRevenueByTechnician,
  getOpenJobsAging, getTopCustomers, shortMonth,
} from '@/lib/kpi'
import { KPICard } from '@/components/kpi/KPICard'
import { RevenueChart } from '@/components/kpi/RevenueChart'
import { HorizontalBar } from '@/components/kpi/HorizontalBar'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, Clock, Users, Wrench, Activity, BarChart2, Timer } from 'lucide-react'

export const dynamic = 'force-dynamic'

function fmtHours(h: number) {
  return `${h.toFixed(1)} שע׳`
}

function AgingCell({ bucket, count, max }: { bucket: string; count: number; max: number }) {
  const isUrgent = bucket.includes('14') || bucket.includes('7')
  const pct = max > 0 ? (count / max) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 text-xs text-[#8892a4] shrink-0">{bucket}</div>
      <div className="flex-1 h-2 bg-[#252836] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${isUrgent ? 'bg-red-500' : 'bg-[#6366f1]'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs font-bold w-6 text-end shrink-0 ${isUrgent && count > 0 ? 'text-red-400' : 'text-white'}`}>
        {count}
      </span>
    </div>
  )
}

export default async function KPIDashboardPage() {
  const { orgId, memberRole } = await requireOrg()
  if (!canAccess(memberRole, 'reports')) redirect('/dashboard')

  const [
    summary,
    monthly,
    byTech,
    aging,
    topCustomers,
  ] = await Promise.all([
    getKPISummary(orgId),
    getMonthlyRevenue(orgId),
    getRevenueByTechnician(orgId),
    getOpenJobsAging(orgId),
    getTopCustomers(orgId),
  ])

  const agingMax = Math.max(...aging.map((a) => a.count), 1)
  const totalOpenJobs = summary.pendingJobs + summary.inProgressJobs + summary.waitingParts

  // Months with data for chart label
  const lastMonth = monthly[monthly.length - 1]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">לוח KPI</h1>
        <p className="text-sm text-[#8892a4] mt-0.5">ביצועים עסקיים ומדדי יעילות</p>
      </div>

      {/* Top KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <KPICard
          label="סה״כ הכנסות"
          value={formatCurrency(summary.totalRevenue)}
          sub="עבודות שהושלמו"
          accent="#6366f1"
          icon={<TrendingUp size={11} />}
        />
        <KPICard
          label="עבודות שהושלמו"
          value={summary.completedJobs}
          sub={`${totalOpenJobs} פתוחות`}
          accent="#10b981"
          icon={<Wrench size={11} />}
        />
        <KPICard
          label="שעות עבודה"
          value={fmtHours(summary.laborHoursBilled)}
          sub={`${summary.laborHoursTotal.toFixed(1)} שע׳ סה״כ`}
          accent="#f59e0b"
          icon={<Clock size={11} />}
        />
        <KPICard
          label="זמן תיקון ממוצע"
          value={fmtHours(summary.avgRepairHours)}
          sub="מפתיחה לסגירה"
          accent="#8b5cf6"
          icon={<Timer size={11} />}
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-3 gap-3.5">
        <div className="bg-[#1a1d27] border border-amber-500/20 rounded-xl p-4 text-center">
          <div className="text-xl font-bold text-amber-400">{summary.pendingJobs}</div>
          <div className="text-xs text-[#8892a4] mt-0.5">ממתינות</div>
        </div>
        <div className="bg-[#1a1d27] border border-[#6366f1]/20 rounded-xl p-4 text-center">
          <div className="text-xl font-bold text-[#6366f1]">{summary.inProgressJobs}</div>
          <div className="text-xs text-[#8892a4] mt-0.5">בטיפול</div>
        </div>
        <div className="bg-[#1a1d27] border border-orange-500/20 rounded-xl p-4 text-center">
          <div className="text-xl font-bold text-orange-400">{summary.waitingParts}</div>
          <div className="text-xs text-[#8892a4] mt-0.5">ממתינות לחלקים</div>
        </div>
      </div>

      {/* Monthly Revenue Chart */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e3147]">
          <div className="flex items-center gap-2 font-semibold text-[15px]">
            <BarChart2 size={15} className="text-[#8892a4]" />
            הכנסות חודשיות — 12 חודשים אחרונים
          </div>
          {lastMonth && (
            <span className="text-xs text-[#6366f1] font-semibold">
              {shortMonth(lastMonth.month)}: {formatCurrency(lastMonth.revenue)}
            </span>
          )}
        </div>
        <div className="p-5">
          {monthly.some((m) => m.revenue > 0) ? (
            <RevenueChart data={monthly} height={180} />
          ) : (
            <div className="text-center text-sm text-[#8892a4] py-10">אין נתוני הכנסות עדיין</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Revenue by Technician */}
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-[#2e3147] font-semibold text-[15px]">
            <Activity size={15} className="text-[#8892a4]" />
            הכנסות לפי טכנאי
          </div>
          <div className="p-5">
            {byTech.length > 0 ? (
              <HorizontalBar
                items={byTech.map((t) => ({
                  label:    t.tech,
                  value:    t.revenue,
                  sublabel: `${t.count} עבודות`,
                }))}
                format={(v) => formatCurrency(v)}
              />
            ) : (
              <p className="text-sm text-[#8892a4] text-center py-6">אין נתונים עדיין</p>
            )}
          </div>
        </div>

        {/* Top Customers */}
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-[#2e3147] font-semibold text-[15px]">
            <Users size={15} className="text-[#8892a4]" />
            לקוחות מובילים
          </div>
          <div className="p-5">
            {topCustomers.length > 0 ? (
              <HorizontalBar
                items={topCustomers.map((c) => ({
                  label:    c.name,
                  value:    c.revenue,
                  sublabel: `${c.count} עבודות`,
                }))}
                format={(v) => formatCurrency(v)}
                color="#10b981"
              />
            ) : (
              <p className="text-sm text-[#8892a4] text-center py-6">אין נתונים עדיין</p>
            )}
          </div>
        </div>
      </div>

      {/* Open Jobs Aging */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e3147]">
          <div className="flex items-center gap-2 font-semibold text-[15px]">
            <Clock size={15} className="text-[#8892a4]" />
            גיל עבודות פתוחות
          </div>
          <span className="text-xs text-[#8892a4]">{totalOpenJobs} פתוחות</span>
        </div>
        <div className="p-5 space-y-3">
          {totalOpenJobs > 0 ? (
            aging.map((a) => (
              <AgingCell key={a.bucket} bucket={a.bucket} count={a.count} max={agingMax} />
            ))
          ) : (
            <p className="text-sm text-[#8892a4] text-center py-6">אין עבודות פתוחות</p>
          )}
        </div>
      </div>

      {/* Labor Efficiency */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5">
        <div className="flex items-center gap-2 font-semibold text-[15px] mb-4">
          <Timer size={15} className="text-[#8892a4]" />
          יעילות שעות עבודה
        </div>
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-xs text-[#8892a4] mb-1.5">
              <span>שעות חויבו / סה״כ</span>
              <span className="font-semibold text-white">{summary.laborHoursBilled.toFixed(1)} / {summary.laborHoursTotal.toFixed(1)} שע׳</span>
            </div>
            <div className="h-3 bg-[#252836] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#6366f1] to-[#818cf8]"
                style={{ width: `${summary.laborHoursTotal > 0 ? (summary.laborHoursBilled / summary.laborHoursTotal) * 100 : 0}%` }}
              />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#6366f1] w-16 text-end flex-shrink-0">
            {summary.laborHoursTotal > 0
              ? `${Math.round((summary.laborHoursBilled / summary.laborHoursTotal) * 100)}%`
              : '—'
            }
          </div>
        </div>
      </div>
    </div>
  )
}
