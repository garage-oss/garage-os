'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronRight, Loader2, WifiOff, Car, Wrench, FileText, Plus,
  Calendar, Hash, User, Phone, Mail,
} from 'lucide-react'

interface Vehicle {
  car_no:        string
  car_desc:      string | null
  car_code:      string | null
  prod_dt:       string | null
  last_km:       number | null
  last_visit_dt: string | null
  order_count:   number
}

interface WorkOrder {
  card_id:   string
  card_no:   number | null
  open_dt:   string | null
  close_dt:  string | null
  car_no:    string | null
  car_desc:  string | null
  cli_comp1: string | null
  tarif:     number | null
  part_tot:  number | null
  work_tot:  number | null
  total:     number
  card_st:   string | null
  card_km:   number | null
}

interface CustomerDetail {
  cli_no:        number
  cli_name:      string
  cli_type:      string | null
  cli_email:     string | null
  phone:         string | null
  last_visit_dt: string | null
  order_count:   number
  vehicle_count: number
  total_spent:   number | null
}

interface Data {
  customer: CustomerDetail
  vehicles: Vehicle[]
  history:  WorkOrder[]
}

function fmtDate(s: string | null): string {
  if (!s) return '—'
  try { return new Date(s).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
  catch { return '—' }
}

function fmtCurrency(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 2 })
}

function statusLabel(st: string | null): string {
  const MAP: Record<string, string> = { 'פ': 'פתוח', 'ס': 'סגור', 'ב': 'בטיפול' }
  return st ? (MAP[st] ?? st) : '—'
}

export default function NesherCustomerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const cliNo  = params.cliNo as string

  const [data,    setData]    = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/nesher/customers/${cliNo}`)
      .then(r => r.json().then(b => ({ ok: r.ok, body: b })))
      .then(({ ok, body }) => {
        if (!ok) setError(body.error ?? 'שגיאה')
        else     setData(body)
      })
      .catch(() => setError('לא ניתן להגיע לקונקטור'))
      .finally(() => setLoading(false))
  }, [cliNo])

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-[#5a6279]">
      <Loader2 size={28} className="animate-spin" />
      <span className="text-sm">טוען פרטי לקוח…</span>
    </div>
  )

  if (error || !data) return (
    <div className="flex flex-col items-center gap-3 py-16">
      <WifiOff size={32} className="text-red-400" />
      <p className="text-sm text-red-300">{error ?? 'לא נמצא'}</p>
      <button onClick={() => router.back()} className="text-xs text-[#6366f1] hover:underline">חזור</button>
    </div>
  )

  const { customer, vehicles, history } = data

  return (
    <div dir="rtl" className="max-w-4xl space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-[#8892a4]">
        <Link href="/dashboard/nesher/customers" className="hover:text-[#e2e8f0] transition-colors">לקוחות נשר</Link>
        <ChevronRight size={14} className="rotate-180" />
        <span className="text-[#e2e8f0]">{customer.cli_name}</span>
      </div>

      {/* Header card */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-xl font-bold text-indigo-400 flex-shrink-0">
              {customer.cli_name.slice(0, 2)}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{customer.cli_name}</h1>
              <div className="flex flex-wrap gap-3 mt-1.5 text-sm text-[#8892a4]">
                <span className="flex items-center gap-1.5"><Hash size={13} />מ׳ {customer.cli_no}</span>
                {customer.cli_type && <span className="flex items-center gap-1.5"><User size={13} />{customer.cli_type}</span>}
                {customer.phone && <span className="flex items-center gap-1.5"><Phone size={13} />{customer.phone}</span>}
                {customer.cli_email && <span className="flex items-center gap-1.5"><Mail size={13} />{customer.cli_email}</span>}
              </div>
            </div>
          </div>
          <Link
            href={`/dashboard/quotes/automatic?cliNo=${customer.cli_no}&name=${encodeURIComponent(customer.cli_name)}`}
            className="flex items-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition-colors"
          >
            <Plus size={16} /> צור הצעת מחיר אוטומטית
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-[#2e3147]">
          {[
            { icon: Car,      label: 'רכבים',           value: customer.vehicle_count },
            { icon: Wrench,   label: 'הזמנות',           value: customer.order_count },
            { icon: Calendar, label: 'ביקור אחרון',      value: fmtDate(customer.last_visit_dt) },
            { icon: FileText, label: 'סה״כ (הערכה)',     value: customer.total_spent != null ? fmtCurrency(customer.total_spent) : '—' },
          ].map((s, i) => (
            <div key={i} className="text-center">
              <s.icon size={16} className="mx-auto mb-1 text-[#6366f1]" />
              <div className="font-bold text-base">{s.value}</div>
              <div className="text-xs text-[#8892a4] mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Vehicles */}
      <div>
        <h2 className="font-semibold text-[15px] mb-3">רכבים ({vehicles.length})</h2>
        {vehicles.length === 0 ? (
          <div className="bg-[#1a1d27] border border-[#2e3147] border-dashed rounded-xl p-8 text-center">
            <p className="text-[#8892a4] text-sm">אין רכבים</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {vehicles.map(v => (
              <div key={v.car_no} className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-mono font-bold text-[#6366f1]">{v.car_no}</p>
                    <p className="text-sm text-[#e2e8f0] mt-0.5">{v.car_desc ?? '—'}</p>
                  </div>
                  <Link
                    href={`/dashboard/quotes/automatic?plate=${encodeURIComponent(v.car_no)}&cliNo=${customer.cli_no}&name=${encodeURIComponent(customer.cli_name)}&carDesc=${encodeURIComponent(v.car_desc ?? '')}`}
                    className="text-xs text-[#6366f1] hover:underline whitespace-nowrap"
                  >
                    + הצעת מחיר
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs text-[#8892a4]">
                  {v.last_km != null && <span>ק״מ: {v.last_km.toLocaleString()}</span>}
                  {v.prod_dt && <span>שנה: {new Date(v.prod_dt).getFullYear()}</span>}
                  <span>הזמנות: {v.order_count}</span>
                  <span>ביקור אחרון: {fmtDate(v.last_visit_dt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Work order history */}
      <div>
        <h2 className="font-semibold text-[15px] mb-3">היסטוריית כרטיסיות ({history.length})</h2>
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
          {history.length === 0 ? (
            <p className="text-sm text-[#8892a4] text-center py-10">אין היסטוריה</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-[#2e3147] bg-[#252836]">
                    {['כרטיסיה', 'רכב', 'תלונה', 'סטטוס', 'תאריך', 'ק״מ', 'סה״כ'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-right text-xs font-semibold text-[#8892a4] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map(wo => (
                    <tr key={wo.card_id} className="border-b border-[#2e3147] last:border-0 hover:bg-[#252836]/40 transition-colors">
                      <td className="px-3 py-2.5 font-mono text-xs text-[#6366f1] font-semibold">{wo.card_no ?? '—'}</td>
                      <td className="px-3 py-2.5 text-xs text-[#8892a4] whitespace-nowrap">{wo.car_no ?? '—'}</td>
                      <td className="px-3 py-2.5 text-xs text-[#8892a4] max-w-[180px] truncate">{wo.cli_comp1 || '—'}</td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${wo.card_st === 'ס' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                          {statusLabel(wo.card_st)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-[#8892a4] whitespace-nowrap">{fmtDate(wo.open_dt)}</td>
                      <td className="px-3 py-2.5 text-xs text-[#8892a4]">{wo.card_km != null ? wo.card_km.toLocaleString() : '—'}</td>
                      <td className="px-3 py-2.5 text-xs font-semibold text-emerald-400 whitespace-nowrap">{fmtCurrency(wo.total)}</td>
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
