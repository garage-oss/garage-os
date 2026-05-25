import { prisma } from '@/lib/prisma'

export type MediaFileData = {
  id: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  url: string
  uploadedBy: string | null
  createdAt: Date
}

export function isImage(mimeType: string) {
  return mimeType.startsWith('image/')
}

export function isVideo(mimeType: string) {
  return mimeType.startsWith('video/')
}

export function isAudio(mimeType: string) {
  return mimeType.startsWith('audio/')
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export async function getWorkOrderMedia(orgId: string, workOrderId: string): Promise<MediaFileData[]> {
  return prisma.mediaFile.findMany({
    where: { workOrderId, workOrder: { organizationId: orgId } },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getVehicleMedia(orgId: string, vehicleId: string): Promise<MediaFileData[]> {
  return prisma.mediaFile.findMany({
    where: { vehicleId, vehicle: { organizationId: orgId } },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getQuoteMedia(orgId: string, quoteId: string): Promise<MediaFileData[]> {
  return prisma.mediaFile.findMany({
    where: { quoteId, quote: { organizationId: orgId } },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getRecentUploads(
  orgId: string,
  take = 8
): Promise<
  (MediaFileData & {
    workOrder: { workOrderNumber: string } | null
    vehicle: { plate: string; make: string; model: string } | null
  })[]
> {
  return prisma.mediaFile.findMany({
    where: {
      OR: [
        { workOrder: { organizationId: orgId } },
        { vehicle: { organizationId: orgId } },
        { quote: { organizationId: orgId } },
      ],
    },
    take,
    orderBy: { createdAt: 'desc' },
    include: {
      workOrder: { select: { workOrderNumber: true } },
      vehicle: { select: { plate: true, make: true, model: true } },
    },
  })
}
