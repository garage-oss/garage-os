import Link from 'next/link'
import { getCustomers } from '@/lib/customers'
import { requireOrg } from '@/lib/org'
import { CustomerFilters } from '@/components/customers/CustomerFilters'
import { Plus, Eye, Pencil, Car, Wrench } from 'lucide-react'

interface PageProps { searchParams: { q?: string } }

export const dynamic = 'force-dynamic'

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2)
}

const AVATAR_COLORS = [
  'bg-indigo-500/20 text-indigo-400',
  'bg-emerald-500/20 text-emerald-400',
  'bg-amber-500/20 text-amber-400',
  'bg-rose-500/20 text-rose-400',
  'bg-cyan-500/20 text-cyan-400',
]

export default async function CustomersPage({ searchParams }: PageProps) {
  const { orgId } = await requireOrg()
  const customers = await getCustomers(orgId, searchParams.q)

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold">לקוחות</h1>
          <p className="text-sm text-[#8892a4] mt-0.5">{customers.length} לקוחות{searchParams.q ? ' (תוצאות חיפוש)' : ''}</p>
        </div>
        <Link href="/dashboard/customers/new" className="flex items-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors">
          <Plus size={16} />לקוח חדש
        </Link>
      </div>

      <CustomerFilters currentSearch={searchParams.q} />

      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2e3147]">
                {['לקוח', 'טלפון', 'אימייל', 'רכבים', 'פקודות', ''].map(h => (
                  <th key={h} className="text-start px-4 py-3 text-xs font-semibold text-[#8892a4] uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-[#8892a4] py-16">אין לקוחות{searchParams.q ? ' התואמים לחיפוש' : ' עדיין'}</td></tr>
              ) : customers.map((c, i) => (
                <tr key={c.id} className="border-b border-[#2e3147] last:border-0 hover:bg-[#252836]/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
                        {getInitials(c.name)}
                      </div>
                      <Link href={`/dashboard/customers/${c.id}`} className="font-semibold hover:text-[#6366f1] transition-colors">
                        {c.name}
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#8892a4]">{c.phone}</td>
                  <td className="px-4 py-3 text-[#8892a4]">{c.email ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-[#8892a4]">
                      <Car size={13} />
                      <span>{c._count.vehicles}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-[#8892a4]">
                      <Wrench size={13} />
                      <span>{c._count.workOrders}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Link href={`/dashboard/customers/${c.id}`} className="p-1.5 rounded-lg text-[#8892a4] hover:text-[#e2e8f0] hover:bg-[#2e3147] transition-all" title="צפה"><Eye size={14} /></Link>
                      <Link href={`/dashboard/customers/${c.id}/edit`} className="p-1.5 rounded-lg text-[#8892a4] hover:text-[#e2e8f0] hover:bg-[#2e3147] transition-all" title="ערוך"><Pencil size={14} /></Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
