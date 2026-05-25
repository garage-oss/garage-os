import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requireOrg } from '@/lib/org'
import { SupplierForm } from '@/components/suppliers/SupplierForm'

interface Props { params: { id: string } }

export default async function EditSupplierPage({ params }: Props) {
  const { orgId } = await requireOrg()
  const supplier = await prisma.supplier.findFirst({ where: { id: params.id, organizationId: orgId } })
  if (!supplier) notFound()

  return (
    <div>
      <div className="flex items-center gap-1.5 text-sm text-[#8892a4] mb-6 flex-wrap">
        <Link href="/dashboard/suppliers" className="hover:text-[#e2e8f0] transition-colors">ספקים</Link>
        <ChevronRight size={14} className="rotate-180" />
        <Link href={`/dashboard/suppliers/${supplier.id}`} className="hover:text-[#e2e8f0] transition-colors">{supplier.name}</Link>
        <ChevronRight size={14} className="rotate-180" />
        <span className="text-[#e2e8f0]">עריכה</span>
      </div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">עריכת ספק</h1>
        <p className="text-sm text-[#8892a4] mt-0.5">{supplier.name}</p>
      </div>
      <SupplierForm mode="edit" supplier={supplier} />
    </div>
  )
}
