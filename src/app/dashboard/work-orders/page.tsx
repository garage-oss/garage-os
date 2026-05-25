import Link from 'next/link'
import { getWorkOrders } from '@/lib/work-orders'
import { requireOrg } from '@/lib/org'
import { WorkOrderStatus } from '@prisma/client'
import { StatusBadge } from '@/components/work-orders/StatusBadge'
import { WorkOrderFilters } from '@/components/work-orders/WorkOrderFilters'
import { formatCurrency, formatDate, toNum } from '@/lib/utils'
import { Plus, Eye, Pencil } from 'lucide-react'

interface PageProps {
  searchParams: { status?: string; q?: string }
}

export const dynamic = 'force-dynamic'

export default async function WorkOrdersPage({ searchParams }: PageProps) {
  const status = searchParams.status as WorkOrderStatus | undefined
  const search = searchParams.q

  const { orgId } = await requireOrg()
  const workOrders = await getWorkOrders(orgId, { status, search })

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold">פקודות עבודה</h1>
          <p className="text-sm text-muted mt-0.5">
            {workOrders.length} פקודות
            {status || search ? ' (מסוננות)' : ''}
          </p>
        </div>
        <Link
          href="/dashboard/work-orders/new"
          className="flex items-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
        >
          <Plus size={16} />
          פקודה חדשה
        </Link>
      </div>

      {/* Filters */}
      <WorkOrderFilters currentStatus={status} currentSearch={search} />

      {/* Table */}
      <div className="bg-surface border border-[#2e3147] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2e3147]">
                {['מס׳ פקודה', 'לקוח', 'רכב', 'טכנאי', 'סטטוס', 'תאריך', 'סה״כ', ''].map((h) => (
                  <th
                    key={h}
                    className="text-start px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-muted py-16 text-sm">
                    {search || status ? 'לא נמצאו פקודות עבודה' : 'אין פקודות עבודה עדיין'}
                  </td>
                </tr>
              ) : (
                workOrders.map((wo) => (
                  <tr
                    key={wo.id}
                    className="border-b border-[#2e3147] last:border-0 hover:bg-[#252836]/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-[#6366f1] font-semibold whitespace-nowrap">
                      {wo.workOrderNumber}
                    </td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{wo.customer.name}</td>
                    <td className="px-4 py-3 text-muted whitespace-nowrap">
                      {wo.vehicle.make} {wo.vehicle.model}{' '}
                      <span className="text-xs">({wo.vehicle.plate})</span>
                    </td>
                    <td className="px-4 py-3 text-muted whitespace-nowrap">
                      {wo.assignedTechnician ?? '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={wo.status} />
                    </td>
                    <td className="px-4 py-3 text-muted whitespace-nowrap text-xs">
                      {formatDate(wo.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-semibold whitespace-nowrap">
                      {formatCurrency(toNum(wo.totalPrice))}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/dashboard/work-orders/${wo.id}`}
                          className="p-1.5 rounded-lg text-muted hover:text-[#e2e8f0] hover:bg-[#2e3147] transition-all"
                          title="צפה"
                        >
                          <Eye size={14} />
                        </Link>
                        <Link
                          href={`/dashboard/work-orders/${wo.id}/edit`}
                          className="p-1.5 rounded-lg text-muted hover:text-[#e2e8f0] hover:bg-[#2e3147] transition-all"
                          title="ערוך"
                        >
                          <Pencil size={14} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
