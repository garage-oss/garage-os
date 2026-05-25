import { prisma } from '@/lib/prisma'
import { NoteVisibility } from '@prisma/client'

export type NoteData = {
  id: string
  content: string
  visibility: NoteVisibility
  authorName: string | null
  workOrderId: string
  createdAt: Date
}

export async function getWorkOrderNotes(workOrderId: string): Promise<NoteData[]> {
  return prisma.technicianNote.findMany({
    where: { workOrderId },
    orderBy: { createdAt: 'desc' },
  })
}
