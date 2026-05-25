'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Package, MapPin, Tag, Wrench, Pencil, ArrowUpCircle, ArrowDownCircle, Settings } from 'lucide-react'
import { LowStockBadge } from '@/components/parts/LowStockBadge'
import { StockAdjustModal } from '@/components/parts/StockAdjustModal'
import { DeleteButton } from '@/components/ui/DeleteButton'
import { deletePart } from '@/app/actions/parts'
import { formatCurrency, formatDate } from '@/lib/utils'

type Part = {
  id: string; sku: string; name: string; category: string | null; manufacturer: string | null
  costPrice: number; salePrice: number; quantity: number; minQuantity: number
  location: string | null; notes: string | null; isLowStock: boolean
  supplier: { id: string; name: string } | null
  stockMovements: { id: string; type: string; quantity: number; reason: string | null; createdAt: string }[]
  _count: { items: number }
}

const MOVEMENT_ICONS: Record<string, React.ReactNode> = {
  IN: <ArrowUpCircle size={14} className="text-emerald-400" />,
  OUT: <ArrowDownCircle size={14} className="text-red-400" />,
  ADJUSTMENT: <Settings size={14} className="text-blue-400" />,
}
const MOVEMENT_LABELS: Record<string, string> = { IN: 'כניסה', OUT: 'יציאה', ADJUSTMENT: 'תיקון' }

export default function PartProfilePage() {
  const params = useParams<{ id: string }>()
  const [part, setPart] = useState<Part | null>(null)
  const [showAdjust, setShowAdjust] = useState(false)

  async function loadPart() {
    const res = await fetch(`/api/parts/${params.id}`)
    if (res.ok) setPart(await res.json())
  }

  useEffect(() => { loadPart() }, [params.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!part) return (
    <div className="text-[#8892a4] text-sm py-20 text-center">טוען...</div>
  )

  const margin = part.salePrice > 0 ? ((part.salePrice - part.costPrice) / part.salePrice * 100).toFixed(0) : '0'

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-1.5 text-sm text-[#8892a4] mb-6">
        <Link href="/dashboard/inventory" className="hover:text-[#e2e8f0] transition-colors">מלאי</Link>
        <ChevronRight size={14} className="rotate-180" />
        <span className="text-[#e2e8f0] font-mono">{part.sku}</span>
      </div>

      {/* Header */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-6 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#6366f1]/15 flex items-center justify-center flex-shrink-0">
              <Package size={26} className="text-[#6366f1]" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold">{part.name}</h1>
                <LowStockBadge quantity={part.quantity} minQuantity={part.minQuantity} />
              </div>
              <div className="font-mono text-[#6366f1] text-sm font-semibold mt-0.5">{part.sku}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdjust(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/10 transition-all"
            >
              עדכון מלאי
            </button>
            <Link
              href={`/dashboard/inventory/${part.id}/edit`}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-[#8892a4] border border-[#2e3147] rounded-lg hover:bg-[#252836] hover:text-[#e2e8f0] transition-all"
            >
              <Pencil size={14} />ערוך
            </Link>
            <DeleteButton
              onDelete={() => deletePart(part.id)}
              redirectTo="/dashboard/inventory"
              label="מחק"
            />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-5 pt-5 border-t border-[#2e3147]">
          <div className="text-center">
            <div className="text-2xl font-bold">{part.quantity}</div>
            <div className="text-xs text-[#8892a4] mt-0.5">במלאי</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-[#6366f1]">{formatCurrency(part.salePrice)}</div>
            <div className="text-xs text-[#8892a4] mt-0.5">מחיר מכירה</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-[#8892a4]">{formatCurrency(part.costPrice)}</div>
            <div className="text-xs text-[#8892a4] mt-0.5">מחיר עלות</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-400">{margin}%</div>
            <div className="text-xs text-[#8892a4] mt-0.5">מרווח</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {/* Details */}
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Tag size={14} className="text-[#8892a4]" />
            <span className="text-xs font-semibold text-[#8892a4] uppercase tracking-wide">פרטים</span>
          </div>
          <div>
            <div className="text-xs text-[#8892a4]">קטגוריה</div>
            <div className="text-sm font-medium">{part.category ?? '—'}</div>
          </div>
          <div>
            <div className="text-xs text-[#8892a4]">יצרן</div>
            <div className="text-sm font-medium">{part.manufacturer ?? '—'}</div>
          </div>
          <div>
            <div className="text-xs text-[#8892a4]">ספק</div>
            <div className="text-sm font-medium">
              {part.supplier ? (
                <Link href={`/dashboard/suppliers/${part.supplier.id}`} className="text-[#6366f1] hover:underline">
                  {part.supplier.name}
                </Link>
              ) : '—'}
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <MapPin size={12} className="text-[#8892a4]" />
            <span className="text-xs text-[#8892a4]">{part.location ?? 'מיקום לא הוגדר'}</span>
          </div>
        </div>

        {/* Usage */}
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Wrench size={14} className="text-[#8892a4]" />
            <span className="text-xs font-semibold text-[#8892a4] uppercase tracking-wide">שימוש</span>
          </div>
          <div>
            <div className="text-xs text-[#8892a4]">שומש בפקודות</div>
            <div className="text-2xl font-bold">{part._count.items}</div>
          </div>
          <div>
            <div className="text-xs text-[#8892a4]">מינ׳ מלאי</div>
            <div className="text-sm font-medium">{part.minQuantity} יח׳</div>
          </div>
          <div>
            <div className="text-xs text-[#8892a4]">שווי מלאי (מכירה)</div>
            <div className="text-sm font-bold text-[#6366f1]">{formatCurrency(part.quantity * part.salePrice)}</div>
          </div>
        </div>
      </div>

      {part.notes && (
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-4 mb-4">
          <div className="text-xs font-semibold text-[#8892a4] uppercase tracking-wide mb-2">הערות</div>
          <p className="text-sm text-[#8892a4] leading-relaxed">{part.notes}</p>
        </div>
      )}

      {/* Stock History */}
      <div>
        <h2 className="font-semibold text-[15px] mb-3">היסטוריית מלאי ({part.stockMovements.length})</h2>
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
          {part.stockMovements.length === 0 ? (
            <p className="text-sm text-[#8892a4] text-center py-10">אין תנועות מלאי</p>
          ) : (
            <div className="divide-y divide-[#2e3147]">
              {part.stockMovements.map((m) => (
                <div key={m.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    {MOVEMENT_ICONS[m.type]}
                    <div>
                      <div className="text-xs font-semibold">{MOVEMENT_LABELS[m.type]}</div>
                      <div className="text-xs text-[#8892a4]">{m.reason ?? '—'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`font-bold text-sm ${m.type === 'IN' ? 'text-emerald-400' : m.type === 'OUT' ? 'text-red-400' : 'text-blue-400'}`}>
                      {m.type === 'IN' ? '+' : m.type === 'OUT' ? '−' : '±'}{m.quantity}
                    </span>
                    <span className="text-xs text-[#8892a4]">{formatDate(m.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showAdjust && (
        <StockAdjustModal
          partId={part.id}
          currentQty={part.quantity}
          onClose={() => { setShowAdjust(false); loadPart() }}
        />
      )}
    </div>
  )
}
