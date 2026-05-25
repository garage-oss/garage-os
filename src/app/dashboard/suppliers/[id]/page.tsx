import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Truck, Phone, Mail, MapPin, Pencil, Package } from 'lucide-react'
import { getSupplier } from '@/lib/suppliers'
import { LowStockBadge } from '@/components/parts/LowStockBadge'
import { DeleteButton } from '@/components/ui/DeleteButton'
import { deleteSupplier } from '@/app/actions/suppliers'
import { formatCurrency } from '@/lib/utils'

interface Props { params: { id: string } }

export const dynamic = 'force-dynamic'

export default async function SupplierProfilePage({ params }: Props) {
  const supplier = await getSupplier(params.id)
  if (!supplier) notFound()

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-1.5 text-sm text-[#8892a4] mb-6">
        <Link href="/dashboard/suppliers" className="hover:text-[#e2e8f0] transition-colors">ספקים</Link>
        <ChevronRight size={14} className="rotate-180" />
        <span className="text-[#e2e8f0]">{supplier.name}</span>
      </div>

      {/* Header */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-6 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#6366f1]/15 flex items-center justify-center flex-shrink-0">
              <Truck size={26} className="text-[#6366f1]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{supplier.name}</h1>
              {supplier.contactName && (
                <p className="text-sm text-[#8892a4] mt-0.5">{supplier.contactName}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/suppliers/${supplier.id}/edit`}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-[#8892a4] border border-[#2e3147] rounded-lg hover:bg-[#252836] hover:text-[#e2e8f0] transition-all"
            >
              <Pencil size={14} />ערוך
            </Link>
            <DeleteButton
              onDelete={() => deleteSupplier(supplier.id)}
              redirectTo="/dashboard/suppliers"
              label="מחק"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5 pt-5 border-t border-[#2e3147]">
          {supplier.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone size={14} className="text-[#8892a4]" />
              <span>{supplier.phone}</span>
            </div>
          )}
          {supplier.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail size={14} className="text-[#8892a4]" />
              <span className="truncate">{supplier.email}</span>
            </div>
          )}
          {supplier.address && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin size={14} className="text-[#8892a4]" />
              <span>{supplier.address}</span>
            </div>
          )}
        </div>
      </div>

      {supplier.notes && (
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-4 mb-4">
          <div className="text-xs font-semibold text-[#8892a4] uppercase tracking-wide mb-2">הערות</div>
          <p className="text-sm text-[#8892a4] leading-relaxed">{supplier.notes}</p>
        </div>
      )}

      {/* Parts */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-[15px]">
            <span className="flex items-center gap-2">
              <Package size={15} className="text-[#8892a4]" />חלקים מספק זה ({supplier._count.parts})
            </span>
          </h2>
          <Link href={`/dashboard/inventory/new`} className="text-xs text-[#6366f1] hover:underline">
            הוסף חלק
          </Link>
        </div>
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
          {supplier.parts.length === 0 ? (
            <p className="text-sm text-[#8892a4] text-center py-10">אין חלקים מספק זה</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2e3147]">
                    {['מק"ט', 'שם', 'קטגוריה', 'מחיר', 'במלאי', 'סטטוס'].map((h) => (
                      <th key={h} className="text-start px-4 py-3 text-xs font-semibold text-[#8892a4] uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {supplier.parts.map((p) => (
                    <tr key={p.id} className="border-b border-[#2e3147] last:border-0 hover:bg-[#252836]/40 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/inventory/${p.id}`} className="font-mono text-xs text-[#6366f1] hover:underline font-semibold">
                          {p.sku}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-medium max-w-[180px] truncate">{p.name}</td>
                      <td className="px-4 py-3 text-[#8892a4] text-xs">{p.category ?? '—'}</td>
                      <td className="px-4 py-3 font-semibold">{formatCurrency(p.salePrice)}</td>
                      <td className="px-4 py-3 font-bold">{p.quantity}</td>
                      <td className="px-4 py-3">
                        <LowStockBadge quantity={p.quantity} minQuantity={p.minQuantity} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
