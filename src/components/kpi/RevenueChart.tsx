'use client'

import { shortMonth } from '@/lib/kpi'
import type { MonthRevenue } from '@/lib/kpi'

interface Props {
  data:   MonthRevenue[]
  height?: number
}

export function RevenueChart({ data, height = 160 }: Props) {
  if (data.length === 0) return null

  const max     = Math.max(...data.map((d) => d.revenue), 1)
  const padX    = 10
  const padY    = 8
  const barW    = 26
  const gapW    = 8
  const chartW  = data.length * (barW + gapW) - gapW + padX * 2
  const chartH  = height

  function barHeight(v: number) { return Math.round(((v / max) * (chartH - padY * 2 - 20))) }

  function fmt(v: number) {
    if (v >= 1000000) return `₪${(v / 1000000).toFixed(1)}M`
    if (v >= 1000)    return `₪${Math.round(v / 1000)}K`
    return `₪${v}`
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg width={chartW} height={chartH} className="min-w-full">
        {/* Y-axis hint lines */}
        {[0.25, 0.5, 0.75, 1].map((frac) => {
          const y = padY + (chartH - padY * 2 - 20) * (1 - frac)
          return (
            <g key={frac}>
              <line x1={padX} x2={chartW - padX} y1={y} y2={y} stroke="#2e3147" strokeDasharray="3 3" />
              <text x={padX} y={y - 3} fontSize="9" fill="#8892a4" textAnchor="start">
                {fmt(max * frac)}
              </text>
            </g>
          )
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const x  = padX + i * (barW + gapW)
          const bh = barHeight(d.revenue)
          const y  = chartH - padY - 20 - bh
          const isZero = d.revenue === 0

          return (
            <g key={d.month}>
              {/* Bar */}
              <rect
                x={x}
                y={isZero ? chartH - padY - 20 - 2 : y}
                width={barW}
                height={isZero ? 2 : bh}
                rx={4}
                fill={isZero ? '#2e3147' : '#6366f1'}
                opacity={isZero ? 0.4 : 1}
              />
              {/* Glow cap */}
              {!isZero && (
                <rect x={x} y={y} width={barW} height={4} rx={4} fill="#818cf8" opacity={0.6} />
              )}
              {/* Label */}
              <text
                x={x + barW / 2}
                y={chartH - 4}
                fontSize="9"
                fill="#8892a4"
                textAnchor="middle"
              >
                {shortMonth(d.month).split(' ')[0]}
              </text>
              {/* Value on hover (tooltip via title) */}
              {!isZero && (
                <title>{shortMonth(d.month)}: {fmt(d.revenue)}</title>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
