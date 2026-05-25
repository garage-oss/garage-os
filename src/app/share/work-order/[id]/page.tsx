import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Props { params: { id: string } }

const STATUS_HE: Record<string, { label: string; color: string; bg: string; description: string }> = {
  PENDING: { label: 'ממתין לטיפול', color: '#f59e0b', bg: '#f59e0b15', description: 'הרכב הגיע ומחכה להקצאת טכנאי' },
  IN_PROGRESS: { label: 'בטיפול פעיל', color: '#6366f1', bg: '#6366f115', description: 'הטכנאי כעת עובד על רכבך' },
  WAITING_PARTS: { label: 'ממתין לחלקים', color: '#f97316', bg: '#f9731615', description: 'הוזמנו חלקים — נמשיך ברגע שיגיעו' },
  COMPLETED: { label: 'הושלם — מוכן לאיסוף!', color: '#10b981', bg: '#10b98115', description: 'הרכב מוכן ומחכה לאיסוף' },
  CANCELLED: { label: 'בוטל', color: '#ef4444', bg: '#ef444415', description: 'פקודה זו בוטלה' },
}

export default async function ShareWorkOrderPage({ params }: Props) {
  const wo = await prisma.workOrder.findUnique({
    where: { workOrderNumber: params.id },
    include: { customer: true, vehicle: true },
  })

  if (!wo) notFound()

  const st = STATUS_HE[wo.status] ?? STATUS_HE.PENDING
  const laborTotal = Number(wo.laborHours) * Number(wo.laborRate)

  return (
    <div className="min-h-screen bg-[#0f1117] text-[#e2e8f0] py-10 px-4" dir="rtl">
      <div className="max-w-lg mx-auto">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-[#6366f1] rounded-xl flex items-center justify-center font-black text-white text-lg">G</div>
          <div>
            <div className="font-bold text-lg">GarageOS</div>
            <div className="text-xs text-[#8892a4]">עדכון סטטוס רכב</div>
          </div>
        </div>

        {/* Status card */}
        <div
          className="rounded-2xl p-6 mb-4 border"
          style={{ background: st.bg, borderColor: st.color + '40' }}
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="w-3 h-3 rounded-full animate-pulse" style={{ background: st.color }} />
            <span className="font-bold text-xl" style={{ color: st.color }}>{st.label}</span>
          </div>
          <p className="text-sm text-[#8892a4]">{st.description}</p>
        </div>

        {/* Vehicle */}
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5 mb-4">
          <div className="text-xs text-[#8892a4] uppercase tracking-wide mb-3 font-semibold">פרטי רכב</div>
          <div className="text-xl font-bold">{wo.vehicle.make} {wo.vehicle.model} {wo.vehicle.year}</div>
          <div className="font-mono text-[#6366f1] text-lg font-semibold">{wo.vehicle.plate}</div>
          {wo.mileage && <div className="text-sm text-[#8892a4] mt-1">קילומטרז׳: {wo.mileage.toLocaleString('he-IL')} ק"מ</div>}
        </div>

        {/* Work order details */}
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5 mb-4 space-y-3">
          <div className="text-xs text-[#8892a4] uppercase tracking-wide font-semibold">פרטי פקודה</div>
          <div className="flex justify-between text-sm">
            <span className="text-[#8892a4]">מספר פקודה</span>
            <span className="font-mono font-bold">{wo.workOrderNumber}</span>
          </div>
          {wo.assignedTechnician && (
            <div className="flex justify-between text-sm">
              <span className="text-[#8892a4]">טכנאי מטפל</span>
              <span>{wo.assignedTechnician}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-[#8892a4]">תאריך פתיחה</span>
            <span>{formatDate(wo.createdAt)}</span>
          </div>
        </div>

        {/* Complaint / Diagnosis */}
        {(wo.complaint || wo.diagnosis) && (
          <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5 mb-4 space-y-3">
            {wo.complaint && (
              <div>
                <div className="text-xs text-[#8892a4] mb-1">תלונה</div>
                <p className="text-sm">{wo.complaint}</p>
              </div>
            )}
            {wo.diagnosis && (
              <div>
                <div className="text-xs text-[#8892a4] mb-1">אבחון</div>
                <p className="text-sm">{wo.diagnosis}</p>
              </div>
            )}
          </div>
        )}

        {/* Price */}
        {Number(wo.totalPrice) > 0 && (
          <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5 mb-6">
            <div className="text-xs text-[#8892a4] uppercase tracking-wide font-semibold mb-3">עלות משוערת</div>
            <div className="space-y-1.5 text-sm text-[#8892a4]">
              {laborTotal > 0 && (
                <div className="flex justify-between">
                  <span>עבודה ({Number(wo.laborHours)} ש׳)</span>
                  <span>{formatCurrency(laborTotal)}</span>
                </div>
              )}
              {Number(wo.partsTotal) > 0 && (
                <div className="flex justify-between">
                  <span>חלקים</span>
                  <span>{formatCurrency(Number(wo.partsTotal))}</span>
                </div>
              )}
            </div>
            <div className="flex justify-between font-bold text-lg border-t border-[#2e3147] pt-3 mt-3">
              <span>סה"כ</span>
              <span className="text-[#6366f1]">{formatCurrency(Number(wo.totalPrice))}</span>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-[#8892a4]">
          מידע זה עודכן ב-{new Date().toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}
