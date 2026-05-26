'use server'

import { prisma } from '@/lib/prisma'
import { requireOrg } from '@/lib/org'
import { revalidatePath } from 'next/cache'

export type TimerResult = { error: string } | { success: true; entryId: string }

/** Start a new timer for a work order. Pauses any already-running entry. */
export async function startTimer(workOrderId: string): Promise<TimerResult> {
  const { userId, orgId } = await requireOrg()

  // Look up user name
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
  if (!user) return { error: 'משתמש לא נמצא' }

  // Pause any running entry for this WO + tech
  await prisma.timeEntry.updateMany({
    where: { workOrderId, techId: userId, finishedAt: null, pausedAt: null },
    data:  { pausedAt: new Date() },
  })

  // Create new entry
  const entry = await prisma.timeEntry.create({
    data: {
      workOrderId,
      techId:    userId,
      techName:  user.name,
      startedAt: new Date(),
    },
  })

  // Auto-move WO to IN_PROGRESS if still PENDING
  await prisma.workOrder.updateMany({
    where: { id: workOrderId, organizationId: orgId, status: 'PENDING' },
    data:  { status: 'IN_PROGRESS' },
  })

  revalidatePath(`/mobile/jobs/${workOrderId}`)
  revalidatePath(`/dashboard/work-orders/${workOrderId}`)

  return { success: true, entryId: entry.id }
}

/** Pause the active timer. */
export async function pauseTimer(entryId: string): Promise<{ error?: string }> {
  const { userId } = await requireOrg()

  const entry = await prisma.timeEntry.findFirst({
    where: { id: entryId, techId: userId, finishedAt: null, pausedAt: null },
  })
  if (!entry) return { error: 'טיימר לא נמצא' }

  const elapsed = Math.floor((Date.now() - entry.startedAt.getTime()) / 60000)
  await prisma.timeEntry.update({
    where: { id: entryId },
    data:  { pausedAt: new Date(), durationMin: entry.durationMin + elapsed },
  })

  revalidatePath(`/mobile/jobs/${entry.workOrderId}`)
  return {}
}

/** Resume a paused timer. */
export async function resumeTimer(entryId: string): Promise<TimerResult> {
  const { userId } = await requireOrg()

  const paused = await prisma.timeEntry.findFirst({
    where: { id: entryId, techId: userId, pausedAt: { not: null }, finishedAt: null },
  })
  if (!paused) return { error: 'טיימר לא נמצא' }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })

  // Create a fresh segment (carry over accumulated minutes)
  const entry = await prisma.timeEntry.create({
    data: {
      workOrderId:  paused.workOrderId,
      techId:       userId,
      techName:     user?.name ?? paused.techName,
      startedAt:    new Date(),
      durationMin:  paused.durationMin,
    },
  })

  revalidatePath(`/mobile/jobs/${paused.workOrderId}`)
  return { success: true, entryId: entry.id }
}

/** Finish the active timer and optionally add a note. */
export async function finishTimer(entryId: string, notes?: string): Promise<{ error?: string }> {
  const { userId } = await requireOrg()

  const entry = await prisma.timeEntry.findFirst({
    where: { id: entryId, techId: userId, finishedAt: null },
  })
  if (!entry) return { error: 'טיימר לא נמצא' }

  const elapsed = entry.pausedAt
    ? 0
    : Math.floor((Date.now() - entry.startedAt.getTime()) / 60000)

  await prisma.timeEntry.update({
    where: { id: entryId },
    data:  { finishedAt: new Date(), durationMin: entry.durationMin + elapsed, notes: notes ?? null },
  })

  revalidatePath(`/mobile/jobs/${entry.workOrderId}`)
  revalidatePath(`/dashboard/work-orders/${entry.workOrderId}`)
  return {}
}

/** Add an internal technician note to a work order. */
export async function addTechNote(workOrderId: string, content: string): Promise<{ error?: string }> {
  const { userId } = await requireOrg()
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })

  if (!content.trim()) return { error: 'התוכן לא יכול להיות ריק' }

  await prisma.technicianNote.create({
    data: {
      workOrderId,
      content:    content.trim(),
      visibility: 'INTERNAL',
      authorName: user?.name ?? 'טכנאי',
    },
  })

  revalidatePath(`/mobile/jobs/${workOrderId}`)
  revalidatePath(`/dashboard/work-orders/${workOrderId}`)
  return {}
}
