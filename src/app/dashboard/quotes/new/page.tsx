import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requireOrg } from '@/lib/org'
import { QuoteForm } from '@/components/quotes/QuoteForm'

interface Props { searchParams: { customerId?: string } }

export default async function NewQuotePage({ searchParams }: Props) {
  const { orgId } = await requireOrg()
  const [customers, vehicles] = await Promise.all([
    prisma.customer.findMany({ where: { organizationId: orgId }, orderBy: { name: 'asc' }, select: { id: true, name: true, phone: true } }),
    prisma.vehicle.findMany({ where: { organizationId: orgId }, orderBy: { make: 'asc' }, select: { id: true, make: true, model: true, plate: true, customerId: true } }),
  ])

  return (
    <div>
      <div className="flex items-center gap-1.5 text-sm text-[#8892a4] mb-6">
        <Link href="/dashboard/quotes" className="hover:text-[#e2e8f0] transition-colors">הצעות מחיר</Link>
        <ChevronRight size={14} className="rotate-180" />
        <span className="text-[#e2e8f0]">הצעה חדשה</span>
      </div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">הצעת מחיר חדשה</h1>
        <p className="text-sm text-[#8892a4] mt-0.5">בנה הצעת מחיר ללקוח</p>
      </div>
      <QuoteForm customers={customers} vehicles={vehicles} mode="create" defaultCustomerId={searchParams.customerId} />
    </div>
  )
}
