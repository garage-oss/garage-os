import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requireOrg } from '@/lib/org'
import { PartForm } from '@/components/parts/PartForm'

export default async function NewPartPage() {
  const { orgId } = await requireOrg()
  const suppliers = await prisma.supplier.findMany({ where: { organizationId: orgId }, orderBy: { name: 'asc' }, select: { id: true, name: true } })

  return (
    <div>
      <div className="flex items-center gap-1.5 text-sm text-[#8892a4] mb-6">
        <Link href="/dashboard/inventory" className="hover:text-[#e2e8f0] transition-colors">מלאי</Link>
        <ChevronRight size={14} className="rotate-180" />
        <span className="text-[#e2e8f0]">חלק חדש</span>
      </div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">הוספת חלק חדש</h1>
        <p className="text-sm text-[#8892a4] mt-0.5">הזן את פרטי החלק והמלאי</p>
      </div>
      <PartForm suppliers={suppliers} mode="create" />
    </div>
  )
}
