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

export async function getVehicles(filters?: {
  search?: string
  customerId?: string
  fuelType?: FuelType
  inService?: boolean
}): Promise<VehicleSummary[]> {
  const where: Prisma.VehicleWhereInput = {}

  if (filters?.customerId) where.customerId = filters.customerId
  if (filters?.fuelType) where.fuelType = filters.fuelType
  if (filters?.inService) {
    where.workOrders = { some: { status: { in: ['PENDING', 'IN_PROGRESS', 'WAITING_PARTS'] } } }
  }
  if (filters?.search) {
    where.OR = [
      { plate: { contains: filters.search, mode: 'insensitive' } },
      { make: { contains: filters.search, mode: 'insensitive' } },
      { model: { contains: filters.search, mode: 'insensitive' } },
      { vin: { contains: filters.search, mode: 'insensitive' } },
      { customer: { name: { contains: filters.search, mode: 'insensitive' } } },
    ]
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

export async function getVehicle(id: string): Promise<VehicleProfile | null> {
  return prisma.vehicle.findUnique({
    where: { id },
    include: {
      customer: true,
      workOrders: {
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
}

export async function getVehiclesInService() {
  return prisma.vehicle.findMany({
    where: {
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
