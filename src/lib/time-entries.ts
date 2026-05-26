import { prisma } from './prisma'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActiveTimer {
  id:         string
  startedAt:  Date
  pausedAt:   Date | null
  durationMin: number   // accumulated minutes before current segment
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Total minutes including the running segment (if not paused). */
export function calcTotalMinutes(entry: {
  startedAt:  Date
  pausedAt:   Date | null
  finishedAt: Date | null
  durationMin: number
}): number {
  if (entry.finishedAt) return entry.durationMin
  if (entry.pausedAt)   return entry.durationMin
  const elapsed = Math.floor((Date.now() - entry.startedAt.getTime()) / 60000)
  return entry.durationMin + elapsed
}

export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Active (unfinished) time entry for a given work order + tech. */
export async function getActiveEntry(workOrderId: string, techId: string) {
  return prisma.timeEntry.findFirst({
    where: { workOrderId, techId, finishedAt: null },
    orderBy: { startedAt: 'desc' },
  })
}

/** All time entries for a work order. */
export async function getWorkOrderTimeEntries(workOrderId: string) {
  return prisma.timeEntry.findMany({
    where:   { workOrderId },
    orderBy: { startedAt: 'asc' },
  })
}

/** Sum of all finished entry minutes for a work order. */
export async function getTotalLoggedMinutes(workOrderId: string): Promise<number> {
  const entries = await prisma.timeEntry.findMany({ where: { workOrderId } })
  return entries.reduce((acc, e) => acc + calcTotalMinutes(e), 0)
}

/** Work orders assigned to a tech (by techId or name), open status. */
export async function getAssignedWorkOrders(orgId: string, techId: string, techName: string) {
  return prisma.workOrder.findMany({
    where: {
      organizationId: orgId,
      status:         { in: ['PENDING', 'IN_PROGRESS', 'WAITING_PARTS'] },
      OR: [
        { assignedTechnicianId: techId },
        { assignedTechnician:   { equals: techName, mode: 'insensitive' } },
      ],
    },
    include: {
      customer: { select: { name: true, phone: true } },
      vehicle:  { select: { plate: true, make: true, model: true, year: true } },
    },
    orderBy: { createdAt: 'asc' },
  })
}
