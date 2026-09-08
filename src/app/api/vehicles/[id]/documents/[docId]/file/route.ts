import { NextRequest, NextResponse }                from 'next/server'
import { getOrgContext }                            from '@/lib/org'
import { prisma }                                   from '@/lib/prisma'
import { createAuditLog }                           from '@/lib/audit'
import { docStorageRead, docStoragePresignUrl, isS3 } from '@/lib/doc-storage'
import { AuditAction }                              from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; docId: string } }
) {
  const org = await getOrgContext()
  if (!org) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const doc = await prisma.vehicleDocument.findFirst({
    where: { id: params.docId, vehicleId: params.id, organizationId: org.orgId },
    select: { id: true, storagePath: true, mimeType: true, originalFileName: true, documentType: true },
  })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  createAuditLog({
    orgId:       org.orgId,
    userId:      org.userId,
    userEmail:   org.userEmail,
    userName:    org.userName,
    action:      AuditAction.DOCUMENT_DOWNLOADED,
    entityType:  'vehicleDocument',
    entityId:    doc.id,
    entityLabel: doc.documentType,
  }).catch(() => null)

  if (isS3) {
    const url = await docStoragePresignUrl(doc.storagePath, 60)
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
