import Link from 'next/link'
import { getDashboardStats } from '@/lib/work-orders'
import { StatusBadge } from '@/components/work-orders/StatusBadge'
import { formatCurrency, formatDate, toNum } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const { active, waitingParts, completedToday, pending, recentWorkOrders } =
    await getDashboardStats()

  const stats = [
    { label: 'בטיפול כעת', value: active, sub: 'פקודות פעילות', accent: '#6366f1' },
    { label: 'ממתין לחלקים', value: waitingParts, sub: 'רכבים מחכים', accent: '#f97316' },
    { label: 'הושלמו היום', value: completedToday, sub: 'טיפולים הושלמו', accent: '#10b981' },
    { label: 'ממתינות לטיפול', value: pending, sub: 'פקודות חדשות', accent: '#f59e0b' },
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">לוח בקרה</h1>
          <p className="text-sm text-muted mt-0.5">ברוך הבא ל-GarageOS</p>
        </div>
        <Link
          href="/dashboard/work-orders/new"
          className="flex items-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
        >
          + פקודה חדשה
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-surface border border-[#2e3147] rounded-xl p-5 relative overflow-hidden"
          >
            <div
              className="absolute top-0 start-0 end-0 h-[3px] rounded-t-xl"
              style={{ background: s.accent }}
            />
            <div className="text-xs text-muted uppercase tracking-wide mb-1.5">{s.label}</div>
            <div className="text-3xl font-bold leading-none mb-1.5">{s.value}</div>
            <div className="text-xs text-muted">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Recent Work Orders */}
      <div className="bg-surface border border-[#2e3147] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e3147]">
          <span className="font-semibold text-[15px]">פקודות עבודה אחרונות</span>
          <Link
            href="/dashboard/work-orders"
            className="text-xs text-[#6366f1] hover:underline"
          >
            הצג הכל
          </Link>
        </div>

        {recentWorkOrders.length === 0 ? (
          <p className="text-sm text-muted text-center py-12">אין פקודות עבודה עדיין</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2e3147]">
                  {['מס׳ פקודה', 'לקוח', 'רכב', 'סטטוס', 'תאריך', 'סה״כ'].map((h) => (
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
                {recentWorkOrders.map((wo) => (
                  <tr
                    key={wo.id}
                    className="border-b border-[#2e3147] last:border-0 hover:bg-[#252836]/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/work-orders/${wo.id}`}
                        className="font-mono text-xs text-[#6366f1] hover:underline font-semibold"
                      >
                        {wo.workOrderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{wo.customer.name}</td>
                    <td className="px-4 py-3 text-muted whitespace-nowrap text-xs">
                      {wo.vehicle.make} {wo.vehicle.model} ({wo.vehicle.plate})
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
