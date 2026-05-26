'use client'

import Link from 'next/link'
import { WorkOrderStatus } from '@prisma/client'
import { ChevronLeft, Phone } from 'lucide-react'

interface JobCardProps {
  job: {
    id:              string
    workOrderNumber: string
    status:          WorkOrderStatus
    complaint:       string | null
    assignedTechnician: string | null
    customer:        { name: string; phone: string }
    vehicle:         { plate: string; make: string; model: string; year: number }
    createdAt:       string
  }
  activeEntryId: string | null
  highlight?:    boolean
}

const STATUS_COLORS: Record<WorkOrderStatus, string> = {
  PENDING:       'text-amber-400  bg-amber-400/10  border-amber-400/30',
  IN_PROGRESS:   'text-[#6366f1]  bg-[#6366f1]/10  border-[#6366f1]/30',
  WAITING_PARTS: 'text-orange-400 bg-orange-400/10 border-orange-400/30',
  COMPLETED:     'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  CANCELLED:     'text-[#8892a4]  bg-[#8892a4]/10  border-[#8892a4]/30',
}
const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  PENDING:       'ממתין',
  IN_PROGRESS:   'בטיפול',
  WAITING_PARTS: 'ממתין חלקים',
  COMPLETED:     'הושלם',
  CANCELLED:     'בוטל',
}

export function MobileJobCard({ job, activeEntryId, highlight }: JobCardProps) {
  const age = Math.floor((Date.now() - new Date(job.createdAt).getTime()) / 3600000)
  const ageStr = age < 1 ? 'פחות משעה' : age < 24 ? `${age} שעות` : `${Math.floor(age / 24)} ימים`

  return (
    <Link
      href={`/mobile/jobs/${job.id}`}
      className={[
        'block bg-[#1a1d27] border rounded-xl p-4 transition-all active:scale-[0.98]',
        highlight ? 'border-[#6366f1]/50 shadow-lg shadow-[#6366f1]/5' : 'border-[#2e3147] hover:border-[#3e4157]',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-xs font-bold text-[#6366f1]">{job.workOrderNumber}</span>
            <span className={`text-[10px] border px-1.5 py-0.5 rounded-full font-semibold ${STATUS_COLORS[job.status]}`}>
              {STATUS_LABELS[job.status]}
            </span>
            {activeEntryId && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                פועל
              </span>
            )}
          </div>

          {/* Customer + vehicle */}
          <div className="font-semibold text-[15px] truncate">{job.customer.name}</div>
          <div className="text-xs text-[#8892a4] mt-0.5 truncate">
            <span className="font-mono font-semibold text-white/70">{job.vehicle.plate}</span>
            {' — '}{job.vehicle.year} {job.vehicle.make} {job.vehicle.model}
          </div>

          {/* Complaint preview */}
          {job.complaint && (
            <p className="text-xs text-[#a8b4c8] mt-2 line-clamp-2 leading-relaxed">
              {job.complaint}
            </p>
          )}

          {/* Footer */}
          <div className="flex items-center gap-3 mt-3">
            <span className="text-[10px] text-[#8892a4]">לפני {ageStr}</span>
            <a
              href={`tel:${job.customer.phone}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-[10px] text-[#6366f1] hover:underline"
            >
              <Phone size={10} />
              {job.customer.phone}
            </a>
          </div>
        </div>

        <ChevronLeft size={18} className="text-[#8892a4] mt-1 flex-shrink-0" />
      </div>
    </Link>
  )
}
