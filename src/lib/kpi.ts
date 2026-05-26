import { prisma } from './prisma'
import { Prisma } from '@prisma/client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MonthRevenue { month: string; revenue: number }
export interface TechRevenue  { tech: string; revenue: number; count: number }
export interface AgingBucket  { bucket: string; count: number; order: number }
export interface TopCustomer  { name: string; revenue: number; count: number }
export interface KPISummary {
  totalRevenue:   number
  completedJobs:  number
  pendingJobs:    number
  inProgressJobs: number
  waitingParts:   number
  laborHoursTotal: number
  laborHoursBilled: number
  avgRepairHours: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Fill in missing months with 0 revenue, last 12 months ascending. */
function fillMonths(rows: { month: string; revenue: number }[]): MonthRevenue[] {
  const map = new Map(rows.map((r) => [r.month, r.revenue]))
  const result: MonthRevenue[] = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    result.push({ month: key, revenue: map.get(key) ?? 0 })
  }
  return result
}

/** Short month label for display (e.g. "2026-05" → "מאי"). */
export function shortMonth(ym: string): string {
  const [year, month] = ym.split('-').map(Number)
  const d = new Date(year, month - 1, 1)
  return d.toLocaleDateString('he-IL', { month: 'short', year: '2-digit' })
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getMonthlyRevenue(orgId: string): Promise<MonthRevenue[]> {
  const rows = await prisma.$queryRaw<{ month: string; revenue: string }[]>(
    Prisma.sql`
      SELECT
        TO_CHAR("createdAt", 'YYYY-MM') AS month,
        COALESCE(SUM("totalPrice"), 0)::text AS revenue
      FROM "WorkOrder"
      WHERE "organizationId" = ${orgId}
        AND status = 'COMPLETED'
        AND "createdAt" >= NOW() - INTERVAL '12 months'
      GROUP BY month
      ORDER BY month ASC
    `
  )
  const parsed = rows.map((r) => ({ month: r.month, revenue: parseFloat(r.revenue) }))
  return fillMonths(parsed)
}

export async function getRevenueByTechnician(orgId: string): Promise<TechRevenue[]> {
  const rows = await prisma.$queryRaw<{ tech: string; revenue: string; count: string }[]>(
    Prisma.sql`
      SELECT
        COALESCE("assignedTechnician", 'לא שויך') AS tech,
        COALESCE(SUM("totalPrice"), 0)::text AS revenue,
        COUNT(*)::text AS count
      FROM "WorkOrder"
      WHERE "organizationId" = ${orgId}
        AND status = 'COMPLETED'
      GROUP BY "assignedTechnician"
      ORDER BY SUM("totalPrice") DESC NULLS LAST
      LIMIT 10
    `
  )
  return rows.map((r) => ({
    tech:    r.tech,
    revenue: parseFloat(r.revenue),
    count:   parseInt(r.count, 10),
  }))
}

export async function getLaborStats(orgId: string) {
  const [all, completed] = await Promise.all([
    prisma.workOrder.aggregate({
      where: { organizationId: orgId },
      _sum:  { laborHours: true },
    }),
    prisma.workOrder.aggregate({
      where: { organizationId: orgId, status: 'COMPLETED' },
      _sum:  { laborHours: true },
    }),
  ])
  const total   = Number(all._sum.laborHours      ?? 0)
  const billed  = Number(completed._sum.laborHours ?? 0)
  const efficiency = total > 0 ? Math.round((billed / total) * 100) : 0
  return { total, billed, efficiency }
}

export async function getAvgRepairHours(orgId: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ avg_h: string | null }[]>(
    Prisma.sql`
      SELECT AVG(
        EXTRACT(EPOCH FROM ("updatedAt" - "createdAt")) / 3600.0
      )::text AS avg_h
      FROM "WorkOrder"
      WHERE "organizationId" = ${orgId}
        AND status = 'COMPLETED'
        AND "updatedAt" > "createdAt"
    `
  )
  const v = rows[0]?.avg_h
  return v ? Math.round(parseFloat(v) * 10) / 10 : 0
}

/** Bucket open jobs by age. Returns fixed 5-bucket array. */
export async function getOpenJobsAging(orgId: string): Promise<AgingBucket[]> {
  const rows = await prisma.$queryRaw<{ bucket: string; count: string }[]>(
    Prisma.sql`
      SELECT
        CASE
          WHEN EXTRACT(EPOCH FROM (NOW() - "createdAt")) / 86400 < 1   THEN '< יום'
          WHEN EXTRACT(EPOCH FROM (NOW() - "createdAt")) / 86400 < 3   THEN '1–3 ימים'
          WHEN EXTRACT(EPOCH FROM (NOW() - "createdAt")) / 86400 < 7   THEN '3–7 ימים'
          WHEN EXTRACT(EPOCH FROM (NOW() - "createdAt")) / 86400 < 14  THEN '7–14 ימים'
          ELSE '> 14 ימים'
        END AS bucket,
        COUNT(*)::text AS count
      FROM "WorkOrder"
      WHERE "organizationId" = ${orgId}
        AND status NOT IN ('COMPLETED', 'CANCELLED')
      GROUP BY bucket
    `
  )
  const ORDER = ['< יום', '1–3 ימים', '3–7 ימים', '7–14 ימים', '> 14 ימים']
  const map   = new Map(rows.map((r) => [r.bucket, parseInt(r.count, 10)]))
  return ORDER.map((b, i) => ({ bucket: b, count: map.get(b) ?? 0, order: i }))
}

export async function getTopCustomers(orgId: string, limit = 8): Promise<TopCustomer[]> {
  const rows = await prisma.$queryRaw<{ name: string; revenue: string; count: string }[]>(
    Prisma.sql`
      SELECT
        c.name,
        COALESCE(SUM(wo."totalPrice"), 0)::text AS revenue,
        COUNT(wo.id)::text AS count
      FROM "WorkOrder" wo
      JOIN "Customer" c ON c.id = wo."customerId"
      WHERE wo."organizationId" = ${orgId}
        AND wo.status = 'COMPLETED'
      GROUP BY c.id, c.name
      ORDER BY SUM(wo."totalPrice") DESC NULLS LAST
      LIMIT ${limit}
    `
  )
  return rows.map((r) => ({
    name:    r.name,
    revenue: parseFloat(r.revenue),
    count:   parseInt(r.count, 10),
  }))
}

export async function getKPISummary(orgId: string): Promise<KPISummary> {
  const [counts, revenueAgg, laborStats, avgHours] = await Promise.all([
    prisma.workOrder.groupBy({
      by:    ['status'],
      where: { organizationId: orgId },
      _count: true,
    }),
    prisma.workOrder.aggregate({
      where: { organizationId: orgId, status: 'COMPLETED' },
      _sum:  { totalPrice: true },
    }),
    getLaborStats(orgId),
    getAvgRepairHours(orgId),
  ])

  const byStatus = Object.fromEntries(counts.map((r) => [r.status, r._count]))
  return {
    totalRevenue:     Number(revenueAgg._sum.totalPrice ?? 0),
    completedJobs:    byStatus['COMPLETED']     ?? 0,
    pendingJobs:      byStatus['PENDING']       ?? 0,
    inProgressJobs:   byStatus['IN_PROGRESS']   ?? 0,
    waitingParts:     byStatus['WAITING_PARTS'] ?? 0,
    laborHoursTotal:  laborStats.total,
    laborHoursBilled: laborStats.billed,
    avgRepairHours:   avgHours,
  }
}
