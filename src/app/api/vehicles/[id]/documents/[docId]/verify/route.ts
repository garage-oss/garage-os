import { NextRequest, NextResponse } from 'next/server'
import { getOrgContext }             from '@/lib/org'
import { prisma }                    from '@/lib/prisma'
import { createAuditLog }            from '@/lib/audit'
import { AuditAction, MemberRole }   from '@prisma/client'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES: MemberRole[] = [
  MemberRole.OWNER, MemberRole.MANAGER, MemberRole.SERVICE_ADVISOR
]

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; docId: string } }
) {
  const org = await getOrgContext()
  if (!org) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ALLOWED_ROLES.includes(org.memberRole)) {
    return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })
  }

  const doc = await prisma.vehicleDocument.findFirst({
    where: { id: params.docId, vehicleId: params.id, organizationId: org.orgId },
    select: { id: true, documentType: true },
  })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { note } = await req.json().catch(() => ({}))

  const updated = await prisma.vehicleDocument.update({
    where: { id: doc.id },
    data:  { verifiedAt: new Date(), verifiedByUserId: org.userId, verificationNote: note ?? null },
  })

  createAuditLog({
    orgId:       org.orgId,
    userId:      org.userId,
    userEmail:   org.userEmail,
    userName:    org.userName,
    action:      AuditAction.DOCUMENT_VERIFIED,
    entityType:  'vehicleDocument',
    entityId:    doc.id,
    entityLabel: doc.documentType,
  }).catch(() => null)

  const { storagePath: _, ...safe } = updated
  return NextResponse.json({ document: safe })
}
