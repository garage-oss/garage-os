import { NextRequest, NextResponse } from 'next/server'
import { getOrgContext }             from '@/lib/org'
import { prisma }                    from '@/lib/prisma'
import { createAuditLog }            from '@/lib/audit'
import { AuditAction }               from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const org = await getOrgContext()
  if (!org) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: params.id, organizationId: org.orgId },
    select: { id: true },
  })
  if (!vehicle) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const docs = await prisma.vehicleDocument.findMany({
    where:   { vehicleId: vehicle.id, organizationId: org.orgId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, documentType: true, originalFileName: true, mimeType: true,
      fileSize: true, issueDate: true, expiryDate: true,
      extractionStatus: true, verifiedAt: true, verifiedByUserId: true,
      verificationNote: true, createdAt: true, customerId: true,
    },
  })

  createAuditLog({
    orgId:       org.orgId,
    userId:      org.userId,
    userEmail:   org.userEmail,
    userName:    org.userName,
    action:      AuditAction.DOCUMENT_VIEWED,
    entityType:  'vehicleDocument',
    entityId:    vehicle.id,
    entityLabel: `vehicle:${vehicle.id}`,
  }).catch(() => null)

  return NextResponse.json({ documents: docs })
}
