import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireOrg } from '@/lib/org'
import { WorkOrderForm } from '@/components/work-orders/WorkOrderForm'
import { ChevronRight } from 'lucide-react'

export default async function NewWorkOrderPage() {
  const { orgId } = await requireOrg()
  const [customers, vehicles] = await Promise.all([
    prisma.customer.findMany({ where: { organizationId: orgId }, orderBy: { name: 'asc' } }),
    prisma.vehicle.findMany({ where: { organizationId: orgId }, orderBy: [{ make: 'asc' }, { model: 'asc' }] }),
  ])

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted mb-6">
        <Link href="/dashboard/work-orders" className="hover:text-[#e2e8f0] transition-colors">
          פקודות עבודה
        </Link>
        <ChevronRight size={14} className="rotate-180" />
        <span className="text-[#e2e8f0]">פקודה חדשה</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">פקודת עבודה חדשה</h1>
        <p className="text-sm text-muted mt-0.5">מלא את הפרטים ליצירת פקודת עבודה חדשה</p>
      </div>

      {customers.length === 0 ? (
        <div className="bg-surface border border-[#2e3147] rounded-xl p-10 text-center">
          <p className="text-muted mb-3">אין לקוחות במערכת</p>
          <p className="text-sm text-muted">יש ליצור לקוח לפני פתיחת פקודת עבודה</p>
        </div>
      ) : (
        <WorkOrderForm customers={customers} vehicles={vehicles} />
      )}
    </div>
  )
}
