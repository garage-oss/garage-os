import { NextRequest, NextResponse }                    from 'next/server'
import { getCustomerSession }                            from '@/lib/customer-auth'
import { prisma }                                        from '@/lib/prisma'
import { createAuditLog }                                from '@/lib/audit'
import { validateDocUpload, buildDocPath, docStorageWrite } from '@/lib/doc-storage'
// storagePath is never returned to the client — only internal db field
import { AuditAction, DocumentType, ExtractionStatus, Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

// Simple in-memory rate limiter: max 10 uploads per customer per hour
const uploadCounts = new Map<string, { count: number; resetAt: number }>()
function checkRateLimit(customerId: string): boolean {
  const now  = Date.now()
  const rec  = uploadCounts.get(customerId)
  if (!rec || rec.resetAt < now) {
    uploadCounts.set(customerId, { count: 1, resetAt: now + 3600_000 })
    return true
  }
  if (rec.count >= 10) return false
  rec.count++
  return true
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { vehicleId: string } }
) {
  const ctx = await getCustomerSession()
  if (!ctx) return NextResponse.json({ error: 'לא מחובר' }, { status: 401 })

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: params.vehicleId, customerId: ctx.customerId, organizationId: ctx.organizationId },
    select: { id: true },
  })
  if (!vehicle) return NextResponse.json({ error: 'לא נמצא' }, { status: 404 })

  const docs = await prisma.vehicleDocument.findMany({
    where:   { vehicleId: vehicle.id, organizationId: ctx.organizationId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, documentType: true, originalFileName: true, mimeType: true,
      fileSize: true, issueDate: true, expiryDate: true, extractedData: true,
      extractionStatus: true, verifiedAt: true, verificationNote: true, createdAt: true,
    },
  })

  return NextResponse.json({ documents: docs })
}

export async function POST(
  req: NextRequest,
  { params }: { params: { vehicleId: string } }
) {
  const ctx = await getCustomerSession()
  if (!ctx) return NextResponse.json({ error: 'לא מחובר' }, { status: 401 })

  if (!checkRateLimit(ctx.customerId)) {
    return NextResponse.json({ error: 'יותר מדי העלאות. נסה שוב מאוחר יותר.' }, { status: 429 })
  }

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: params.vehicleId, customerId: ctx.customerId, organizationId: ctx.organizationId },
    select: { id: true },
  })
  if (!vehicle) return NextResponse.json({ error: 'לא נמצא' }, { status: 404 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'שגיאה בקריאת הנתונים' }, { status: 400 })
  }

  const file         = formData.get('file') as File | null
  const documentType = formData.get('documentType') as string | null
  const issueDate    = formData.get('issueDate') as string | null
  const expiryDate   = formData.get('expiryDate') as string | null

  if (!file) return NextResponse.json({ error: 'לא נבחר קובץ' }, { status: 400 })
  if (!documentType || !Object.values(DocumentType).includes(documentType as DocumentType)) {
    return NextResponse.json({ error: 'סוג מסמך לא תקין' }, { status: 400 })
  }

  const validation = validateDocUpload(file.type, file.size)
  if (!validation.valid) return NextResponse.json({ error: validation.error }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const { path: storagePath } = buildDocPath(ctx.organizationId, ctx.customerId, vehicle.id, file.type, file.name)

  await docStorageWrite(storagePath, buffer, file.type)

  // Attempt OCR extraction asynchronously — failures are non-fatal
  let extractedData:    Record<string, unknown> | null = null
  let extractionStatus: ExtractionStatus               = ExtractionStatus.MANUAL

  const isImage = file.type.startsWith('image/')
  if (isImage && process.env.ANTHROPIC_API_KEY && documentType !== 'OTHER') {
    try {
      const result = await extractDocumentData(buffer, file.type, documentType as DocumentType)
      if (result) {
        extractedData    = result
        extractionStatus = ExtractionStatus.COMPLETED
      }
    } catch {
      extractionStatus = ExtractionStatus.FAILED
    }
  }

  const doc = await prisma.vehicleDocument.create({
    data: {
      organizationId:   ctx.organizationId,
      customerId:       ctx.customerId,
      vehicleId:        vehicle.id,
      documentType:     documentType as DocumentType,
      storagePath,
      originalFileName: file.name,
      mimeType:         file.type,
      fileSize:         file.size,
      issueDate:        issueDate  ? new Date(issueDate)  : null,
      expiryDate:       expiryDate ? new Date(expiryDate) : null,
      extractedData:    extractedData !== null ? (extractedData as Prisma.InputJsonValue) : undefined,
      extractionStatus,
    },
  })

  // Audit log — never log file content, personal IDs or license numbers
  createAuditLog({
    orgId:       ctx.organizationId,
    action:      AuditAction.DOCUMENT_UPLOADED,
    entityType:  'vehicleDocument',
    entityId:    doc.id,
    entityLabel: `${documentType} — ${vehicle.id}`,
  }).catch(() => null)

  return NextResponse.json({ document: { ...doc, storagePath: undefined } }, { status: 201 })
}

async function extractDocumentData(
  buffer: Buffer,
  mimeType: string,
  docType: DocumentType,
): Promise<Record<string, unknown> | null> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client    = new Anthropic()

  const ext  = mimeType === 'image/png' ? 'png' : 'jpeg'
  const b64  = buffer.toString('base64')

  const typeHint: Record<DocumentType, string> = {
    VEHICLE_LICENSE:          'רישיון רכב ישראלי',
    MANDATORY_INSURANCE:      'ביטוח חובה ישראלי',
    DRIVER_LICENSE:           'רישיון נהיגה ישראלי',
    COMPREHENSIVE_INSURANCE:  'ביטוח מקיף/צד ג׳',
    POWER_OF_ATTORNEY:        'ייפוי כוח לטסט',
    OTHER:                    'מסמך',
  }

  const msg = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: `image/${ext}`, data: b64 },
        },
        {
          type: 'text',
          text: `זה ${typeHint[docType]}. חלץ את התאריכים הבאים בפורמט JSON בלבד (ללא הסברים):
{ "issueDate": "YYYY-MM-DD or null", "expiryDate": "YYYY-MM-DD or null" }
אם תאריך לא מופיע, השתמש ב-null. החזר JSON בלבד.`,
        },
      ],
    }],
  })

  const text  = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null

  const parsed = JSON.parse(match[0])
  // Return only extracted dates — no personal identifiers
  return {
    issueDate:  parsed.issueDate  ?? null,
    expiryDate: parsed.expiryDate ?? null,
  }
}
