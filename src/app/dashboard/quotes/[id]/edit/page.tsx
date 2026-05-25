import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { getQuote } from '@/lib/quotes'
import { prisma } from '@/lib/prisma'
import { QuoteForm } from '@/components/quotes/QuoteForm'

interface Props { params: { id: string } }

export default async function EditQuotePage({ params }: Props) {
  const [quote, customers, vehicles] = await Promise.all([
    getQuote(params.id),
    prisma.customer.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, phone: true } }),
    prisma.vehicle.findMany({ orderBy: { make: 'asc' }, select: { id: true, make: true, model: true, plate: true, customerId: true } }),
  ])

  if (!quote) notFound()

  const quoteData = {
    id: quote.id,
    laborHours: quote.laborHours,
    laborRate: quote.laborRate,
    notes: quote.notes,
    validUntil: quote.validUntil,
    customerId: quote.customer.id,
    vehicleId: quote.vehicle?.id ?? null,
    items: quote.items,
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 text-sm text-[#8892a4] mb-6 flex-wrap">
        <Link href="/dashboard/quotes" className="hover:text-[#e2e8f0] transition-colors">הצעות מחיר</Link>
        <ChevronRight size={14} className="rotate-180" />
        <Link href={`/dashboard/quotes/${quote.id}`} className="hover:text-[#e2e8f0] transition-colors font-mono">{quote.quoteNumber}</Link>
        <ChevronRight size={14} className="rotate-180" />
        <span className="text-[#e2e8f0]">עריכה</span>
      </div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">עריכת הצעת מחיר</h1>
        <p className="text-sm text-[#8892a4] mt-0.5 font-mono">{quote.quoteNumber}</p>
      </div>
      <QuoteForm
        customers={customers}
        vehicles={vehicles}
        mode="edit"
        quote={quoteData}
      />
    </div>
  )
}
