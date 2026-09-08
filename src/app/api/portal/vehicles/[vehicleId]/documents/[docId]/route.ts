import { NextRequest, NextResponse } from 'next/server'
import { getCustomerSession }        from '@/lib/customer-auth'
import { prisma }                    from '@/lib/prisma'
import { createAuditLog }            from '@/lib/audit'
import { docStorageDelete }          from '@/lib/doc-storage'
import { AuditAction }               from '@prisma/client'

export const dynamic = 'force-dynamic'

type RouteCtx = { params: { vehicleId: string; docId: string } }

async function getOwnedDoc(customerId: string, organizationId: string, vehicleId: string, docId: string) {
  return prisma.vehicleDocument.findFirst({
    where: { id: docId, vehicleId, customerId, organizationId },
  })
}

export async function GET(req: NextRequest, { params }: RouteCtx) {
  const ctx = await getCustomerSession()
  if (!ctx) return NextResponse.json({ error: 'לא מחובר' }, { status: 401 })

  const doc = await getOwnedDoc(ctx.customerId, ctx.organizationId, params.vehicleId, params.docId)
  if (!doc) return NextResponse.json({ error: 'לא נמצא' }, { status: 404 })

  const { storagePath: _, ...safe } = doc
  return NextResponse.json({ document: safe })
}

export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  const ctx = await getCustomerSession()
  if (!ctx) return NextResponse.json({ error: 'לא מחובר' }, { status: 401 })

  const doc = await getOwnedDoc(ctx.customerId, ctx.organizationId, params.vehicleId, params.docId)
  if (!doc) return NextResponse.json({ error: 'לא נמצא' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const { issueDate, expiryDate, extractionStatus } = body

  const updated = await prisma.vehicleDocument.update({
    where: { id: doc.id },
    data: {
      issueDate:        issueDate        ? new Date(issueDate)        : doc.issueDate,
      expiryDate:       expiryDate       ? new Date(expiryDate)       : doc.expiryDate,
      extractionStatus: extractionStatus ?? doc.extractionStatus,
    },
  })

  const { storagePath: _, ...safe } = updated
  return NextResponse.json({ document: safe })
}

export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
  const ctx = await getCustomerSession()
  if (!ctx) return NextResponse.json({ error: 'לא מחובר' }, { status: 401 })

  const doc = await getOwnedDoc(ctx.customerId, ctx.organizationId, params.vehicleId, params.docId)
  if (!doc) return NextResponse.json({ error: 'לא נמצא' }, { status: 404 })

  await docStorageDelete(doc.storagePath)
  await prisma.vehicleDocument.delete({ where: { id: doc.id } })

  createAuditLog({
    orgId:       ctx.organizationId,
    action:      AuditAction.DOCUMENT_DELETED,
    entityType:  'vehicleDocument',
    entityId:    doc.id,
    entityLabel: `${doc.documentType} — ${params.vehicleId}`,
  }).catch(() => null)

  return NextResponse.json({ ok: true })
}
