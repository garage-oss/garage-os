interface BarItem { label: string; value: number; sublabel?: string }

interface Props {
  items:    BarItem[]
  maxValue?: number
  format?:  (v: number) => string
  color?:   string
}

export function HorizontalBar({ items, maxValue, format, color = '#6366f1' }: Props) {
  const max = maxValue ?? Math.max(...items.map((i) => i.value), 1)

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const pct = Math.round((item.value / max) * 100)
        return (
          <div key={i}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium truncate max-w-[60%]">{item.label}</span>
              <span className="text-xs font-bold text-white ms-2 flex-shrink-0">
                {format ? format(item.value) : item.value}
              </span>
            </div>
            <div className="h-2 bg-[#252836] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, background: color }}
              />
            </div>
            {item.sublabel && (
              <div className="text-[10px] text-[#8892a4] mt-0.5">{item.sublabel}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
