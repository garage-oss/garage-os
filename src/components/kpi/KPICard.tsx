interface Props {
  label:     string
  value:     string | number
  sub?:      string
  accent?:   string
  icon?:     React.ReactNode
  trend?:    { value: number; label: string }
}

export function KPICard({ label, value, sub, accent = '#6366f1', icon, trend }: Props) {
  const trendUp = trend && trend.value > 0

  return (
    <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5 relative overflow-hidden">
      <div className="absolute top-0 start-0 end-0 h-[3px] rounded-t-xl" style={{ background: accent }} />
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="text-xs text-[#8892a4] uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
            {icon}
            {label}
          </div>
          <div className="text-2xl font-bold leading-none truncate" style={{ color: accent }}>
            {value}
          </div>
          {sub && <div className="text-xs text-[#8892a4] mt-1.5">{sub}</div>}
        </div>
        {trend && (
          <div className={`flex-shrink-0 ms-2 text-xs font-bold px-1.5 py-0.5 rounded-md ${
            trendUp ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'
          }`}>
            {trendUp ? '↑' : '↓'} {Math.abs(trend.value)}%
          </div>
        )}
      </div>
    </div>
  )
}
