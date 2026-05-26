import { notFound } from 'next/navigation'
import { requireOrg } from '@/lib/org'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { ChevronRight, User, Car, MapPin, AlertCircle } from 'lucide-react'
import { MobileTimerSection } from '@/components/mobile/MobileTimerSection'
import { MobileNotesSection } from '@/components/mobile/MobileNotesSection'
import { MobilePhotosSection } from '@/components/mobile/MobilePhotosSection'
import { MobileStatusSection } from '@/components/mobile/MobileStatusSection'
import { formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const STATUS_COLORS: Record<string, string> = {
  PENDING:       'text-amber-400 bg-amber-400/10 border-amber-400/25',
  IN_PROGRESS:   'text-[#6366f1] bg-[#6366f1]/10 border-[#6366f1]/25',
  WAITING_PARTS: 'text-orange-400 bg-orange-400/10 border-orange-400/25',
  COMPLETED:     'text-emerald-400 bg-emerald-400/10 border-emerald-400/25',
  CANCELLED:     'text-[#8892a4] bg-[#8892a4]/10 border-[#8892a4]/25',
}
const STATUS_LABELS: Record<string, string> = {
  PENDING:       'ממתין',
  IN_PROGRESS:   'בטיפול',
  WAITING_PARTS: 'ממתין לחלקים',
  COMPLETED:     'הושלם',
  CANCELLED:     'בוטל',
}

export default async function MobileJobDetailPage({ params }: { params: { id: string } }) {
  const { orgId, userId } = await requireOrg()

  const wo = await prisma.workOrder.findFirst({
    where: { id: params.id, organizationId: orgId },
    include: {
      customer:    { select: { id: true, name: true, phone: true } },
      vehicle:     { select: { id: true, plate: true, make: true, model: true, year: true, color: true, mileage: true } },
      techNotes:   { orderBy: { createdAt: 'asc' } },
      media:       { orderBy: { createdAt: 'desc' }, take: 20 },
      timeEntries: {
        where:   { techId: userId },
        orderBy: { startedAt: 'desc' },
      },
    },
  })
  if (!wo) notFound()

  const activeEntry = wo.timeEntries.find((e) => !e.finishedAt) ?? null

  // Total logged minutes for this technician
  const totalMin = wo.timeEntries.reduce((acc, e) => {
    if (e.finishedAt) return acc + e.durationMin
    if (e.pausedAt)   return acc + e.durationMin
    const elapsed = Math.floor((Date.now() - e.startedAt.getTime()) / 60000)
    return acc + e.durationMin + elapsed
  }, 0)

  return (
    <div className="space-y-4">
      {/* Back + WO number */}
      <div className="flex items-center gap-2 -mb-1">
        <Link href="/mobile/jobs" className="text-[#8892a4] hover:text-white">
          <ChevronRight size={20} className="rotate-180" />
        </Link>
        <span className="font-mono text-sm font-bold text-[#6366f1]">{wo.workOrderNumber}</span>
        <span className={`ms-auto text-xs border px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[wo.status] ?? ''}`}>
          {STATUS_LABELS[wo.status] ?? wo.status}
        </span>
      </div>

      {/* Complaint */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-4">
        <div className="flex items-center gap-2 text-xs text-[#8892a4] mb-2 font-semibold uppercase tracking-wide">
          <AlertCircle size={12} />
          תלונת לקוח
        </div>
        <p className="text-sm leading-relaxed">{wo.complaint ?? '—'}</p>
        {wo.diagnosis && (
          <>
            <div className="text-xs text-[#8892a4] mt-3 mb-1 font-semibold uppercase tracking-wide">אבחנה</div>
            <p className="text-sm text-[#a8b4c8] leading-relaxed">{wo.diagnosis}</p>
          </>
        )}
      </div>

      {/* Customer + Vehicle */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-xs text-[#8892a4] mb-2 font-semibold">
            <User size={11} />לקוח
          </div>
          <div className="font-semibold text-sm truncate">{wo.customer.name}</div>
          <a href={`tel:${wo.customer.phone}`} className="text-xs text-[#6366f1] mt-0.5 block">
            {wo.customer.phone}
          </a>
        </div>
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-xs text-[#8892a4] mb-2 font-semibold">
            <Car size={11} />רכב
          </div>
          <div className="font-bold font-mono text-sm">{wo.vehicle.plate}</div>
          <div className="text-xs text-[#8892a4] mt-0.5 truncate">
            {wo.vehicle.year} {wo.vehicle.make} {wo.vehicle.model}
          </div>
        </div>
      </div>

      {wo.vehicle.mileage && (
        <div className="flex items-center gap-2 text-xs text-[#8892a4] px-1">
          <MapPin size={11} />
          <span>{wo.vehicle.mileage.toLocaleString('he-IL')} ק"מ בכניסה</span>
        </div>
      )}

      {/* Timer section */}
      <MobileTimerSection
        workOrderId={wo.id}
        activeEntryId={activeEntry?.id ?? null}
        activeStartedAt={activeEntry?.startedAt.toISOString() ?? null}
        activePausedAt={activeEntry?.pausedAt?.toISOString() ?? null}
        activeDurationMin={activeEntry?.durationMin ?? 0}
        totalMinutes={totalMin}
        workOrderStatus={wo.status}
      />

      {/* Status change */}
      <MobileStatusSection workOrderId={wo.id} currentStatus={wo.status} />

      {/* Notes */}
      <MobileNotesSection
        workOrderId={wo.id}
        initialNotes={wo.techNotes.map((n) => ({
          id:         n.id,
          content:    n.content,
          authorName: n.authorName,
          visibility: n.visibility,
          createdAt:  n.createdAt.toISOString(),
        }))}
      />

      {/* Photos */}
      <MobilePhotosSection
        workOrderId={wo.id}
        initialMedia={wo.media.map((m) => ({
          id:           m.id,
          url:          m.url,
          originalName: m.originalName,
          mimeType:     m.mimeType,
        }))}
      />

      <div className="text-center text-xs text-[#8892a4] pb-2">
        נוצר {formatDate(wo.createdAt)}
      </div>
    </div>
  )
}
