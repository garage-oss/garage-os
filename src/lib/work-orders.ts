import { prisma } from './prisma'
import { WorkOrderStatus, Prisma } from '@prisma/client'

export type WorkOrderWithRelations = Prisma.WorkOrderGetPayload<{
  include: { customer: true; vehicle: true; items: true }
}>

export type WorkOrderSummary = Prisma.WorkOrderGetPayload<{
  include: { customer: true; vehicle: true }
}>

export async function getWorkOrders(
  orgId: string,
  filters?: { status?: WorkOrderStatus; search?: string }
): Promise<WorkOrderSummary[]> {
  const where: Prisma.WorkOrderWhereInput = { organizationId: orgId }

  if (filters?.status) where.status = filters.status

  if (filters?.search) {
    where.AND = [
      { organizationId: orgId },
      {
        OR: [
          { workOrderNumber: { contains: filters.search, mode: 'insensitive' } },
          { customer: { name: { contains: filters.search, mode: 'insensitive' } } },
          { vehicle: { plate: { contains: filters.search, mode: 'insensitive' } } },
          { assignedTechnician: { contains: filters.search, mode: 'insensitive' } },
        ],
      },
    ]
    delete where.organizationId
    delete where.status
  }

  return prisma.workOrder.findMany({
    where,
    include: { customer: true, vehicle: true },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getWorkOrder(orgId: string, id: string): Promise<WorkOrderWithRelations | null> {
  return prisma.workOrder.findFirst({
    where: { id, organizationId: orgId },
    include: { customer: true, vehicle: true, items: true },
  })
}

export async function getDashboardStats(orgId: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [active, waitingParts, completedToday, pending, recentWorkOrders] = await Promise.all([
    prisma.workOrder.count({ where: { organizationId: orgId, status: 'IN_PROGRESS' } }),
    prisma.workOrder.count({ where: { organizationId: orgId, status: 'WAITING_PARTS' } }),
    prisma.workOrder.count({ where: { organizationId: orgId, status: 'COMPLETED', updatedAt: { gte: today } } }),
    prisma.workOrder.count({ where: { organizationId: orgId, status: 'PENDING' } }),
    prisma.workOrder.findMany({
      where: { organizationId: orgId },
      take: 6,
      include: { customer: true, vehicle: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return { active, waitingParts, completedToday, pending, recentWorkOrders }
}

export async function generateWorkOrderNumber(orgId: string): Promise<string> {
  const year = new Date().getFullYear()
  const count = await prisma.workOrder.count({
    where: { organizationId: orgId, createdAt: { gte: new Date(`${year}-01-01`) } },
  })
  return `WO-${year}-${String(count + 1).padStart(4, '0')}`
}
