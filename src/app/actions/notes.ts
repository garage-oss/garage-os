'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { NoteVisibility } from '@prisma/client'
import { requireOrg } from '@/lib/org'

export async function createNote(
  workOrderId: string,
  content: string,
  visibility: NoteVisibility,
  authorName?: string
): Promise<{ error?: string; id?: string }> {
  if (!content.trim()) return { error: 'תוכן הפתק לא יכול להיות ריק' }
  try {
    const { orgId } = await requireOrg()
    // Verify the work order belongs to this org
    const wo = await prisma.workOrder.findUnique({ where: { id: workOrderId, organizationId: orgId }, select: { id: true } })
    if (!wo) return { error: 'פקודת עבודה לא נמצאה' }

    const note = await prisma.technicianNote.create({
      data: { workOrderId, content: content.trim(), visibility, authorName: authorName?.trim() || null },
    })
    revalidatePath(`/dashboard/work-orders/${workOrderId}`)
    return { id: note.id }
  } catch {
    return { error: 'שגיאה בשמירת הפתק' }
  }
}

export async function deleteNote(id: string, workOrderId: string): Promise<{ error?: string }> {
  try {
    const { orgId } = await requireOrg()
    // Verify the work order belongs to this org before deleting its note
    const wo = await prisma.workOrder.findUnique({ where: { id: workOrderId, organizationId: orgId }, select: { id: true } })
    if (!wo) return { error: 'פקודת עבודה לא נמצאה' }

    await prisma.technicianNote.delete({ where: { id, workOrderId } })
    revalidatePath(`/dashboard/work-orders/${workOrderId}`)
    return {}
  } catch {
    return { error: 'שגיאה במחיקת הפתק' }
  }
}
