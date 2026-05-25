import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { CustomerForm } from '@/components/customers/CustomerForm'

interface Props { params: { id: string } }

export default async function EditCustomerPage({ params }: Props) {
  const customer = await prisma.customer.findUnique({ where: { id: params.id } })
  if (!customer) notFound()

  return (
    <div>
      <div className="flex items-center gap-1.5 text-sm text-[#8892a4] mb-6 flex-wrap">
        <Link href="/dashboard/customers" className="hover:text-[#e2e8f0] transition-colors">לקוחות</Link>
        <ChevronRight size={14} className="rotate-180" />
        <Link href={`/dashboard/customers/${customer.id}`} className="hover:text-[#e2e8f0] transition-colors">{customer.name}</Link>
        <ChevronRight size={14} className="rotate-180" />
        <span className="text-[#e2e8f0]">עריכה</span>
      </div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">עריכת לקוח</h1>
        <p className="text-sm text-[#8892a4] mt-0.5">{customer.name}</p>
      </div>
      <CustomerForm mode="edit" customer={customer} />
    </div>
  )
}
