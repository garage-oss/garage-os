'use server'

import { revalidatePath }   from 'next/cache'
import { prisma }           from '@/lib/prisma'
import { requireOrg }       from '@/lib/org'
import { getPortalData }    from '@/lib/portal'
import { generateAutoQuote } from '@/lib/quote-engine'
import { generateQuoteNumber } from '@/lib/quotes'
import type {
  QuoteRequestServiceType,
  QuoteRequestUrgency,
} from '@prisma/client'
import type { PeriodicPortalData } from '@/lib/periodic-portal'

// ─── Portal: customer submits a quote request ─────────────────────────────────

export async function submitQuoteRequest(
  token:       string,
  serviceType: QuoteRequestServiceType,
  urgency:     QuoteRequestUrgency,
  description: string | null,
) {
  const wo = await getPortalData(token)

  // Guard: one request per work order
  const existing = await prisma.quoteRequest.findUnique({
    where: { workOrderId: wo.id },
  })
  if (existing) {
    return { error: 'כבר הוגשה בקשה להצעת מחיר עבור פקודה זו' }
  }

  const autoQuote = generateAutoQuote(serviceType, {
    make:  wo.vehicle.make,
    model: wo.vehicle.model,
    year:  wo.vehicle.year,
  })

  // Build a new quote number
  const quoteNumber = await generateQuoteNumber(wo.organizationId)

  const validUntil = new Date()
  validUntil.setDate(validUntil.getDate() + 14) // 2-week validity

  const quoteRequest = await prisma.$transaction(async (tx) => {
    // Create the auto-generated draft Quote (only if WO has none yet)
    if (!wo.quote) {
      await tx.quote.create({
        data: {
          organizationId: wo.organizationId,
          quoteNumber,
          status:         'DRAFT',
          customerId:     wo.customerId,
          vehicleId:      wo.vehicleId ?? undefined,
          workOrderId:    wo.id,
          laborHours:     autoQuote.laborHours,
          laborRate:      autoQuote.laborRate,
          partsTotal:     autoQuote.partsTotal,
          totalPrice:     autoQuote.total,
          isEstimate:     true,
          notes:          autoQuote.notes,
          validUntil,
          items: {
            create: autoQuote.parts.map(p => ({
              description: p.description,
              quantity:    p.quantity,
              unitPrice:   p.unitPrice,
              total:       p.total,
            })),
          },
        },
      })
    }

    // Create the QuoteRequest record
    return tx.quoteRequest.create({
      data: {
        organizationId: wo.organizationId,
        workOrderId:    wo.id,
        serviceType,
        urgency,
        description:    description ?? undefined,
        status:         'REVIEWING',
      },
    })
  })

  // Audit log
  await prisma.auditLog.create({
    data: {
      organizationId: wo.organizationId,
      action:         'CREATE',
      entityType:     'QuoteRequest',
      entityId:       quoteRequest.id,
      entityLabel:    `בקשת הצעה — פקודה ${wo.workOrderNumber}`,
      afterData: {
        serviceType,
        urgency,
        description,
        workOrderId: wo.id,
        autoTotal:   autoQuote.total,
      },
    },
  })

  revalidatePath(`/portal/${token}`)
  revalidatePath(`/portal/${token}/request-quote`)
  revalidatePath('/dashboard/quote-requests')

  return { success: true, quoteRequestId: quoteRequest.id }
}

// ─── Dashboard: send (edited) quote to customer ───────────────────────────────

export interface QuoteItemEdit {
  description: string
  quantity:    number
  unitPrice:   number
  total:       number
}

export async function sendQuoteToCustomer(
  quoteRequestId: string,
  opts: {
    laborHours:   number
    laborRate:    number
    notes:        string
    validDays:    number
    items:        QuoteItemEdit[]
    periodicData?: PeriodicPortalData
  },
) {
  const { orgId, userId, userEmail, userName } = await requireOrg()

  const qr = await prisma.quoteRequest.findUnique({
    where: { id: quoteRequestId, organizationId: orgId },
    include: {
      workOrder: {
        include: { quote: true, vehicle: true, customer: true },
      },
    },
  })
  if (!qr) throw new Error('Quote request not found')
  if (!qr.workOrder.quote) throw new Error('No quote on this work order')

  const quote      = qr.workOrder.quote
  const partsTotal = opts.items.reduce((s, i) => s + i.total, 0)
  const laborTotal = opts.laborHours * opts.laborRate
  const subtotal   = laborTotal + partsTotal
  const vat        = Math.round(subtotal * 0.17 * 100) / 100
  const totalPrice = Math.round((subtotal + vat) * 100) / 100

  const validUntil = new Date()
  validUntil.setDate(validUntil.getDate() + opts.validDays)

  const beforeData = {
    status:      quote.status,
    totalPrice:  quote.totalPrice,
    laborHours:  quote.laborHours,
  }

  await prisma.$transaction(async (tx) => {
    await tx.quoteItem.deleteMany({ where: { quoteId: quote.id } })

    await tx.quote.update({
      where: { id: quote.id },
      data: {
        status:       'SENT',
        laborHours:   opts.laborHours,
        laborRate:    opts.laborRate,
        partsTotal,
        totalPrice,
        notes:        opts.notes,
        validUntil,
        periodicData: opts.periodicData ? (opts.periodicData as object) : undefined,
        items: {
          create: opts.items.map(i => ({
            description: i.description,
            quantity:    i.quantity,
            unitPrice:   i.unitPrice,
            total:       i.total,
          })),
        },
      },
    })

    await tx.quoteRequest.update({
      where: { id: quoteRequestId },
      data:  { status: 'SENT' },
    })
  })

  await prisma.auditLog.create({
    data: {
      organizationId: orgId,
      userId,
      userEmail,
      userName,
      action:      'UPDATE',
      entityType:  'Quote',
      entityId:    quote.id,
      entityLabel: `הצעה ${quote.quoteNumber} — נשלחה ללקוח`,
      beforeData,
      afterData: {
        status: 'SENT',
        totalPrice,
        laborHours: opts.laborHours,
        items: opts.items.length,
      },
    },
  })

  revalidatePath('/dashboard/quote-requests')
  revalidatePath(`/dashboard/quote-requests/${quoteRequestId}`)

  return { success: true }
}

// ─── Dashboard: cancel / dismiss a quote request ─────────────────────────────

export async function cancelQuoteRequest(quoteRequestId: string) {
  const { orgId, userId, userEmail, userName } = await requireOrg()

  const qr = await prisma.quoteRequest.findUnique({
    where: { id: quoteRequestId, organizationId: orgId },
    select: { id: true, workOrder: { select: { workOrderNumber: true } } },
  })
  if (!qr) throw new Error('Quote request not found')

  await prisma.quoteRequest.update({
    where: { id: quoteRequestId },
    data:  { status: 'CANCELLED' },
  })

  await prisma.auditLog.create({
    data: {
      organizationId: orgId,
      userId,
      userEmail,
      userName,
      action:      'UPDATE',
      entityType:  'QuoteRequest',
      entityId:    qr.id,
      entityLabel: `בקשת הצעה — פקודה ${qr.workOrder.workOrderNumber} — בוטלה`,
      afterData:   { status: 'CANCELLED' },
    },
  })

  revalidatePath('/dashboard/quote-requests')
  revalidatePath(`/dashboard/quote-requests/${quoteRequestId}`)

  return { success: true }
}
