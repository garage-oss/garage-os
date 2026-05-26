'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireOrg } from '@/lib/org'

export interface ClockResult {
  error?:     string
  entryId?:   string
  clockedIn?: boolean
}

/** Clock in — opens a new ClockEntry for today */
export async function clockIn(): Promise<ClockResult> {
  try {
    const { orgId, userId } = await requireOrg()

    // Check if already clocked in
    const open = await prisma.clockEntry.findFirst({
      where: { organizationId: orgId, userId, clockedOutAt: null },
    })
    if (open) {
      return { error: 'כבר במשמרת פעילה', entryId: open.id, clockedIn: true }
    }

    const entry = await prisma.clockEntry.create({
      data: { organizationId: orgId, userId, clockedInAt: new Date() },
    })

    revalidatePath('/mobile/jobs')
    revalidatePath('/dashboard/clock')
    return { entryId: entry.id, clockedIn: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'שגיאה בכניסה לעבודה' }
  }
}

/** Clock out — closes the currently open ClockEntry */
export async function clockOut(notes?: string): Promise<ClockResult> {
  try {
    const { orgId, userId } = await requireOrg()

    const open = await prisma.clockEntry.findFirst({
      where: { organizationId: orgId, userId, clockedOutAt: null },
      orderBy: { clockedInAt: 'desc' },
    })

    if (!open) {
      return { error: 'אין משמרת פעילה לסיים', clockedIn: false }
    }

    await prisma.clockEntry.update({
      where: { id: open.id },
      data:  { clockedOutAt: new Date(), notes: notes ?? null },
    })

    revalidatePath('/mobile/jobs')
    revalidatePath('/dashboard/clock')
    return { entryId: open.id, clockedIn: false }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'שגיאה ביציאה מעבודה' }
  }
}

/** Get current clock status for the logged-in user */
export async function getClockStatus(): Promise<{
  clockedIn:   boolean
  entryId?:    string
  clockedInAt?: string
}> {
  try {
    const { orgId, userId } = await requireOrg()

    const open = await prisma.clockEntry.findFirst({
      where: { organizationId: orgId, userId, clockedOutAt: null },
      orderBy: { clockedInAt: 'desc' },
    })

    if (!open) return { clockedIn: false }
    return {
      clockedIn:   true,
      entryId:     open.id,
      clockedInAt: open.clockedInAt.toISOString(),
    }
  } catch {
    return { clockedIn: false }
  }
}
