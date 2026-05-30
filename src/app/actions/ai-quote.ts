'use server'
/**
 * Server actions for the AI Quote Engine:
 *   createQuoteFromAnalysis — turns a saved AiQuoteAnalysis into a Quote draft
 *   getAiQuoteAnalyses      — list analyses for the current org
 */

import { revalidatePath } from 'next/cache'
import { requireOrg } from '@/lib/org'
import { prisma } from '@/lib/prisma'
import { generateQuoteNumber } from '@/lib/quotes'
import { VAT_RATE } from '@/lib/ai-quote-engine'
import type { LaborOperation, PartRecommendation } from '@/lib/ai-quote-engine'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuoteDraftItem {
  description: string
  quantity:    number
  unitPrice:   number
}

export interface CreateQuoteDraftInput {
  analysisId:   string
  workOrderId?: string    // link to an existing work order
  customerId?:  string    // required if not linked to a WO
  vehicleId?:   string
  items:        QuoteDraftItem[]   // editable line items from the wizard
  laborRate:    number
  notes?:       string
}

export interface CreateQuoteDraftResult {
  quoteId:      string
  quoteNumber:  string
  workOrderId?: string | null
}

// ─── Create quote draft from analysis ────────────────────────────────────────

export async function createQuoteFromAnalysis(
  input: CreateQuoteDraftInput,
): Promise<{ ok: true; data: CreateQuoteDraftResult } | { ok: false; error: string }> {
  try {
    const { orgId } = await requireOrg()

    // Load the analysis (verify ownership)
    const analysis = await prisma.aiQuoteAnalysis.findFirst({
      where: { id: input.analysisId, organizationId: orgId },
      include: {
        workOrder: {
          select: { customerId: true, vehicleId: true, id: true },
        },
      },
    })

    if (!analysis) return { ok: false, error: 'ניתוח לא נמצא' }
    if (analysis.quoteId) return { ok: false, error: 'הצעה כבר נוצרה מניתוח זה' }

    // Resolve customer + vehicle from the WO if not provided
    const customerId = input.customerId ?? analysis.workOrder?.customerId
    const vehicleId  = input.vehicleId  ?? analysis.workOrder?.vehicleId  ?? null
    const workOrderId = input.workOrderId ?? analysis.workOrderId ?? null

    if (!customerId) return { ok: false, error: 'יש לשייך לקוח להצעה' }

    // Calculate totals from the editable line items
    const partsTotal    = input.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
    const laborHours    = 0  // labor is embedded in items
    const subtotal      = partsTotal
    const vatAmount     = Math.round(subtotal * VAT_RATE * 100) / 100
    const totalPrice    = Math.round((subtotal + vatAmount) * 100) / 100

    const quoteNumber = await generateQuoteNumber(orgId)

    const quote = await prisma.$transaction(async tx => {
      // Create the quote
      const q = await tx.quote.create({
        data: {
          organizationId: orgId,
          quoteNumber,
          status:        'DRAFT',
          laborHours:    analysis.totalLaborHours,
          laborRate:     input.laborRate,
          partsTotal,
          totalPrice,
          notes:         input.notes ?? `אבחון AI: ${analysis.diagnosis.slice(0, 200)}`,
          validUntil:    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),  // 14 days
          customerId,
          vehicleId:     vehicleId ?? undefined,
          workOrderId:   workOrderId ?? undefined,
          isEstimate:    false,
          items: {
            create: input.items.map(i => ({
              description: i.description,
              quantity:    i.quantity,
              unitPrice:   i.unitPrice,
              total:       Math.round(i.quantity * i.unitPrice * 100) / 100,
            })),
          },
        },
      })

      // Link analysis → quote
      await tx.aiQuoteAnalysis.update({
        where: { id: analysis.id },
        data:  { quoteId: q.id },
      })

      // Update work order total if linked
      if (workOrderId) {
        await tx.workOrder.update({
          where: { id: workOrderId },
          data:  {
            laborHours:  analysis.totalLaborHours,
            laborRate:   input.laborRate,
            partsTotal,
            totalPrice,
          },
        })
      }

      return q
    })

    revalidatePath('/dashboard/quotes')
    revalidatePath('/dashboard/ai-quote')
    if (workOrderId) revalidatePath(`/dashboard/work-orders/${workOrderId}`)

    return {
      ok:   true,
      data: {
        quoteId:     quote.id,
        quoteNumber: quote.quoteNumber,
        workOrderId,
      },
    }
  } catch (err) {
    console.error('[createQuoteFromAnalysis]', err)
    return { ok: false, error: 'שגיאה ביצירת הטיוטה' }
  }
}

// ─── List recent analyses for current org ─────────────────────────────────────

export interface AnalysisSummary {
  id:            string
  vehiclePlate:  string | null
  vehicleMake:   string | null
  vehicleModel:  string | null
  urgency:       string
  confidence:    number
  totalEstimate: number
  hasQuote:      boolean
  createdAt:     Date
}

export async function getAiQuoteAnalyses(): Promise<AnalysisSummary[]> {
  const { orgId } = await requireOrg()

  const rows = await prisma.aiQuoteAnalysis.findMany({
    where:   { organizationId: orgId },
    orderBy: { createdAt: 'desc' },
    take:    50,
    select: {
      id:            true,
      vehiclePlate:  true,
      vehicleMake:   true,
      vehicleModel:  true,
      urgency:       true,
      confidence:    true,
      totalEstimate: true,
      quoteId:       true,
      createdAt:     true,
    },
  })

  return rows.map(r => ({
    id:            r.id,
    vehiclePlate:  r.vehiclePlate,
    vehicleMake:   r.vehicleMake,
    vehicleModel:  r.vehicleModel,
    urgency:       r.urgency,
    confidence:    r.confidence,
    totalEstimate: Number(r.totalEstimate),
    hasQuote:      !!r.quoteId,
    createdAt:     r.createdAt,
  }))
}

// ─── Re-export engine types so pages can import from one place ─────────────────
export type { LaborOperation, PartRecommendation }
