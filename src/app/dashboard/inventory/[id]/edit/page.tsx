import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { PartForm } from '@/components/parts/PartForm'
import { toNum } from '@/lib/utils'

interface Props { params: { id: string } }

export default async function EditPartPage({ params }: Props) {
  const part = await prisma.part.findUnique({ where: { id: params.id } })
  if (!part) notFound()

  const suppliers = await prisma.supplier.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } })

  const partData = {
    id: part.id,
    sku: part.sku,
    name: part.name,
    category: part.category,
    manufacturer: part.manufacturer,
    supplierId: part.supplierId,
    costPrice: toNum(part.costPrice),
    salePrice: toNum(part.salePrice),
    quantity: part.quantity,
    minQuantity: part.minQuantity,
    location: part.location,
    notes: part.notes,
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 text-sm text-[#8892a4] mb-6 flex-wrap">
        <Link href="/dashboard/inventory" className="hover:text-[#e2e8f0] transition-colors">מלאי</Link>
        <ChevronRight size={14} className="rotate-180" />
        <Link href={`/dashboard/inventory/${part.id}`} className="hover:text-[#e2e8f0] transition-colors font-mono">{part.sku}</Link>
        <ChevronRight size={14} className="rotate-180" />
        <span className="text-[#e2e8f0]">עריכה</span>
      </div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">עריכת חלק</h1>
        <p className="text-sm text-[#8892a4] mt-0.5 font-mono">{part.sku}</p>
      </div>
      <PartForm suppliers={suppliers} mode="edit" part={partData} />
    </div>
  )
}
