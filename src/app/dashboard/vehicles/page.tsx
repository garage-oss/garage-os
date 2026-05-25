import Link from 'next/link'
import { getVehicles } from '@/lib/vehicles'
import { requireOrg } from '@/lib/org'
import { VehicleCard } from '@/components/vehicles/VehicleCard'
import { VehicleFilters } from '@/components/vehicles/VehicleFilters'
import { FuelType } from '@prisma/client'
import { Plus } from 'lucide-react'

interface PageProps { searchParams: { q?: string; fuel?: string; inService?: string } }

export const dynamic = 'force-dynamic'

export default async function VehiclesPage({ searchParams }: PageProps) {
  const { orgId } = await requireOrg()
  const vehicles = await getVehicles(orgId, {
    search: searchParams.q,
    fuelType: searchParams.fuel as FuelType | undefined,
    inService: searchParams.inService === 'true',
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold">רכבים</h1>
          <p className="text-sm text-[#8892a4] mt-0.5">{vehicles.length} רכבים</p>
        </div>
        <Link href="/dashboard/vehicles/new" className="flex items-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors">
          <Plus size={16} />רכב חדש
        </Link>
      </div>

      <VehicleFilters
        currentSearch={searchParams.q}
        currentFuel={searchParams.fuel}
        currentInService={searchParams.inService === 'true'}
      />

      {vehicles.length === 0 ? (
        <div className="bg-[#1a1d27] border border-[#2e3147] border-dashed rounded-xl p-16 text-center">
          <p className="text-[#8892a4]">אין רכבים התואמים לחיפוש</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {vehicles.map(v => (
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
              workOrderCount={v._count.workOrders}
              customerName={v.customer.name}
            />
          ))}
        </div>
      )}
    </div>
  )
}
