export function formatCurrency(amount: number | string | { toNumber: () => number }): string {
  const num =
    typeof amount === 'object' && 'toNumber' in amount
      ? amount.toNumber()
      : Number(amount)
  return `₪${num.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}

export function toNum(val: unknown): number {
  if (typeof val === 'number') return val
  if (typeof val === 'string') return parseFloat(val) || 0
  if (val && typeof (val as { toNumber: () => number }).toNumber === 'function')
    return (val as { toNumber: () => number }).toNumber()
  return 0
}
