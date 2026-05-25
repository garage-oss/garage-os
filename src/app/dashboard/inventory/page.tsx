import Link from 'next/link'
import { getParts, getPartCategories, getInventoryValue } from '@/lib/parts'
import { LowStockBadge } from '@/components/parts/LowStockBadge'
import { InventoryFilters } from '@/components/parts/InventoryFilters'
import { formatCurrency } from '@/lib/utils'
import { Package, Plus, TrendingUp, AlertTriangle, Layers } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: { q?: string; category?: string; lowStock?: string }
}

export default async function InventoryPage({ searchParams }: PageProps) {
  const [parts, categories, { costValue, saleValue, partsCount }] = await Promise.all([
    getParts({
      search: searchParams.q,
      category: searchParams.category,
      lowStock: searchParams.lowStock === 'true',
    }),
    getPartCategories(),
    getInventoryValue(),
  ])

  const lowStockCount = parts.filter((p) => p.isLowStock).length

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold">מלאי חלקים</h1>
          <p className="text-sm text-[#8892a4] mt-0.5">{partsCount} חלקים במערכת</p>
        </div>
        <Link
          href="/dashboard/inventory/new"
          className="flex items-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
        >
          <Plus size={16} />חלק חדש
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-5">
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#6366f1]/15 flex items-center justify-center flex-shrink-0">
            <Layers size={18} className="text-[#6366f1]" />
          </div>
          <div>
            <div className="text-xl font-bold">{formatCurrency(costValue)}</div>
            <div className="text-xs text-[#8892a4]">שווי עלות מלאי</div>
          </div>
        </div>
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
            <TrendingUp size={18} className="text-emerald-400" />
          </div>
          <div>
            <div className="text-xl font-bold">{formatCurrency(saleValue)}</div>
            <div className="text-xs text-[#8892a4]">שווי מכירה מלאי</div>
          </div>
        </div>
        <Link href="/dashboard/inventory?lowStock=true" className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-4 flex items-center gap-4 hover:border-amber-500/40 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={18} className="text-amber-400" />
          </div>
          <div>
            <div className="text-xl font-bold">{lowStockCount}</div>
            <div className="text-xs text-[#8892a4]">חלקים במלאי נמוך</div>
          </div>
        </Link>
      </div>

      <InventoryFilters
        categories={categories}
        currentSearch={searchParams.q}
        currentCategory={searchParams.category}
        currentLowStock={searchParams.lowStock === 'true'}
      />

      {parts.length === 0 ? (
        <div className="bg-[#1a1d27] border border-[#2e3147] border-dashed rounded-xl p-16 text-center">
          <Package size={32} className="text-[#8892a4] mx-auto mb-3" />
          <p className="text-[#8892a4]">אין חלקים התואמים לחיפוש</p>
        </div>
      ) : (
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2e3147]">
                  {['מק"ט', 'שם החלק', 'קטגוריה', 'ספק', 'מחיר מכירה', 'כמות', 'מינ׳', 'מיקום', 'סטטוס'].map((h) => (
                    <th key={h} className="text-start px-4 py-3 text-xs font-semibold text-[#8892a4] uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parts.map((p) => (
                  <tr key={p.id} className="border-b border-[#2e3147] last:border-0 hover:bg-[#252836]/40 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/inventory/${p.id}`} className="font-mono text-xs text-[#6366f1] hover:underline font-semibold">
                        {p.sku}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium max-w-[180px] truncate">
                      <Link href={`/dashboard/inventory/${p.id}`} className="hover:text-[#6366f1] transition-colors">
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[#8892a4] text-xs">{p.category ?? '—'}</td>
                    <td className="px-4 py-3 text-[#8892a4] text-xs truncate max-w-[120px]">
                      {p.supplier ? (
                        <Link href={`/dashboard/suppliers/${p.supplier.id}`} className="hover:text-[#6366f1] transition-colors">
                          {p.supplier.name}
                        </Link>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 font-semibold whitespace-nowrap">{formatCurrency(p.salePrice)}</td>
                    <td className="px-4 py-3 font-bold text-center">{p.quantity}</td>
                    <td className="px-4 py-3 text-[#8892a4] text-center text-xs">{p.minQuantity}</td>
                    <td className="px-4 py-3 text-[#8892a4] text-xs">{p.location ?? '—'}</td>
                    <td className="px-4 py-3">
                      <LowStockBadge quantity={p.quantity} minQuantity={p.minQuantity} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
