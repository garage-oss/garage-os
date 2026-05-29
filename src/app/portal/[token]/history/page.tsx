import { getPortalData, getVehicleHistory } from '@/lib/portal'
import { formatCurrency, toNum }            from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function HistoryPage({ params }: { params: { token: string } }) {
  const wo      = await getPortalData(params.token)
  const history = await getVehicleHistory(wo.vehicle.id, wo.id)

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-5 pb-2">

      <div>
        <h2 className="text-2xl font-bold text-slate-900">היסטוריית שירות</h2>
        <p className="text-slate-500 text-sm mt-1">
          {wo.vehicle.make} {wo.vehicle.model} · {wo.vehicle.plate}
        </p>
      </div>

      {history.length === 0 && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-10 text-center">
          <span className="text-5xl block mb-4">🔧</span>
          <p className="font-semibold text-slate-700">אין היסטוריית שירות</p>
          <p className="text-sm text-slate-400 mt-1">זהו הטיפול הראשון של הרכב במוסך זה</p>
        </div>
      )}

      {history.length > 0 && (
        <div className="space-y-3">
          {history.map(record => {
            const completed = record.status === 'COMPLETED'
            const date = record.completedAt ?? record.createdAt

            return (
              <div
                key={record.id}
                className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 space-y-3"
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{completed ? '✅' : '❌'}</span>
                    <div>
                      <p className="font-bold text-slate-900 text-sm leading-tight">
                        {record.complaint ?? 'טיפול כללי'}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5 font-mono">
                        #{record.workOrderNumber}
                      </p>
                    </div>
                  </div>

                  {/* Status badge */}
                  <span className={`
                    shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full border
                    ${completed
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-slate-50  border-slate-200  text-slate-500'
                    }
                  `}>
                    {completed ? 'הושלם' : 'בוטל'}
                  </span>
                </div>

                {/* Diagnosis / work done */}
                {record.diagnosis && (
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {record.diagnosis}
                  </p>
                )}

                {/* Footer: date + price */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-50">
                  <p className="text-xs text-slate-400">
                    {new Date(date).toLocaleDateString('he-IL', {
                      day:   '2-digit',
                      month: 'long',
                      year:  'numeric',
                    })}
                  </p>
                  {toNum(record.totalPrice) > 0 && (
                    <p className="font-black text-indigo-600 text-sm">
                      {formatCurrency(toNum(record.totalPrice))}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-center text-xs text-slate-400 pb-2">
        מציג עד 20 טיפולים אחרונים
      </p>

    </div>
  )
}
