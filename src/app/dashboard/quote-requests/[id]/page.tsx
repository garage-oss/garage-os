import { notFound }              from 'next/navigation'
import Link                       from 'next/link'
import { requireOrg }             from '@/lib/org'
import { prisma }                 from '@/lib/prisma'
import { toNum }                  from '@/lib/utils'
import { QuoteRequestDetail }     from '@/components/quote-requests/QuoteRequestDetail'
import {
  SERVICE_TYPE_LABELS,
  SERVICE_TYPE_ICONS,
  URGENCY_LABELS,
  URGENCY_COLORS,
} from '@/lib/quote-engine'
import { ArrowRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function QuoteRequestDetailPage({ params }: { params: { id: string } }) {
  const { orgId } = await requireOrg()

  const req = await prisma.quoteRequest.findUnique({
    where: { id: params.id, organizationId: orgId },
    include: {
      workOrder: {
        include: {
          vehicle: {
            select: {
              make: true, model: true, plate: true, year: true, color: true,
              engine: true, fuelType: true, transmission: true, mileage: true,
            },
          },
          customer: { select: { name: true, phone: true } },
          quote: {
            include: { items: { orderBy: { id: 'asc' } } },
          },
        },
      },
    },
  })

  if (!req) notFound()

  const wo    = req.workOrder
  const quote = wo.quote ?? null

  const detailData = {
    requestId:   req.id,
    status:      req.status,
    serviceType: req.serviceType,
    urgency:     req.urgency,
    description: req.description,
    createdAt:   req.createdAt,
    customer: wo.customer,
    vehicle: {
      make:         wo.vehicle.make,
      model:        wo.vehicle.model,
      plate:        wo.vehicle.plate,
      year:         wo.vehicle.year,
      color:        wo.vehicle.color  ?? null,
      engine:       wo.vehicle.engine ?? null,
      fuelType:     wo.vehicle.fuelType    ? String(wo.vehicle.fuelType)    : null,
      transmission: wo.vehicle.transmission ? String(wo.vehicle.transmission) : null,
      mileage:      wo.vehicle.mileage ?? null,
    },
    workOrder:   { workOrderNumber: wo.workOrderNumber, id: wo.id },
    quote: quote ? {
      id:          quote.id,
      quoteNumber: quote.quoteNumber,
      status:      quote.status,
      laborHours:  toNum(quote.laborHours),
      laborRate:   toNum(quote.laborRate),
      totalPrice:  toNum(quote.totalPrice),
      notes:       quote.notes,
      isEstimate:  quote.isEstimate,
      items: quote.items.map(i => ({
        id:          i.id,
        description: i.description,
        quantity:    i.quantity,
        unitPrice:   toNum(i.unitPrice),
        total:       toNum(i.total),
      })),
    } : null,
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      {/* Breadcrumb */}
      <Link
        href="/dashboard/quote-requests"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors"
      >
        <ArrowRight size={14} />
        כל הבקשות
      </Link>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-3xl shrink-0">
            {SERVICE_TYPE_ICONS[req.serviceType]}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900">
                {SERVICE_TYPE_LABELS[req.serviceType]}
              </h1>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${URGENCY_COLORS[req.urgency]}`}>
                דחיפות: {URGENCY_LABELS[req.urgency]}
              </span>
            </div>
            <p className="text-slate-500 text-sm mt-1">
              {wo.vehicle.make} {wo.vehicle.model} {wo.vehicle.year} · {wo.vehicle.plate}
            </p>
            <p className="text-slate-400 text-xs mt-0.5">
              {wo.customer.name} · {wo.customer.phone} · פקודה {wo.workOrderNumber}
            </p>
          </div>
          <Link
            href={`/dashboard/work-orders/${wo.id}`}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold shrink-0"
          >
            פקודת עבודה ←
          </Link>
        </div>

        {req.description && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">תיאור הלקוח</p>
            <p className="text-sm text-slate-700 leading-relaxed">{req.description}</p>
          </div>
        )}
      </div>

      {/* Quote editor / sender */}
      <QuoteRequestDetail data={detailData} />

    </div>
  )
}
