import { prisma } from './prisma'
import { Prisma } from '@prisma/client'
import { toNum } from './utils'

export type CustomerSummary = Prisma.CustomerGetPayload<{
  include: { _count: { select: { vehicles: true; workOrders: true } } }
}>

export type CustomerProfile = Prisma.CustomerGetPayload<{
  include: {
    vehicles: {
      include: { _count: { select: { workOrders: true } } }
    }
    workOrders: {
      include: { vehicle: true }
      orderBy: { createdAt: 'desc' }
    }
    _count: { select: { vehicles: true; workOrders: true } }
  }
}>

export async function getCustomers(search?: string): Promise<CustomerSummary[]> {
  const where: Prisma.CustomerWhereInput = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
          { email: { contains: search, mode: 'insensitive' } },
          { address: { contains: search, mode: 'insensitive' } },
        ],
      }
    : {}

  return prisma.customer.findMany({
    where,
    include: { _count: { select: { vehicles: true, workOrders: true } } },
    orderBy: { name: 'asc' },
  })
}

export async function getCustomer(id: string): Promise<CustomerProfile | null> {
  return prisma.customer.findUnique({
    where: { id },
    include: {
      vehicles: {
        include: { _count: { select: { workOrders: true } } },
        orderBy: { createdAt: 'desc' },
      },
      workOrders: {
        include: { vehicle: true },
        orderBy: { createdAt: 'desc' },
      },
      _count: { select: { vehicles: true, workOrders: true } },
    },
  })
}

export function calcTotalSpent(workOrders: { totalPrice: unknown }[]): number {
  return workOrders.reduce((sum, wo) => sum + toNum(wo.totalPrice), 0)
}

export async function getRecentCustomers(take = 5) {
  return prisma.customer.findMany({
    take,
    include: { _count: { select: { vehicles: true, workOrders: true } } },
    orderBy: { createdAt: 'desc' },
  })
}
