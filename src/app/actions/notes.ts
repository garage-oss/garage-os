'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { NoteVisibility } from '@prisma/client'

export async function createNote(
  workOrderId: string,
  content: string,
  visibility: NoteVisibility,
  authorName?: string
): Promise<{ error?: string; id?: string }> {
  if (!content.trim()) return { error: 'תוכן הפתק לא יכול להיות ריק' }
  try {
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
    await prisma.technicianNote.delete({ where: { id } })
    revalidatePath(`/dashboard/work-orders/${workOrderId}`)
    return {}
  } catch {
    return { error: 'שגיאה במחיקת הפתק' }
  }
}
