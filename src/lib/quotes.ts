import { prisma } from '@/lib/prisma'
import { toNum } from '@/lib/utils'
import { QuoteStatus } from '@prisma/client'

export type QuoteItem = {
  id: string
  description: string
  quantity: number
  unitPrice: number
  total: number
}

export type QuoteSummary = {
  id: string
  quoteNumber: string
  status: QuoteStatus
  totalPrice: number
  validUntil: Date | null
  createdAt: Date
  customer: { id: string; name: string; phone: string }
  vehicle: { id: string; make: string; model: string; plate: string; year: number } | null
}

export type QuoteDetail = QuoteSummary & {
  laborHours: number
  laborRate: number
  partsTotal: number
  notes: string | null
  workOrderId: string | null
  items: QuoteItem[]
}

export async function getQuotes(
  orgId: string,
  filters?: { status?: QuoteStatus; search?: string }
): Promise<QuoteSummary[]> {
  const quotes = await prisma.quote.findMany({
    where: {
      organizationId: orgId,
      AND: [
        filters?.status ? { status: filters.status } : {},
        filters?.search
          ? {
              OR: [
                { quoteNumber: { contains: filters.search, mode: 'insensitive' } },
                { customer: { name: { contains: filters.search, mode: 'insensitive' } } },
              ],
            }
          : {},
      ],
    },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      vehicle: { select: { id: true, make: true, model: true, plate: true, year: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return quotes.map((q) => ({
    id: q.id,
    quoteNumber: q.quoteNumber,
    status: q.status,
    totalPrice: toNum(q.totalPrice),
    validUntil: q.validUntil,
    createdAt: q.createdAt,
    customer: q.customer,
    vehicle: q.vehicle,
  }))
}

export async function getQuote(orgId: string, id: string): Promise<QuoteDetail | null> {
  const q = await prisma.quote.findFirst({
    where: { id, organizationId: orgId },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      vehicle: { select: { id: true, make: true, model: true, plate: true, year: true } },
      items: { orderBy: { id: 'asc' } },
    },
  })
  if (!q) return null
  return {
    id: q.id,
    quoteNumber: q.quoteNumber,
    status: q.status,
    totalPrice: toNum(q.totalPrice),
    laborHours: toNum(q.laborHours),
    laborRate: toNum(q.laborRate),
    partsTotal: toNum(q.partsTotal),
    notes: q.notes,
    validUntil: q.validUntil,
    workOrderId: q.workOrderId,
    createdAt: q.createdAt,
    customer: q.customer,
    vehicle: q.vehicle,
    items: q.items.map((i) => ({
      id: i.id,
      description: i.description,
      quantity: i.quantity,
      unitPrice: toNum(i.unitPrice),
      total: toNum(i.total),
    })),
  }
}

export async function generateQuoteNumber(orgId: string): Promise<string> {
  const year = new Date().getFullYear()
  const last = await prisma.quote.findFirst({
    where: { organizationId: orgId, quoteNumber: { startsWith: `QT-${year}-` } },
    orderBy: { quoteNumber: 'desc' },
  })
  const seq = last ? parseInt(last.quoteNumber.split('-')[2]) + 1 : 1
  return `QT-${year}-${String(seq).padStart(4, '0')}`
}

export async function getOpenQuotesCount(orgId: string): Promise<number> {
  return prisma.quote.count({
    where: { organizationId: orgId, status: { in: ['DRAFT', 'SENT'] } },
  })
}
