import { NextRequest, NextResponse }                from 'next/server'
import { getCustomerSession }                       from '@/lib/customer-auth'
import { prisma }                                   from '@/lib/prisma'
import { createAuditLog }                           from '@/lib/audit'
import { docStorageRead, docStoragePresignUrl, isRemoteStorage } from '@/lib/doc-storage'
import { AuditAction }                              from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { vehicleId: string; docId: string } }
) {
  const ctx = await getCustomerSession()
  if (!ctx) return NextResponse.json({ error: 'לא מחובר' }, { status: 401 })

  const doc = await prisma.vehicleDocument.findFirst({
    where: { id: params.docId, vehicleId: params.vehicleId, customerId: ctx.customerId, organizationId: ctx.organizationId },
    select: { id: true, storagePath: true, mimeType: true, originalFileName: true, documentType: true },
  })
  if (!doc) return NextResponse.json({ error: 'לא נמצא' }, { status: 404 })

  createAuditLog({
    orgId:       ctx.organizationId,
    action:      AuditAction.DOCUMENT_DOWNLOADED,
    entityType:  'vehicleDocument',
    entityId:    doc.id,
    entityLabel: doc.documentType,
  }).catch(() => null)

  if (isRemoteStorage) {
    const url = await docStoragePresignUrl(doc.storagePath, 120)
    return NextResponse.redirect(url!)
  }

  const buffer = await docStorageRead(doc.storagePath)
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type':        doc.mimeType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(doc.originalFileName)}"`,
      'Cache-Control':       'private, no-store',
    },
  })
}
