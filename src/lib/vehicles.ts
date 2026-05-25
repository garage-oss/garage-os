import { prisma } from './prisma'
import { FuelType, Prisma } from '@prisma/client'

export type VehicleSummary = Prisma.VehicleGetPayload<{
  include: {
    customer: true
    _count: { select: { workOrders: true } }
  }
}>

export type VehicleProfile = Prisma.VehicleGetPayload<{
  include: {
    customer: true
    workOrders: {
      include: { items: true }
      orderBy: { createdAt: 'desc' }
    }
  }
}>

export const FUEL_LABELS: Record<FuelType, string> = {
  GASOLINE: 'בנזין',
  DIESEL: 'דיזל',
  HYBRID: 'היברידי',
  ELECTRIC: 'חשמלי',
  LPG: 'גז (LPG)',
}

export const TRANSMISSION_LABELS: Record<string, string> = {
  MANUAL: 'ידני',
  AUTOMATIC: 'אוטומטי',
  CVT: 'CVT',
}

export async function getVehicles(
  orgId: string,
  filters?: { search?: string; customerId?: string; fuelType?: FuelType; inService?: boolean }
): Promise<VehicleSummary[]> {
  const where: Prisma.VehicleWhereInput = { organizationId: orgId }

  if (filters?.customerId) where.customerId = filters.customerId
  if (filters?.fuelType) where.fuelType = filters.fuelType
  if (filters?.inService) {
    where.workOrders = { some: { status: { in: ['PENDING', 'IN_PROGRESS', 'WAITING_PARTS'] } } }
  }
  if (filters?.search) {
    where.AND = [
      { organizationId: orgId },
      {
        OR: [
          { plate: { contains: filters.search, mode: 'insensitive' } },
          { make: { contains: filters.search, mode: 'insensitive' } },
          { model: { contains: filters.search, mode: 'insensitive' } },
          { vin: { contains: filters.search, mode: 'insensitive' } },
          { customer: { name: { contains: filters.search, mode: 'insensitive' } } },
        ],
      },
    ]
    delete where.organizationId
    delete where.customerId
    delete where.fuelType
  }

  return prisma.vehicle.findMany({
    where,
    include: {
      customer: true,
      _count: { select: { workOrders: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getVehicle(orgId: string, id: string): Promise<VehicleProfile | null> {
  return prisma.vehicle.findFirst({
    where: { id, organizationId: orgId },
    include: {
      customer: true,
      workOrders: {
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
}

export async function getVehiclesInService(orgId: string) {
  return prisma.vehicle.findMany({
    where: {
      organizationId: orgId,
      workOrders: { some: { status: { in: ['IN_PROGRESS', 'WAITING_PARTS'] } } },
    },
    include: {
      customer: true,
      workOrders: {
        where: { status: { in: ['IN_PROGRESS', 'WAITING_PARTS'] } },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })
}
