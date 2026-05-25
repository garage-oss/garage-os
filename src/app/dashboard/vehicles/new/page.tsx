import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requireOrg } from '@/lib/org'
import { VehicleForm } from '@/components/vehicles/VehicleForm'

interface Props { searchParams: { customerId?: string } }

export default async function NewVehiclePage({ searchParams }: Props) {
  const { orgId } = await requireOrg()
  const customers = await prisma.customer.findMany({ where: { organizationId: orgId }, orderBy: { name: 'asc' } })

  return (
    <div>
      <div className="flex items-center gap-1.5 text-sm text-[#8892a4] mb-6">
        <Link href="/dashboard/vehicles" className="hover:text-[#e2e8f0] transition-colors">רכבים</Link>
        <ChevronRight size={14} className="rotate-180" />
        <span className="text-[#e2e8f0]">רכב חדש</span>
      </div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">הוספת רכב חדש</h1>
        <p className="text-sm text-[#8892a4] mt-0.5">מלא את פרטי הרכב</p>
      </div>
      {customers.length === 0 ? (
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-10 text-center">
          <p className="text-[#8892a4] mb-3">אין לקוחות במערכת</p>
          <Link href="/dashboard/customers/new" className="text-sm text-[#6366f1] hover:underline">הוסף לקוח ראשון</Link>
        </div>
      ) : (
        <VehicleForm customers={customers} defaultCustomerId={searchParams.customerId} />
      )}
    </div>
  )
}
