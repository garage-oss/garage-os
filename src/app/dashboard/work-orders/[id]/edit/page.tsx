import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requireOrg } from '@/lib/org'
import { WorkOrderForm } from '@/components/work-orders/WorkOrderForm'
import { toNum } from '@/lib/utils'

interface Props { params: { id: string } }

export default async function EditWorkOrderPage({ params }: Props) {
  const { orgId } = await requireOrg()
  const wo = await prisma.workOrder.findFirst({
    where: { id: params.id, organizationId: orgId },
    include: { customer: true, vehicle: true },
  })

  if (!wo) notFound()

  const [customers, vehicles] = await Promise.all([
    prisma.customer.findMany({ where: { organizationId: orgId }, orderBy: { name: 'asc' } }),
    prisma.vehicle.findMany({ where: { organizationId: orgId }, orderBy: [{ make: 'asc' }, { model: 'asc' }] }),
  ])

  const workOrderData = {
    id: wo.id,
    customerId: wo.customerId,
    vehicleId: wo.vehicleId,
    complaint: wo.complaint,
    diagnosis: wo.diagnosis,
    assignedTechnician: wo.assignedTechnician,
    laborHours: toNum(wo.laborHours),
    laborRate: toNum(wo.laborRate),
    mileage: wo.mileage,
    notes: wo.notes,
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted mb-6 flex-wrap">
        <Link href="/dashboard/work-orders" className="hover:text-[#e2e8f0] transition-colors">
          פקודות עבודה
        </Link>
        <ChevronRight size={14} className="rotate-180" />
        <Link
          href={`/dashboard/work-orders/${wo.id}`}
          className="hover:text-[#e2e8f0] transition-colors font-mono"
        >
          {wo.workOrderNumber}
        </Link>
        <ChevronRight size={14} className="rotate-180" />
        <span className="text-[#e2e8f0]">עריכה</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">עריכת פקודת עבודה</h1>
        <p className="text-sm text-muted mt-0.5 font-mono">{wo.workOrderNumber}</p>
      </div>

      <WorkOrderForm
        customers={customers}
        vehicles={vehicles}
        mode="edit"
        workOrder={workOrderData}
      />
    </div>
  )
}
