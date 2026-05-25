import Link from 'next/link'
import { ChevronRight, Brain } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requireOrg } from '@/lib/org'
import { DiagnosticForm } from '@/components/diagnostics/DiagnosticForm'

interface Props {
  searchParams: { vehicleId?: string; workOrderId?: string; complaint?: string }
}

export default async function NewDiagnosticPage({ searchParams }: Props) {
  const { orgId } = await requireOrg()
  const vehicles = await prisma.vehicle.findMany({
    where: { organizationId: orgId },
    orderBy: [{ make: 'asc' }, { model: 'asc' }],
    select: { id: true, make: true, model: true, plate: true, year: true },
  })

  return (
    <div>
      <div className="flex items-center gap-1.5 text-sm text-[#8892a4] mb-6">
        <Link href="/dashboard/diagnostics" className="hover:text-[#e2e8f0] transition-colors">אבחון AI</Link>
        <ChevronRight size={14} className="rotate-180" />
        <span className="text-[#e2e8f0]">אבחון חדש</span>
      </div>
      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#6366f1]/15 flex items-center justify-center">
          <Brain size={20} className="text-[#6366f1]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">אבחון AI</h1>
          <p className="text-sm text-[#8892a4] mt-0.5">מנוע אבחון חכם מבוסס Claude AI</p>
        </div>
      </div>
      <DiagnosticForm
        vehicles={vehicles}
        defaultVehicleId={searchParams.vehicleId}
        defaultWorkOrderId={searchParams.workOrderId}
        defaultComplaint={searchParams.complaint}
      />
    </div>
  )
}
