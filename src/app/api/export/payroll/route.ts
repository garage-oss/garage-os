/**
 * Payroll export — GET /api/export/payroll?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns a CSV of all clock entries in the date range, grouped by user.
 * Includes: user name, date, clock-in, clock-out, hours worked, job-hours.
 *
 * Requires OWNER or MANAGER role.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getOrgContext } from '@/lib/org'
import { prisma } from '@/lib/prisma'
import { canAccess } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

function pad(n: number) { return String(n).padStart(2, '0') }

function fmtTime(d: Date | null): string {
  if (!d) return ''
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function minutesToHours(min: number): string {
  return (min / 60).toFixed(2)
}

function csvRow(cells: (string | number)[]): string {
  return cells
    .map((c) => `"${String(c).replace(/"/g, '""')}"`)
    .join(',')
}

export async function GET(req: NextRequest) {
  const org = await getOrgContext()
  if (!org) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccess(org.memberRole, 'reports')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const fromStr = searchParams.get('from')
  const toStr   = searchParams.get('to')

  if (!fromStr || !toStr) {
    return NextResponse.json({ error: 'from and to query params are required (YYYY-MM-DD)' }, { status: 400 })
  }

  const from = new Date(`${fromStr}T00:00:00`)
  const to   = new Date(`${toStr}T23:59:59`)

  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
  }

  // Clock entries in range
  const clockEntries = await prisma.clockEntry.findMany({
    where: {
      organizationId: org.orgId,
      clockedInAt: { gte: from, lte: to },
    },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: [{ user: { name: 'asc' } }, { clockedInAt: 'asc' }],
  })

  // Time entries (per work-order labor) in range
  const timeEntries = await prisma.timeEntry.findMany({
    where: {
      workOrder: { organizationId: org.orgId },
      startedAt: { gte: from, lte: to },
      finishedAt: { not: null },
    },
    orderBy: { startedAt: 'asc' },
  })

  // Build a map of techId → total labor minutes
  const laborByTech = new Map<string, number>()
  for (const te of timeEntries) {
    if (!te.techId) continue
    laborByTech.set(te.techId, (laborByTech.get(te.techId) ?? 0) + te.durationMin)
  }

  // Build CSV
  const lines: string[] = []
  lines.push(csvRow([
    'שם עובד', 'אימייל', 'תאריך', 'כניסה', 'יציאה',
    'שעות נוכחות', 'שעות עבודה בפועל', 'הפרש',
  ]))

  for (const entry of clockEntries) {
    const clockInAt  = entry.clockedInAt
    const clockOutAt = entry.clockedOutAt

    const attendanceMin = clockOutAt
      ? Math.round((clockOutAt.getTime() - clockInAt.getTime()) / 60000) - entry.breakMinutes
      : 0

    const laborMin = laborByTech.get(entry.userId) ?? 0

    lines.push(csvRow([
      entry.user.name,
      entry.user.email,
      fmtDate(clockInAt),
      fmtTime(clockInAt),
      fmtTime(clockOutAt),
      minutesToHours(attendanceMin),
      minutesToHours(laborMin),
      minutesToHours(attendanceMin - laborMin),
    ]))
  }

  const csv = lines.join('\n')
  const filename = `payroll_${fromStr}_${toStr}.csv`

  return new NextResponse(csv, {
    status:  200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control':       'no-store',
    },
  })
}
