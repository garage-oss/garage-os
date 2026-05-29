import Link           from 'next/link'
import { requireOrg } from '@/lib/org'
import { prisma }     from '@/lib/prisma'
import { formatCurrency, toNum } from '@/lib/utils'
import { SERVICE_TYPE_LABELS, SERVICE_TYPE_ICONS, URGENCY_LABELS } from '@/lib/quote-engine'
import type { QuoteRequestStatus } from '@prisma/client'
import { MessageSquare } from 'lucide-react'

export const dynamic = 'force-dynamic'

const STATUS_STYLE: Record<QuoteRequestStatus, string> = {
  PENDING:   'bg-slate-100  text-slate-600',
  REVIEWING: 'bg-amber-100  text-amber-700',
  SENT:      'bg-indigo-100 text-indigo-700',
  RESOLVED:  'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-red-100    text-red-600',
}

const STATUS_LABEL: Record<QuoteRequestStatus, string> = {
  PENDING:   'ממתין לעיבוד',
  REVIEWING: 'ממתין לאישורך',
  SENT:      'נשלחה ללקוח',
  RESOLVED:  'טופלה',
  CANCELLED: 'בוטלה',
}

const URGENCY_DOT: Record<string, string> = {
  LOW:    'bg-slate-400',
  NORMAL: 'bg-amber-400',
  HIGH:   'bg-red-500 animate-pulse',
}

export default async function QuoteRequestsPage() {
  const { orgId } = await requireOrg()

  const requests = await prisma.quoteRequest.findMany({
    where:   { organizationId: orgId },
    orderBy: { createdAt: 'desc' },
    include: {
      workOrder: {
        select: {
          workOrderNumber: true,
          id: true,
          vehicle:  { select: { make: true, model: true, plate: true, year: true } },
          customer: { select: { name: true, phone: true } },
          quote:    { select: { totalPrice: true, status: true } },
        },
      },
    },
  })

  const open = requests.filter(r => r.status === 'REVIEWING' || r.status === 'PENDING')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">בקשות הצעת מחיר</h1>
          <p className="text-slate-500 text-sm mt-1">
            בקשות שהוגשו על-ידי לקוחות דרך הפורטל
          </p>
        </div>
        {open.length > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
            {open.length} חדש{open.length > 1 ? 'ות' : 'ה'}
          </span>
        )}
      </div>

      {requests.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-500">אין בקשות עדיין</p>
          <p className="text-sm text-slate-400 mt-1">
            לקוחות יכולים לבקש הצעת מחיר דרך הפורטל האישי
          </p>
        </div>
      )}

      {requests.length > 0 && (
        <div className="space-y-3">
          {requests.map(req => {
            const wo = req.workOrder
            return (
              <Link
                key={req.id}
                href={`/dashboard/quote-requests/${req.id}`}
                className="block bg-white rounded-2xl border border-slate-200 p-4 hover:border-indigo-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start gap-3">
                  {/* Service icon */}
                  <div className="w-11 h-11 bg-slate-100 rounded-xl flex items-center justify-center text-xl shrink-0 group-hover:bg-indigo-50 transition-colors">
                    {SERVICE_TYPE_ICONS[req.serviceType]}
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-slate-900 text-sm">
                        {wo.vehicle.make} {wo.vehicle.model}
                      </p>
                      <span className="text-slate-400 text-xs font-mono">{wo.vehicle.plate}</span>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${URGENCY_DOT[req.urgency]}`} />
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {wo.customer.name} · {SERVICE_TYPE_LABELS[req.serviceType]} · {URGENCY_LABELS[req.urgency]}
                    </p>
                    {req.description && (
                      <p className="text-xs text-slate-400 mt-1 truncate">{req.description}</p>
                    )}
                  </div>

                  {/* Status + amount */}
                  <div className="text-left shrink-0 space-y-1">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[req.status]}`}>
                      {STATUS_LABEL[req.status]}
                    </span>
                    {wo.quote && (
                      <p className="text-xs font-bold text-indigo-600 text-center">
                        {formatCurrency(toNum(wo.quote.totalPrice))}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400 text-center">
                      {new Date(req.createdAt).toLocaleDateString('he-IL')}
                    </p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
