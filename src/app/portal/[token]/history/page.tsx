import { getPortalData, getVehicleHistory } from '@/lib/portal'
import { formatCurrency, toNum }            from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function HistoryPage({ params }: { params: { token: string } }) {
  const wo      = await getPortalData(params.token)
  const history = await getVehicleHistory(wo.vehicle.id, wo.id)

  // Only show completed records to customers — cancelled are internal
  const completed = history.filter(r => r.status === 'COMPLETED')

  const totalSpent = completed.reduce((s, r) => s + toNum(r.totalPrice), 0)
  const firstDate  = completed.length > 0
    ? completed[completed.length - 1].createdAt
    : null

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-5 pb-2">

      <div>
        <h2 className="text-2xl font-bold text-slate-900">היסטוריית שירות</h2>
        <p className="text-slate-500 text-sm mt-1">
          {wo.vehicle.make} {wo.vehicle.model} · {wo.vehicle.plate}
        </p>
      </div>

      {/* Lifetime vehicle summary */}
      {completed.length > 0 && (
        <div className="bg-indigo-600 rounded-3xl shadow-xl shadow-indigo-200 p-6 text-white">
          <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest mb-4">סיכום רכב</p>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="font-black text-2xl">{completed.length}</p>
              <p className="text-indigo-200 text-xs mt-0.5">טיפולים</p>
            </div>
            <div>
              <p className="font-black text-2xl">{formatCurrency(totalSpent)}</p>
              <p className="text-indigo-200 text-xs mt-0.5">סה״כ שהושקע</p>
            </div>
            <div>
              <p className="font-black text-2xl">
                {firstDate ? new Date(firstDate).getFullYear() : '—'}
              </p>
              <p className="text-indigo-200 text-xs mt-0.5">לקוח מאז</p>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {completed.length === 0 && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-10 text-center">
          <span className="text-5xl block mb-4">🔧</span>
          <p className="font-semibold text-slate-700">אין היסטוריית שירות</p>
          <p className="text-sm text-slate-400 mt-1">זהו הטיפול הראשון של הרכב אצלנו</p>
        </div>
      )}

      {/* History list */}
      {completed.length > 0 && (
        <div className="space-y-3">
          {completed.map(record => {
            const date = record.completedAt ?? record.createdAt
            const amount = toNum(record.totalPrice)

            return (
              <div
                key={record.id}
                className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 space-y-3"
              >
                {/* Header */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-2xl flex items-center justify-center shrink-0 text-xl">
                    🔧
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 text-sm leading-snug">
                      {record.complaint ?? 'טיפול כללי'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(date).toLocaleDateString('he-IL', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </p>
                  </div>
                  {amount > 0 && (
                    <p className="font-black text-indigo-600 text-base shrink-0 tabular-nums">
                      {formatCurrency(amount)}
                    </p>
                  )}
                </div>

                {/* Diagnosis */}
                {record.diagnosis && (
                  <p className="text-sm text-slate-600 leading-relaxed border-t border-slate-50 pt-3">
                    {record.diagnosis}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Footer — only shown when there's data */}
      {completed.length > 0 && (
        <p className="text-center text-xs text-slate-400 pb-2">
          מציג {completed.length} טיפולים אחרונים
        </p>
      )}

    </div>
  )
}
