import Link from 'next/link'
import { getDashboardStats } from '@/lib/work-orders'
import { getRecentCustomers } from '@/lib/customers'
import { getVehiclesInService } from '@/lib/vehicles'
import { getLowStockParts, getInventoryValue } from '@/lib/parts'
import { getOpenQuotesCount, getQuotes } from '@/lib/quotes'
import { getRecentUploads } from '@/lib/media'
import { getDiagnosticSessions } from '@/lib/diagnostics'
import { StatusBadge } from '@/components/work-orders/StatusBadge'
import { VehicleCard } from '@/components/vehicles/VehicleCard'
import { LowStockBadge } from '@/components/parts/LowStockBadge'
import { QuoteStatusBadge } from '@/components/quotes/QuoteStatusBadge'
import { formatCurrency, formatDate, toNum } from '@/lib/utils'
import { Car, Users, Wrench, Package, AlertTriangle, FileText, TrendingUp, Paperclip, Brain, Image } from 'lucide-react'
import { formatFileSize, isImage, isAudio } from '@/lib/media'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const [
    { active, waitingParts, completedToday, pending, recentWorkOrders },
    recentCustomers,
    vehiclesInService,
    lowStockParts,
    { costValue, saleValue },
    openQuotesCount,
    openQuotes,
    recentUploads,
    diagnosticSessions,
  ] = await Promise.all([
    getDashboardStats(),
    getRecentCustomers(5),
    getVehiclesInService(),
    getLowStockParts(),
    getInventoryValue(),
    getOpenQuotesCount(),
    getQuotes({ status: 'SENT' }),
    getRecentUploads(6),
    getDiagnosticSessions(),
  ])

  const stats = [
    { label: 'בטיפול כעת', value: active, sub: 'פקודות פעילות', accent: '#6366f1' },
    { label: 'ממתין לחלקים', value: waitingParts, sub: 'רכבים מחכים', accent: '#f97316' },
    { label: 'הושלמו היום', value: completedToday, sub: 'טיפולים הושלמו', accent: '#10b981' },
    { label: 'ממתינות לטיפול', value: pending, sub: 'פקודות חדשות', accent: '#f59e0b' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">לוח בקרה</h1>
          <p className="text-sm text-[#8892a4] mt-0.5">ברוך הבא ל-GarageOS</p>
        </div>
        <Link href="/dashboard/work-orders/new" className="flex items-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors">
          + פקודה חדשה
        </Link>
      </div>

      {/* Work Order Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {stats.map((s) => (
          <div key={s.label} className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5 relative overflow-hidden">
            <div className="absolute top-0 start-0 end-0 h-[3px] rounded-t-xl" style={{ background: s.accent }} />
            <div className="text-xs text-[#8892a4] uppercase tracking-wide mb-1.5">{s.label}</div>
            <div className="text-3xl font-bold leading-none mb-1.5">{s.value}</div>
            <div className="text-xs text-[#8892a4]">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Inventory + Quotes + Diagnostics quick-stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <Link href="/dashboard/inventory" className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-4 flex items-center gap-4 hover:border-[#6366f1]/40 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-[#6366f1]/15 flex items-center justify-center flex-shrink-0">
            <Package size={18} className="text-[#6366f1]" />
          </div>
          <div>
            <div className="text-lg font-bold">{formatCurrency(saleValue)}</div>
            <div className="text-xs text-[#8892a4]">שווי מלאי</div>
          </div>
        </Link>
        <Link href="/dashboard/inventory?lowStock=true" className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-4 flex items-center gap-4 hover:border-amber-500/40 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={18} className="text-amber-400" />
          </div>
          <div>
            <div className="text-lg font-bold">{lowStockParts.length}</div>
            <div className="text-xs text-[#8892a4]">חלקים במלאי נמוך</div>
          </div>
        </Link>
        <Link href="/dashboard/quotes?status=SENT" className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-4 flex items-center gap-4 hover:border-blue-500/40 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center flex-shrink-0">
            <FileText size={18} className="text-blue-400" />
          </div>
          <div>
            <div className="text-lg font-bold">{openQuotesCount}</div>
            <div className="text-xs text-[#8892a4]">הצעות פתוחות</div>
          </div>
        </Link>
        <Link href="/dashboard/diagnostics" className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-4 flex items-center gap-4 hover:border-[#6366f1]/40 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-[#6366f1]/15 flex items-center justify-center flex-shrink-0">
            <Brain size={18} className="text-[#6366f1]" />
          </div>
          <div>
            <div className="text-lg font-bold">{diagnosticSessions.length}</div>
            <div className="text-xs text-[#8892a4]">אבחוני AI</div>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Work Orders */}
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e3147]">
            <div className="flex items-center gap-2 font-semibold text-[15px]">
              <Wrench size={15} className="text-[#8892a4]" />פקודות אחרונות
            </div>
            <Link href="/dashboard/work-orders" className="text-xs text-[#6366f1] hover:underline">הצג הכל</Link>
          </div>
          {recentWorkOrders.length === 0 ? (
            <p className="text-sm text-[#8892a4] text-center py-10">אין פקודות עבודה</p>
          ) : (
            <div className="divide-y divide-[#2e3147]">
              {recentWorkOrders.map(wo => (
                <div key={wo.id} className="flex items-center justify-between px-5 py-3 hover:bg-[#252836]/40 transition-colors">
                  <div className="min-w-0">
                    <Link href={`/dashboard/work-orders/${wo.id}`} className="font-mono text-xs text-[#6366f1] hover:underline font-semibold">{wo.workOrderNumber}</Link>
                    <div className="text-sm font-medium truncate">{wo.customer.name}</div>
                    <div className="text-xs text-[#8892a4] truncate">{wo.vehicle.make} {wo.vehicle.model} — {wo.vehicle.plate}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0 ms-3">
                    <StatusBadge status={wo.status} />
                    <span className="text-xs font-semibold">{formatCurrency(toNum(wo.totalPrice))}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Customers */}
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e3147]">
            <div className="flex items-center gap-2 font-semibold text-[15px]">
              <Users size={15} className="text-[#8892a4]" />לקוחות אחרונים
            </div>
            <Link href="/dashboard/customers" className="text-xs text-[#6366f1] hover:underline">הצג הכל</Link>
          </div>
          {recentCustomers.length === 0 ? (
            <p className="text-sm text-[#8892a4] text-center py-10">אין לקוחות</p>
          ) : (
            <div className="divide-y divide-[#2e3147]">
              {recentCustomers.map(c => (
                <div key={c.id} className="flex items-center justify-between px-5 py-3 hover:bg-[#252836]/40 transition-colors">
                  <div>
                    <Link href={`/dashboard/customers/${c.id}`} className="font-semibold text-sm hover:text-[#6366f1] transition-colors">{c.name}</Link>
                    <div className="text-xs text-[#8892a4]">{c.phone}</div>
                  </div>
                  <div className="flex gap-3 text-xs text-[#8892a4]">
                    <span className="flex items-center gap-1"><Car size={11} />{c._count.vehicles}</span>
                    <span className="flex items-center gap-1"><Wrench size={11} />{c._count.workOrders}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Low Stock Parts */}
        {lowStockParts.length > 0 && (
          <div className="bg-[#1a1d27] border border-amber-500/20 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e3147]">
              <div className="flex items-center gap-2 font-semibold text-[15px]">
                <AlertTriangle size={15} className="text-amber-400" />
                <span>מלאי נמוך</span>
                <span className="text-xs bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full font-semibold">{lowStockParts.length}</span>
              </div>
              <Link href="/dashboard/inventory?lowStock=true" className="text-xs text-[#6366f1] hover:underline">הצג הכל</Link>
            </div>
            <div className="divide-y divide-[#2e3147]">
              {lowStockParts.slice(0, 5).map(p => (
                <div key={p.id} className="flex items-center justify-between px-5 py-3 hover:bg-[#252836]/40 transition-colors">
                  <div className="min-w-0">
                    <Link href={`/dashboard/inventory/${p.id}`} className="font-mono text-xs text-[#6366f1] hover:underline font-semibold">{p.sku}</Link>
                    <div className="text-sm font-medium truncate">{p.name}</div>
                    <div className="text-xs text-[#8892a4]">{p.category ?? '—'}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0 ms-3">
                    <LowStockBadge quantity={p.quantity} minQuantity={p.minQuantity} />
                    <span className="text-xs text-[#8892a4]">{p.quantity} / {p.minQuantity} יח׳</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Open Quotes */}
        {openQuotes.length > 0 && (
          <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e3147]">
              <div className="flex items-center gap-2 font-semibold text-[15px]">
                <FileText size={15} className="text-[#8892a4]" />הצעות ממתינות לאישור
              </div>
              <Link href="/dashboard/quotes?status=SENT" className="text-xs text-[#6366f1] hover:underline">הצג הכל</Link>
            </div>
            <div className="divide-y divide-[#2e3147]">
              {openQuotes.slice(0, 5).map(q => (
                <div key={q.id} className="flex items-center justify-between px-5 py-3 hover:bg-[#252836]/40 transition-colors">
                  <div className="min-w-0">
                    <Link href={`/dashboard/quotes/${q.id}`} className="font-mono text-xs text-[#6366f1] hover:underline font-semibold">{q.quoteNumber}</Link>
                    <div className="text-sm font-medium truncate">{q.customer.name}</div>
                    {q.vehicle && (
                      <div className="text-xs text-[#8892a4]">{q.vehicle.make} {q.vehicle.model} — {q.vehicle.plate}</div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0 ms-3">
                    <QuoteStatusBadge status={q.status} />
                    <span className="text-xs font-semibold text-[#6366f1]">{formatCurrency(q.totalPrice)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recent Uploads + AI Diagnostics */}
      {(recentUploads.length > 0 || diagnosticSessions.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Recent Uploads */}
          {recentUploads.length > 0 && (
            <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e3147]">
                <div className="flex items-center gap-2 font-semibold text-[15px]">
                  <Paperclip size={15} className="text-[#8892a4]" />העלאות אחרונות
                </div>
              </div>
              <div className="divide-y divide-[#2e3147]">
                {recentUploads.map((f) => (
                  <div key={f.id} className="flex items-center gap-3 px-5 py-3">
                    {isImage(f.mimeType) ? (
                      <img src={f.url} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-[#252836] flex items-center justify-center flex-shrink-0">
                        {isAudio(f.mimeType) ? <Paperclip size={14} className="text-purple-400" /> : <Paperclip size={14} className="text-[#8892a4]" />}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{f.originalName}</div>
                      <div className="text-xs text-[#8892a4]">{formatFileSize(f.size)}</div>
                    </div>
                    <div className="flex-shrink-0 text-xs text-[#8892a4]">
                      {f.workOrder ? (
                        <Link href={`/dashboard/work-orders/${f.workOrder?.workOrderNumber}`} className="font-mono text-[#6366f1] hover:underline">
                          {f.workOrder.workOrderNumber}
                        </Link>
                      ) : f.vehicle ? (
                        <span className="font-mono">{f.vehicle.plate}</span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Diagnostics */}
          {diagnosticSessions.length > 0 && (
            <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e3147]">
                <div className="flex items-center gap-2 font-semibold text-[15px]">
                  <Brain size={15} className="text-[#6366f1]" />אבחונים AI אחרונים
                </div>
                <Link href="/dashboard/diagnostics" className="text-xs text-[#6366f1] hover:underline">הצג הכל</Link>
              </div>
              <div className="divide-y divide-[#2e3147]">
                {diagnosticSessions.slice(0, 5).map((s) => (
                  <Link key={s.id} href={`/dashboard/diagnostics/${s.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-[#252836]/40 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{s.complaint}</div>
                      {s.vehicle && (
                        <div className="text-xs text-[#8892a4]">{s.vehicle.make} {s.vehicle.model} — {s.vehicle.plate}</div>
                      )}
                    </div>
                    <div className="flex-shrink-0 ms-3">
                      <span className={`text-xs border px-2 py-0.5 rounded-full font-semibold ${
                        s.urgency === 'CRITICAL' ? 'text-red-400 bg-red-500/10 border-red-500/25' :
                        s.urgency === 'HIGH' ? 'text-orange-400 bg-orange-500/10 border-orange-500/25' :
                        s.urgency === 'MEDIUM' ? 'text-amber-400 bg-amber-500/10 border-amber-500/25' :
                        'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
                      }`}>
                        {s.urgency === 'CRITICAL' ? 'קריטי' : s.urgency === 'HIGH' ? 'דחוף' : s.urgency === 'MEDIUM' ? 'בינוני' : 'רגיל'}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Vehicles in Service */}
      {vehiclesInService.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 font-semibold text-[15px]">
              <Car size={15} className="text-[#8892a4]" />רכבים בשירות ({vehiclesInService.length})
            </div>
            <Link href="/dashboard/vehicles?inService=true" className="text-xs text-[#6366f1] hover:underline">הצג הכל</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {vehiclesInService.slice(0, 4).map(v => (
              <VehicleCard
                key={v.id}
                id={v.id}
                plate={v.plate}
                make={v.make}
                model={v.model}
                year={v.year}
                color={v.color}
                fuelType={v.fuelType}
                transmission={v.transmission}
                mileage={v.mileage}
                workOrderCount={v.workOrders.length}
                customerName={v.customer.name}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
