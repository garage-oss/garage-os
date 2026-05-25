import Link from 'next/link'
import { getSuppliers } from '@/lib/suppliers'
import { Package, Phone, Mail, Plus, Truck } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface PageProps { searchParams: { q?: string } }

export default async function SuppliersPage({ searchParams }: PageProps) {
  const suppliers = await getSuppliers(searchParams.q)

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold">ספקים</h1>
          <p className="text-sm text-[#8892a4] mt-0.5">{suppliers.length} ספקים פעילים</p>
        </div>
        <Link
          href="/dashboard/suppliers/new"
          className="flex items-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
        >
          <Plus size={16} />ספק חדש
        </Link>
      </div>

      <div className="mb-5">
        <form>
          <input
            name="q"
            defaultValue={searchParams.q}
            placeholder="חיפוש ספק לפי שם, איש קשר..."
            className="bg-[#1a1d27] border border-[#2e3147] rounded-lg px-3 py-2 text-sm text-[#e2e8f0] placeholder-[#4a5568] focus:outline-none focus:border-[#6366f1] min-w-[260px]"
          />
        </form>
      </div>

      {suppliers.length === 0 ? (
        <div className="bg-[#1a1d27] border border-[#2e3147] border-dashed rounded-xl p-16 text-center">
          <Truck size={32} className="text-[#8892a4] mx-auto mb-3" />
          <p className="text-[#8892a4] mb-3">אין ספקים</p>
          <Link href="/dashboard/suppliers/new" className="text-sm text-[#6366f1] hover:underline">הוסף ספק ראשון</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((s) => (
            <Link
              key={s.id}
              href={`/dashboard/suppliers/${s.id}`}
              className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5 hover:border-[#6366f1]/40 transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#6366f1]/15 flex items-center justify-center flex-shrink-0">
                  <Truck size={18} className="text-[#6366f1]" />
                </div>
                <span className="flex items-center gap-1 text-xs text-[#8892a4]">
                  <Package size={11} />{s._count.parts} חלקים
                </span>
              </div>
              <h3 className="font-semibold text-[15px] group-hover:text-[#6366f1] transition-colors mb-1">{s.name}</h3>
              {s.contactName && <p className="text-xs text-[#8892a4] mb-2">{s.contactName}</p>}
              <div className="space-y-1">
                {s.phone && (
                  <div className="flex items-center gap-2 text-xs text-[#8892a4]">
                    <Phone size={11} />{s.phone}
                  </div>
                )}
                {s.email && (
                  <div className="flex items-center gap-2 text-xs text-[#8892a4] truncate">
                    <Mail size={11} />{s.email}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
