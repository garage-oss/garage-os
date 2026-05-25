export default function DashboardPage() {
  const stats = [
    { label: 'פקודות פתוחות', value: '—', sub: 'כרגע פעילות', accent: '#6366f1' },
    { label: 'רכבים היום', value: '—', sub: 'נכנסו היום', accent: '#10b981' },
    { label: 'חשבוניות ממתינות', value: '—', sub: 'לתשלום', accent: '#f59e0b' },
    { label: 'הכנסות החודש', value: '—', sub: 'חודש נוכחי', accent: '#6366f1' },
  ]

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">לוח בקרה</h1>
          <p className="text-sm text-muted mt-0.5">ברוך הבא ל-GarageOS</p>
        </div>
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

      {/* Placeholder tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-surface border border-[#2e3147] rounded-xl p-5">
          <div className="font-semibold text-[15px] mb-4">פקודות עבודה אחרונות</div>
          <p className="text-sm text-muted text-center py-10">אין נתונים להצגה</p>
        </div>
        <div className="bg-surface border border-[#2e3147] rounded-xl p-5">
          <div className="font-semibold text-[15px] mb-4">לקוחות אחרונים</div>
          <p className="text-sm text-muted text-center py-10">אין נתונים להצגה</p>
        </div>
      </div>
    </div>
  )
}
