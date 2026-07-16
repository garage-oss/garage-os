import { NextRequest, NextResponse } from 'next/server'
import { getCustomerSession }       from '@/lib/customer-auth'
import { prisma }                   from '@/lib/prisma'
import { nesherVehicleHistory }     from '@/lib/nesher-connector'

export const dynamic = 'force-dynamic'

const VAT_RATE    = parseFloat(process.env.VAT_RATE ?? '0.17')
const LABOR_RATE  = 295

interface QuoteItem {
  description: string
  quantity:    number
  unitPrice:   number
  laborHours:  number
  discount:    number
  itemType:    'part' | 'labor' | 'other'
  isEstimate?: boolean
}

const PERIODIC_DEFAULTS: QuoteItem[] = [
  { description: 'שמן מנוע',           quantity: 1, unitPrice: 180, laborHours: 0,   discount: 0, itemType: 'part' },
  { description: 'פילטר שמן',           quantity: 1, unitPrice:  45, laborHours: 0,   discount: 0, itemType: 'part' },
  { description: 'פילטר אוויר',         quantity: 1, unitPrice:  65, laborHours: 0,   discount: 0, itemType: 'part' },
  { description: 'פילטר קבינה (מזגן)',  quantity: 1, unitPrice:  55, laborHours: 0,   discount: 0, itemType: 'part' },
  { description: 'נוזל שמשות',          quantity: 1, unitPrice:  25, laborHours: 0,   discount: 0, itemType: 'part' },
  { description: 'חומרי ניקוי',         quantity: 1, unitPrice:  30, laborHours: 0,   discount: 0, itemType: 'part' },
  { description: 'טיפול תקופתי — עבודה', quantity: 1, unitPrice:   0, laborHours: 1.5, discount: 0, itemType: 'labor' },
  { description: 'בדיקת בלמים',          quantity: 1, unitPrice:   0, laborHours: 0.5, discount: 0, itemType: 'labor' },
]

const BRAKE_ITEMS: QuoteItem[] = [
  { description: 'רפידות בלמים קדמיות', quantity: 1, unitPrice: 280, laborHours: 0.75, discount: 0, itemType: 'part' },
  { description: 'בדיקת מערכת בלמים',   quantity: 1, unitPrice:   0, laborHours: 0.5,  discount: 0, itemType: 'labor' },
]

const DIAGNOSTIC_ITEMS: QuoteItem[] = [
  { description: 'אבחון ממוחשב',         quantity: 1, unitPrice:   0, laborHours: 1, discount: 0, itemType: 'labor', isEstimate: true },
  { description: 'בדיקה ויזואלית כללית', quantity: 1, unitPrice:   0, laborHours: 0.5, discount: 0, itemType: 'labor', isEstimate: true },
]

function itemsForService(serviceType: string): QuoteItem[] {
  switch (serviceType) {
    case 'periodic': return PERIODIC_DEFAULTS
    case 'brakes':   return BRAKE_ITEMS
    default:         return DIAGNOSTIC_ITEMS
  }
}

function calcLine(item: QuoteItem): number {
  const base = item.itemType === 'labor'
    ? item.laborHours * LABOR_RATE
    : item.quantity * item.unitPrice + item.laborHours * LABOR_RATE
  return Math.round(base * (1 - item.discount / 100) * 100) / 100
}

export async function POST(req: NextRequest) {
  const ctx = await getCustomerSession()
  if (!ctx) return NextResponse.json({ error: 'לא מחובר' }, { status: 401 })

  const body = await req.json() as {
    vehicleId:   string
    serviceType: string
    complaint:   string
    mileage:     number
    save?:       boolean   // true = actually save to DB
    bookingId?:  string
  }

  const { vehicleId, serviceType, complaint, mileage, save, bookingId } = body

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, customerId: ctx.customerId },
    select: { id: true, plate: true, make: true, model: true, year: true, importSource: true, importId: true },
  })
  if (!vehicle) return NextResponse.json({ error: 'רכב לא נמצא' }, { status: 404 })

  // Fetch NESHER history to check recently done items
  let nesherRows: Array<{ cli_comp1: string | null }> = []
  if (vehicle.importSource === 'nesher') {
    nesherRows = (await nesherVehicleHistory(vehicle.plate)) ?? []
  }

  const recentComplaints = nesherRows.slice(0, 2).map(r => (r.cli_comp1 ?? '').toLowerCase())
  const oilRecentlyDone  = recentComplaints.some(c => c.includes('שמן') || c.includes('oil') || c.includes('טיפול'))

  let items = itemsForService(serviceType)
  if (oilRecentlyDone && serviceType === 'periodic') {
    items = items.filter(it => !it.description.includes('שמן') && !it.description.includes('פילטר'))
  }

  const lineItems = items.map(it => ({ ...it, total: calcLine(it) }))
  const subtotal  = lineItems.reduce((s, it) => s + it.total, 0)
  const vatAmount = Math.round(subtotal * VAT_RATE * 100) / 100
  const total     = subtotal + vatAmount

  const isDiagnostic = serviceType !== 'periodic' && serviceType !== 'brakes' && serviceType !== 'tires'

  if (!save) {
    return NextResponse.json({ items: lineItems, subtotal, vatAmount, total, isDiagnostic, laborRate: LABOR_RATE })
  }

  // ── Save to PostgreSQL ──────────────────────────────────────────────────────
  const last = await prisma.quote.findFirst({
    where:   { organizationId: ctx.organizationId },
    orderBy: { createdAt: 'desc' },
    select:  { quoteNumber: true },
  })
  const nextNum     = String(parseInt((last?.quoteNumber?.replace(/\D/g, '') ?? '0'), 10) + 1).padStart(4, '0')
  const quoteNumber = `QP${nextNum}` // QP = quote from portal

  const quote = await prisma.quote.create({
    data: {
      organizationId: ctx.organizationId,
      customerId:     ctx.customerId,
      vehicleId:      vehicle.id,
      quoteNumber,
      status:         'SENT',
      laborRate:      LABOR_RATE,
      partsTotal:     lineItems.filter(i => i.itemType === 'part').reduce((s, i) => s + i.total, 0),
      totalPrice:     total,
      notes:          complaint || null,
      isEstimate:     isDiagnostic,
      portalToken:    undefined, // auto-generated by @default(cuid())
      portalTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      validUntil:     new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      items: {
        create: lineItems.map(it => ({
          description: it.description,
          quantity:    it.quantity,
          unitPrice:   it.unitPrice,
          total:       it.total,
          discount:    it.discount,
          laborHours:  it.laborHours,
          itemType:    it.itemType,
        })),
      },
    },
    select: { id: true, quoteNumber: true },
  })

  // Link quote to booking
  if (bookingId) {
    await prisma.serviceBooking.update({
      where: { id: bookingId },
      data:  { quoteId: quote.id },
    }).catch(() => null)
  }

  return NextResponse.json({ items: lineItems, subtotal, vatAmount, total, isDiagnostic, laborRate: LABOR_RATE, quoteId: quote.id, quoteNumber: quote.quoteNumber })
}
