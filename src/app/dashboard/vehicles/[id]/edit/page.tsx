import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { VehicleForm } from '@/components/vehicles/VehicleForm'
import { toNum } from '@/lib/utils'

interface Props { params: { id: string } }

export default async function EditVehiclePage({ params }: Props) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: params.id } })
  if (!vehicle) notFound()

  const customers = await prisma.customer.findMany({ orderBy: { name: 'asc' } })

  const vehicleData = {
    id: vehicle.id,
    customerId: vehicle.customerId,
    plate: vehicle.plate,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    color: vehicle.color,
    vin: vehicle.vin,
    engine: vehicle.engine,
    fuelType: vehicle.fuelType,
    transmission: vehicle.transmission,
    mileage: vehicle.mileage,
    notes: vehicle.notes,
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 text-sm text-[#8892a4] mb-6 flex-wrap">
        <Link href="/dashboard/vehicles" className="hover:text-[#e2e8f0] transition-colors">רכבים</Link>
        <ChevronRight size={14} className="rotate-180" />
        <Link href={`/dashboard/vehicles/${vehicle.id}`} className="hover:text-[#e2e8f0] transition-colors font-mono">{vehicle.plate}</Link>
        <ChevronRight size={14} className="rotate-180" />
        <span className="text-[#e2e8f0]">עריכה</span>
      </div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">עריכת רכב</h1>
        <p className="text-sm text-[#8892a4] mt-0.5 font-mono">{vehicle.plate}</p>
      </div>
      <VehicleForm customers={customers} mode="edit" vehicle={vehicleData} />
    </div>
  )
}
