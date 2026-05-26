import { requireOrg } from '@/lib/org'
import { prisma } from '@/lib/prisma'
import { IntakeWizard } from '@/components/intake/IntakeWizard'
import { ClipboardList } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function IntakePage() {
  const { orgId } = await requireOrg()

  // Fetch technicians for the assign step
  const memberships = await prisma.membership.findMany({
    where:   { organizationId: orgId, role: { in: ['TECHNICIAN', 'MANAGER', 'OWNER'] }, isActive: true },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { user: { name: 'asc' } },
  })

  const technicians = memberships.map((m) => ({
    userId: m.userId,
    name:   m.user.name,
  }))

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#6366f1]/15 rounded-xl flex items-center justify-center">
          <ClipboardList size={20} className="text-[#6366f1]" />
        </div>
        <div>
          <h1 className="text-xl font-bold">קבלת רכב</h1>
          <p className="text-sm text-[#8892a4]">פתיחת פקודת עבודה מהירה</p>
        </div>
      </div>

      <IntakeWizard technicians={technicians} orgTechRate={150} />
    </div>
  )
}
