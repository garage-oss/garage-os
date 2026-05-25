'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight, Pencil, Trash2, Loader2, User, Car, Wrench, Clock } from 'lucide-react'
import { StatusBadge } from '@/components/work-orders/StatusBadge'
import { StatusActions } from '@/components/work-orders/StatusActions'
import { deleteWorkOrder } from '@/app/actions/work-orders'
import { WorkOrderStatus } from '@prisma/client'

interface WorkOrderDetail {
  id: string
  workOrderNumber: string
  status: WorkOrderStatus
  complaint: string | null
  diagnosis: string | null
  assignedTechnician: string | null
  laborHours: number
  laborRate: number
  partsTotal: number
  totalPrice: number
  mileage: number | null
  notes: string | null
  createdAt: string
  updatedAt: string
  customer: { id: string; name: string; phone: string; email: string | null }
  vehicle: { id: string; plate: string; make: string; model: string; year: number; color: string | null }
}

function fmt(n: number) {
  return `₪${n.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(d: string) {
  return new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d))
}

function InfoBox({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs text-muted uppercase tracking-wide mb-1">{label}</div>
      <div className="text-sm font-medium">{value || '—'}</div>
    </div>
  )
}

export default function WorkOrderDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [wo, setWo] = useState<WorkOrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, startDelete] = useTransition()

  useEffect(() => {
    fetch(`/api/work-orders/${params.id}`)
      .then((r) => r.json())
      .then((data) => { setWo(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [params.id])

  function handleDelete() {
    if (!confirm('האם למחוק את פקודת העבודה? פעולה זו אינה הפיכה.')) return
    startDelete(async () => {
      const res = await deleteWorkOrder(params.id)
      if (!res.error) router.push('/dashboard/work-orders')
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-muted" />
      </div>
    )
  }

  if (!wo) {
    return (
      <div className="text-center py-20">
        <p className="text-muted mb-4">פקודת עבודה לא נמצאה</p>
        <Link href="/dashboard/work-orders" className="text-sm text-[#6366f1] hover:underline">
          חזרה לרשימה
        </Link>
      </div>
    )
  }

  const laborTotal = wo.laborHours * wo.laborRate

  return (
    <div className="max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted mb-6">
        <Link href="/dashboard/work-orders" className="hover:text-[#e2e8f0] transition-colors">
          פקודות עבודה
        </Link>
        <ChevronRight size={14} className="rotate-180" />
        <span className="text-[#e2e8f0] font-mono">{wo.workOrderNumber}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold font-mono">{wo.workOrderNumber}</h1>
          <StatusBadge status={wo.status} />
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/work-orders/${wo.id}/edit`}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted border border-[#2e3147] rounded-lg hover:bg-[#252836] hover:text-[#e2e8f0] transition-all"
          >
            <Pencil size={14} />
            ערוך
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-all disabled:opacity-50"
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            מחק
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Customer & Vehicle */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-surface border border-[#2e3147] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <User size={15} className="text-muted" />
              <span className="text-xs font-semibold text-muted uppercase tracking-wide">לקוח</span>
            </div>
            <div className="space-y-3">
              <InfoBox label="שם" value={wo.customer.name} />
              <InfoBox label="טלפון" value={wo.customer.phone} />
              {wo.customer.email && <InfoBox label="אימייל" value={wo.customer.email} />}
            </div>
          </div>

          <div className="bg-surface border border-[#2e3147] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Car size={15} className="text-muted" />
              <span className="text-xs font-semibold text-muted uppercase tracking-wide">רכב</span>
            </div>
            <div className="space-y-3">
              <InfoBox label="לוחית רישוי" value={wo.vehicle.plate} />
              <InfoBox label="יצרן ודגם" value={`${wo.vehicle.make} ${wo.vehicle.model} ${wo.vehicle.year}`} />
              {wo.vehicle.color && <InfoBox label="צבע" value={wo.vehicle.color} />}
              {wo.mileage && <InfoBox label="קילומטראז'" value={wo.mileage.toLocaleString('he-IL')} />}
            </div>
          </div>
        </div>

        {/* Complaint */}
        <div className="bg-surface border border-[#2e3147] rounded-xl p-5">
          <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">תלונת לקוח</div>
          <p className="text-sm leading-relaxed">{wo.complaint ?? '—'}</p>
        </div>

        {/* Diagnosis */}
        <div className="bg-surface border border-[#2e3147] rounded-xl p-5">
          <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">אבחון טכנאי</div>
          <p className="text-sm leading-relaxed">{wo.diagnosis ?? 'טרם הוזן אבחון'}</p>
        </div>

        {/* Work & Financial */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-surface border border-[#2e3147] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Wrench size={15} className="text-muted" />
              <span className="text-xs font-semibold text-muted uppercase tracking-wide">פרטי עבודה</span>
            </div>
            <div className="space-y-3">
              <InfoBox label="טכנאי אחראי" value={wo.assignedTechnician} />
              <InfoBox label="שעות עבודה" value={`${wo.laborHours} שעות`} />
              <InfoBox label="תעריף לשעה" value={fmt(wo.laborRate)} />
            </div>
          </div>

          <div className="bg-surface border border-[#2e3147] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock size={15} className="text-muted" />
              <span className="text-xs font-semibold text-muted uppercase tracking-wide">סיכום כספי</span>
            </div>
            <div className="space-y-2">
              {[
                { label: 'עבודה', value: fmt(laborTotal) },
                { label: 'חלקים', value: fmt(wo.partsTotal) },
              ].map((r) => (
                <div key={r.label} className="flex justify-between text-sm">
                  <span className="text-muted">{r.label}</span>
                  <span>{r.value}</span>
                </div>
              ))}
              <div className="border-t border-[#2e3147] pt-2 mt-2 flex justify-between items-center">
                <span className="text-sm font-semibold">סה&#34;כ</span>
                <span className="text-lg font-bold text-[#6366f1]">{fmt(wo.totalPrice)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        {wo.notes && (
          <div className="bg-surface border border-[#2e3147] rounded-xl p-5">
            <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">הערות</div>
            <p className="text-sm text-muted leading-relaxed">{wo.notes}</p>
          </div>
        )}

        {/* Status actions */}
        <div className="bg-surface border border-[#2e3147] rounded-xl p-5">
          <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-4">עדכון סטטוס</div>
          <StatusActions workOrderId={wo.id} currentStatus={wo.status} />
        </div>

        {/* Meta */}
        <div className="flex gap-6 text-xs text-muted px-1">
          <span>נוצר: {fmtDate(wo.createdAt)}</span>
          <span>עודכן: {fmtDate(wo.updatedAt)}</span>
        </div>
      </div>
    </div>
  )
}
