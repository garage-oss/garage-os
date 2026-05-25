interface Props {
  quantity: number
  minQuantity: number
}

export function LowStockBadge({ quantity, minQuantity }: Props) {
  if (quantity <= 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-red-500/10 text-red-400 border border-red-500/25 px-2 py-0.5 rounded-full font-semibold">
        אזל
      </span>
    )
  }
  if (quantity <= minQuantity) {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-amber-500/10 text-amber-400 border border-amber-500/25 px-2 py-0.5 rounded-full font-semibold">
        מלאי נמוך
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-full font-semibold">
      במלאי
    </span>
  )
}
